import { IntentHandlerTool } from "../interfaces/intentHandler";
import { WorkoutUtilService } from "../services/workUtilService";

// Abstract base class for all intent handlers
export abstract class BaseWorkoutIntentHandlerTool implements IntentHandlerTool {
    constructor(
      protected prisma: any,
      protected ragChatService: any,
      protected llmModel: any,
      protected workoutUtilService: WorkoutUtilService
    ) {}
    abstract execute<T>(intent: T, chatId: string, userId: string): Promise<string>;
  }
  