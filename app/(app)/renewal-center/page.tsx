'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '../components/PageHeader';

type Tab = 'ALL' | 'GA4' | 'EXPIRING' | 'EXPIRING60' | 'EXPIRING30' | 'EXPIRED';

type Contract = {
  id: number;
  company_id: string | null;
  company_name: string | null;
  contract_number: string | null;
  contract_type: string | null;
  status: string | null;
  expiry_date: string | null;
  automatic_renewal: boolean | null;
  contract_owner: string | null;
};

type Deal = {
  id: string;
  deal_name: string | null;
  stage: string | null;
  is_renewal: boolean | null;
  original_contract_id: number | null;
};

const OWNERS = ['Corina', 'Raluca', 'Stefania'];

function daysUntil(s: string | null): number | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(days: number | null, autoRenewal: boolean | null) {
  if (autoRenewal) return { label: 'Auto-renewal', bg: '#f0fdf4', color: '#166534', border: '#86efac' };
  if (days === null) return { label: 'No expiry', bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' };
  if (days < 0) return { label: 'Expired', bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
  if (days <= 30) return { label: `${days}d left`, bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
  if (days <= 90) return { label: `${days}d left`, bg: '#fffbeb', color: '#92400e', border: '#fde68a' };
  return { label: `${days}d left`, bg: '#f0fdf4', color: '#166534', border: '#86efac' };
}

export default function RenewalCenterPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');

  useEffect(() => {
    Promise.all([
      (supabase as any).from('contracts').select('id, company_id, company_name, contract_number, contract_type, status, expiry_date, automatic_renewal, contract_owner').eq('status', 'Active'),
      (supabase as any).from('deals').select('id, deal_name, stage, is_renewal, original_contract_id').eq('is_renewal', true),
    ]).then(([{ data: c }, { data: d }]: any) => {
      setContracts((c ?? []) as Contract[]);
      setDeals((d ?? []) as Deal[]);
      setLoading(false);
    });
  }, []);

  const renewalDealsByContractId = useMemo(() => {
    const m: Record<number, Deal[]> = {};
    deals.forEach((d) => {
      if (d.original_contract_id) {
        if (!m[d.original_contract_id]) m[d.original_contract_id] = [];
        m[d.original_contract_id].push(d);
      }
    });
    return m;
  }, [deals]);

  const enriched = useMemo(() => contracts.map((c) => ({
    ...c,
    daysLeft: daysUntil(c.expiry_date),
    renewalDeals: renewalDealsByContractId[c.id] ?? [],
  })), [contracts, renewalDealsByContractId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enriched.filter((c) => {
      if (ownerFilter && c.contract_owner !== ownerFilter) return false;
      if (tab === 'GA4' && c.contract_type !== 'GA4') return false;
      if (tab === 'EXPIRING') {
        if (c.automatic_renewal) return false;
        if (c.daysLeft === null || c.daysLeft > 90) return false;
      }
      if (tab === 'EXPIRING60') {
        if (c.automatic_renewal) return false;
        if (c.daysLeft === null || c.daysLeft > 60) return false;
      }
      if (tab === 'EXPIRING30') {
        if (c.automatic_renewal) return false;
        if (c.daysLeft === null || c.daysLeft > 30) return false;
      }
      if (tab === 'EXPIRED') {
        if (c.daysLeft === null || c.daysLeft >= 0) return false;
      }
      if (tab === 'EXPIRED') {
        if (c.automatic_renewal) return false;
        if (c.daysLeft === null || c.daysLeft >= 0) return false;
      }
      if (q) {
        const hay = [c.company_name, c.contract_number, c.contract_type, c.contract_owner].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (tab === 'GA4' || tab === 'EXPIRING') {
        const da = a.daysLeft ?? 9999;
        const db = b.daysLeft ?? 9999;
        return da - db;
      }
      return (a.company_name ?? '').localeCompare(b.company_name ?? '');
    });
  }, [enriched, tab, search, ownerFilter]);

  // KPIs
  const kpis = useMemo(() => {
    const expiring30 = enriched.filter((c) => !c.automatic_renewal && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 30).length;
    const expiring60 = enriched.filter((c) => !c.automatic_renewal && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 60).length;
    const expiring90 = enriched.filter((c) => !c.automatic_renewal && c.daysLeft !== null && c.daysLeft >= 0 && c.daysLeft <= 90).length;
    const noRenewalDeal = enriched.filter((c) => !c.automatic_renewal && (c.daysLeft ?? 9999) <= 90 && c.renewalDeals.length === 0).length;
    const ga4Count = enriched.filter((c) => c.contract_type === 'GA4').length;
    const expired = enriched.filter((c) => !c.automatic_renewal && c.daysLeft !== null && c.daysLeft < 0).length;
    return { expiring30, expiring60, expiring90, noRenewalDeal, ga4Count, expired };
  }, [enriched]);

  const TAB_OPTS: { key: Tab; label: string; count: number }[] = [
    { key: 'ALL', label: 'All active', count: enriched.length },
    { key: 'GA4', label: 'GA4 only', count: kpis.ga4Count },
    { key: 'EXPIRING', label: 'Expiring ≤ 90d', count: kpis.expiring90 },
    { key: 'EXPIRING60', label: 'Expiring ≤ 60d', count: kpis.expiring60 },
    { key: 'EXPIRING30', label: 'Expiring ≤ 30d', count: kpis.expiring30 },
    { key: 'EXPIRED', label: 'Expired', count: kpis.expired },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader title="Renewal Center" subtitle={`${filtered.length} contracts`} />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, cursor: 'pointer' }}>
        {[
          { label: 'Expiring ≤ 30d', value: kpis.expiring30, danger: kpis.expiring30 > 0, tabKey: 'EXPIRING30' as Tab },
          { label: 'Expiring ≤ 60d', value: kpis.expiring60, danger: kpis.expiring60 > 0, tabKey: 'EXPIRING60' as Tab },
          { label: 'Expiring ≤ 90d', value: kpis.expiring90, danger: kpis.expiring90 > 0, tabKey: 'EXPIRING' as Tab },
          { label: 'GA4 contracts', value: kpis.ga4Count, danger: false, tabKey: 'GA4' as Tab },
          { label: 'Expired', value: kpis.expired, danger: kpis.expired > 0, tabKey: 'EXPIRED' as Tab },
        ].map(({ label, value, danger, tabKey }) => (
          <button
            key={label}
            type="button"
            onClick={() => setTab(tabKey)}
            style={{
              background: tab === tabKey ? (danger && value > 0 ? '#fef2f2' : '#f0fdf4') : (danger && value > 0 ? '#fef2f2' : '#fff'),
              border: `1px solid ${tab === tabKey ? (danger && value > 0 ? '#f87171' : '#86efac') : (danger && value > 0 ? '#fecaca' : '#e5e7eb')}`,
              borderRadius: 10, padding: '12px 16px', cursor: 'pointer', textAlign: 'left', width: '100%',
              boxShadow: tab === tabKey ? '0 0 0 2px rgba(45,167,69,0.15)' : 'none',
              transition: 'all 120ms',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: danger && value > 0 ? '#991b1b' : '#111827', marginTop: 4 }}>{value}</div>
          </button>
        ))}
      </div>

      {/* Tabs + filters */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Tab pills */}
        <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
          {TAB_OPTS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: tab === key ? '#fff' : 'transparent',
                color: tab === key ? '#111827' : '#6b7280',
                boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 120ms',
              }}
            >
              {label} <span style={{ opacity: 0.6, fontWeight: 400 }}>({count})</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, contract #, type…"
            style={{ width: '100%', height: 34, padding: '0 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff' }}
        >
          <option value="">All owners</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Company', 'Contract #', 'Type', 'Owner', 'Expiry', 'Status', 'Renewal deal'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#9ca3af', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>No contracts match.</td></tr>
              ) : filtered.map((c) => {
                const badge = statusBadge(c.daysLeft, c.automatic_renewal);
                const activeRenewal = c.renewalDeals.find((d) => d.stage !== 'Lost');
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px' }}>
                      {c.company_id ? (
                        <Link href={`/companies/${c.company_id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>{c.company_name ?? '—'}</Link>
                      ) : <span style={{ fontWeight: 600 }}>{c.company_name ?? '—'}</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Link href={`/contracts/${c.id}`} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>{c.contract_number ?? `#${c.id}`}</Link>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: c.contract_type === 'GA4' ? '#dbeafe' : '#f3f4f6',
                        color: c.contract_type === 'GA4' ? '#1e40af' : '#374151',
                      }}>
                        {c.contract_type ?? '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#374151' }}>{c.contract_owner ?? '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {c.contract_type === 'GA4' || !c.automatic_renewal ? (
                        <span style={{ fontWeight: c.daysLeft !== null && c.daysLeft <= 90 ? 700 : 400 }}>
                          {formatDate(c.expiry_date)}
                        </span>
                      ) : <span style={{ color: '#9ca3af' }}>Auto-renewal</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {activeRenewal ? (
                        <Link href={`/deals/${activeRenewal.id}`} style={{ color: '#166534', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                          ✓ {activeRenewal.deal_name ?? 'Renewal deal'}
                        </Link>
                      ) : !c.automatic_renewal && (c.daysLeft ?? 9999) <= 90 ? (
                        <Link href={`/deals/new?renewalOf=${c.id}`} style={{ color: '#991b1b', fontWeight: 600, textDecoration: 'none', fontSize: 12 }}>
                          + Create deal
                        </Link>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}