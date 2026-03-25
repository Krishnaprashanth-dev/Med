
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
        companyCode: c.company_code,
        address: c.address,
        contactNumber: c.contact_number,
        financeEmail: c.finance_email,
        contactEmail: c.contact_email,
        isActive: c.is_active,
        // Map credentials back from the profiles table
        // Using explicit Map typing ensures these properties are accessible
        adminMobile: adminProfile?.mobile_number || '', 
        adminPassword: '' // Do not fetch password
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
        company_code: c.companyCode,
        address: c.address,
        contact_number: c.contactNumber,
        finance_email: c.financeEmail,
        contact_email: c.contactEmail,
        is_active: c.isActive
      }).select().single();

      if (companyError) {
        console.error("Error saving company record:", companyError);
        throw companyError;
      }

      if (companyData) {
        // 2. Save credentials to profiles table using the SAME UUID as the company
        // This ensures the App login logic correctly identifies the companyId
        // CRITICAL FIX: New companies must have a password set
        if (!c.id && !c.adminPassword) {
          throw new Error(`Cannot create company ${c.name}: admin password is required`);
        }
        
        const profileUpdate: any = {
          id: companyData.id,
          role: 'COMPANY',
          full_name: `${companyData.name} Administrator`,
          mobile_number: c.adminMobile,
          login_id: c.adminMobile.trim(), // For companies, adminMobile is the login ID
        };

        if (c.adminPassword) {
          profileUpdate.password = await SessionService.hashPassword(c.adminPassword.trim());
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
          companyCode: companyData.company_code,
          address: companyData.address,
          contactNumber: companyData.contact_number,
          financeEmail: companyData.finance_email,
          contactEmail: companyData.contact_email,
          isActive: companyData.is_active,
          adminMobile: c.adminMobile,
          adminPassword: '' // Never return password
        });
      }
    }
    return results;
  },
};
