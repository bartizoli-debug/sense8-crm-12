export { createMockSupabaseClient } from './client';
export { resetMockDb, clearMockDb, snapshot } from './store';
export { DEMO_USER } from './seed';

/**
 * The in-memory database is used when it is explicitly switched on, or when
 * Supabase credentials are missing so the real client could not work anyway.
 */
export function isMockDbEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK_DB === 'true') return true;
  if (process.env.NEXT_PUBLIC_USE_MOCK_DB === 'false') return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
