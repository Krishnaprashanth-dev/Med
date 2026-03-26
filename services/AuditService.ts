
import { supabase } from '../supabaseClient';
import { AuditLog } from '../types';

export const AuditService = {
  log: async (userId: string, action: string, details: string) => {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        details,
        timestamp: new Date().toISOString()
      });
      if (error) console.error("Audit Logging Error:", error);
    } catch (err) {
      console.error("Audit Logging Exception:", err);
    }
  },

  getAuditLogs: async (filters?: { user_id?: string; action?: string }): Promise<AuditLog[]> => {
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (filters?.user_id) query = query.eq('user_id', filters.user_id);
    if (filters?.action) query = query.eq('action', filters.action);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(l => ({
      id: l.id,
      user_id: l.user_id,
      action: l.action,
      details: l.details,
      timestamp: l.timestamp
    }));
  }
};
