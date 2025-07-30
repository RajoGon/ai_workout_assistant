
import { Request, Response, NextFunction } from "express";
import { prisma } from "../..";
import { llmModel } from "../utils/llm";
import { RagChat } from "../services/ragChatService";
const ragChatService = new RagChat();

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, prompt } = req.body;
  if (!userId || !prompt) return res.status(400).json({ error: 'Missing userId or prompt' });
  try {
    const response = await ragChatService.hybridChat(userId, prompt)
    res.json(response);
  } catch (error) {
    next(error);
  }
}

