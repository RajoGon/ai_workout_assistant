import express from 'express';
import errorHandler from "./src/middlewares/errorHandler";
import workout from "./src/routes/workout";
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from './generated/prisma';
import chat from './src/routes/workoutchat';
import cors from 'cors'
import auth from './src/routes/auth';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
app.use('/auth', auth)
app.use('/workout', workout)
app.use('/workout-chat', chat)
app.use(errorHandler)


export default app;

