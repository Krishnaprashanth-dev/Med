
import express from 'express';
import { createServer as createViteServer } from 'vite';
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

  // API Routes
  app.post('/api/auth/login', async (req, res) => {
    const { mobile, password, role } = req.body;
    
    try {
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
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*, mrs(*, pharma_companies(name))')
        .eq('mobile_number', mobile);

      if (error) {
        console.error('[Supabase Query Error]', error);
        throw error;
      }
      if (!profiles || profiles.length === 0) {
        return res.status(401).json({ success: false, message: 'Invalid credentials. Account not found.' });
      }

      // 3. Verify password
      let matchedProfile = null;
      for (const p of profiles) {
        if (!p.password || typeof p.password !== 'string') continue;
        
        // Check if it's a bcrypt hash
        const isHash = p.password.startsWith('$2a$') || p.password.startsWith('$2b$');
        
        let isMatch = false;
        if (isHash) {
          try {
            isMatch = await bcrypt.compare(password, p.password);
          } catch (e) {
            // If compare fails (e.g. malformed hash), fallback to plain text check
            isMatch = password === p.password;
          }
        } else {
          // Plain text comparison
          isMatch = password === p.password;
        }
        
        if (isMatch) {
          matchedProfile = p;
          break;
        }
      }

      if (!matchedProfile) {
        return res.status(401).json({ success: false, message: 'Invalid password.' });
      }

      // 4. Role Validation
      let dbRole = role;
      if (role === 'ADMIN') dbRole = 'HOSPITAL_ADMIN';
      if (role === 'COMPANY_ADMIN') dbRole = 'COMPANY';

      const isSuperAdmin = matchedProfile.role === 'SUPER_ADMIN';
      const isCorrectPortal = matchedProfile.role === dbRole;

      if (!isSuperAdmin && !isCorrectPortal) {
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
        const isHash = p.password?.startsWith('$2a$') || p.password?.startsWith('$2b$');
        
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
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
