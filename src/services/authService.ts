
// services/AuthService.js
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../..';

export default class AuthService {
  supabase: any;
  constructor() {
    console.log('Supabase url', process.env.SUPABASE_URL)
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  // Sign up with userId, email, password, and optional name
  async signUp({ userId, email, password, name }: Record<string, string>): Promise<any> {
    console.log('signing up ', userId)
    // Check if userId exists
    const { data: existingUser, error: existingError } = await this.supabase
      .from('User')
      .select('id')
      .eq('userId', userId)
      .single();

    if (existingUser) {
      throw new Error('Username already taken');
    }

    // Create Supabase auth user
    const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { userId, name: name || null }
      }
    });

    if (signUpError) throw signUpError;

    // Store userId in User table
    const addedUser = await prisma.user.create({
      data: { authId: signUpData.user.id, userId, name, email }
    });
    console.log('Added in user table', addedUser)

    return signUpData;
  }

  // Login with userId + password
  async login({ userId, password }: Record<string, string>) {

    const user = await prisma.user.findFirst({
      where: { userId },
    });
    // Find email by userId

    console.log('Loging in with user', userId, user)

    if (!user) throw new Error('Invalid userId');

    // Sign in with email
    const { data, error: loginError } = await this.supabase.auth.signInWithPassword({
      email: user.email,
      password
    });

    if (loginError) throw loginError;

    return data;
  }

  // Logout
  async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    return { message: 'Logged out successfully' };
  }

  // Get current user from token
  async getUser(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error) throw error;
    return data.user;
  }

  // Verify user (e.g. email confirmation)
  async verifyUser(accessToken: string) {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error) throw error;
    return data.user?.confirmed_at !== null;
  }
}
