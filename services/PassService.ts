
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

  getCancellationRequests: async (filters?: { mrId?: string; hospitalId?: string; companyId?: string; status?: string }): Promise<SessionCancellationRequest[]> => {
    let query = supabase.from('cancellation_requests').select('*');
    if (filters?.mrId) query = query.eq('mr_id', filters.mrId);
    if (filters?.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
    if (filters?.companyId) query = query.eq('company_id', filters.companyId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('requested_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      mrId: r.mr_id,
      passId: r.pass_id,
      applicationId: r.application_id,
      hospitalId: r.hospital_id,
      companyId: r.company_id,
      session: r.session,
      cancellationReason: r.cancellation_reason,
      status: r.status,
      requestedAt: r.requested_at,
      respondedAt: r.responded_at,
      respondedBy: r.responded_by,
      responseReason: r.response_reason
    }));
  },

  saveCancellationRequests: async (requests: SessionCancellationRequest[]) => {
    if (requests.length === 0) return;
    const { error } = await supabase.from('cancellation_requests').upsert(
      requests.map(r => ({
        ...(r.id && isUUID(r.id) ? { id: r.id } : {}),
        mr_id: r.mrId,
        pass_id: r.passId,
        application_id: r.applicationId,
        hospital_id: r.hospitalId,
        company_id: r.companyId,
        session: r.session,
        cancellation_reason: r.cancellationReason,
        status: r.status,
        requested_at: r.requestedAt,
        responded_at: r.respondedAt,
        responded_by: r.respondedBy,
        response_reason: r.responseReason
      }))
    );
    if (error) {
      console.error("Bulk Cancellation Requests Save Error:", error);
      throw error;
    }
  },

  requestCancellation: async (
    mrId: string,
    passId: string,
    applicationId: string,
    hospitalId: string,
    companyId: string,
    session: SessionType,
    reason?: string
  ): Promise<{ success: boolean; message: string; requestId?: string }> => {
    try {
      // Verify the pass exists and belongs to the MR
      const { data: pass, error: passError } = await supabase
        .from('passes')
        .select('*')
        .eq('id', passId)
        .eq('mr_id', mrId)
        .single();

      if (passError || !pass) {
        return { success: false, message: "Pass not found or does not belong to you." };
      }

      if (pass.entry_status !== 'not_entered') {
        return { success: false, message: "You can only cancel passes that haven't been used yet." };
      }

      // Create cancellation request
      const requestId = crypto.randomUUID();
      const cancellationRequest: SessionCancellationRequest = {
        id: requestId,
        mrId,
        passId,
        applicationId,
        hospitalId,
        companyId,
        session,
        cancellationReason: reason,
        status: 'pending',
        requestedAt: new Date().toISOString()
      };

      await supabase.from('cancellation_requests').insert({
        id: requestId,
        mr_id: mrId,
        pass_id: passId,
        application_id: applicationId,
        hospital_id: hospitalId,
        company_id: companyId,
        session: session,
        cancellation_reason: reason,
        status: 'pending',
        requested_at: new Date().toISOString()
      });

      return {
        success: true,
        message: "Cancellation request submitted to company administration. You will be notified of the decision.",
        requestId
      };
    } catch (err) {
      console.error("Request Cancellation Error:", err);
      return { success: false, message: err instanceof Error ? err.message : "Failed to submit cancellation request." };
    }
  },

  approveCancellation: async (
    cancellationRequestId: string,
    approverAdminId: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      // 1. Get the cancellation request
      const { data: cancellationReq, error: reqError } = await supabase
        .from('cancellation_requests')
        .select('*')
        .eq('id', cancellationRequestId)
        .single();

      if (reqError || !cancellationReq) {
        return { success: false, message: "Cancellation request not found." };
      }

      if (cancellationReq.status !== 'pending') {
        return { success: false, message: "This request has already been processed." };
      }

      // 2. Update cancellation request status to approved
      const { error: updateReqError } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
          responded_by: approverAdminId
        })
        .eq('id', cancellationRequestId);

      if (updateReqError) throw updateReqError;

      // 3. Get the application
      const { data: appToCancel, error: getAppError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', cancellationReq.application_id)
        .single();

      if (getAppError || !appToCancel) {
        return { success: true, message: "Cancellation approved but application not found to process." };
      }

      if (appToCancel.status !== 'selected') {
        return { success: true, message: "Cancellation approved but application is not in selected status." };
      }

      // 4. Update application status to cancelled
      const { error: updateAppError } = await supabase
        .from('applications')
        .update({ status: 'cancelled' })
        .eq('id', cancellationReq.application_id);

      if (updateAppError) throw updateAppError;

      // 5. Delete the corresponding pass
      const { error: deletePassError } = await supabase
        .from('passes')
        .delete()
        .eq('id', cancellationReq.pass_id);

      if (deletePassError) {
        console.warn("Could not delete pass, it might not exist yet:", deletePassError);
      }

      // 6. Find the next waitlisted application
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
        return { success: true, message: "Cancellation approved. No candidates on the waiting list to promote." };
      }

      // 7. Update next candidate to selected
      const { error: updateNextError } = await supabase
        .from('applications')
        .update({ status: 'selected' })
        .eq('id', nextApp.id);

      if (updateNextError) throw updateNextError;

      // 8. Create new pass for next candidate
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

      return { success: true, message: "Cancellation approved. Next candidate from waiting list promoted successfully." };
    } catch (err) {
      console.error("Approve Cancellation Error:", err);
      return { success: false, message: err instanceof Error ? err.message : "Failed to approve cancellation." };
    }
  },

  rejectCancellation: async (
    cancellationRequestId: string,
    approverAdminId: string,
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const { data: cancellationReq, error: reqError } = await supabase
        .from('cancellation_requests')
        .select('*')
        .eq('id', cancellationRequestId)
        .single();

      if (reqError || !cancellationReq) {
        return { success: false, message: "Cancellation request not found." };
      }

      if (cancellationReq.status !== 'pending') {
        return { success: false, message: "This request has already been processed." };
      }

      const { error: updateError } = await supabase
        .from('cancellation_requests')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          responded_by: approverAdminId,
          response_reason: rejectionReason
        })
        .eq('id', cancellationRequestId);

      if (updateError) throw updateError;

      return { success: true, message: "Cancellation request rejected. The pass remains valid." };
    } catch (err) {
      console.error("Reject Cancellation Error:", err);
      return { success: false, message: err instanceof Error ? err.message : "Failed to reject cancellation." };
    }
  },
};
