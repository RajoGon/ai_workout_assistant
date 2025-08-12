import { Request, Response, NextFunction } from "express";
import { prisma } from "../..";
import { createWorkoutEmbedding, generateWorkoutEmbedding } from "../utils/workoutEmbeddingUtils";

export const getAllWorkouts = async (req: Request, res: Response, next: NextFunction) => {

  try {
    const response = await prisma.workout.findMany({
    });
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
}
export const getUserWorkouts = async (req: Request, res: Response, next: NextFunction) => {
  const  userId = req.params.userId as string;
  console.log('Fetching user workouts for ', userId)

  try {
    const response = await prisma.workout.findMany({
      where:{userId}
    });
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
}



export const addWorkout = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, workout } = req.body;
  if (!userId && !workout) return res.status(400).json({ error: 'Missing userId or prompt' });


  try {
    await prisma.workout.create(
      {
        data: {
          type: workout.type,
          time: workout.time,
          completed: false,
          embeddingGenerated: false,
          userId,
          ...(workout.distance && { distance: workout.distance }),
          ...(workout.duration && { duration: workout.duration }),

        },
      }
    )
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export const generateEmbeddings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Find all workouts without and embedding
    const pendingWorkoutsToEmbedd = await prisma.workout.findMany({
      where: {
        embeddingGenerated: false
      }
    })
    console.log('Number of workouts to embedd', pendingWorkoutsToEmbedd.length)
    // Loop through each to create embedding and update 
    pendingWorkoutsToEmbedd.forEach(async workout => {
      const content = `Workout on ${workout.startDate}: ${workout.type}, distance: ${workout.distance} km, duration: ${workout.idealDuration} mins`
      const embedding = await generateWorkoutEmbedding(content) as [];
      console.log('Embedding of dimension', embedding.length)
      const embeddingUpdated = await createWorkoutEmbedding(workout.workoutId, workout.userId, content, embedding, {
        type: workout.type,
      })
      if (embeddingUpdated) {
        await prisma.workout.update({
          where: {
            workoutId: workout.workoutId // or use workoutId: "uuid-string" for the unique workoutId field
          },
          data: {
            embeddingGenerated: true
          }
        });
      }
    })
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

