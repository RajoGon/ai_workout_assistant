import { llmModel } from "../utils/llm";
import { searchWorkoutEmbeddings } from "../utils/workoutEmbeddingSearch";

export class RagChat {
  constructor() {
    this.init();
  }
  init() {
    console.log('Rag chat initialized');
  }
  async hybridChat(userId: string, prompt: string) {
    const result = await searchWorkoutEmbeddings(userId, prompt);
    console.log('Similarity results', result)
    const contextDocs = result.join('\n');
    const chat_history = ''
    const systemPrompt = `
You are a helpful assistant with access to user's workout history.
Answer based on the following context:

${contextDocs}
${chat_history ? ' Chat history: {chat_history} ' : ''}

User: ${prompt}
Assistant:
`
    console.log('Querying llm with prompt', systemPrompt)
    const response = await llmModel.generate(systemPrompt);
    return response;

  }
}
