
import { Router } from "express";
import { agenticChat, chat } from "../controller/workoutchat";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();
router.post('/', chat)
router.post('/agentic', authMiddleware, agenticChat)

export default router;
