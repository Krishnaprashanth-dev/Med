
import { supabase } from '../supabaseClient';
import { PassApplication, IssuedPass, EntryLog, SessionType, SessionCancellationRequest } from '../types';

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
        applicationId: p.application_id,
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
        id: crypto.randomUUID(),
        application_id: nextApp.id,
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

      // 7. Trigger Email Notification for the new candidate
      try {
        fetch('/api/notify-replacement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mrId: nextApp.mr_id,
            hospitalId: nextApp.hospital_id,
            session: nextApp.session,
            date: nextApp.application_date
          })
        }).catch(err => console.error("Replacement notification trigger error:", err));
      } catch (err) {
        console.error("Replacement notification error:", err);
      }

      return { success: true, message: "Application cancelled and next candidate from waiting list selected." };
    } catch (err) {
      console.error("Cancel Pass Error:", err);
      return { success: false, message: err instanceof Error ? err.message : "An unknown error occurred." };
    }
  },

   requestCancellation: async (data: { 
    applicationId: string; 
    passId: string; 
    mrId: string; 
    companyId: string; 
    hospitalId: string; 
    session: SessionType; 
    date: string; 
    reason: string 
  }): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.from('cancellation_requests').insert({
        application_id: data.applicationId,
        pass_id: data.passId,
        mr_id: data.mrId,
        company_id: data.companyId,
        hospital_id: data.hospitalId,
        session: data.session,
        date: data.date,
        status: 'pending',
        cancellation_reason: data.reason,
        requested_at: new Date().toISOString()
      });

      if (error) throw error;
      return { success: true, message: "Cancellation request submitted to your company admin." };
    } catch (err) {
          console.error("Request Cancellation Error:", err);
      return { success: false, message: "Failed to submit cancellation request." };
    }
  },

  getCancellationRequests: async (filters?: { companyId?: string; mrId?: string; status?: string }): Promise<SessionCancellationRequest[]> => {
    let query = supabase.from('cancellation_requests').select('*');
    if (filters?.companyId) query = query.eq('company_id', filters.companyId);
    if (filters?.mrId) query = query.eq('mr_id', filters.mrId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('requested_at', { ascending: false });
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      applicationId: r.application_id,
      passId: r.pass_id,
      mrId: r.mr_id,
      companyId: r.company_id,
      hospitalId: r.hospital_id,
      session: r.session,
      date: r.date,
      status: r.status,
      cancellationReason: r.cancellation_reason,
      responseReason: r.response_reason,
      requestedAt: r.requested_at,
      respondedAt: r.responded_at,
      respondedBy: r.responded_by
    }));
  },

  approveCancellation: async (requestId: string, adminId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Get request details
      const { data: request, error: getReqError } = await supabase
        .from('cancellation_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (getReqError || !request) throw new Error("Request not found");

      // 2. Perform the actual cancellation and replacement
      const result = await PassService.cancelPassAndPickNext(request.application_id);
      
      if (result.success) {
        // 3. Update request status
        await supabase.from('cancellation_requests').update({
          status: 'approved',
          responded_at: new Date().toISOString(),
          responded_by: adminId
        }).eq('id', requestId);
      }

      return result;
    } catch (err) {
      console.error("Approve Cancellation Error:", err);
      return { success: false, message: "Failed to approve cancellation." };
    }
  },

  rejectCancellation: async (requestId: string, adminId: string, reason?: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { error } = await supabase.from('cancellation_requests').update({
        status: 'rejected',
        response_reason: reason,
        responded_at: new Date().toISOString(),
        responded_by: adminId
      }).eq('id', requestId);

      if (error) throw error;
      return { success: true, message: "Cancellation request rejected." };
    } catch (err) {
      console.error("Reject Cancellation Error:", err);
      return { success: false, message: "Failed to reject cancellation." };
    }
  },
};
