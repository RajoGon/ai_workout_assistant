
import { Request, Response, NextFunction } from "express";
import { RagChat } from "../services/ragChatService";
import { classifyPrompt } from "../utils/intentClassifier";
const ragChatService = new RagChat();

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, prompt } = req.body;

  let { chatId } = req.body;
  if (!userId || !prompt) return res.status(400).json({ error: 'Missing userId or prompt' });
  if (!chatId) {
    //generate a new chatId
    chatId = crypto.randomUUID();
  }
  try {
    const response = await ragChatService.hybridConversation(userId, chatId, prompt)
    res.json({ response, chatId });
  } catch (error) {
    next(error);
  }
}

export const agenticChat = async (req: Request, res: Response, next: NextFunction) => {
  const { userId, prompt } = req.body;

  let { chatId } = req.body;
  if (!userId || !prompt) return res.status(400).json({ error: 'Missing userId or prompt' });
  if (!chatId) {
    //generate a new chatId
    chatId = crypto.randomUUID();
  }
  try {
    //Clarify intent
    let intent = await classifyPrompt(prompt, "rules");
    let response;
    if (intent === 'agent') {
      response = await ragChatService.agenticConversation(userId, chatId, prompt)
    } else {
      response = await ragChatService.hybridConversation(userId, chatId, prompt)
    }
    res.json({ response, chatId });
  } catch (error) {
    next(error);
  }
}

