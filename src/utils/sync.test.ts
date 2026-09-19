import { describe, it, expect } from 'vitest';
import {
  mergeRecord,
  mergeAll,
  toRecords,
  toCollections,
  changedSince,
  recordKey,
  SyncRecord,
  SyncState,
  SyncKind,
  SyncEntity,
} from './sync';
import type { PantryItem, ShoppingItem } from '../store/useStore';

const milk = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: 'p1',
  name: 'شیر',
  category: 'لبنیات',
  amount: '1',
  unit: 'لیتر',
  emoji: '🥛',
  available: true,
  ...over,
});

const bread = (over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 's1',
  name: 'نان',
  amount: '1',
  unit: 'عدد',
  emoji: '🍞',
  purchased: false,
  ...over,
});

const collections = (over: Partial<Record<SyncKind, SyncEntity[]>> = {}) => ({
  pantry: [],
  recipe: [],
  shopping: [],
  reminder: [],
  ...over,
});

const rec = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  kind: 'pantry',
  id: 'p1',
  updatedAt: 100,
  value: milk(),
  ...over,
});

describe('mergeRecord', () => {
  it('takes the incoming row when there is nothing local', () => {
    const theirs = rec();

    expect(mergeRecord(undefined, theirs)).toBe(theirs);
  });

  it('takes the newer edit', () => {
    const older = rec({ updatedAt: 100, value: milk({ amount: '1' }) });
    const newer = rec({ updatedAt: 200, value: milk({ amount: '2' }) });

    expect(mergeRecord(older, newer)).toBe(newer);
    expect(mergeRecord(newer, older)).toBe(newer);
  });

  it('keeps a delete rather than resurrecting the row on a tie', () => {
    const edit = rec({ updatedAt: 100 });
    const remove = rec({ updatedAt: 100, deleted: true, value: undefined });

    expect(mergeRecord(edit, remove).deleted).toBe(true);
    expect(mergeRecord(remove, edit).deleted).toBe(true);
  });

  it('is order-independent — both phones land on the same answer', () => {
    const a = rec({ updatedAt: 100, value: milk({ amount: 'a' }) });
    const b = rec({ updatedAt: 100, value: milk({ amount: 'b' }) });

    expect(mergeRecord(a, b)).toEqual(mergeRecord(b, a));
  });

  it('lets a later delete win over an earlier edit', () => {
    const edit = rec({ updatedAt: 100 });
    const remove = rec({ updatedAt: 300, deleted: true, value: undefined });

    expect(mergeRecord(edit, remove).deleted).toBe(true);
  });

  it('lets a later edit win over an earlier delete — re-buying restocks it', () => {
    const remove = rec({ updatedAt: 100, deleted: true, value: undefined });
    const rebought = rec({ updatedAt: 300 });

    expect(mergeRecord(remove, rebought).deleted).toBeFalsy();
  });
});

describe('mergeAll', () => {
  it('merges several rows at once and leaves untouched ones alone', () => {
    const local: SyncState = {
      'pantry:p1': rec({ updatedAt: 100 }),
      'pantry:p2': rec({ id: 'p2', updatedAt: 100, value: milk({ id: 'p2', name: 'ماست' }) }),
    };

    const merged = mergeAll(local, [rec({ updatedAt: 500, value: milk({ amount: '9' }) })]);

    expect((merged['pantry:p1'].value as PantryItem).amount).toBe('9');
    expect(merged['pantry:p2']).toBe(local['pantry:p2']);
  });

  it('does not mutate the state it was given', () => {
    const local: SyncState = { 'pantry:p1': rec({ updatedAt: 100 }) };

    mergeAll(local, [rec({ updatedAt: 999 })]);

    expect(local['pantry:p1'].updatedAt).toBe(100);
  });
});

describe('toRecords', () => {
  it('stamps new rows with the current time', () => {
    const state = toRecords(collections({ pantry: [milk()] }), {}, 500);

    expect(state[recordKey('pantry', 'p1')]).toMatchObject({ updatedAt: 500, kind: 'pantry' });
  });

  // Otherwise every sync would look like a fresh edit and always beat the
  // other side, quietly reverting their changes.
  it('leaves the clock alone when nothing changed', () => {
    const first = toRecords(collections({ pantry: [milk()] }), {}, 500);
    const second = toRecords(collections({ pantry: [milk()] }), first, 900);

    expect(second[recordKey('pantry', 'p1')].updatedAt).toBe(500);
  });

  it('bumps the clock when the row actually changed', () => {
    const first = toRecords(collections({ pantry: [milk({ amount: '1' })] }), {}, 500);
    const second = toRecords(collections({ pantry: [milk({ amount: '2' })] }), first, 900);

    expect(second[recordKey('pantry', 'p1')].updatedAt).toBe(900);
  });

  it('turns a locally removed row into a tombstone', () => {
    const first = toRecords(collections({ pantry: [milk()] }), {}, 500);
    const second = toRecords(collections({ pantry: [] }), first, 900);

    expect(second[recordKey('pantry', 'p1')]).toMatchObject({ deleted: true, updatedAt: 900 });
  });

  it('does not keep re-stamping an existing tombstone', () => {
    const first = toRecords(collections({ pantry: [milk()] }), {}, 500);
    const second = toRecords(collections({ pantry: [] }), first, 900);
    const third = toRecords(collections({ pantry: [] }), second, 1500);

    expect(third[recordKey('pantry', 'p1')].updatedAt).toBe(900);
  });

  it('handles every collection', () => {
    const state = toRecords(collections({ pantry: [milk()], shopping: [bread()] }), {}, 500);

    expect(Object.keys(state).sort()).toEqual(['pantry:p1', 'shopping:s1']);
  });
});

describe('toCollections', () => {
  it('sorts rows back into their collections', () => {
    const state = toRecords(collections({ pantry: [milk()], shopping: [bread()] }), {}, 500);

    const out = toCollections(state);

    expect(out.pantry).toEqual([milk()]);
    expect(out.shopping).toEqual([bread()]);
    expect(out.recipe).toEqual([]);
  });

  it('leaves tombstoned rows out', () => {
    const first = toRecords(collections({ pantry: [milk()] }), {}, 500);
    const afterDelete = toRecords(collections({ pantry: [] }), first, 900);

    expect(toCollections(afterDelete).pantry).toEqual([]);
  });
});

describe('changedSince', () => {
  it('returns only rows newer than the watermark', () => {
    const state: SyncState = {
      old: rec({ id: 'old', updatedAt: 100 }),
      fresh: rec({ id: 'fresh', updatedAt: 300 }),
    };

    expect(changedSince(state, 200).map((r) => r.id)).toEqual(['fresh']);
  });

  it('returns everything from zero', () => {
    const state = toRecords(collections({ pantry: [milk()] }), {}, 500);

    expect(changedSince(state, 0)).toHaveLength(1);
  });
});

describe('two phones, one fridge', () => {
  const apply = (state: SyncState) => toCollections(state);

  it('converges when each edits a different item offline', () => {
    const shared = toRecords(
      collections({ pantry: [milk(), milk({ id: 'p2', name: 'ماست' })] }),
      {},
      100
    );

    // Phone A empties the milk; phone B renames the yoghurt. Neither has seen
    // the other yet.
    const a = toRecords(
      collections({ pantry: [milk({ available: false }), milk({ id: 'p2', name: 'ماست' })] }),
      shared,
      200
    );
    const b = toRecords(
      collections({ pantry: [milk(), milk({ id: 'p2', name: 'ماست چکیده' })] }),
      shared,
      300
    );

    const onA = mergeAll(a, changedSince(b, 100));
    const onB = mergeAll(b, changedSince(a, 100));

    expect(apply(onA).pantry).toEqual(apply(onB).pantry);
    const names = apply(onA).pantry.map((p) => (p as PantryItem).name);
    expect(names).toContain('ماست چکیده');
    expect((apply(onA).pantry.find((p) => p.id === 'p1') as PantryItem).available).toBe(false);
  });

  it('does not resurrect an item the other phone deleted', () => {
    const shared = toRecords(collections({ pantry: [milk()] }), {}, 100);

    const deletedOnA = toRecords(collections({ pantry: [] }), shared, 200);
    // B never touched it, so its row still carries the original timestamp.
    const onB = mergeAll(shared, changedSince(deletedOnA, 100));

    expect(apply(onB).pantry).toEqual([]);
  });

  it('keeps the later of two concurrent edits to the same item', () => {
    const shared = toRecords(collections({ pantry: [milk({ amount: '1' })] }), {}, 100);

    const a = toRecords(collections({ pantry: [milk({ amount: '2' })] }), shared, 200);
    const b = toRecords(collections({ pantry: [milk({ amount: '3' })] }), shared, 400);

    const onA = mergeAll(a, changedSince(b, 100));
    const onB = mergeAll(b, changedSince(a, 100));

    expect((apply(onA).pantry[0] as PantryItem).amount).toBe('3');
    expect(apply(onA)).toEqual(apply(onB));
  });
});

describe('tie-breaking converges regardless of key order', () => {
  it('agrees even when the same value was built with keys in a different order', () => {
    const value = milk({ amount: 'x' });
    const reordered = Object.fromEntries(
      Object.entries(value).reverse()
    ) as unknown as PantryItem;

    const a = rec({ updatedAt: 100, value });
    const b = rec({ updatedAt: 100, value: reordered });

    expect(mergeRecord(a, b)).toEqual(mergeRecord(b, a));
  });
});
