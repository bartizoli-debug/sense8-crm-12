// Re-export from canonical client — do not create a second instance here
export { supabase, getSupabaseClient } from '@/lib/supabaseClient';
export type { SupabaseClient } from '@supabase/supabase-js';