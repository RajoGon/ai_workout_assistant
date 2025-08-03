import express from 'express';
import errorHandler from "./src/middlewares/errorHandler";
import workout from "./src/routes/workout";
import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma';
import chat from './src/routes/workoutchat';
import cors from 'cors'


dotenv.config();
const app = express();
app.use(express.json());

app.use(cors());
export const prisma = new PrismaClient();
app.use('/workout-manager', workout)
app.use('/workout-chat', chat)


app.use(errorHandler)


export default app;

