'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

type CompanyLite = { id: string; company_name: string | null };
type Tag = { id: string; name: string; slug: string; sort_order: number };
type Product = { id: string; name: string; slug: string; sort_order: number };

type ContactDup = {
  id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
};

type Props = {
  open: boolean;
  defaultCompanyId?: string;
  onClose: () => void;
  onCreated: (id: string) => void;
};

const ui = {
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#ffffff',
  shadow: '0 12px 30px rgba(0,0,0,0.18)',
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,0.35)',
  zIndex: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 14,
};

const modal: React.CSSProperties = {
  width: 'min(920px, 96vw)',
  maxHeight: '90vh',
  overflow: 'auto',
  background: ui.bg,
  border: `1px solid ${ui.border}`,
  borderRadius: 12,
  boxShadow: ui.shadow,
};

const header: React.CSSProperties = {
  padding: 12,
  borderBottom: `1px solid ${ui.border}`,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
};

const title: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: ui.text,
  lineHeight: 1.2,
};

const subtitle: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: ui.muted,
  fontWeight: 700,
};

const body: React.CSSProperties = {
  padding: 12,
  display: 'grid',
  gap: 12,
};

const row2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const row3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: ui.muted,
  fontWeight: 500,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: `1px solid ${ui.border}`,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  color: ui.text,
  background: '#fff',
  width: '100%',
  boxSizing: 'border-box' as const,
};

const textarea: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${ui.border}`,
  padding: 10,
  fontSize: 13,
  fontWeight: 400,
  outline: 'none',
  color: ui.text,
  background: '#fff',
  width: '100%',
  minHeight: 90,
  resize: 'vertical',
};

const pillBase: React.CSSProperties = {
  height: 34,
  borderRadius: 999,
  border: `1px solid ${ui.border}`,
  padding: '0 12px',
  fontSize: 13,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: '#fff',
  color: ui.text,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontWeight: 600,
  lineHeight: 1,
  textDecoration: 'none',
};

const primaryPill: React.CSSProperties = {
  ...pillBase,
  border: '1px solid #111827',
  background: '#111827',
  color: '#fff',
};

const dangerPill: React.CSSProperties = {
  ...pillBase,
  border: '1px solid #111827',
  background: '#111827',
  color: '#fff',
};

const togglePill = (active: boolean): React.CSSProperties => ({
  ...pillBase,
  border: `1px solid ${active ? '#111827' : ui.border}`,
  background: active ? '#111827' : '#fff',
  color: active ? '#fff' : ui.text,
});

const sectionCard: React.CSSProperties = {
  border: `1px solid ${ui.border}`,
  borderRadius: 12,
  padding: 12,
  background: '#fff',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: ui.text,
};

const sectionHint: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: ui.muted,
  fontWeight: 700,
};

function sortByOrderThenName(a: any, b: any) {
  const ao = Number(a?.sort_order ?? 0);
  const bo = Number(b?.sort_order ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
}

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

function normalizeEmail(s: string) {
  return (s || '').trim().toLowerCase();
}

function safeLabel(v: string | null | undefined) {
  const s = (v || '').trim();
  return s || '—';
}

export default function CreateContactModal({ open, defaultCompanyId, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);

  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // core fields
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [notes, setNotes] = useState('');

  // toggles
  const [isActive, setIsActive] = useState(true);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);

  // meta selection
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // duplicates
  const [dupLoading, setDupLoading] = useState(false);
  const [dupsSameCompany, setDupsSameCompany] = useState<ContactDup[]>([]);
  const [dupsOtherCompanies, setDupsOtherCompanies] = useState<ContactDup[]>([]);
  const lastCheckedEmailRef = useRef<string>('');
  const lastCheckedCompanyRef = useRef<string>('');

  // override requires explicit second click when duplicates exist
  const [overrideArmed, setOverrideArmed] = useState(false);

  // keep companyId synced when opened with a default
  useEffect(() => {
    if (!open) return;
    setCompanyId(defaultCompanyId || '');
  }, [open, defaultCompanyId]);

  useEffect(() => {
    if (!open) return;
    void loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If company changes, re-check duplicates (email + company scope)
  useEffect(() => {
    if (!open) return;
    // reset override if context changes
    setOverrideArmed(false);
    void checkDuplicates('company-change');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // If email changes, we don't spam queries; we check on blur + on save.
  // But we also clear displayed duplicates as you type to avoid stale warnings.
  useEffect(() => {
    if (!open) return;
    setOverrideArmed(false);
    // if user changes email, clear current results until we re-check
    setDupsSameCompany([]);
    setDupsOtherCompanies([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  async function loadOptions() {
    const [cRes, tRes, pRes] = await Promise.all([
      supabase.from('companies').select('id, company_name').order('company_name', { ascending: true }),
      supabase.from('contact_tags').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
      supabase.from('products').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
    ]);

    if (!cRes.error) {
      const rows = (cRes.data || []) as CompanyLite[];
      setCompanies(rows);
      const map: Record<string, string> = {};
      for (const c of rows) map[c.id] = c.company_name || c.id;
      setCompanyMap(map);
    }
    if (!tRes.error) setTags(((tRes.data || []) as Tag[]).slice().sort(sortByOrderThenName));
    if (!pRes.error) setProducts(((pRes.data || []) as Product[]).slice().sort(sortByOrderThenName));
  }

  function resetForm() {
    setCompanyId(defaultCompanyId || '');
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setJobTitle('');
    setNotes('');
    setIsActive(true);
    setNewsletterOptIn(false);
    setDoNotContact(false);
    setSelectedTagIds([]);
    setSelectedProductIds([]);

    setDupLoading(false);
    setDupsSameCompany([]);
    setDupsOtherCompanies([]);
    setOverrideArmed(false);
    lastCheckedEmailRef.current = '';
    lastCheckedCompanyRef.current = '';
  }

  function toggle(list: string[], id: string) {
    const s = new Set(list);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return Array.from(s);
  }

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const canSaveBase = useMemo(() => {
    if (!companyId) return false;
    return true;
  }, [companyId]);

  const hasDuplicates = useMemo(() => {
    return dupsSameCompany.length > 0 || dupsOtherCompanies.length > 0;
  }, [dupsSameCompany.length, dupsOtherCompanies.length]);

  const createButtonLabel = useMemo(() => {
    if (!hasDuplicates) return 'Create';
    return overrideArmed ? 'Create anyway (confirmed)' : 'Create anyway';
  }, [hasDuplicates, overrideArmed]);

  async function checkDuplicates(reason: 'blur' | 'save' | 'company-change' | 'manual') {
    const em = normalizedEmail;
    const cid = (companyId || '').trim();

    // no email = nothing to check
    if (!em) {
      setDupLoading(false);
      setDupsSameCompany([]);
      setDupsOtherCompanies([]);
      lastCheckedEmailRef.current = '';
      lastCheckedCompanyRef.current = '';
      return;
    }

    // require company to do same-company check properly
    // still allow global check if company missing, but in our UX company is required anyway
    const keyEmail = em;
    const keyCompany = cid;

    // Avoid repeating the same query when nothing changed
    if (
      lastCheckedEmailRef.current === keyEmail &&
      lastCheckedCompanyRef.current === keyCompany &&
      (reason === 'company-change' || reason === 'manual')
    ) {
      return;
    }

    setDupLoading(true);
    try {
      // Case-insensitive: easiest is normalize to lower-case here and compare via ilike.
      // This assumes emails are stored in mixed case sometimes; ilike handles it.
      const res = await supabase
        .from('contacts')
        .select('id, company_id, full_name, email')
        .ilike('email', em) // match exact email ignoring case
        .limit(25);

      if (res.error) throw res.error;

      const matches = (res.data || []) as ContactDup[];
      const same: ContactDup[] = [];
      const other: ContactDup[] = [];

      for (const m of matches) {
        if (cid && m.company_id === cid) same.push(m);
        else other.push(m);
      }

      setDupsSameCompany(same);
      setDupsOtherCompanies(other);

      lastCheckedEmailRef.current = keyEmail;
      lastCheckedCompanyRef.current = keyCompany;
      setDupLoading(false);
    } catch (e) {
      console.warn('Duplicate check failed', e);
      setDupLoading(false);
      // don't block creation if the check fails; just clear warnings
      setDupsSameCompany([]);
      setDupsOtherCompanies([]);
    }
  }

  async function onSave() {
    if (!canSaveBase || loading) return;

    // 1) run duplicate check before saving (authoritative)
    await checkDuplicates('save');

    // 2) if duplicates exist and override not armed, require explicit second click
    // This prevents accidental creation while still allowing edge cases.
    if (normalizedEmail && (dupsSameCompany.length > 0 || dupsOtherCompanies.length > 0) && !overrideArmed) {
      setOverrideArmed(true);
      alert('Duplicate detected. Review the matches, then click "Create anyway (confirmed)" to proceed.');
      return;
    }

    setLoading(true);
    try {
      const first = firstName.trim();
      const last = lastName.trim();
      const fullName = `${first} ${last}`.trim();

      // 3) create contact
      const insert = await supabase
        .from('contacts')
        .insert({
          company_id: companyId,
          first_name: first,
          last_name: last,
          full_name: fullName,
          email: normalizedEmail ? normalizedEmail : null,
          phone: phone.trim() || null,
          job_title: jobTitle.trim() || null,
          notes: notes || '',
          is_active: isActive,
          newsletter_opt_in: newsletterOptIn,
          do_not_contact: doNotContact,
        })
        .select('id')
        .single();

      if (insert.error) throw insert.error;

      const contactId = insert.data.id as string;

      // 4) create tag links
      const tagIds = uniq(selectedTagIds);
      if (tagIds.length > 0) {
        const tagIns = await supabase
          .from('contact_tag_links')
          .insert(tagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId })));
        if (tagIns.error) throw tagIns.error;
      }

      // 5) create product links
      const prodIds = uniq(selectedProductIds);
      if (prodIds.length > 0) {
        const prodIns = await supabase
          .from('contact_product_links')
          .insert(prodIds.map((productId) => ({ contact_id: contactId, product_id: productId })));
        if (prodIns.error) throw prodIns.error;
      }

      setLoading(false);
      resetForm();
      onClose();
      onCreated(contactId);
    } catch (e: any) {
      console.error(e);
      alert(`Could not create contact: ${e?.message || 'Unknown error'}`);
      setLoading(false);
    }
  }

  if (!open) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    const hasData = firstName.trim() || lastName.trim() || email.trim() || phone.trim() || jobTitle.trim();
    if (hasData) {
      if (!window.confirm('You have unsaved data. Close anyway?')) return;
    }
    onClose();
  }

  return (
    <div style={overlay} onMouseDown={handleBackdropClick}>
      <div style={modal}>
        <div style={header}>
          <div>
            <div style={title}>New Person</div>
            <div style={subtitle}>Add a new person to your CRM. Duplicate-safe.</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={pillBase}
              onClick={() => (loading ? null : (resetForm(), onClose()))}
              disabled={loading}
            >
              Close
            </button>

            <button
              type="button"
              style={hasDuplicates ? dangerPill : primaryPill}
              onClick={onSave}
              disabled={!canSaveBase || loading}
              title={hasDuplicates ? 'Duplicates detected — requires explicit confirmation.' : 'Create contact'}
            >
              {loading ? 'Saving…' : createButtonLabel}
            </button>
          </div>
        </div>

        <div style={body}>
          <div style={sectionCard}>
            <div style={sectionTitle}>Core</div>
            <div style={sectionHint}>Minimum required: Company. Email triggers duplicate detection.</div>

            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <div>
                <div style={label}>Company *</div>
                <select style={input} value={companyId} onChange={(e) => setCompanyId(e.target.value)} disabled={loading}>
                  <option value="">Select company…</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name || c.id}
                    </option>
                  ))}
                </select>
              </div>

              <div style={row2}>
                <div>
                  <div style={label}>First name</div>
                  <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
                </div>
                <div>
                  <div style={label}>Last name</div>
                  <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
                </div>
              </div>

              <div style={row3}>
                <div>
                  <div style={label}>Email</div>
                  <input
                    style={input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => checkDuplicates('blur')}
                    disabled={loading}
                    placeholder="name@company.com"
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: ui.muted, fontWeight: 700 }}>
                    {dupLoading ? 'Checking duplicates…' : normalizedEmail ? 'Tip: blur (click away) to run duplicate check.' : '—'}
                  </div>
                </div>

                <div>
                  <div style={label}>Phone</div>
                  <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={loading} placeholder="+40…" />
                </div>

                <div>
                  <div style={label}>Job title</div>
                  <input style={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={loading} />
                </div>
              </div>

              {(dupsSameCompany.length > 0 || dupsOtherCompanies.length > 0) && (
                <div
                  style={{
                    border: `1px solid ${ui.border}`,
                    borderRadius: 12,
                    padding: 12,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 600, color: ui.text }}>Possible duplicate detected</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: ui.muted, fontWeight: 700 }}>
                    Same-company duplicates are the biggest risk. You can still create, but it requires an explicit second click.
                  </div>

                  {dupsSameCompany.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: ui.muted, fontWeight: 600, marginBottom: 6 }}>
                        Same company ({dupsSameCompany.length})
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {dupsSameCompany.map((d) => (
                          <Link
                            key={d.id}
                            href={`/contacts/${d.id}`}
                            style={{
                              textDecoration: 'none',
                              color: ui.text,
                              border: `1px solid ${ui.border}`,
                              borderRadius: 12,
                              padding: 10,
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                            onClick={() => onClose()}
                          >
                            <div style={{ fontWeight: 900 }}>
                              {safeLabel(d.full_name)} <span style={{ color: ui.muted, fontWeight: 800 }}>• {safeLabel(d.email)}</span>
                            </div>
                            <span style={{ color: ui.muted, fontWeight: 900 }}>View</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {dupsOtherCompanies.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 12, color: ui.muted, fontWeight: 600, marginBottom: 6 }}>
                        Other companies ({dupsOtherCompanies.length})
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {dupsOtherCompanies.map((d) => (
                          <Link
                            key={d.id}
                            href={`/contacts/${d.id}`}
                            style={{
                              textDecoration: 'none',
                              color: ui.text,
                              border: `1px solid ${ui.border}`,
                              borderRadius: 12,
                              padding: 10,
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                            onClick={() => onClose()}
                          >
                            <div style={{ fontWeight: 900 }}>
                              {safeLabel(d.full_name)} <span style={{ color: ui.muted, fontWeight: 800 }}>• {safeLabel(d.email)}</span>
                              <div style={{ marginTop: 4, fontSize: 12, color: ui.muted, fontWeight: 800 }}>
                                Company: {companyMap[d.company_id] || d.company_id}
                              </div>
                            </div>
                            <span style={{ color: ui.muted, fontWeight: 900 }}>View</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" style={pillBase} onClick={() => checkDuplicates('manual')} disabled={dupLoading || loading}>
                      Re-check
                    </button>
                    <button
                      type="button"
                      style={togglePill(overrideArmed)}
                      onClick={() => setOverrideArmed((v) => !v)}
                      disabled={loading}
                      title="Arm override"
                    >
                      {overrideArmed ? 'Override armed' : 'Arm override'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={togglePill(isActive)} onClick={() => setIsActive((v) => !v)} disabled={loading}>
                  Active
                </button>
                <button type="button" style={togglePill(newsletterOptIn)} onClick={() => setNewsletterOptIn((v) => !v)} disabled={loading}>
                  Newsletter opt-in
                </button>
                <button type="button" style={togglePill(doNotContact)} onClick={() => setDoNotContact((v) => !v)} disabled={loading}>
                  Do not contact
                </button>
              </div>

              <div>
                <div style={label}>Notes</div>
                <textarea style={textarea} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={loading} placeholder="Internal notes…" />
              </div>
            </div>
          </div>

          <div style={sectionCard}>
            <div style={sectionTitle}>Segmentation</div>
            <div style={sectionHint}>Tags = who to invoice / who gets newsletters. Products = what they use.</div>

            <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
              <div>
                <div style={label}>Tags</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tags.length === 0 ? (
                    <span style={{ fontSize: 12, color: ui.muted, fontWeight: 700 }}>No tags available.</span>
                  ) : (
                    tags.map((t) => {
                      const active = selectedTagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          style={togglePill(active)}
                          onClick={() => setSelectedTagIds((prev) => toggle(prev, t.id))}
                          disabled={loading}
                          title={t.slug}
                        >
                          {t.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div style={label}>Products</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {products.length === 0 ? (
                    <span style={{ fontSize: 12, color: ui.muted, fontWeight: 700 }}>No products available.</span>
                  ) : (
                    products.map((p) => {
                      const active = selectedProductIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          style={togglePill(active)}
                          onClick={() => setSelectedProductIds((prev) => toggle(prev, p.id))}
                          disabled={loading}
                          title={p.slug}
                        >
                          {p.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={pillBase} onClick={() => (loading ? null : resetForm())} disabled={loading}>
              Reset form
            </button>
            <button
              type="button"
              style={hasDuplicates ? dangerPill : primaryPill}
              onClick={onSave}
              disabled={!canSaveBase || loading}
            >
              {loading ? 'Saving…' : createButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}