
import { supabase } from '../supabaseClient';
import { PharmaCompany } from '../types';
import { SessionService } from './SessionService';

export const CompanyService = {
  getCompanies: async (): Promise<PharmaCompany[]> => {
    // 1. Fetch companies
    const { data: companies, error: companyError } = await supabase.from('pharma_companies').select('*');
    if (companyError) throw companyError;

    // 2. Fetch associated profiles for companies to get admin credentials
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, mobile_number, role, full_name')
      .eq('role', 'COMPANY');
    
    if (profileError) throw profileError;

    // Added explicit Map type to avoid 'unknown' inference for profile values
    const profileMap = new Map<string, any>((profiles || []).map(p => [p.id, p]));

    return (companies || []).map(c => {
      const adminProfile = profileMap.get(c.id);
      return {
        id: c.id,
        name: c.name,
        company_code: c.company_code,
        address: c.address,
        contact_number: c.contact_number,
        finance_email: c.finance_email,
        contact_email: c.contact_email,
        is_active: c.is_active,
        // Map credentials back from the profiles table
        // Using explicit Map typing ensures these properties are accessible
        admin_mobile: adminProfile?.mobile_number || '', 
        admin_password: '' // Do not fetch password
      };
    });
  },

  saveCompanies: async (companies: PharmaCompany[]): Promise<PharmaCompany[]> => {
    const results: PharmaCompany[] = [];
    for (const c of companies) {
      // 1. Save company to pharma_companies table
      const { data: companyData, error: companyError } = await supabase.from('pharma_companies').upsert({
        ...(c.id && c.id.length > 20 ? { id: c.id } : {}),
        name: c.name,
        company_code: c.company_code,
        address: c.address,
        contact_number: c.contact_number,
        finance_email: c.finance_email,
        contact_email: c.contact_email,
        is_active: c.is_active
      }).select().single();

      if (companyError) {
        console.error("Error saving company record:", companyError);
        throw companyError;
      }

      if (companyData) {
        // 2. Save credentials to profiles table using the SAME UUID as the company
        // This ensures the App login logic correctly identifies the companyId
        // CRITICAL FIX: New companies must have a password set
        if (!c.id && !c.admin_password) {
          throw new Error(`Cannot create company ${c.name}: admin password is required`);
        }
        
        const profileUpdate: any = {
          id: companyData.id,
          role: 'COMPANY',
          full_name: `${companyData.name} Administrator`,
          mobile_number: c.admin_mobile.trim(),
        };

        if (c.admin_password) {
          profileUpdate.password = c.admin_password.trim();
        }

        console.log(`[CompanyService] Upserting company admin profile:`, { id: profileUpdate.id, role: profileUpdate.role, mobile: profileUpdate.mobile_number, hasPassword: !!profileUpdate.password });

        const { data: profileData, error: profileError } = await supabase.from('profiles').upsert(profileUpdate).select('id, role, mobile_number, full_name, password').single();

        if (profileError) {
          console.error("Error saving company admin profile:", profileError);
          throw profileError; // CRITICAL FIX: Throw error to prevent company without credentials
        }
        
        if (profileData) {
          console.log(`[CompanyService] Company admin profile saved. Returned password field:`, !!profileData.password);
        }

        results.push({
          id: companyData.id,
          name: companyData.name,
          company_code: companyData.company_code,
          address: companyData.address,
          contact_number: companyData.contact_number,
          finance_email: companyData.finance_email,
          contact_email: companyData.contact_email,
          is_active: companyData.is_active,
          admin_mobile: c.admin_mobile,
          admin_password: '' // Never return password
        });
      }
    }
    return results;
  },
};
