/**
 * The server's half of the sync contract.
 *
 * This file is deliberately dependency-free and deliberately a mirror of
 * `src/utils/sync.ts` on the client: the same last-write-wins rule, the same
 * tombstone handling, the same canonical-serialisation tiebreak. If the two
 * ever disagree, two phones can hold two different answers for the same row
 * forever — a divergence that no amount of re-syncing repairs.
 *
 * `src/utils/sync.parity.test.ts` in the web app asserts the two agree, so a
 * change to one side fails the other side's suite.
 */

export type SyncKind = 'pantry' | 'recipe' | 'shopping' | 'reminder';

export const SYNC_KINDS: SyncKind[] = ['pantry', 'recipe', 'shopping', 'reminder'];

export function isSyncKind(value: unknown): value is SyncKind {
  return typeof value === 'string' && (SYNC_KINDS as string[]).includes(value);
}

/** One row of shared state. `deleted` is a tombstone, not a removal. */
export interface SyncRecord {
  kind: SyncKind;
  id: string;
  updatedAt: number;
  deleted?: boolean;
  value?: unknown;
}

export function recordKey(kind: SyncKind, id: string): string {
  return `${kind}:${id}`;
}

/** Key-order-independent serialisation, so the tiebreak below is stable. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/**
 * Last write wins, per row. Phone clocks disagree, so an exact tie is real and
 * has to resolve the same way on every device: deletion wins over an edit, and
 * otherwise the larger canonical form wins. Returning `mine` on a tie would
 * leave each side convinced it was right.
 */
export function mergeRecord(mine: SyncRecord | undefined, theirs: SyncRecord): SyncRecord {
  if (!mine) return theirs;
  if (theirs.updatedAt > mine.updatedAt) return theirs;
  if (theirs.updatedAt < mine.updatedAt) return mine;
  if (!!mine.deleted !== !!theirs.deleted) return mine.deleted ? mine : theirs;
  return canonical(theirs.value) > canonical(mine.value) ? theirs : mine;
}

/** Rejects anything that isn't a row we can store, rather than trusting the client. */
export function parseRecord(input: unknown): SyncRecord | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  if (!isSyncKind(row.kind)) return null;
  if (typeof row.id !== 'string' || row.id.length === 0 || row.id.length > 128) return null;
  if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || row.updatedAt < 0) {
    return null;
  }
  const deleted = row.deleted === true;
  if (!deleted && (row.value === undefined || row.value === null)) return null;
  const record: SyncRecord = { kind: row.kind, id: row.id, updatedAt: Math.floor(row.updatedAt) };
  if (deleted) record.deleted = true;
  else record.value = row.value;
  return record;
}
