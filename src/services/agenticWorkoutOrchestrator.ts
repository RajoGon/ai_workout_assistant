import { IntentDetectionResult, WorkoutIntent } from "../interfaces/workout";
import { ChatUtils } from "../utils/chatUtils";
import { DateUtils } from "../utils/dateUtils";
import { FielExtractionService } from "./fieldExtractionService";
import { FieldValidationService } from "./fieldValidationService";
import { IntentDetectionService } from "./intentDetectionService";
import { RagChat } from "./ragChatService";
import { RagDetectionService } from "./ragDetectionService";
import { WorkoutIntentHandlerFactory } from "../factories/workoutIntentHandlerToolFactory";
import { WorkoutUtilService } from "./workUtilService";

export class WorkoutServiceContainer {
    private workoutOrchestrator: WorkoutOrchestrator;
  
    constructor(prisma: any, ragChatService: any, llmModel: any) {
      const intentDetectionService = new IntentDetectionService(llmModel);
      const fieldValidationService = new FieldValidationService();
      const ragDetectionService = new RagDetectionService(llmModel);
      const fieldExtractionService= new FielExtractionService(llmModel);
      const workoutUtilService= new WorkoutUtilService(prisma,llmModel);
      const intentHandlerFactory = new WorkoutIntentHandlerFactory(prisma, ragChatService, llmModel,workoutUtilService );

  
      this.workoutOrchestrator = new WorkoutOrchestrator(
        prisma,
        ragChatService,
        intentHandlerFactory,
        intentDetectionService,
        fieldValidationService,
        ragDetectionService,
        fieldExtractionService,
        workoutUtilService
      );
       console.log('PRisma is', prisma)
    }
  
    getOrchestrator(): WorkoutOrchestrator {
       
      return this.workoutOrchestrator;
    }
}

class WorkoutOrchestrator {
    constructor(
        private prisma: any,
        private ragChatService: RagChat,
        private intentHandlerFactory: WorkoutIntentHandlerFactory,
        private intentDetectionService: IntentDetectionService,
        private fieldValidationService: FieldValidationService,
        private ragDetectionService: RagDetectionService,
        private fieldExtractionService: FielExtractionService,
        private workoutUtilService: WorkoutUtilService
    ) { }

    /*
    * Entry point to process an intent
    */
    async processWorkoutRequest(userId: string, chatId: string, prompt: string, existingIntent: any): Promise<string> {
        try {
            if (existingIntent) {
                return await this.handleExistingIntent(existingIntent, prompt, chatId, userId);
            } else {
                return await this.handleNewIntent(prompt, chatId, userId);
            }
        } catch (error) {
            console.error('Error in workout request processing:', error);
            return "I encountered an error processing your request. Please try again.";
        }
    }

    /*
    * Start handling an existing intent. Detects Rag, confirmations, continues intent.
    */
    private async handleExistingIntent(intent: WorkoutIntent, prompt: string, chatId: string, userId: string): Promise<string> {
        // Check if user is asking for RAG suggestions
        if (await this.ragDetectionService.shouldUseRagMode(prompt)) {
            const intentContext = await this.ragDetectionService.getIntentContext(intent);
            intent.intentContext = intentContext;
            return await this.ragChatService.hybridConversation(userId, chatId, prompt, intent);
        }

        // Check if user is confirming RAG suggestions
        if (await this.ragDetectionService.isConfirmingRagSuggestion(prompt, userId, chatId, this.prisma)) {
            return await this.processRagConfirmation(intent, prompt, chatId, userId);
        }

        return await this.continueIntent(intent, prompt, chatId, userId);
    }
    
    /*
    * Handles a new intent first by detecting the intent type then creates it and processes further.
    */
    private async handleNewIntent(prompt: string, chatId: string, userId: string) {
        console.log('Handling new intent')
        const intentResult = await this.intentDetectionService.detectIntentAndFields(prompt);
    
        if (intentResult.intentType === 'unknown') {
          return await this.handleUnknownIntent(userId, chatId, prompt);
        }
    
        // Store user message first
        await ChatUtils.storeUserMessage(userId, chatId, prompt);
    
        // Create new intent
        const { missing, optional } = this.fieldValidationService.findMissingFields(intentResult.intentType, intentResult.extractedFields);
    
        // Create and process new intent
        const intent = await this.createIntent(chatId, userId, intentResult, missing, optional);
        return await this.processIntent(intent, chatId, userId);
      }



    private async handleUnknownIntent(userId: string, chatId: string, prompt: string) {
        await ChatUtils.storeUserMessage(userId, chatId, prompt);
        const response = "I didn't understand what you'd like to do with your workouts. You can ask me to create, update, retrieve, or delete workout records. You can also ask me for suggestions based on your workout history!";
        await ChatUtils.storeAssistantMessage(userId, chatId, response);
        return response;
    }

    /**
    * Process intent based on current state
    */
    private async processIntent(intent: any, chatId: string, userId: string) {
        // Check for missing required fields
        if (intent.missingFields && intent.missingFields.length > 0) {
            if (intent.intentType === 'update') {
                return await this.workoutUtilService.retrieveWorkouts(intent, chatId, userId);
            }
            return await this.askForMissingFields(intent, chatId, userId);
        }

        // Check for optional fields (only ask once)
        if (intent.optionalFields && intent.optionalFields.length > 0 && !intent.metadata.askedOptional) {
            return await this.askForOptionalFields(intent, chatId, userId);
        }

        // All fields collected, execute intent
        // Execute intent
        const handler = this.intentHandlerFactory.createHandler(intent.intentType);
        return await handler.execute(intent, chatId, userId);
    }


    /**
   * Ask user for missing required fields with RAG suggestions
   */
    private async askForMissingFields(intent: any, chatId: string, userId: string) {
        const missingFieldsText = intent.missingFields.map((field: string) => `• ${this.fieldValidationService.getFieldPrompt(field)}`).join('\n');

        const response = `I need some more information to ${intent.intentType} your workout:
  ${missingFieldsText}
  
  Please provide these details, or ask me for suggestions based on your workout history! For example, you can say "suggest a good time for running" or "what distance should I aim for?"`;

        await ChatUtils.storeAssistantMessage(userId, chatId, response);
        return response;
    }

    /**
   * Ask user for optional fields with RAG capability
   */
    async askForOptionalFields(intent: any, chatId: string, userId: string) {
        let response: string;

        if (intent.intentType === 'update') {
            const workoutCrudSearchResponse = await this.workoutUtilService.findWorkoutForCrud(intent, chatId, userId);
            if (!workoutCrudSearchResponse.id) {
                intent.metadata.workoutIdentifier = null;
                await this.prisma.chatIntent.update({
                    where: { id: intent.id },
                    data: {
                        metadata: { ...intent.metadata }
                    }
                });
                const notFound = workoutCrudSearchResponse;
                const workoutList = await this.workoutUtilService.retrieveWorkouts(intent, chatId, userId)
                console.log('Returning ', notFound + workoutList)
                return notFound + workoutList
            }

            const workoutData = this.workoutUtilService.formatWorkoutSummary(workoutCrudSearchResponse);
            intent.workoutId = workoutCrudSearchResponse.workoutId;

            response = `Great! I found the workout: ${workoutData}
    Would you also like to update:
    ${intent.optionalFields.map((field: string) => `• ${this.fieldValidationService.getFieldPrompt(field)}`).join('\n')}
    
    You can type "skip" to proceed, provide the details, or ask me for suggestions based on your workout history!`;
        } else {
            response = `Great! I have the required information. Would you also like to add:
    ${intent.optionalFields.map((field: string) => `• ${this.fieldValidationService.getFieldPrompt(field)}`).join('\n')}
    
    You can type "skip" to proceed, provide the details, or ask me for suggestions based on your workout history!`;
        }

        // Mark that we've asked for optional fields
        await this.prisma.chatIntent.update({
            where: { id: intent.id },
            data: {
                metadata: { ...intent.metadata, askedOptional: true }
            }
        });

        await ChatUtils.storeAssistantMessage(userId, chatId, response);
        return response;
    }

    /**
   * Check if user has an ongoing intent
   */
    async checkForExistingIntent(userId: string, chatId: string, prompt: string) {
        try {
          const existingIntent = await this.prisma.chatIntent.findFirst({
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
    * Continue existing intent with new user input
    */
    async continueIntent(intent: any, prompt: string, chatId: string, userId: string) {
        try {
            // Extract additional fields from user response
            const newFields = await this.fieldExtractionService.extractFieldsFromResponse(prompt, intent);

            // Update intent with new fields
            const updatedMetadata = { ...intent.metadata, ...newFields };

            // Calculate actualDuration if both startDate and endDate are provided
            if (updatedMetadata.startDate && updatedMetadata.endDate) {
                updatedMetadata.actualDuration = await DateUtils.calculateDuration(
                    new Date(updatedMetadata.startDate),
                    new Date(updatedMetadata.endDate)
                );
                updatedMetadata.completed = true;
            }

            // Mark as completed if endDate is provided (even without startDate for updates)
            if (updatedMetadata.endDate && !updatedMetadata.completed) {
                updatedMetadata.completed = true;
            }

            const { missing, optional } = this.fieldValidationService.findMissingFields(intent.intentType, updatedMetadata);

            const updatedIntent = await this.prisma.chatIntent.update({
                where: { id: intent.id },
                data: {
                    metadata: updatedMetadata,
                    missingFields: missing,
                    optionalFields: optional
                }
            });

            // Store user message
            await ChatUtils.storeUserMessage(userId, chatId, prompt);

            // Process updated intent
            return await this.processIntent(updatedIntent, chatId, userId);
        } catch (error) {
            console.error('Error continuing intent:', error);
            return await this.handleError(userId, chatId, "I had trouble processing your response. Could you please try again?");
        }
    }

    /**
     * Process user confirmation of RAG suggestions
     */
    private async processRagConfirmation(intent: any, prompt: string, chatId: string, userId: string) {
        console.log('Processing RAG confirmation for intent:', intent.intentType);

        // Store user confirmation
        await ChatUtils.storeUserMessage(userId, chatId, prompt);

        // Extract the suggested details from recent conversation
        const suggestedFields = await this.fieldExtractionService.extractSuggestedFields(userId, chatId, intent);

        if (Object.keys(suggestedFields).length === 0) {
            // Fallback: treat as regular field extraction
            return await this.continueIntent(intent, prompt, chatId, userId);
        }

        // Update intent with extracted fields
        const updatedMetadata = { ...intent.metadata, ...suggestedFields };

        // Calculate actualDuration if both startDate and endDate are provided
        if (updatedMetadata.startDate && updatedMetadata.endDate) {
            updatedMetadata.actualDuration = await DateUtils.calculateDuration(
                new Date(updatedMetadata.startDate),
                new Date(updatedMetadata.endDate)
            );
            updatedMetadata.completed = true;
        }
        // Mark as completed if endDate is provided (even without startDate for updates)
        if (updatedMetadata.endDate && !updatedMetadata.completed) {
            updatedMetadata.completed = true;
        }
        const { missing, optional } = this.fieldValidationService.findMissingFields(intent.intentType, updatedMetadata);

        const updatedIntent = await this.prisma.chatIntent.update({
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

    /**
     * Helper to create intent
     */
    private async createIntent(chatId: string, userId: string, intentResult: IntentDetectionResult, missing: string[], optional: string[]) {
    
        return await this.prisma.chatIntent.create({
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

    private async handleError(userId: string, chatId: string, message: string) {
        await ChatUtils.storeAssistantMessage(userId, chatId, message);
        return message;
    }
}