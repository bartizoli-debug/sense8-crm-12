'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '../components/PageHeader';

interface Profile {
  user_id: string;
  full_name: string | null;
  position: string | null;
  phone: string | null;
  bio: string | null;
  preferred_language: string | null;
}

const C = {
  text: '#111827',
  text2: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  bg: '#ffffff',
  soft: '#f9fafb',
  primary: '#2DA745',
  danger: '#991b1b',
  dangerSoft: '#fef2f2',
};

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ user_id: string; full_name: string | null; position: string | null; role?: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push('/login'); return; }

      setEmail(userData.user.email ?? null);
      setUserId(userData.user.id);

      // Try to load profile from profiles table
      const { data, error: pErr } = await (supabase as any)
        .from('profiles')
        .select('user_id, full_name, position, phone, bio, preferred_language')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (!pErr && data) {
        setProfile(data as Profile);
        setFullName(data.full_name ?? '');
        setPosition(data.position ?? '');
        setPhone(data.phone ?? '');
        setBio(data.bio ?? '');
        setPreferredLanguage(data.preferred_language ?? 'en');
      }

      // Load team - get org members + their profiles (if they exist)
      const { data: teamData } = await (supabase as any)
        .from('org_members')
        .select('user_id, role')
        .neq('user_id', userData.user.id)
        .limit(20);

      if (teamData && teamData.length > 0) {
        const userIds = teamData.map((m: any) => m.user_id);
        const { data: profilesData } = await (supabase as any)
          .from('profiles')
          .select('user_id, full_name, position')
          .in('user_id', userIds);

        // Merge: every org member shown, with profile data if available
        const profileMap: Record<string, any> = {};
        (profilesData ?? []).forEach((p: any) => { profileMap[p.user_id] = p; });

        const merged = teamData.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: profileMap[m.user_id]?.full_name ?? null,
          position: profileMap[m.user_id]?.position ?? m.role ?? null,
        }));
        setTeamMembers(merged);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setError(null);

    // Try update first, if no row exists then insert
    const updatePayload = {
      full_name: fullName.trim() || null,
      position: position.trim() || null,
      phone: phone.trim() || null,
      bio: bio.trim() || null,
      preferred_language: preferredLanguage,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await (supabase as any)
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    let saveError = null;
    if (existing) {
      const { error } = await (supabase as any)
        .from('profiles')
        .update(updatePayload)
        .eq('user_id', userId);
      saveError = error;
    } else {
      const { error } = await (supabase as any)
        .from('profiles')
        .insert({ user_id: userId, ...updatePayload });
      saveError = error;
    }

    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  const initial = email?.charAt(0).toUpperCase() ?? '?';

  if (loading) return <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>Loading…</div>;

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
      <PageHeader title="My Profile" subtitle="Manage your account details" />

      {/* Avatar + email */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#f0fdf4', border: '2px solid #86efac',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: C.primary, flexShrink: 0,
        }}>
          {initial}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{fullName || email}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{email}</div>
          {position && <div style={{ fontSize: 12, color: C.text2, marginTop: 2 }}>{position}</div>}
        </div>
      </div>

      {/* Profile form */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '20px 24px', display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 }}>
          Personal information
        </div>

        {error && (
          <div style={{ background: C.dangerSoft, color: C.danger, fontSize: 12, padding: '8px 12px', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Zoltan Barti"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.text }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Position</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="e.g. COO"
              style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.text }}
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Phone</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +40 700 000 000"
            style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.text }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Bio / Notes</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio or notes about yourself…"
            rows={3}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: C.text, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: C.muted, display: 'block', marginBottom: 5 }}>Preferred language</label>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value)}
            style={{ height: 36, padding: '0 10px', borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13, background: C.bg, color: C.text }}
          >
            <option value="en">English</option>
            <option value="ro">Romanian</option>
            <option value="hu">Hungarian</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 36, padding: '0 20px', borderRadius: 7, border: 'none',
              background: saved ? '#166534' : C.primary,
              color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 200ms',
            }}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Team */}
      {teamMembers.length > 0 && (
        <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 14 }}>
            Your team
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {teamMembers.map((m) => {
              const init = (m.full_name ?? '?').charAt(0).toUpperCase();
              return (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: '#f0f9ff', border: '1px solid #bae6fd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: '#0369a1',
                  }}>{init}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>
                      {m.full_name ?? <span style={{ color: C.muted, fontStyle: 'italic' }}>Profile not set up yet</span>}
                    </div>
                    {m.position && <div style={{ fontSize: 11, color: C.muted }}>{m.position}</div>}
                    {!m.position && m.role && <div style={{ fontSize: 11, color: C.muted, textTransform: 'capitalize' }}>{m.role}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Sign out</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Sign out from all devices</div>
        </div>
        <button
          onClick={handleLogout}
          style={{ height: 34, padding: '0 14px', borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text2, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}