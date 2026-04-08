'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

import PageHeader from '../../components/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { InputDate } from '../../components/ui/InputDate';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ui } from '../../components/ui/tokens';

// ---------- Types ----------
type PlatformCode =
  | 'DV360'
  | 'CM360'
  | 'SA360'
  | 'GA4'
  | 'GADS'
  | 'FACEBOOK'
  | 'MEDIA_SERVICES'
  | 'TIKTOK'
  | 'TEADS'
  | 'TABOOLA'
  | 'FOOTPRINTS_AI'
  | 'IAS'
  | 'PROJECT_AGORA'
  | 'GOOGLE_MAPS';

type PartyType = 'Client' | 'Supplier';
type PaymentType = 'Pre-payment' | 'Post-payment';
type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';

type TabKey = 'overview' | 'edit' | 'addendums';

const PLATFORMS: { code: PlatformCode; label: string }[] = [
  { code: 'DV360', label: 'DV360' },
  { code: 'CM360', label: 'CM360' },
  { code: 'SA360', label: 'SA360' },
  { code: 'GA4', label: 'GA4 / GA4360' },
  { code: 'GADS', label: 'Google Ads' },
  { code: 'FACEBOOK', label: 'Facebook' },
  { code: 'MEDIA_SERVICES', label: 'Media Services' },
  { code: 'TIKTOK', label: 'TikTok' },
  { code: 'TEADS', label: 'Teads' },
  { code: 'TABOOLA', label: 'Taboola' },
  { code: 'FOOTPRINTS_AI', label: 'Footprints AI' },
  { code: 'IAS', label: 'IAS' },
  { code: 'PROJECT_AGORA', label: 'Project Agora' },
  { code: 'GOOGLE_MAPS', label: 'Google Maps' },
];

interface Company {
  id: string;
  company_name: string;
}

interface ContractRow {
  id: number;
  created_at: string;
  company_id: string | null;
  company_name: string | null;
  contract_number: string | null;
  status: string | null;
  contract_type: string | null;
  issue_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  automatic_renewal: boolean | null;
  contract_owner: string | null;
  party_type: PartyType | string | null;

  payment_type?: PaymentType | string | null;
  payment_term?: number | null;
  signed_contract_url?: string | null;
  notes?: string | null;

  primary_won_deal_id?: string | null;
}

interface ContractPlatformRow {
  id: number;
  created_at: string;
  contract_id: number;
  platform_code: PlatformCode;
  active: boolean;
}

interface DealRow {
  id: string;
  deal_name: string | null;
  stage: DealStage | string | null;
  company_id: string | null;
  value?: number | null;
  owner?: string | null;
}

interface AddendumRow {
  id: number;
  contract_id: number;
  addendum_number: string | null;
  signed_date: string | null;
  effective_from: string;
  signed_url: string | null;
  notes: string | null;
  changes: any;
  created_at: string;
}

type CurrentState = {
  issue_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  payment_term: number | null;
  payment_type: string | null;
  platforms: string[];
};

// ✅ Contract links (REBATE)
type LinkType = 'REBATE';
interface ContractLinkRow {
  id: number;
  contract_id: number;
  linked_contract_id: number;
  link_type: LinkType | string;
  created_at: string;
}

// ---------- Helpers ----------
function toISODateInput(value: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return String(dateString);
  return d.toLocaleDateString();
}

function cmpYMD(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function safeTrim(s: string) {
  return (s || '').trim();
}

function statusTone(
  status?: string | null
): 'neutral' | 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  const s = (status || '').toLowerCase().trim();
  if (s === 'active') return 'green';
  if (s === 'pending') return 'amber';
  if (s === 'terminated') return 'red';
  if (s === 'expired') return 'gray';
  return 'neutral';
}

function stableStringify(x: any) {
  return JSON.stringify(x, Object.keys(x).sort());
}

function isValidUrl(u: string) {
  const t = (u || '').trim();
  if (!t) return true;
  try {
    new URL(t);
    return true;
  } catch {
    return false;
  }
}

// ✅ readable addendum changes renderer
function ChangesPretty({ changes }: { changes: any }) {
  if (!changes || typeof changes !== 'object') {
    return (
      <div style={{ fontSize: 12, color: ui.color.text3 }}>
        No structured changes.
      </div>
    );
  }

  const expiry = changes.expiry_date ? String(changes.expiry_date) : '';
  const paymentTerm =
    changes.payment_term != null ? String(changes.payment_term) : '';
  const paymentType = changes.payment_type ? String(changes.payment_type) : '';

  const platformsAdd: string[] = changes?.platforms?.add
    ? Array.isArray(changes.platforms.add)
      ? changes.platforms.add
      : []
    : [];
  const platformsRemove: string[] = changes?.platforms?.remove
    ? Array.isArray(changes.platforms.remove)
      ? changes.platforms.remove
      : []
    : [];

  const rows: { label: string; value: React.ReactNode }[] = [];

  if (expiry) rows.push({ label: 'Expiry date', value: formatDate(expiry) });
  if (paymentTerm)
    rows.push({ label: 'Payment term', value: `${paymentTerm} days` });
  if (paymentType) rows.push({ label: 'Payment type', value: paymentType });

  if (platformsAdd.length) {
    rows.push({
      label: 'Platforms added',
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {platformsAdd.map((p) => (
            <span
              key={`pa-${p}`}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 999,
                border: `1px solid ${ui.color.border}`,
                background: ui.color.primarySoft,
                color: ui.color.primaryHover,
              }}
            >
              + {p}
            </span>
          ))}
        </div>
      ),
    });
  }

  if (platformsRemove.length) {
    rows.push({
      label: 'Platforms removed',
      value: (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {platformsRemove.map((p) => (
            <span
              key={`pr-${p}`}
              style={{
                fontSize: 12,
                fontWeight: 800,
                padding: '4px 8px',
                borderRadius: 999,
                border: `1px solid ${ui.color.border}`,
                background: '#fee2e2',
                color: '#991b1b',
              }}
            >
              − {p}
            </span>
          ))}
        </div>
      ),
    });
  }

  if (rows.length === 0) {
    return (
      <div style={{ fontSize: 12, color: ui.color.text2 }}>
        <div style={{ marginBottom: 4, fontWeight: 800 }}>Raw changes</div>
        <pre
          style={{
            margin: 0,
            padding: 10,
            borderRadius: 10,
            border: `1px solid ${ui.color.border}`,
            background: ui.color.surface2,
            overflowX: 'auto',
            fontSize: 12,
          }}
        >
          {JSON.stringify(changes, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
      {rows.map((r, idx) => (
        <div key={idx} style={{ display: 'grid', gap: 4 }}>
          <div style={{ fontSize: 12, color: ui.color.text3, fontWeight: 800 }}>
            {r.label}
          </div>
          <div style={{ fontSize: 12, color: ui.color.text }}>{r.value}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- Page ----------
export default function Page() {
  return <ContractDetailPage />;
}

function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idStr = params?.id as string;
  const contractId = Number(idStr);

  const [tab, setTab] = useState<TabKey>('overview');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [row, setRow] = useState<ContractRow | null>(null);
  const [platformRows, setPlatformRows] = useState<ContractPlatformRow[]>([]);

  // Primary won deal selector
  const [wonDeals, setWonDeals] = useState<DealRow[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  // Addendums
  const [addendums, setAddendums] = useState<AddendumRow[]>([]);
  const [creatingAddendum, setCreatingAddendum] = useState(false);
  // Addendum edit state
  const [editingAddendumId, setEditingAddendumId] = useState<number | null>(
    null
  );
  const [editAddendumNumber, setEditAddendumNumber] = useState('');
  const [editEffectiveFrom, setEditEffectiveFrom] = useState('');
  const [editSignedDate, setEditSignedDate] = useState('');
  const [editSignedUrl, setEditSignedUrl] = useState('');
  const [editAddendumNotes, setEditAddendumNotes] = useState('');
  const [savingAddendumEdit, setSavingAddendumEdit] = useState(false);

  // Current computed state (RPC)
  const [currentState, setCurrentState] = useState<CurrentState | null>(null);
  const [currentStateLoading, setCurrentStateLoading] = useState(false);

  // ✅ Rebate linking
  const [rebateLink, setRebateLink] = useState<ContractLinkRow | null>(null);
  const [rebateLoading, setRebateLoading] = useState(false);
  const [rebateErr, setRebateErr] = useState<string | null>(null);

  const [rebateContracts, setRebateContracts] = useState<ContractRow[]>([]);
  const [rebateContractsLoading, setRebateContractsLoading] = useState(false);

  // form state (edit)
  const [companyId, setCompanyId] = useState('');
  const [companyNameCache, setCompanyNameCache] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [status, setStatus] = useState('Active');
  const [partyType, setPartyType] = useState<PartyType>('Client');
  const [contractType, setContractType] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [automaticRenewal, setAutomaticRenewal] = useState(false);
  const [contractOwner, setContractOwner] = useState('');

  const [paymentType, setPaymentType] = useState<PaymentType>('Post-payment');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformCode[]>(
    []
  );
  const [primaryWonDealId, setPrimaryWonDealId] = useState('');

  // ✅ Selected rebate contract id (string for Select)
  const [selectedRebateContractId, setSelectedRebateContractId] =
    useState<string>('');

  // Addendum form (MVP)
  const [addEffectiveFrom, setAddEffectiveFrom] = useState('');
  const [addSignedDate, setAddSignedDate] = useState('');
  const [addSignedUrl, setAddSignedUrl] = useState('');
  const [addAddendumNumber, setAddAddendumNumber] = useState('');
  const [addNotes, setAddNotes] = useState('');

  // Addendum deltas:
  const [addNewExpiry, setAddNewExpiry] = useState('');
  const [addNewPaymentTerm, setAddNewPaymentTerm] = useState('');
  const [addNewPaymentType, setAddNewPaymentType] = useState<PaymentType | ''>(
    ''
  );
  const [addPlatformsAdd, setAddPlatformsAdd] = useState<PlatformCode[]>([]);
  const [addPlatformsRemove, setAddPlatformsRemove] = useState<PlatformCode[]>(
    []
  );

  // UX toast
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const toastTimer = useRef<any>(null);

  // baseline snapshot for dirty detection
  const [baseline, setBaseline] = useState<string>('');

  function showToast(msg: string) {
    setSaveToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSaveToast(null), 1800);
  }

  function makeSnapshot(v: {
    companyId: string;
    companyNameCache: string;
    contractNumber: string;
    status: string;
    partyType: PartyType;
    contractType: string;
    issueDate: string;
    effectiveDate: string;
    expiryDate: string;
    automaticRenewal: boolean;
    contractOwner: string;
    paymentType: PaymentType;
    paymentTerm: string;
    signedUrl: string;
    notes: string;
    selectedPlatforms: string[];
    primaryWonDealId: string;
    selectedRebateContractId: string;
  }) {
    return stableStringify({
      companyId: safeTrim(v.companyId),
      companyNameCache: safeTrim(v.companyNameCache),
      contractNumber: safeTrim(v.contractNumber),
      status: safeTrim(v.status),
      partyType: v.partyType,
      contractType: safeTrim(v.contractType),
      issueDate: safeTrim(v.issueDate),
      effectiveDate: safeTrim(v.effectiveDate),
      expiryDate: safeTrim(v.expiryDate),
      automaticRenewal: !!v.automaticRenewal,
      contractOwner: safeTrim(v.contractOwner),
      paymentType: v.paymentType,
      paymentTerm: safeTrim(v.paymentTerm),
      signedUrl: safeTrim(v.signedUrl),
      notes: safeTrim(v.notes),
      selectedPlatforms: Array.from(new Set(v.selectedPlatforms))
        .map((x) => String(x))
        .sort(),
      primaryWonDealId: safeTrim(v.primaryWonDealId),
      selectedRebateContractId: safeTrim(v.selectedRebateContractId),
    });
  }

  function hydrateFromRow(r: ContractRow, cps: ContractPlatformRow[]) {
    setCompanyId(r.company_id || '');
    setCompanyNameCache(r.company_name || '');
    setContractNumber(r.contract_number || '');
    setStatus(r.status || 'Active');
    setPartyType(((r.party_type as PartyType) || 'Client') as PartyType);
    setContractType(r.contract_type || '');
    setIssueDate(toISODateInput(r.issue_date));
    setEffectiveDate(toISODateInput(r.effective_date));
    setExpiryDate(toISODateInput(r.expiry_date));
    setAutomaticRenewal(!!r.automatic_renewal);
    setContractOwner(r.contract_owner || '');

    setPaymentType(
      ((r.payment_type as PaymentType) || 'Post-payment') as PaymentType
    );
    setPaymentTerm(r.payment_term != null ? String(r.payment_term) : '');
    setSignedUrl(r.signed_contract_url || '');
    setNotes(r.notes || '');

    setPrimaryWonDealId((r.primary_won_deal_id ?? '') as string);

    const activeCodes = cps.filter((x) => x.active).map((x) => x.platform_code);
    setSelectedPlatforms(Array.from(new Set(activeCodes)));

    // rebate selection will be hydrated by loadRebateLink()

    const snap = makeSnapshot({
      companyId: r.company_id || '',
      companyNameCache: r.company_name || '',
      contractNumber: r.contract_number || '',
      status: r.status || 'Active',
      partyType: ((r.party_type as PartyType) || 'Client') as PartyType,
      contractType: r.contract_type || '',
      issueDate: toISODateInput(r.issue_date),
      effectiveDate: toISODateInput(r.effective_date),
      expiryDate: toISODateInput(r.expiry_date),
      automaticRenewal: !!r.automatic_renewal,
      contractOwner: r.contract_owner || '',
      paymentType: ((r.payment_type as PaymentType) ||
        'Post-payment') as PaymentType,
      paymentTerm: r.payment_term != null ? String(r.payment_term) : '',
      signedUrl: r.signed_contract_url || '',
      notes: r.notes || '',
      selectedPlatforms: Array.from(new Set(activeCodes)).sort(),
      primaryWonDealId: (r.primary_won_deal_id ?? '') as string,
      selectedRebateContractId: '',
    });
    setBaseline(snap);
  }

  async function loadWonDealsForCompany(company_id: string | null) {
    if (!company_id) {
      setWonDeals([]);
      return;
    }
    setDealsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('deals')
        .select('id, deal_name, stage, company_id, value, owner')
        .eq('company_id', company_id)
        .eq('stage', 'Won')
        .order('deal_name', { ascending: true });

      if (error) {
        console.error(error);
        setWonDeals([]);
        return;
      }
      setWonDeals((data || []) as DealRow[]);
    } finally {
      setDealsLoading(false);
    }
  }

  async function loadAddendums() {
    const { data, error } = await (supabase as any)
      .from('contract_addendums')
      .select('*')
      .eq('contract_id', contractId)
      .order('effective_from', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.error(error);
      setAddendums([]);
      return;
    }
    setAddendums((data || []) as AddendumRow[]);
  }

  async function loadCurrentState() {
    setCurrentStateLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_contract_current_state', {
        p_contract_id: contractId,
      });
      if (error) {
        console.error(error);
        setCurrentState(null);
        return;
      }
      if (data?.error) {
        setCurrentState(null);
        return;
      }
      setCurrentState(data as CurrentState);
    } finally {
      setCurrentStateLoading(false);
    }
  }

  async function reloadPlatforms() {
    const { data, error } = await supabase
      .from('contract_platforms')
      .select('*')
      .eq('contract_id', contractId);
    if (error) {
      console.error(error);
      return;
    }
    setPlatformRows((data || []) as ContractPlatformRow[]);
  }

  // ✅ Load rebate link robustly (both directions)
  async function loadRebateLink() {
    setRebateErr(null);
    setRebateLoading(true);
    try {
      // direct: base -> rebate
      const direct = await (supabase as any)
        .from('contract_links')
        .select('id, contract_id, linked_contract_id, link_type, created_at')
        .eq('contract_id', contractId)
        .eq('link_type', 'REBATE')
        .maybeSingle();

      if (direct.error) {
        console.error(direct.error);
        setRebateErr(direct.error.message);
        setRebateLink(null);
        return;
      }

      if (direct.data) {
        const link = direct.data as ContractLinkRow;
        setRebateLink(link);
        setSelectedRebateContractId(
          link.linked_contract_id ? String(link.linked_contract_id) : ''
        );
        return;
      }

      // reverse: rebate -> base (legacy / human error)
      const reverse = await (supabase as any)
        .from('contract_links')
        .select('id, contract_id, linked_contract_id, link_type, created_at')
        .eq('linked_contract_id', contractId)
        .eq('link_type', 'REBATE')
        .maybeSingle();

      if (reverse.error) {
        console.error(reverse.error);
        setRebateErr(reverse.error.message);
        setRebateLink(null);
        return;
      }

      const link = (reverse.data || null) as ContractLinkRow | null;
      setRebateLink(link);
      setSelectedRebateContractId(
        link?.contract_id ? String(link.contract_id) : ''
      );
    } finally {
      setRebateLoading(false);
    }
  }

  // ✅ Load possible rebate contracts for the same company
  async function loadRebateContractsForCompany(company_id: string | null) {
    const cid = safeTrim(company_id || '');
    if (!cid) {
      setRebateContracts([]);
      return;
    }

    setRebateContractsLoading(true);
    try {
      // We accept: contract_type === 'REB' OR starts with 'REB' (REB, REBATE, etc.)
      const { data, error } = await (supabase as any)
        .from('contracts')
        .select('*')
        .eq('company_id', cid)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setRebateContracts([]);
        return;
      }

      const all = (data || []) as ContractRow[];
      const filtered = all
        .filter((c) => c.id !== contractId)
        .filter((c) =>
          safeTrim(c.contract_type || '')
            .toUpperCase()
            .startsWith('REB')
        );

      setRebateContracts(filtered);
    } finally {
      setRebateContractsLoading(false);
    }
  }

  // ✅ Save rebate link to DB (called from main Save)
  async function persistRebateLink(
    selectedIdStr: string,
    company_id: string | null
  ) {
    const selectedId = safeTrim(selectedIdStr);
    // If contract has no company, do nothing (should not happen normally)
    if (!company_id) return;

    // If nothing selected -> delete any rebate link in either direction
    if (!selectedId) {
      await (supabase as any)
        .from('contract_links')
        .delete()
        .or(
          `and(contract_id.eq.${contractId},link_type.eq.REBATE),and(linked_contract_id.eq.${contractId},link_type.eq.REBATE)`
        );
      return;
    }

    const target = Number(selectedId);
    if (!Number.isFinite(target)) return;

    // Upsert (prefer direct direction: this contract -> rebate contract)
    // NOTE: if you have a UNIQUE constraint like (contract_id, link_type) this will work best.
    // If your unique is different, this still works but may create duplicates; we clean up after.
    const { error } = await supabase.from('contract_links').upsert(
      [
        {
          contract_id: contractId,
          linked_contract_id: target,
          link_type: 'REBATE',
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'contract_id,link_type' } as any
    );

    if (error) {
      // fallback if onConflict doesn't match your schema
      // try insert, ignoring duplicates
      console.error('rebate upsert error', error);
      const ins = await supabase.from('contract_links').insert([
        {
          contract_id: contractId,
          linked_contract_id: target,
          link_type: 'REBATE',
          created_at: new Date().toISOString(),
        },
      ]);
      if (ins.error) console.error('rebate insert fallback error', ins.error);
    }

    // Optional cleanup: delete reversed link if it exists (keep one direction)
    await (supabase as any)
      .from('contract_links')
      .delete()
      .eq('linked_contract_id', contractId)
      .eq('contract_id', target)
      .eq('link_type', 'REBATE');
  }

  // Load data
  useEffect(() => {
    setTab('overview');

    if (!Number.isFinite(contractId)) {
      setLoading(false);
      setRow(null);
      return;
    }

    async function load() {
      setLoading(true);

      const [companiesRes, contractRes, cpRes] = await Promise.all([
        supabase
          .from('companies')
          .select('id, company_name')
          .order('company_name', { ascending: true }),
        supabase.from('contracts').select('*').eq('id', contractId).single(),
        supabase
          .from('contract_platforms')
          .select('*')
          .eq('contract_id', contractId),
      ]);

      if (companiesRes.error) console.error(companiesRes.error);
      setCompanies((companiesRes.data || []) as Company[]);

      if (contractRes.error) {
        console.error(contractRes.error);
        alert('Could not load contract.');
        setRow(null);
        setPlatformRows([]);
        setWonDeals([]);
        setLoading(false);
        return;
      }

      const r = contractRes.data as ContractRow;
      setRow(r);

      const cps = (cpRes.data || []) as ContractPlatformRow[];
      setPlatformRows(cps);

      hydrateFromRow(r, cps);

      await Promise.all([
        loadWonDealsForCompany(r.company_id),
        loadAddendums(),
        loadCurrentState(),
        loadRebateLink(),
        loadRebateContractsForCompany(r.company_id),
      ]);

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  // smart default: effective date = issue date if empty
  useEffect(() => {
    if (!issueDate) return;
    if (!effectiveDate) setEffectiveDate(issueDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDate]);

  // when company changes in edit, refresh won deals + rebate contracts
  useEffect(() => {
    if (!companyId) return;
    loadWonDealsForCompany(companyId);
    loadRebateContractsForCompany(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // validation (dates)
  const dateError = useMemo(() => {
    const i = issueDate;
    const e = effectiveDate;
    const x = expiryDate;
    if (i && e && cmpYMD(e, i) < 0)
      return 'Effective date cannot be before Issue date.';
    if (e && x && cmpYMD(x, e) < 0)
      return 'Expiry date cannot be before Effective date.';
    return null;
  }, [issueDate, effectiveDate, expiryDate]);

  const companyOptions = useMemo(
    () => [
      { value: '', label: 'Select company…' },
      ...companies.map((c) => ({ value: c.id, label: c.company_name })),
    ],
    [companies]
  );

  const statusOptions = useMemo(
    () => [
      { value: 'Active', label: 'Active' },
      { value: 'Pending', label: 'Pending' },
      { value: 'Terminated', label: 'Terminated' },
      { value: 'Expired', label: 'Expired' },
    ],
    []
  );

  const partyOptions = useMemo(
    () => [
      { value: 'Client', label: 'Client' },
      { value: 'Supplier', label: 'Supplier' },
    ],
    []
  );

  const paymentTypeOptions = useMemo(
    () => [
      { value: 'Pre-payment', label: 'Pre-payment' },
      { value: 'Post-payment', label: 'Post-payment' },
    ],
    []
  );

  const wonDealOptions = useMemo(() => {
    const base = [
      { value: '', label: dealsLoading ? 'Loading deals…' : 'Not selected' },
    ];
    const list = wonDeals.map((d) => ({
      value: d.id,
      label: d.deal_name || `Won deal ${d.id}`,
    }));
    return [...base, ...list];
  }, [wonDeals, dealsLoading]);

  const rebateOptions = useMemo(() => {
    const base = [
      {
        value: '',
        label: rebateContractsLoading
          ? 'Loading rebate contracts…'
          : 'Not linked',
      },
    ];
    const list = rebateContracts.map((c) => ({
      value: String(c.id),
      label: `${c.contract_number || `Contract #${c.id}`} (${c.status || '—'})`,
    }));
    return [...base, ...list];
  }, [rebateContracts, rebateContractsLoading]);

  const activePlatformCodes = useMemo(() => {
    return Array.from(
      new Set(platformRows.filter((x) => x.active).map((x) => x.platform_code))
    ).sort();
  }, [platformRows]);

  const companyLabel = useMemo(() => {
    const selectedCompany = companies.find((c) => c.id === companyId);
    return selectedCompany?.company_name || companyNameCache || '—';
  }, [companies, companyId, companyNameCache]);

  const primaryWonDeal = useMemo(() => {
    const id = (row?.primary_won_deal_id ?? '') || '';
    if (!id) return null;
    return wonDeals.find((d) => d.id === id) ?? null;
  }, [row?.primary_won_deal_id, wonDeals]);

  // ✅ This is the crucial visibility fix: link shown even if rebateLink couldn't be read
  const linkedRebateId = useMemo(() => {
    const fromLink = rebateLink?.linked_contract_id ?? null;
    if (fromLink) return fromLink;

    const fallback = safeTrim(selectedRebateContractId);
    if (!fallback) return null;

    const n = Number(fallback);
    return Number.isFinite(n) ? n : null;
  }, [rebateLink?.linked_contract_id, selectedRebateContractId]);

  const currentSnapshot = useMemo(() => {
    return makeSnapshot({
      companyId,
      companyNameCache,
      contractNumber,
      status,
      partyType,
      contractType,
      issueDate,
      effectiveDate,
      expiryDate,
      automaticRenewal,
      contractOwner,
      paymentType,
      paymentTerm,
      signedUrl,
      notes,
      selectedPlatforms: selectedPlatforms.slice().sort(),
      primaryWonDealId,
      selectedRebateContractId,
    });
  }, [
    companyId,
    companyNameCache,
    contractNumber,
    status,
    partyType,
    contractType,
    issueDate,
    effectiveDate,
    expiryDate,
    automaticRenewal,
    contractOwner,
    paymentType,
    paymentTerm,
    signedUrl,
    notes,
    selectedPlatforms,
    primaryWonDealId,
    selectedRebateContractId,
  ]);

  const isDirty = useMemo(() => {
    if (!baseline) return false;
    return currentSnapshot !== baseline;
  }, [baseline, currentSnapshot]);

  // warn on refresh/close if dirty
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  async function handleSaveContract() {
    if (!row) return;
    if (saving) return;
    if (dateError) return alert(dateError);

    const pt = safeTrim(paymentTerm);
    const ptNum = pt ? Number(pt) : null;
    if (pt && (Number.isNaN(ptNum) || (ptNum as number) < 0))
      return alert('Payment term must be a number of days (>= 0).');

    const url = safeTrim(signedUrl);
    if (!isValidUrl(url))
      return alert(
        'Signed contract URL must be a valid URL (include https://).'
      );

    const pId = safeTrim(primaryWonDealId);
    if (pId) {
      const ok = wonDeals.some((d) => d.id === pId);
      if (!ok)
        return alert(
          'Selected Primary Won deal is not valid for the current company. Please re-select.'
        );
    }

    // validate rebate selection belongs to this company & is REB*
    const rebStr = safeTrim(selectedRebateContractId);
    if (rebStr) {
      const ok = rebateContracts.some((c) => String(c.id) === rebStr);
      if (!ok)
        return alert(
          'Selected rebate contract is not valid for this company. Please re-select.'
        );
    }

    setSaving(true);
    try {
      const selectedCompany = companies.find(
        (c) => c.id === safeTrim(companyId)
      );
      const resolvedCompanyName =
        selectedCompany?.company_name ?? safeTrim(companyNameCache) ?? null;

      const { error: upErr } = await (supabase as any)
        .from('contracts')
        .update({
          company_id: safeTrim(companyId) ? safeTrim(companyId) : null,
          company_name: resolvedCompanyName || null,
          contract_number: safeTrim(contractNumber) || null,
          status: safeTrim(status) || null,
          party_type: partyType,
          contract_type: safeTrim(contractType) || null,
          issue_date: safeTrim(issueDate) || null,
          effective_date: safeTrim(effectiveDate) || null,
          expiry_date: safeTrim(expiryDate) || null,
          automatic_renewal: !!automaticRenewal,
          contract_owner: safeTrim(contractOwner) || null,
          payment_type: paymentType,
          payment_term: ptNum,
          signed_contract_url: url || null,
          notes: safeTrim(notes) || null,
          primary_won_deal_id: pId || null,
        })
        .eq('id', row.id);

      if (upErr) {
        console.error(upErr);
        alert('Save failed: ' + upErr.message);
        return;
      }

      // ✅ persist rebate link as part of Save
      await persistRebateLink(
        rebStr,
        safeTrim(companyId) ? safeTrim(companyId) : null
      );
      await loadRebateLink(); // refresh after save

      // platforms reconcile
      const existing = platformRows || [];
      const existingActive = new Set(
        existing.filter((x) => x.active).map((x) => x.platform_code)
      );
      const want = new Set(selectedPlatforms);

      const toActivate: PlatformCode[] = [];
      const toDeactivate: number[] = [];

      for (const r of existing) {
        if (r.active && !want.has(r.platform_code)) toDeactivate.push(r.id);
      }

      for (const code of Array.from(want)) {
        if (!existingActive.has(code)) {
          const inactive = existing.find(
            (x) => x.platform_code === code && !x.active
          );
          if (inactive) {
            const { error } = await supabase
              .from('contract_platforms')
              .update({ active: true })
              .eq('id', inactive.id);
            if (error) console.error(error);
          } else {
            toActivate.push(code);
          }
        }
      }

      if (toDeactivate.length) {
        const { error } = await supabase
          .from('contract_platforms')
          .update({ active: false })
          .in('id', toDeactivate);
        if (error) console.error(error);
      }

      if (toActivate.length) {
        const rows = toActivate.map((code) => ({
          contract_id: row.id,
          platform_code: code,
          active: true,
          created_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from('contract_platforms')
          .insert(rows);
        if (error) console.error(error);
      }

      await reloadPlatforms();

      const nextRow: ContractRow = {
        ...row,
        company_id: safeTrim(companyId) ? safeTrim(companyId) : null,
        company_name: resolvedCompanyName || null,
        contract_number: safeTrim(contractNumber) || null,
        status: safeTrim(status) || null,
        party_type: partyType,
        contract_type: safeTrim(contractType) || null,
        issue_date: safeTrim(issueDate) || null,
        effective_date: safeTrim(effectiveDate) || null,
        expiry_date: safeTrim(expiryDate) || null,
        automatic_renewal: !!automaticRenewal,
        contract_owner: safeTrim(contractOwner) || null,
        payment_type: paymentType,
        payment_term: ptNum,
        signed_contract_url: url || null,
        notes: safeTrim(notes) || null,
        primary_won_deal_id: pId || null,
      };
      setRow(nextRow);

      await Promise.all([
        loadWonDealsForCompany(nextRow.company_id),
        loadCurrentState(),
        loadRebateContractsForCompany(nextRow.company_id),
      ]);

      // refresh baseline
      const activeCodes = Array.from(new Set(selectedPlatforms)).sort();
      const snap = makeSnapshot({
        companyId: nextRow.company_id || '',
        companyNameCache: nextRow.company_name || '',
        contractNumber: nextRow.contract_number || '',
        status: nextRow.status || 'Active',
        partyType: (nextRow.party_type as PartyType) || 'Client',
        contractType: nextRow.contract_type || '',
        issueDate: toISODateInput(nextRow.issue_date),
        effectiveDate: toISODateInput(nextRow.effective_date),
        expiryDate: toISODateInput(nextRow.expiry_date),
        automaticRenewal: !!nextRow.automatic_renewal,
        contractOwner: nextRow.contract_owner || '',
        paymentType: ((nextRow.payment_type as PaymentType) ||
          'Post-payment') as PaymentType,
        paymentTerm:
          nextRow.payment_term != null ? String(nextRow.payment_term) : '',
        signedUrl: nextRow.signed_contract_url || '',
        notes: nextRow.notes || '',
        selectedPlatforms: activeCodes,
        primaryWonDealId: nextRow.primary_won_deal_id || '',
        selectedRebateContractId: rebStr || '',
      });
      setBaseline(snap);

      showToast('Saved');
      setTab('overview');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdits() {
    if (!row) return;
    hydrateFromRow(row, platformRows);
    // also re-hydrate rebate from DB (so cancel really cancels)
    loadRebateLink();
    setTab('overview');
  }

  async function handleCreateAddendum() {
    if (!row) return;
    if (creatingAddendum) return;

    const eff = safeTrim(addEffectiveFrom);
    if (!eff)
      return alert('Addendum: effective_from is required (YYYY-MM-DD).');

    if (addSignedUrl && !isValidUrl(addSignedUrl)) {
      return alert(
        'Addendum signed URL must be a valid URL (include https://).'
      );
    }

    const changes: any = {};

    if (safeTrim(addNewExpiry)) changes.expiry_date = safeTrim(addNewExpiry);

    const ptTrim = safeTrim(addNewPaymentTerm);
    if (ptTrim) {
      const n = Number(ptTrim);
      if (Number.isNaN(n) || n < 0)
        return alert('Addendum payment_term must be a number >= 0.');
      changes.payment_term = n;
    }

    if (addNewPaymentType) changes.payment_type = addNewPaymentType;

    const addList = Array.from(new Set(addPlatformsAdd)).sort();
    const remList = Array.from(new Set(addPlatformsRemove)).sort();
    if (addList.length || remList.length) {
      changes.platforms = {};
      if (addList.length) changes.platforms.add = addList;
      if (remList.length) changes.platforms.remove = remList;
    }

    setCreatingAddendum(true);
    try {
      const payload = {
        contract_id: row.id,
        addendum_number: safeTrim(addAddendumNumber) || null,
        signed_date: safeTrim(addSignedDate) || null,
        effective_from: eff,
        signed_url: safeTrim(addSignedUrl) || null,
        notes: safeTrim(addNotes) || null,
        changes,
      };

      const { error } = await supabase
        .from('contract_addendums')
        .insert([payload]);
      if (error) {
        console.error(error);
        alert('Could not create addendum: ' + error.message);
        return;
      }

      setAddAddendumNumber('');
      setAddSignedDate('');
      setAddEffectiveFrom('');
      setAddSignedUrl('');
      setAddNotes('');
      setAddNewExpiry('');
      setAddNewPaymentTerm('');
      setAddNewPaymentType('');
      setAddPlatformsAdd([]);
      setAddPlatformsRemove([]);

      await Promise.all([loadAddendums(), loadCurrentState()]);
      showToast('Addendum created');
    } finally {
      setCreatingAddendum(false);
    }
  }

  function startEditAddendum(a: AddendumRow) {
    setEditingAddendumId(a.id);
    setEditAddendumNumber(a.addendum_number ?? '');
    setEditEffectiveFrom(a.effective_from ?? '');
    setEditSignedDate(a.signed_date ?? '');
    setEditSignedUrl(a.signed_url ?? '');
    setEditAddendumNotes(a.notes ?? '');
  }

  function cancelEditAddendum() {
    setEditingAddendumId(null);
  }

  async function handleSaveAddendumEdit(id: number) {
    if (!editEffectiveFrom) return alert('Effective from date is required.');

    if (editSignedUrl.trim()) {
      try {
        new URL(editSignedUrl.trim());
      } catch {
        return alert('Signed URL must be a valid URL (include https://).');
      }
    }

    setSavingAddendumEdit(true);
    const { error } = await (supabase as any)
      .from('contract_addendums')
      .update({
        addendum_number: editAddendumNumber.trim() || null,
        effective_from: editEffectiveFrom,
        signed_date: editSignedDate || null,
        signed_url: editSignedUrl.trim() || null,
        notes: editAddendumNotes.trim() || null,
      })
      .eq('id', id);
    setSavingAddendumEdit(false);

    if (error) {
      alert('Could not save addendum: ' + error.message);
      return;
    }

    setEditingAddendumId(null);
    await loadAddendums();
    showToast('Addendum updated');
  }

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 50,
    borderRadius: 999,
    border: `1px solid ${ui.color.border}`,
    background: ui.color.surface,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 700,
    color: ui.color.text,
    boxShadow: ui.shadow?.sm ?? '0 8px 24px rgba(0,0,0,0.08)',
  };

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: ui.space.sm,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    alignItems: 'end',
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    height: 34,
    padding: '0 12px',
    borderRadius: 999,
    border: `1px solid ${active ? ui.color.primary : ui.color.border}`,
    background: active ? ui.color.primary : ui.color.surface,
    color: active ? '#fff' : ui.color.text,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  if (loading) {
    return (
      <div style={{ padding: 16, color: ui.color.text3, fontSize: 13 }}>
        Loading contract…
      </div>
    );
  }

  if (!row) {
    return (
      <div style={{ padding: 16, display: 'grid', gap: 10 }}>
        <div style={{ color: ui.color.text, fontWeight: 800, fontSize: 14 }}>
          Contract not found.
        </div>
        <Link
          href="/contracts"
          style={{
            textDecoration: 'none',
            color: ui.color.primary,
            fontWeight: 700,
          }}
        >
          ← Back to contracts
        </Link>
      </div>
    );
  }

  const headerTitle = row.contract_number || `Contract #${row.id}`;
  const headerSubtitle = `${companyLabel} • Status: ${row.status || status}`;

  return (
    <div
      style={{
        display: 'grid',
        gap: ui.space.md,
        padding: ui.space.lg,
        boxSizing: 'border-box',
      }}
    >
      <PageHeader
        title={headerTitle}
        subtitle={headerSubtitle}
        right={
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <Button variant="secondary" size="sm" onClick={() => router.back()}>
              ← Back
            </Button>
            {tab !== 'edit' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setTab('edit')}
              >
                Edit
              </Button>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelEdits}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={saving || !!dateError || !isDirty}
                  onClick={handleSaveContract}
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <Card style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={tabBtn(tab === 'overview')}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            style={tabBtn(tab === 'edit')}
            onClick={() => setTab('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            style={tabBtn(tab === 'addendums')}
            onClick={() => setTab('addendums')}
          >
            Addendums ({addendums.length})
          </button>
        </div>
      </Card>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <Card>
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <Badge tone={statusTone(row.status)}>{row.status || '—'}</Badge>
              <div style={{ fontSize: 12, color: ui.color.text3 }}>
                Created: {formatDate(row.created_at)} • Party:{' '}
                {String(row.party_type || '—')} • Payment:{' '}
                {String(row.payment_type || '—')}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadCurrentState()}
                disabled={currentStateLoading}
              >
                {currentStateLoading ? 'Refreshing…' : 'Refresh current'}
              </Button>
            </div>

            <div style={grid}>
              <Info
                label="Current payment term"
                value={
                  currentState?.payment_term != null
                    ? `${currentState.payment_term} days`
                    : '—'
                }
              />
              <Info
                label="Current payment type"
                value={currentState?.payment_type || '—'}
              />
              <Info
                label="Current expiry date"
                value={
                  currentState?.expiry_date
                    ? formatDate(currentState.expiry_date)
                    : '—'
                }
              />
              <Info
                label="Current platforms"
                value={
                  currentState?.platforms?.length
                    ? currentState.platforms.join(', ')
                    : '—'
                }
              />
            </div>

            <div style={grid}>
              <Info label="Company" value={companyLabel} />
              <Info
                label="Contract number"
                value={row.contract_number || '—'}
              />
              <Info label="Contract type" value={row.contract_type || '—'} />
              <Info label="Owner" value={row.contract_owner || '—'} />
              <Info label="Issue date" value={formatDate(row.issue_date)} />
              <Info
                label="Effective date"
                value={formatDate(row.effective_date)}
              />
              <Info
                label="Expiry date (base)"
                value={formatDate(row.expiry_date)}
              />
              <Info
                label="Automatic renewal"
                value={row.automatic_renewal ? 'Yes' : 'No'}
              />
              <Info
                label="Payment term (base)"
                value={
                  row.payment_term != null ? `${row.payment_term} days` : '—'
                }
              />

              <Info
                label="Primary won deal"
                value={
                  row.primary_won_deal_id ? (
                    <Link
                      href={`/deals/${row.primary_won_deal_id}`}
                      style={{
                        textDecoration: 'none',
                        color: ui.color.primary,
                        fontWeight: 700,
                      }}
                    >
                      {primaryWonDeal?.deal_name || 'Open won deal →'}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />

              {/* ✅ Linked rebate contract (visible even if contract_links select is blocked) */}
              <Info
                label="Linked rebate contract"
                value={
                  linkedRebateId ? (
                    <Link
                      href={`/contracts/${linkedRebateId}`}
                      style={{
                        textDecoration: 'none',
                        color: ui.color.primary,
                        fontWeight: 700,
                      }}
                    >
                      Open rebate contract →
                    </Link>
                  ) : rebateLoading ? (
                    'Loading…'
                  ) : (
                    '—'
                  )
                }
              />

              <Info
                label="Signed contract URL"
                value={
                  row.signed_contract_url ? (
                    <a
                      href={row.signed_contract_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: ui.color.primary,
                        textDecoration: 'none',
                        fontWeight: 700,
                      }}
                    >
                      Open →
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
              <Info label="Notes" value={row.notes || '—'} />
              <Info
                label="Platforms (base active)"
                value={
                  activePlatformCodes.length
                    ? activePlatformCodes.join(', ')
                    : '—'
                }
              />

              {rebateErr ? (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    fontSize: 12,
                    color: '#b91c1c',
                    fontWeight: 700,
                  }}
                >
                  Rebate link warning: {rebateErr}
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      )}

      {/* EDIT */}
      {tab === 'edit' && (
        <Card>
          <div style={{ display: 'grid', gap: ui.space.sm }}>
            <div style={grid}>
              <Select
                label="Company"
                value={companyId}
                onChange={(v) => setCompanyId(v)}
                options={companyOptions}
                disabled={saving}
              />
              <Input
                label="Fallback company name (only for old rows)"
                value={companyNameCache}
                onChange={setCompanyNameCache}
                placeholder="If company_id is empty, keep a company name here"
                disabled={saving}
              />
              <Input
                label="Contract number"
                value={contractNumber}
                onChange={setContractNumber}
                disabled={saving}
              />
              <Select
                label="Status"
                value={status}
                onChange={(v) => setStatus(v)}
                options={statusOptions}
                disabled={saving}
              />
            </div>

            <div style={grid}>
              <Select
                label="Party type"
                value={partyType}
                onChange={(v) => setPartyType(v as PartyType)}
                options={partyOptions}
                disabled={saving}
              />
              <Input
                label="Contract type"
                value={contractType}
                onChange={setContractType}
                placeholder="GMP / TT / TDS"
                disabled={saving}
              />
              <Input
                label="Contract owner"
                value={contractOwner}
                onChange={setContractOwner}
                placeholder="Ioana / Zoli / etc."
                disabled={saving}
              />
              <Select
                label="Payment type"
                value={paymentType}
                onChange={(v) => setPaymentType(v as PaymentType)}
                options={paymentTypeOptions}
                disabled={saving}
              />
            </div>

            <div style={grid}>
              <InputDate
                label="Issue date"
                value={issueDate}
                onChange={setIssueDate}
                disabled={saving}
              />
              <InputDate
                label="Effective date"
                value={effectiveDate}
                onChange={setEffectiveDate}
                disabled={saving}
                min={issueDate || undefined}
              />
              <InputDate
                label="Expiry date (base)"
                value={expiryDate}
                onChange={setExpiryDate}
                disabled={saving}
                min={effectiveDate || issueDate || undefined}
              />
              <div style={{ minWidth: 0 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: ui.color.text3,
                    marginBottom: 6,
                    display: 'block',
                  }}
                >
                  Automatic renewal
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: 0,
                    height: 40,
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: `1px solid ${ui.color.border}`,
                  }}
                >
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      disabled={saving}
                      onClick={() => setAutomaticRenewal(val)}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRight: val
                          ? `1px solid ${ui.color.border}`
                          : 'none',
                        background:
                          automaticRenewal === val
                            ? val
                              ? '#dcfce7'
                              : '#fee2e2'
                            : '#fff',
                        color:
                          automaticRenewal === val
                            ? val
                              ? '#166534'
                              : '#991b1b'
                            : ui.color.text3,
                        fontWeight: automaticRenewal === val ? 700 : 500,
                        fontSize: 13,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      {val ? 'Yes' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={grid}>
              <Input
                label="Payment term (days)"
                value={paymentTerm}
                onChange={setPaymentTerm}
                placeholder="e.g. 30"
                disabled={saving}
              />

              <Select
                label="Primary won deal (for this client)"
                value={primaryWonDealId}
                onChange={async (v) => {
                  setPrimaryWonDealId(v);
                  if (companyId) await loadWonDealsForCompany(companyId);
                }}
                options={wonDealOptions}
              />

              <Input
                label="Signed contract URL"
                value={signedUrl}
                onChange={setSignedUrl}
                placeholder="https://drive.google.com/..."
                disabled={saving}
              />
              <Input
                label="Notes"
                value={notes}
                onChange={setNotes}
                placeholder="Optional notes…"
                disabled={saving}
              />

              <div
                style={{
                  fontSize: 12,
                  color: ui.color.text3,
                  paddingBottom: 6,
                }}
              >
                {dateError ? (
                  <span style={{ color: '#b91c1c', fontWeight: 700 }}>
                    {dateError}
                  </span>
                ) : isDirty ? (
                  'You have changes not saved.'
                ) : (
                  'All changes saved.'
                )}
              </div>
            </div>

            {/* ✅ Linked rebate contract (EDIT) - NO extra buttons (Refresh/Save link/Remove link removed as requested) */}
            <div style={{ marginTop: 6 }}>
              <div
                style={{
                  fontSize: 12,
                  color: ui.color.text3,
                  marginBottom: 6,
                  fontWeight: 800,
                }}
              >
                Linked rebate contract
              </div>
              <div style={{ ...grid }}>
                <div style={{ minWidth: 0 }}>
                  <Select
                    label="Rebate contract (REB*)"
                    value={selectedRebateContractId}
                    onChange={(v) => setSelectedRebateContractId(v)}
                    options={rebateOptions}
                    disabled={saving || rebateContractsLoading || !companyId}
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: ui.color.text3,
                    }}
                  >
                    Pick an existing <b>REB</b> contract for the same company.
                    It will be linked when you click <b>Save</b>.
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <label
                    style={{
                      fontSize: 12,
                      color: ui.color.text3,
                      marginBottom: 6,
                      display: 'block',
                    }}
                  >
                    Current linked
                  </label>
                  <div
                    style={{
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {linkedRebateId ? (
                      <Link
                        href={`/contracts/${linkedRebateId}`}
                        style={{
                          textDecoration: 'none',
                          color: ui.color.primary,
                          fontWeight: 700,
                        }}
                      >
                        Open rebate contract →
                      </Link>
                    ) : (
                      <span style={{ fontSize: 13, color: ui.color.text2 }}>
                        —
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {rebateErr ? (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: '#b91c1c',
                    fontWeight: 700,
                  }}
                >
                  {rebateErr}
                </div>
              ) : null}
            </div>

            {/* Platforms */}
            <div>
              <div
                style={{
                  fontSize: 12,
                  color: ui.color.text3,
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Platforms in contract (base)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLATFORMS.map((p) => {
                  const checked = selectedPlatforms.includes(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => {
                        if (saving) return;
                        setSelectedPlatforms((prev) =>
                          checked
                            ? prev.filter((x) => x !== p.code)
                            : [...prev, p.code]
                        );
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 999,
                        border: `1px solid ${
                          checked ? ui.color.primary : ui.color.border
                        }`,
                        background: checked
                          ? ui.color.primarySoft
                          : ui.color.surface,
                        color: checked ? ui.color.primaryHover : ui.color.text2,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxSizing: 'border-box',
                      }}
                      title={checked ? 'Click to remove' : 'Click to add'}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <div
                style={{ marginTop: 10, fontSize: 12, color: ui.color.text3 }}
              >
                Saved platforms (base active):{' '}
                <span style={{ fontWeight: 700 }}>
                  {activePlatformCodes.length
                    ? activePlatformCodes.join(', ')
                    : '—'}
                </span>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelEdits}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={saving || !!dateError || !isDirty}
                onClick={handleSaveContract}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ADDENDUMS */}
      {tab === 'addendums' && (
        <Card style={{ padding: 14 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 800, color: ui.color.text }}
            >
              Addendums
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadAddendums()}
              >
                Refresh
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadCurrentState()}
              >
                Refresh current
              </Button>
            </div>
          </div>

          <div style={{ marginTop: 10, ...grid }}>
            <Info
              label="Current expiry date"
              value={
                currentState?.expiry_date
                  ? formatDate(currentState.expiry_date)
                  : '—'
              }
            />
            <Info
              label="Current payment term"
              value={
                currentState?.payment_term != null
                  ? `${currentState.payment_term} days`
                  : '—'
              }
            />
            <Info
              label="Current payment type"
              value={currentState?.payment_type || '—'}
            />
            <Info
              label="Current platforms"
              value={
                currentState?.platforms?.length
                  ? currentState.platforms.join(', ')
                  : '—'
              }
            />
          </div>

          {/* Create addendum */}
          <div
            style={{
              marginTop: 12,
              borderTop: `1px solid ${ui.color.border}`,
              paddingTop: 12,
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 800, color: ui.color.text }}
            >
              Create addendum
            </div>

            <div style={{ marginTop: 10, ...grid }}>
              <Input
                label="Addendum number (optional)"
                value={addAddendumNumber}
                onChange={setAddAddendumNumber}
                placeholder="A1"
              />
              <InputDate
                label="Effective from (required)"
                value={addEffectiveFrom}
                onChange={setAddEffectiveFrom}
              />
              <InputDate
                label="Signed date (optional)"
                value={addSignedDate}
                onChange={setAddSignedDate}
              />
              <Input
                label="Signed URL (optional)"
                value={addSignedUrl}
                onChange={setAddSignedUrl}
                placeholder="https://..."
              />
            </div>

            <div style={{ marginTop: 10, ...grid }}>
              <InputDate
                label="New expiry date (optional)"
                value={addNewExpiry}
                onChange={setAddNewExpiry}
              />
              <Input
                label="New payment term days (optional)"
                value={addNewPaymentTerm}
                onChange={setAddNewPaymentTerm}
                placeholder="e.g. 45"
              />
              <Select
                label="New payment type (optional)"
                value={addNewPaymentType}
                onChange={(v) => setAddNewPaymentType(v as any)}
                options={[
                  { value: '', label: 'No change' },
                  { value: 'Pre-payment', label: 'Pre-payment' },
                  { value: 'Post-payment', label: 'Post-payment' },
                ]}
              />
              <Input
                label="Notes (optional)"
                value={addNotes}
                onChange={setAddNotes}
                placeholder="What changed and why…"
              />
            </div>

            {/* Platforms add/remove */}
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 12,
                  color: ui.color.text3,
                  fontWeight: 800,
                  marginBottom: 6,
                }}
              >
                Platforms delta
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: ui.color.text3,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Add platforms
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PLATFORMS.map((p) => {
                      const checked = addPlatformsAdd.includes(p.code);
                      return (
                        <button
                          key={`add-${p.code}`}
                          type="button"
                          onClick={() =>
                            setAddPlatformsAdd((prev) =>
                              checked
                                ? prev.filter((x) => x !== p.code)
                                : [...prev, p.code]
                            )
                          }
                          style={{
                            padding: '8px 10px',
                            borderRadius: 999,
                            border: `1px solid ${
                              checked ? ui.color.primary : ui.color.border
                            }`,
                            background: checked
                              ? ui.color.primarySoft
                              : ui.color.surface,
                            color: checked
                              ? ui.color.primaryHover
                              : ui.color.text2,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: ui.color.text3,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Remove platforms
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {PLATFORMS.map((p) => {
                      const checked = addPlatformsRemove.includes(p.code);
                      return (
                        <button
                          key={`rem-${p.code}`}
                          type="button"
                          onClick={() =>
                            setAddPlatformsRemove((prev) =>
                              checked
                                ? prev.filter((x) => x !== p.code)
                                : [...prev, p.code]
                            )
                          }
                          style={{
                            padding: '8px 10px',
                            borderRadius: 999,
                            border: `1px solid ${
                              checked ? '#b91c1c' : ui.color.border
                            }`,
                            background: checked ? '#fee2e2' : ui.color.surface,
                            color: checked ? '#991b1b' : ui.color.text2,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateAddendum}
                    disabled={creatingAddendum}
                  >
                    {creatingAddendum ? 'Creating…' : 'Create addendum'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div
            style={{
              marginTop: 14,
              borderTop: `1px solid ${ui.color.border}`,
              paddingTop: 12,
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 800, color: ui.color.text }}
            >
              History
            </div>

            {addendums.length === 0 ? (
              <div
                style={{ marginTop: 10, color: ui.color.text3, fontSize: 13 }}
              >
                No addendums yet.
              </div>
            ) : (
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {addendums.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: `1px solid ${ui.color.border}`,
                      borderRadius: 12,
                      padding: 12,
                      background: ui.color.surface,
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    {editingAddendumId === a.id ? (
                      /* ── EDIT MODE ── */
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: ui.color.text,
                            marginBottom: 2,
                          }}
                        >
                          Editing addendum
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 10,
                          }}
                        >
                          <Input
                            label="Addendum number"
                            value={editAddendumNumber}
                            onChange={setEditAddendumNumber}
                            placeholder="e.g. 1, 2, A"
                          />
                          <InputDate
                            label="Effective from *"
                            value={editEffectiveFrom}
                            onChange={setEditEffectiveFrom}
                            required
                          />
                          <InputDate
                            label="Signed date"
                            value={editSignedDate}
                            onChange={setEditSignedDate}
                          />
                          <Input
                            label="Signed URL"
                            value={editSignedUrl}
                            onChange={setEditSignedUrl}
                            placeholder="https://..."
                          />
                        </div>
                        <Input
                          label="Notes"
                          value={editAddendumNotes}
                          onChange={setEditAddendumNotes}
                          placeholder="Optional notes"
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveAddendumEdit(a.id)}
                            disabled={savingAddendumEdit}
                          >
                            {savingAddendumEdit ? 'Saving…' : 'Save changes'}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={cancelEditAddendum}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* ── VIEW MODE ── */
                      <>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            flexWrap: 'wrap',
                            alignItems: 'center',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: ui.color.text,
                            }}
                          >
                            {a.addendum_number
                              ? `Addendum ${a.addendum_number}`
                              : `Addendum #${a.id}`}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div
                              style={{ fontSize: 12, color: ui.color.text3 }}
                            >
                              Effective from:{' '}
                              <span style={{ fontWeight: 700 }}>
                                {formatDate(a.effective_from)}
                              </span>
                              {a.signed_date
                                ? ` • Signed: ${formatDate(a.signed_date)}`
                                : ''}
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => startEditAddendum(a)}
                            >
                              Edit
                            </Button>
                          </div>
                        </div>

                        <div
                          style={{
                            borderTop: `1px solid ${ui.color.border}`,
                            paddingTop: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: ui.color.text3,
                              fontWeight: 800,
                            }}
                          >
                            Changes
                          </div>
                          <ChangesPretty changes={a.changes} />
                        </div>

                        {a.signed_url ? (
                          <a
                            href={a.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 12,
                              color: ui.color.primary,
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            Open signed addendum →
                          </a>
                        ) : null}

                        {a.notes ? (
                          <div style={{ fontSize: 12, color: ui.color.text2 }}>
                            {a.notes}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {saveToast ? <div style={toastStyle}>{saveToast}</div> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${ui.color.border}`,
        borderRadius: 12,
        background: ui.color.surface,
        padding: 12,
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 12, color: ui.color.text3, fontWeight: 600 }}>
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          fontWeight: 700,
          color: ui.color.text,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
    </div>
  );
}
