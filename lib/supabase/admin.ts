import { createClient } from '@supabase/supabase-js';
import { createMockSupabaseClient, isMockDbEnabled } from '@/lib/mock';

export function createSupabaseAdmin() {
  if (isMockDbEnabled()) return createMockSupabaseClient();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}
