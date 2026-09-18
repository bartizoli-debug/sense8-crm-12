// The in-memory tables themselves.
//
// The data lives in a plain object. In the browser it is mirrored to
// localStorage so edits survive a page reload; on the server (Next.js renders
// client components during SSR) it is simply re-seeded per process.

import { schemaFor } from './schema';
import { buildSeed } from './seed';

const STORAGE_KEY = 'sense8-crm.mock-db.v1';

type Tables = Record<string, any[]>;

let tables: Tables | null = null;

const isBrowser = typeof window !== 'undefined';

function readPersisted(): Tables | null {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Tables) : null;
  } catch {
    return null;
  }
}

function persist() {
  if (!isBrowser || !tables) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch {
    // Quota or private-mode failures are not worth breaking the app over.
  }
}

function ensure(): Tables {
  if (tables) return tables;
  tables = readPersisted() ?? buildSeed();
  return tables;
}

export function getTable(name: string): any[] {
  const db = ensure();
  if (!db[name]) db[name] = [];
  return db[name];
}

export function setTable(name: string, rows: any[]) {
  const db = ensure();
  db[name] = rows;
  persist();
}

/** Call after mutating rows in place. */
export function commit() {
  persist();
}

function randomUuid(): string {
  const g: any = globalThis as any;
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Next primary key for `table`, matching the column's declared kind. */
export function nextId(table: string): string | number {
  const schema = schemaFor(table);
  if (schema.idKind === 'uuid') return randomUuid();
  if (schema.idKind === 'none') return randomUuid();

  const rows = getTable(table);
  let max = 0;
  for (const row of rows) {
    const value = Number(row?.[schema.pk]);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

/** Throw away every local change and start again from the demo dataset. */
export function resetMockDb() {
  tables = buildSeed();
  persist();
}

/** Wipe everything, including the demo rows. */
export function clearMockDb() {
  const seeded = buildSeed();
  tables = Object.keys(seeded).reduce<Tables>((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
  persist();
}

export function snapshot(): Tables {
  return JSON.parse(JSON.stringify(ensure()));
}
