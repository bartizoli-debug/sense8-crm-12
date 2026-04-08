'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted || !data.user) return;
      setEmail(data.user.email ?? null);

      // Try to load profile name
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('full_name, position')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (mounted && profile?.full_name) setFullName(profile.full_name);
    }

    loadUser();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) return null;

  const displayName = fullName ?? email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Link
      href="/profile"
      style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', borderRadius: 8, padding: '4px 4px', transition: 'background 120ms' }}
      title="My profile"
    >
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#f0fdf4', border: '1px solid #86efac',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#2DA745', flexShrink: 0,
      }}>
        {initial}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fullName ?? email}
        </div>
        {fullName && (
          <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </div>
        )}
      </div>
    </Link>
  );
}