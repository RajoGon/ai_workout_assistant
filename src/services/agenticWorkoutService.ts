import { prisma } from "../..";
import { CREATE_WORKOUT_FIELDS, IntentDetectionResult, UPDATE_WORKOUT_FIELDS } from "../interfaces/workout";
import { llmModel, parseLlmResponseAsJson } from "../utils/llm";

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
    const { missing, optional } = this.findMissingFields(intentResult.intentType, intentResult.extractedFields);


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
    const { missing, optional } = this.findMissingFields(intent.intentType, updatedMetadata);

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
6. For updates, also extract workoutIdentifier (like "1", "2", "yesterday's run", "last workout")
7. Strictly for a generic statement like "I want to update my workout" do not consider any workoutIdentifier. Only add a workoutIdentifier if user specifies.
8. Return JSON format: {"intentType": "update", "extractedFields": {"workoutIdentifier": "1", "distance": 10}}

Message: "${prompt}"

Look for keywords:
- Create: "add", "create", "log", "record", "new workout", "did", "completed","schedule"
- Update: "update", "change", "modify", "edit", "correct", "fix", "actually it was", "should be". "re-schedule"
- Retrieve: "show", "get", "find", "search", "history", "previous"
- Delete: "delete", "remove", "cancel"

For updates, look for workout identifiers, strictly if you feel user hasn't specified do not consider it:
- Numbers: "1", "2", "first", "second"  
- Descriptions: "yesterday's run", "last workout", "morning run", "today's workout"
`;

    const response = await llmModel.generate(intentPrompt);
    console.log('Starting json parse', response);
    try {
      return await parseLlmResponseAsJson(response);
    } catch {
      console.log('Error in detecting intent, hence sending unknown');
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
    const missing = workoutFields.required.filter(field => extractedFields[field]==null || field === '' || !(field in extractedFields));
    const optional = workoutFields.optional.filter(field => !(field in extractedFields));

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
      Look for: type, distance (numbers), duration (numbers), time (text), workoutIdentifier (workout selection like "1", "2", "yesterday's run", "last workout")
      For a generic statement like "I want to update my workout" do not consider any workoutIdentifier.

      Response: "${response}"

Example: {"distance": 5, "duration": 30} or {"workoutIdentifier": "1"} or {"workoutIdentifier": "yesterday's run", "distance": 10}
      `;

    try {
      const result = await llmModel.generate(extractPrompt);
      return parseLlmResponseAsJson(result);;
    } catch {
      console.log('Error in extracting fields');
      return {};
    }
  }

  async processIntent(intent: any, chatId: string, userId: string) {
    if (intent.missingFields.length > 0) {
      // Ask for missing required fields
      let response;
      if(intent.intentType === 'update'){
        return await this.retreiveWorkouts(intent,chatId,userId)
      } else{
         response = `I need some more information to ${intent.intentType} your workout:
        ${intent.missingFields.map((field: string) => `• ${field}`).join('\n')}
        
        Please provide these details.`;
      }
      



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
      let response;
      if (intent.intentType === 'update') {
        // Find the specific workout to update
        const workoutCrudSearchResponse = await this.findWorkoutForCrud(intent, chatId, userId)
        if (!workoutCrudSearchResponse.id) {
          return workoutCrudSearchResponse;
        }
        let workoutToUpdate = workoutCrudSearchResponse;
        intent.workoutId = workoutToUpdate.workoutId;
        const workoutData = `${workoutToUpdate.type} on ${workoutToUpdate.time}${workoutToUpdate.distance ? ` - ${workoutToUpdate.distance}km` : ''}${workoutToUpdate.duration ? ` - ${workoutToUpdate.duration}min` : ''}`
        // Ask for optional fields o update
        response = `Great! I will be updating the workout ${workoutData}.
      Would you also like to add:
      ${intent.optionalFields.map((field: string) => `• ${field}`).join('\n')}
      Or type "skip" to proceed with creating the workout.`;
      } else {
        // Ask for optional fields
        response = `Great! I have the required info. Would you also like to add:
${intent.optionalFields.map((field: string) => `• ${field}`).join('\n')}

Or type "skip" to proceed with creating the workout.`;

      }

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

    if (intent.intentType === 'update') {
      const updateResponse = await this.updateWorkout(intent, chatId, userId);
      return updateResponse;
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
  
  async updateWorkout(intent: any, chatId: string, userId: string) {
    // Check if we have workout identification
    if (!intent.metadata.workoutIdentifier && !intent.workoutId) {
      // Need to identify which workout to update
      return await this.retreiveWorkouts(intent,chatId,userId)
    }

    // Find the specific workout to update
    const workoutCrudSearchResponse = await this.findWorkoutForCrud(intent, chatId, userId)
    if (!workoutCrudSearchResponse.id) {
      return workoutCrudSearchResponse;
    }
    let workoutToUpdate = workoutCrudSearchResponse;

    // Prepare update data (only update fields that were provided)
    const updateData: any = {};
    if (intent.metadata.type) updateData.type = intent.metadata.type;
    if (intent.metadata.distance !== undefined) updateData.distance = intent.metadata.distance;
    if (intent.metadata.duration !== undefined) updateData.duration = intent.metadata.duration;
    if (intent.metadata.time) updateData.time = intent.metadata.time;

    // Update the workout
    const updatedWorkout = await prisma.workout.update({
      where: { id: workoutToUpdate.id },
      data: updateData
    });

    // Mark intent as fulfilled
    await prisma.chatIntent.update({
      where: { id: intent.id },
      data: {
        workoutId: updatedWorkout.workoutId,
        fulfilled: true
      }
    });

    const changes = Object.keys(updateData).map(key =>
      `• ${key}: ${workoutToUpdate[key as keyof typeof workoutToUpdate]} → ${updateData[key]}`
    ).join('\n');

    const response = `✅ Workout updated successfully!
${changes}

Updated workout:
• Type: ${updatedWorkout.type}
• Time: ${updatedWorkout.time}
${updatedWorkout.distance ? `• Distance: ${updatedWorkout.distance} km` : ''}
${updatedWorkout.duration ? `• Duration: ${updatedWorkout.duration} mins` : ''}`;

    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: { role: 'assistant', content: response }
      }
    });

    return response;
  }
  async retreiveWorkouts(intent: any, chatId: string, userId: string, limit = 6) {
    // Check if we have workout identification
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    if (recentWorkouts.length === 0) {
      const response = "You don't have any workouts to update yet.";
      await prisma.chatHistory.create({
        data: { userId, chatId, message: { role: 'assistant', content: response } }
      });
      return response;
    }

    const workoutList = recentWorkouts.map((w, i) =>
      `${i + 1}. ${w.type} on ${w.time}${w.distance ? ` - ${w.distance}km` : ''}${w.duration ? ` - ${w.duration}min` : ''}`
    ).join('\n');

    const response = `Which workout would you like to update?
${workoutList}

Please specify by number (1-${recentWorkouts.length}) or describe it (e.g., "yesterday's run").`;

    await prisma.chatHistory.create({
      data: { userId, chatId, message: { role: 'assistant', content: response } }
    });

    return response;
  }
  async findWorkoutByIdentifier(userId: string, identifier: string): Promise<any> {
    // If it's a number, treat as index in recent workouts
    const numMatch = identifier.match(/^(\d+)$/);
    if (numMatch) {
      const index = parseInt(numMatch[1]) - 1;
      const recentWorkouts = await prisma.workout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      return recentWorkouts[index] || null;
    }

    // Use LLM to find workout based on description
    const findPrompt = `
Given this description: "${identifier}"
And these recent workouts (JSON format), return the workoutId of the best match or null:

${JSON.stringify(await prisma.workout.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { workoutId: true, type: true, time: true, distance: true, duration: true, createdAt: true }
    }))}

Stritctly Return just the workoutId as a single string or "null". Do not add explanation or theory.
`;

    try {
      const result = await llmModel.generate(findPrompt);
      const workoutId = result.trim().replace(/"/g, '');

      if (workoutId === 'null') return null;

      return await prisma.workout.findUnique({
        where: { workoutId }
      });
    } catch {
      return null;
    }
  }
  async findWorkoutForCrud(intent: any, chatId: string, userId: string) {
    // Find the specific workout to update
    let workoutToUpdate;
    if (intent.workoutId) {
      workoutToUpdate = await prisma.workout.findUnique({
        where: { workoutId: intent.workoutId }
      });
    }else if(intent.metadata.workoutIdentifier === 'last workout'){
      workoutToUpdate = (await prisma.workout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 1
      }))[0];
    }
    else {
      workoutToUpdate = await this.findWorkoutByIdentifier(userId, intent.metadata.workoutIdentifier);
    }

    if (!workoutToUpdate) {
      const response = "I couldn't find that workout. Please try specifying it differently.";
      await prisma.chatHistory.create({
        data: { userId, chatId, message: { role: 'assistant', content: response } }
      });
      return response;
    }
    return workoutToUpdate;
  }

}
