import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseServiceKey = (rawServiceKey && !rawServiceKey.includes('YOUR_SERVICE_ROLE_KEY'))
  ? rawServiceKey
  : process.env.SUPABASE_ANON_KEY!;

// Cliente con service_role para operaciones privilegiadas del backend
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Cliente anon para operaciones de usuario
export const supabaseClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!);
