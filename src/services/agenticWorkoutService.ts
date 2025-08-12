import { prisma } from "../..";
import { CREATE_WORKOUT_FIELDS, IntentDetectionResult, RAG_KEYWORDS, UPDATE_WORKOUT_FIELDS, WORKOUT_TYPES } from "../interfaces/workout";
import { getRecentChatHistory, storeAssistantMessage, storeUserMessage } from "../utils/chatUtils";
import { llmModel, parseLlmResponseAsJson } from "../utils/llm";
import { calculateDuration, parseDatesInFields } from "../utils/dateUtils";
import { RagChat } from "./ragChatService";
import { createWorkoutEmbedding, generateWorkoutEmbedding, generateWorkoutEmbeddingText } from "../utils/workoutEmbeddingUtils";

export class AgenticWorkoutService {
  private ragChatService = new RagChat()
  constructor() {
    this.init()
  }
  init() {
    console.log('Agentic workout service initialized with RAG integration');
  }
  /**
   * Check if user input requires RAG mode during agentic flow
   */
  async shouldUseRagMode(prompt: string): Promise<boolean> {
    const promptLower = prompt.toLowerCase();
    return RAG_KEYWORDS.some(keyword => promptLower.includes(keyword));
    // TODO : Add an llm fall back
  }

  /**
 * Get context about current intent for RAG prompts
 */
  async getIntentContext(intent: any): Promise<string> {
    const metadata = intent.metadata || {};
    let context = `Intent: ${intent.intentType}\n`;

    if (intent.missingFields && intent.missingFields.length > 0) {
      context += `Missing required fields: ${intent.missingFields.join(', ')}\n`;
    }

    if (intent.optionalFields && intent.optionalFields.length > 0) {
      context += `Optional fields available: ${intent.optionalFields.join(', ')}\n`;
    }

    if (Object.keys(metadata).length > 0) {
      context += `Current data: ${JSON.stringify(metadata, null, 2)}\n`;
    }

    return context;
  }


  async checkForExistingIntent(userId: string, chatId: string, prompt: string) {
    try {
      const existingIntent = await prisma.chatIntent.findFirst({
        where: {
          chatId,
          userId,
          fulfilled: false
        },
        orderBy: { createdAt: 'desc' }
      });
      return existingIntent;
    } catch (error) {
      console.error('Error checking existing intent:', error);
      return null;
    }
  }

  /**
 * Check if user is confirming/accepting a RAG suggestion
 */
  async isConfirmingRagSuggestion(prompt: string, userId: string, chatId: string): Promise<boolean> {
    const confirmationKeywords = [
      'yes', 'ok', 'sure', 'sounds good', 'that works', 'perfect', 'great',
      'let\'s do it', 'i agree', 'that\'s good', 'go ahead', 'proceed',
      'book it', 'schedule it', 'let\'s go with that', 'yeah', 'looks good'
    ];

    const promptLower = prompt.toLowerCase();

    // Check for explicit confirmation
    let hasConfirmation = confirmationKeywords.some(keyword =>
      promptLower.includes(keyword)
    );
    // Check if the last assistant message was a suggestion
    const lastMessage = await prisma.chatHistory.findFirst({
      where: {
        userId,
        chatId,
        message: {
          path: ['role'],
          equals: 'assistant'
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!lastMessage) return false;

    if (!hasConfirmation) {
      hasConfirmation = await this.llmCheckAffirmation(prompt, (lastMessage.message as any).content);
      if (!hasConfirmation) return false;
    }






    // Check if the last message has type 'suggestion'
    return lastMessage.type === 'suggestion';
  }

  async llmCheckAffirmation(prompt: string, suggestion: string): Promise<boolean> {
    const systemPrompt = `
    You are an expert in understanding human emotions and analyze their intention. Here you need to find out 
    if the user is accepting a certain suggestion or rejecting it. Consider spelling mistakes as well for affirmations.
  User was suggested: "${suggestion}"
  They replied: "${prompt}"
  
  Is this an acceptance or affirmation of the suggestion?
  Respond only with: yes or no.
  `;

    const result = await llmModel.chat([
      { role: "system", content: systemPrompt }
    ]);

    return result.toLowerCase().includes("yes");
  }

  /**
   * Process user confirmation of RAG suggestions
   */
  async processRagConfirmation(intent: any, prompt: string, chatId: string, userId: string) {
    console.log('Processing RAG confirmation for intent:', intent.intentType);

    // Store user confirmation
    await storeUserMessage(userId, chatId, prompt);

    // Extract the suggested details from recent conversation
    const suggestedFields = await this.extractSuggestedFields(userId, chatId, intent);

    if (Object.keys(suggestedFields).length === 0) {
      // Fallback: treat as regular field extraction
      return await this.continueIntent(intent, prompt, chatId, userId);
    }

    // Update intent with extracted fields
    const updatedMetadata = { ...intent.metadata, ...suggestedFields };

    // Calculate actualDuration if both startDate and endDate are provided
    if (updatedMetadata.startDate && updatedMetadata.endDate) {
      updatedMetadata.actualDuration = await calculateDuration(
        new Date(updatedMetadata.startDate),
        new Date(updatedMetadata.endDate)
      );
      updatedMetadata.completed = true;
    }
    // Mark as completed if endDate is provided (even without startDate for updates)
    if (updatedMetadata.endDate && !updatedMetadata.completed) {
      updatedMetadata.completed = true;
    }
    const { missing, optional } = this.findMissingFields(intent.intentType, updatedMetadata);

    const updatedIntent = await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        metadata: updatedMetadata,
        missingFields: missing,
        optionalFields: optional
      }
    });

    // Continue with the updated intent
    return await this.processIntent(updatedIntent, chatId, userId);
  }

  async agenticChat(userId: string, chatId: string, prompt: string, existingIntent: any) {
    try {
      if (existingIntent) {
        // Check if user is asking for suggestions during intent continuation
        if (await this.shouldUseRagMode(prompt)) {
          const intentContext = await this.getIntentContext(existingIntent);
          existingIntent.intentContext = intentContext;
          return await this.ragChatService.hybridConversation(userId, chatId, prompt, existingIntent);
        }
        // Check if user is confirming/accepting RAG suggestions
        if (await this.isConfirmingRagSuggestion(prompt, userId, chatId)) {
          return await this.processRagConfirmation(existingIntent, prompt, chatId, userId);
        }


        return await this.continueIntent(existingIntent, prompt, chatId, userId);
      } else {
        return await this.handleNewIntent(prompt, chatId, userId);
      }
    } catch (error) {
      console.error('Error in agenticChat:', error);
      return await this.handleError(userId, chatId, "I encountered an error processing your request. Please try again.");
    }
  }

  async handleNewIntent(prompt: string, chatId: string, userId: string) {
    console.log('Handling new intent')
    const intentResult = await this.detectIntentAndFields(prompt);

    if (intentResult.intentType === 'unknown') {
      return await this.handleUnknownIntent(userId, chatId, prompt);
    }

    // Store user message first
    await storeUserMessage(userId, chatId, prompt);

    // Create new intent
    const { missing, optional } = this.findMissingFields(intentResult.intentType, intentResult.extractedFields);

    // Create and process new intent
    const intent = await this.createIntent(chatId, userId, intentResult);
    return await this.processIntent(intent, chatId, userId);
  }


  /**
 * Continue existing intent with new user input
 */
  async continueIntent(intent: any, prompt: string, chatId: string, userId: string) {
    try {
      // Extract additional fields from user response
      const newFields = await this.extractFieldsFromResponse(prompt, intent);

      // Update intent with new fields
      const updatedMetadata = { ...intent.metadata, ...newFields };

      // Calculate actualDuration if both startDate and endDate are provided
      if (updatedMetadata.startDate && updatedMetadata.endDate) {
        updatedMetadata.actualDuration = await calculateDuration(
          new Date(updatedMetadata.startDate),
          new Date(updatedMetadata.endDate)
        );
        updatedMetadata.completed = true;
      }

      // Mark as completed if endDate is provided (even without startDate for updates)
      if (updatedMetadata.endDate && !updatedMetadata.completed) {
        updatedMetadata.completed = true;
      }

      const { missing, optional } = this.findMissingFields(intent.intentType, updatedMetadata);

      const updatedIntent = await prisma.chatIntent.update({
        where: { id: intent.id },
        data: {
          metadata: updatedMetadata,
          missingFields: missing,
          optionalFields: optional
        }
      });

      // Store user message
      await storeUserMessage(userId, chatId, prompt);

      // Process updated intent
      return await this.processIntent(updatedIntent, chatId, userId);
    } catch (error) {
      console.error('Error continuing intent:', error);
      return await this.handleError(userId, chatId, "I had trouble processing your response. Could you please try again?");
    }
  }

  /**
 * Detect intent and extract fields using LLM
 */
  async detectIntentAndFields(prompt: string): Promise<IntentDetectionResult> {
    const intentPrompt = this.buildIntentDetectionPrompt(prompt);

    try {
      const response = await llmModel.generate(intentPrompt);
      console.log('LLM intent detection response:', response);
      const result = await parseLlmResponseAsJson(response);

      // Parse dates using chrono-node
      if (result.extractedFields) {
        result.extractedFields = await parseDatesInFields(result.extractedFields, prompt);
      }

      return result;
    } catch (error) {
      console.error('Error in intent detection:', error);
      return { intentType: 'unknown', confidence: 0, extractedFields: {} };
    }
  }

  findMissingFields(intentType: string, extractedFields: Record<string, any>): { missing: string[], optional: string[] } {
    let workoutFields;
    switch (intentType) {
      case 'create':
        workoutFields = CREATE_WORKOUT_FIELDS
        break;
      case 'update':
        workoutFields = UPDATE_WORKOUT_FIELDS;
        break;
      default:
        workoutFields = CREATE_WORKOUT_FIELDS
        break;
    }
    const missing = workoutFields.required.filter(field => extractedFields[field] == null || extractedFields[field] === undefined || field === '' || !(field in extractedFields));
    const optional = workoutFields.optional.filter(field => !(field in extractedFields));

    return { missing, optional };
  }
  async extractSuggestedFields(userId: string, chatId: string, intent: any): Promise<Record<string, any>> {
    // Get recent conversation context (last few messages)
    const recentHistory = await getRecentChatHistory(userId, chatId, 5);
    const conversationContext = recentHistory
      .map((msg: { role: any; content: any; }) => `${msg.role}: ${msg.content}`)
      .join('\n');

    const extractPrompt = `
  Based on this recent conversation, extract the workout details that were suggested and confirmed:
  
  CONVERSATION:
  ${conversationContext}
  
  CURRENT INTENT: ${intent.intentType}
  MISSING FIELDS: ${JSON.stringify(intent.missingFields)}
  
  Extract the specific workout details that were suggested by the assistant and confirmed by the user.
  Focus on concrete details like times, dates, distances, durations, workout types.
  
  FIELD MAPPING:
  - time/startDate: Extract specific times mentioned (e.g., "6pm tomorrow", "Monday 9am")
  - time/endDate: Extract specific times mentioned (e.g., "6pm tomorrow", "Monday 9am") only during 'update' or 'delete' intent when user wants to end the workout.
  - duration/idealDuration: Extract planned workout duration in minutes
  - distance: Extract distance values in kilometers
  - type: Extract workout type (Running, Cycling, Swimming, Yoga, Walking)
  
  Rules:
  - Only extract fields that were clearly suggested and confirmed
  - Preserve natural language time expressions for startDate
  - Preserve natural language time expressions for endDate only when intent is 'update' or 'delete'
  - Convert durations to minutes as numbers
  - Map workout types to valid options
  - Return empty object if no clear confirmations found
  
  Return JSON format:
  {"startDate": "tomorrow at 6pm", "idealDuration": 30, "distance": 5} or {}
  `;

    try {
      const result = await llmModel.generate(extractPrompt);
      const extractedFields = await parseLlmResponseAsJson(result);

      // Parse any dates in the extracted fields
      return await parseDatesInFields(extractedFields, conversationContext);
    } catch (error) {
      console.error('Error extracting suggested fields:', error);
      return {};
    }
  }
  /**
 * Extract fields from user response
 */
  async extractFieldsFromResponse(response: string, intent: { metadata: { startDate: any; endDate: any; }; }): Promise<Record<string, any>> {
    
    if (response.toLowerCase().includes('skip')) {
      return {};
    }

    const extractPrompt = `
  Extract workout fields from this user response. Return only confident extractions.
  
  VALID WORKOUT TYPES: ${WORKOUT_TYPES.join(', ')}
  ${intent.metadata.startDate? 'OBTAINED STARTDATE :'+ new Date(intent.metadata.startDate).toLocaleString()+ 
    '. START DATE is already captured. If user adds any more information to it append it to existing startDate. EXAMPLE - Existing startDate has "8/18/2025, 12:00:00 PM" and user adds "at 9pm". The final startDate should be "18th August at 9pm"' :
  ''}

  ${intent.metadata.endDate? 'OBTAINED ENDDATE :'+ new Date(intent.metadata.endDate).toLocaleString()+ 
    '. END DATE is already captured. If user adds any more information to it append it to existing endDate. EXAMPLE - Existing endDate has "8/20/2025, 10:00:00 PM" and user adds "finished at 8am". The final endDate should be "20th August at 8am"' :
  ''}
  
  FIELD TYPES:
  - type: Workout type (map to valid types above)
  - distance: Numeric value for distance  
  - idealDuration: Planned duration in minutes (user-set target)
  - startDate: When workout starts - extract natural language time expressions
  - endDate: When workout ends - extract if mentioned
  - workoutIdentifier: Specific workout reference ("1", "2", "last workout", "yesterday's run")
  
  DATE EXAMPLES:
  - "at 3pm" → startDate: "today at 3pm"
  - "tomorrow morning" → startDate: "tomorrow morning"
  - "I finished at 4pm" → endDate: "today at 4pm"
  - "next week Monday 9am" → startDate: "next week Monday 9am"
  
  USER RESPONSE: "${response}"
  
  Rules:
  - Only extract fields you're certain about
  - For dates, preserve the natural language expression
  - Don't confuse idealDuration with calculated actualDuration
  - Return empty object {} if no clear fields found
  - Do not include null/undefined values
  
  Return JSON format:
  {"distance": 5, "idealDuration": 30} or {"workoutIdentifier": "1"} or {"endDate": "now"} or {}
  `;

    try {
      const result = await llmModel.generate(extractPrompt);
      const parsedResult = await parseLlmResponseAsJson(result);

      // Parse any dates in the extracted fields
      return await parseDatesInFields(parsedResult, response);
    } catch (error) {
      console.error('Error extracting fields from response:', error);
      return {};
    }
  }

  /**
 * Process intent based on current state
 */
  async processIntent(intent: any, chatId: string, userId: string) {
    // Check for missing required fields
    if (intent.missingFields && intent.missingFields.length > 0) {
      if (intent.intentType === 'update') {
        return await this.retrieveWorkouts(intent, chatId, userId);
      }
      return await this.askForMissingFields(intent, chatId, userId);
    }

    // Check for optional fields (only ask once)
    if (intent.optionalFields && intent.optionalFields.length > 0 && !intent.metadata.askedOptional) {
      return await this.askForOptionalFields(intent, chatId, userId);
    }

    // All fields collected, execute intent
    return await this.executeIntent(intent, chatId, userId);
  }

  /**
 * Execute the intent (create, update, delete, retrieve)
 */
  async executeIntent(intent: any, chatId: string, userId: string) {
    try {
      switch (intent.intentType) {
        case 'create':
          return await this.createWorkoutTool(intent, chatId, userId);
        case 'update':
          return await this.updateWorkout(intent, chatId, userId);
        case 'retrieve':
          return await this.retrieveWorkouts(intent, chatId, userId);
        case 'delete':
          return await this.deleteWorkout(intent, chatId, userId);
        default:
          const response = `${intent.intentType} functionality is not yet implemented.`;
          await storeAssistantMessage(userId, chatId, response);
          return response;
      }
    } catch (error) {
      console.error(`Error executing intent ${intent.intentType}:`, error);
      return await this.handleError(userId, chatId, `I encountered an error while trying to ${intent.intentType} your workout. Please try again.`);
    }
  }



  /**
   * Create a new workout
   */
  async createWorkoutTool(intent: any, chatId: string, userId: string) {
    const workoutData: any = {
      userId: userId,
      type: intent.metadata.type,
      distance: intent.metadata.distance || null,
      idealDuration: intent.metadata.idealDuration || null,
      actualDuration: intent.metadata.actualDuration || null,
      startDate: intent.metadata.startDate ? new Date(intent.metadata.startDate) : null,
      endDate: intent.metadata.endDate ? new Date(intent.metadata.endDate) : null,
      completed: !!intent.metadata.endDate,
      embeddingGenerated: false
    };

    const workout = await prisma.workout.create({
      data: workoutData
    });
    await this.upsertWorkoutEmbedding(workout);

    // Mark intent as fulfilled
    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        workoutId: workout.workoutId,
        fulfilled: true
      }
    });

    const response = `✅ Workout ${workout.completed ? 'logged' : 'scheduled'} successfully!
      ${this.formatWorkoutDetails(workout)}

      Is there anything else you'd like to know about your fitness progress or need help with?`;

    await storeAssistantMessage(userId, chatId, response);
    return response;
  }

  private async upsertWorkoutEmbedding(workout: { id: number; workoutId: string; userId: string; createdAt: Date; updatedAt: Date; type: string; distance: number | null; idealDuration: number | null; actualDuration: number | null; startDate: Date; endDate: Date | null; completed: boolean; embeddingGenerated: boolean; }) {
    const content = generateWorkoutEmbeddingText(workout);
    const embedding = await generateWorkoutEmbedding(content) as [];
    console.log('Embedding of dimension', embedding.length);
    const embeddingUpdated = await createWorkoutEmbedding(workout.workoutId, workout.userId, content, embedding, {
      type: workout.type,
    });
    if (embeddingUpdated) {
      await prisma.workout.update({
        where: {
          workoutId: workout.workoutId
        },
        data: {
          embeddingGenerated: true
        }
      });
    }
  }

  async updateWorkout(intent: any, chatId: string, userId: string) {
    // Check if we have workout identification
    if (!intent.metadata.workoutIdentifier && !intent.workoutId) {
      // Need to identify which workout to update
      return await this.retrieveWorkouts(intent, chatId, userId)
    }

    // Find the specific workout to update
    const workoutCrudSearchResponse = await this.findWorkoutForCrud(intent, chatId, userId)
    if (!workoutCrudSearchResponse.id) {
      intent.metadata.workoutIdentifier = null;
      await prisma.chatIntent.update({
        where: { id: intent.id },
        data: {
          metadata: { ...intent.metadata}
        }
      });
      const notFound =  workoutCrudSearchResponse;
      const workoutList = await this.retrieveWorkouts(intent, chatId, userId)
      console.log('Returning ', notFound + workoutList )
      return notFound + workoutList
    }
    let workoutToUpdate = workoutCrudSearchResponse;

    // Prepare update data
    const updateData: any = {};

    if (intent.metadata.type) updateData.type = intent.metadata.type;
    if (intent.metadata.distance !== undefined) updateData.distance = intent.metadata.distance;
    if (intent.metadata.idealDuration !== undefined) updateData.idealDuration = intent.metadata.idealDuration;
    if (intent.metadata.startDate) updateData.startDate = new Date(intent.metadata.startDate);
    if (intent.metadata.endDate) {
      updateData.endDate = new Date(intent.metadata.endDate);
      updateData.completed = true;

      // Calculate actualDuration if we have both dates
      const startDate = updateData.startDate || workoutToUpdate.startDate;
      if (startDate) {
        updateData.actualDuration = await calculateDuration(new Date(startDate), updateData.endDate);
      }
    }
    if (intent.metadata.actualDuration !== undefined) updateData.actualDuration = intent.metadata.actualDuration;



    // Update the workout
    const updatedWorkout = await prisma.workout.update({
      where: { id: workoutToUpdate.id },
      data: updateData
    });
    await this.upsertWorkoutEmbedding(updatedWorkout);


    // Mark intent as fulfilled
    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        workoutId: updatedWorkout.workoutId,
        fulfilled: true
      }
    });



    const changes = Object.keys(updateData).map(key => {
      let oldValue = workoutToUpdate[key];
      let newValue = updateData[key];

      // Format dates for display
      if (key === 'startDate' || key === 'endDate') {
        oldValue = oldValue ? new Date(oldValue).toLocaleString() : 'Not set';
        newValue = newValue ? new Date(newValue).toLocaleString() : 'Not set';
      }

      return `• ${key}: ${oldValue} → ${newValue}`;
    }).join('\n');

    const response = `✅ Workout updated successfully!
    ${changes}

    Updated workout:
    ${this.formatWorkoutDetails(updatedWorkout)}

    Would you like to analyze your progress or get suggestions for future workouts?`;

    await storeAssistantMessage(userId, chatId, response);
    return response;
  }


  /**
 * Retrieve workouts for user selection
 */
  async retrieveWorkouts(intent: any, chatId: string, userId: string, limit = 6) {
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    if (recentWorkouts.length === 0) {
      const response = "You don't have any workouts yet.";
      await storeAssistantMessage(userId, chatId, response);
      return response;
    }

    const workoutList = recentWorkouts.map((w, i) =>
      `${i + 1}. ${this.formatWorkoutSummary(w)}`
    ).join('\n');

    const response = intent.intentType === 'update'
      ? `Which workout would you like to update?\n${workoutList}\n\nPlease specify by number (1-${recentWorkouts.length}) or describe it.`
      : `Here are your recent workouts:\n${workoutList}`;

    await storeAssistantMessage(userId, chatId, response);
    return response;
  }

  /**
   * Delete a workout (placeholder)
   */
  async deleteWorkout(intent: any, chatId: string, userId: string) {
    const response = "Delete functionality coming soon!";
    await storeAssistantMessage(userId, chatId, response);
    return response;
  }

  /**
   * Build structured prompt for intent detection
   */
  buildIntentDetectionPrompt(prompt: string): string {
    return `
You are a workout assistant. Analyze this message and determine the user's intent.

VALID INTENTS:
- create: Adding new workouts (keywords: add, create, log, record, new, did, completed, schedule, plan)
- update: Modifying existing workouts (keywords: update, change, modify, edit, correct, fix, reschedule, finish, complete, end)  
- retrieve: Finding/showing workouts (keywords: show, get, find, search, history, previous)
- delete: Removing workouts (keywords: delete, remove, cancel)
- unknown: When intent is unclear

VALID WORKOUT TYPES: ${WORKOUT_TYPES.join(', ')}
Map similar terms: run→Running, stroll→Walking, bike→Cycling, etc.

FIELD EXTRACTION RULES:
- type: Only use valid workout types above
- distance: Numbers with unit context (5km, 3 miles)
- idealDuration: Planned time for exercise (30 minutes, 1 hour) - user sets this when planning
- actualDuration: DO NOT extract this - it's calculated automatically from start/end dates
- startDate: When workout starts/started - extract natural language time expressions
- endDate: When workout ends/ended - extract if user mentions completion or end time
- workoutIdentifier: For updates only, specific workout references ("1", "last workout", "yesterday's run")

DATE EXTRACTION:
- Look for time expressions like: "tomorrow at 6pm", "next Monday 9am", "in 2 hours", "day after tomorrow at 3pm"
- Extract the full time expression as text for startDate/endDate fields
- Examples: "tomorrow at 6pm" → startDate: "tomorrow at 6pm"

MESSAGE: "${prompt}"

Return JSON format examples:

CREATE: {"intentType": "create", "extractedFields": {"type": "Running", "distance": 5, "startDate": "tomorrow at 6pm", "idealDuration": 30}}

UPDATE (schedule): {"intentType": "update", "extractedFields": {"workoutIdentifier": "1", "startDate": "day after tomorrow at 3pm"}}

UPDATE (complete): {"intentType": "update", "extractedFields": {"workoutIdentifier": "last workout", "endDate": "now"}}

Only include fields you're confident about. Do not guess or assume.
For startDate/endDate, preserve the natural language expression exactly as written.
`;
  }

  /**
 * Ask user for missing required fields with RAG suggestions
 */
  async askForMissingFields(intent: any, chatId: string, userId: string) {
    const missingFieldsText = intent.missingFields.map((field: string) => `• ${this.getFieldPrompt(field)}`).join('\n');

    const response = `I need some more information to ${intent.intentType} your workout:
  ${missingFieldsText}
  
  Please provide these details, or ask me for suggestions based on your workout history! For example, you can say "suggest a good time for running" or "what distance should I aim for?"`;

    await storeAssistantMessage(userId, chatId, response);
    return response;
  }

  /**
 * Ask user for optional fields with RAG capability
 */
  async askForOptionalFields(intent: any, chatId: string, userId: string) {
    let response: string;

    if (intent.intentType === 'update') {
      const workoutCrudSearchResponse = await this.findWorkoutForCrud(intent, chatId, userId);
      if (!workoutCrudSearchResponse.id) {
        intent.metadata.workoutIdentifier = null;
        await prisma.chatIntent.update({
          where: { id: intent.id },
          data: {
            metadata: { ...intent.metadata}
          }
        });
        const notFound =  workoutCrudSearchResponse;
        const workoutList = await this.retrieveWorkouts(intent, chatId, userId)
        console.log('Returning ', notFound + workoutList )
        return notFound + workoutList
      }

      const workoutData = this.formatWorkoutSummary(workoutCrudSearchResponse);
      intent.workoutId = workoutCrudSearchResponse.workoutId;

      response = `Great! I found the workout: ${workoutData}
Would you also like to update:
${intent.optionalFields.map((field: string) => `• ${this.getFieldPrompt(field)}`).join('\n')}

You can type "skip" to proceed, provide the details, or ask me for suggestions based on your workout history!`;
    } else {
      response = `Great! I have the required information. Would you also like to add:
${intent.optionalFields.map((field: string) => `• ${this.getFieldPrompt(field)}`).join('\n')}

You can type "skip" to proceed, provide the details, or ask me for suggestions based on your workout history!`;
    }

    // Mark that we've asked for optional fields
    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        metadata: { ...intent.metadata, askedOptional: true }
      }
    });

    await storeAssistantMessage(userId, chatId, response);
    return response;
  }


  /**
 * Find workout by identifier using LLM
 */
  async findWorkoutByIdentifier(userId: string, identifier: string): Promise<any> {
    // Handle numeric identifiers
    const numMatch = identifier.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]) - 1;
      const recentWorkouts = await prisma.workout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      return recentWorkouts[index] || null;
    }

    // Use LLM for description-based search
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        workoutId: true,
        type: true,
        startDate: true,
        endDate: true,
        distance: true,
        idealDuration: true,
        actualDuration: true,
        completed: true,
        createdAt: true
      }
    });

    const findPrompt = `
  Find the best matching workout for: "${identifier}"
  
  Available workouts:
  ${JSON.stringify(recentWorkouts, null, 2)}
  
  Return only the workoutId of the best match, or "null" if no good match exists.
  Be strict - only return a match if you're confident it's what the user meant.
  
  Response format: just the workoutId string or "null"
  `;

    try {
      const result = await llmModel.generate(findPrompt);
      const workoutId = result.trim().replace(/"/g, '');

      if (workoutId === 'null') return null;

      return await prisma.workout.findUnique({
        where: { workoutId }
      });
    } catch (error) {
      console.error('Error in LLM workout search:', error);
      return null;
    }
  }
  /**
  * Find workout for CRUD operations
  */
  async findWorkoutForCrud(intent: any, chatId: string, userId: string) {
    try {
      let workoutToUpdate;

      if (intent.workoutId) {
        workoutToUpdate = await prisma.workout.findUnique({
          where: { workoutId: intent.workoutId }
        });
      } else if (intent.metadata.workoutIdentifier === 'last workout') {
        const recentWorkouts = await prisma.workout.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 1
        });
        workoutToUpdate = recentWorkouts[0];
      } else {
        workoutToUpdate = await this.findWorkoutByIdentifier(userId, intent.metadata.workoutIdentifier);
      }

      if (!workoutToUpdate) {
        const response = "I couldn't find that workout. Please try specifying it differently from the list.";
        await storeAssistantMessage(userId, chatId, response);
        return response;
      }

      return workoutToUpdate;
    } catch (error) {
      console.error('Error finding workout for CRUD:', error);
      return { error: "I had trouble finding that workout. Please try again." };
    }
  }
  getFieldPrompt(field: string): string {
    const prompts = {
      type: 'workout type (Running, Cycling, Swimming, Yoga, Walking)',
      distance: 'distance (e.g., 5 km)',
      idealDuration: 'planned duration (e.g., 30 minutes)',
      startDate: 'start date and time (e.g., "tomorrow at 6pm", "next Monday 9am")',
      endDate: 'end date and time (e.g., "today at 4pm", "now")',
      workoutIdentifier: 'which workout to update (e.g., "1", "last workout", "yesterday\'s run")'
    };
    return prompts[field as keyof typeof prompts] || field;
  }

  formatWorkoutSummary(workout: any): string {
    const startDate = workout.startDate ? new Date(workout.startDate).toLocaleString() : 'Not scheduled';
    const status = workout.completed ? '✅' : '📅';
    const duration = workout.actualDuration || workout.idealDuration;

    return `${status} ${workout.type} - ${startDate}${workout.distance ? ` - ${workout.distance}km` : ''}${duration ? ` - ${duration}min` : ''}`;
  }

  formatWorkoutDetails(workout: any): string {
    console.log('Formating final workout', JSON.stringify(workout))
    const startDate = workout.startDate ? new Date(workout.startDate).toLocaleString() : 'Not set';
    const endDate = workout.endDate ? new Date(workout.endDate).toLocaleString() : 'Not set';

    let details = `• Type: ${workout.type}
• Start: ${startDate}
• Status: ${workout.completed ? 'Completed' : 'Scheduled'}`;

    if (workout.endDate) {
      details += `\n• End: ${endDate}`;
    }

    if (workout.distance) {
      details += `\n• Distance: ${workout.distance} km`;
    }

    if (workout.idealDuration) {
      details += `\n• Planned Duration: ${workout.idealDuration} mins`;
    }

    if (workout.actualDuration) {
      details += `\n• Actual Duration: ${workout.actualDuration} mins`;
    }

    return details;
  }

  // Helper methods
  async createIntent(chatId: string, userId: string, intentResult: IntentDetectionResult) {
    const { missing, optional } = this.findMissingFields(intentResult.intentType, intentResult.extractedFields);

    return await prisma.chatIntent.create({
      data: {
        chatId,
        userId,
        intentType: intentResult.intentType,
        metadata: intentResult.extractedFields,
        missingFields: missing,
        optionalFields: optional
      }
    });
  }

  async handleUnknownIntent(userId: string, chatId: string, prompt: string) {
    await storeUserMessage(userId, chatId, prompt);

    const response = "I didn't understand what you'd like to do with your workouts. You can ask me to create, update, retrieve, or delete workout records. You can also ask me for suggestions based on your workout history!";
    await storeAssistantMessage(userId, chatId, response);
    return response;
  }

  async handleError(userId: string, chatId: string, message: string) {
    await storeAssistantMessage(userId, chatId, message);
    return message;
  }

}
