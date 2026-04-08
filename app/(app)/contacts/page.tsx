'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PageHeader from '../components/PageHeader';
import { supabase } from '@/lib/supabase/client';

import CreateContactModal from '../components/CreateContactModal';

type Contact = {
  id: string;
  created_at: string;
  company_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  preferred_language: string;
  is_active: boolean;
  newsletter_opt_in: boolean;
  do_not_contact: boolean;
};

type CompanyLite = { id: string; company_name: string | null };
type Tag = { id: string; name: string; slug: string; sort_order: number };
type Product = { id: string; name: string; slug: string; sort_order: number };

const UI = {
  bg: '#ffffff',
  soft: '#f9fafb',
  card: '#ffffff',
  text: '#111827',
  text2: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  link: '#2563eb',
  linkHover: '#1d4ed8',
  shadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.08)',
  radius: 10,
};

const cardStyle: React.CSSProperties = {
  background: UI.card,
  border: `1px solid ${UI.border}`,
  borderRadius: UI.radius,
  boxShadow: UI.shadow,
  boxSizing: 'border-box',

};

const inputStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: `1px solid ${UI.border}`,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  color: UI.text,
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box',
};

const buttonBase: React.CSSProperties = {
  height: 42,
  borderRadius: 8,
  border: `1px solid ${UI.border}`,
  background: '#fff',
  color: UI.text,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.01em',
  padding: '0 14px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  transition: 'all 150ms ease',
};

const buttonPrimary: React.CSSProperties = {
  ...buttonBase,
  border: 'none',
  background: 'linear-gradient(to right, #2DA745 0%, #27923d 100%)',
  color: '#ffffff',
  borderRadius: 8,
  fontWeight: 700,
  boxShadow: '0 2px 4px rgba(45, 167, 69, 0.2)',
};

const buttonDangerGhost: React.CSSProperties = {
  ...buttonBase,
  background: '#fff',
  border: `1px solid ${UI.border}`,
  color: UI.muted,
};

function smallBadge(bg = UI.soft, color = UI.muted): React.CSSProperties {
  return {
    height: 24,
    borderRadius: 999,
    border: `1px solid ${UI.border}`,
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 650,
    display: 'inline-flex',
    alignItems: 'center',
    background: bg,
    color,
    whiteSpace: 'nowrap',
    lineHeight: 1,
    boxSizing: 'border-box',
  };
}

function toggleButton(active: boolean): React.CSSProperties {
  return {
    ...buttonBase,
    border: `1px solid ${active ? 'rgba(17,24,39,0.28)' : UI.border}`,
    background: active ? 'rgba(17,24,39,0.06)' : '#fff',
    color: UI.text,
  };
}

function sortByOrderThenName(a: any, b: any) {
  const ao = Number(a?.sort_order ?? 0);
  const bo = Number(b?.sort_order ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
}

function normalizeIdParam(v: string | null) {
  const s = (v || '').trim();
  return s || '';
}

function displayName(c: Pick<Contact, 'full_name' | 'first_name' | 'last_name'>) {
  const n = (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed').trim();
  return n || 'Unnamed';
}

function csvEscape(v: any) {
  const s = (v ?? '').toString();
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ContactsPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialCompanyId = normalizeIdParam(sp.get('companyId'));

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [tagId, setTagId] = useState('');
  const [productId, setProductId] = useState('');
  const [onlyActive, setOnlyActive] = useState(true);
  const [excludeDnc, setExcludeDnc] = useState(true);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);

  // Data
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Record<string, CompanyLite>>({});

  const [allCompanies, setAllCompanies] = useState<CompanyLite[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  const [tagsByContactId, setTagsByContactId] = useState<Record<string, Tag[]>>({});
  const [productsByContactId, setProductsByContactId] = useState<Record<string, Product[]>>({});

  useEffect(() => {
    void loadFilterOptions();
  }, []);

  useEffect(() => {
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, companyId, tagId, productId, onlyActive, excludeDnc]);

  async function loadFilterOptions() {
    const [cRes, tRes, pRes] = await Promise.all([
      supabase.from('companies').select('id, company_name').order('company_name', { ascending: true }),
      supabase.from('contact_tags').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
      supabase.from('products').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
    ]);

    if (!cRes.error) setAllCompanies(((cRes.data || []) as CompanyLite[]).slice());
    if (!tRes.error) setAllTags(((tRes.data || []) as Tag[]).slice().sort(sortByOrderThenName));
    if (!pRes.error) setAllProducts(((pRes.data || []) as Product[]).slice().sort(sortByOrderThenName));
  }

  async function getContactIdsForTagAndProductFilters(): Promise<string[] | null> {
    const wantsTag = !!tagId;
    const wantsProduct = !!productId;
    if (!wantsTag && !wantsProduct) return null;

    let idsFromTags: string[] | null = null;
    let idsFromProducts: string[] | null = null;

    if (wantsTag) {
      const res = await supabase.from('contact_tag_links').select('contact_id').eq('tag_id', tagId);
      if (res.error) return [];
      idsFromTags = (res.data || []).map((r: any) => r.contact_id).filter(Boolean);
    }

    if (wantsProduct) {
      const res = await supabase.from('contact_product_links').select('contact_id').eq('product_id', productId);
      if (res.error) return [];
      idsFromProducts = (res.data || []).map((r: any) => r.contact_id).filter(Boolean);
    }

    if (idsFromTags && idsFromProducts) {
      const set = new Set(idsFromTags);
      return idsFromProducts.filter((id) => set.has(id));
    }

    return idsFromTags ?? idsFromProducts ?? null;
  }

  async function loadContacts() {
    setLoading(true);
    setErr(null);

    try {
      const restrictedIds = await getContactIdsForTagAndProductFilters();

      let query = supabase
        .from('contacts')
        .select(
          'id, created_at, company_id, first_name, last_name, full_name, email, phone, job_title, preferred_language, is_active, newsletter_opt_in, do_not_contact',
        )
        .order('is_active', { ascending: false })
        .order('full_name', { ascending: true });

      if (companyId) query = query.eq('company_id', companyId);
      if (onlyActive) query = query.eq('is_active', true);
      if (excludeDnc) query = query.eq('do_not_contact', false);

      const qq = q.trim();
      if (qq) query = query.or(`full_name.ilike.%${qq}%,email.ilike.%${qq}%`);

      if (restrictedIds !== null) {
        if (restrictedIds.length === 0) {
          setContacts([]);
          setCompanies({});
          setTagsByContactId({});
          setProductsByContactId({});
          setLoading(false);
          return;
        }
        query = query.in('id', restrictedIds);
      }

      const res = await query;
      if (res.error) throw res.error;

      const rows = (res.data || []) as Contact[];
      setContacts(rows);

      const companyIds = Array.from(new Set(rows.map((c) => c.company_id).filter(Boolean)));
      if (companyIds.length === 0) {
        setCompanies({});
      } else {
        const compRes = await supabase.from('companies').select('id, company_name').in('id', companyIds);
        const map: Record<string, CompanyLite> = {};
        for (const c of (compRes.data || []) as CompanyLite[]) map[c.id] = c;
        setCompanies(map);
      }

      await loadMetaForContacts(rows.map((c) => c.id));
      setLoading(false);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || 'Unknown error');
      setContacts([]);
      setCompanies({});
      setTagsByContactId({});
      setProductsByContactId({});
      setLoading(false);
    }
  }

  async function loadMetaForContacts(contactIds: string[]) {
    if (!contactIds.length) {
      setTagsByContactId({});
      setProductsByContactId({});
      return;
    }

    const [tagLinksRes, prodLinksRes] = await Promise.all([
      supabase.from('contact_tag_links').select('contact_id, tag_id').in('contact_id', contactIds),
      supabase.from('contact_product_links').select('contact_id, product_id').in('contact_id', contactIds),
    ]);

    const tagLinks = (tagLinksRes.data || []) as any[];
    const prodLinks = (prodLinksRes.data || []) as any[];

    const allTagIds = Array.from(new Set(tagLinks.map((r) => r.tag_id).filter(Boolean)));
    const allProductIds = Array.from(new Set(prodLinks.map((r) => r.product_id).filter(Boolean)));

    const [tagsRes, productsRes] = await Promise.all([
      allTagIds.length ? supabase.from('contact_tags').select('id, name, slug, sort_order').in('id', allTagIds) : null,
      allProductIds.length ? supabase.from('products').select('id, name, slug, sort_order').in('id', allProductIds) : null,
    ]);

    const tagMap: Record<string, Tag> = {};
    const productMap: Record<string, Product> = {};

    if (tagsRes && !tagsRes.error) for (const t of (tagsRes.data || []) as Tag[]) tagMap[t.id] = t;
    if (productsRes && !productsRes.error) for (const p of (productsRes.data || []) as Product[]) productMap[p.id] = p;

    const byTags: Record<string, Tag[]> = {};
    for (const l of tagLinks) {
      const cid = l.contact_id as string;
      const tid = l.tag_id as string;
      const t = tagMap[tid];
      if (!cid || !t) continue;
      byTags[cid] = byTags[cid] ? [...byTags[cid], t] : [t];
    }
    for (const cid of Object.keys(byTags)) byTags[cid].sort(sortByOrderThenName);

    const byProducts: Record<string, Product[]> = {};
    for (const l of prodLinks) {
      const cid = l.contact_id as string;
      const pid = l.product_id as string;
      const p = productMap[pid];
      if (!cid || !p) continue;
      byProducts[cid] = byProducts[cid] ? [...byProducts[cid], p] : [p];
    }
    for (const cid of Object.keys(byProducts)) byProducts[cid].sort(sortByOrderThenName);

    setTagsByContactId(byTags);
    setProductsByContactId(byProducts);
  }

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${contacts.length} contact${contacts.length === 1 ? '' : 's'}`);
    if (onlyActive) parts.push('Only active');
    if (excludeDnc) parts.push('Exclude DNC');
    return parts.join(' • ');
  }, [contacts.length, onlyActive, excludeDnc]);

  function buildCsv() {
    const header = [
      'Contact ID',
      'Full name',
      'Email',
      'Phone',
      'Company',
      'Job title',
      'Preferred language',
      'Active',
      'Newsletter opt-in',
      'Do not contact',
      'Tags',
      'Products',
      'Created at',
    ];

    const rows = contacts.map((c) => {
      const companyName = companies[c.company_id]?.company_name || '';
      const tags = (tagsByContactId[c.id] || []).map((t) => t.name).join('; ');
      const prods = (productsByContactId[c.id] || []).map((p) => p.name).join('; ');

      return [
        c.id,
        displayName(c),
        c.email || '',
        c.phone || '',
        companyName,
        c.job_title || '',
        c.preferred_language || '',
        c.is_active ? 'TRUE' : 'FALSE',
        c.newsletter_opt_in ? 'TRUE' : 'FALSE',
        c.do_not_contact ? 'TRUE' : 'FALSE',
        tags,
        prods,
        c.created_at || '',
      ].map(csvEscape);
    });

    return [header.map(csvEscape).join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  function onExportCsv() {
    const csv = buildCsv();
    downloadTextFile('contacts-export.csv', csv);
  }

  function clearFilters() {
    setQ('');
    setCompanyId(initialCompanyId || '');
    setTagId('');
    setProductId('');
    setOnlyActive(true);
    setExcludeDnc(true);
  }

  const selectedCompanyName =
    companyId && allCompanies.length
      ? allCompanies.find((c) => c.id === companyId)?.company_name || ''
      : '';

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <PageHeader
        title="People"
        subtitle={loading ? 'Loading…' : subtitle}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonPrimary} onClick={() => setCreateOpen(true)}>
              + New person
            </button>
            <button
              type="button"
              style={buttonBase}
              onClick={onExportCsv}
              disabled={loading || !!err || contacts.length === 0}
              title="Export current filtered list as CSV"
            >
              Export CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div style={{ ...cardStyle, padding: 12 }}>
        <div
          style={{
            display: 'grid',
            gap: 10,
            gridTemplateColumns: 'minmax(240px, 1.3fr) minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr)',
            alignItems: 'end',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, letterSpacing: '0.01em', marginBottom: 6 }}>Search</div>
            <input
              style={inputStyle}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or email…"
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>Company</div>
            <select style={inputStyle} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              <option value="">All companies</option>
              {allCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name || c.id}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>Tag</div>
            <select style={inputStyle} value={tagId} onChange={(e) => setTagId(e.target.value)}>
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>Product</div>
            <select style={inputStyle} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">All products</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={toggleButton(onlyActive)} onClick={() => setOnlyActive((v) => !v)}>
              Only active
            </button>
            <button type="button" style={toggleButton(excludeDnc)} onClick={() => setExcludeDnc((v) => !v)}>
              Exclude DNC
            </button>
          </div>

          <button type="button" style={buttonDangerGhost} onClick={clearFilters} title="Reset filters">
            Clear
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ ...cardStyle, padding: 12 }}>
        {err ? (
          <div style={{ color: UI.text }}>
            <div style={{ fontWeight: 800 }}>Could not load contacts</div>
            <div style={{ marginTop: 6, fontSize: 12, color: UI.muted }}>{err}</div>
          </div>
        ) : loading ? (
          <div style={{ color: UI.muted, fontSize: 13 }}>Loading…</div>
        ) : contacts.length === 0 ? (
          <div style={{ color: UI.muted, fontSize: 13 }}>No contacts match your filters.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {contacts.map((c) => {
              const companyName = companies[c.company_id]?.company_name || '—';
              const tags = tagsByContactId[c.id] || [];
              const prods = productsByContactId[c.id] || [];
              const initials = `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase() || '?';

              return (
                <Link
                  key={c.id}
                  href={`/contacts/${c.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${UI.border}`,
                    background: '#fff',
                    textDecoration: 'none',
                    color: UI.text,
                    boxSizing: 'border-box',
                    transition: 'box-shadow 120ms, border-color 120ms',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLElement).style.boxShadow = UI.shadowMd; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = UI.border; (e.currentTarget as HTMLElement).style.boxShadow = UI.shadow; }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                    background: '#eff6ff', border: '1px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: '#1e40af',
                  }}>
                    {initials}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name + badges */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: UI.text, lineHeight: 1.3 }}>
                        {displayName(c)}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                        {!c.is_active && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f3f4f6', color: '#9ca3af' }}>Inactive</span>}
                        {c.do_not_contact && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef2f2', color: '#991b1b' }}>DNC</span>}
                      </div>
                    </div>

                    {/* Company + job */}
                    <div style={{ fontSize: 12, color: UI.muted, marginTop: 2 }}>
                      {companyName}{c.job_title ? ` · ${c.job_title}` : ''}
                    </div>

                    {/* Email */}
                    {c.email && (
                      <div style={{ fontSize: 12, color: UI.muted, marginTop: 4 }}>
                        <a
                          href={`mailto:${c.email}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: '#2563eb', textDecoration: 'none' }}
                        >
                          {c.email}
                        </a>
                      </div>
                    )}

                    {/* Tags + products */}
                    {(tags.length > 0 || prods.length > 0) && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                        {tags.map((t) => (
                          <span key={t.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>
                            {t.name}
                          </span>
                        ))}
                        {prods.map((p) => (
                          <span key={p.id} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ✅ IMPORTANT FIX:
          Use companyId/companyName props (same pattern as Company detail page),
          and handle both onCreated signatures:
          - onCreated() with no args
          - onCreated(newId)
      */}
<CreateContactModal
  open={createOpen}
  companyId={companyId || null}
  companyName={companyId ? selectedCompanyName : ''}
  onClose={() => setCreateOpen(false)}
  onCreated={(newId) => {
    setCreateOpen(false);
    void loadContacts();
    if (newId) router.push(`/contacts/${newId}`);
  }}
/>

    </div>
  );
}