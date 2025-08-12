import { prisma } from "../..";
import { storeAssistantMessage, storeSystemMessage, storeUserMessage } from "../utils/chatUtils";
import { llmModel } from "../utils/llm";
import { searchWorkoutEmbeddings } from "../utils/workoutEmbeddingUtils";

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
    let contextDocs;
    if(!result){
      console.log('No similarity matches found', result)
      contextDocs = `No past context for this ${userId} was found. Please consider this a new user.`;
    }else{
      console.log('Similarity results', result)
      contextDocs = result.join('\n');
    }
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

  async hybridConversation(userId: string, chatId: string, prompt: string, intent?: any) {
    const result = await searchWorkoutEmbeddings(userId, prompt);
    let contextDocs;
    if(result && result.length === 0){
      console.log('No similarity matches found', result)
      contextDocs = `No past context for this ${userId} was found. Please consider this a new user.`;
    }else{
      console.log('Similarity results', result)
      contextDocs = result!.join('\n');
    }

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
    let systemContent;
    if (intent) {
      // Build context-aware system prompt
      systemContent = await this.buildRagSystemPrompt(intent, contextDocs, prompt);
    } else {
      // System message with context
      systemContent = `You are a helpful assistant with access to user's workout history.
        Answer based on the following context:
        ${contextDocs}

        Use this workout context to provide personalized responses about the user's fitness journey, progress, and recommendations.`
    }
    let systemMessage = {
      role: 'system',
      content: systemContent
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
    const llmMessage = {
      role: 'assistant',
      content: response,
      ...(intent && {type:'suggestion'})
    }
    // Store system message in database
    // await storeSystemMessage(userId, chatId, systemMessage.content);

    // Store user message in database
    await storeUserMessage(userId, chatId, userMessage.content);

    await storeAssistantMessage(userId, chatId, llmMessage.content, llmMessage.type);

    messages.push(llmMessage);

    this.chatMemory.set(chatId, messages);
    return response;

  }

  async buildRagSystemPrompt(intent: any, workoutContext: string, userPrompt: string): Promise<string> {
    const intentContext = intent.intentContext;
    return `You are a helpful fitness assistant with access to the user's workout history and current context.

CURRENT CONTEXT:
${intentContext}

WORKOUT HISTORY:
${workoutContext}

INSTRUCTIONS:
1. Analyze the user's workout history to provide personalized suggestions
2. Consider their current intent: ${intent.intentType}
3. Provide specific, actionable recommendations
4. If suggesting dates/times, use natural language (e.g., "tomorrow at 6pm", "next Monday 9am")
5. Be conversational and explain your reasoning
6. If the user provides constraints or feedback, adjust your suggestions accordingly
7. Always end with asking if they'd like to proceed with your suggestion or need alternatives

Examples of good responses:
- "Based on your running history, I see you typically run 5km on weekday evenings. How about tomorrow at 6pm for a 5km run?"
- "Looking at your past workouts, you seem to prefer morning yoga sessions. I'd suggest next Monday at 8am for a 45-minute session."
- "I notice you haven't run in a while. Let's start with a gentle 3km run this Sunday at 7am when it's cooler."

Respond naturally and helpfully to: "${userPrompt}"`;
  }
}
