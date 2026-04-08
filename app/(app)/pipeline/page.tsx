'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '../components/PageHeader';

type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';

type Deal = {
  id: string;
  company_name: string | null;
  deal_name: string | null;
  value: number | null;
  stage: DealStage | null;
  owner: string | null;
  follow_up_date: string | null;
  expected_close_date: string | null;
  deal_probability: number | null;
};

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];

const STAGE_PROB: Record<DealStage, number> = { Lead: 0.1, Qualified: 0.25, Proposal: 0.6, Won: 1, Lost: 0 };

const STAGE_DESC: Record<DealStage, string> = {
  Lead: 'First contact or discovery phase. Opportunity identified but not yet qualified.',
  Qualified: 'The opportunity is confirmed. Budget, authority, need and timeline are established.',
  Proposal: 'A formal proposal or quote has been sent. Negotiation may be in progress.',
  Won: 'Deal closed successfully. Contract or PO received.',
  Lost: 'Deal closed unsuccessfully. Opportunity did not convert.',
};

const STAGE_COLOR: Record<DealStage, { bg: string; border: string; text: string; badge: string }> = {
  Lead:     { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1', badge: '#dbeafe' },
  Qualified:{ bg: '#fefce8', border: '#fde68a', text: '#92400e', badge: '#fef9c3' },
  Proposal: { bg: '#fdf4ff', border: '#e9d5ff', text: '#6b21a8', badge: '#f3e8ff' },
  Won:      { bg: '#f0fdf4', border: '#86efac', text: '#166534', badge: '#dcfce7' },
  Lost:     { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', badge: '#fee2e2' },
};

function formatMoney(v: number | null) {
  if (!v) return '—';
  if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `€${(v / 1000).toFixed(0)}K`;
  return `€${v}`;
}

function formatDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function isOverdue(s: string | null) {
  if (!s) return false;
  return new Date(s) < new Date();
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dragOver, setDragOver] = useState<DealStage | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any)
      .from('deals')
      .select('id, company_name, deal_name, value, stage, owner, follow_up_date, expected_close_date, deal_probability')
      .order('value', { ascending: false })
      .then(({ data }: any) => {
        setDeals((data ?? []) as Deal[]);
        setLoading(false);
      });
  }, []);

  const owners = useMemo(() => {
    const s = new Set<string>();
    deals.forEach((d) => d.owner?.trim() && s.add(d.owner.trim()));
    return Array.from(s).sort();
  }, [deals]);

  const filtered = useMemo(() =>
    ownerFilter ? deals.filter((d) => d.owner === ownerFilter) : deals,
    [deals, ownerFilter]
  );

  const byStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = { Lead: [], Qualified: [], Proposal: [], Won: [], Lost: [] };
    filtered.forEach((d) => map[(d.stage ?? 'Lead') as DealStage].push(d));
    return map;
  }, [filtered]);

  const summary = useMemo(() => {
    const r: Record<DealStage, { count: number; total: number; weighted: number; atRisk: number }> = {
      Lead: { count: 0, total: 0, weighted: 0, atRisk: 0 },
      Qualified: { count: 0, total: 0, weighted: 0, atRisk: 0 },
      Proposal: { count: 0, total: 0, weighted: 0, atRisk: 0 },
      Won: { count: 0, total: 0, weighted: 0, atRisk: 0 },
      Lost: { count: 0, total: 0, weighted: 0, atRisk: 0 },
    };
    filtered.forEach((d) => {
      const s = (d.stage ?? 'Lead') as DealStage;
      const v = d.value ?? 0;
      const prob = typeof d.deal_probability === 'number' ? d.deal_probability : STAGE_PROB[s];
      r[s].count++;
      r[s].total += v;
      r[s].weighted += v * prob;
      if (d.follow_up_date && isOverdue(d.follow_up_date)) r[s].atRisk++;
    });
    return r;
  }, [filtered]);

  const totalOpen = useMemo(() => {
    return ['Lead', 'Qualified', 'Proposal'].reduce(
      (acc, s) => acc + summary[s as DealStage].total, 0
    );
  }, [summary]);

  const totalWeighted = useMemo(() => {
    return ['Lead', 'Qualified', 'Proposal'].reduce(
      (acc, s) => acc + summary[s as DealStage].weighted, 0
    );
  }, [summary]);

  const totalAtRisk = useMemo(() => {
    return ['Lead', 'Qualified', 'Proposal'].reduce(
      (acc, s) => acc + summary[s as DealStage].atRisk, 0
    );
  }, [summary]);

  async function moveDeal(dealId: string, newStage: DealStage) {
    setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: newStage } : d));
    await (supabase as any).from('deals').update({ stage: newStage, stage_changed_at: new Date().toISOString() }).eq('id', dealId);
  }

  if (loading) return <div style={{ padding: 24, color: '#6b7280', fontSize: 13 }}>Loading pipeline…</div>;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeader
        title="Pipeline"
        subtitle={`${filtered.length} deals`}
        right={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              style={{ height: 34, padding: '0 10px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, background: '#fff', color: '#374151' }}
            >
              <option value="">All owners</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <Link href="/deals/new" style={{ height: 34, padding: '0 14px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', fontSize: 13, fontWeight: 600, textDecoration: 'none', background: '#2DA745', color: '#fff' }}>
              + New Deal
            </Link>
          </div>
        }
      />

      {/* KPI Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Total pipeline', value: formatMoney(totalOpen), sub: 'Open deals value', color: '#1e40af' },
          { label: 'Weighted pipeline', value: formatMoney(totalWeighted), sub: 'Value × win probability per stage', color: '#166534' },
          { label: 'Value at risk', value: String(totalAtRisk), sub: 'Overdue follow-ups', color: totalAtRisk > 0 ? '#991b1b' : '#166534' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Drag hint */}
      <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>↔</span>
        <span>Drag and drop cards between stages • Hover stage name for description</span>
      </div>

      {/* Kanban board */}
      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        {/* Sticky top scrollbar trick: duplicate scroll container */}
        <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
          {STAGES.map((stage) => {
            const col = STAGE_COLOR[stage];
            const sum = summary[stage];
            const stageDealList = byStage[stage];
            const isDragTarget = dragOver === stage;

            return (
              <div
                key={stage}
                style={{ width: 240, flexShrink: 0 }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(stage); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  if (dragging && dragging !== stage) moveDeal(dragging, stage);
                  setDragging(null);
                }}
              >
                {/* Column header */}
                <div style={{
                  background: col.bg,
                  border: `1px solid ${isDragTarget ? col.text : col.border}`,
                  borderRadius: '10px 10px 0 0',
                  padding: '10px 12px',
                  borderBottom: 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span
                        title={STAGE_DESC[stage]}
                        style={{ fontSize: 12, fontWeight: 700, color: col.text, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'help', borderBottom: `1px dotted ${col.text}` }}
                      >
                        {stage}
                      </span>
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: col.text, opacity: 0.65 }}>
                        {Math.round(STAGE_PROB[stage] * 100)}% win
                      </span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, background: col.badge, color: col.text, padding: '2px 7px', borderRadius: 999 }}>{sum.count}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: col.text }}>
                    <span style={{ fontWeight: 700 }}>{formatMoney(sum.total)}</span>
                    {stage !== 'Won' && stage !== 'Lost' && sum.weighted > 0 && (
                      <span style={{ opacity: 0.7 }}> · {formatMoney(sum.weighted)} wtd</span>
                    )}
                  </div>
                  {sum.atRisk > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, color: '#991b1b', fontWeight: 600 }}>
                      ⚠ {sum.atRisk} overdue
                    </div>
                  )}
                </div>

                {/* Cards */}
                <div style={{
                  border: `1px solid ${isDragTarget ? col.text : col.border}`,
                  borderTop: 'none',
                  borderRadius: '0 0 10px 10px',
                  background: isDragTarget ? col.bg : '#f9fafb',
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 6,
                  transition: 'background 100ms',
                }}>
                  {stageDealList.length === 0 && (
                    <div style={{ padding: '12px 8px', fontSize: 12, color: '#d1d5db', textAlign: 'center' }}>Drop here</div>
                  )}
                  {stageDealList.map((deal) => {
                    const overdue = isOverdue(deal.follow_up_date);
                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => setDragging(deal.id)}
                        onDragEnd={() => setDragging(null)}
                        style={{
                          background: '#fff',
                          border: `1px solid ${overdue ? '#fecaca' : '#e5e7eb'}`,
                          borderRadius: 8,
                          padding: '9px 10px',
                          cursor: 'grab',
                          boxShadow: dragging === deal.id ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 2px rgba(0,0,0,0.04)',
                          opacity: dragging === deal.id ? 0.5 : 1,
                          transition: 'box-shadow 100ms',
                        }}
                      >
                        <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', lineHeight: 1.3, marginBottom: 3 }}>
                            {deal.deal_name ?? '—'}
                          </div>
                        </Link>
                        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>
                          {deal.company_name ?? '—'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                            {formatMoney(deal.value)}
                          </span>
                          {deal.owner && (
                            <span style={{ fontSize: 10, color: '#9ca3af', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
                              {deal.owner.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        {deal.follow_up_date && (
                          <div style={{ marginTop: 5, fontSize: 10, color: overdue ? '#991b1b' : '#6b7280', fontWeight: overdue ? 600 : 400 }}>
                            {overdue ? '⚠ ' : '📅 '}{formatDate(deal.follow_up_date)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}