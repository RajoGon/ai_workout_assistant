import { ChatUtils } from "../utils/chatUtils";
import { BaseWorkoutIntentHandlerTool } from "./BaseWorkoutIntentHandlerTool";

export class CreateWorkoutHandlerTool extends BaseWorkoutIntentHandlerTool {

    /**
     * Create a new workout
     */
    async execute(intent: any, chatId: string, userId: string) {
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

        const workout = await this.prisma.workout.create({
            data: workoutData
        });
        await this.workoutUtilService.upsertWorkoutEmbedding(workout);

        // Mark intent as fulfilled
        await this.prisma.chatIntent.update({
            where: { id: intent.id },
            data: {
                workoutId: workout.workoutId,
                fulfilled: true
            }
        });

        const response = `✅ Workout ${workout.completed ? 'logged' : 'scheduled'} successfully!
          ${this.workoutUtilService.formatWorkoutDetails(workout)}
    
          Is there anything else you'd like to know about your fitness progress or need help with?`;

        await ChatUtils.storeAssistantMessage(userId, chatId, response);
        return response;
    }
}