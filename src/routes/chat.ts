
import { Router } from "express";
import { chat } from "../cnotroller/chat";

const router = Router();
router.post('/', chat)

export default router;
