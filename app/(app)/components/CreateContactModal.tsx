'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const ui = {
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  bg: '#ffffff',
  soft: '#f9fafb',
};

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  width: 'min(780px, 96vw)',
  background: '#fff',
  borderRadius: 12,
  border: `1px solid ${ui.border}`,
  boxShadow: '0 18px 60px rgba(0,0,0,0.25)',
  overflow: 'hidden',
};

const header: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: `1px solid ${ui.border}`,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 950,
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
  padding: 14,
  display: 'grid',
  gap: 12,
};

const grid2: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
};

const grid3: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: ui.muted,
  fontWeight: 500,
  marginBottom: 6,
};

const input: React.CSSProperties = {
  height: 34,
  borderRadius: 10,
  border: `1px solid ${ui.border}`,
  padding: '0 10px',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  color: ui.text,
  fontWeight: 400,
  background: '#fff',
  boxSizing: 'border-box',
};

const textarea: React.CSSProperties = {
  minHeight: 90,
  borderRadius: 10,
  border: `1px solid ${ui.border}`,
  padding: 10,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  color: ui.text,
  fontWeight: 650,
  resize: 'vertical',
  boxSizing: 'border-box',
};

const pillBtnBase: React.CSSProperties = {
  height: 34,
  borderRadius: 999,
  border: `1px solid ${ui.border}`,
  background: '#fff',
  color: ui.text,
  padding: '0 12px',
  fontSize: 13,
  fontWeight: 950,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  lineHeight: 1,
};

const pillBtnPrimary: React.CSSProperties = {
  ...pillBtnBase,
  border: '1px solid #111827',
  background: '#111827',
  color: '#fff',
};

const footer: React.CSSProperties = {
  padding: '12px 14px',
  borderTop: `1px solid ${ui.border}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: '#fafafa',
};

const checkboxRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};

function checkboxPill(active: boolean): React.CSSProperties {
  return {
    height: 30,
    borderRadius: 999,
    border: `1px solid ${active ? '#111827' : ui.border}`,
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : ui.text,
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 950,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    userSelect: 'none',
    whiteSpace: 'nowrap',
    lineHeight: 1,
  };
}

type CompanyLite = { id: string; company_name: string | null };
type Tag = { id: string; name: string; slug: string };
type Product = { id: string; name: string; slug: string };

type Props = {
  open: boolean;

  // supports BOTH patterns:
  // - company detail page passes companyId/companyName
  // - contacts page might pass defaultCompanyId (older pattern)
  companyId?: string | null;
  companyName?: string;

  defaultCompanyId?: string;

  onClose: () => void;
  onCreated?: (contactId: string) => void;
};

export default function CreateContactModal({
  open,
  companyId,
  companyName,
  defaultCompanyId,
  onClose,
  onCreated,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If not provided, user must choose
  const initialCompanyId = (companyId ?? defaultCompanyId ?? '') || '';
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);

  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [jobTitle, setJobTitle] = useState('');

  const [preferredLanguage, setPreferredLanguage] = useState<'en' | 'ro' | 'hu'>('en');

  const [isActive, setIsActive] = useState(true);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [doNotContact, setDoNotContact] = useState(false);

  const [notes, setNotes] = useState('');

  // Tags + Products
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Reset form when opened
  useEffect(() => {
    if (!open) return;

    setSaving(false);
    setErrorMsg(null);

    // company selection resets to incoming props each time opened
    const nextCompanyId = (companyId ?? defaultCompanyId ?? '') || '';
    setSelectedCompanyId(nextCompanyId);

    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');

    setJobTitle('');

    setPreferredLanguage('en');

    setIsActive(true);
    setNewsletterOptIn(false);
    setDoNotContact(false);

    setNotes('');
    setSelectedTagIds([]);
    setSelectedProductIds([]);
  }, [open, companyId, defaultCompanyId]);

  // Load tags and products when modal opens
  useEffect(() => {
    if (!open) return;
    Promise.all([
      (supabase as any).from('contact_tags').select('id, name, slug').order('sort_order', { ascending: true }),
      (supabase as any).from('products').select('id, name, slug').order('sort_order', { ascending: true }),
    ]).then(([{ data: tagsData }, { data: prodsData }]: any) => {
      setAllTags((tagsData ?? []) as Tag[]);
      setAllProducts((prodsData ?? []) as Product[]);
    });
  }, [open]);

  // Load companies only if we need selection (i.e. no fixed company id)
  useEffect(() => {
    if (!open) return;

    const fixed = !!(companyId && String(companyId).trim());
    if (fixed) return;

    void (async () => {
      setCompaniesLoading(true);
      const res = await supabase.from('companies').select('id, company_name').order('company_name', { ascending: true });
      if (!res.error) setCompanies((res.data || []) as CompanyLite[]);
      setCompaniesLoading(false);
    })();
  }, [open, companyId]);

  const fullName = useMemo(() => {
    const n = `${firstName} ${lastName}`.trim().replace(/\s+/g, ' ');
    return n;
  }, [firstName, lastName]);

  const effectiveCompanyId = useMemo(() => {
    // If companyId prop exists, it wins. Otherwise selection is required.
    const fixed = (companyId ?? '').toString().trim();
    return fixed || selectedCompanyId.trim();
  }, [companyId, selectedCompanyId]);

  const effectiveCompanyName = useMemo(() => {
    const fixedName = (companyName ?? '').trim();
    if (fixedName) return fixedName;
    if (!effectiveCompanyId) return '';
    const found = companies.find((c) => c.id === effectiveCompanyId);
    return found?.company_name || '';
  }, [companyName, companies, effectiveCompanyId]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (!effectiveCompanyId) return false;
    if (!fullName) return false;
    return true;
  }, [saving, effectiveCompanyId, fullName]);

  async function create() {
    if (!canSave) {
      if (!effectiveCompanyId) setErrorMsg('Please select a company.');
      else if (!fullName) setErrorMsg('Please enter at least a first or last name.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const payload = {
      company_id: effectiveCompanyId,

      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,

      email: email.trim() ? email.trim() : null,
      phone: phone.trim() ? phone.trim() : null,

      job_title: jobTitle.trim() ? jobTitle.trim() : null,

      preferred_language: preferredLanguage,

      is_active: isActive,
      newsletter_opt_in: newsletterOptIn,
      do_not_contact: doNotContact,

      // safer: store null when empty (avoids NOT NULL issues if schema differs)
      notes: notes.trim() ? notes.trim() : null,
    };

    const { data, error } = await supabase.from('contacts').insert(payload).select('id').single();

    if (error) {
      console.error(error);
      setErrorMsg(error.message || 'Could not create contact.');
      setSaving(false);
      return;
    }

    const newId = (data as any)?.id as string;

    // Save tag links
    if (selectedTagIds.length > 0) {
      await (supabase as any)
        .from('contact_tag_links')
        .insert(selectedTagIds.map((tag_id) => ({ contact_id: newId, tag_id })));
    }

    // Save product links
    if (selectedProductIds.length > 0) {
      await (supabase as any)
        .from('contact_product_links')
        .insert(selectedProductIds.map((product_id) => ({ contact_id: newId, product_id })));
    }

    setSaving(false);
    onClose();
    onCreated?.(newId);
  }

  if (!open) return null;

  const needsCompanySelect = !(companyId && String(companyId).trim());

  function handleBackdropClick() {
    const hasData = firstName.trim() || lastName.trim() || email.trim() || phone.trim() || jobTitle.trim();
    if (hasData) {
      if (!window.confirm('You have unsaved data. Close anyway?')) return;
    }
    onClose();
  }

  return (
    <div style={overlay} onMouseDown={handleBackdropClick}>
      <div style={modal} onMouseDown={(e) => e.stopPropagation()}>
        <div style={header}>
          <div style={{ minWidth: 0 }}>
            <div style={title}>Create Contact</div>
            <div style={subtitle}>
              Company:{' '}
              <span style={{ color: ui.text }}>
                {needsCompanySelect
                  ? effectiveCompanyName || (effectiveCompanyId ? effectiveCompanyId : 'Select a company')
                  : companyName || companyId}
              </span>
            </div>
          </div>

          <button type="button" style={pillBtnBase} onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        <div style={body}>
          {/* ✅ Company selector (only when opened from /contacts with no fixed company) */}
          {needsCompanySelect && (
            <div>
              <div style={label}>Company *</div>
              <select
                style={input}
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                disabled={companiesLoading || saving}
              >
                <option value="">{companiesLoading ? 'Loading companies…' : 'Select a company…'}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || c.id}
                  </option>
                ))}
              </select>
              <div style={{ marginTop: 6, fontSize: 12, color: ui.muted }}>
                This is required when creating contacts from the Contacts page.
              </div>
            </div>
          )}

          {errorMsg ? (
            <div
              style={{
                border: `1px solid ${ui.border}`,
                background: ui.soft,
                padding: 10,
                borderRadius: 12,
                color: ui.text,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {errorMsg}
            </div>
          ) : null}

          <div style={grid2}>
            <div>
              <div style={label}>First name</div>
              <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Andreea" />
            </div>
            <div>
              <div style={label}>Last name</div>
              <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Popescu" />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <div style={label}>Email</div>
              <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
            </div>
            <div>
              <div style={label}>Phone</div>
              <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+40…" />
            </div>
          </div>

          <div style={grid3}>
            <div>
              <div style={label}>Job title</div>
              <input style={input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Head of Marketing" />
            </div>

          </div>

          <div style={grid3}>
            <div>
              <div style={label}>Preferred language</div>
              <select style={input} value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value as any)}>
                <option value="en">EN</option>
                <option value="ro">RO</option>
                <option value="hu">HU</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <div style={label}>Status & labels</div>
              <div style={checkboxRow}>
                <span style={checkboxPill(isActive)} onClick={() => setIsActive((v) => !v)} role="button" tabIndex={0}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                <span
                  style={checkboxPill(newsletterOptIn)}
                  onClick={() => setNewsletterOptIn((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  Newsletter
                </span>
                <span
                  style={checkboxPill(doNotContact)}
                  onClick={() => setDoNotContact((v) => !v)}
                  role="button"
                  tabIndex={0}
                >
                  Do not contact
                </span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: ui.muted }}>
                Tip: “Newsletter” is opt-in. “Do not contact” suppresses all outreach.
              </div>
            </div>
          </div>

          <div>
            <div style={label}>Notes</div>
            <textarea
              style={textarea}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Relationship notes, preferences, context…"
            />
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <div style={label}>Tags</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allTags.map((t) => {
                  const selected = selectedTagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTagIds((prev) => selected ? prev.filter((id) => id !== t.id) : [...prev, t.id])}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: 'none',
                        background: selected ? '#f0fdf4' : '#f3f4f6',
                        color: selected ? '#166534' : '#6b7280',
                        fontWeight: selected ? 600 : 400,
                        outline: selected ? '1px solid #86efac' : 'none',
                        transition: 'all 120ms',
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products */}
          {allProducts.length > 0 && (
            <div>
              <div style={label}>Products</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allProducts.map((p) => {
                  const selected = selectedProductIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProductIds((prev) => selected ? prev.filter((id) => id !== p.id) : [...prev, p.id])}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: 'none',
                        background: selected ? '#eff6ff' : '#f3f4f6',
                        color: selected ? '#1e40af' : '#6b7280',
                        fontWeight: selected ? 600 : 400,
                        outline: selected ? '1px solid #bfdbfe' : 'none',
                        transition: 'all 120ms',
                      }}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={footer}>
          <div style={{ fontSize: 12, color: ui.muted }}>
            Name preview: <span style={{ color: ui.text, fontWeight: 900 }}>{fullName || '—'}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={pillBtnBase} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" style={pillBtnPrimary} onClick={create} disabled={!canSave}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}