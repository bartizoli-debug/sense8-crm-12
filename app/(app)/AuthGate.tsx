'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';


export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!alive) return;

      if (!session) {
        const next = encodeURIComponent(pathname + (sp?.toString() ? `?${sp.toString()}` : ''));
        window.location.href = `/login?next=${next}`;
        return;
      }

      setReady(true);
    }

    check();

    // also react to login/logout events
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [pathname, sp]);

  if (!ready) {
    return (
      <div style={{ padding: 24, color: '#6b7280', fontSize: 14 }}>
        Checking session…
      </div>
    );
  }

  return <>{children}</>;
}
