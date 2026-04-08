'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '../components/PageHeader';

type Company = {
  id: string;
  company_name: string;
  country_of_registration: string | null;
  client_type: string | null;
  created_at: string;
};

const C = {
  text: '#111827',
  text2: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  bg: '#ffffff',
  soft: '#f9fafb',
  primary: '#2DA745',
  shadow: '0 1px 3px rgba(0,0,0,0.06)',
  shadowHover: '0 4px 12px rgba(0,0,0,0.08)',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any)
      .from('companies')
      .select('id, company_name, country_of_registration, client_type, created_at')
      .order('company_name', { ascending: true })
      .then(({ data }: any) => {
        setCompanies((data ?? []) as Company[]);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) => c.company_name.toLowerCase().includes(q));
  }, [companies, search]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Companies"
        subtitle={loading ? 'Loading…' : `${filtered.length} of ${companies.length} companies`}
        right={
          <Link
            href="/companies/new"
            style={{ height: 34, padding: '0 14px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'none', background: C.primary, color: '#fff' }}
          >
            + New Company
          </Link>
        }
      />

      {/* Search */}
      <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, color: C.text, background: 'transparent' }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color: C.muted, fontSize: 13 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: C.muted, fontSize: 13 }}>No companies found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {filtered.map((company) => {
            const hover = hoverId === company.id;
            const initials = company.company_name
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase();

            return (
              <Link
                key={company.id}
                href={`/companies/${company.id}`}
                onMouseEnter={() => setHoverId(company.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `1px solid ${hover ? '#d1d5db' : C.border}`,
                  background: hover ? C.soft : C.bg,
                  textDecoration: 'none',
                  transition: 'all 120ms ease',
                  boxShadow: hover ? C.shadowHover : C.shadow,
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#166534',
                }}>
                  {initials}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {company.company_name}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {company.country_of_registration ?? company.client_type ?? 'No details'}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: C.muted }}>
                  <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}