import { prisma } from "../..";
import { embedder, vectorSearch } from "./llm";

// Specific function for WorkoutEmbeddings table
export async function searchWorkoutEmbeddings(
  userId: string,
  query: string,
  limit: number = 5,
  threshold: number = 0.8
) {
  const embedding = await embedder.embed(query);
  const queryEmbedding = Array.isArray(embedding) ? embedding : [embedding] as any;
  // console.log('Query embedding = ', queryEmbedding)
  try{
const results = vectorSearch({
  table: 'WorkoutEmbedding',
  embeddingColumn: 'embedding',
  contentColumn: 'content',
  queryEmbedding,
  limit,
  threshold,
  userId
});
return results;
  }catch{
    console.log('No embeddings found');
    return null
  }
  
}

export async function generateWorkoutEmbedding(content: string) {
  const embedding = await embedder.embed(content)
  return embedding;

}
// Create WorkoutEmbedding using raw SQL
export const createWorkoutEmbedding = async (
  workoutId: string,
  userId: string,
  content: string,
  embedding: number[],
  metadata?: any
) => {

  const id = crypto.randomUUID();
  const vectorStr = `[${embedding.join(',')}]`;
  const metadataStr = metadata ? `'${JSON.stringify(metadata)}'::json` : 'NULL';

  console.log('Updating embedding for ', id, workoutId, userId, content, vectorStr.length, metadata.length)
  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "WorkoutEmbedding" (
      id, "workoutId", "userId", content, embedding, metadata, "createdAt", "updatedAt"
    ) VALUES (
      '${id}', '${workoutId}', '${userId}', $1, '${vectorStr}'::vector, ${metadataStr}, NOW(), NOW()
    )
    ON CONFLICT ("workoutId") DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      metadata = EXCLUDED.metadata,
      "updatedAt" = NOW()
    `,
    content
  );
  console.log('Embedding done')
  return id;
};

export const generateWorkoutEmbeddingText = (workout: {
  type: string;
  distance?: number | null;
  idealDuration?: number | null;
  actualDuration?: number | null;
  startDate: Date;
  endDate?: Date | null;
  completed: boolean;
}) => {
  const parts: string[] = [];

  parts.push(`Workout type: ${workout.type}`);
  parts.push(`Start date: ${workout.startDate.toISOString()}`);

  if (workout.endDate) {
    parts.push(`End date: ${workout.endDate.toISOString()}`);
  }

  if (typeof workout.distance === 'number') {
    parts.push(`Distance: ${workout.distance} meters`);
  }

  if (typeof workout.idealDuration === 'number') {
    parts.push(`Planned duration: ${workout.idealDuration} minutes`);
  }

  if (typeof workout.actualDuration === 'number') {
    parts.push(`Actual duration: ${workout.actualDuration} minutes`);
  }

  parts.push(`Completed: ${workout.completed ? 'Yes' : 'No'}`);

  return parts.join('. ') + '.';
}
