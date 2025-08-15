import { IIntentHandlerFactory, IntentHandlerTool } from "../interfaces/intentHandler";
import { CreateWorkoutHandlerTool } from "../tools/createWorkoutHandlerTool";
import { UpdateWorkoutHandlerTool } from "../tools/updateWorkoutHandlerTool";
import { WorkoutUtilService } from "../services/workUtilService";

// Factory for creating intent handlers
export class WorkoutIntentHandlerFactory implements IIntentHandlerFactory {
    private handlers: Map<string, IntentHandlerTool> = new Map();
  
    constructor(
      private prisma: any,
      private ragChatService: any,
      private llmModel: any,
      private workoutUtilService: WorkoutUtilService
      
    ) {
      this.initializeHandlers();
    }
  
    private initializeHandlers(): void {
      this.handlers.set('create', new CreateWorkoutHandlerTool(this.prisma, this.ragChatService, this.llmModel, this.workoutUtilService));
      this.handlers.set('update', new UpdateWorkoutHandlerTool(this.prisma, this.ragChatService, this.llmModel, this.workoutUtilService));
    //   this.handlers.set('retrieve', new RetrieveWorkoutHandler(this.prisma, this.ragChatService, this.llmModel));
    //   this.handlers.set('delete', new DeleteWorkoutHandler(this.prisma, this.ragChatService, this.llmModel));
    }
  
    createHandler(intentType: string): IntentHandlerTool {
      const handler = this.handlers.get(intentType);
      if (!handler) {
        throw new Error(`Unknown intent type: ${intentType}`);
      }
      return handler;
    }
  
    getSupportedIntents(): string[] {
      return Array.from(this.handlers.keys());
    }
  }