
import { supabase } from '../supabaseClient';
import { MedicalRep } from '../types';
import { SessionService } from './SessionService';

export const MRService = {
  getMRs: async (): Promise<MedicalRep[]> => {
    const { data, error } = await supabase
      .from('mrs')
      .select(`
        id, 
        mr_code, 
        mobile_number, 
        identification_number, 
        slcpi_id, 
        slcpi_photo, 
        slcpi_expiry, 
        status, 
        created_at,
        company_id,
        pharma_companies (name)
      `);
    
    if (error) throw error;

    const { data: profiles } = await supabase.from('profiles').select('id, full_name').eq('role', 'MR');
    const profileMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

    return (data || []).map(m => ({
      id: m.id,
      full_name: profileMap.get(m.id) || '',
      company_name: (m.pharma_companies as any)?.name || '',
      company_id: m.company_id,
      mr_code: m.mr_code,
      mobile_number: m.mobile_number,
      identification_number: m.identification_number,
      slcpi_id: m.slcpi_id,
      slcpi_photo: m.slcpi_photo,
      slcpi_expiry: m.slcpi_expiry,
      status: m.status as any,
      created_at: m.created_at
    }));
  },

  saveMRs: async (mrs: MedicalRep[]): Promise<MedicalRep[]> => {
    const results: MedicalRep[] = [];
    for (const mr of mrs) {
      // CRITICAL FIX: Generate UUID on client if missing to satisfy NOT NULL constraints in Supabase
      const targetId = (mr.id && mr.id.length > 20) ? mr.id : crypto.randomUUID();
      
      // CRITICAL FIX: New profiles MUST have a password for authentication to work
      if (!mr.id && !mr.password) {
        throw new Error(`Cannot create new profile for ${mr.full_name}: password is required`);
      }

      // 1. Save Profile (the auth record)
      const profileUpdate: any = {
        id: targetId,
        full_name: mr.full_name,
        role: 'MR',
        mobile_number: mr.mobile_number.trim(),
      };
      
      // Only include password if it's provided (new MR or explicit change)
      if (mr.password) {
        profileUpdate.password = mr.password.trim();
      }

      const { data: profileData, error: profileError } = await supabase.from('profiles').upsert(profileUpdate).select().single();

      if (profileError) {
        console.error("Error saving MR profile:", profileError);
        throw profileError;
      }

      if (profileData) {
        // 2. Save MR Metadata using same targetId
        const { data: mrData, error: mrError } = await supabase.from('mrs').upsert({
          id: targetId,
          mr_code: mr.mr_code,
          mobile_number: mr.mobile_number,
          identification_number: mr.identification_number,
          slcpi_id: mr.slcpi_id,
          slcpi_photo: mr.slcpi_photo,
          slcpi_expiry: mr.slcpi_expiry,
          status: mr.status,
          company_id: mr.company_id
        }).select(`
          *,
          pharma_companies (name)
        `).single();

        if (mrError) {
          console.error("Error saving MR metadata:", mrError);
          throw mrError;
        }

        if (mrData) {
          results.push({
            id: mrData.id,
            full_name: profileData.full_name,
            company_name: (mrData.pharma_companies as any)?.name || '',
            company_id: mrData.company_id,
            mr_code: mrData.mr_code,
            mobile_number: mrData.mobile_number,
            identification_number: mrData.identification_number,
            slcpi_id: mrData.slcpi_id,
            slcpi_photo: mrData.slcpi_photo,
            slcpi_expiry: mrData.slcpi_expiry,
            status: mrData.status as any,
            created_at: mrData.created_at
          });
        }
      }
    }
    return results;
  },
};
