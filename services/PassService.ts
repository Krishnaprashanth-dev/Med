
import { supabase } from '../supabaseClient';
import { PassApplication, IssuedPass, EntryLog, SessionType } from '../types';

export const PassService = {
  getApplications: async (filters?: { hospital_id?: string; date?: string; mr_id?: string }): Promise<PassApplication[]> => {
    let query = supabase.from('applications').select('*');
    if (filters?.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
    if (filters?.date) query = query.eq('application_date', filters.date);
    if (filters?.mr_id) query = query.eq('mr_id', filters.mr_id);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(a => ({
      id: a.id,
      mr_id: a.mr_id,
      hospital_id: a.hospital_id,
      session: a.session,
      application_date: a.application_date,
      priority_score: a.priority_score,
      status: a.status,
      created_at: a.created_at
    }));
  },

  saveApplications: async (apps: PassApplication[]) => {
    if (apps.length === 0) return;
    const { error } = await supabase.from('applications').upsert(
      apps.map(a => ({
        ...(a.id && a.id.length > 20 ? { id: a.id } : {}),
        mr_id: a.mr_id,
        hospital_id: a.hospital_id,
        session: a.session,
        application_date: a.application_date,
        priority_score: a.priority_score,
        status: a.status
      }))
    );
    if (error) {
      console.error("Bulk Applications Save Error:", error);
      throw error;
    }
  },

  getPasses: async (filters?: { hospital_id?: string; date?: string; mr_id?: string | string[]; status?: string; session?: SessionType }): Promise<IssuedPass[]> => {
    let query = supabase.from('passes').select('*');
    if (filters?.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
    if (filters?.date) query = query.eq('pass_date', filters.date);
    if (filters?.mr_id) {
      if (Array.isArray(filters.mr_id)) {
        query = query.in('mr_id', filters.mr_id);
      } else {
        query = query.eq('mr_id', filters.mr_id);
      }
    }
    if (filters?.status) query = query.eq('entry_status', filters.status);
    if (filters?.session) query = query.eq('session', filters.session);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      mr_id: p.mr_id,
      hospital_id: p.hospital_id,
      session: p.session,
      pass_date: p.pass_date,
      time_slot: p.time_slot,
      qr_code: p.qr_code,
      entry_status: p.entry_status
    }));
  },

  savePasses: async (passes: IssuedPass[]) => {
    if (passes.length === 0) return;
    const { error } = await supabase.from('passes').upsert(
      passes.map(p => ({
        ...(p.id && p.id.length > 20 ? { id: p.id } : {}),
        mr_id: p.mr_id,
        hospital_id: p.hospital_id,
        session: p.session,
        pass_date: p.pass_date,
        time_slot: p.time_slot,
        qr_code: p.qr_code,
        entry_status: p.entry_status
      }))
    );
    if (error) {
      console.error("Bulk Passes Save Error:", error);
      throw error;
    }
  },

  getLogs: async (): Promise<EntryLog[]> => {
    const { data, error } = await supabase.from('entry_logs').select('*');
    if (error) throw error;
    return (data || []).map(l => ({
      id: l.id,
      pass_id: l.pass_id,
      entry_time: l.entry_time,
      verified_by: l.verified_by
    }));
  },

  saveLogs: async (logs: EntryLog[]) => {
    if (logs.length === 0) return;
    const { error } = await supabase.from('entry_logs').upsert(
      logs.map(l => ({
        ...(l.id && l.id.length > 20 ? { id: l.id } : {}),
        pass_id: l.pass_id,
        entry_time: l.entry_time,
        verified_by: l.verified_by
      }))
    );
    if (error) {
      console.error("Bulk Logs Save Error:", error);
      throw error;
    }
  },
};
