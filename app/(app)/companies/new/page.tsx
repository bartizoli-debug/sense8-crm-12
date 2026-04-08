'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

import PageHeader from '../../components/PageHeader';

const UI = {
  text: '#111827',
  secondary: '#4b5563',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#ffffff',
  soft: '#f9fafb',
  link: '#2563eb',
  primaryBtn: '#2DA745',
  primaryBtnHover: '#248a37',
};

const FW = {
  title: 700,
  strong: 600,
  normal: 500,
  body: 400,
};

const H = 36;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${UI.border}`,
        background: UI.bg,
        boxSizing: 'border-box',
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

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: FW.strong, color: UI.secondary }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: FW.strong, color: UI.secondary }}>{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
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

export default function NewCompanyPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [endClientName, setEndClientName] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [corpRegNumber, setCorpRegNumber] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(() => companyName.trim().length >= 2 && !saving, [companyName, saving]);

  async function onSave() {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    const payload: Record<string, any> = {
      org_id: '28da17d6-06b3-42ed-9381-b5d77f3929a3',
      company_name: companyName.trim(),
      legal_name: legalName.trim() || null,
      end_client_name: endClientName.trim() || null,
      country_of_registration: country.trim() || null,
      address: address.trim() || null,
      vat_number: vatNumber.trim() || null,
      corporate_registration_number: corpRegNumber.trim() || null,
      bank_account_number: bankAccountNumber.trim() || null,
      bank_name: bankName.trim() || null,
    };

    const res = await supabase.from('companies').insert(payload).select('id').single();

    if (res.error) {
      console.error(res.error);
      setError(res.error.message || 'Could not create company.');
      setSaving(false);
      return;
    }

    router.push(`/companies/${res.data.id}`);
  }

  return (
    <div style={{ padding: 16 }}>
      <PageHeader
        title="New Company"
        subtitle="Create a company record"
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button href="/companies">Cancel</Button>
            <Button
              variant="primary"
              onClick={onSave}
              disabled={!canSave}
              title={!canSave ? 'Company name is required' : 'Create company'}
            >
              {saving ? 'Creating…' : 'Create'}
            </Button>
          </div>
        }
      />

      <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        {error ? (
          <div
            style={{
              border: `1px solid ${UI.border}`,
              background: UI.soft,
              padding: 10,
              borderRadius: 12,
              color: UI.text,
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          >
            <span style={{ fontWeight: FW.strong }}>Error:</span> {error}
          </div>
        ) : null}

        <Card>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
              alignItems: 'start',
            }}
          >
            <Input label="Company name *" value={companyName} onChange={setCompanyName} placeholder="e.g. OMD Romania" />
            <Input label="Legal name" value={legalName} onChange={setLegalName} placeholder="Registered legal entity name" />

            <Input label="End client name" value={endClientName} onChange={setEndClientName} placeholder="If agency / intermediary" />
            <Input label="Country of registration" value={country} onChange={setCountry} placeholder="e.g. Romania" />

            <TextArea label="Address" value={address} onChange={setAddress} placeholder="Street, city, zip" />

            <div style={{ display: 'grid', gap: 12 }}>
              <Input label="VAT number" value={vatNumber} onChange={setVatNumber} placeholder="e.g. RO1234567" />
              <Input
                label="Corporate registration number"
                value={corpRegNumber}
                onChange={setCorpRegNumber}
                placeholder="Trade registry / company number"
              />
            </div>

            <Input label="Bank name" value={bankName} onChange={setBankName} placeholder="e.g. OTP Bank" />
            <Input label="Bank account number" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="IBAN / bank account" />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: UI.muted }}>
            Tip: You can fill only the company name now, and complete the rest later.
          </div>
        </Card>
      </div>
    </div>
  );
}