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
  return vectorSearch({
    table: 'WorkoutEmbedding',
    embeddingColumn: 'embedding',
    contentColumn: 'content',
    queryEmbedding,
    limit,
    threshold,
    userId
  });
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
  await prisma.$executeRawUnsafe(`
    INSERT INTO "WorkoutEmbedding" (id, "workoutId", "userId", content, embedding, metadata, "createdAt", "updatedAt")
    VALUES ('${id}', '${workoutId}', '${userId}', $1, '${vectorStr}'::vector, ${metadataStr}, NOW(), NOW())
  `, content);
  console.log('Embedding done')
  return id;
};
