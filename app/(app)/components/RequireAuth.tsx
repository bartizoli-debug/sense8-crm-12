'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';


export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;

      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent(path)}`);
        return;
      }

      setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, [router, path]);

  if (!ready) return <div style={{ padding: 16 }}>Loading...</div>;
  return <>{children}</>;
}
