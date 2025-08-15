
import { Router } from "express";
import { agenticChat, chat } from "../controller/workoutchat";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();
router.post('/', authMiddleware, chat)
router.post('/agentic', authMiddleware, agenticChat)

export default router;
