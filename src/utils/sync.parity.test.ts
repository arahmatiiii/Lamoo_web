import { describe, expect, it } from 'vitest';
import { mergeRecord as clientMerge, type SyncRecord } from './sync';
import {
  mergeRecord as serverMerge,
  canonical as serverCanonical,
  type SyncRecord as ServerRecord,
} from '../../server/src/records';

/**
 * The client and the server each own a copy of the merge rule, because neither
 * can import the other's module graph. That duplication is only safe as long as
 * the two behave identically: if they ever drift, two phones can hold two
 * different answers for the same row and no amount of re-syncing repairs it.
 *
 * This test is the thing that makes the duplication safe. It fails on the web
 * side when someone edits `server/src/records.ts` alone, and vice versa.
 */

type Pair = { label: string; mine?: SyncRecord; theirs: SyncRecord };

const row = (over: Partial<SyncRecord> = {}): SyncRecord =>
  ({
    kind: 'pantry',
    id: 'p1',
    updatedAt: 1000,
    value: { id: 'p1', name: 'شیر' },
    ...over,
  }) as SyncRecord;

const cases: Pair[] = [
  { label: 'nothing local', theirs: row() },
  { label: 'remote newer', mine: row(), theirs: row({ updatedAt: 2000, value: { id: 'p1', name: 'ماست' } as never }) },
  { label: 'remote older', mine: row({ updatedAt: 3000 }), theirs: row({ updatedAt: 1000 }) },
  { label: 'remote deleted, newer', mine: row(), theirs: row({ updatedAt: 2000, deleted: true, value: undefined }) },
  { label: 'remote deleted, same instant', mine: row(), theirs: row({ deleted: true, value: undefined }) },
  { label: 'local deleted, same instant', mine: row({ deleted: true, value: undefined }), theirs: row() },
  { label: 'both deleted', mine: row({ deleted: true, value: undefined }), theirs: row({ deleted: true, value: undefined }) },
  { label: 'tie, remote sorts higher', mine: row({ value: { id: 'p1', name: 'الف' } as never }), theirs: row({ value: { id: 'p1', name: 'ی' } as never }) },
  { label: 'tie, local sorts higher', mine: row({ value: { id: 'p1', name: 'ی' } as never }), theirs: row({ value: { id: 'p1', name: 'الف' } as never }) },
  { label: 'tie, identical content', mine: row(), theirs: row() },
  { label: 'tie, same content in a different key order', mine: row({ value: { name: 'شیر', id: 'p1' } as never }), theirs: row() },
  { label: 'zero timestamps', mine: row({ updatedAt: 0 }), theirs: row({ updatedAt: 0, value: { id: 'p1', name: 'ب' } as never }) },
  { label: 'a different kind', mine: undefined, theirs: row({ kind: 'recipe' }) },
];

describe('client and server merge the same way', () => {
  it.each(cases)('agrees on: $label', ({ mine, theirs }) => {
    const fromClient = clientMerge(mine, theirs);
    const fromServer = serverMerge(mine as ServerRecord | undefined, theirs as ServerRecord);
    expect(fromServer).toEqual(fromClient as unknown as ServerRecord);
  });

  it.each(cases)('agrees on: $label, with the arguments swapped', ({ mine, theirs }) => {
    if (!mine) return;
    const fromClient = clientMerge(theirs, mine);
    const fromServer = serverMerge(theirs as ServerRecord, mine as ServerRecord);
    expect(fromServer).toEqual(fromClient as unknown as ServerRecord);
  });

  it('converges: whichever side merges first, both land on the same row', () => {
    for (const { mine, theirs } of cases) {
      if (!mine) continue;
      expect(serverMerge(mine as ServerRecord, theirs as ServerRecord)).toEqual(
        serverMerge(theirs as ServerRecord, mine as ServerRecord)
      );
    }
  });

  it('serialises the same way on both sides, which is what the tiebreak rests on', () => {
    const value = { b: [1, { d: 4, c: 3 }], a: 'شیر', e: null };
    // The client keeps `canonical` private, so compare through the observable
    // behaviour it drives plus the server's own copy.
    expect(serverCanonical(value)).toBe(serverCanonical({ e: null, a: 'شیر', b: [1, { c: 3, d: 4 }] }));
    const higher = row({ value: { z: 1 } as never });
    const lower = row({ value: { a: 1 } as never });
    expect(clientMerge(lower, higher)).toBe(higher);
    expect(serverMerge(lower as ServerRecord, higher as ServerRecord)).toBe(higher as ServerRecord);
  });
});
