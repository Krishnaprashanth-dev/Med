
import { supabase } from '../supabaseClient';
import { PassApplication, IssuedPass, EntryLog, SessionType } from '../types';

const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export const PassService = {
  getApplications: async (filters?: { hospitalId?: string; date?: string; mrId?: string }): Promise<PassApplication[]> => {
    let query = supabase.from('applications').select('*');
    if (filters?.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
    if (filters?.date) query = query.eq('application_date', filters.date);
    if (filters?.mrId) query = query.eq('mr_id', filters.mrId);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(a => ({
      id: a.id,
      mrId: a.mr_id,
      hospitalId: a.hospital_id,
      session: a.session,
      applicationDate: a.application_date,
      priorityScore: a.priority_score,
      status: a.status,
      createdAt: a.created_at
    }));
  },

  saveApplications: async (apps: PassApplication[]) => {
    if (apps.length === 0) return;
    const { error } = await supabase.from('applications').upsert(
      apps.map(a => ({
        ...(a.id && isUUID(a.id) ? { id: a.id } : {}),
        mr_id: a.mrId,
        hospital_id: a.hospitalId,
        session: a.session,
        application_date: a.applicationDate,
        priority_score: a.priorityScore,
        status: a.status
      }))
    );
    if (error) {
      console.error("Bulk Applications Save Error:", error);
      throw error;
    }
  },

  getPasses: async (filters?: { hospitalId?: string; date?: string; mrId?: string | string[]; status?: string; session?: SessionType }): Promise<IssuedPass[]> => {
    let query = supabase.from('passes').select('*');
    if (filters?.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
    if (filters?.date) query = query.eq('pass_date', filters.date);
    if (filters?.mrId) {
      if (Array.isArray(filters.mrId)) {
        query = query.in('mr_id', filters.mrId);
      } else {
        query = query.eq('mr_id', filters.mrId);
      }
    }
    if (filters?.status) query = query.eq('entry_status', filters.status);
    if (filters?.session) query = query.eq('session', filters.session);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      mrId: p.mr_id,
      hospitalId: p.hospital_id,
      session: p.session,
      passDate: p.pass_date,
      timeSlot: p.time_slot,
      qrCode: p.qr_code,
      entryStatus: p.entry_status
    }));
  },

  savePasses: async (passes: IssuedPass[]) => {
    if (passes.length === 0) return;
    const { error } = await supabase.from('passes').upsert(
      passes.map(p => ({
        ...(p.id && isUUID(p.id) ? { id: p.id } : {}),
        mr_id: p.mrId,
        hospital_id: p.hospitalId,
        session: p.session,
        pass_date: p.passDate,
        time_slot: p.timeSlot,
        qr_code: p.qrCode,
        entry_status: p.entryStatus
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
      issuedPassId: l.pass_id,
      entryTime: l.entry_time,
      verifiedBy: l.verified_by
    }));
  },

  saveLogs: async (logs: EntryLog[]) => {
    if (logs.length === 0) return;
    const { error } = await supabase.from('entry_logs').upsert(
      logs.map(l => ({
        ...(l.id && isUUID(l.id) ? { id: l.id } : {}),
        pass_id: l.issuedPassId,
        entry_time: l.entryTime,
        verified_by: l.verifiedBy
      }))
    );
    if (error) {
      console.error("Bulk Logs Save Error:", error);
      throw error;
    }
  },

  cancelPassAndPickNext: async (applicationId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Get the application to be cancelled
      const { data: appToCancel, error: getAppError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (getAppError || !appToCancel) {
        return { success: false, message: "Application not found." };
      }

      if (appToCancel.status !== 'selected') {
        return { success: false, message: "Only selected applications can be cancelled and replaced." };
      }

      // 2. Update the application status to 'cancelled'
      const { error: updateCancelError } = await supabase
        .from('applications')
        .update({ status: 'cancelled' })
        .eq('id', applicationId);

      if (updateCancelError) throw updateCancelError;

      // 3. Delete the corresponding pass
      const { error: deletePassError } = await supabase
        .from('passes')
        .delete()
        .eq('id', applicationId); 

      if (deletePassError) {
          console.warn("Could not delete pass, it might not exist yet:", deletePassError);
      }

      // 4. Find the next waitlisted application
      const { data: nextApp, error: getNextAppError } = await supabase
        .from('applications')
        .select('*')
        .eq('hospital_id', appToCancel.hospital_id)
        .eq('session', appToCancel.session)
        .eq('application_date', appToCancel.application_date)
        .eq('status', 'waitlisted')
        .order('priority_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (getNextAppError) throw getNextAppError;

      if (!nextApp) {
        return { success: true, message: "Application cancelled. No candidates on the waiting list to replace." };
      }

      // 5. Update the next candidate to 'selected'
      const { error: updateNextError } = await supabase
        .from('applications')
        .update({ status: 'selected' })
        .eq('id', nextApp.id);

      if (updateNextError) throw updateNextError;

      // 6. Create a new pass for the next candidate
      const newPass = {
        id: nextApp.id,
        mr_id: nextApp.mr_id,
        hospital_id: nextApp.hospital_id,
        session: nextApp.session,
        pass_date: nextApp.application_date,
        time_slot: "",
        qr_code: `QR-${nextApp.id}`,
        entry_status: 'not_entered'
      };

      const { error: createPassError } = await supabase
        .from('passes')
        .insert(newPass);

      if (createPassError) throw createPassError;

      return { success: true, message: "Application cancelled and next candidate from waiting list selected." };
    } catch (err) {
      console.error("Cancel Pass Error:", err);
      return { success: false, message: err instanceof Error ? err.message : "An unknown error occurred." };
    }
  },
};
