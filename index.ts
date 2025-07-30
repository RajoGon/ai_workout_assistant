import express from 'express';
import errorHandler from "./src/middlewares/errorHandler";
import workout from "./src/routes/workout";
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import chat from './src/routes/chat';

dotenv.config();
const app = express();
app.use(express.json());
export const prisma = new PrismaClient();
app.use('/workout', workout)

app.use('/chat', chat)


app.use(errorHandler)


export default app;

