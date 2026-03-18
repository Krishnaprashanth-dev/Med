
import { AuthUser } from '../types';
import { supabase } from '../supabaseClient';

const SESSION_KEY = 'medpass_session';

export const SessionService = {
  setCurrentUser: (user: AuthUser) => localStorage.setItem(SESSION_KEY, JSON.stringify(user)),
  getCurrentUser: (): AuthUser | null => {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },
  clearSession: () => localStorage.removeItem(SESSION_KEY),
  updatePassword: async (userId: string, newPassword: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ password: newPassword })
      .eq('id', userId);
    if (error) throw error;
  }
};
