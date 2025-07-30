
import { Router } from "express";
import { agenticChat, chat } from "../cnotroller/chat";

const router = Router();
router.post('/', chat)
router.post('/agentic', agenticChat)

export default router;
