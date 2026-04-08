import { supabase } from './supabaseClient';

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

export async function syncCompanyFromContract(params: {
  companyId: string;
  contractId: number;
  payment_type: string | null;
  payment_term: number | null;
}) {
  const { companyId, contractId, payment_type, payment_term } = params;

  try {
    // Read active platforms for this contract
    const { data: platRows, error: platErr } = await supabase
      .from('contract_platforms')
      .select('platform_code, active')
      .eq('contract_id', contractId);

    if (platErr) {
      console.warn('syncCompanyFromContract: could not load platforms', platErr);
    }

    const activeCodes: PlatformCode[] = ((platRows || []) as any[])
      .filter((r) => r.active)
      .map((r) => r.platform_code)
      .filter(Boolean);

    const products = Array.from(new Set(activeCodes)).sort((a, b) => a.localeCompare(b));

    // Update company payment fields (must exist)
    const { error: updErr } = await supabase
      .from('companies')
      .update({
        payment_type,
        payment_term,
      })
      .eq('id', companyId);

    if (updErr) {
      return { ok: false, error: `Could not update companies.payment_*: ${updErr.message}` };
    }

    // Optional: if you created companies.products (text[]), populate it.
    // If it doesn't exist, ignore safely.
    if (products.length > 0) {
      const tryProducts = await supabase.from('companies').update({ products }).eq('id', companyId);
      if (tryProducts.error) {
        console.warn(
          'syncCompanyFromContract: companies.products not updated (optional)',
          tryProducts.error.message
        );
      }
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Unknown error' };
  }
}
