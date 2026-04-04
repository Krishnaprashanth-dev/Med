
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://mbxbefmldndavkjftlzv.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_pN_bO_hvI8eq2Bt9lHN6tQ_r0irnJ6b';

console.log(`[Supabase Config] URL: ${supabaseUrl.substring(0, 15)}...`);
console.log(`[Supabase Config] Key: ${supabaseAnonKey.substring(0, 10)}...`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('WARNING: Supabase credentials missing. Authentication will fail.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV, vercel: !!process.env.VERCEL });
  });

// Notification Endpoints
  app.post('/api/notify-selection', async (req, res) => {
    const { mrIds, hospitalId, session, date } = req.body;
    
    if (!mrIds || !Array.isArray(mrIds) || !hospitalId || !session || !date) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    console.log(`[Notification] Sending selection emails for ${mrIds.length} MRs at ${hospitalId} - ${session}`);

    const results = await Promise.all(
      mrIds.map(mrId => emailService.sendLotterySelectionEmail(mrId, hospitalId, session, date))
    );

    const successCount = results.filter(r => r.success).length;
    res.json({ success: true, message: `Sent ${successCount}/${mrIds.length} emails.` });
  });

  app.post('/api/notify-replacement', async (req, res) => {
    const { mrId, hospitalId, session, date } = req.body;
    
    if (!mrId || !hospitalId || !session || !date) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    console.log(`[Notification] Sending replacement email for MR ${mrId} at ${hospitalId} - ${session}`);

    const result = await emailService.sendLotterySelectionEmail(mrId, hospitalId, session, date);
    res.json(result);
  });
  
  // API Routes
  app.post('/api/auth/login', async (req, res) => {
    let { mobile, password, role } = req.body;
    
    try {
      // Trim inputs to avoid whitespace issues
      mobile = typeof mobile === 'string' ? mobile.trim() : mobile;
      password = typeof password === 'string' ? password.trim() : password;

      console.log(`[Login Attempt] Mobile: ${mobile}, Role: ${role}`);
      
      // 1. Root Bypass (Securely handled on server)
      const rootId = process.env.VITE_SUPER_ADMIN_ID || 'root';
      const rootPass = process.env.VITE_SUPER_ADMIN_PASS || 'root';
      const altId = process.env.VITE_SUPER_ADMIN_ALT_ID || 'SUPER_ADMIN';
      const altPass = process.env.VITE_SUPER_ADMIN_ALT_PASS || '123456';

      if ((mobile === rootId && password === rootPass) || (mobile === altId && password === altPass)) {
        console.log('[Login] Root bypass successful');
        return res.json({
          success: true,
          user: {
            id: 'sa-root',
            role: 'SUPER_ADMIN',
            fullName: 'System Root Authority'
          }
        });
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration is missing on the server.');
      }

      // 2. Lookup user in Supabase
      // We check both mobile_number and full_name as "Identity"
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*, mrs(id, mr_code, mobile_number, company_id, status, created_at, identification_number, slcpi_id, slcpi_photo, slcpi_expiry, pharma_companies(name))')
        .or(`mobile_number.eq."${mobile}",full_name.eq."${mobile}"`);

      if (error) {
        console.error('[Supabase Query Error]', error);
        throw error;
      }
      if (!profiles || profiles.length === 0) {
        console.log(`[Login] No profiles found for identity: ${mobile}`);
        return res.status(401).json({ success: false, message: 'Invalid credentials. Account not found.' });
      }

      console.log(`[Login] Found ${profiles.length} profiles for identity: ${mobile}`);
      profiles.forEach(p => console.log(` - Profile: ${p.full_name}, Role: ${p.role}`));

      // 3. Verify password and find the best matching profile for the requested role
      let dbRole = role;
      if (role === 'ADMIN') dbRole = 'HOSPITAL_ADMIN';
      if (role === 'COMPANY_ADMIN') dbRole = 'COMPANY';

      console.log(`[Login] Requested Role: ${role} (DB Role: ${dbRole})`);

      let matchedProfile = null;
      let passwordMatchFound = false;

      for (const p of profiles) {
        if (!p.password || typeof p.password !== 'string') continue;
        
        // Check if it's a bcrypt hash
        const isHash = p.password.startsWith('$2a$') || p.password.startsWith('$2b$') || p.password.startsWith('$2y$');
        
        let isMatch = false;
        if (isHash) {
          try {
            isMatch = await bcrypt.compare(password, p.password);
          } catch (e) {
            isMatch = password === p.password;
          }
        } else {
          isMatch = password === p.password;
        }
        
        if (isMatch) {
          passwordMatchFound = true;
          console.log(`[Login] Password matched for profile: ${p.full_name} (${p.role})`);
          // If this profile matches the requested role or is a Super Admin, it's the perfect match
          if (p.role === dbRole || p.role === 'SUPER_ADMIN') {
            matchedProfile = p;
            console.log(`[Login] Perfect role match found: ${p.role}`);
            break; 
          }
          // Otherwise, keep it as a backup in case we don't find a better role match
          if (!matchedProfile) {
            matchedProfile = p;
          }
        }
      }

      if (!passwordMatchFound) {
        console.log(`[Login] Password mismatch for all found profiles`);
        return res.status(401).json({ success: false, message: 'Invalid password.' });
      }

      if (!matchedProfile) {
        return res.status(401).json({ success: false, message: 'Authentication failed.' });
      }

      // 4. Role Validation
      const isSuperAdmin = matchedProfile.role === 'SUPER_ADMIN';
      const isCorrectPortal = matchedProfile.role === dbRole;

      if (!isSuperAdmin && !isCorrectPortal) {
        console.log(`[Login] Role mismatch: User is ${matchedProfile.role}, trying to access ${dbRole}`);
        return res.status(403).json({ 
          success: false, 
          message: `This account is registered as ${matchedProfile.role}. Please use the correct portal.` 
        });
      }

      // 5. Map role back for UI
      let finalRole = role;
      if (matchedProfile.role === 'SUPER_ADMIN') finalRole = 'SUPER_ADMIN';
      else if (matchedProfile.role === 'HOSPITAL_ADMIN') finalRole = 'ADMIN';
      else if (matchedProfile.role === 'COMPANY') finalRole = 'COMPANY_ADMIN';
      else if (matchedProfile.role === 'SECURITY') finalRole = 'SECURITY';
      else finalRole = 'MR';

      const mrData = Array.isArray(matchedProfile.mrs) ? matchedProfile.mrs[0] : matchedProfile.mrs;

      console.log(`[Login] MR Data for ${matchedProfile.full_name}:`, {
        mrExists: !!mrData,
        companyId: mrData?.company_id,
        companyName: mrData?.pharma_companies?.name
      });

      // Return user WITHOUT password hash
      const user = {
        id: matchedProfile.id,
        role: finalRole,
        fullName: matchedProfile.full_name,
        hospitalId: matchedProfile.hospital_id,
        mobileNumber: matchedProfile.mobile_number,
        loginId: matchedProfile.mobile_number,
        companyId: matchedProfile.role === 'COMPANY' ? matchedProfile.id : mrData?.company_id,
        companyName: mrData?.pharma_companies?.name || undefined
      };

      console.log(`[Login] Final User Object:`, { id: user.id, role: user.role, companyId: user.companyId });

      res.json({ success: true, user });
    } catch (err: any) {
      console.error('Auth Error:', err);
      // Log more details to help debugging
      if (err.code) console.error('Error Code:', err.code);
      if (err.details) console.error('Error Details:', err.details);
      if (err.hint) console.error('Error Hint:', err.hint);
      
      const errorMessage = err.message || 'Authentication failed. Server error.';
      res.status(500).json({ 
        success: false, 
        message: errorMessage,
        debug: process.env.NODE_ENV !== 'production' ? err.stack : {
          code: err.code,
          details: err.details
        }
      });
    }
  });

  // Audit Endpoint (Super Admin only - in a real app this would need session/token validation)
  app.get('/api/admin/audit-users', async (req, res) => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, mobile_number, password');

      if (error) throw error;

      const auditResults = profiles.map(p => {
        const hasPassword = !!p.password;
        const isHash = p.password?.startsWith('$2a$') || p.password?.startsWith('$2b$') || p.password?.startsWith('$2y$');
        
        return {
          id: p.id,
          fullName: p.full_name,
          role: p.role,
          mobile: p.mobile_number,
          hasPassword,
          isHash,
          // We can't know if it's double hashed, but we can flag suspicious ones
          // e.g. if the mobile number itself is the password (unlikely to be a hash)
          status: hasPassword ? (isHash ? 'Secure Hash' : 'Plain Text (Vulnerable)') : 'No Password'
        };
      });

      res.json(auditResults);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn('Vite could not be initialized:', e);
    }
  } else if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

// Export for Vercel
const appPromise = startServer();
export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};
