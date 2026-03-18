
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mbxbefmldndavkjftlzv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_pN_bO_hvI8eq2Bt9lHN6tQ_r0irnJ6b';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
