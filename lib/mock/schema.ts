// Table metadata for the in-memory dev database.
// It is intentionally minimal: just enough for the mock PostgREST layer to
// generate primary keys, fill timestamps and resolve embedded selects
// (e.g. `contact_tags:tag_id ( id, name )`).

export type IdKind = 'uuid' | 'serial' | 'none';

export interface TableSchema {
  /** Primary key column. */
  pk: string;
  /** How a primary key is generated when an insert does not supply one. */
  idKind: IdKind;
  /** Local FK column -> referenced table, used to resolve embedded selects. */
  fks?: Record<string, string>;
  /** Columns auto-filled on insert when the payload omits them. */
  timestamps?: Array<'created_at' | 'updated_at'>;
  /** Column defaults applied on insert when the payload omits them. */
  defaults?: Record<string, unknown>;
}

export const SCHEMA: Record<string, TableSchema> = {
  companies: {
    pk: 'id',
    idKind: 'uuid',
    timestamps: ['created_at'],
  },
  contacts: {
    pk: 'id',
    idKind: 'uuid',
    fks: { company_id: 'companies' },
    timestamps: ['created_at', 'updated_at'],
    defaults: {
      is_active: true,
      newsletter_opt_in: false,
      do_not_contact: false,
      preferred_language: 'en',
    },
  },
  deals: {
    pk: 'id',
    idKind: 'uuid',
    fks: { company_id: 'companies', contract_id: 'contracts' },
    timestamps: ['created_at'],
    defaults: { stage: 'Lead', currency: 'EUR', is_renewal: false },
  },
  contracts: {
    pk: 'id',
    idKind: 'serial',
    fks: { company_id: 'companies' },
    timestamps: ['created_at'],
    defaults: { automatic_renewal: false },
  },
  contract_platforms: {
    pk: 'id',
    idKind: 'serial',
    fks: { contract_id: 'contracts' },
    timestamps: ['created_at'],
    defaults: { active: true },
  },
  contract_addendums: {
    pk: 'id',
    idKind: 'serial',
    fks: { contract_id: 'contracts' },
    timestamps: ['created_at'],
  },
  contract_links: {
    pk: 'id',
    idKind: 'serial',
    fks: { contract_id: 'contracts', linked_contract_id: 'contracts' },
    timestamps: ['created_at'],
  },
  contract_rebate_links: {
    pk: 'id',
    idKind: 'serial',
    fks: { base_contract_id: 'contracts', rebate_contract_id: 'contracts' },
    timestamps: ['created_at'],
  },
  contact_tags: {
    pk: 'id',
    idKind: 'uuid',
    timestamps: ['created_at'],
  },
  products: {
    pk: 'id',
    idKind: 'uuid',
    timestamps: ['created_at'],
  },
  contact_tag_links: {
    pk: 'id',
    idKind: 'uuid',
    fks: { contact_id: 'contacts', tag_id: 'contact_tags' },
    timestamps: ['created_at'],
  },
  contact_product_links: {
    pk: 'id',
    idKind: 'uuid',
    fks: { contact_id: 'contacts', product_id: 'products' },
    timestamps: ['created_at'],
  },
  activities: {
    pk: 'id',
    idKind: 'serial',
    timestamps: ['created_at'],
    defaults: { is_done: false },
  },
  profiles: {
    pk: 'user_id',
    idKind: 'none',
    timestamps: ['created_at', 'updated_at'],
  },
  org_members: {
    pk: 'user_id',
    idKind: 'none',
    timestamps: ['created_at'],
  },
};

export function schemaFor(table: string): TableSchema {
  return SCHEMA[table] ?? { pk: 'id', idKind: 'uuid' };
}
