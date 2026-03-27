
import { supabase } from '../supabaseClient';
import { AuditLog } from '../types';

export const AuditService = {
  log: async (user_id: string, action: string, details: string) => {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        user_id,
        action,
        details,
        timestamp: new Date().toISOString()
      });
      if (error) console.error("Audit Logging Error:", error);
    } catch (err) {
      console.error("Audit Logging Exception:", err);
    }
  },

  getAuditLogs: async (filters?: { userId?: string; action?: string }): Promise<AuditLog[]> => {
    let query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (filters?.userId) query = query.eq('user_id', filters.userId);
    if (filters?.action) query = query.eq('action', filters.action);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(l => ({
      id: l.id,
      userId: l.user_id,
      action: l.action,
      details: l.details,
      timestamp: l.timestamp
    }));
  }
};
