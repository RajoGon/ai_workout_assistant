
import { Request, Response, NextFunction } from "express";
import { RagChat } from "../services/ragChatService";
import { classifyPrompt } from "../utils/intentClassifier";
import { WorkoutServiceContainer } from "../services/agenticWorkoutOrchestrator";
import { llmModel } from "../utils/llm";
import { prisma } from "../lib/prisma";
const ragChatService = new RagChat();

const workoutServiceContainer  = new WorkoutServiceContainer(prisma, ragChatService, llmModel);

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
  const workoutService = workoutServiceContainer.getOrchestrator();
  const { userId, prompt } = req.body;

  let { chatId } = req.body;
  if (!userId || !prompt) return res.status(400).json({ error: 'Missing userId or prompt' });
  console.log('Running for user', userId)
  if (!chatId) {
    //generate a new chatId
    chatId = crypto.randomUUID();
  }
  let response;
  try {
    //check if an intent is on going
    const existingIntent = await workoutService.checkForExistingIntent(userId, chatId, prompt)
    if (existingIntent) {
      response = await workoutService.processWorkoutRequest(userId, chatId, prompt, existingIntent)
    } else {
      //Clarify intent
      let intent = await classifyPrompt(prompt, "rules");
      console.log('Intent = ', intent)
      if (intent === 'agent') {
        response = await workoutService.processWorkoutRequest(userId, chatId, prompt, existingIntent)
      } else {
        response = await ragChatService.hybridConversation(userId, chatId, prompt)
      }
    }
    res.json({ response, chatId });
  } catch (error) {
    next(error);
  }
}

