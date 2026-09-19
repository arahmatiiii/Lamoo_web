import type { PantryItem, Recipe, Reminder, ShoppingItem } from '../store/useStore';

/** The four collections a household shares. */
export type SyncKind = 'pantry' | 'recipe' | 'shopping' | 'reminder';

export const SYNC_KINDS: SyncKind[] = ['pantry', 'recipe', 'shopping', 'reminder'];

export type SyncEntity = PantryItem | Recipe | ShoppingItem | Reminder;

/**
 * One row of shared state. `deleted` is a tombstone rather than a removal:
 * without it, a delete on one phone would be undone by the next sync from the
 * other, which still has the row.
 */
export interface SyncRecord {
  kind: SyncKind;
  id: string;
  updatedAt: number;
  deleted?: boolean;
  value?: SyncEntity;
}

export type SyncState = Record<string, SyncRecord>;

export function recordKey(kind: SyncKind, id: string): string {
  return `${kind}:${id}`;
}

/** Key-order-independent serialisation, so the tiebreak below is stable. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

/**
 * Last write wins, per row.
 *
 * Chosen over a full CRDT deliberately: a household fridge does not need
 * character-level merging, and the failure mode people actually hit — two
 * phones editing *different* items while one is offline — is handled exactly
 * right by per-row LWW. The case it gets wrong is two people editing the
 * *same* item at the same moment, where one of the two edits is dropped.
 *
 * It must converge: both phones have to reach the same row no matter which
 * order they see the edits in, or they disagree forever. So an exact tie is
 * broken on the content itself rather than on which side happens to be local.
 */
export function mergeRecord(mine: SyncRecord | undefined, theirs: SyncRecord): SyncRecord {
  if (!mine) return theirs;
  if (theirs.updatedAt > mine.updatedAt) return theirs;
  if (theirs.updatedAt < mine.updatedAt) return mine;
  // Prefer a delete, so a removal is never silently resurrected by a
  // concurrent edit.
  if (!!mine.deleted !== !!theirs.deleted) return mine.deleted ? mine : theirs;
  return canonical(theirs.value) > canonical(mine.value) ? theirs : mine;
}

export function mergeAll(local: SyncState, incoming: SyncRecord[]): SyncState {
  const next: SyncState = { ...local };
  for (const record of incoming) {
    const key = recordKey(record.kind, record.id);
    next[key] = mergeRecord(next[key], record);
  }
  return next;
}

/** Collections as stored locally → the flat row form that travels. */
export function toRecords(
  collections: Record<SyncKind, SyncEntity[]>,
  previous: SyncState,
  now: number
): SyncState {
  const next: SyncState = {};

  for (const kind of SYNC_KINDS) {
    for (const value of collections[kind]) {
      const key = recordKey(kind, value.id);
      const before = previous[key];
      // Only bump the clock when something actually changed, or every sync
      // would look like a fresh edit and always win against the other side.
      const unchanged =
        before && !before.deleted && JSON.stringify(before.value) === JSON.stringify(value);
      next[key] = unchanged ? before : { kind, id: value.id, updatedAt: now, value };
    }
  }

  // Anything previously known but now absent locally has been deleted here.
  for (const [key, before] of Object.entries(previous)) {
    if (next[key]) continue;
    next[key] = before.deleted ? before : { ...before, deleted: true, value: undefined, updatedAt: now };
  }

  return next;
}

/** The flat rows back into collections the app renders. */
export function toCollections(state: SyncState): Record<SyncKind, SyncEntity[]> {
  const out: Record<SyncKind, SyncEntity[]> = {
    pantry: [],
    recipe: [],
    shopping: [],
    reminder: [],
  };

  for (const record of Object.values(state)) {
    if (record.deleted || !record.value) continue;
    out[record.kind].push(record.value);
  }

  return out;
}

/** Rows that the other side has not seen yet. */
export function changedSince(state: SyncState, since: number): SyncRecord[] {
  return Object.values(state).filter((r) => r.updatedAt > since);
}
