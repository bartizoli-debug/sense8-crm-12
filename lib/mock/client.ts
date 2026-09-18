// Assembles an object that looks enough like a SupabaseClient for this app.

import type { SupabaseClient } from '@supabase/supabase-js';
import { mockAuth } from './auth';
import { MockQueryBuilder } from './query';
import { clearMockDb, getTable, resetMockDb, snapshot } from './store';

/**
 * Stand-in for the `get_contract_current_state` Postgres function: the contract
 * as it stands today, with every signed addendum applied on top.
 */
function getContractCurrentState(contractId: unknown) {
  const contract = getTable('contracts').find((row) => String(row.id) === String(contractId));
  if (!contract) return { error: 'contract_not_found' };

  const state = {
    issue_date: contract.issue_date ?? null,
    effective_date: contract.effective_date ?? null,
    expiry_date: contract.expiry_date ?? null,
    payment_term: contract.payment_term ?? null,
    payment_type: contract.payment_type ?? null,
    platforms: getTable('contract_platforms')
      .filter((row) => String(row.contract_id) === String(contractId) && row.active !== false)
      .map((row) => row.platform_code as string),
  };

  const addendums = getTable('contract_addendums')
    .filter((row) => String(row.contract_id) === String(contractId))
    .sort((a, b) => String(a.effective_from ?? '').localeCompare(String(b.effective_from ?? '')));

  for (const addendum of addendums) {
    const changes = addendum.changes ?? {};

    for (const key of ['issue_date', 'effective_date', 'expiry_date', 'payment_term', 'payment_type'] as const) {
      if (changes[key] !== undefined) (state as any)[key] = changes[key];
    }

    for (const code of changes.platforms_add ?? []) {
      if (!state.platforms.includes(code)) state.platforms.push(code);
    }
    for (const code of changes.platforms_remove ?? []) {
      state.platforms = state.platforms.filter((p) => p !== code);
    }
  }

  return state;
}

const RPCS: Record<string, (args: any) => any> = {
  get_contract_current_state: (args) => getContractCurrentState(args?.p_contract_id),
};

function notSupported(feature: string) {
  return () => {
    console.warn(`[mock-db] ${feature} is not implemented by the in-memory database.`);
    return Promise.resolve({ data: null, error: null });
  };
}

export function createMockSupabaseClient(): SupabaseClient<any> {
  const client = {
    from(table: string) {
      return new MockQueryBuilder(table);
    },

    async rpc(fn: string, args?: Record<string, any>) {
      const handler = RPCS[fn];
      if (!handler) {
        return {
          data: null,
          error: {
            message: `Function ${fn}() is not implemented by the in-memory database`,
            details: '',
            hint: 'Add it to RPCS in lib/mock/client.ts',
            code: 'PGRST202',
          },
          count: null,
          status: 404,
          statusText: 'Not Found',
        };
      }

      return { data: handler(args ?? {}), error: null, count: null, status: 200, statusText: 'OK' };
    },

    auth: mockAuth,

    // Realtime and storage are unused by the CRM; keep harmless placeholders so
    // an accidental call logs instead of throwing.
    channel() {
      return {
        on() {
          return this;
        },
        subscribe() {
          return this;
        },
        unsubscribe() {
          return Promise.resolve('ok');
        },
      };
    },
    removeChannel: notSupported('realtime'),
    storage: {
      from() {
        return {
          upload: notSupported('storage.upload'),
          download: notSupported('storage.download'),
          remove: notSupported('storage.remove'),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        };
      },
    },

    // Dev helpers, also exposed on `window.mockDb`.
    resetMockDb,
    clearMockDb,
    snapshot,
  };

  if (typeof window !== 'undefined') {
    (window as any).mockDb = {
      reset: resetMockDb,
      clear: clearMockDb,
      snapshot,
    };
  }

  return client as unknown as SupabaseClient<any>;
}
