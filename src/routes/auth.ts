import { Router, Request, Response } from 'express';
import authMiddleware, { AuthenticatedRequest } from '../middlewares/authMiddleware';
import AuthService from '../services/authService';
import { SignUpInput, LoginInput } from '../interfaces/auth';

const router = Router();
const authService = new AuthService();

// Sign up
router.post('/signup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('in signup', req.body)
    const data = await authService.signUp(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await authService.login(req.body);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const data = await authService.logout();
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  res.json(req.user);
});

// Verify user
router.get('/verify', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const verified = await authService.verifyUser(req.token!);
    res.json({ verified });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
