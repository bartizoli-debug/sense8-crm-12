'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type EntityType = 'company' | 'deal' | 'contract' | 'contact';

type ResultRow = {
  type: EntityType;
  id: string;
  title: string;
  subtitle?: string | null;
  href: string;
};

const ui = {
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  text2: '#4b5563',
  muted: '#6b7280',
  bg: '#ffffff',
  bgHover: '#f9fafb',
  shadowLg: '0 8px 24px rgba(0, 0, 0, 0.12)',
};

const panel: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 560,
  maxWidth: 'min(92vw, 560px)',
  borderRadius: 12,
  border: `1px solid ${ui.border}`,
  background: ui.bg,
  boxShadow: ui.shadowLg,
  overflow: 'hidden',
  zIndex: 60,
};

const rowBase: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 12px',
  textDecoration: 'none',
  cursor: 'pointer',
  borderTop: `1px solid ${ui.borderLight}`,
};

const rowTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: ui.text,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const rowSubtitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: ui.text2,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const footerHint: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 11,
  color: ui.muted,
  background: '#fafbfc',
  borderTop: `1px solid ${ui.border}`,
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
};

function useDebouncedValue<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function groupLabel(t: EntityType) {
  if (t === 'company') return 'Companies';
  if (t === 'deal') return 'Deals';
  if (t === 'contract') return 'Contracts';
  return 'Contacts';
}

// Subtle category accents (corporate clean)
function accent(t: EntityType) {
  if (t === 'company') return { bar: '#2DA745', bg: '#f2fbf4' };
  if (t === 'deal') return { bar: '#2563eb', bg: '#f2f6ff' };
  if (t === 'contract') return { bar: '#7c3aed', bg: '#f7f2ff' };
  return { bar: '#0f766e', bg: '#effaf9' };
}

function SectionHeader({ type }: { type: EntityType }) {
  const a = accent(type);
  return (
    <div
      style={{
        padding: '10px 12px',
        fontSize: 11,
        fontWeight: 800,
        color: ui.muted,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        borderTop: `1px solid ${ui.borderLight}`,
        background: a.bg,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: a.bar,
          boxShadow: '0 0 0 3px rgba(0,0,0,0.03)',
          flexShrink: 0,
        }}
      />
      <span>{groupLabel(type)}</span>
    </div>
  );
}

async function safeQuery<T>(fn: () => PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  try {
    const { data, error } = await fn();
    if (error) return (null as any);
    return (data as any) ?? (null as any);
  } catch {
    return (null as any);
  }
}

export default function GlobalSearch({
  query,
  onResultClick,
}: {
  query: string;
  onResultClick?: () => void;
}) {
  const router = useRouter();
  const q = useDebouncedValue(query.trim(), 160);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [active, setActive] = useState(0);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!q) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const like = `%${q}%`;

      const companies = await safeQuery<any[]>(() =>
        supabase
          .from('companies')
          .select('id, company_name, legal_name, email')
          .or(`company_name.ilike.${like},legal_name.ilike.${like},email.ilike.${like}`)
          .limit(6),
      );

      const deals = await safeQuery<any[]>(() =>
        supabase
          .from('deals')
          .select('id, deal_name, company_name, contract_number, stage')
          .or(`deal_name.ilike.${like},company_name.ilike.${like},contract_number.ilike.${like}`)
          .limit(6),
      );

      const contracts = await safeQuery<any[]>(() =>
        supabase
          .from('contracts')
          .select('id, contract_number, company_name, status, contract_owner')
          .or(`contract_number.ilike.${like},company_name.ilike.${like},contract_owner.ilike.${like}`)
          .limit(6),
      );

      const contacts = await safeQuery<any[]>(() =>
        supabase
          .from('contacts')
          .select('id, full_name, email, job_title')
          .or(`full_name.ilike.${like},email.ilike.${like},first_name.ilike.${like},last_name.ilike.${like}`)
          .limit(6),
      );

      if (cancelled || !mountedRef.current) return;

      const out: ResultRow[] = [];

      (companies ?? []).forEach((c: any) => {
        if (!c?.id) return;
        const title = c.company_name ?? c.legal_name ?? `Company ${c.id}`;
        const subtitle = c.email ?? c.legal_name ?? null;
        out.push({ type: 'company', id: String(c.id), title, subtitle, href: `/companies/${c.id}` });
      });

      (deals ?? []).forEach((d: any) => {
        if (!d?.id) return;
        const title = d.deal_name ?? `Deal ${d.id}`;
        const subtitleParts = [d.company_name, d.contract_number ? `#${d.contract_number}` : null].filter(Boolean);
        const subtitle = subtitleParts.length ? subtitleParts.join(' · ') : null;
        out.push({ type: 'deal', id: String(d.id), title, subtitle, href: `/deals/${d.id}` });
      });

      (contracts ?? []).forEach((c: any) => {
        if (!c?.id) return;
        const title = c.contract_number ? `Contract ${c.contract_number}` : `Contract ${c.id}`;
        const subtitleParts = [c.company_name, c.status].filter(Boolean);
        const subtitle = subtitleParts.length ? subtitleParts.join(' · ') : null;
        out.push({ type: 'contract', id: String(c.id), title, subtitle, href: `/contracts/${c.id}` });
      });

      (contacts ?? []).forEach((c: any) => {
        if (!c?.id) return;
        const title = c.full_name ?? `Contact ${c.id}`;
        const subtitleParts = [c.email, c.job_title].filter(Boolean);
        const subtitle = subtitleParts.length ? subtitleParts.join(' · ') : null;
        out.push({ type: 'contact', id: String(c.id), title, subtitle, href: `/contacts/${c.id}` });
      });

      setRows(out);
      setLoading(false);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [q]);

  const grouped = useMemo(() => {
    const g: Record<EntityType, ResultRow[]> = {
      company: [],
      deal: [],
      contract: [],
      contact: [],
    };
    rows.forEach((r) => g[r.type].push(r));
    return g;
  }, [rows]);

  const flat = useMemo(() => rows, [rows]);

  // Keyboard quick-jump
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!flat.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((cur) => Math.min(cur + 1, flat.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((cur) => Math.max(cur - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const target = flat[Math.max(0, Math.min(active, flat.length - 1))];
        if (target?.href) {
          onResultClick?.();
          router.push(target.href);
        }
      }
    }

    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [flat, active, router, onResultClick]);

  const anyResults = rows.length > 0;

  function renderGroup(type: EntityType) {
    const list = grouped[type];
    if (!list.length) return null;

    const a = accent(type);

    return (
      <>
        <SectionHeader type={type} />
        {list.map((r) => {
          const idx = flat.findIndex((x) => x.type === r.type && x.id === r.id);
          const isActive = idx === active;

          return (
            <Link
              key={`${r.type}:${r.id}`}
              href={r.href}
              onClick={() => onResultClick?.()}
              style={{
                ...rowBase,
                background: isActive ? ui.bgHover : ui.bg,
                borderLeft: `3px solid ${a.bar}`,
                paddingLeft: 10,
                outline: isActive ? `2px solid rgba(0, 0, 0, 0.06)` : 'none',
                outlineOffset: -2,
              }}
              onMouseEnter={() => setActive(idx)}
            >
              <div style={rowTitle}>{r.title}</div>
              {r.subtitle ? <div style={rowSubtitle}>{r.subtitle}</div> : null}
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div style={panel} role="dialog" aria-label="Global search results">
      <div style={{ padding: '10px 12px', fontSize: 12, color: ui.text2, fontWeight: 600 }}>
        {loading ? 'Searching…' : anyResults ? `${rows.length} result${rows.length === 1 ? '' : 's'}` : 'No results'}
      </div>

      {renderGroup('company')}
      {renderGroup('deal')}
      {renderGroup('contract')}
      {renderGroup('contact')}

      <div style={footerHint}>
        <span>
          <span style={{ fontWeight: 800, color: ui.text }}>↑ ↓</span> to navigate
        </span>
        <span>
          <span style={{ fontWeight: 800, color: ui.text }}>Enter</span> to open
        </span>
      </div>
    </div>
  );
}