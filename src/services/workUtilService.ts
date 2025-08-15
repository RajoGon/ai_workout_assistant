import { ChatUtils } from "../utils/chatUtils";
import { WorkoutEmbeddingUtils } from "../utils/workoutEmbeddingUtils";

export class WorkoutUtilService {
    constructor(
        protected prisma: any,
        protected llmModel: any
    ) { }
    /*
    * Formats a workout to show fields of a workout 
    */
    formatWorkoutDetails(workout: any): string {
        const startDate = workout.startDate ? new Date(workout.startDate).toLocaleString() : 'Not set';
        const endDate = workout.endDate ? new Date(workout.endDate).toLocaleString() : 'Not set';

        let details = `• Type: ${workout.type}\n• Start: ${startDate}\n• Status: ${workout.completed ? 'Completed' : 'Scheduled'}`;

        if (workout.endDate) details += `\n• End: ${endDate}`;
        if (workout.distance) details += `\n• Distance: ${workout.distance} km`;
        if (workout.idealDuration) details += `\n• Planned Duration: ${workout.idealDuration} mins`;
        if (workout.actualDuration) details += `\n• Actual Duration: ${workout.actualDuration} mins`;

        return details;
    }

    /*
    * Shows the summary of a workout
    */
    formatWorkoutSummary(workout: any): string {
        const startDate = workout.startDate ? new Date(workout.startDate).toLocaleString() : 'Not scheduled';
        const status = workout.completed ? '✅' : '📅';
        const duration = workout.actualDuration || workout.idealDuration;

        return `${status} ${workout.type} - ${startDate}${workout.distance ? ` - ${workout.distance}km` : ''}${duration ? ` - ${duration}min` : ''}`;
    }

    /*
    * Inserts or updates a workout embedding.
    */
    async upsertWorkoutEmbedding(workout: { id: number; workoutId: string; userId: string; createdAt: Date; updatedAt: Date; type: string; distance: number | null; idealDuration: number | null; actualDuration: number | null; startDate: Date; endDate: Date | null; completed: boolean; embeddingGenerated: boolean; }) {
        const content = await WorkoutEmbeddingUtils.generateEmbeddingText(workout);
        const embedding = await WorkoutEmbeddingUtils.generateEmbedding(content) as [];
        console.log('Embedding of dimension', embedding.length);
        const embeddingUpdated = await WorkoutEmbeddingUtils.createEmbedding(workout.workoutId, workout.userId, content, embedding, {
            type: workout.type,
        });
        if (embeddingUpdated) {
            await this.prisma.workout.update({
                where: {
                    workoutId: workout.workoutId
                },
                data: {
                    embeddingGenerated: true
                }
            });
        }
    }

    /**
   * Retrieve workouts for user selection
   */
    async retrieveWorkouts(intent: any, chatId: string, userId: string, limit = 6) {
        const recentWorkouts = await this.prisma.workout.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        if (recentWorkouts.length === 0) {
            const response = "You don't have any workouts yet.";
            await ChatUtils.storeAssistantMessage(userId, chatId, response);
            return response;
        }

        const workoutList = recentWorkouts.map((w: any, i: number) =>
            `${i + 1}. ${this.formatWorkoutSummary(w)}`
        ).join('\n');

        const response = intent.intentType === 'update'
            ? `Which workout would you like to update?\n${workoutList}\n\nPlease specify by number (1-${recentWorkouts.length}) or describe it.`
            : `Here are your recent workouts:\n${workoutList}`;

        await ChatUtils.storeAssistantMessage(userId, chatId, response);
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
            const recentWorkouts = await this.prisma.workout.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });
            return recentWorkouts[index] || null;
        }

        // Use LLM for description-based search
        const recentWorkouts = await this.prisma.workout.findMany({
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
            const result = await this.llmModel.generate(findPrompt);
            const workoutId = result.trim().replace(/"/g, '');

            if (workoutId === 'null') return null;

            return await this.prisma.workout.findUnique({
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
                workoutToUpdate = await this.prisma.workout.findUnique({
                    where: { workoutId: intent.workoutId }
                });
            } else if (intent.metadata.workoutIdentifier === 'last workout') {
                const recentWorkouts = await this.prisma.workout.findMany({
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
                await ChatUtils.storeAssistantMessage(userId, chatId, response);
                return response;
            }

            return workoutToUpdate;
        } catch (error) {
            console.error('Error finding workout for CRUD:', error);
            return { error: "I had trouble finding that workout. Please try again." };
        }
    }
}