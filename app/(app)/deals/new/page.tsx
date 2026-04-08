'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

import PageHeader from '../../components/PageHeader';

type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';

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

const FW = { title: 700, strong: 600, normal: 500, body: 400 };
const H = 36;

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];

const STAGE_PROB: Record<DealStage, number> = {
  Lead: 10,
  Qualified: 25,
  Proposal: 50,
  Won: 100,
  Lost: 0,
};

const OWNERS = ['Corina', 'Stefania', 'Raluca'] as const;
const CURRENCIES = ['EUR', 'USD', 'RON', 'HUF', 'CZK', 'PLN'] as const;

const PRODUCT = {
  DV360: 'DV360',
  CM360: 'CM360',
  GA4_360: 'GA4 360',
  SA360: 'SA360',

  TIKTOK: 'Tik Tok',
  TEADS: 'Teads',
  GOOGLE_ADS: 'Google Ads',
  FACEBOOK_ADS: 'Facebook Ads',
  TABOOLA: 'Taboola',
  FOOTPRINTS_AI: 'Footprints AI',
  IAS: 'IAS',
  PROJECT_AGORA: 'Project Agora',
  HTTPPOOL: 'HTTPOOL',
  MEDIA_SERVICES: 'Media Services',
} as const;

type ProductKey = keyof typeof PRODUCT;

// UI grouping (SA360 stays CORE)
const CORE_PRODUCTS_UI: ProductKey[] = ['DV360', 'CM360', 'GA4_360', 'SA360'];
const MEDIA_PRODUCTS_UI: ProductKey[] = [
  'TIKTOK',
  'TEADS',
  'GOOGLE_ADS',
  'FACEBOOK_ADS',
  'TABOOLA',
  'FOOTPRINTS_AI',
  'IAS',
  'PROJECT_AGORA',
  'HTTPPOOL',
  'MEDIA_SERVICES',
];

// Fee model: only media products go into the media fee section.
// SA360 will have its own dedicated fee card (like DV/CM/GA4).
const MEDIA_PCT_FEE_PRODUCTS: ProductKey[] = [...MEDIA_PRODUCTS_UI];

type FeeConfig = {
  dv360?: { exchange_rate_pct?: number | null; non_exchange_rate_pct?: number | null };
  cm360?: {
    adserving?: number | null;
    video_adserving?: number | null;
    click_tracker?: number | null;
    advanced_display_upcharge?: number | null;
  };
  // Dedicated SA360 block (to render like a core platform)
  sa360?: { percentage_of_media_cost_pct?: number | null };
  // Media products (TikTok, Teads...) each gets its own % field
  media_pct_by_product?: Record<string, number | null>;
  ga4_360?: {
    tier_0_25m?: number | null;
    tier_25m_500m?: number | null;
    tier_500m_1b?: number | null;
    tier_1b_2b?: number | null;
    tier_2b_plus?: number | null;
    service_fee?: number | null;
  };
};

type CompanyLite = { id: string; company_name: string | null };

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        border: `1px solid ${UI.border}`,
        borderRadius: 12,
        background: UI.bg,
        padding: 12,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        height: H,
        padding: '0 12px',
        borderRadius: 12,
        border: `1px solid ${disabled ? UI.border : '#d1d5db'}`,
        background: disabled ? UI.soft : '#fff',
        fontSize: 13,
        fontWeight: FW.body,
        color: UI.text,
        outline: 'none',
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
        borderRadius: 999,
        border: '1px solid #d1d5db',
        background: '#fff',
        fontSize: 13,
        color: UI.text,
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      {children}
    </select>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  type = 'button',
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit';
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
    boxSizing: 'border-box',
    transition: 'all 150ms ease',
  };

  const style: React.CSSProperties =
    variant === 'primary'
      ? { ...base, border: 'none', background: disabled ? UI.muted : (isHovered ? UI.primaryBtnHover : UI.primaryBtn), color: '#fff' }
      : { ...base, border: `1px solid ${UI.border}`, background: isHovered ? UI.soft : '#fff', color: UI.text };

  return (
    <button
      type={type}
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

function CheckboxRow({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        borderRadius: 10,
        border: `1px solid ${UI.border}`,
        background: checked ? UI.soft : '#fff',
        cursor: 'pointer',
        boxSizing: 'border-box',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1px solid ${checked ? UI.primaryBtn : '#d1d5db'}`,
          background: checked ? UI.primaryBtn : '#fff',
          display: 'inline-block',
          boxSizing: 'border-box',
        }}
      />
      <span style={{ fontSize: 13, color: UI.text, fontWeight: checked ? FW.strong : FW.body }}>{label}</span>
    </button>
  );
}

function toNumberOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return n;
}

export default function Page() {
  const router = useRouter();

  const [companies, setCompanies] = useState<CompanyLite[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Core fields
  const [dealName, setDealName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [owner, setOwner] = useState<(typeof OWNERS)[number] | ''>('');
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>('EUR');
  const [stage, setStage] = useState<DealStage>('Lead');
  const [probability, setProbability] = useState<number>(STAGE_PROB['Lead']);
  const [value, setValue] = useState('');
  const [mainCosts, setMainCosts] = useState('');

  // NEW: Next step fields (optional)
  const [nextStep, setNextStep] = useState('');
  const [followUpDate, setFollowUpDate] = useState(''); // YYYY-MM-DD
  const [expectedClose, setExpectedClose] = useState(''); // YYYY-MM-DD

  // Products
  const [selectedProducts, setSelectedProducts] = useState<ProductKey[]>([]);

  // Fee fields
  const [dvEx, setDvEx] = useState('');
  const [dvNonEx, setDvNonEx] = useState('');

  const [cmAd, setCmAd] = useState('');
  const [cmVid, setCmVid] = useState('');
  const [cmClick, setCmClick] = useState('');
  const [cmUp, setCmUp] = useState('');

  // SA360 dedicated
  const [saPct, setSaPct] = useState('');

  // Media products per-product %
  const [mediaPctMap, setMediaPctMap] = useState<Record<string, string>>({});

  // GA4
  const [ga0, setGa0] = useState('');
  const [ga1, setGa1] = useState('');
  const [ga2, setGa2] = useState('');
  const [ga3, setGa3] = useState('');
  const [ga4, setGa4] = useState('');
  const [gaSvc, setGaSvc] = useState('');

  const showDV360 = selectedProducts.includes('DV360');
  const showCM360 = selectedProducts.includes('CM360');
  const showGA4 = selectedProducts.includes('GA4_360');
  const showSA360 = selectedProducts.includes('SA360');

  const mediaSelected = useMemo(() => MEDIA_PCT_FEE_PRODUCTS.filter((p) => selectedProducts.includes(p)), [selectedProducts]);

  useEffect(() => {
    async function loadCompanies() {
      setLoadingCompanies(true);
      const { data, error } = await supabase.from('companies').select('id, company_name').order('company_name', { ascending: true });
      if (!error) setCompanies((data ?? []) as CompanyLite[]);
      setLoadingCompanies(false);
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    const c = companies.find((x) => x.id === companyId);
    if (c) setCompanyName(c.company_name ?? '');
  }, [companyId, companies]);

  useEffect(() => {
    setProbability(STAGE_PROB[stage]);
  }, [stage]);

  function toggleProduct(k: ProductKey) {
    setSelectedProducts((prev) => {
      const set = new Set(prev);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      return Array.from(set);
    });

    if (MEDIA_PCT_FEE_PRODUCTS.includes(k)) {
      setMediaPctMap((prev) => {
        const next = { ...prev };
        if (!(k in next)) next[k] = '';
        return next;
      });
    }
  }

  function buildFeeConfig(): FeeConfig {
    const cfg: FeeConfig = {};

    if (showDV360) cfg.dv360 = { exchange_rate_pct: toNumberOrNull(dvEx), non_exchange_rate_pct: toNumberOrNull(dvNonEx) };

    if (showCM360) {
      cfg.cm360 = {
        adserving: toNumberOrNull(cmAd),
        video_adserving: toNumberOrNull(cmVid),
        click_tracker: toNumberOrNull(cmClick),
        advanced_display_upcharge: toNumberOrNull(cmUp),
      };
    }

    if (showSA360) {
      cfg.sa360 = { percentage_of_media_cost_pct: toNumberOrNull(saPct) };
    }

    if (mediaSelected.length > 0) {
      const map: Record<string, number | null> = {};
      for (const p of mediaSelected) map[p] = toNumberOrNull(mediaPctMap[p] ?? '');
      cfg.media_pct_by_product = map;
    }

    if (showGA4) {
      cfg.ga4_360 = {
        tier_0_25m: toNumberOrNull(ga0),
        tier_25m_500m: toNumberOrNull(ga1),
        tier_500m_1b: toNumberOrNull(ga2),
        tier_1b_2b: toNumberOrNull(ga3),
        tier_2b_plus: toNumberOrNull(ga4),
        service_fee: toNumberOrNull(gaSvc),
      };
    }

    return cfg;
  }

  const isValid = useMemo(() => {
    if (!dealName.trim()) return false;
    if (!companyId && !companyName.trim()) return false;
    return true;
  }, [dealName, companyId, companyName]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!isValid) {
      setErrorMsg('Please fill: Deal name + Company (select or type).');
      return;
    }

    const parsedValue = value.trim() ? Number(value) : null;
    if (value.trim() && (Number.isNaN(parsedValue) || parsedValue! < 0)) {
      setErrorMsg('Value must be a valid number.');
      return;
    }

    const parsedMainCosts = mainCosts.trim() ? Number(mainCosts) : null;
    if (mainCosts.trim() && (Number.isNaN(parsedMainCosts) || parsedMainCosts! < 0)) {
      setErrorMsg('Main costs must be a valid number.');
      return;
    }

    // NEW: optional next-step fields
    const nextStepClean = nextStep.trim() ? nextStep.trim() : null;
    const followUpClean = followUpDate.trim() ? followUpDate.trim() : null;

    const payload: any = {
      deal_name: dealName.trim(),
      company_id: companyId || null,
      company_name: (companyId ? companyName : companyName.trim()) || null,
      owner: owner || null,
      stage,
      value: parsedValue,
      currency,
      probability,
      services: selectedProducts,
      main_costs: parsedMainCosts,
      fee_config: buildFeeConfig(),

      // NEW
      next_step: nextStepClean,
      follow_up_date: followUpClean,
      expected_close_date: expectedClose.trim() || null,
    };

    setSaving(true);
    const { data, error } = await supabase.from('deals').insert([payload]).select('id').single();
    setSaving(false);

    if (error) {
      setErrorMsg(`Could not save deal. ${error.message}`);
      return;
    }

    router.push(`/deals/${data.id}`);
  }

  return (
    <div style={{ padding: 16, boxSizing: 'border-box' }}>
      <PageHeader
        title="New deal"
        subtitle="Create a deal with products + structured fees"
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link
              href="/deals"
              style={{
                height: H,
                padding: '0 12px',
                borderRadius: 999,
                border: `1px solid ${UI.border}`,
                background: '#fff',
                color: UI.text,
                textDecoration: 'none',
                fontWeight: FW.strong,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box',
              }}
            >
              Back
            </Link>
          </div>
        }
      />

      {errorMsg ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: '1px solid #fecaca',
            background: '#fff1f2',
            color: '#991b1b',
            fontWeight: FW.strong,
            whiteSpace: 'pre-wrap',
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <form onSubmit={handleCreate} style={{ marginTop: 12, display: 'grid', gap: 12 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text, marginBottom: 10 }}>Deal details</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Deal name</div>
              <Input value={dealName} onChange={setDealName} placeholder="e.g. Kaizen Q1 Renewal" />
            </div>

            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Company (select)</div>
              <Select value={companyId} onChange={setCompanyId}>
                <option value="">{loadingCompanies ? 'Loading companies…' : 'Select a company'}</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name ?? '(Unnamed)'}
                  </option>
                ))}
              </Select>
              <div style={{ marginTop: 6, fontSize: 12, color: UI.muted }}>If not in list, leave unselected and type the name below.</div>
            </div>

            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Company name (manual)</div>
              <Input value={companyName} onChange={setCompanyName} placeholder="Company name" disabled={!!companyId} />
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Owner</div>
              <Select value={owner} onChange={(v) => setOwner(v as any)}>
                <option value="">Select owner</option>
                {OWNERS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Currency</div>
              <Select value={currency} onChange={(v) => setCurrency(v as any)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Stage</div>
              <Select value={stage} onChange={(v) => setStage(v as DealStage)}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Probability</div>
              <Input value={`${probability}`} onChange={() => {}} disabled />
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Value</div>
              <Input value={value} onChange={setValue} type="number" placeholder={`e.g. 25000 (${currency})`} />
              <div style={{ marginTop: 4, fontSize: 11, color: UI.muted, lineHeight: 1.4 }}>
                Total revenue to Sense8 (tech fee + managed service).
              </div>
            </div>

            <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Main costs</div>
              <Input value={mainCosts} onChange={setMainCosts} type="number" placeholder="e.g. 12000" />
              <div style={{ marginTop: 4, fontSize: 11, color: UI.muted, lineHeight: 1.4 }}>
                Direct costs to close (media, partner fees). GP = Value − Main costs.
              </div>
            </div>
          </div>
        </Card>

        {/* ✅ Lightweight Next Step card (optional on creation) */}
        <Card style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>Next step (optional)</div>
            <div style={{ fontSize: 12, color: UI.muted }}>What’s next + when to follow up</div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 8', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>What is the next action</div>
              <Input value={nextStep} onChange={setNextStep} placeholder="e.g. Send proposal + schedule review call" />
            </div>

            <div style={{ gridColumn: 'span 4', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Follow-up date</div>
              <Input value={followUpDate} onChange={setFollowUpDate} type="date" />
            </div>

            <div style={{ gridColumn: 'span 4', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>Expected close date</div>
              <Input value={expectedClose} onChange={setExpectedClose} type="date" />
            </div>
          </div>
        </Card>

        {/* ... rest of your file unchanged (Products + Fees + Submit) ... */}

        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text, marginBottom: 10 }}>Products</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 8 }}>Core products</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {CORE_PRODUCTS_UI.map((k) => (
                  <CheckboxRow key={k} checked={selectedProducts.includes(k)} label={PRODUCT[k]} onToggle={() => toggleProduct(k)} />
                ))}
              </div>
            </div>

            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <div style={{ fontSize: 12, color: UI.muted, marginBottom: 8 }}>Media-based products</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {MEDIA_PRODUCTS_UI.map((k) => (
                  <CheckboxRow key={k} checked={selectedProducts.includes(k)} label={PRODUCT[k]} onToggle={() => toggleProduct(k)} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* Fees card remains exactly as you had it */}
        {/* ... your Fees section stays unchanged ... */}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="primary" disabled={saving || !isValid}>
            {saving ? 'Creating…' : 'Create deal'}
          </Button>
        </div>

        <div style={{ fontSize: 12, color: UI.muted }}>
          If you see a “missing column” error, your Supabase <b>deals</b> table may not have: <b>currency</b>, <b>probability</b>, <b>services</b>, <b>main_costs</b>, <b>fee_config</b>, <b>next_step</b>, <b>follow_up_date</b>.
          If that happens, paste the error and I’ll give you the exact SQL migration.
        </div>
      </form>
    </div>
  );
}