
import { supabase } from '../supabaseClient';
import { MRHospitalApproval } from '../types';

export const ApprovalService = {
  getApprovals: async (filters?: { mrId?: string; hospitalId?: string }): Promise<MRHospitalApproval[]> => {
    let query = supabase.from('approvals').select('*');
    if (filters?.mrId) query = query.eq('mr_id', filters.mrId);
    if (filters?.hospitalId) query = query.eq('hospital_id', filters.hospitalId);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(a => ({
      id: a.id,
      mrId: a.mr_id,
      hospitalId: a.hospital_id,
      status: a.status,
      updatedAt: a.updated_at
    }));
  },

  saveApprovals: async (approvals: MRHospitalApproval[]) => {
    if (approvals.length === 0) return;
    const { error } = await supabase.from('approvals').upsert(
      approvals.map(a => ({
        ...(a.id && a.id.length > 20 ? { id: a.id } : {}),
        mr_id: a.mrId,
        hospital_id: a.hospitalId,
        status: a.status,
        updated_at: a.updatedAt
      }))
    );
    if (error) {
      console.error("Bulk Approvals Save Error:", error);
      throw error;
    }
  },
};
