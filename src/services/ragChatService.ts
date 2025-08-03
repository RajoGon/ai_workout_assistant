import { prisma } from "../..";
import { llmModel } from "../utils/llm";
import { searchWorkoutEmbeddings } from "../utils/workoutEmbeddingSearch";

export class RagChat {
  chatMemory = new Map();
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

  async hybridConversation(userId: string, chatId: string, prompt: string) {
    const result = await searchWorkoutEmbeddings(userId, prompt);
    console.log('Similarity results', result)
    const contextDocs = result.join('\n');
    // Retrieve chat history from database
    const chatHistory = await prisma.chatHistory.findMany({
      where: {
        userId,
        chatId
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    if (chatHistory) {
      this.chatMemory.set(chatId, chatHistory.map((chat: { message: any; }) => chat.message))
    }
    //Fetch chat chatMemory
    let chatMemory = this.chatMemory.get(chatId);

    // Build messages array for chat flow
    let messages = [];
    if (chatMemory) {
      messages = chatMemory;
    }


    // System message with context
    const systemMessage = {
      role: 'system',
      content: `You are a helpful assistant with access to user's workout history.
Answer based on the following context:
${contextDocs}

Use this workout context to provide personalized responses about the user's fitness journey, progress, and recommendations.`
    }
    messages.push(systemMessage);

    // Add chat history if provided
    // if (chatHistory && chatHistory.length > 0) {
    //   messages.push(...chatHistory);
    // }
    // Add current user prompt
    const userMessage = { role: 'user' as const, content: prompt };
    messages.push(userMessage);

    console.log('Querying LLM with messages', messages);

    // Use chat instead of generate
    const response = await llmModel.chat(messages);

    // Store system message in database
    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: systemMessage
      }
    });
    // Store user message in database
    await prisma.chatHistory.create({
      data: {
        userId,
        chatId,
        message: userMessage
      }
    });
    const llmMessage = {
      role: 'assistant',
      content: response
    }
    await prisma.chatHistory.create({
      data: {
        chatId,
        userId,
        message: llmMessage
      }
    })
    messages.push(llmMessage);

    this.chatMemory.set(chatId, messages);
    return response;

  }


}
