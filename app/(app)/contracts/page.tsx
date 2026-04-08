'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '../components/PageHeader';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { InputDate } from '../components/ui/InputDate';
import { Select } from '../components/ui/Select';
import { TableShell } from '../components/ui/TableShell';
import { Badge } from '../components/ui/Badge';
import { ui } from '../components/ui/tokens';

// ---- Types ----
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

// ✅ Enforced contract types (v1)
type ContractTypeCode = 'REB' | 'GMP' | 'SERV' | 'SUP' | 'GA4' | 'GCP' | 'TT' | 'TDS' | 'TNG' | 'OTR';

const CONTRACT_TYPES: { code: ContractTypeCode; label: string; help: string }[] = [
  { code: 'GMP', label: 'GMP – Google Marketing Platform (DV360, CM360, SA360)', help: 'Google Marketing Platform reseller agreement covering DV360, CM360 and/or SA360' },
  { code: 'REB', label: 'REB – Rebate Agreement', help: 'Rebate / kickback agreement with Google or other partners' },
  { code: 'SUP', label: 'SUP – Support (GMP, GA4, etc.)', help: 'Support services for GMP products, GA4 or other platforms' },
  { code: 'SERV', label: 'SERV – Services (META, Google Ads, etc.)', help: 'Managed services: META, Google Ads, creative, measurement, etc.' },
  { code: 'GA4', label: 'GA4 – GA4 360 Licence', help: 'Google Analytics 4 360 licence agreement' },
  { code: 'GCP', label: 'GCP – Google Cloud Platform', help: 'Google Cloud Platform reseller agreement' },
  { code: 'TT', label: 'TT – TikTok', help: 'TikTok managed service or reseller agreement' },
  { code: 'TDS', label: 'TDS – Teads', help: 'Teads advertising platform agreement' },
  { code: 'TNG', label: 'TNG – Training', help: 'Training and enablement services' },
  { code: 'OTR', label: 'OTR – Other', help: 'Other contract types not covered above' },
];

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

const CONTRACT_OWNERS = ['Corina', 'Raluca', 'Stefania'] as const;

interface Company {
  id: string;
  company_name: string;
  org_id: string | null;
}

interface Contract {
  id: number;
  created_at: string;
  org_id?: string | null;

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
  party_type: string | null;

  payment_type?: string | null;
  payment_term?: number | null;
  signed_contract_url?: string | null;
  notes?: string | null;

  primary_won_deal_id?: string | null;
}

interface ContractPlatform {
  id: number;
  created_at: string;
  org_id?: string | null;
  contract_id: number;
  platform_code: PlatformCode;
  active: boolean;
}

// for primary won deal dropdown
interface DealRow {
  id: string;
  deal_name: string | null;
  stage: DealStage | string | null;
  company_id: string | null;
  value?: number | null;
  owner?: string | null;
  created_at?: string | null;
}

// rebate candidate (contracts with type ~ REB)
type RebateCandidate = {
  id: number;
  contract_number: string | null;
  contract_type: string | null;
  status: string | null;
  issue_date: string | null;
  created_at?: string | null;
};

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

function norm(s: string) {
  return (s || '').trim().toLowerCase();
}

function cmpYMD(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function statusTone(status?: string | null): 'neutral' | 'green' | 'amber' | 'red' | 'gray' | 'blue' {
  const s = (status || '').toLowerCase().trim();
  if (s === 'active') return 'green';
  if (s === 'pending') return 'amber';
  if (s === 'terminated') return 'red';
  if (s === 'expired') return 'gray';
  return 'neutral';
}

function isRebateType(type: string) {
  const t = (type || '').toLowerCase();
  return t.includes('reb');
}

export default function Page() {
  return <ContractsPage />;
}

function ContractsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const companyIdFromUrl = searchParams.get('companyId') || '';
  const newFromUrl = searchParams.get('new') || '';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractPlatforms, setContractPlatforms] = useState<ContractPlatform[]>([]);
  const [contractLinks, setContractLinks] = useState<{ contract_id: number; linked_contract_id: number; link_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI state
  const [showCreate, setShowCreate] = useState(false);
  const [hoverRowId, setHoverRowId] = useState<number | null>(null);

  // Form state
  const [companyId, setCompanyId] = useState('');
  const [contractNumber, setContractNumber] = useState('');
  const [status, setStatus] = useState('Active');

  // ✅ dropdown-controlled contract type
  const [contractType, setContractType] = useState<ContractTypeCode | ''>('');

  const [issueDate, setIssueDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [automaticRenewal, setAutomaticRenewal] = useState(false);

  const [contractOwner, setContractOwner] = useState<(typeof CONTRACT_OWNERS)[number] | ''>('');
  const [partyType, setPartyType] = useState<PartyType>('Client');

  const [paymentType, setPaymentType] = useState<PaymentType>('Post-payment');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [signedUrl, setSignedUrl] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformCode[]>([]);

  const [wonDeals, setWonDeals] = useState<DealRow[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [primaryWonDealId, setPrimaryWonDealId] = useState('');

  const [rebateCandidates, setRebateCandidates] = useState<RebateCandidate[]>([]);
  const [rebateLoading, setRebateLoading] = useState(false);
  const [selectedRebateContractId, setSelectedRebateContractId] = useState('');
  const [rebateSuggestMsg, setRebateSuggestMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | string>('ALL');
  const [filterOwner, setFilterOwner] = useState<'ALL' | string>('ALL');
  const [filterPlatform, setFilterPlatform] = useState<'ALL' | PlatformCode>('ALL');

  // Open create when coming from TopNav (?new=1), then clean URL
  useEffect(() => {
    if (!newFromUrl) return;

    const shouldOpen = newFromUrl === '1' || newFromUrl.toLowerCase() === 'true';
    if (!shouldOpen) return;

    setShowCreate(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const params = new URLSearchParams();
    if (companyIdFromUrl) params.set('companyId', companyIdFromUrl);

    const next = params.toString() ? `/contracts?${params.toString()}` : '/contracts';
    router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFromUrl]);

  // Prefill company when navigated from company detail
  useEffect(() => {
    if (!companyIdFromUrl) return;
    setCompanyId(companyIdFromUrl);
    setShowCreate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyIdFromUrl]);

  // Smart default: if Issue date set and Effective empty -> set Effective = Issue (still okay)
  // ✅ But we do NOT enforce effective >= issue.
  useEffect(() => {
    if (!issueDate) return;
    if (!effectiveDate) setEffectiveDate(issueDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDate]);

  // ✅ Date validation rules (updated):
  // - Effective can be BEFORE Issue (retroactive allowed)
  // - Expiry must be on/after Effective (if both set)
  const dateError = useMemo(() => {
    const e = effectiveDate;
    const x = expiryDate;
    if (e && x && cmpYMD(x, e) < 0) return 'Expiry date cannot be before Effective date.';
    return null;
  }, [effectiveDate, expiryDate]);

  // ---- Load data ----
  useEffect(() => {
    async function loadData() {
      setLoading(true);

      const [
        { data: companiesData, error: companiesError },
        { data: contractsData, error: contractsError },
        { data: platformsData, error: platformsError },
        { data: linksData },
      ] = await Promise.all([
        supabase.from('companies').select('id, company_name, org_id').order('company_name', { ascending: true }),
        supabase.from('contracts').select('*').order('created_at', { ascending: false }),
        supabase.from('contract_platforms').select('*'),
        (supabase as any).from('contract_links').select('contract_id, linked_contract_id, link_type'),
      ]);

      if (companiesError) {
        console.error(companiesError);
        alert('Could not load companies.');
      } else setCompanies((companiesData || []) as Company[]);

      if (contractsError) {
        console.error(contractsError);
        alert('Could not load contracts.');
      } else setContracts((contractsData || []) as Contract[]);

      if (platformsError) {
        console.error(platformsError);
        alert('Could not load contract platforms.');
      } else setContractPlatforms((platformsData || []) as ContractPlatform[]);

      setContractLinks((linksData || []) as { contract_id: number; linked_contract_id: number; link_type: string }[]);

      setLoading(false);
    }

    loadData();
  }, []);

  function getPlatformsForContractCodes(contractId: number): PlatformCode[] {
    return contractPlatforms
      .filter((cp) => cp.contract_id === contractId && cp.active)
      .map((cp) => cp.platform_code);
  }

  function getPlatformsLabel(contractId: number): string {
    return getPlatformsForContractCodes(contractId).join(', ');
  }

  function getContractTypeHelp(code: string | null | undefined) {
    const c = (code || '').trim().toUpperCase();
    const found = CONTRACT_TYPES.find((x) => x.code === c);
    return found?.help || null;
  }

  async function generateContractNumber(issueDateStr: string, party: PartyType, typeCode: string): Promise<string> {
    const d = new Date(issueDateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyymmdd = `${yyyy}${mm}${dd}`;

    const { count, error } = await (supabase as any)
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('issue_date', issueDateStr);

    if (error) console.error('Error counting contracts for date', error);

    const index = (count ?? 0) + 1;
    const partyFlag = party === 'Client' ? 'C' : 'S';
    const cleanType = (typeCode || 'GEN').replace(/\s+/g, '').toUpperCase();

    return `SNS${yyyymmdd}${index}${partyFlag}${cleanType}`;
  }

  async function reloadPlatforms() {
    const { data, error } = await supabase.from('contract_platforms').select('*');
    if (error) {
      console.error(error);
      return;
    }
    setContractPlatforms((data || []) as ContractPlatform[]);
  }

  async function loadWonDealsForCompany(company_id: string) {
    const cid = (company_id || '').trim();
    if (!cid) {
      setWonDeals([]);
      setPrimaryWonDealId('');
      return;
    }

    setDealsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('deals')
        .select('id, deal_name, stage, company_id, value, owner, created_at')
        .eq('company_id', cid)
        .eq('stage', 'Won')
        .order('deal_name', { ascending: true });

      if (error) {
        console.error(error);
        setWonDeals([]);
        return;
      }

      const rows = (data || []) as DealRow[];
      setWonDeals(rows);

      if (primaryWonDealId && !rows.some((d) => d.id === primaryWonDealId)) {
        setPrimaryWonDealId('');
      }
    } finally {
      setDealsLoading(false);
    }
  }

  async function loadRebateCandidatesForCompany(company_id: string) {
    const cid = (company_id || '').trim();
    if (!cid) {
      setRebateCandidates([]);
      setSelectedRebateContractId('');
      setRebateSuggestMsg(null);
      return;
    }

    setRebateLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('contracts')
        .select('id, contract_number, contract_type, status, issue_date, created_at')
        .eq('company_id', cid)
        .ilike('contract_type', '%reb%')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        setRebateCandidates([]);
        setRebateSuggestMsg(null);
        return;
      }

      const rows = (data || []) as RebateCandidate[];
      setRebateCandidates(rows);

      if (!isRebateType(contractType || '')) {
        if (selectedRebateContractId) {
          if (!rows.some((r) => String(r.id) === selectedRebateContractId)) {
            setSelectedRebateContractId('');
            setRebateSuggestMsg(null);
          }
          return;
        }

        if (rows.length === 1) {
          setSelectedRebateContractId(String(rows[0].id));
          setRebateSuggestMsg(`Suggested rebate contract: ${rows[0].contract_number || `Contract #${rows[0].id}`}`);
          return;
        }

        if (rows.length > 1) {
          const active = rows.find((r) => (r.status || '').toLowerCase() === 'active') || rows[0];
          setSelectedRebateContractId(String(active.id));
          setRebateSuggestMsg(`Suggested rebate contract: ${active.contract_number || `Contract #${active.id}`} (latest/active)`);
          return;
        }

        setRebateSuggestMsg(null);
      } else {
        setSelectedRebateContractId('');
        setRebateSuggestMsg('This is a rebate contract. Link it from the base (service) contract instead.');
      }
    } finally {
      setRebateLoading(false);
    }
  }

  useEffect(() => {
    if (!showCreate) return;
    loadWonDealsForCompany(companyId);
    loadRebateCandidatesForCompany(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, showCreate]);

  useEffect(() => {
    if (!showCreate) return;
    if (companyId) loadRebateCandidatesForCompany(companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractType]);

  async function handleAddContract(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const companyIdClean = (companyId || '').trim();
    if (!companyIdClean) return alert('Please select a company.');
    if (!issueDate) return alert('Please select an issue date.');
    if (!contractType) return alert('Please select a Contract type (REB, GMP, SERV, SUP, GA4, GCP, TT).');
    if (!contractOwner) return alert('Please select a Contract owner. This field is required.');
    if (dateError) return alert(dateError);

    const selectedCompany = companies.find((c) => c.id === companyIdClean);
    if (!selectedCompany) return alert('Selected company not found. Please refresh and try again.');

    if (!selectedCompany.org_id) {
      alert("Selected company has no org_id. This row can't be used with RLS. Fix the company org_id first.");
      return;
    }

    const pt = paymentTerm.trim();
    const ptNum = pt ? Number(pt) : null;
    if (pt && (Number.isNaN(ptNum) || ptNum! < 0)) return alert('Payment term must be a number of days (>= 0).');

    const url = signedUrl.trim();
    if (url) {
      try {
        new URL(url);
      } catch {
        return alert('Signed contract URL must be a valid URL (include https://).');
      }
    }

    const pId = (primaryWonDealId || '').trim();
    if (pId) {
      const ok = wonDeals.some((d) => d.id === pId);
      if (!ok) return alert('Selected Primary WON deal is not valid for the chosen company. Please re-select.');
    }

    const rebateId = (selectedRebateContractId || '').trim();
    if (rebateId && !isRebateType(contractType)) {
      const ok = rebateCandidates.some((r) => String(r.id) === rebateId);
      if (!ok) return alert('Selected rebate contract is not valid for the chosen company. Please re-select.');
    }

    setSaving(true);

    try {
      let finalNumber = contractNumber.trim();
      if (!finalNumber) finalNumber = await generateContractNumber(issueDate, partyType, contractType);

      const { data, error } = await (supabase as any)
        .from('contracts')
        .insert([
          {
            org_id: selectedCompany.org_id,
            company_id: companyIdClean,
            company_name: selectedCompany.company_name ?? null,
            contract_number: finalNumber,
            status,
            contract_type: contractType,
            issue_date: issueDate,
            effective_date: effectiveDate || null,
            expiry_date: expiryDate || null,
            automatic_renewal: automaticRenewal,
            contract_owner: contractOwner || null,
            party_type: partyType,

            payment_type: paymentType,
            payment_term: ptNum,
            signed_contract_url: url || null,
            notes: notes.trim() || null,

            primary_won_deal_id: pId || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(error);
        alert('Could not save contract: ' + error.message);
        return;
      }

      const newContract = data as Contract;

      if (selectedPlatforms.length > 0) {
        const rows = selectedPlatforms.map((code) => ({
          org_id: selectedCompany.org_id,
          contract_id: newContract.id,
          platform_code: code,
          active: true,
          created_at: new Date().toISOString(),
        }));

        const { error: platformsError } = await supabase.from('contract_platforms').insert(rows);

        if (platformsError) {
          console.error(platformsError);
          alert('Contract saved, but could not save platforms: ' + platformsError.message);
        } else {
          await reloadPlatforms();
        }
      }

      if (!isRebateType(contractType)) {
        const rebateIdNum = rebateId ? Number(rebateId) : null;
        if (rebateIdNum && Number.isFinite(rebateIdNum)) {
          const { error: linkErr } = await (supabase as any)
            .from('contract_rebate_links')
            .upsert(
              [
                {
                  org_id: selectedCompany.org_id,
                  base_contract_id: newContract.id,
                  linked_contract_id: rebateIdNum,
                  created_at: new Date().toISOString(),
                },
              ],
              { onConflict: 'base_contract_id' }
            );

          if (linkErr) {
            console.error(linkErr);
            alert('Contract saved, but rebate link failed: ' + linkErr.message);
          }
        }
      }

      setContracts((prev) => [newContract, ...prev]);

      setCompanyId(companyIdFromUrl || '');
      setContractNumber('');
      setStatus('Active');
      setContractType('');
      setIssueDate('');
      setEffectiveDate('');
      setExpiryDate('');
      setAutomaticRenewal(false);
      setContractOwner('');
      setPartyType('Client');

      setPaymentType('Post-payment');
      setPaymentTerm('');
      setSignedUrl('');
      setNotes('');
      setSelectedPlatforms([]);

      setWonDeals([]);
      setPrimaryWonDealId('');

      setRebateCandidates([]);
      setSelectedRebateContractId('');
      setRebateSuggestMsg(null);

      setShowCreate(false);
    } finally {
      setSaving(false);
    }
  }

  const ownerOptions = useMemo(
    () => Array.from(new Set(contracts.map((c) => (c.contract_owner ?? '').trim()).filter(Boolean))).sort(),
    [contracts]
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(contracts.map((c) => (c.status ?? '').trim()).filter(Boolean))).sort(),
    [contracts]
  );

  const filteredContracts = useMemo(() => {
    const q = norm(search);

    return contracts.filter((c) => {
      const statusOk = filterStatus === 'ALL' || (c.status ?? '') === filterStatus;
      const ownerOk = filterOwner === 'ALL' || (c.contract_owner ?? '') === filterOwner;

      const platformCodes = getPlatformsForContractCodes(c.id);
      const platformOk = filterPlatform === 'ALL' || platformCodes.includes(filterPlatform);

      if (!statusOk || !ownerOk || !platformOk) return false;

      if (q) {
        const hay = [
          c.company_name ?? '',
          c.contract_number ?? '',
          c.contract_type ?? '',
          c.contract_owner ?? '',
          c.party_type ?? '',
          getPlatformsLabel(c.id),
          c.payment_type ?? '',
          c.notes ?? '',
        ].join(' ').toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [contracts, filterStatus, filterOwner, filterPlatform, contractPlatforms, search]);

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: ui.space.sm,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    alignItems: 'end',
  };

  const companyOptions = useMemo(
    () => [{ value: '', label: 'Select company…' }, ...companies.map((c) => ({ value: c.id, label: c.company_name }))],
    [companies]
  );

  const partyOptions = useMemo(
    () => [
      { value: 'Client', label: 'Client' },
      { value: 'Supplier', label: 'Supplier' },
    ],
    []
  );

  const createStatusOptions = useMemo(
    () => [
      { value: 'Active', label: 'Active' },
      { value: 'Pending', label: 'Pending' },
      { value: 'Terminated', label: 'Terminated' },
      { value: 'Expired', label: 'Expired' },
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

  const filterStatusOptions = useMemo(
    () => [{ value: 'ALL', label: 'All' }, ...statusOptions.map((s) => ({ value: s, label: s }))],
    [statusOptions]
  );

  const filterOwnerOptions = useMemo(
    () => [{ value: 'ALL', label: 'All' }, ...ownerOptions.map((o) => ({ value: o, label: o }))],
    [ownerOptions]
  );

  const filterPlatformOptions = useMemo(
    () => [{ value: 'ALL', label: 'All' }, ...PLATFORMS.map((p) => ({ value: p.code, label: p.label }))],
    []
  );

  const createOwnerOptions = useMemo(
    () => [{ value: '', label: 'Select owner…' }, ...CONTRACT_OWNERS.map((o) => ({ value: o, label: o }))],
    []
  );

  const wonDealOptions = useMemo(() => {
    const base = [{ value: '', label: dealsLoading ? 'Loading WON deals…' : 'Not selected' }];
    const list = wonDeals.map((d) => ({
      value: d.id,
      label: d.deal_name || `Won deal ${d.id}`,
    }));
    return [...base, ...list];
  }, [wonDeals, dealsLoading]);

  const rebateOptions = useMemo(() => {
    const base = [{ value: '', label: rebateLoading ? 'Loading rebate contracts…' : 'Not linked' }];
    const list = rebateCandidates.map((r) => ({
      value: String(r.id),
      label: `${r.contract_number || `Contract #${r.id}`} • ${(r.status || '—')}`,
    }));
    return [...base, ...list];
  }, [rebateCandidates, rebateLoading]);

  const contractTypeOptions = useMemo(() => {
    return [{ value: '', label: 'Select type…' }, ...CONTRACT_TYPES.map((t) => ({ value: t.code, label: t.label }))];
  }, []);

  // ✅ Expiry must be >= Effective (not issue)
  const minExpiry = effectiveDate || undefined;

  const creatingRebate = isRebateType(contractType || '');
  const selectedTypeHelp = getContractTypeHelp(contractType);

  return (
    <div style={{ display: 'grid', gap: ui.space.md, padding: ui.space.lg, boxSizing: 'border-box' }}>
      <PageHeader
        title="Contracts"
        subtitle="Manage all contracts"
        actions={[
          {
            label: showCreate ? 'Close' : '+ New Contract',
            primary: true,
            onClick: () => {
              setShowCreate((v) => !v);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            },
          },
        ]}
      />

      {/* FILTERS (TOP) */}
      <Card>
        <div style={grid}>
          <div style={{ minWidth: 0 }}>
            <Input label="Search" value={search} onChange={setSearch} placeholder="Search company, contract #, type, owner, platform..." />
          </div>

          <div style={{ minWidth: 0 }}>
            <Select label="Status" value={filterStatus} onChange={(v) => setFilterStatus(v as any)} options={filterStatusOptions} />
          </div>

          <div style={{ minWidth: 0 }}>
            <Select label="Owner" value={filterOwner} onChange={(v) => setFilterOwner(v as any)} options={filterOwnerOptions} />
          </div>

          <div style={{ minWidth: 0 }}>
            <Select label="Platform" value={filterPlatform} onChange={(v) => setFilterPlatform(v as any)} options={filterPlatformOptions} />
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: ui.color.text3 }}>
          {loading ? 'Loading…' : `${filteredContracts.length} / ${contracts.length} shown`}
        </div>
      </Card>

      {/* CREATE MODULE */}
      {showCreate ? (
        <Card>
          <form onSubmit={handleAddContract} style={{ display: 'grid', gap: ui.space.sm }}>
            <Select
              label="Company"
              value={companyId}
              onChange={(v) => {
                setCompanyId(v);
                setPrimaryWonDealId('');
                setSelectedRebateContractId('');
                setRebateSuggestMsg(null);
              }}
              options={companyOptions}
              disabled={saving}
            />

            <div style={grid}>
              <div style={{ minWidth: 0 }}>
                <Select
                  label="Primary won deal (optional)"
                  value={primaryWonDealId}
                  onChange={setPrimaryWonDealId}
                  options={wonDealOptions}
                  disabled={saving || !companyId}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: ui.color.text3 }}>
                  Dropdown shows only <b>Won</b> deals for the selected company.
                </div>
              </div>
            </div>

            <div style={grid}>
              <div style={{ minWidth: 0 }}>
                <Select
                  label="Linked rebate contract (optional)"
                  value={selectedRebateContractId}
                  onChange={(v) => {
                    setSelectedRebateContractId(v);
                    setRebateSuggestMsg(null);
                  }}
                  options={rebateOptions}
                  disabled={saving || !companyId || creatingRebate}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: ui.color.text3 }}>
                  {creatingRebate
                    ? 'This is a rebate contract. Link it from the base (service) contract instead.'
                    : 'We auto-suggest the latest/active rebate contract for this client (you can change it).'}
                </div>
                {rebateSuggestMsg ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: ui.color.text3 }}>
                    <b>Suggestion:</b> {rebateSuggestMsg}
                  </div>
                ) : null}
              </div>
            </div>

            <div style={grid}>
              <div style={{ minWidth: 0 }}>
                <Input label="Manual contract #" value={contractNumber} onChange={setContractNumber} placeholder="Optional" disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                <Select label="Party type" value={partyType} onChange={(v) => setPartyType(v as PartyType)} options={partyOptions} disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                <Select label="Status" value={status} onChange={setStatus} options={createStatusOptions} disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                <Select label="Payment type" value={paymentType} onChange={(v) => setPaymentType(v as PaymentType)} options={paymentTypeOptions} disabled={saving} />
              </div>
            </div>

            <div style={grid}>
              {/* ✅ Contract Type dropdown */}
              <div style={{ minWidth: 0 }}>
                <Select
                  label="Contract type"
                  value={contractType}
                  onChange={(v) => setContractType((v as ContractTypeCode) || '')}
                  options={contractTypeOptions}
                  disabled={saving}
                />

                <div style={{ marginTop: 6, fontSize: 12, color: ui.color.text3 }}>
                  {contractType
                    ? `${contractType} = ${selectedTypeHelp || '—'}`
                    : 'Choose a type so everyone uses the same naming (REB, GMP, SERV, SUP, GA4, GCP, TT).'}
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                <InputDate label="Issue date" value={toISODateInput(issueDate)} onChange={setIssueDate} disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                {/* ✅ Effective date NOT constrained by Issue date */}
                <InputDate label="Effective date" value={toISODateInput(effectiveDate)} onChange={setEffectiveDate} disabled={saving} />
                <div style={{ marginTop: 6, fontSize: 12, color: ui.color.text3 }}>
                  Effective date can be retroactive (can be before Issue date).
                </div>
              </div>

              <div style={{ minWidth: 0 }}>
                {/* ✅ Expiry date constrained by Effective date */}
                <InputDate
                  label="Expiry date"
                  value={toISODateInput(expiryDate)}
                  onChange={setExpiryDate}
                  disabled={saving}
                  min={minExpiry}
                  hint={minExpiry ? `Must be on/after ${minExpiry}` : undefined}
                />
              </div>
            </div>

            {dateError ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: `1px solid ${ui.color.border}`,
                  background: ui.color.surface2,
                  color: '#b91c1c',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {dateError}
              </div>
            ) : null}

            <div style={grid}>
              <div style={{ minWidth: 0 }}>
                <Select
                  label="Contract owner *"
                  value={contractOwner}
                  onChange={(v) => setContractOwner(v as any)}
                  options={createOwnerOptions}
                  disabled={saving}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <Input label="Payment term (days)" value={paymentTerm} onChange={setPaymentTerm} placeholder="e.g. 30" disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                <Input label="Signed contract URL" value={signedUrl} onChange={setSignedUrl} placeholder="https://drive.google.com/..." disabled={saving} />
              </div>

              <div style={{ minWidth: 0 }}>
                <label style={{ fontSize: 12, color: ui.color.text3, marginBottom: 6, display: 'block' }}>Automatic renewal</label>
                <div style={{ display: 'flex', gap: 0, height: 40, borderRadius: 8, overflow: 'hidden', border: `1px solid ${ui.color.border}` }}>
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      disabled={saving}
                      onClick={() => setAutomaticRenewal(val)}
                      style={{
                        flex: 1,
                        border: 'none',
                        borderRight: val ? `1px solid ${ui.color.border}` : 'none',
                        background: automaticRenewal === val ? (val ? '#dcfce7' : '#fee2e2') : '#fff',
                        color: automaticRenewal === val ? (val ? '#166534' : '#991b1b') : ui.color.text3,
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

            <div>
              <div style={{ fontSize: 12, color: ui.color.text3, marginBottom: 6 }}>Platforms in contract</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PLATFORMS.map((p) => {
                  const checked = selectedPlatforms.includes(p.code);
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => {
                        if (saving) return;
                        setSelectedPlatforms((prev) => (checked ? prev.filter((x) => x !== p.code) : [...prev, p.code]));
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 999,
                        border: `1px solid ${checked ? ui.color.primary : ui.color.border}`,
                        background: checked ? ui.color.primarySoft : ui.color.surface,
                        color: checked ? ui.color.primaryHover : ui.color.text2,
                        fontSize: 12,
                        fontWeight: 600,
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
            </div>

            <div style={{ minWidth: 0 }}>
              <Input label="Notes" value={notes} onChange={setNotes} placeholder="Optional notes for AM…" disabled={saving} />
            </div>

            <Button type="submit" variant="primary" disabled={saving || !!dateError}>
              {saving ? 'Saving…' : 'Add Contract'}
            </Button>
          </form>
        </Card>
      ) : null}

      {/* TABLE */}
      <Card style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 12, color: ui.color.text3 }}>Loading…</div>
        ) : filteredContracts.length === 0 ? (
          <div style={{ padding: 12, color: ui.color.text3 }}>No contracts match filters.</div>
        ) : (
          <TableShell>
            <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr style={{ background: ui.color.surface2 }}>
                  {['Company', 'Contract #', 'Party', 'Type', 'Platforms', 'Status', 'Effective', 'Expiry', 'Owner', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderBottom: `1px solid ${ui.color.border}`,
                        color: ui.color.text3,
                        fontSize: 12,
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredContracts.map((c) => {
                  const isHover = hoverRowId === c.id;
                  const missingCompany = !c.company_id;

                  return (
                    <tr
                      key={c.id}
                      onMouseEnter={() => setHoverRowId(c.id)}
                      onMouseLeave={() => setHoverRowId(null)}
                      style={{ background: isHover ? ui.color.surface2 : ui.color.surface }}
                    >
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}` }}>
                        <div style={{ fontWeight: 600 }}>{c.company_name ?? '—'}</div>
                        {missingCompany ? (
                          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2, fontWeight: 600 }}>
                            Missing company_id (old data)
                          </div>
                        ) : null}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}` }}>
                        <Link href={`/contracts/${c.id}`} style={{ color: ui.color.primary, textDecoration: 'none', fontWeight: 600 }}>
                          {c.contract_number ?? `Contract #${c.id}`}
                        </Link>
                        <div style={{ fontSize: 12, color: ui.color.text3, marginTop: 2 }}>Issued: {formatDate(c.issue_date)}</div>
                        {contractLinks.some((l) => l.contract_id === c.id && l.link_type === 'REBATE') && (
                          <div style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                            REB linked
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}` }}>{c.party_type ?? '—'}</td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}`, fontWeight: 600 }}>
                        {c.contract_type ?? '—'}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}`, color: ui.color.text3 }}>
                        {getPlatformsLabel(c.id) || '—'}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}` }}>
                        <Badge tone={statusTone(c.status)}>{c.status ?? '—'}</Badge>
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}`, whiteSpace: 'nowrap' }}>
                        {formatDate(c.effective_date)}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}`, whiteSpace: 'nowrap' }}>
                        {formatDate(c.expiry_date)}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}`, fontWeight: 600 }}>
                        {c.contract_owner ?? '—'}
                      </td>

                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${ui.color.border}` }}>
                        <Link href={`/contracts/${c.id}`} style={{ textDecoration: 'none' }}>
                          <Button variant="secondary" size="sm">
                            Open
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>
    </div>
  );
}