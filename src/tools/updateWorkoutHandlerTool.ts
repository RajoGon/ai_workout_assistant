import { ChatUtils } from "../utils/chatUtils";
import { DateUtils } from "../utils/dateUtils";
import { BaseWorkoutIntentHandlerTool } from "./BaseWorkoutIntentHandlerTool";

export class UpdateWorkoutHandlerTool extends BaseWorkoutIntentHandlerTool {

    /**
     * Updates a workout
     */
      async execute(intent: any, chatId: string, userId: string) {
        // Check if we have workout identification
        if (!intent.metadata.workoutIdentifier && !intent.workoutId) {
          // Need to identify which workout to update
          return await this.workoutUtilService.retrieveWorkouts(intent, chatId, userId)
        }
     
        // Find the specific workout to update
        const workoutCrudSearchResponse = await this.workoutUtilService.findWorkoutForCrud(intent, chatId, userId)
        //Check if workout is found, else retrieve workouts as ask user to choose again.
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
            updateData.actualDuration = await DateUtils.calculateDuration(new Date(startDate), updateData.endDate);
          }
        }
        if (intent.metadata.actualDuration !== undefined) updateData.actualDuration = intent.metadata.actualDuration;
    
    
    
        // Update the workout
        const updatedWorkout = await this.prisma.workout.update({
          where: { id: workoutToUpdate.id },
          data: updateData
        });
        await this.workoutUtilService.upsertWorkoutEmbedding(updatedWorkout);
    
    
        // Mark intent as fulfilled
        await this.prisma.chatIntent.update({
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
        ${this.workoutUtilService.formatWorkoutDetails(updatedWorkout)}
    
        Would you like to analyze your progress or get suggestions for future workouts?`;
    
        await ChatUtils.storeAssistantMessage(userId, chatId, response);
        return response;
      }
    }