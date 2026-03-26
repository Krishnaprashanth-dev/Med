
import { supabase } from '../supabaseClient';
import { Hospital, HospitalUser } from '../types';
import { SessionService } from './SessionService';

export const HospitalService = {
  getHospitals: async (id?: string): Promise<Hospital[]> => {
    let query = supabase.from('hospitals').select('*');
    if (id) query = query.eq('id', id);
    
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(h => ({
      id: h.id,
      name: h.name,
      address: h.address,
      email: h.email,
      mobile_number: h.mobile_number,
      is_active: h.is_active,
      supported_sessions: h.supported_sessions,
      pass_limits: h.pass_limits,
      session_windows: h.session_windows,
      entry_windows: h.entry_windows,
      expiry_times: h.expiry_times,
      auto_lottery_enabled: h.auto_lottery_enabled,
      auto_lottery_times: h.auto_lottery_times,
      company_pass_limit: h.company_pass_limit
    }));
  },

  saveHospitals: async (hospitals: Hospital[]): Promise<Hospital[]> => {
    const results: Hospital[] = [];
    for (const h of hospitals) {
      const targetId = (h.id && h.id.length > 20) ? h.id : crypto.randomUUID();

      const { data, error } = await supabase.from('hospitals').upsert({
        id: targetId,
        name: h.name,
        address: h.address,
        email: h.email,
        mobile_number: h.mobile_number,
        is_active: h.is_active,
        supported_sessions: h.supported_sessions,
        pass_limits: h.pass_limits,
        session_windows: h.session_windows,
        entry_windows: h.entry_windows || {},
        expiry_times: h.expiry_times || {}, // Save to snake_case
        auto_lottery_enabled: h.auto_lottery_enabled,
        auto_lottery_times: h.auto_lottery_times,
        company_pass_limit: h.company_pass_limit || {}
      }, { onConflict: 'id' }).select().single();
      
      if (error) {
        console.error("Supabase Hospital Save Error:", error);
        throw new Error(error.message);
      }

      if (data) {
        results.push({
          id: data.id,
          name: data.name,
          address: data.address,
          email: data.email,
          mobile_number: data.mobile_number,
          is_active: data.is_active,
          supported_sessions: data.supported_sessions,
          pass_limits: data.pass_limits,
          session_windows: data.session_windows,
          entry_windows: data.entry_windows,
          expiry_times: data.expiry_times,
          auto_lottery_enabled: data.auto_lottery_enabled,
          auto_lottery_times: data.auto_lottery_times,
          company_pass_limit: data.company_pass_limit
        });
      }
    }
    return results;
  },

  getHospitalUsers: async (): Promise<HospitalUser[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, hospital_id, mobile_number, role, full_name')
      .in('role', ['HOSPITAL_ADMIN', 'SECURITY']);
    if (error) throw error;
    return (data || []).map(u => ({
      id: u.id,
      hospital_id: u.hospital_id,
      mobile_number: u.mobile_number,
      password: '', // Do not fetch password
      role: u.role === 'HOSPITAL_ADMIN' ? 'ADMIN' : u.role as any,
      full_name: u.full_name
    }));
  },

  saveHospitalUsers: async (users: HospitalUser[]): Promise<HospitalUser[]> => {
    if (users.length === 0) return [];
    
    const results: HospitalUser[] = [];
    for (const u of users) {
      // CRITICAL FIX: New hospital users MUST have a password for authentication to work
      if (!u.id && !u.password) {
        throw new Error(`Cannot create new hospital user ${u.full_name}: password is required`);
      }
      
      const targetId = (u.id && u.id.length > 20) ? u.id : crypto.randomUUID();
      const profileUpdate: any = {
        id: targetId,
        hospital_id: u.hospital_id,
        mobile_number: u.mobile_number.trim(),
        role: u.role === 'ADMIN' ? 'HOSPITAL_ADMIN' : u.role,
        full_name: u.full_name
      };

      if (u.password) {
        profileUpdate.password = u.password.trim();
      }

      console.log(`[HospitalService] Upserting profile:`, { id: profileUpdate.id, role: profileUpdate.role, mobile: profileUpdate.mobile_number, hasPassword: !!profileUpdate.password });

      const { data, error } = await supabase.from('profiles').upsert(profileUpdate).select('id, role, mobile_number, full_name, password, hospital_id').single();
      
      if (error) {
        console.error(`[HospitalService] Upsert error for ${u.full_name}:`, error);
        throw error;
      }
      
      if (data) {
        results.push({
          id: data.id,
          hospital_id: data.hospital_id,
          mobile_number: data.mobile_number,
          password: '', // Never return password
          role: data.role === 'HOSPITAL_ADMIN' ? 'ADMIN' : data.role as any,
          full_name: data.full_name
        });
      }
    }
    return results;
  },
};
