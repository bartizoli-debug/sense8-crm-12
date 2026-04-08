import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = createSupabaseServer();
  await supabase.auth.signOut();

  // Redirect back to /login on the same host (works in StackBlitz + prod + localhost)
  const url = new URL('/login', req.url);
  return NextResponse.redirect(url, { status: 303 });
}
