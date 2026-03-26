
import { supabase } from '../supabaseClient';
import { MRHospitalApproval } from '../types';

export const ApprovalService = {
  getApprovals: async (filters?: { mr_id?: string; hospital_id?: string }): Promise<MRHospitalApproval[]> => {
    let query = supabase.from('approvals').select('*');
    if (filters?.mr_id) query = query.eq('mr_id', filters.mr_id);
    if (filters?.hospital_id) query = query.eq('hospital_id', filters.hospital_id);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(a => ({
      id: a.id,
      mr_id: a.mr_id,
      hospital_id: a.hospital_id,
      status: a.status,
      updated_at: a.updated_at
    }));
  },

  saveApprovals: async (approvals: MRHospitalApproval[]) => {
    if (approvals.length === 0) return;
    const { error } = await supabase.from('approvals').upsert(
      approvals.map(a => ({
        ...(a.id && a.id.length > 20 ? { id: a.id } : {}),
        mr_id: a.mr_id,
        hospital_id: a.hospital_id,
        status: a.status,
        updated_at: a.updated_at
      }))
    );
    if (error) {
      console.error("Bulk Approvals Save Error:", error);
      throw error;
    }
  },
};
