'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

import PageHeader from '../../components/PageHeader';

type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
type ActivityType = 'Call' | 'Email' | 'Meeting' | 'Note';

interface Deal {
  id: string;
  company_id: string | null;
  company_name: string | null;
  deal_name: string | null;
  value: number | null;
  stage: DealStage | null;
  owner: string | null;

  contract_id: number | null;

  currency?: string | null;
  probability?: number | null;
  services?: string[] | string | null;
  main_costs?: number | null;
  fee_config?: any;

  next_step?: string | null;
  follow_up_date?: string | null; // YYYY-MM-DD
  expected_close_date?: string | null; // YYYY-MM-DD
}

interface Activity {
  id: number;
  entity_type: string | null;
  entity_id: string | null;
  activity_type: string | null;
  title: string | null;
  body: string | null;
  due_date: string | null;
  is_done: boolean;
  owner: string | null;
  created_by: string | null;
  created_at: string;
}

interface ContractSummary {
  id: number;
  contract_number?: string | null;
  contract_num?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  contract_type?: string | null;
  contract_owner?: string | null;
  contract_own?: string | null;
}

type TabKey = 'overview' | 'activities';

// --- Constants ---
const STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal', 'Won', 'Lost'];
const ACTIVITY_TYPES: ActivityType[] = ['Call', 'Email', 'Meeting', 'Note'];

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

// --- UI tokens ---
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
  shadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
  shadowMd: '0 4px 8px rgba(0, 0, 0, 0.08)',
};

const FW = { title: 700, strong: 600, normal: 500, body: 500 };
const H = 42;

// ----- Role/claim helpers (client-side UI gating) -----
function getRoleFromSession(session: any): string | null {
  const u = session?.user;
  if (!u) return null;

  const role =
    u?.app_metadata?.crm_role ??
    u?.app_metadata?.role ??
    u?.user_metadata?.crm_role ??
    u?.user_metadata?.role ??
    null;

  if (Array.isArray(role)) return role[0] ?? null;
  return typeof role === 'string' ? role : null;
}

function canEditDeals(role: string | null) {
  return ['admin', 'editor', 'manager', 'sales'].includes((role ?? '').toLowerCase());
}

// ----- Stage SLA -----
type SLAType = 'NONE' | 'SOFT' | 'HARD';

function stageSla(stage: DealStage | null): SLAType {
  if (stage === 'Qualified') return 'SOFT';
  if (stage === 'Proposal' || stage === 'Won' || stage === 'Lost') return 'HARD';
  return 'NONE';
}

// for HARD we block save if missing requireds
function slaMissingForStage(stage: DealStage, nextStep: string, followUpDate: string) {
  const sla = stageSla(stage);

  const nextOk = !!nextStep.trim();

  // Proposal: needs next step + follow-up date
  const followOk = !!followUpDate.trim();

  if (sla === 'HARD') {
    if (stage === 'Proposal') {
      return {
        missingNext: !nextOk,
        missingFollowUp: !followOk,
      };
    }
    // Won/Lost: require a closing next step (e.g. "Signed. Handoff to Billing" / "Lost due to price")
    return {
      missingNext: !nextOk,
      missingFollowUp: false,
    };
  }

  if (sla === 'SOFT') {
    // Soft recommendation: encourage both, but we won’t block
    return {
      missingNext: !nextOk,
      missingFollowUp: !followOk,
    };
  }

  return { missingNext: false, missingFollowUp: false };
}

// --- UI helpers ---
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

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 12, color: UI.muted }}>{subtitle}</div> : null}
    </div>
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
        lineHeight: 1,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  title,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  title?: string;
  type?: 'button' | 'submit';
}) {
  const base: React.CSSProperties = {
    height: H,
    padding: '0 12px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: FW.strong,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.85 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    border: `1px solid ${UI.border}`,
    background: '#fff',
    color: UI.text,
    boxSizing: 'border-box',
  };

  const style: React.CSSProperties =
    variant === 'primary'
      ? { ...base, border: `1px solid ${UI.primaryBtn}`, background: disabled ? UI.muted : UI.primaryBtn, color: '#fff' }
      : base;

  return (
    <button type={type} onClick={onClick} disabled={disabled} style={style} title={title}>
      {children}
    </button>
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
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
      }}
    >
      {label}
    </button>
  );
}

function Select({
  value,
  onChange,
  children,
  size = 'md',
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
}) {
  const isSm = size === 'sm';
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        height: isSm ? 30 : H,
        padding: isSm ? '0 10px' : '0 12px',
        borderRadius: 12,
        border: '1px solid #d1d5db',
        background: disabled ? UI.soft : '#fff',
        fontSize: isSm ? 12 : 13,
        fontWeight: FW.normal,
        color: UI.text,
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    >
      {children}
    </select>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  min,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        width: '100%',
        height: H,
        padding: '0 12px',
        borderRadius: 12,
        border: '1px solid #d1d5db',
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

function Textarea({
  value,
  onChange,
  rows,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid #d1d5db',
        background: disabled ? UI.soft : '#fff',
        fontSize: 13,
        fontWeight: FW.body,
        color: UI.text,
        resize: 'vertical',
        outline: 'none',
        boxSizing: 'border-box',
        minWidth: 0,
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: UI.muted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function CheckboxRow({
  checked,
  label,
  onToggle,
  disabled,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
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
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.75 : 1,
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

// --- Formatting helpers ---
function formatCurrency(v: number | null | undefined) {
  return v == null ? '—' : v.toLocaleString('en-US');
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isFollowUpOverdue(followUpDate: string | null | undefined, stage: DealStage | null) {
  if (!followUpDate) return false;
  if (stage === 'Won' || stage === 'Lost') return false;
  const todayIso = toISODate(new Date());
  return followUpDate < todayIso;
}

function getContractNumber(c: ContractSummary | null) {
  return c?.contract_number ?? c?.contract_num ?? (c?.id ? `#${c.id}` : '—');
}

function getContractOwner(c: ContractSummary | null) {
  return c?.contract_owner ?? c?.contract_own ?? '—';
}

function normalizeServices(raw: Deal['services']): ProductKey[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean) as ProductKey[];
  if (typeof raw === 'string') {
    const parts = raw.split(',').map((x) => x.trim()).filter(Boolean);
    return (parts.length ? parts : [raw.trim()]) as ProductKey[];
  }
  return [];
}

function toNumberOrNull(s: string): number | null {
  const t = (s ?? '').toString().trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isNaN(n)) return null;
  return n;
}

function stableSnapshot(d: {
  deal_name: string;
  owner: string;
  stage: DealStage;
  currency: string;
  probability: number;
  value: string;
  main_costs: string;
  services: ProductKey[];
  fee_config: any;
  next_step: string;
  follow_up_date: string;
  expected_close_date?: string;
}) {
  const servicesSorted = [...d.services].sort((a, b) => a.localeCompare(b));
  const fee = d.fee_config ?? {};
  return JSON.stringify({ ...d, services: servicesSorted, fee_config: fee });
}

function stageBadge(stage: DealStage | null) {
  const s = (stage ?? 'Lead').toLowerCase();
  if (s === 'won') return { border: '#86efac', bg: '#f0fdf4', fg: '#166534' };
  if (s === 'proposal') return { border: '#93c5fd', bg: '#eff6ff', fg: '#1d4ed8' };
  if (s === 'qualified') return { border: '#a7f3d0', bg: '#ecfdf5', fg: '#065f46' };
  if (s === 'lost') return { border: '#fecaca', bg: '#fff1f2', fg: '#991b1b' };
  return { border: UI.border, bg: UI.soft, fg: UI.secondary };
}

function slaPillTone(sla: SLAType) {
  if (sla === 'HARD') return { border: '#f59e0b', bg: '#fffbeb', fg: '#92400e' };
  if (sla === 'SOFT') return { border: '#93c5fd', bg: '#eff6ff', fg: '#1d4ed8' };
  return { border: UI.border, bg: UI.soft, fg: UI.muted };
}

export default function DealDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dealId = (params?.id as string) || '';

  const [deal, setDeal] = useState<Deal | null>(null);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabKey>('overview');

  // auth/permissions
  const [role, setRole] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean>(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Draft fields
  const [draftName, setDraftName] = useState('');
  const [draftOwner, setDraftOwner] = useState('');
  const [draftStage, setDraftStage] = useState<DealStage>('Lead');
  const [draftCurrency, setDraftCurrency] = useState<(typeof CURRENCIES)[number]>('EUR');
  const [draftProbability, setDraftProbability] = useState<number>(STAGE_PROB['Lead']);
  const [draftValue, setDraftValue] = useState('');
  const [draftMainCosts, setDraftMainCosts] = useState('');
  const [draftServices, setDraftServices] = useState<ProductKey[]>([]);
  const [draftFeeConfig, setDraftFeeConfig] = useState<any>({});

  // Next Step drafts
  const [draftNextStep, setDraftNextStep] = useState('');
  const [draftFollowUpDate, setDraftFollowUpDate] = useState(''); // YYYY-MM-DD
  const [draftExpectedClose, setDraftExpectedClose] = useState(''); // YYYY-MM-DD

  // Activities draft
  const [newActivityType, setNewActivityType] = useState<ActivityType>('Call');
  const [newNote, setNewNote] = useState('');
  const [newNextStep, setNewNextStep] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [activityFilter, setActivityFilter] = useState<'All' | ActivityType>('All');
  const [savingActivity, setSavingActivity] = useState(false);
  const [hoverActivityId, setHoverActivityId] = useState<number | null>(null);

  // Unsaved changes
  const initialSnapRef = useRef<string>('');
  const [isDirty, setIsDirty] = useState(false);

  // ---------- load auth + deal + activities + contract ----------
  useEffect(() => {
    if (!dealId) return;

    async function loadData() {
      setLoading(true);

      // auth
      const { data: sessionData } = await supabase.auth.getSession();
      const r = getRoleFromSession(sessionData?.session);
      setRole(r);
      setCanEdit(canEditDeals(r));

      const [{ data: dealData, error: dealError }, { data: activityData, error: activityError }] = await Promise.all([
        supabase.from('deals').select('*').eq('id', dealId).single(),
        supabase.from('activities').select('*').eq('entity_type', 'deal').eq('entity_id', dealId).order('created_at', { ascending: false }),
      ]);

      if (dealError) {
        console.error('Deal load error:', dealError);
        alert('Could not load deal.');
        setLoading(false);
        return;
      }

      const typedDeal = dealData as Deal;
      setDeal(typedDeal);

      if (activityError) console.error('Activities load error:', activityError);
      else setActivities((activityData || []) as Activity[]);

      if (typedDeal.contract_id) {
        const { data: contractData, error: contractError } = await (supabase as any)
          .from('contracts')
          .select('id, contract_number, contract_num, expiry_date, status, contract_type, contract_owner, contract_own')
          .eq('id', typedDeal.contract_id)
          .single();

        if (contractError) {
          console.error('Contract load error:', contractError);
          setContract(null);
        } else setContract(contractData as ContractSummary);
      } else {
        setContract(null);
      }

      // init drafts
      const services = normalizeServices(typedDeal.services);
      const stage = (typedDeal.stage ?? 'Lead') as DealStage;
      const currency =
        typedDeal.currency && (CURRENCIES as readonly string[]).includes(typedDeal.currency)
          ? (typedDeal.currency as any)
          : 'EUR';
      const probability = typeof typedDeal.probability === 'number' ? typedDeal.probability : STAGE_PROB[stage];

      setDraftName(typedDeal.deal_name ?? '');
      setDraftOwner(typedDeal.owner ?? '');
      setDraftStage(stage);
      setDraftCurrency(currency);
      setDraftProbability(probability);
      setDraftValue(typedDeal.value == null ? '' : String(typedDeal.value));
      setDraftMainCosts(typedDeal.main_costs == null ? '' : String(typedDeal.main_costs));
      setDraftServices(services);
      setDraftFeeConfig(typedDeal.fee_config ?? {});

      setDraftNextStep((typedDeal.next_step ?? '') as string);
      setDraftFollowUpDate((typedDeal.follow_up_date ?? '') as string);
      setDraftExpectedClose((typedDeal.expected_close_date ?? '') as string);

      initialSnapRef.current = stableSnapshot({
        deal_name: typedDeal.deal_name ?? '',
        owner: typedDeal.owner ?? '',
        stage,
        currency,
        probability,
        value: typedDeal.value == null ? '' : String(typedDeal.value),
        main_costs: typedDeal.main_costs == null ? '' : String(typedDeal.main_costs),
        services,
        fee_config: typedDeal.fee_config ?? {},
        next_step: (typedDeal.next_step ?? '') as string,
        follow_up_date: (typedDeal.follow_up_date ?? '') as string,
        expected_close_date: (typedDeal.expected_close_date ?? '') as string,
      });

      setIsDirty(false);
      setIsEditing(false);
      setSaveError(null);

      setLoading(false);
    }

    loadData();
  }, [dealId]);

  // Auto probability by stage ONLY while editing
  useEffect(() => {
    if (!isEditing) return;
    setDraftProbability(STAGE_PROB[draftStage]);
  }, [draftStage, isEditing]);

  // Dirty tracking
  useEffect(() => {
    if (!deal) return;
    const snap = stableSnapshot({
      deal_name: draftName,
      owner: draftOwner,
      stage: draftStage,
      currency: draftCurrency,
      probability: draftProbability,
      value: draftValue,
      main_costs: draftMainCosts,
      services: draftServices,
      fee_config: draftFeeConfig,
      next_step: draftNextStep,
      follow_up_date: draftFollowUpDate,
      expected_close_date: draftExpectedClose,
    });
    setIsDirty(snap !== initialSnapRef.current);
  }, [
    deal,
    draftName,
    draftOwner,
    draftStage,
    draftCurrency,
    draftProbability,
    draftValue,
    draftMainCosts,
    draftServices,
    draftFeeConfig,
    draftNextStep,
    draftFollowUpDate,
  ]);

  // Warn on tab close
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }

  function handleBack() {
    if (!confirmDiscardIfDirty()) return;
    router.push('/deals');
  }

  function startEditing() {
    if (!canEdit) return;
    setSaveError(null);
    setIsEditing(true);
    setTab('overview');
  }

  function cancelEditing() {
    if (!confirmDiscardIfDirty()) return;
    if (!deal) return;

    const services = normalizeServices(deal.services);
    const stage = (deal.stage ?? 'Lead') as DealStage;
    const currency =
      deal.currency && (CURRENCIES as readonly string[]).includes(deal.currency) ? (deal.currency as any) : 'EUR';
    const probability = typeof deal.probability === 'number' ? deal.probability : STAGE_PROB[stage];

    setDraftName(deal.deal_name ?? '');
    setDraftOwner(deal.owner ?? '');
    setDraftStage(stage);
    setDraftCurrency(currency);
    setDraftProbability(probability);
    setDraftValue(deal.value == null ? '' : String(deal.value));
    setDraftMainCosts(deal.main_costs == null ? '' : String(deal.main_costs));
    setDraftServices(services);
    setDraftFeeConfig(deal.fee_config ?? {});

    setDraftNextStep((deal.next_step ?? '') as string);
    setDraftFollowUpDate((deal.follow_up_date ?? '') as string);
    setDraftExpectedClose((deal.expected_close_date ?? '') as string);

    initialSnapRef.current = stableSnapshot({
      deal_name: deal.deal_name ?? '',
      owner: deal.owner ?? '',
      stage,
      currency,
      probability,
      value: deal.value == null ? '' : String(deal.value),
      main_costs: deal.main_costs == null ? '' : String(deal.main_costs),
      services,
      fee_config: deal.fee_config ?? {},
      next_step: (deal.next_step ?? '') as string,
      follow_up_date: (deal.follow_up_date ?? '') as string,
      expected_close_date: (deal.expected_close_date ?? '') as string,
    });

    setIsDirty(false);
    setIsEditing(false);
    setSaveError(null);
  }

  function toggleService(k: ProductKey) {
    setDraftServices((prev) => {
      const set = new Set(prev);
      if (set.has(k)) set.delete(k);
      else set.add(k);
      return Array.from(set);
    });
  }

  function getCfg(path: string[]) {
    let cur: any = draftFeeConfig ?? {};
    for (const k of path) cur = cur?.[k];
    return cur;
  }

  function setCfg(path: string[], value: any) {
    setDraftFeeConfig((prev: any) => {
      const next = { ...(prev ?? {}) };
      let cur: any = next;
      for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
        cur = cur[key];
      }
      cur[path[path.length - 1]] = value;
      return next;
    });
  }

  function slaBlockMessage(stage: DealStage, missingNext: boolean, missingFollowUp: boolean) {
    const parts: string[] = [];
    if (missingNext) parts.push('Next step');
    if (missingFollowUp) parts.push('Follow-up date');
    if (parts.length === 0) return null;
    return `${stage} is HARD SLA. Please fill: ${parts.join(' + ')}.`;
  }

  async function saveDealChanges() {
    if (!deal) return;
    if (!canEdit) return;

    setSaveError(null);

    if (!draftName.trim()) {
      setSaveError('Deal name is required.');
      return;
    }

    if (!draftOwner.trim()) {
      setSaveError('Owner is required. Please assign this deal to someone.');
      return;
    }

    if (draftProbability < 0 || draftProbability > 100) {
      setSaveError('Probability must be between 0 and 100.');
      return;
    }

    const parsedValue = draftValue.trim() ? Number(draftValue) : null;
    if (draftValue.trim() && (Number.isNaN(parsedValue) || parsedValue! < 0)) {
      setSaveError('Value must be a valid number.');
      return;
    }

    const parsedMainCosts = draftMainCosts.trim() ? Number(draftMainCosts) : null;
    if (draftMainCosts.trim() && (Number.isNaN(parsedMainCosts) || parsedMainCosts! < 0)) {
      setSaveError('Main costs must be a valid number.');
      return;
    }

    // SLA enforcement (HARD)
    const sla = stageSla(draftStage);
    const miss = slaMissingForStage(draftStage, draftNextStep, draftFollowUpDate);
    if (sla === 'HARD' && (miss.missingNext || miss.missingFollowUp)) {
      setSaveError(slaBlockMessage(draftStage, miss.missingNext, miss.missingFollowUp) || 'SLA requirements not met.');
      return;
    }

    const nextStepClean = draftNextStep.trim() ? draftNextStep.trim() : null;
    const followUpClean = draftFollowUpDate.trim() ? draftFollowUpDate.trim() : null;

    const payload: any = {
      deal_name: draftName.trim(),
      owner: draftOwner.trim() ? draftOwner.trim() : null,
      stage: draftStage,
      currency: draftCurrency,
      probability: draftProbability,
      value: parsedValue,
      main_costs: parsedMainCosts,
      services: draftServices,
      fee_config: draftFeeConfig ?? {},
      next_step: nextStepClean,
      follow_up_date: followUpClean,
      expected_close_date: draftExpectedClose.trim() || null,
    };

    setSavingDeal(true);
    const { data, error } = await supabase.from('deals').update(payload as any).eq('id', deal.id).select('*').single();
    setSavingDeal(false);

    if (error) {
      console.error(error);
      setSaveError(`Could not save changes: ${error.message}`);
      return;
    }

    const updated = data as Deal;
    setDeal(updated);

    const services = normalizeServices(updated.services);
    const stage = (updated.stage ?? 'Lead') as DealStage;
    const currency =
      updated.currency && (CURRENCIES as readonly string[]).includes(updated.currency) ? (updated.currency as any) : 'EUR';
    const probability = typeof updated.probability === 'number' ? updated.probability : STAGE_PROB[stage];

    setDraftName(updated.deal_name ?? '');
    setDraftOwner(updated.owner ?? '');
    setDraftStage(stage);
    setDraftCurrency(currency);
    setDraftProbability(probability);
    setDraftValue(updated.value == null ? '' : String(updated.value));
    setDraftMainCosts(updated.main_costs == null ? '' : String(updated.main_costs));
    setDraftServices(services);
    setDraftFeeConfig(updated.fee_config ?? {});

    setDraftNextStep((updated.next_step ?? '') as string);
    setDraftFollowUpDate((updated.follow_up_date ?? '') as string);
    setDraftExpectedClose((updated.expected_close_date ?? '') as string);

    initialSnapRef.current = stableSnapshot({
      deal_name: updated.deal_name ?? '',
      owner: updated.owner ?? '',
      stage,
      currency,
      probability,
      value: updated.value == null ? '' : String(updated.value),
      main_costs: updated.main_costs == null ? '' : String(updated.main_costs),
      services,
      fee_config: updated.fee_config ?? {},
      next_step: (updated.next_step ?? '') as string,
      follow_up_date: (updated.follow_up_date ?? '') as string,
      expected_close_date: (updated.expected_close_date ?? '') as string,
    });

    setIsDirty(false);
    setIsEditing(false);
  }

  async function handleQuickStageChange(newStage: DealStage) {
    if (!deal) return;
    if (!canEdit) return;

    // SLA enforcement for quick changes:
    // - If moving into HARD stage and required fields are missing on current record -> block and ask to Edit.
    const nextStep = (deal.next_step ?? '').trim();
    const followUp = (deal.follow_up_date ?? '').trim();

    const sla = stageSla(newStage);
    const miss = slaMissingForStage(newStage, nextStep, followUp);

    if (sla === 'HARD' && (miss.missingNext || miss.missingFollowUp)) {
      const msg = slaBlockMessage(newStage, miss.missingNext, miss.missingFollowUp);
      alert((msg ?? 'HARD SLA requires fields. Please click Edit and complete Next Step / Follow-up.') + ' (Quick stage change blocked)');
      return;
    }

    const { data, error } = await supabase.from('deals').update({ stage: newStage }).eq('id', deal.id).select('*').single();

    if (error) {
      console.error(error);
      alert('Could not update deal stage.');
      return;
    }

    setDeal(data as Deal);
    if (!isEditing) setDraftStage(newStage);
  }

  async function handleAddActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!deal) return;
    if (!canEdit) return;

    if (!newNote.trim() && !newNextStep.trim()) {
      alert('Please add a note or a next step.');
      return;
    }

    setSavingActivity(true);

    const { data, error } = await (supabase as any)
      .from('activities')
      .insert([
        {
          entity_type: 'deal',
          entity_id: deal.id,
          activity_type: newActivityType.toLowerCase(),
          title: newNote || null,
          body: newNextStep || null,
          due_date: newDueDate || null,
          is_done: false,
        },
      ])
      .select()
      .single();

    setSavingActivity(false);

    if (error) {
      console.error(error);
      alert('Could not save activity: ' + error.message);
      return;
    }

    setActivities((prev) => [data as Activity, ...prev]);
    setNewNote('');
    setNewNextStep('');
    setNewDueDate('');
    setNewActivityType('Call');
  }

  const visibleActivities = activityFilter === 'All' ? activities : activities.filter((a) => a.activity_type === activityFilter);

  // ---------- Fees: VIEW MODE (ONE CARD PER PRODUCT) ----------
  const feeCardsView = useMemo(() => {
    if (!deal) return [];
    const cfg = (deal.fee_config ?? {}) as any;
    const services = normalizeServices(deal.services);

    const cards: Array<{
      key: string;
      title: string;
      lines: Array<{ label: string; value: string; hint?: string }>;
    }> = [];

    if (services.includes('DV360')) {
      const dv = cfg?.dv360 ?? {};
      const lines: any[] = [];
      if (dv.exchange_rate_pct != null) lines.push({ label: 'Exchange rate', value: `${dv.exchange_rate_pct}%` });
      if (dv.non_exchange_rate_pct != null) lines.push({ label: 'Non-exchange rate', value: `${dv.non_exchange_rate_pct}%` });
      cards.push({ key: 'DV360', title: 'DV360', lines });
    }

    if (services.includes('CM360')) {
      const cm = cfg?.cm360 ?? {};
      const lines: any[] = [];
      if (cm.adserving != null) lines.push({ label: 'AdServing', value: String(cm.adserving), hint: 'CPM' });
      if (cm.video_adserving != null) lines.push({ label: 'Video AdServing', value: String(cm.video_adserving), hint: 'CPM' });
      if (cm.click_tracker != null) lines.push({ label: 'Click Tracker', value: String(cm.click_tracker), hint: 'CPC' });
      if (cm.advanced_display_upcharge != null) lines.push({ label: 'Advanced display upcharge', value: String(cm.advanced_display_upcharge), hint: 'CPM' });
      cards.push({ key: 'CM360', title: 'CM360', lines });
    }

    if (services.includes('SA360')) {
      const sa = cfg?.sa360 ?? {};
      const lines: any[] = [];
      if (sa.percentage_of_media_cost_pct != null) lines.push({ label: '% of media cost', value: `${sa.percentage_of_media_cost_pct}%` });
      cards.push({ key: 'SA360', title: 'SA360', lines });
    }

    if (services.includes('GA4_360')) {
      const g = cfg?.ga4_360 ?? {};
      const lines: any[] = [];
      if (g.tier_0_25m != null) lines.push({ label: '0–25,000,000 events', value: String(g.tier_0_25m) });
      if (g.tier_25m_500m != null) lines.push({ label: '25,000,001–500,000,000', value: String(g.tier_25m_500m) });
      if (g.tier_500m_1b != null) lines.push({ label: '500,000,001–1,000,000,000', value: String(g.tier_500m_1b) });
      if (g.tier_1b_2b != null) lines.push({ label: '1,000,000,001–2,000,000,000', value: String(g.tier_1b_2b) });
      if (g.tier_2b_plus != null) lines.push({ label: '+2,000,000,001', value: String(g.tier_2b_plus) });
      if (g.service_fee != null) lines.push({ label: 'Service fee', value: String(g.service_fee) });
      cards.push({ key: 'GA4_360', title: 'GA4 360', lines });
    }

    const mediaMap = (cfg?.media_pct_by_product ?? {}) as Record<string, any>;
    for (const k of MEDIA_PRODUCTS_UI) {
      if (!services.includes(k)) continue;
      const pct = mediaMap?.[k];
      const lines: any[] = [];
      if (pct != null) lines.push({ label: '% of media cost', value: `${pct}%` });
      cards.push({ key: k, title: PRODUCT[k], lines });
    }

    return cards.filter((c) => c.lines.length > 0);
  }, [deal]);

  // ---------- Fees: EDIT MODE ----------
  const feeCardsEdit = useMemo(() => {
    const services = draftServices;
    const cards: React.ReactNode[] = [];

    if (services.includes('DV360')) {
      cards.push(
        <Card key="edit-dv360" style={{ padding: 12 }}>
          <SectionTitle title="DV360" subtitle="Percentages" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Exchange rate (%)">
                <Input
                  type="number"
                  value={getCfg(['dv360', 'exchange_rate_pct']) ?? ''}
                  onChange={(v) => setCfg(['dv360', 'exchange_rate_pct'], toNumberOrNull(v))}
                  disabled={!canEdit}
                />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Non-exchange rate (%)">
                <Input
                  type="number"
                  value={getCfg(['dv360', 'non_exchange_rate_pct']) ?? ''}
                  onChange={(v) => setCfg(['dv360', 'non_exchange_rate_pct'], toNumberOrNull(v))}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </div>
        </Card>
      );
    }

    if (services.includes('CM360')) {
      cards.push(
        <Card key="edit-cm360" style={{ padding: 12 }}>
          <SectionTitle title="CM360" subtitle="Values (AdServing/Video/Upcharge = CPM, Click Tracker = CPC)" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="AdServing (CPM)">
                <Input type="number" value={getCfg(['cm360', 'adserving']) ?? ''} onChange={(v) => setCfg(['cm360', 'adserving'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Video AdServing (CPM)">
                <Input type="number" value={getCfg(['cm360', 'video_adserving']) ?? ''} onChange={(v) => setCfg(['cm360', 'video_adserving'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Click Tracker (CPC)">
                <Input type="number" value={getCfg(['cm360', 'click_tracker']) ?? ''} onChange={(v) => setCfg(['cm360', 'click_tracker'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Advanced display upcharge (CPM)">
                <Input
                  type="number"
                  value={getCfg(['cm360', 'advanced_display_upcharge']) ?? ''}
                  onChange={(v) => setCfg(['cm360', 'advanced_display_upcharge'], toNumberOrNull(v))}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </div>
        </Card>
      );
    }

    if (services.includes('SA360')) {
      cards.push(
        <Card key="edit-sa360" style={{ padding: 12 }}>
          <SectionTitle title="SA360" subtitle="Percentage" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="% of media cost (%)">
                <Input
                  type="number"
                  value={getCfg(['sa360', 'percentage_of_media_cost_pct']) ?? ''}
                  onChange={(v) => setCfg(['sa360', 'percentage_of_media_cost_pct'], toNumberOrNull(v))}
                  disabled={!canEdit}
                />
              </Field>
            </div>
          </div>
        </Card>
      );
    }

    if (services.includes('GA4_360')) {
      cards.push(
        <Card key="edit-ga4" style={{ padding: 12 }}>
          <SectionTitle title="GA4 360" subtitle="Values per event tier + service fee" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="0–25,000,000 events">
                <Input type="number" value={getCfg(['ga4_360', 'tier_0_25m']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'tier_0_25m'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="25,000,001–500,000,000">
                <Input type="number" value={getCfg(['ga4_360', 'tier_25m_500m']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'tier_25m_500m'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="500,000,001–1,000,000,000">
                <Input type="number" value={getCfg(['ga4_360', 'tier_500m_1b']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'tier_500m_1b'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="1,000,000,001–2,000,000,000">
                <Input type="number" value={getCfg(['ga4_360', 'tier_1b_2b']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'tier_1b_2b'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="+2,000,000,001">
                <Input type="number" value={getCfg(['ga4_360', 'tier_2b_plus']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'tier_2b_plus'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Service fee">
                <Input type="number" value={getCfg(['ga4_360', 'service_fee']) ?? ''} onChange={(v) => setCfg(['ga4_360', 'service_fee'], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
          </div>
        </Card>
      );
    }

    for (const k of MEDIA_PRODUCTS_UI) {
      if (!services.includes(k)) continue;
      cards.push(
        <Card key={`edit-media-${k}`} style={{ padding: 12 }}>
          <SectionTitle title={PRODUCT[k]} subtitle="% of media cost" />
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
              <Field label="Percentage (%)">
                <Input type="number" value={getCfg(['media_pct_by_product', k]) ?? ''} onChange={(v) => setCfg(['media_pct_by_product', k], toNumberOrNull(v))} disabled={!canEdit} />
              </Field>
            </div>
          </div>
        </Card>
      );
    }

    return cards;
  }, [draftServices, draftFeeConfig, canEdit]);

  const subtitle = useMemo(() => {
    if (!deal) return '';
    const curr = deal.currency ? String(deal.currency) : 'EUR';
    return `Owner: ${deal.owner || '—'} • Stage: ${deal.stage ?? 'Lead'} • Value: ${formatCurrency(deal.value)} ${curr}`;
  }, [deal]);

  if (loading || !deal) {
    return <div style={{ padding: 16, color: UI.muted, fontSize: 13 }}>Loading deal…</div>;
  }

  const stageTone = stageBadge(deal.stage);
  const sla = stageSla(deal.stage ?? 'Lead');
  const slaTone = slaPillTone(sla);

  const servicesView = normalizeServices(deal.services);
  const coreSelectedView = CORE_PRODUCTS_UI.filter((k) => servicesView.includes(k));
  const mediaSelectedView = MEDIA_PRODUCTS_UI.filter((k) => servicesView.includes(k));

  const overdue = isFollowUpOverdue(deal.follow_up_date ?? null, deal.stage);

  // SOFT SLA warnings (view mode)
  const softMiss = slaMissingForStage(deal.stage ?? 'Lead', deal.next_step ?? '', deal.follow_up_date ?? '');
  const showSoftWarning = sla === 'SOFT' && (softMiss.missingNext || softMiss.missingFollowUp);

  return (
    <div
      style={{
        padding: 16,
        display: 'grid',
        gap: 12,
        boxSizing: 'border-box',
        background: 'linear-gradient(to bottom, #fafbfc 0%, #f8f9fa 100%)',
        minHeight: '100vh',
      }}
    >
      {/* Renewal banner */}
      {deal.contract_id && (
        <div
          style={{
            border: '1px solid #86efac',
            background: '#f0fdf4',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: FW.strong, color: '#166534' }}>Renewal deal</div>
            <div style={{ color: '#166534', fontSize: 13, lineHeight: 1.35 }}>
              {contract ? (
                <>
                  Linked to contract{' '}
                  <Link href={`/contracts/${contract.id}`} style={{ fontWeight: FW.strong, textDecoration: 'underline', color: '#166534' }}>
                    {getContractNumber(contract)}
                  </Link>
                  {contract.expiry_date ? <> • Expires {formatDate(contract.expiry_date)}</> : null}
                  {contract.contract_type ? <> • Type: {contract.contract_type}</> : null}
                  {getContractOwner(contract) !== '—' ? <> • Owner: {getContractOwner(contract)}</> : null}
                </>
              ) : (
                <>
                  Linked to contract #{deal.contract_id}{' '}
                  <Link href={`/contracts/${deal.contract_id}`} style={{ fontWeight: FW.strong, textDecoration: 'underline', color: '#166534' }}>
                    View contract
                  </Link>
                </>
              )}
            </div>
          </div>

          <Link
            href={contract ? `/contracts/${contract.id}` : `/contracts/${deal.contract_id}`}
            style={{
              height: H,
              padding: '0 12px',
              borderRadius: 999,
              background: '#16a34a',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: FW.strong,
              fontSize: 13,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #16a34a',
              boxSizing: 'border-box',
            }}
          >
            View contract →
          </Link>
        </div>
      )}

      <PageHeader
        title={deal.deal_name || 'Untitled deal'}
        subtitle={`${deal.company_name || 'No company'} — ${subtitle}`}
        right={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {!canEdit ? (
              <Pill style={{ borderColor: UI.border, background: UI.soft, color: UI.muted }} title={`Read-only. Role/claim: ${role ?? 'none'}`}>
                Read-only
              </Pill>
            ) : null}

            <Pill
              style={{ borderColor: slaTone.border, background: slaTone.bg, color: slaTone.fg }}
              title={
                sla === 'NONE'
                  ? 'SLA: none for this stage.'
                  : sla === 'SOFT'
                    ? 'SLA: SOFT — recommended to set Next step + Follow-up date.'
                    : 'SLA: HARD — required fields enforced (Proposal: Next step + Follow-up date; Won/Lost: Next step).'
              }
            >
              SLA: {sla}
            </Pill>

            {isDirty ? (
              <Pill style={{ borderColor: '#f59e0b', background: '#fffbeb', color: '#92400e' }} title="You have changes that are not saved yet">
                Unsaved changes
              </Pill>
            ) : null}

            {!isEditing ? (
              <>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill style={{ background: UI.soft, color: UI.muted }}>Stage</Pill>
                  <div style={{ width: 180 }}>
                    <Select value={deal.stage ?? 'Lead'} onChange={(v) => handleQuickStageChange(v as DealStage)} disabled={!canEdit}>
                      {STAGES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Pill style={{ borderColor: stageTone.border, background: stageTone.bg, color: stageTone.fg }}>{deal.stage ?? 'Lead'}</Pill>
                </div>

                <Button onClick={startEditing} variant="primary" disabled={!canEdit} title={!canEdit ? 'You do not have permission to edit deals.' : undefined}>
                  Edit
                </Button>

                <Button onClick={handleBack}>Back</Button>
              </>
            ) : (
              <>
                <Button onClick={saveDealChanges} disabled={savingDeal || !canEdit} variant="primary">
                  {savingDeal ? 'Saving…' : 'Save'}
                </Button>
                <Button onClick={cancelEditing} disabled={savingDeal}>
                  Cancel
                </Button>
                <Button onClick={handleBack} disabled={savingDeal}>
                  Back
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* SOFT SLA warning banner (view mode) */}
      {showSoftWarning && !isEditing ? (
        <div style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 12, padding: 12, fontWeight: FW.strong }}>
          Qualified stage has a SOFT SLA: recommended to set
          {softMiss.missingNext ? ' Next step' : ''}
          {softMiss.missingNext && softMiss.missingFollowUp ? ' + ' : ''}
          {softMiss.missingFollowUp ? ' Follow-up date' : ''}.
        </div>
      ) : null}

      {/* Next step card */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Card style={{ width: 'min(520px, 100%)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>Next step</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {overdue ? (
                <Pill style={{ borderColor: '#fecaca', background: '#fff1f2', color: '#991b1b' }} title="Follow-up date is in the past (and deal is not Won/Lost).">
                  Overdue
                </Pill>
              ) : null}
              <Pill style={{ background: UI.soft, color: UI.muted }} title="Owner (who owns the deal)">
                Owner: {deal.owner || '—'}
              </Pill>
            </div>
          </div>

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
            <div style={{ gridColumn: 'span 8', minWidth: 0 }}>
              <Field label="What’s next">
                {!isEditing ? (
                  <div style={{ fontSize: 13, color: UI.text, padding: '6px 0', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                    {deal.next_step?.trim() ? deal.next_step : <span style={{ color: UI.muted }}>—</span>}
                  </div>
                ) : (
                  <Input value={draftNextStep} onChange={setDraftNextStep} placeholder="e.g. Send proposal + schedule review call" disabled={!canEdit} />
                )}
              </Field>
            </div>

            <div style={{ gridColumn: 'span 4', minWidth: 0 }}>
              <Field label="Follow-up date">
                {!isEditing ? (
                  <div style={{ fontSize: 13, color: UI.text, padding: '6px 0' }}>{deal.follow_up_date ? formatDate(deal.follow_up_date) : <span style={{ color: UI.muted }}>—</span>}</div>
                ) : (
                  <Input value={draftFollowUpDate} onChange={setDraftFollowUpDate} type="date" disabled={!canEdit} />
                )}
              </Field>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <TabPill active={tab === 'overview'} label="Overview" onClick={() => setTab('overview')} />
          <TabPill active={tab === 'activities'} label={`Activities (${visibleActivities.length})`} onClick={() => setTab('activities')} />
        </div>
      </Card>

      {saveError ? (
        <div style={{ border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', borderRadius: 12, padding: 12, fontWeight: FW.strong }}>
          {saveError}
        </div>
      ) : null}

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <Card style={{ padding: 14 }}>
            <SectionTitle title="Deal details" subtitle={isEditing ? 'Edit all fields, products, and fees' : 'Summary'} />

            {!isEditing ? (
              <>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
                    <Field label="Deal name">
                      <div style={{ fontSize: 16, fontWeight: FW.title, color: UI.text, padding: '6px 0' }}>{deal.deal_name || '—'}</div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Owner">
                      <div style={{ fontSize: 13, color: UI.text, padding: '6px 0' }}>{deal.owner || '—'}</div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Currency">
                      <div style={{ fontSize: 13, color: UI.text, padding: '6px 0' }}>{deal.currency || 'EUR'}</div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Value">
                      <div style={{ fontSize: 16, fontWeight: FW.title, color: UI.text, padding: '6px 0' }}>
                        {formatCurrency(deal.value)} {deal.currency || 'EUR'}
                      </div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Probability">
                      <div style={{ fontSize: 13, color: UI.text, padding: '6px 0', fontWeight: FW.strong }}>
                        {typeof deal.probability === 'number' ? `${deal.probability}%` : `${STAGE_PROB[deal.stage ?? 'Lead']}%`}
                      </div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Main costs">
                      <div style={{ fontSize: 13, color: UI.text, padding: '6px 0' }}>{deal.main_costs == null ? '—' : deal.main_costs.toLocaleString()}</div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Expected close">
                      <div style={{ fontSize: 13, color: UI.text, padding: '6px 0' }}>
                        {deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}
                      </div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Deal status">
                      <div style={{ paddingTop: 4 }}>
                        {deal.stage === 'Won' ? (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#dcfce7', color: '#166534' }}>Active – Won</span>
                        ) : deal.stage === 'Lost' ? (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#fee2e2', color: '#991b1b' }}>Closed – Lost</span>
                        ) : (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#eff6ff', color: '#1e40af' }}>Active – In progress</span>
                        )}
                      </div>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 12', minWidth: 0 }}>
                    <Field label="Products">
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                        {coreSelectedView.length === 0 && mediaSelectedView.length === 0 ? (
                          <span style={{ color: UI.muted, fontSize: 13 }}>—</span>
                        ) : (
                          <>
                            {coreSelectedView.map((k) => (
                              <Pill key={k} style={{ background: UI.soft, color: UI.text }}>
                                {PRODUCT[k]}
                              </Pill>
                            ))}
                            {mediaSelectedView.map((k) => (
                              <Pill key={k} style={{ background: '#fff', color: UI.secondary }}>
                                {PRODUCT[k]}
                              </Pill>
                            ))}
                          </>
                        )}
                      </div>
                    </Field>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {deal.company_id ? (
                    <Link href={`/companies/${deal.company_id}`} style={{ color: UI.link, textDecoration: 'none', fontWeight: FW.normal, fontSize: 13 }}>
                      Open company →
                    </Link>
                  ) : null}
                  {deal.contract_id ? (
                    <Link href={`/contracts/${deal.contract_id}`} style={{ color: UI.link, textDecoration: 'none', fontWeight: FW.normal, fontSize: 13 }}>
                      Open linked contract →
                    </Link>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
                  <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
                    <Field label="Deal name">
                      <Input value={draftName} onChange={setDraftName} placeholder="e.g. Kaizen DV360 renewal" disabled={!canEdit} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Owner">
                      <Select value={draftOwner || ''} onChange={(v) => setDraftOwner(v)} disabled={!canEdit}>
                        <option value="">—</option>
                        {OWNERS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Stage">
                      <Select value={draftStage} onChange={(v) => setDraftStage(v as DealStage)} disabled={!canEdit}>
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Currency">
                      <Select value={draftCurrency} onChange={(v) => setDraftCurrency(v as any)} disabled={!canEdit}>
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Value">
                      <Input value={draftValue} onChange={setDraftValue} type="number" placeholder="e.g. 120000" disabled={!canEdit} />
                    </Field>
                    <div style={{ marginTop: 4, fontSize: 11, color: UI.muted, lineHeight: 1.4 }}>
                      Total deal value (revenue to Sense8) incl. tech fee + managed service.
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Probability (%)">
                      <Input value={String(draftProbability ?? '')} onChange={(v) => setDraftProbability(Math.min(100, Math.max(0, Number(v || 0))))} type="number" min="0" max="100" disabled={!canEdit} />
                    </Field>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Main costs">
                      <Input value={draftMainCosts} onChange={setDraftMainCosts} type="number" placeholder="optional" disabled={!canEdit} />
                    </Field>
                    <div style={{ marginTop: 4, fontSize: 11, color: UI.muted, lineHeight: 1.4 }}>
                      Direct costs to close this deal (e.g. media budget, partner fees). GP = Value − Main costs.
                    </div>
                  </div>

                  <div style={{ gridColumn: 'span 3', minWidth: 0 }}>
                    <Field label="Expected close date">
                      <Input value={draftExpectedClose} onChange={setDraftExpectedClose} type="date" disabled={!canEdit} />
                    </Field>
                  </div>
                </div>

                {/* Products selection */}
                <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 12 }}>
                  <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
                    <Card style={{ padding: 12, background: UI.soft }}>
                      <SectionTitle title="Core products" subtitle="GMP core stack" />
                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        {CORE_PRODUCTS_UI.map((k) => (
                          <CheckboxRow key={k} checked={draftServices.includes(k)} label={PRODUCT[k]} onToggle={() => toggleService(k)} disabled={!canEdit} />
                        ))}
                      </div>
                    </Card>
                  </div>

                  <div style={{ gridColumn: 'span 6', minWidth: 0 }}>
                    <Card style={{ padding: 12, background: UI.soft }}>
                      <SectionTitle title="Media-based products" subtitle="One % per product" />
                      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                        {MEDIA_PRODUCTS_UI.map((k) => (
                          <CheckboxRow key={k} checked={draftServices.includes(k)} label={PRODUCT[k]} onToggle={() => toggleService(k)} disabled={!canEdit} />
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* In-edit SLA helper (SOFT/HARD) */}
                {(() => {
                  const slaNow = stageSla(draftStage);
                  if (slaNow === 'NONE') return null;

                  const miss = slaMissingForStage(draftStage, draftNextStep, draftFollowUpDate);
                  const isBlocking = slaNow === 'HARD' && (miss.missingNext || miss.missingFollowUp);

                  return (
                    <div
                      style={{
                        marginTop: 12,
                        border: `1px solid ${isBlocking ? '#f59e0b' : '#93c5fd'}`,
                        background: isBlocking ? '#fffbeb' : '#eff6ff',
                        color: isBlocking ? '#92400e' : '#1d4ed8',
                        borderRadius: 12,
                        padding: 12,
                        fontWeight: FW.strong,
                      }}
                    >
                      {slaNow === 'SOFT' ? (
                        <>SOFT SLA: recommended to set {miss.missingNext ? 'Next step' : null}{miss.missingNext && miss.missingFollowUp ? ' + ' : null}{miss.missingFollowUp ? 'Follow-up date' : null}{!miss.missingNext && !miss.missingFollowUp ? 'Next step + Follow-up date.' : '.'}</>
                      ) : (
                        <>HARD SLA: {slaBlockMessage(draftStage, miss.missingNext, miss.missingFollowUp) ?? 'All required fields are set.'}</>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </Card>

          {/* Fees */}
          {!isEditing ? (
            <Card style={{ padding: 14 }}>
              <SectionTitle title="Fees" subtitle="One card per product" />
              {feeCardsView.length === 0 ? (
                <div style={{ marginTop: 10, fontSize: 13, color: UI.muted }}>No fees configured yet.</div>
              ) : (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 10 }}>
                  {feeCardsView.map((c) => (
                    <div key={c.key} style={{ gridColumn: 'span 6', minWidth: 0 }}>
                      <Card style={{ padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>{c.title}</div>
                          <div style={{ fontSize: 12, color: UI.muted }}>{c.lines.length} item(s)</div>
                        </div>

                        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                          {c.lines.map((l, idx) => (
                            <div
                              key={idx}
                              style={{
                                border: `1px solid ${UI.border}`,
                                borderRadius: 10,
                                padding: 10,
                                background: UI.soft,
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 12,
                                alignItems: 'center',
                                boxSizing: 'border-box',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: UI.text, fontWeight: FW.strong }}>{l.label}</div>
                                {l.hint ? <div style={{ fontSize: 12, color: UI.muted, marginTop: 2 }}>{l.hint}</div> : null}
                              </div>
                              <div style={{ fontSize: 13, color: UI.text, fontWeight: FW.strong, whiteSpace: 'nowrap' }}>{l.value}</div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : (
            <Card style={{ padding: 14 }}>
              <SectionTitle title="Fees" subtitle="Fields appear based on selected products" />
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {feeCardsEdit.length === 0 ? <div style={{ fontSize: 13, color: UI.muted }}>Select products to show fee fields.</div> : feeCardsEdit}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ACTIVITIES */}
      {tab === 'activities' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12, alignItems: 'start' }}>
          <Card style={{ padding: 14 }}>
            <SectionTitle title="Add activity" subtitle={!canEdit ? 'Read-only' : undefined} />
            <form onSubmit={handleAddActivity} style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
              <Field label="Type">
                <Select value={newActivityType} onChange={(v) => setNewActivityType(v as ActivityType)} disabled={!canEdit}>
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Due date">
                <Input value={newDueDate} onChange={setNewDueDate} type="date" disabled={!canEdit} />
              </Field>

              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Note">
                  <Textarea value={newNote} onChange={setNewNote} rows={3} disabled={!canEdit} />
                </Field>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Next step">
                  <Textarea value={newNextStep} onChange={setNewNextStep} rows={2} disabled={!canEdit} />
                </Field>
              </div>

              <button
                type="submit"
                disabled={savingActivity || !canEdit}
                style={{
                  gridColumn: '1 / -1',
                  height: H,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: `1px solid ${UI.primaryBtn}`,
                  background: savingActivity || !canEdit ? UI.muted : UI.primaryBtn,
                  color: '#fff',
                  cursor: savingActivity || !canEdit ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: FW.strong,
                  boxSizing: 'border-box',
                }}
                title={!canEdit ? 'You do not have permission to add activities.' : undefined}
              >
                {savingActivity ? 'Saving…' : 'Add activity'}
              </button>
            </form>
          </Card>

          <Card style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: FW.strong, color: UI.text }}>Activities ({visibleActivities.length})</div>

              <div style={{ width: 160 }}>
                <Select value={activityFilter} onChange={(v) => setActivityFilter(v as any)} size="sm">
                  <option value="All">All types</option>
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {visibleActivities.length === 0 ? (
              <div style={{ fontSize: 13, color: UI.muted }}>No activities yet. Add one on the left.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {visibleActivities.map((a) => {
                  const isHover = hoverActivityId === a.id;
                  return (
                    <div
                      key={a.id}
                      onMouseEnter={() => setHoverActivityId(a.id)}
                      onMouseLeave={() => setHoverActivityId(null)}
                      style={{
                        borderRadius: 12,
                        border: `1px solid ${UI.border}`,
                        padding: 12,
                        fontSize: 13,
                        background: isHover ? UI.soft : '#fff',
                        transition: 'background 120ms ease, transform 120ms ease',
                        transform: isHover ? 'translateY(-1px)' : 'translateY(0px)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontWeight: FW.strong, color: UI.text }}>{a.activity_type || 'Activity'}</span>
                        <span style={{ fontSize: 12, color: UI.muted }}>{formatDateTime(a.created_at)}</span>
                      </div>

                      {a.title ? <div style={{ marginBottom: 8, color: UI.text, fontWeight: FW.body }}>{a.title}</div> : null}

                      <div style={{ margin: 0, fontSize: 12, color: UI.muted, lineHeight: 1.35 }}>
                        <span style={{ color: UI.secondary, fontWeight: FW.normal }}>Next step:</span> {a.body || '—'}
                        {a.due_date ? <span> • due {formatDate(a.due_date)}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}