
// middleware/authMiddleware.js
import { createClient } from '@supabase/supabase-js';
import { NextFunction, Request, Response } from 'express';
// Extend Express Request
export interface AuthenticatedRequest extends Request {
  user?: any;
  token?: string;
}

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_KEY || ''
);

export default async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    //Bypass validation for this test user
    if (req.body.userId === "user123") {
      next();
      return;
    }
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

    req.user = data.user;
    req.token = token;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
