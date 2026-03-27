
import { AuthUser } from '../types';
import { supabase } from '../supabaseClient';
import bcrypt from 'bcryptjs';

const SESSION_KEY = 'medpass_session';

export const SessionService = {
  setCurrentUser: (user: AuthUser) => localStorage.setItem(SESSION_KEY, JSON.stringify(user)),
  getCurrentUser: (): AuthUser | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },
  clearSession: () => localStorage.removeItem(SESSION_KEY),
  hashPassword: async (password: string) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },
  updatePassword: async (userId: string, newPassword: string) => {
    // Hash the password before saving for security
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const { error } = await supabase
      .from('profiles')
      .update({ password: hashedPassword })
      .eq('id', userId);
    if (error) throw error;
  }
};
