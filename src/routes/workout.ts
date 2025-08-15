import { Router } from "express";
import { getAllWorkouts, addWorkout, generateEmbeddings, getUserWorkouts } from "../controller/workout";

const router = Router();
router.get('/', getAllWorkouts)
router.post('/', addWorkout)
router.get('/generate-embeddings', generateEmbeddings)
router.get('/:userId', getUserWorkouts)
export default router;
