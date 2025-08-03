import { prisma } from "../..";
import { IntentDetectionResult, WORKOUT_FIELDS } from "../interfaces/workout";
import { llmModel } from "../utils/llm";

export class AgenticWorkoutService {
  constructor() {
    this.init()
  }
  init() {
    console.log('Agentic workout service init')
  }
  async checkForExistingIntent(userId: string, chatId: string, prompt: string) {
    let existingIntent = await prisma.chatIntent.findFirst({
      where: {
        chatId,
        userId,
        fulfilled: false
      },
      orderBy: { createdAt: 'desc' }
    });
    return existingIntent;
  }

  async agenticChat(userId: string, chatId: string, prompt: string, existingIntent: any) {
    // Check for existing unfulfilled intent in this chat

    if (existingIntent) {
      // Continue with existing intent
      return await this.continueIntent(existingIntent, prompt, chatId, userId);
    } else {
      // Detect new intent
      return await this.handleNewIntent(prompt, chatId, userId);
    }
  }

  async handleNewIntent(prompt: string, chatId: string, userId: string) {
    console.log('Handling new intent')
    const intentResult = await this.detectIntentAndFields(prompt);

    if (intentResult.intentType === 'unknown') {
      // Store user message
      await prisma.chatHistory.create({
        data: {
          userId,
          chatId,
          message: { role: 'user', content: prompt }
        }
      });

      const response = "I didn't understand what you'd like to do with your workouts. You can ask me to create, update, retrieve, or delete workout records.";

      await prisma.chatHistory.create({
        data: {
          userId,
          chatId,
          message: { role: 'assistant', content: response }
        }
      });

      return response;
    }
    // Create new intent
    const { missing, optional } = this.findMissingFields(intentResult.extractedFields);


    const intent = await prisma.chatIntent.create({
      data: {
        chatId,
        userId,
        intentType: intentResult.intentType,
        metadata: intentResult.extractedFields,
        missingFields: missing,
        optionalFields: optional
      }
    });

    // Store user message
    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: { role: 'user', content: prompt }
      }
    });

    return await this.processIntent(intent, chatId, userId);
  }
  async continueIntent(intent: any, prompt: string, chatId: string, userId: string) {
    // Extract additional fields from user response
    const newFields = await this.extractFieldsFromResponse(prompt);

    // Update metadata with new fields
    const updatedMetadata = { ...intent.metadata, ...newFields };
    const { missing, optional } = this.findMissingFields(updatedMetadata);

    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        metadata: updatedMetadata,
        missingFields: missing,
        optionalFields: optional
      }
    });

    // Store user message
    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: { role: 'user', content: prompt }
      }
    });

    // Process updated intent
    const updatedIntent = await prisma.chatIntent.findUnique({
      where: { id: intent.id }
    });

    return await this.processIntent(updatedIntent!, chatId, userId);
  }

  async detectIntentAndFields(prompt: string): Promise<IntentDetectionResult> {
    const intentPrompt = `
Analyze this message and determine:
1. Intent: create, update, retrieve, delete, or unknown (for workout data)
2. Extract any workout fields mentioned: type, distance, duration, time
3. Time should include exact time information, if not do not consider it.
4. Critical point - Type should only be of types : "Running", "Cycling", "Swimming", "Yoga", "Walking". If user gives similar type informatio
you should map it to the specified types. If the type doesn't fit into any category do not consider it as a valid input.
Examples: run should be converted to Running, stroll should be converted to Walking.
5. Return JSON format:Example - {"intentType": "create", "extractedFields": {"type": "Running", "distance": 5, "time":"3pm"}}

Message: "${prompt}"

Look for keywords:
- Create: "add", "create", "log", "record", "new workout", "did", "completed","schedule"
- Update: "update", "change", "modify", "edit", "correct", "re-schedule"
- Retrieve: "show", "get", "find", "search", "history", "previous"
- Delete: "delete", "remove", "cancel"
`;

    const response = await llmModel.generate(intentPrompt);
    console.log('Starting json parse', response);
    try {
      return await this.parseLlmResponseAsJson(response);
    } catch {
      console.log('Error in detecting intent, hence sending unknown');
      return { intentType: 'unknown', confidence: 0, extractedFields: {} };
    }

  }
  parseLlmResponseAsJson(response: any) {
    try {
      const simplyParsed = JSON.parse(response.toString());
      console.log('Simple parse', simplyParsed);
      return simplyParsed;
    } catch (e1) {
      console.log('Simple parse failed, trying regex');

      try {
        const regex = /```json\s*([\s\S]*?)\s*```/g;
        const regexParsed = regex.exec(response);

        console.log('Regex parser result', regexParsed);

        if (regexParsed && regexParsed[1]) {
          return JSON.parse(regexParsed[1]); // Use the capture group, not full match
        } else {
          console.log('Regex did not match or extract JSON');
          throw new Error('Cannot parse via regex');
        }
      } catch (e2) {
        throw new Error('Cannot parse this Json');

      }
    }
  }

  findMissingFields(extractedFields: Record<string, any>): { missing: string[], optional: string[] } {
    const missing = WORKOUT_FIELDS.required.filter(field => field === '' || !(field in extractedFields));
    const optional = WORKOUT_FIELDS.optional.filter(field => !(field in extractedFields));

    return { missing, optional };
  }

  async extractFieldsFromResponse(response: string): Promise<Record<string, any>> {
    if (response.toLowerCase().includes('skip')) {
      return {};
    }

    const extractPrompt = `
      Extract workout fields from this response. Return JSON format. Do not include null values in JSON. Do not confuse time with duration.
Example: "run for 60 minutes" is for duration of 60 minutes not for time. 
For time only look for common ways to denote time like "am", "pm" , "o'clock", "o clock"
      Look for: type, distance (numbers), duration (numbers), time (text)

      Response: "${response}"

      Example: {"distance": 5, "duration": 30, time: "3pm"}
      `;

    try {
      const result = await llmModel.generate(extractPrompt);
      return this.parseLlmResponseAsJson(result);;
    } catch {
      console.log('Error in extracting fields');
      return {};
    }
  }

  async processIntent(intent: any, chatId: string, userId: string) {
    if (intent.missingFields.length > 0) {
      // Ask for missing required fields
      const response = `I need some more information to ${intent.intentType} your workout:
${intent.missingFields.map((field: string) => `• ${field}`).join('\n')}

Please provide these details.`;

      await prisma.chatHistory.create({
        data: {
          userId,
          chatId,
          message: { role: 'assistant', content: response }
        }
      });

      return response;
    }

    if (intent.optionalFields.length > 0 && !intent.metadata.askedOptional) {
      // Ask for optional fields
      const response = `Great! I have the required info. Would you also like to add:
${intent.optionalFields.map((field: string) => `• ${field}`).join('\n')}

Or type "skip" to proceed with creating the workout.`;

      // Mark that we've asked for optional fields
      await prisma.chatIntent.update({
        where: { id: intent.id },
        data: {
          metadata: { ...intent.metadata, askedOptional: true }
        }
      });

      await prisma.chatHistory.create({
        data: {
          userId,
          chatId,
          message: { role: 'assistant', content: response }
        }
      });

      return response;
    }

    // All fields collected, execute the intent
    return await this.executeIntent(intent, chatId, userId);
  }

  async executeIntent(intent: any, chatId: string, userId: string) {
    if (intent.intentType === 'create') {
      const createResponse = await this.createWorkoutTool(intent, chatId, userId);
      return createResponse;
    }

    // Handle other intent types (update, retrieve, delete) here
    const response = `${intent.intentType} functionality coming soon!`;

    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: { role: 'assistant', content: response }
      }
    });

    return response;
  }
  async createWorkoutTool(intent: any, chatId: string, userId: string) {
    // Create workout
    console.log('typeof data.userId', typeof userId);

    const workout = await prisma.workout.create({
      data: {
        userId: userId,
        type: intent.metadata.type,
        distance: intent.metadata.distance || null,
        duration: intent.metadata.duration || null,
        time: intent.metadata.time,
        completed: false,
        embeddingGenerated: false
      }
    });

    // Update intent as fulfilled
    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        workoutId: workout.workoutId,
        fulfilled: true
      }
    });

    const response = `✅ Workout created successfully!
• Type: ${workout.type}
• Time: ${workout.time}
${workout.distance ? `• Distance: ${workout.distance} km` : ''}
${workout.duration ? `• Duration: ${workout.duration} mins` : ''}`;

    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: { role: 'assistant', content: response }
      }
    });

    return response;
  }

}
