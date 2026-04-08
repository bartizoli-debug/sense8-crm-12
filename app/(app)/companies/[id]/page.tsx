'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import PageHeader from '../../components/PageHeader';
import CreateContactModal from '../../components/CreateContactModal';

type TabKey = 'overview' | 'deals' | 'contracts' | 'contacts';

interface Company {
  id: string;
  created_at: string;
  company_name: string;

  legal_name: string | null;
  end_client_name: string | null;
  country_of_registration: string | null;
  address: string | null;
  vat_number: string | null;
  corporate_registration_number: string | null;
  bank_account_number: string | null;
  bank_name: string | null;

  payment_type?: string | null;
  payment_term?: string | null;
}

interface Deal {
  id: string;
  created_at: string;
  deal_name: string | null;
  stage: string | null;
  owner: string | null;
  value: number | null;
  company_id: string | null;
}

interface Contract {
  id: string;
  created_at: string;
  contract_number: string | null;
  status: string | null;
  contract_type: string | null;
  expiry_date: string | null;
  contract_owner: string | null;
  company_id: string | null;
}

interface Contact {
  id: string;
  created_at: string;
  company_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  seniority: string | null;
  preferred_language: string;
  is_active: boolean;
  newsletter_opt_in: boolean;
  do_not_contact: boolean;
}

type ContactTag = { id: string; name: string; slug: string; sort_order: number };
type Product = { id: string; name: string; slug: string; sort_order: number };

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
  dangerBg: '#fff5f5',
  shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 8px rgba(0, 0, 0, 0.08)',
};

const FW = { title: 700, strong: 600, normal: 500, body: 500 };
const H = 42;

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

function Button({
  children,
  href,
  onClick,
  disabled,
  variant = 'secondary',
  title,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  title?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const base: React.CSSProperties = {
    height: H,
    padding: '0 14px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
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
      ? { ...base, border: 'none', background: disabled ? UI.muted : (isHovered ? UI.primaryBtnHover : UI.primaryBtn), color: '#fff' }
      : { ...base, border: `1px solid ${UI.border}`, background: isHovered ? UI.soft : '#fff', color: UI.text };

  if (href) {
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
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

function TabPill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: H,
        padding: '0 12px',
        borderRadius: 999,
        border: `1px solid ${active ? UI.primaryBtn : UI.border}`,
        background: active ? UI.primaryBtn : '#fff',
        color: active ? '#fff' : UI.text,
        fontSize: 13,
        fontWeight: FW.strong,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: FW.strong, color: UI.secondary }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: H,
          borderRadius: 10,
          border: `1px solid ${UI.border}`,
          padding: '0 10px',
          fontSize: 13,
          outline: 'none',
          background: '#fff',
          color: UI.text,
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: FW.strong, color: UI.secondary }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          borderRadius: 10,
          border: `1px solid ${UI.border}`,
          padding: 10,
          fontSize: 13,
          outline: 'none',
          background: '#fff',
          color: UI.text,
          width: '100%',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: UI.muted, fontWeight: FW.strong }}>{label}</div>
      <div style={{ fontSize: 13, color: UI.text, fontWeight: FW.normal, wordBreak: 'break-word' }}>{value || '—'}</div>
    </div>
  );
}

function SmallStatusPill({
  type,
  text,
  onClose,
}: {
  type: 'success' | 'error';
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
        padding: '0 10px',
        borderRadius: 999,
        border: `1px solid ${UI.border}`,
        background: type === 'success' ? UI.soft : UI.dangerBg,
        color: UI.text,
        fontSize: 12,
        fontWeight: FW.strong,
        boxSizing: 'border-box',
        whiteSpace: 'nowrap',
      }}
      title={text}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          height: 20,
          width: 20,
          borderRadius: 999,
          border: `1px solid ${UI.border}`,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          lineHeight: '18px',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

function formatCurrency(v?: number | null) {
  return v == null ? '—' : `${v.toLocaleString('en-US')} EUR`;
}

function formatDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
}

function displayName(c: Pick<Contact, 'full_name' | 'first_name' | 'last_name'>) {
  const n = (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unnamed').trim();
  return n || 'Unnamed';
}

export default function CompanyDetailPage() {
  const params = useParams();
  const companyId = params?.id as string;

  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);

  const [company, setCompany] = useState<Company | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tagByContactId, setTagByContactId] = useState<Record<string, ContactTag[]>>({});
  const [productByContactId, setProductByContactId] = useState<Record<string, Product[]>>({});

  const [createContactOpen, setCreateContactOpen] = useState(false);

  const [derivedProducts, setDerivedProducts] = useState<string[]>([]);
  const [derivedPaymentType, setDerivedPaymentType] = useState<string | null>(null);
  const [derivedPaymentTerm, setDerivedPaymentTerm] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);

  const [saveBanner, setSaveBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const saveBannerTimerRef = useRef<number | null>(null);

  const [formCompanyName, setFormCompanyName] = useState('');
  const [formLegalName, setFormLegalName] = useState('');
  const [formEndClientName, setFormEndClientName] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formVat, setFormVat] = useState('');
  const [formCorpReg, setFormCorpReg] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formBankAccount, setFormBankAccount] = useState('');

  const [hoverKey, setHoverKey] = useState<string | null>(null);

  function showBanner(next: { type: 'success' | 'error'; text: string }) {
    setSaveBanner(next);
    if (saveBannerTimerRef.current) window.clearTimeout(saveBannerTimerRef.current);
    saveBannerTimerRef.current = window.setTimeout(() => setSaveBanner(null), 2200);
  }

  function syncFormFromCompany(c: Company) {
    setFormCompanyName(c.company_name || '');
    setFormLegalName(c.legal_name || '');
    setFormEndClientName(c.end_client_name || '');
    setFormCountry(c.country_of_registration || '');
    setFormAddress(c.address || '');
    setFormVat(c.vat_number || '');
    setFormCorpReg(c.corporate_registration_number || '');
    setFormBankName(c.bank_name || '');
    setFormBankAccount(c.bank_account_number || '');
  }

  const isDirty = useMemo(() => {
    if (!editMode || !company) return false;
    const norm = (v: string | null | undefined) => (v ?? '').trim();
    return (
      norm(formCompanyName) !== norm(company.company_name) ||
      norm(formLegalName) !== norm(company.legal_name) ||
      norm(formEndClientName) !== norm(company.end_client_name) ||
      norm(formCountry) !== norm(company.country_of_registration) ||
      norm(formAddress) !== norm(company.address) ||
      norm(formVat) !== norm(company.vat_number) ||
      norm(formCorpReg) !== norm(company.corporate_registration_number) ||
      norm(formBankName) !== norm(company.bank_name) ||
      norm(formBankAccount) !== norm(company.bank_account_number)
    );
  }, [
    editMode,
    company,
    formCompanyName,
    formLegalName,
    formEndClientName,
    formCountry,
    formAddress,
    formVat,
    formCorpReg,
    formBankName,
    formBankAccount,
  ]);

  function confirmLoseChanges(actionLabel: string) {
    if (!isDirty) return true;
    return window.confirm(`You have unsaved changes. Discard them and ${actionLabel}?`);
  }

  function safeSetTab(next: TabKey) {
    if (next === tab) return;
    if (editMode && isDirty) {
      const ok = confirmLoseChanges('switch tabs');
      if (!ok) return;
      if (company) syncFormFromCompany(company);
      setCompanyError(null);
      setEditMode(false);
    }
    setTab(next);
  }

  function safeNavigate(url: string, actionLabel: string) {
    if (editMode && isDirty) {
      const ok = confirmLoseChanges(actionLabel);
      if (!ok) return;
      if (company) syncFormFromCompany(company);
      setCompanyError(null);
      setEditMode(false);
    }
    // safe, simple, no next/router
    window.location.assign(url);
  }

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!editMode || !isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [editMode, isDirty]);

  async function loadDerivedFromLatestContract(contractRows: Contract[]) {
    const newest = contractRows[0];
    if (!newest) {
      setDerivedProducts([]);
      setDerivedPaymentType(null);
      setDerivedPaymentTerm(null);
      return;
    }

    const payRes = await supabase.from('contracts').select('id, payment_type, payment_term').eq('id', newest.id).single();
    if (!payRes.error) {
      setDerivedPaymentType((payRes.data as any)?.payment_type ?? null);
      setDerivedPaymentTerm((payRes.data as any)?.payment_term ?? null);
    } else {
      setDerivedPaymentType(null);
      setDerivedPaymentTerm(null);
    }

    const platRes = await supabase.from('contract_platforms').select('*').eq('contract_id', newest.id);
    if (platRes.error) {
      setDerivedProducts([]);
      return;
    }

    const rows = (platRes.data || []) as any[];
    const names = rows
      .map((r) => r.platform || r.platform_name || r.name || r.product || r.slug)
      .filter(Boolean)
      .map((v) => String(v));

    setDerivedProducts(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
  }

  async function loadAll() {
    setLoading(true);

    const [cRes, dRes, ctRes, conRes] = await Promise.all([
      (supabase as any)
        .from('companies')
        .select(
          'id, created_at, company_name, legal_name, end_client_name, country_of_registration, address, vat_number, corporate_registration_number, bank_account_number, bank_name, payment_type, payment_term',
        )
        .eq('id', companyId)
        .single(),

      (supabase as any)
        .from('deals')
        .select('id, created_at, deal_name, stage, owner, value, company_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),

      (supabase as any)
        .from('contracts')
        .select('id, created_at, contract_number, status, contract_type, expiry_date, contract_owner, company_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),

      (supabase as any)
        .from('contacts')
        .select(
          'id, created_at, company_id, full_name, first_name, last_name, email, phone, job_title, department, seniority, preferred_language, is_active, newsletter_opt_in, do_not_contact',
        )
        .eq('company_id', companyId)
        .order('is_active', { ascending: false })
        .order('full_name', { ascending: true }),
    ]);

    if (cRes.error) {
      console.error(cRes.error);
      alert('Could not load company.');
      setCompany(null);
      setDeals([]);
      setContracts([]);
      setContacts([]);
      setTagByContactId({});
      setProductByContactId({});
      setDerivedProducts([]);
      setDerivedPaymentType(null);
      setDerivedPaymentTerm(null);
      setLoading(false);
      return;
    }

    const companyRow = cRes.data as Company;
    setCompany(companyRow);
    if (!editMode) syncFormFromCompany(companyRow);

    setDeals(((dRes.data || []) as Deal[]) || []);
    const contractRows = ((ctRes.data || []) as Contract[]) || [];
    setContracts(contractRows);

    const contactRows = ((conRes.data || []) as Contact[]) || [];
    setContacts(contactRows);

    await loadDerivedFromLatestContract(contractRows);

    const contactIds = contactRows.map((c) => c.id);
    if (contactIds.length === 0) {
      setTagByContactId({});
      setProductByContactId({});
    } else {
      const [tagLinksRes, prodLinksRes] = await Promise.all([
        (supabase as any)
          .from('contact_tag_links')
          .select('contact_id, contact_tags:tag_id ( id, name, slug, sort_order )')
          .in('contact_id', contactIds),
        (supabase as any)
          .from('contact_product_links')
          .select('contact_id, products:product_id ( id, name, slug, sort_order )')
          .in('contact_id', contactIds),
      ]);

      if (!tagLinksRes.error) {
        const map: Record<string, ContactTag[]> = {};
        for (const row of (tagLinksRes.data || []) as any[]) {
          const cid = row.contact_id as string;
          const tag = row.contact_tags as ContactTag | null;
          if (!tag) continue;
          map[cid] = map[cid] ? [...map[cid], tag] : [tag];
        }
        for (const cid of Object.keys(map)) {
          map[cid].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
        }
        setTagByContactId(map);
      } else {
        setTagByContactId({});
      }

      if (!prodLinksRes.error) {
        const map: Record<string, Product[]> = {};
        for (const row of (prodLinksRes.data || []) as any[]) {
          const cid = row.contact_id as string;
          const prod = row.products as Product | null;
          if (!prod) continue;
          map[cid] = map[cid] ? [...map[cid], prod] : [prod];
        }
        for (const cid of Object.keys(map)) {
          map[cid].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name));
        }
        setProductByContactId(map);
      } else {
        setProductByContactId({});
      }
    }

    setLoading(false);
  }

  useEffect(() => {
    if (!companyId) return;
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function saveCompany() {
    if (!company?.id) {
      setCompanyError('Missing company id. Please refresh and try again.');
      showBanner({ type: 'error', text: 'Not saved' });
      return;
    }

    const name = formCompanyName.trim();
    if (name.length < 2) {
      setCompanyError('Company name must be at least 2 characters.');
      showBanner({ type: 'error', text: 'Check required fields' });
      return;
    }

    setSavingCompany(true);
    setCompanyError(null);

    const payload: Record<string, any> = {
      company_name: name,
      legal_name: formLegalName.trim() || null,
      end_client_name: formEndClientName.trim() || null,
      country_of_registration: formCountry.trim() || null,
      address: formAddress.trim() || null,
      vat_number: formVat.trim() || null,
      corporate_registration_number: formCorpReg.trim() || null,
      bank_name: formBankName.trim() || null,
      bank_account_number: formBankAccount.trim() || null,
    };

    const res = await (supabase as any)
      .from('companies')
      .update(payload)
      .eq('id', company.id)
      .select(
        'id, created_at, company_name, legal_name, end_client_name, country_of_registration, address, vat_number, corporate_registration_number, bank_account_number, bank_name, payment_type, payment_term',
      );

    if (res.error) {
      console.error(res.error);
      setCompanyError(res.error.message || 'Could not save company.');
      showBanner({ type: 'error', text: 'Not saved' });
      setSavingCompany(false);
      return;
    }

    const rows = (res.data || []) as Company[];
    if (rows.length !== 1) {
      setCompanyError('Save failed. Check RLS update policy for companies.');
      showBanner({ type: 'error', text: 'Not saved' });
      setSavingCompany(false);
      return;
    }

    const updated = rows[0];
    setCompany(updated);
    syncFormFromCompany(updated);
    setEditMode(false);
    setSavingCompany(false);
    showBanner({ type: 'success', text: 'Saved ✓' });
  }

  function cancelEdit() {
    if (!company) return;
    if (isDirty) {
      const ok = confirmLoseChanges('cancel editing');
      if (!ok) return;
    }
    setCompanyError(null);
    syncFormFromCompany(company);
    setEditMode(false);
  }

  const summary = useMemo(() => {
    const expiries = contracts.map((c) => c.expiry_date).filter(Boolean) as string[];
    const nextExpiry = expiries.sort()[0];

    // Client health score (0–100)
    const activeContracts = contracts.filter((c) => c.status === 'Active').length;
    const openDeals = deals.filter((d) => ['Lead', 'Qualified', 'Proposal'].includes(d.stage ?? '')).length;
    const hasContact = contacts.length > 0;
    const hasActiveContract = activeContracts > 0;
    const hasOpenDeal = openDeals > 0;

    // Check for expiring contracts in next 60 days
    const today = new Date(); today.setHours(0,0,0,0);
    const in60 = new Date(today.getTime() + 60 * 86400000);
    const expiringContracts = contracts.filter((c) => {
      if (!c.expiry_date || c.status !== 'Active') return false;
      const d = new Date(c.expiry_date);
      return d >= today && d <= in60;
    }).length;

    let score = 0;
    if (hasActiveContract) score += 40;
    if (hasContact) score += 20;
    if (hasOpenDeal) score += 20;
    if (activeContracts > 1) score += 10; // multi-product
    if (expiringContracts === 0 && hasActiveContract) score += 10; // no expiry risk
    if (expiringContracts > 0) score -= 20; // expiry risk penalty

    score = Math.max(0, Math.min(100, score));

    const healthLabel = score >= 70 ? 'Healthy' : score >= 40 ? 'At risk' : 'Critical';
    const healthColor = score >= 70 ? '#166534' : score >= 40 ? '#92400e' : '#991b1b';
    const healthBg = score >= 70 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#fef2f2';
    const healthBorder = score >= 70 ? '#86efac' : score >= 40 ? '#fde68a' : '#fecaca';

    return {
      dealsCount: deals.length,
      contractsCount: contracts.length,
      contactsCount: contacts.length,
      nextExpiry: nextExpiry ? formatDate(nextExpiry) : '—',
      healthScore: score,
      healthLabel,
      healthColor,
      healthBg,
      healthBorder,
      activeContracts,
      openDeals,
      expiringContracts,
    };
  }, [deals, contracts, contacts]);

  if (loading) return <div style={{ padding: 16, background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)', minHeight: '100vh', color: UI.muted, fontSize: 13 }}>Loading company…</div>;

  if (!company) {
    return (
      <div style={{ padding: 16, display: 'grid', gap: 10, background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)', minHeight: '100vh' }}>
        <div style={{ color: UI.text, fontWeight: FW.strong, fontSize: 14 }}>Company not found.</div>
        <Link href="/companies" style={{ textDecoration: 'none', color: UI.link, fontWeight: FW.strong }}>
          ← Back to companies
        </Link>
      </div>
    );
  }

  const paymentType = company.payment_type ?? derivedPaymentType ?? null;
  const paymentTerm = company.payment_term ?? derivedPaymentTerm ?? null;

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12, background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)', minHeight: '100vh' }}>
      <PageHeader
        title={company.company_name}
        subtitle={`Created: ${formatDate(company.created_at)}`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button onClick={() => safeNavigate(`/deals?companyId=${company.id}`, 'go to Deals')} variant="primary">
              + Deal
            </Button>
            <Button onClick={() => safeNavigate(`/contracts?companyId=${company.id}`, 'go to Contracts')}>+ Contract</Button>
            <Button
              onClick={() => {
                if (editMode && isDirty) {
                  const ok = confirmLoseChanges('create a contact');
                  if (!ok) return;
                  syncFormFromCompany(company);
                  setCompanyError(null);
                  setEditMode(false);
                }
                setTab('contacts');
                setCreateContactOpen(true);
              }}
              title="Create a contact for this company"
            >
              + Person
            </Button>
          </div>
        }
      />

      <Card style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabPill active={tab === 'overview'} label="Overview" onClick={() => safeSetTab('overview')} />
          <TabPill active={tab === 'deals'} label={`Deals (${deals.length})`} onClick={() => safeSetTab('deals')} />
          <TabPill active={tab === 'contracts'} label={`Contracts (${contracts.length})`} onClick={() => safeSetTab('contracts')} />
          <TabPill active={tab === 'contacts'} label={`People (${contacts.length})`} onClick={() => safeSetTab('contacts')} />
        </div>
      </Card>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              <StatCard title="Deals" value={String(summary.dealsCount)} />
              <StatCard title="Contracts" value={String(summary.contractsCount)} />
              <StatCard title="Contacts" value={String(summary.contactsCount)} />
              <StatCard title="Next expiry" value={summary.nextExpiry} />
            </div>
          </Card>

          {/* Client health score */}
          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: UI.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                  Client health
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Score circle */}
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                    background: summary.healthBg,
                    border: `2px solid ${summary.healthBorder}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: summary.healthColor, lineHeight: 1 }}>{summary.healthScore}</div>
                    <div style={{ fontSize: 9, color: summary.healthColor, opacity: 0.7 }}>/ 100</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: summary.healthColor }}>{summary.healthLabel}</div>
                    <div style={{ fontSize: 12, color: UI.muted, marginTop: 2 }}>Based on contracts, deals & contacts</div>
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Active contracts', value: summary.activeContracts, ok: summary.activeContracts > 0 },
                  { label: 'Open deals', value: summary.openDeals, ok: summary.openDeals > 0 },
                  { label: 'Expiring soon', value: summary.expiringContracts, ok: summary.expiringContracts === 0, reverse: true },
                ].map(({ label, value, ok, reverse }) => (
                  <div key={label} style={{
                    padding: '8px 12px', borderRadius: 8, textAlign: 'center', minWidth: 80,
                    background: (reverse ? !ok : ok) ? '#f0fdf4' : value === 0 && !reverse ? '#fef2f2' : '#f9fafb',
                    border: `1px solid ${(reverse ? !ok : ok) ? '#86efac' : value === 0 && !reverse ? '#fecaca' : '#e5e7eb'}`,
                  }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: (reverse ? !ok : ok) ? '#166534' : value === 0 && !reverse ? '#991b1b' : '#374151' }}>{value}</div>
                    <div style={{ fontSize: 10, color: UI.muted, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>Company details</div>
                <div style={{ fontSize: 12, color: UI.muted }}>Products/payment are derived from the newest contract (MVP).</div>
              </div>

              {!editMode ? (
                <Button
                  onClick={() => {
                    setCompanyError(null);
                    syncFormFromCompany(company);
                    setEditMode(true);
                  }}
                >
                  Edit
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {isDirty ? (
                    <Pill style={{ background: UI.soft, color: UI.secondary }} title="You have unsaved changes">
                      Unsaved
                    </Pill>
                  ) : null}

                  {saveBanner ? (
                    <SmallStatusPill type={saveBanner.type} text={saveBanner.text} onClose={() => setSaveBanner(null)} />
                  ) : null}

                  <Button onClick={cancelEdit} disabled={savingCompany}>
                    Cancel
                  </Button>

                  <Button variant="primary" onClick={saveCompany} disabled={savingCompany || !isDirty}>
                    {savingCompany ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              )}
            </div>

            {companyError ? (
              <div style={{ marginTop: 10, border: `1px solid ${UI.border}`, background: UI.soft, padding: 10, borderRadius: 12, fontSize: 13 }}>
                <span style={{ fontWeight: FW.strong }}>Error:</span> {companyError}
              </div>
            ) : null}

            {!editMode ? (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <FieldRow label="Legal name" value={company.legal_name || '—'} />
                <FieldRow label="End client name" value={company.end_client_name || '—'} />
                <FieldRow
                  label="Products"
                  value={
                    derivedProducts.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {derivedProducts.map((p) => (
                          <Pill key={p} style={{ background: UI.soft, color: UI.secondary }}>
                            {p}
                          </Pill>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )
                  }
                />
                <FieldRow label="Payment type" value={paymentType || '—'} />
                <FieldRow label="Payment term" value={paymentTerm || '—'} />
                <FieldRow label="Country of registration" value={company.country_of_registration || '—'} />
                <FieldRow label="VAT number" value={company.vat_number || '—'} />
                <FieldRow label="Corporate registration number" value={company.corporate_registration_number || '—'} />
                <FieldRow label="Bank name" value={company.bank_name || '—'} />
                <FieldRow label="Bank account number" value={company.bank_account_number || '—'} />
                <div style={{ gridColumn: '1 / -1' }}>
                  <FieldRow label="Address" value={company.address || '—'} />
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <Input label="Company name *" value={formCompanyName} onChange={setFormCompanyName} />
                  <Input label="Legal name" value={formLegalName} onChange={setFormLegalName} />
                  <Input label="End client name" value={formEndClientName} onChange={setFormEndClientName} />
                  <Input label="Country of registration" value={formCountry} onChange={setFormCountry} />
                  <Input label="VAT number" value={formVat} onChange={setFormVat} />
                  <Input label="Corporate registration number" value={formCorpReg} onChange={setFormCorpReg} />
                  <Input label="Bank name" value={formBankName} onChange={setFormBankName} />
                  <Input label="Bank account number" value={formBankAccount} onChange={setFormBankAccount} />
                  <div style={{ gridColumn: '1 / -1' }}>
                    <TextArea label="Address" value={formAddress} onChange={setFormAddress} />
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'deals' && (
        <Card style={{ padding: 14 }}>
          {deals.length === 0 ? (
            <div style={{ color: UI.muted, fontSize: 13 }}>No deals linked to this company yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deals.map((d) => {
                const key = `deal:${d.id}`;
                const isHover = hoverKey === key;
                return (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    onMouseEnter={() => setHoverKey(key)}
                    onMouseLeave={() => setHoverKey(null)}
                    style={{
                      display: 'block',
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${UI.border}`,
                      background: isHover ? UI.soft : '#fff',
                      textDecoration: 'none',
                      color: UI.text,
                      transition: 'background 120ms ease, transform 120ms ease',
                      transform: isHover ? 'translateY(-1px)' : 'translateY(0px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontWeight: FW.strong, fontSize: 14 }}>{d.deal_name || 'Untitled deal'}</div>
                    <div style={{ fontSize: 12, color: UI.muted, marginTop: 6 }}>
                      Owner: {d.owner || 'Unassigned'} • Stage: {d.stage || '—'} • Value: {formatCurrency(d.value)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'contracts' && (
        <Card style={{ padding: 14 }}>
          {contracts.length === 0 ? (
            <div style={{ color: UI.muted, fontSize: 13 }}>No contracts linked to this company yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contracts.map((c) => {
                const key = `contract:${c.id}`;
                const isHover = hoverKey === key;
                return (
                  <Link
                    key={c.id}
                    href={`/contracts/${c.id}`}
                    onMouseEnter={() => setHoverKey(key)}
                    onMouseLeave={() => setHoverKey(null)}
                    style={{
                      display: 'block',
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${UI.border}`,
                      background: isHover ? UI.soft : '#fff',
                      textDecoration: 'none',
                      color: UI.text,
                      transition: 'background 120ms ease, transform 120ms ease',
                      transform: isHover ? 'translateY(-1px)' : 'translateY(0px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ fontWeight: FW.strong, fontSize: 14 }}>{c.contract_number || '(no contract number)'}</div>
                    <div style={{ fontSize: 12, color: UI.muted, marginTop: 6 }}>
                      Status: {c.status || '—'} • Owner: {c.contract_owner || '—'} • Type: {c.contract_type || '—'} • Expiry: {formatDate(c.expiry_date)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === 'contacts' && (
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: UI.muted, fontWeight: FW.strong }}>
              Contacts for <span style={{ color: UI.text, fontWeight: FW.strong }}>{company.company_name}</span>
            </div>
            <Button onClick={() => setCreateContactOpen(true)}>+ Person</Button>
          </div>

          {contacts.length === 0 ? (
            <div style={{ color: UI.muted, fontSize: 13 }}>No contacts linked to this company yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {contacts.map((c) => {
                const tags = tagByContactId[c.id] ?? [];
                const prods = productByContactId[c.id] ?? [];
                const hasMeta = tags.length > 0 || prods.length > 0;

                const key = `contact:${c.id}`;
                const isHover = hoverKey === key;

                return (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    onMouseEnter={() => setHoverKey(key)}
                    onMouseLeave={() => setHoverKey(null)}
                    style={{
                      display: 'block',
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${UI.border}`,
                      background: isHover ? UI.soft : '#fff',
                      textDecoration: 'none',
                      color: UI.text,
                      transition: 'background 120ms ease, transform 120ms ease',
                      transform: isHover ? 'translateY(-1px)' : 'translateY(0px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: FW.strong, fontSize: 14 }}>{displayName(c)}</span>
                          {!c.is_active ? <Pill style={{ background: UI.soft, color: UI.muted }}>Inactive</Pill> : null}
                          {c.do_not_contact ? <Pill style={{ background: UI.soft, color: UI.muted }}>Do not contact</Pill> : null}
                          {c.newsletter_opt_in ? <Pill style={{ background: UI.soft, color: UI.muted }}>Newsletter</Pill> : null}
                        </div>

                        <div style={{ fontSize: 12, color: UI.muted, marginTop: 6 }}>
                          {c.job_title ? c.job_title : '—'}
                          {c.department ? ` • ${c.department}` : ''}
                          {c.seniority ? ` • ${c.seniority}` : ''}
                        </div>

                        <div style={{ fontSize: 12, color: UI.muted, marginTop: 6 }}>
                          Email: <span style={{ color: UI.text, fontWeight: FW.normal }}>{c.email || '—'}</span>
                          {c.phone ? (
                            <>
                              {' '}
                              • Phone: <span style={{ color: UI.text, fontWeight: FW.normal }}>{c.phone}</span>
                            </>
                          ) : null}
                        </div>

                        {hasMeta ? (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {tags.map((t) => (
                              <Pill key={t.id}>{t.name}</Pill>
                            ))}
                            {prods.map((p) => (
                              <Pill key={p.id}>{p.name}</Pill>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <Pill style={{ background: UI.soft, color: UI.secondary }}>View</Pill>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <CreateContactModal
        open={createContactOpen}
        companyId={company.id}
        companyName={company.company_name}
        onClose={() => setCreateContactOpen(false)}
        onCreated={() => void loadAll()}
      />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${UI.border}`, borderRadius: 12, padding: 12, background: UI.bg, boxSizing: 'border-box' }}>
      <div style={{ color: UI.muted, fontWeight: FW.strong, fontSize: 12 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: FW.title, color: UI.text }}>{value}</div>
    </div>
  );
}