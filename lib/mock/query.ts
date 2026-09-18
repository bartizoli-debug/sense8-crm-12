// A small PostgREST-flavoured query builder over the in-memory tables.
//
// It implements the slice of the supabase-js surface this CRM actually uses:
// select/insert/update/upsert/delete, the usual filters, `.or()` with
// and()/or() groups, ordering, limit/range, exact counts, `single()` /
// `maybeSingle()`, and one-level embedded selects such as
// `contact_id, contact_tags:tag_id ( id, name )`.

import { schemaFor } from './schema';
import { commit, getTable, nextId, setTable } from './store';

export interface MockError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface MockResult<T = any> {
  data: T;
  error: MockError | null;
  count: number | null;
  status: number;
  statusText: string;
}

type Predicate = (row: any) => boolean;

// ---------- value helpers ----------

/** Equality that tolerates the string/number drift between route params and rows. */
function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  if (typeof a === typeof b) return false;
  return String(a) === String(b);
}

function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Ordering comparison; `null` is handled by the caller. */
function compareValues(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return (a ? 1 : 0) - (b ? 1 : 0);
  }
  const an = numeric(a);
  const bn = numeric(b);
  if (an !== null && bn !== null) return an - bn;
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** Comparison used by gt/gte/lt/lte. Dates stay strings and compare lexically. */
function compareForFilter(a: unknown, b: unknown): number | null {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const an = numeric(a);
  const bn = numeric(b);
  if (an !== null && bn !== null) return an - bn;
  const as = String(a);
  const bs = String(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function patternToRegExp(pattern: string, caseInsensitive: boolean): RegExp {
  const escaped = String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = escaped.replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${body}$`, caseInsensitive ? 'i' : '');
}

function isEmptyish(value: unknown) {
  return value === null || value === undefined;
}

// ---------- predicates ----------

function buildPredicate(column: string, op: string, value: any): Predicate {
  switch (op) {
    case 'eq':
      return (row) => looseEquals(row?.[column], value);
    case 'neq':
      return (row) => !looseEquals(row?.[column], value);
    case 'gt':
      return (row) => {
        const c = compareForFilter(row?.[column], value);
        return c !== null && c > 0;
      };
    case 'gte':
      return (row) => {
        const c = compareForFilter(row?.[column], value);
        return c !== null && c >= 0;
      };
    case 'lt':
      return (row) => {
        const c = compareForFilter(row?.[column], value);
        return c !== null && c < 0;
      };
    case 'lte':
      return (row) => {
        const c = compareForFilter(row?.[column], value);
        return c !== null && c <= 0;
      };
    case 'like':
    case 'ilike': {
      const re = patternToRegExp(value, op === 'ilike');
      return (row) => {
        const cell = row?.[column];
        return cell !== null && cell !== undefined && re.test(String(cell));
      };
    }
    case 'in': {
      const list = Array.isArray(value) ? value : [value];
      return (row) => list.some((candidate) => looseEquals(row?.[column], candidate));
    }
    case 'is':
      if (value === null) return (row) => isEmptyish(row?.[column]);
      return (row) => row?.[column] === value;
    case 'cs':
    case 'contains': {
      const list = Array.isArray(value) ? value : [value];
      return (row) => {
        const cell = row?.[column];
        if (Array.isArray(cell)) return list.every((v) => cell.some((c: unknown) => looseEquals(c, v)));
        if (typeof cell === 'string') return list.every((v) => cell.includes(String(v)));
        return false;
      };
    }
    case 'ov':
    case 'overlaps': {
      const list = Array.isArray(value) ? value : [value];
      return (row) => {
        const cell = row?.[column];
        return Array.isArray(cell) && list.some((v) => cell.some((c: unknown) => looseEquals(c, v)));
      };
    }
    default:
      // Unknown operators are treated as equality rather than silently dropping rows.
      return (row) => looseEquals(row?.[column], value);
  }
}

// ---------- `.or()` / `.filter()` string parsing ----------

/** Split on commas that are not inside parentheses. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseFilterValue(op: string, raw: string): any {
  let value = raw.trim();

  if (op === 'in') {
    const inner = value.replace(/^\(/, '').replace(/\)$/, '');
    return splitTopLevel(inner).map((v) => parseFilterValue('eq', v));
  }

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (op === 'like' || op === 'ilike') return value;

  const lowered = value.toLowerCase();
  if (lowered === 'null') return null;
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;

  const n = numeric(value);
  return n !== null && String(n) === value ? n : value;
}

function parseLogicToken(token: string): Predicate {
  const trimmed = token.trim();

  const group = /^(and|or|not)\(([\s\S]*)\)$/i.exec(trimmed);
  if (group) {
    const kind = group[1].toLowerCase();
    const children = splitTopLevel(group[2]).map(parseLogicToken);
    if (kind === 'and') return (row) => children.every((p) => p(row));
    if (kind === 'or') return (row) => children.some((p) => p(row));
    return (row) => !children.every((p) => p(row));
  }

  const firstDot = trimmed.indexOf('.');
  if (firstDot === -1) return () => true;

  const column = trimmed.slice(0, firstDot).trim();
  let rest = trimmed.slice(firstDot + 1);

  let negate = false;
  if (/^not\./i.test(rest)) {
    negate = true;
    rest = rest.slice(4);
  }

  const secondDot = rest.indexOf('.');
  if (secondDot === -1) return () => true;

  const op = rest.slice(0, secondDot).trim().toLowerCase();
  const value = parseFilterValue(op, rest.slice(secondDot + 1));
  const predicate = buildPredicate(column, op, value);

  return negate ? (row) => !predicate(row) : predicate;
}

function parseOrExpression(expression: string): Predicate {
  const children = splitTopLevel(expression).map(parseLogicToken);
  return (row) => children.some((p) => p(row));
}

// ---------- select projection ----------

interface SelectField {
  key: string;
  column?: string;
  embed?: {
    table: string;
    localColumn: string;
    fields: SelectField[] | '*';
  };
}

function resolveEmbed(table: string, head: string): SelectField['embed'] & { key: string } | null {
  const fks = schemaFor(table).fks ?? {};
  const [aliasPart, refPart] = head.split(':').map((s) => s.trim());

  // `alias:fk_column ( ... )`
  if (refPart) {
    const hint = refPart.replace(/!.*$/, '').trim();
    const target = fks[hint] ?? hint;
    return { key: aliasPart, table: target, localColumn: hint, fields: '*' };
  }

  // `fk_column ( ... )`
  if (fks[aliasPart]) {
    return { key: aliasPart, table: fks[aliasPart], localColumn: aliasPart, fields: '*' };
  }

  // `referenced_table ( ... )`
  const localColumn = Object.keys(fks).find((col) => fks[col] === aliasPart);
  if (localColumn) {
    return { key: aliasPart, table: aliasPart, localColumn, fields: '*' };
  }

  return null;
}

function parseSelect(table: string, spec: string): SelectField[] | '*' {
  const normalized = spec.trim();
  if (!normalized || normalized === '*') return '*';

  const fields: SelectField[] = [];

  for (const part of splitTopLevel(normalized)) {
    const embedMatch = /^([^()]+)\(([\s\S]*)\)$/.exec(part.trim());

    if (embedMatch) {
      const resolved = resolveEmbed(table, embedMatch[1].trim());
      if (!resolved) continue;
      const { key, ...embed } = resolved;
      fields.push({
        key,
        embed: { ...embed, fields: parseSelect(embed.table, embedMatch[2]) },
      });
      continue;
    }

    const cleaned = part.replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned === '*') return '*';

    const [aliasPart, columnPart] = cleaned.split(':').map((s) => s.trim());
    if (columnPart) fields.push({ key: aliasPart, column: columnPart });
    else fields.push({ key: aliasPart, column: aliasPart });
  }

  return fields.length ? fields : '*';
}

function project(table: string, row: any, fields: SelectField[] | '*'): any {
  if (fields === '*') return { ...row };

  const out: Record<string, any> = {};

  for (const field of fields) {
    if (field.embed) {
      const fk = row?.[field.embed.localColumn];
      const targetPk = schemaFor(field.embed.table).pk;
      const match =
        fk === null || fk === undefined
          ? null
          : getTable(field.embed.table).find((candidate) => looseEquals(candidate?.[targetPk], fk)) ?? null;

      out[field.key] = match ? project(field.embed.table, match, field.embed.fields) : null;
      continue;
    }

    const value = row?.[field.column as string];
    out[field.key] = value === undefined ? null : value;
  }

  return out;
}

// ---------- the builder ----------

type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

interface OrderSpec {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
}

function mockError(message: string, code: string, details = '', hint = ''): MockError {
  return { message, details, hint, code };
}

export class MockQueryBuilder implements PromiseLike<MockResult> {
  private readonly table: string;
  private operation: Operation = 'select';
  private payload: any[] = [];
  private upsertOptions: { onConflict?: string } = {};
  private predicates: Predicate[] = [];
  private orders: OrderSpec[] = [];
  private limitCount: number | null = null;
  private rangeBounds: [number, number] | null = null;
  private selectSpec = '*';
  private wantsRows = true;
  private countMode: string | null = null;
  private headOnly = false;
  private singleMode: 'one' | 'maybe' | null = null;

  constructor(table: string) {
    this.table = table;
  }

  // --- operations ---

  select(spec = '*', options?: { count?: string; head?: boolean }) {
    this.selectSpec = spec || '*';
    this.wantsRows = true;
    if (options?.count) this.countMode = options.count;
    if (options?.head) this.headOnly = true;
    return this;
  }

  insert(values: any, _options?: unknown) {
    this.operation = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    this.wantsRows = false;
    return this;
  }

  upsert(values: any, options?: { onConflict?: string }) {
    this.operation = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    this.upsertOptions = options ?? {};
    this.wantsRows = false;
    return this;
  }

  update(values: any, _options?: unknown) {
    this.operation = 'update';
    this.payload = [values];
    this.wantsRows = false;
    return this;
  }

  delete(_options?: unknown) {
    this.operation = 'delete';
    this.wantsRows = false;
    return this;
  }

  // --- filters ---

  eq(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'eq', value));
  }

  neq(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'neq', value));
  }

  gt(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'gt', value));
  }

  gte(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'gte', value));
  }

  lt(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'lt', value));
  }

  lte(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'lte', value));
  }

  like(column: string, pattern: string) {
    return this.addPredicate(buildPredicate(column, 'like', pattern));
  }

  ilike(column: string, pattern: string) {
    return this.addPredicate(buildPredicate(column, 'ilike', pattern));
  }

  in(column: string, values: any[]) {
    return this.addPredicate(buildPredicate(column, 'in', values ?? []));
  }

  is(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'is', value));
  }

  contains(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'contains', value));
  }

  overlaps(column: string, value: any) {
    return this.addPredicate(buildPredicate(column, 'overlaps', value));
  }

  not(column: string, op: string, value: any) {
    const predicate = buildPredicate(column, op, value);
    return this.addPredicate((row) => !predicate(row));
  }

  filter(column: string, op: string, value: any) {
    return this.addPredicate(buildPredicate(column, op.toLowerCase(), value));
  }

  match(criteria: Record<string, any>) {
    Object.entries(criteria).forEach(([column, value]) => {
      this.addPredicate(buildPredicate(column, 'eq', value));
    });
    return this;
  }

  or(expression: string, _options?: unknown) {
    return this.addPredicate(parseOrExpression(expression));
  }

  // --- shaping ---

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const ascending = options?.ascending !== false;
    this.orders.push({
      column,
      ascending,
      nullsFirst: options?.nullsFirst ?? !ascending,
    });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeBounds = [from, to];
    return this;
  }

  single() {
    this.singleMode = 'one';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  /** Accepted for API parity; the mock never throws on query errors. */
  throwOnError() {
    return this;
  }

  abortSignal(_signal: unknown) {
    return this;
  }

  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve().then(() => this.execute()).then(onfulfilled, onrejected);
  }

  // --- execution ---

  private addPredicate(predicate: Predicate) {
    this.predicates.push(predicate);
    return this;
  }

  private matches(row: any) {
    return this.predicates.every((predicate) => predicate(row));
  }

  private sort(rows: any[]) {
    if (!this.orders.length) return rows;

    return [...rows].sort((a, b) => {
      for (const { column, ascending, nullsFirst } of this.orders) {
        const av = a?.[column];
        const bv = b?.[column];
        const aNull = isEmptyish(av);
        const bNull = isEmptyish(bv);

        if (aNull && bNull) continue;
        if (aNull || bNull) {
          const nullRank = nullsFirst ? -1 : 1;
          return aNull ? nullRank : -nullRank;
        }

        const cmp = compareValues(av, bv);
        if (cmp !== 0) return ascending ? cmp : -cmp;
      }
      return 0;
    });
  }

  private paginate(rows: any[]) {
    let result = rows;
    if (this.rangeBounds) {
      const [from, to] = this.rangeBounds;
      result = result.slice(from, to + 1);
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    return result;
  }

  private withDefaults(input: any) {
    const schema = schemaFor(this.table);
    const row: Record<string, any> = { ...input };

    if (row[schema.pk] === undefined || row[schema.pk] === null) {
      row[schema.pk] = nextId(this.table);
    }

    for (const column of schema.timestamps ?? []) {
      if (row[column] === undefined) row[column] = new Date().toISOString();
    }

    for (const [column, value] of Object.entries(schema.defaults ?? {})) {
      if (row[column] === undefined) row[column] = value;
    }

    return row;
  }

  private finalize(rows: any[] | null, count: number | null): MockResult {
    if (rows === null) {
      return { data: null, error: null, count, status: 200, statusText: 'OK' };
    }

    const projected = rows.map((row) => project(this.table, row, parseSelect(this.table, this.selectSpec)));

    if (this.singleMode === 'one') {
      if (projected.length === 1) {
        return { data: projected[0], error: null, count, status: 200, statusText: 'OK' };
      }
      return {
        data: null,
        error: mockError(
          'JSON object requested, multiple (or no) rows returned',
          'PGRST116',
          `The result contains ${projected.length} rows`,
        ),
        count,
        status: 406,
        statusText: 'Not Acceptable',
      };
    }

    if (this.singleMode === 'maybe') {
      if (projected.length <= 1) {
        return { data: projected[0] ?? null, error: null, count, status: 200, statusText: 'OK' };
      }
      return {
        data: null,
        error: mockError(
          'JSON object requested, multiple (or no) rows returned',
          'PGRST116',
          `The result contains ${projected.length} rows`,
        ),
        count,
        status: 406,
        statusText: 'Not Acceptable',
      };
    }

    return { data: projected, error: null, count, status: 200, statusText: 'OK' };
  }

  private execute(): MockResult {
    const rows = getTable(this.table);

    if (this.operation === 'select') {
      const matched = rows.filter((row) => this.matches(row));
      const count = this.countMode ? matched.length : null;
      if (this.headOnly) return { data: null, error: null, count, status: 200, statusText: 'OK' };
      return this.finalize(this.paginate(this.sort(matched)), count);
    }

    if (this.operation === 'insert') {
      const inserted = this.payload.map((item) => this.withDefaults(item));
      rows.push(...inserted);
      commit();
      return this.finalize(this.wantsRows ? inserted : null, null);
    }

    if (this.operation === 'upsert') {
      const schema = schemaFor(this.table);
      const conflictColumns = this.upsertOptions.onConflict
        ? this.upsertOptions.onConflict.split(',').map((c) => c.trim())
        : [schema.pk];

      const affected: any[] = [];

      for (const item of this.payload) {
        const existing = rows.find((row) =>
          conflictColumns.every((column) => looseEquals(row?.[column], item?.[column])),
        );

        if (existing) {
          Object.assign(existing, item);
          affected.push(existing);
        } else {
          const created = this.withDefaults(item);
          rows.push(created);
          affected.push(created);
        }
      }

      commit();
      return this.finalize(this.wantsRows ? affected : null, null);
    }

    if (this.operation === 'update') {
      const patch = this.payload[0] ?? {};
      const updated: any[] = [];

      for (const row of rows) {
        if (!this.matches(row)) continue;
        Object.assign(row, patch);
        updated.push(row);
      }

      commit();
      return this.finalize(this.wantsRows ? updated : null, null);
    }

    // delete
    const removed = rows.filter((row) => this.matches(row));
    setTable(
      this.table,
      rows.filter((row) => !this.matches(row)),
    );
    return this.finalize(this.wantsRows ? removed : null, null);
  }
}
