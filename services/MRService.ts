
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
      fullName: profileMap.get(m.id) || '',
      companyName: (m.pharma_companies as any)?.name || '',
      companyId: m.company_id,
      mrId: m.mr_code,
      loginId: m.mobile_number, // This is the contact number in mrs table, but we should probably fetch from profiles
      mobileNumber: m.mobile_number,
      identificationNumber: m.identification_number,
      slcpiId: m.slcpi_id,
      slcpiPhoto: m.slcpi_photo,
      slcpiExpiry: m.slcpi_expiry,
      status: m.status as any,
      createdAt: m.created_at
    }));
  },

  saveMRs: async (mrs: MedicalRep[]): Promise<MedicalRep[]> => {
    const results: MedicalRep[] = [];
    for (const mr of mrs) {
      // CRITICAL FIX: Generate UUID on client if missing to satisfy NOT NULL constraints in Supabase
      const targetId = (mr.id && mr.id.length > 20) ? mr.id : crypto.randomUUID();
      
      // CRITICAL FIX: New profiles MUST have a password for authentication to work
      if (!mr.id && !mr.password) {
        throw new Error(`Cannot create new profile for ${mr.fullName}: password is required`);
      }

      // 1. Save Profile (the auth record)
      const profileUpdate: any = {
        id: targetId,
        full_name: mr.fullName,
        role: 'MR',
        // CRITICAL: Use mobileNumber for the mobile_number column in profiles table
        // because that's what the login page uses for authentication for MRs.
        mobile_number: mr.mobileNumber.trim(),
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
          mr_code: mr.mrId,
          mobile_number: mr.mobileNumber,
          identification_number: mr.identificationNumber,
          slcpi_id: mr.slcpiId,
          slcpi_photo: mr.slcpiPhoto,
          slcpi_expiry: mr.slcpiExpiry,
          status: mr.status,
          company_id: mr.companyId
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
            fullName: profileData.full_name,
            companyName: (mrData.pharma_companies as any)?.name || '',
            companyId: mrData.company_id,
            mrId: mrData.mr_code,
            loginId: profileData.mobile_number, // The login ID from profiles table
            mobileNumber: mrData.mobile_number, // The contact number from mrs table
            identificationNumber: mrData.identification_number,
            slcpiId: mrData.slcpi_id,
            slcpiPhoto: mrData.slcpi_photo,
            slcpiExpiry: mrData.slcpi_expiry,
            status: mrData.status as any,
            createdAt: mrData.created_at
          });
        }
      }
    }
    return results;
  },
};
