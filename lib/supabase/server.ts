import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createMockSupabaseClient, isMockDbEnabled } from '@/lib/mock';

export function createSupabaseServer() {
  // The in-memory database lives in the browser, so server-side calls (the
  // /logout route) get a client that succeeds and does nothing.
  if (isMockDbEnabled()) return createMockSupabaseClient();

  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Next.js App Router requires try/catch here (can throw in some contexts)
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // safe to ignore in server components
          }
        },
      },
    }
  );
}
