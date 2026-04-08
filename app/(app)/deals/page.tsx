'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '../components/PageHeader';

type Deal = {
  id: string;
  created_at: string;
  company_id: string | null;
  company_name: string | null;
  deal_name: string;
  value: number | null;
  stage: string | null;
  owner: string | null;
  is_renewal: boolean | null;
  original_contract_id: number | null;

  // next-step fields
  next_step: string | null;
  follow_up_date: string | null; // YYYY-MM-DD
  expected_close_date: string | null;
};

const STAGES = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];

const UI = {
  text: '#0f172a',
  text2: '#475569',
  secondary: '#475569',
  muted: '#64748b',
  border: '#e1e4e8',
  borderLight: '#f1f3f5',
  bg: '#ffffff',
  soft: '#f8f9fa',
  rowHover: '#f8f9fa',
  link: '#2563eb',
  primaryBtn: '#2DA745',
  primaryBtnHover: '#27923d',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 8px rgba(0, 0, 0, 0.08)',
};

const FW = {
  title: 700,
  strong: 600,
  normal: 500,
  body: 500,
};

const H = 42;

// ----- Role/claim helpers (client-side UI gating) -----
function getRoleFromSession(session: any): string | null {
  const u = session?.user;
  if (!u) return null;

  // Common patterns people use in Supabase:
  // - app_metadata.role / app_metadata.roles
  // - app_metadata.crm_role
  // - user_metadata.role
  const role =
    u?.app_metadata?.crm_role ??
    u?.app_metadata?.role ??
    u?.user_metadata?.crm_role ??
    u?.user_metadata?.role ??
    null;

  if (Array.isArray(role)) return role[0] ?? null;
  return typeof role === 'string' ? role : null;
}

function canCreateDeals(role: string | null) {
  // Adjust if your claim naming differs.
  return ['admin', 'editor', 'manager', 'sales'].includes((role ?? '').toLowerCase());
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${UI.border}`,
        background: UI.bg,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ButtonLink({
  href,
  children,
  variant = 'secondary',
  title,
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  title?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const base: React.CSSProperties = {
    height: H,
    padding: '0 14px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    textDecoration: 'none',
    boxSizing: 'border-box',
    transition: 'all 150ms ease',
  };

  const style: React.CSSProperties =
    variant === 'primary'
      ? {
          ...base,
          border: 'none',
          background: 'linear-gradient(to right, #2DA745 0%, #27923d 100%)',
          color: '#fff',
          boxShadow: '0 2px 4px rgba(45, 167, 69, 0.2)',
        }
      : { ...base, border: `1px solid ${UI.border}`, background: isHovered ? UI.soft : '#fff', color: UI.text };

  return (
    <Link
      href={href}
      style={style}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </Link>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        height: H,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid #d1d5db',
        outline: 'none',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.01em',
        color: UI.text,
        background: '#fff',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        height: H,
        padding: '0 12px',
        borderRadius: 8,
        border: '1px solid #d1d5db',
        background: '#fff',
        fontWeight: 700,
        letterSpacing: '0.01em',
        fontSize: 14,
        color: UI.text,
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      {children}
    </select>
  );
}

function Pill({ children, style, title }: { children: React.ReactNode; style?: React.CSSProperties; title?: string }) {
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: FW.strong,
        whiteSpace: 'nowrap',
        border: `1px solid ${UI.border}`,
        background: '#fff',
        color: UI.text,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function stagePill(stage: string | null) {
  const s = (stage ?? '—').toLowerCase();
  if (s === 'won') return { border: '#86efac', bg: '#f0fdf4', fg: '#166534' };
  if (s === 'proposal') return { border: '#93c5fd', bg: '#eff6ff', fg: '#1d4ed8' };
  if (s === 'qualified') return { border: '#a7f3d0', bg: '#ecfdf5', fg: '#065f46' };
  if (s === 'lead') return { border: '#e5e7eb', bg: '#f9fafb', fg: UI.secondary };
  if (s === 'lost') return { border: '#fecaca', bg: '#fff1f2', fg: '#991b1b' };
  return { border: UI.border, bg: '#fff', fg: UI.secondary };
}

export default function DealsPage() {
  const searchParams = useSearchParams();
  const companyIdFromUrl = searchParams?.get('companyId') || '';

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState(companyIdFromUrl);

  const [hoverId, setHoverId] = useState<string | null>(null);

  // NEW: role/claim gating
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    async function loadAuthAndDeals() {
      setLoading(true);
      setLoadError(null);

      // auth (UI gating)
      const { data: sessionData } = await supabase.auth.getSession();
      const r = getRoleFromSession(sessionData?.session);
      setRole(r);

      // deals
      const { data, error } = await supabase
        .from('deals')
        .select(
          'id, created_at, company_id, company_name, deal_name, value, stage, owner, is_renewal, original_contract_id, next_step, follow_up_date, expected_close_date'
        )
        .order('created_at', { ascending: false });

      if (error) {
        setLoadError(error.message);
        setDeals([]);
        setLoading(false);
        return;
      }

      setDeals((data ?? []) as Deal[]);
      setLoading(false);
    }

    loadAuthAndDeals();
  }, []);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const d of deals) {
      const o = (d.owner ?? '').trim();
      if (o) set.add(o);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [deals]);

  // Company name for active filter banner
  const activeCompanyName = useMemo(() => {
    if (!companyFilter) return null;
    return deals.find((d) => d.company_id === companyFilter)?.company_name ?? null;
  }, [companyFilter, deals]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();

    return deals.filter((d) => {
      if (companyFilter && (d.company_id ?? '') !== companyFilter) return false;
      if (ownerFilter && (d.owner ?? '') !== ownerFilter) return false;
      if (stageFilter && (d.stage ?? '') !== stageFilter) return false;

      if (q) {
        const hay = `${d.deal_name ?? ''} ${d.company_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [deals, ownerFilter, stageFilter, search, companyFilter]);

  const canCreate = canCreateDeals(role);

  return (
    <div
      style={{
        padding: 16,
        boxSizing: 'border-box',
        background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)',
        minHeight: '100vh',
      }}
    >
      <PageHeader
        title="Deals"
        subtitle={`${filteredDeals.length} / ${deals.length} shown`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {!canCreate ? (
              <Pill
                style={{ borderColor: UI.border, background: UI.soft, color: UI.muted }}
                title={`Read-only: your role/claim (${role ?? 'none'}) does not allow creating deals.`}
              >
                Read-only
              </Pill>
            ) : null}

            {canCreate ? (
              <ButtonLink href="/deals/new" variant="primary">
                + New Deal
              </ButtonLink>
            ) : null}

            <ButtonLink href="/pipeline">Pipeline</ButtonLink>
          </div>
        }
      />

      {activeCompanyName && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 14px',
            borderRadius: 10,
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1e40af',
            fontSize: 13,
            fontWeight: FW.strong,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span>Showing deals for: {activeCompanyName}</span>
          <button
            type="button"
            onClick={() => setCompanyFilter('')}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'transparent',
              color: '#1e40af',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: FW.strong,
              padding: '2px 6px',
            }}
          >
            ✕ Clear filter
          </button>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <Card
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <div style={{ flex: '1 1 360px', minWidth: 240 }}>
            <Input value={search} onChange={setSearch} placeholder="Search deal or company…" />
          </div>

          <div style={{ flex: '0 1 220px', minWidth: 180 }}>
            <Select value={ownerFilter} onChange={setOwnerFilter}>
              <option value="">All owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <div style={{ flex: '0 1 220px', minWidth: 180 }}>
            <Select value={stageFilter} onChange={setStageFilter}>
              <option value="">All stages</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      </div>

      {loadError ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#991b1b',
            fontWeight: FW.strong,
          }}
        >
          Error loading deals: {loadError}
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        {loading ? (
          <div style={{ fontSize: 13, color: UI.muted }}>Loading…</div>
        ) : filteredDeals.length === 0 ? (
          <div style={{ fontSize: 13, color: UI.muted }}>No deals match these filters.</div>
        ) : (
          <div style={{ border: `1px solid ${UI.border}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                <thead>
                  <tr style={{ background: UI.soft }}>
                    {['Deal', 'Company', 'Stage', 'Status', 'Owner', 'Value', 'Expected close', 'Follow-up', ''].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          fontSize: 12,
                          color: UI.muted,
                          padding: 12,
                          borderBottom: `1px solid ${UI.border}`,
                          fontWeight: FW.strong,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {filteredDeals.map((d) => {
                    const isHover = hoverId === d.id;
                    const st = stagePill(d.stage);

                    return (
                      <tr
                        key={d.id}
                        onMouseEnter={() => setHoverId(d.id)}
                        onMouseLeave={() => setHoverId(null)}
                        style={{
                          background: isHover ? UI.soft : '#fff',
                          transition: 'background 120ms ease',
                        }}
                      >
                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          <Link href={`/deals/${d.id}`} style={{ color: UI.text, fontWeight: FW.strong, textDecoration: 'none' }}>
                            {d.deal_name}
                          </Link>
                          {d.is_renewal && (
                            <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>Renewal</span>
                          )}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          {d.company_id ? (
                            <Link href={`/companies/${d.company_id}`} style={{ color: UI.link, textDecoration: 'none', fontWeight: FW.normal }}>
                              {d.company_name ?? 'Company'}
                            </Link>
                          ) : (
                            <span style={{ color: UI.muted }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          <Pill style={{ borderColor: st.border, background: st.bg, color: st.fg }}>{d.stage ?? '—'}</Pill>
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          {d.stage === 'Won' ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>Won</span>
                          ) : d.stage === 'Lost' ? (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b' }}>Lost</span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#eff6ff', color: '#1e40af' }}>Active</span>
                          )}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          {d.owner ? <span style={{ fontWeight: FW.normal, color: UI.text }}>{d.owner}</span> : <span style={{ color: UI.muted }}>—</span>}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          {typeof d.value === 'number' ? (
                            <span style={{ fontWeight: FW.strong, color: UI.text }}>{d.value.toLocaleString()}</span>
                          ) : (
                            <span style={{ color: UI.muted }}>—</span>
                          )}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', color: UI.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '—'}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          {d.follow_up_date ? (() => {
                            const today = new Date(); today.setHours(0,0,0,0);
                            const due = new Date(d.follow_up_date); due.setHours(0,0,0,0);
                            const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
                            const overdue = days < 0;
                            return (
                              <span style={{ fontSize: 11, fontWeight: overdue ? 700 : 400, color: overdue ? '#991b1b' : UI.muted }}>
                                {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : new Date(d.follow_up_date).toLocaleDateString()}
                              </span>
                            );
                          })() : <span style={{ color: UI.muted }}>—</span>}
                        </td>

                        <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>
                          <ButtonLink href={`/deals/${d.id}`} title="Open deal">
                            Open
                          </ButtonLink>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}