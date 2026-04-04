
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mbxbefmldndavkjftlzv.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_pN_bO_hvI8eq2Bt9lHN6tQ_r0irnJ6b';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const emailService = {
  sendLotterySelectionEmail: async (mrId: string, hospitalId: string, session: string, date: string) => {
    try {
      // 1. Fetch MR details
      const { data: mr, error: mrError } = await supabase
        .from('mrs')
        .select('*, profiles(full_name)')
        .eq('id', mrId)
        .single();

      if (mrError || !mr) {
        console.error(`[Email Service] Error fetching MR ${mrId}:`, mrError);
        return { success: false, error: 'MR not found' };
      }

      const mrEmail = mr.email;
      const mrName = mr.profiles?.full_name;

      if (!mrEmail) {
        console.warn(`[Email Service] MR ${mrId} has no email address.`);
        return { success: false, error: 'MR email not found' };
      }

      // 2. Fetch Hospital details
      const { data: hospital, error: hospError } = await supabase
        .from('hospitals')
        .select('*')
        .eq('id', hospitalId)
        .single();

      if (hospError || !hospital) {
        console.error(`[Email Service] Error fetching Hospital ${hospitalId}:`, hospError);
        return { success: false, error: 'Hospital not found' };
      }

      const scanWindow = hospital.entry_windows?.[session] || { start: 'N/A', end: 'N/A' };
      const sessionWindow = hospital.session_windows?.[session] || { start: 'N/A', end: 'N/A' };

      // 3. Send Email
      const { data, error } = await resend.emails.send({
        from: 'MedPass <notifications@medpass.system>',
        to: [mrEmail],
        subject: `Lottery Selection: ${hospital.name} - ${session} Session`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">Congratulations, ${mrName}!</h2>
            <p>You have been selected in the lottery for a visiting pass at <strong>${hospital.name}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; font-size: 16px; color: #1e293b;">Session Details:</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>Date:</strong> ${date}</li>
                <li><strong>Session:</strong> ${session}</li>
                <li><strong>Session Time:</strong> ${sessionWindow.start} - ${sessionWindow.end}</li>
              </ul>
              
              <h3 style="margin-top: 20px; font-size: 16px; color: #1e293b;">Scanning Window:</h3>
              <p style="margin-bottom: 0;">Please ensure you scan your QR code at the gate during this time period to gain entry:</p>
              <p style="font-size: 18px; font-weight: bold; color: #4f46e5; margin-top: 8px;">${scanWindow.start} - ${scanWindow.end}</p>
            </div>
            
            <p style="font-size: 14px; color: #64748b;">Please log in to the MedPass app to view your QR code and session details.</p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">MedPass v3.5 Security Protocol</p>
          </div>
        `,
      });

      if (error) {
        console.error(`[Email Service] Resend error for ${mrEmail}:`, error);
        return { success: false, error: error.message };
      }

      console.log(`[Email Service] Email sent successfully to ${mrEmail}`);
      return { success: true, data };
    } catch (err: any) {
      console.error(`[Email Service] Unexpected error:`, err);
      return { success: false, error: err.message };
    }
  }
};
