import { prisma } from "../lib/prisma";
export class ChatUtils{

  static async storeAssistantMessage(userId: string, chatId: string, content: string, type?: string, accepted?: string) {
    return await prisma.chatHistory.create({
      data: {
        userId: userId,
        chatId,
        ...(type &&   {type}),
        ...(accepted &&   {accepted}),
        message: { role: 'assistant', content }
      }
    });
  }

  static async storeUserMessage(userId: string, chatId: string, content: string) {
    return await prisma.chatHistory.create({
      data: {
        userId: userId,
        chatId,
        message: { role: 'user', content }
      }
    });
  }

  static async storeSystemMessage(userId: string, chatId: string, content: any) {
    return await prisma.chatHistory.create({
      data: {
        userId: userId,
        chatId,
        message: { role: 'system', content }
      }
    });
  }  

    /**
   * Get recent chat history for context
   */
    static async getRecentChatHistory(userId: string, chatId: string, limit: number = 5) {
      const history = await prisma.chatHistory.findMany({
        where: { userId, chatId },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
      
      // Extract only role and content for LLM, ignoring type field
      return history.reverse().map(h => {
        const message = h.message as any;
        return {
          role: message.role,
          content: message.content
        };
      });
    }

}

