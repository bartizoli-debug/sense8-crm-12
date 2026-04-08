'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'magic'>('password');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/';

  // ✅ if already logged in, don't show login form
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace(next);
        router.refresh();
      }
    })();
    return () => {
      mounted = false;
    };
  }, [next, router]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (mode === 'magic') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}${next}`,
          },
        });
        if (error) throw error;
        setMsg('Check your email for the login link.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      router.replace(next);
      router.refresh();
    } catch (err: any) {
      setMsg(err?.message ?? 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>CRM Login</h1>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => setMode('password')} disabled={loading} style={{ padding: 8 }}>
          Password
        </button>
        <button onClick={() => setMode('magic')} disabled={loading} style={{ padding: 8 }}>
          Magic link
        </button>
      </div>

      <form onSubmit={signIn} style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          type="email"
          required
          style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
        />

        {mode === 'password' && (
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            required
            style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 10 }}
          />
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 10,
            borderRadius: 10,
            border: '1px solid #111827',
            background: '#111827',
            color: 'white',
            fontWeight: 600,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>

        {msg && <p style={{ color: '#6b7280' }}>{msg}</p>}
      </form>
    </div>
  );
}
