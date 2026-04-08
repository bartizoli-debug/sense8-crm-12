'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageHeader from '../../components/PageHeader';
import { supabase } from '@/lib/supabase/client';


type CompanyLite = { id: string; company_name?: string | null };

type Contact = {
  id: string;
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
  notes: string;
  created_at: string;
  updated_at: string;
};

type Tag = { id: string; name: string; slug: string; sort_order: number };
type Product = { id: string; name: string; slug: string; sort_order: number };

type ContactDup = {
  id: string;
  company_id: string;
  full_name: string | null;
  email: string | null;
};

const UI = {
  bg: '#ffffff',
  soft: '#f8f9fa',
  card: '#ffffff',
  text: '#111827',
  text2: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  link: '#2563eb',
  linkHover: '#1d4ed8',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 8px rgba(0, 0, 0, 0.08)',
  radius: 12,
};

function cardStyle(): React.CSSProperties {
  return {
    border: `1px solid ${UI.border}`,
    background: '#fff',
    borderRadius: UI.radius,
    padding: 12,
    boxShadow: UI.shadow,
    boxSizing: 'border-box',
  };
}

function labelStyle(): React.CSSProperties {
  return { fontSize: 12, color: UI.muted, fontWeight: 500, letterSpacing: '0.01em', marginBottom: 6 };
}

function valueStyle(): React.CSSProperties {
  return { fontSize: 13, color: UI.text, fontWeight: 400 };
}

function inputStyle(): React.CSSProperties {
  return {
    height: 36,
    borderRadius: 8,
    border: `1px solid ${UI.border}`,
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.01em',
    outline: 'none',
    color: UI.text,
    background: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  };
}

function textareaStyle(): React.CSSProperties {
  return {
    borderRadius: 12,
    border: `1px solid ${UI.border}`,
    padding: 10,
    fontSize: 13,
    fontWeight: 600,
    outline: 'none',
    color: UI.text,
    background: '#fff',
    width: '100%',
    minHeight: 90,
    resize: 'vertical' as const,
    boxSizing: 'border-box',
  };
}

function buttonBase(): React.CSSProperties {
  return {
    height: 42,
    borderRadius: 8,
    border: `1px solid ${UI.border}`,
    padding: '0 12px',
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#fff',
    color: UI.text,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    fontWeight: 700,
    letterSpacing: '0.01em',
    lineHeight: 1,
    textDecoration: 'none',
  };
}

function actionButtonStyle(variant: 'primary' | 'ghost'): React.CSSProperties {
  if (variant === 'primary') {
    return {
      ...buttonBase(),
      border: 'none',
      background: 'linear-gradient(to right, #2DA745 0%, #27923d 100%)',
      color: '#fff',
      boxShadow: '0 2px 4px rgba(45, 167, 69, 0.2)',
    };
  }
  return { ...buttonBase() };
}

function chip(active: boolean): React.CSSProperties {
  return {
    height: 30,
    borderRadius: 999,
    border: `1px solid ${active ? 'rgba(17,24,39,0.28)' : UI.border}`,
    padding: '0 12px',
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: active ? 'rgba(17,24,39,0.06)' : '#fff',
    color: UI.text,
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    fontWeight: 700,
    lineHeight: 1,
    textDecoration: 'none',
  };
}

function badge(bg = UI.soft, color = UI.muted): React.CSSProperties {
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
  };
}

function safeName(contact: Contact) {
  return (contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unnamed').trim();
}

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

function sortByOrderThenName(a: any, b: any) {
  const ao = Number(a?.sort_order ?? 0);
  const bo = Number(b?.sort_order ?? 0);
  if (ao !== bo) return ao - bo;
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
}

function normalizeEmail(s: string) {
  return (s || '').trim().toLowerCase();
}

function safeLabel(v: string | null | undefined) {
  const s = (v || '').trim();
  return s || '—';
}

export default function ContactDetailPage() {
  const params = useParams();
  const raw = (params as any)?.id as string | string[] | undefined;
  const id = Array.isArray(raw) ? raw[0] : raw;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [contact, setContact] = useState<Contact | null>(null);
  const [company, setCompany] = useState<CompanyLite | null>(null);

  // Companies list for assignment dropdown
  const [allCompanies, setAllCompanies] = useState<CompanyLite[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});

  // Current assigned meta
  const [tags, setTags] = useState<Tag[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Available options
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Edit: Tags/Products
  const [editMeta, setEditMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [draftTagIds, setDraftTagIds] = useState<string[]>([]);
  const [draftProductIds, setDraftProductIds] = useState<string[]>([]);

  // Edit: Contact core fields
  const [editContact, setEditContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  const [draftFirstName, setDraftFirstName] = useState('');
  const [draftLastName, setDraftLastName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftCompanyId, setDraftCompanyId] = useState('');
  const [draftPhone, setDraftPhone] = useState('');

  const [draftIsActive, setDraftIsActive] = useState(true);
  const [draftNewsletter, setDraftNewsletter] = useState(false);
  const [draftDnc, setDraftDnc] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

  // Duplicate detection (edit)
  const [dupLoading, setDupLoading] = useState(false);
  const [dupsSameCompany, setDupsSameCompany] = useState<ContactDup[]>([]);
  const [dupsOtherCompanies, setDupsOtherCompanies] = useState<ContactDup[]>([]);
  const [overrideArmed, setOverrideArmed] = useState(false);
  const lastCheckedRef = useRef<{ email: string; companyId: string }>({ email: '', companyId: '' });

  useEffect(() => {
    if (!id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    if (!id) return;

    setLoading(true);
    setLoadError(null);
    setEditMeta(false);
    setSavingMeta(false);
    setEditContact(false);
    setSavingContact(false);

    // clear dup state
    setDupLoading(false);
    setDupsSameCompany([]);
    setDupsOtherCompanies([]);
    setOverrideArmed(false);
    lastCheckedRef.current = { email: '', companyId: '' };

    // Companies list (dropdown + label map)
    const companiesRes = await supabase.from('companies').select('id, company_name').order('company_name', { ascending: true });
    if (!companiesRes.error) {
      const rows = (companiesRes.data || []) as CompanyLite[];
      setAllCompanies(rows);
      const map: Record<string, string> = {};
      for (const c of rows) map[c.id] = c.company_name || c.id;
      setCompanyMap(map);
    }

    // Contact
    const cRes = await (supabase as any)
      .from('contacts')
      .select(
        `
        id,
        company_id,
        first_name,
        last_name,
        full_name,
        email,
        phone,
        job_title,
        preferred_language,
        is_active,
        newsletter_opt_in,
        do_not_contact,
        notes,
        created_at,
        updated_at
      `,
      )
      .eq('id', id)
      .single();

    if (cRes.error) {
      console.error('Failed to load contact', cRes.error);
      setLoadError(`contacts select failed: ${cRes.error.message}`);
      setContact(null);
      setCompany(null);
      setTags([]);
      setProducts([]);
      setAllTags([]);
      setAllProducts([]);
      setDraftTagIds([]);
      setDraftProductIds([]);
      setLoading(false);
      return;
    }

    const c = cRes.data as Contact;
    setContact(c);

    // Seed edit draft
    setDraftFirstName(c.first_name || '');
    setDraftLastName(c.last_name || '');
    setDraftEmail(c.email || '');
    setDraftCompanyId(c.company_id || '');
    setDraftPhone(c.phone || '');
    setDraftIsActive(!!c.is_active);
    setDraftNewsletter(!!c.newsletter_opt_in);
    setDraftDnc(!!c.do_not_contact);
    setDraftNotes(c.notes || '');

    // Company
    const compRes = await supabase.from('companies').select('id, company_name').eq('id', c.company_id).single();
    if (compRes.error) {
      console.warn('Failed to load company', compRes.error);
      setCompany({ id: c.company_id, company_name: null });
    } else {
      setCompany(compRes.data as CompanyLite);
    }

    // Options
    const [allTagsRes, allProductsRes] = await Promise.all([
      supabase.from('contact_tags').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
      supabase.from('products').select('id, name, slug, sort_order').order('sort_order', { ascending: true }),
    ]);

    if (allTagsRes.error) console.warn('Failed to load contact_tags', allTagsRes.error);
    if (allProductsRes.error) console.warn('Failed to load products', allProductsRes.error);

    setAllTags(((allTagsRes.data ?? []) as Tag[]).slice().sort(sortByOrderThenName));
    setAllProducts(((allProductsRes.data ?? []) as Product[]).slice().sort(sortByOrderThenName));

    // Assigned (no embedded joins)
    await loadAssignedNoEmbeds(id);

    setLoading(false);
  }

  async function loadAssignedNoEmbeds(contactId: string) {
    const [tagIdsRes, prodIdsRes] = await Promise.all([
      supabase.from('contact_tag_links').select('tag_id').eq('contact_id', contactId),
      supabase.from('contact_product_links').select('product_id').eq('contact_id', contactId),
    ]);

    const tagIds = ((tagIdsRes.data ?? []) as any[]).map((r) => r.tag_id).filter(Boolean) as string[];
    const productIds = ((prodIdsRes.data ?? []) as any[]).map((r) => r.product_id).filter(Boolean) as string[];

    if (tagIds.length === 0) {
      setTags([]);
      setDraftTagIds([]);
    } else {
      const tRes = await supabase.from('contact_tags').select('id, name, slug, sort_order').in('id', tagIds);
      const t = ((tRes.data ?? []) as Tag[]).slice().sort(sortByOrderThenName);
      setTags(t);
      setDraftTagIds(t.map((x) => x.id));
    }

    if (productIds.length === 0) {
      setProducts([]);
      setDraftProductIds([]);
    } else {
      const pRes = await supabase.from('products').select('id, name, slug, sort_order').in('id', productIds);
      const p = ((pRes.data ?? []) as Product[]).slice().sort(sortByOrderThenName);
      setProducts(p);
      setDraftProductIds(p.map((x) => x.id));
    }
  }

  const title = useMemo(() => {
    if (!contact) return 'Contact';
    return safeName(contact);
  }, [contact]);

  const subtitle = useMemo(() => {
    if (!contact) return '';
    const cn = company?.company_name || company?.id || contact.company_id;
    return `${cn}${contact.job_title ? ` • ${contact.job_title}` : ''}`;
  }, [contact, company]);

  const right = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      <button type="button" style={actionButtonStyle('ghost')} onClick={() => (id ? load() : null)}>
        Refresh
      </button>

      {contact ? (
        <Link href={`/companies/${contact.company_id}`} style={actionButtonStyle('ghost')}>
          Open Company
        </Link>
      ) : null}
    </div>
  );

  function toggleDraft(list: string[], value: string) {
    const s = new Set(list);
    if (s.has(value)) s.delete(value);
    else s.add(value);
    return Array.from(s);
  }

  // -------- Duplicate detection (Edit) --------
  async function checkDuplicatesEdit(reason: 'blur' | 'save' | 'manual') {
    if (!editContact) return;

    const em = normalizeEmail(draftEmail);
    const cid = (draftCompanyId || '').trim();

    // no email => no duplicates
    if (!em) {
      setDupLoading(false);
      setDupsSameCompany([]);
      setDupsOtherCompanies([]);
      lastCheckedRef.current = { email: '', companyId: '' };
      return;
    }

    // avoid re-query if unchanged
    if (lastCheckedRef.current.email === em && lastCheckedRef.current.companyId === cid && reason !== 'manual') {
      return;
    }

    setDupLoading(true);
    try {
      const res = await supabase.from('contacts').select('id, company_id, full_name, email').ilike('email', em).limit(25);
      if (res.error) throw res.error;

      // exclude self
      const matches = ((res.data || []) as ContactDup[]).filter((r) => r.id !== id);

      const same: ContactDup[] = [];
      const other: ContactDup[] = [];
      for (const m of matches) {
        if (cid && m.company_id === cid) same.push(m);
        else other.push(m);
      }

      setDupsSameCompany(same);
      setDupsOtherCompanies(other);

      lastCheckedRef.current = { email: em, companyId: cid };
      setDupLoading(false);
    } catch (e) {
      console.warn('Duplicate check failed', e);
      setDupLoading(false);
      setDupsSameCompany([]);
      setDupsOtherCompanies([]);
    }
  }

  const hasDuplicatesEdit = useMemo(
    () => dupsSameCompany.length > 0 || dupsOtherCompanies.length > 0,
    [dupsSameCompany.length, dupsOtherCompanies.length],
  );

  // ---------- Contact edit ----------
  function startEditContact() {
    if (!contact) return;
    setEditContact(true);

    setDraftFirstName(contact.first_name || '');
    setDraftLastName(contact.last_name || '');
    setDraftEmail(contact.email || '');
    setDraftCompanyId(contact.company_id || '');
    setDraftPhone(contact.phone || '');
    setDraftIsActive(!!contact.is_active);
    setDraftNewsletter(!!contact.newsletter_opt_in);
    setDraftDnc(!!contact.do_not_contact);
    setDraftNotes(contact.notes || '');

    // reset dup state
    setDupsSameCompany([]);
    setDupsOtherCompanies([]);
    setDupLoading(false);
    setOverrideArmed(false);
    lastCheckedRef.current = { email: '', companyId: '' };
  }

  function cancelEditContact() {
    setEditContact(false);
    setSavingContact(false);

    // reset dup state
    setDupsSameCompany([]);
    setDupsOtherCompanies([]);
    setDupLoading(false);
    setOverrideArmed(false);
    lastCheckedRef.current = { email: '', companyId: '' };

    if (!contact) return;

    setDraftFirstName(contact.first_name || '');
    setDraftLastName(contact.last_name || '');
    setDraftEmail(contact.email || '');
    setDraftCompanyId(contact.company_id || '');
    setDraftPhone(contact.phone || '');
    setDraftIsActive(!!contact.is_active);
    setDraftNewsletter(!!contact.newsletter_opt_in);
    setDraftDnc(!!contact.do_not_contact);
    setDraftNotes(contact.notes || '');
  }

  async function saveContactEdits() {
    if (!id || !contact) return;

    const first = draftFirstName.trim();
    const last = draftLastName.trim();
    const emailNorm = normalizeEmail(draftEmail);
    const companyId = draftCompanyId.trim();

    if (!companyId) {
      alert('Company is required.');
      return;
    }

    setSavingContact(true);

    try {
      // Duplicate check on save
      await checkDuplicatesEdit('save');

      if (emailNorm && hasDuplicatesEdit && !overrideArmed) {
        setOverrideArmed(true);
        alert('Duplicate email detected. Review matches and click Save again to confirm.');
        setSavingContact(false);
        return;
      }

      const fullName = `${first} ${last}`.trim();

      const upd = await (supabase as any)
        .from('contacts')
        .update({
          first_name: first,
          last_name: last,
          full_name: fullName,
          email: emailNorm || null,
          phone: draftPhone.trim() || null,
          company_id: companyId,
          is_active: draftIsActive,
          newsletter_opt_in: draftNewsletter,
          do_not_contact: draftDnc,
          notes: draftNotes || '',
        })
        .eq('id', id);

      if (upd.error) throw upd.error;

      await load();
      setEditContact(false);
      setSavingContact(false);
    } catch (e: any) {
      console.error(e);
      alert(`Could not save contact: ${e?.message || 'Unknown error'}`);
      setSavingContact(false);
    }
  }

  // ---------- Tags/products edit ----------
  function startEditMeta() {
    setEditMeta(true);
    setDraftTagIds(tags.map((t) => t.id));
    setDraftProductIds(products.map((p) => p.id));
  }

  function cancelEditMeta() {
    setEditMeta(false);
    setSavingMeta(false);
    setDraftTagIds(tags.map((t) => t.id));
    setDraftProductIds(products.map((p) => p.id));
  }

  async function saveMeta() {
    if (!id) return;
    setSavingMeta(true);

    const currentTagIds = tags.map((t) => t.id);
    const currentProductIds = products.map((p) => p.id);

    const nextTagIds = uniq(draftTagIds);
    const nextProductIds = uniq(draftProductIds);

    const tagToAdd = nextTagIds.filter((x) => !currentTagIds.includes(x));
    const tagToRemove = currentTagIds.filter((x) => !nextTagIds.includes(x));

    const prodToAdd = nextProductIds.filter((x) => !currentProductIds.includes(x));
    const prodToRemove = currentProductIds.filter((x) => !nextProductIds.includes(x));

    try {
      if (tagToRemove.length > 0) {
        const del = await supabase.from('contact_tag_links').delete().eq('contact_id', id).in('tag_id', tagToRemove);
        if (del.error) throw del.error;
      }

      if (tagToAdd.length > 0) {
        const ins = await supabase.from('contact_tag_links').insert(tagToAdd.map((tagId) => ({ contact_id: id, tag_id: tagId })));
        if (ins.error) throw ins.error;
      }

      if (prodToRemove.length > 0) {
        const del = await supabase.from('contact_product_links').delete().eq('contact_id', id).in('product_id', prodToRemove);
        if (del.error) throw del.error;
      }

      if (prodToAdd.length > 0) {
        const ins = await supabase.from('contact_product_links').insert(prodToAdd.map((productId) => ({ contact_id: id, product_id: productId })));
        if (ins.error) throw ins.error;
      }

      await loadAssignedNoEmbeds(id);

      setEditMeta(false);
      setSavingMeta(false);
    } catch (e: any) {
      console.error(e);
      alert(`Could not save tags/products: ${e?.message || 'Unknown error'}`);
      setSavingMeta(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: 16, background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)', minHeight: '100vh' }}>
      <PageHeader title={title} subtitle={loading ? 'Loading…' : subtitle} right={right} />

      {loading ? (
        <div style={{ ...cardStyle(), color: UI.muted }}>Loading contact…</div>
      ) : loadError ? (
        <div style={{ ...cardStyle(), color: UI.text }}>
          <div style={{ fontWeight: 800 }}>Could not load contact</div>
          <div style={{ marginTop: 6, fontSize: 12, color: UI.muted }}>{loadError}</div>
        </div>
      ) : !contact ? (
        <div style={{ ...cardStyle(), color: UI.muted }}>Contact not found.</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* CONTACT CARD */}
          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: UI.muted, fontWeight: 750 }}>Contact</div>
                <div style={{ fontSize: 12, color: UI.muted, marginTop: 4 }}>
                  Edit identity + company assignment. Email is duplicate-checked.
                </div>
              </div>

              {!editContact ? (
                <button type="button" style={actionButtonStyle('ghost')} onClick={startEditContact}>
                  Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" style={actionButtonStyle('ghost')} onClick={cancelEditContact} disabled={savingContact}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={actionButtonStyle('primary')}
                    onClick={saveContactEdits}
                    disabled={savingContact}
                    title={hasDuplicatesEdit ? 'Duplicates detected — requires confirmation.' : 'Save'}
                  >
                    {savingContact
                      ? 'Saving…'
                      : hasDuplicatesEdit
                        ? overrideArmed
                          ? 'Save (confirmed)'
                          : 'Save (requires confirm)'
                        : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {!editContact ? (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={labelStyle()}>Name</div>
                    <div style={{ ...valueStyle(), fontWeight: 750 }}>{safeName(contact)}</div>
                  </div>
                  <div>
                    <div style={labelStyle()}>Company</div>
                    <div style={{ ...valueStyle(), fontWeight: 750 }}>{company?.company_name || contact.company_id}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={labelStyle()}>Email</div>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        style={{ color: UI.link, fontWeight: 700, textDecoration: 'none' }}
                        onMouseEnter={(e) => ((e.currentTarget.style.color as any) = UI.linkHover)}
                        onMouseLeave={(e) => ((e.currentTarget.style.color as any) = UI.link)}
                      >
                        {contact.email}
                      </a>
                    ) : (
                      <div style={{ ...valueStyle(), fontWeight: 650 }}>—</div>
                    )}
                  </div>
                  <div>
                    <div style={labelStyle()}>Phone</div>
                    <div style={{ ...valueStyle(), fontWeight: 650 }}>{contact.phone || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={badge(contact.is_active ? UI.soft : '#fff', UI.text)}>{contact.is_active ? 'Active' : 'Inactive'}</span>
                  <span style={badge(contact.newsletter_opt_in ? UI.soft : '#fff', UI.text)}>
                    Newsletter: {contact.newsletter_opt_in ? 'Opt-in' : 'No'}
                  </span>
                  <span style={badge(contact.do_not_contact ? UI.soft : '#fff', UI.text)}>
                    Do not contact: {contact.do_not_contact ? 'Yes' : 'No'}
                  </span>
                  <span style={badge(UI.soft, UI.text)}>Language: {contact.preferred_language || 'en'}</span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={labelStyle()}>First name</div>
                    <input
                      style={inputStyle()}
                      value={draftFirstName}
                      onChange={(e) => setDraftFirstName(e.target.value)}
                      placeholder="First name"
                      disabled={savingContact}
                    />
                  </div>
                  <div>
                    <div style={labelStyle()}>Last name</div>
                    <input
                      style={inputStyle()}
                      value={draftLastName}
                      onChange={(e) => setDraftLastName(e.target.value)}
                      placeholder="Last name"
                      disabled={savingContact}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={labelStyle()}>Email</div>
                    <input
                      style={inputStyle()}
                      value={draftEmail}
                      onChange={(e) => {
                        setDraftEmail(e.target.value);
                        setOverrideArmed(false);
                        setDupsSameCompany([]);
                        setDupsOtherCompanies([]);
                      }}
                      onBlur={() => checkDuplicatesEdit('blur')}
                      placeholder="email@company.com"
                      disabled={savingContact}
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: UI.muted, fontWeight: 600 }}>
                      {dupLoading ? 'Checking duplicates…' : normalizeEmail(draftEmail) ? 'Click outside the email field to check duplicates.' : '—'}
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle()}>Phone</div>
                    <input
                      style={inputStyle()}
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      placeholder="+40…"
                      disabled={savingContact}
                    />
                  </div>
                </div>

                <div>
                  <div style={labelStyle()}>Company</div>
                  <select
                    style={inputStyle()}
                    value={draftCompanyId}
                    onChange={(e) => {
                      setDraftCompanyId(e.target.value);
                      setOverrideArmed(false);
                      setDupsSameCompany([]);
                      setDupsOtherCompanies([]);
                    }}
                    disabled={savingContact}
                  >
                    <option value="">Select company…</option>
                    {allCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name || c.id}
                      </option>
                    ))}
                  </select>
                </div>

                {(dupsSameCompany.length > 0 || dupsOtherCompanies.length > 0) && (
                  <div style={{ border: `1px solid ${UI.border}`, borderRadius: 12, padding: 12, background: UI.soft }}>
                    <div style={{ fontWeight: 750, color: UI.text }}>Possible duplicate email</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: UI.muted }}>
                      Save is allowed, but requires confirmation (arm override or save twice).
                    </div>

                    {dupsSameCompany.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>
                          Same company ({dupsSameCompany.length})
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {dupsSameCompany.map((d) => (
                            <Link
                              key={d.id}
                              href={`/contacts/${d.id}`}
                              style={{
                                textDecoration: 'none',
                                color: UI.text,
                                border: `1px solid ${UI.border}`,
                                borderRadius: 12,
                                padding: 10,
                                background: '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {safeLabel(d.full_name)} <span style={{ color: UI.muted, fontWeight: 600 }}>• {safeLabel(d.email)}</span>
                              </div>
                              <span style={{ color: UI.muted, fontWeight: 650 }}>View</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {dupsOtherCompanies.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: UI.muted, fontWeight: 700, marginBottom: 6 }}>
                          Other companies ({dupsOtherCompanies.length})
                        </div>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {dupsOtherCompanies.map((d) => (
                            <Link
                              key={d.id}
                              href={`/contacts/${d.id}`}
                              style={{
                                textDecoration: 'none',
                                color: UI.text,
                                border: `1px solid ${UI.border}`,
                                borderRadius: 12,
                                padding: 10,
                                background: '#fff',
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <div style={{ fontWeight: 700 }}>
                                {safeLabel(d.full_name)} <span style={{ color: UI.muted, fontWeight: 600 }}>• {safeLabel(d.email)}</span>
                                <div style={{ marginTop: 4, fontSize: 12, color: UI.muted, fontWeight: 600 }}>
                                  Company: {companyMap[d.company_id] || d.company_id}
                                </div>
                              </div>
                              <span style={{ color: UI.muted, fontWeight: 650 }}>View</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" style={actionButtonStyle('ghost')} onClick={() => checkDuplicatesEdit('manual')} disabled={dupLoading || savingContact}>
                        Re-check
                      </button>
                      <button type="button" style={chip(overrideArmed)} onClick={() => setOverrideArmed((v) => !v)} disabled={savingContact}>
                        {overrideArmed ? 'Override armed' : 'Arm override'}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" style={chip(draftIsActive)} onClick={() => setDraftIsActive((v) => !v)} disabled={savingContact}>
                    Active
                  </button>
                  <button type="button" style={chip(draftNewsletter)} onClick={() => setDraftNewsletter((v) => !v)} disabled={savingContact}>
                    Newsletter opt-in
                  </button>
                  <button type="button" style={chip(draftDnc)} onClick={() => setDraftDnc((v) => !v)} disabled={savingContact}>
                    Do not contact
                  </button>
                </div>

                <div>
                  <div style={labelStyle()}>Notes</div>
                  <textarea
                    style={textareaStyle()}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Internal notes…"
                    disabled={savingContact}
                  />
                </div>
              </div>
            )}
          </div>

          {/* TAGS + PRODUCTS */}
          <div style={cardStyle()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: UI.muted, fontWeight: 750 }}>Tags & products</div>
                <div style={{ fontSize: 12, color: UI.muted, marginTop: 4 }}>
                  Tags = segmentation (invoicing/newsletters). Products = platform-specific outreach.
                </div>
              </div>

              {!editMeta ? (
                <button type="button" style={actionButtonStyle('ghost')} onClick={startEditMeta}>
                  Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" style={actionButtonStyle('ghost')} onClick={cancelEditMeta} disabled={savingMeta}>
                    Cancel
                  </button>
                  <button type="button" style={actionButtonStyle('primary')} onClick={saveMeta} disabled={savingMeta}>
                    {savingMeta ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {!editMeta ? (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.length === 0 && products.length === 0 ? (
                  <span style={{ fontSize: 13, color: UI.muted }}>—</span>
                ) : (
                  <>
                    {tags.map((t) => (
                      <span key={t.id} style={badge()}>
                        {t.name}
                      </span>
                    ))}
                    {products.map((p) => (
                      <span key={p.id} style={badge()}>
                        {p.name}
                      </span>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <div>
                  <div style={labelStyle()}>Tags</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {allTags.length === 0 ? (
                      <span style={{ fontSize: 13, color: UI.muted }}>No tags available.</span>
                    ) : (
                      allTags.map((t) => {
                        const active = draftTagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            style={chip(active)}
                            onClick={() => setDraftTagIds((prev) => toggleDraft(prev, t.id))}
                            disabled={savingMeta}
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
                  <div style={labelStyle()}>Products</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {allProducts.length === 0 ? (
                      <span style={{ fontSize: 13, color: UI.muted }}>No products available.</span>
                    ) : (
                      allProducts.map((p) => {
                        const active = draftProductIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            style={chip(active)}
                            onClick={() => setDraftProductIds((prev) => toggleDraft(prev, p.id))}
                            disabled={savingMeta}
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}