import { Router } from "express";
import { getAllWorkouts, addWorkout, generateEmbeddings } from "../controller/workout";

const router = Router();
router.get('/', getAllWorkouts)

router.post('/', addWorkout)

router.get('/generate-embeddings', generateEmbeddings)
export default router;
