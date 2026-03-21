
import { AuthUser } from '../types';
import { supabase } from '../supabaseClient';

const getSessionKey = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type')?.toLowerCase() || 'mr';
  return `medpass_session_${type}`;
};

export const SessionService = {
  setCurrentUser: (user: AuthUser) => localStorage.setItem(getSessionKey(), JSON.stringify(user)),
  getCurrentUser: (): AuthUser | null => {
    const session = localStorage.getItem(getSessionKey());
    return session ? JSON.parse(session) : null;
  },
  clearSession: () => localStorage.removeItem(getSessionKey()),
  updatePassword: async (userId: string, newPassword: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ password: newPassword })
      .eq('id', userId);
    if (error) throw error;
  }
};
