
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
      mobileNumber: h.mobile_number,
      isActive: h.is_active,
      supportedSessions: h.supported_sessions,
      passLimits: h.pass_limits,
      sessionWindows: h.session_windows,
      entryWindows: h.entry_windows,
      expiryTimes: h.expiry_times,
      autoLotteryEnabled: h.auto_lottery_enabled,
      autoLotteryTimes: h.auto_lottery_times
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
        mobile_number: h.mobileNumber,
        is_active: h.isActive,
        supported_sessions: h.supportedSessions,
        pass_limits: h.passLimits,
        session_windows: h.sessionWindows,
        entry_windows: h.entryWindows || {},
        expiry_times: h.expiryTimes || {}, // Save to snake_case
        auto_lottery_enabled: h.autoLotteryEnabled,
        auto_lottery_times: h.autoLotteryTimes
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
          mobileNumber: data.mobile_number,
          isActive: data.is_active,
          supportedSessions: data.supported_sessions,
          passLimits: data.pass_limits,
          sessionWindows: data.session_windows,
          entryWindows: data.entry_windows,
          expiryTimes: data.expiry_times,
          autoLotteryEnabled: data.auto_lottery_enabled,
          autoLotteryTimes: data.auto_lottery_times
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
      hospitalId: u.hospital_id,
      mobileNumber: u.mobile_number,
      password: '', // Do not fetch password
      role: u.role === 'HOSPITAL_ADMIN' ? 'ADMIN' : u.role as any,
      fullName: u.full_name
    }));
  },

  saveHospitalUsers: async (users: HospitalUser[]): Promise<HospitalUser[]> => {
    if (users.length === 0) return [];
    
    const results: HospitalUser[] = [];
    for (const u of users) {
      // CRITICAL FIX: New hospital users MUST have a password for authentication to work
      if (!u.id && !u.password) {
        throw new Error(`Cannot create new hospital user ${u.fullName}: password is required`);
      }
      
      const targetId = (u.id && u.id.length > 20) ? u.id : crypto.randomUUID();
      const profileUpdate: any = {
        id: targetId,
        hospital_id: u.hospitalId,
        mobile_number: u.mobileNumber,
        login_id: u.mobileNumber.trim(), // For admins, mobileNumber is usually the login ID
        role: u.role === 'ADMIN' ? 'HOSPITAL_ADMIN' : u.role,
        full_name: u.fullName
      };

      if (u.password) {
        profileUpdate.password = u.password.trim();
      }

      console.log(`[HospitalService] Upserting profile:`, { id: profileUpdate.id, role: profileUpdate.role, mobile: profileUpdate.mobile_number, hasPassword: !!profileUpdate.password });

      const { data, error } = await supabase.from('profiles').upsert(profileUpdate).select('id, role, mobile_number, full_name, password, hospital_id').single();
      
      if (error) {
        console.error(`[HospitalService] Upsert error for ${u.fullName}:`, error);
        throw error;
      }
      
      if (data) {
        results.push({
          id: data.id,
          hospitalId: data.hospital_id,
          mobileNumber: data.mobile_number,
          password: '', // Never return password
          role: data.role === 'HOSPITAL_ADMIN' ? 'ADMIN' : data.role as any,
          fullName: data.full_name
        });
      }
    }
    return results;
  },
};
