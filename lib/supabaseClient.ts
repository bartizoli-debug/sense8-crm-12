// ✅ CANONICAL SUPABASE CLIENT
// Uses 'any' as the Database generic to bypass strict generated types.
// This is intentional — the project does not use a generated Database type file.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Typed as 'any' so all .from() calls accept plain objects without type errors.
let _client: SupabaseClient<any> | null = null;

export function getSupabaseClient(): SupabaseClient<any> {
  if (_client) return _client;
  _client = createClient<any>(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export const supabase: SupabaseClient<any> = getSupabaseClient();