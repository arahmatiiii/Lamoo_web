import { describe, expect, it } from 'vitest';
import { canonical, mergeRecord, parseRecord, type SyncRecord } from '../src/records.ts';

const row = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  kind: 'pantry',
  id: 'a',
  updatedAt: 1000,
  value: { name: 'شیر' },
  ...over,
});

describe('mergeRecord', () => {
  it('takes the newer write', () => {
    expect(mergeRecord(row(), row({ updatedAt: 2000, value: { name: 'ماست' } })).value).toEqual({
      name: 'ماست',
    });
  });

  it('keeps the newer local write against a stale remote one', () => {
    expect(mergeRecord(row({ updatedAt: 2000 }), row({ updatedAt: 1000 })).updatedAt).toBe(2000);
  });

  it('accepts a row it has never seen', () => {
    expect(mergeRecord(undefined, row()).id).toBe('a');
  });

  it('lets a deletion win a tie, whichever side holds it', () => {
    const deleted = row({ deleted: true, value: undefined });
    expect(mergeRecord(row(), deleted).deleted).toBe(true);
    expect(mergeRecord(deleted, row()).deleted).toBe(true);
  });

  it('does not resurrect a row deleted later', () => {
    const merged = mergeRecord(row({ updatedAt: 1000 }), row({ updatedAt: 2000, deleted: true }));
    expect(merged.deleted).toBe(true);
  });

  it('converges on an exact tie regardless of which side asks', () => {
    const mine = row({ value: { name: 'شیر' } });
    const theirs = row({ value: { name: 'ماست' } });
    // The whole point: both devices must land on the same answer, or they hold
    // two different fridges forever.
    expect(mergeRecord(mine, theirs)).toEqual(mergeRecord(theirs, mine));
  });

  it('ignores key order when breaking a tie', () => {
    const a = row({ value: { name: 'شیر', qty: 2 } });
    const b = row({ value: { qty: 2, name: 'شیر' } });
    expect(mergeRecord(a, b).value).toEqual(a.value);
  });
});

describe('canonical', () => {
  it('serialises the same object the same way whatever the key order', () => {
    expect(canonical({ a: 1, b: [2, { d: 4, c: 3 }] })).toBe(canonical({ b: [2, { c: 3, d: 4 }], a: 1 }));
  });

  it('drops undefined members so an absent key and an undefined one match', () => {
    expect(canonical({ a: 1, b: undefined })).toBe(canonical({ a: 1 }));
  });
});

describe('parseRecord', () => {
  it('accepts a well-formed row', () => {
    expect(parseRecord({ kind: 'recipe', id: 'r1', updatedAt: 5, value: { x: 1 } })).toEqual({
      kind: 'recipe',
      id: 'r1',
      updatedAt: 5,
      value: { x: 1 },
    });
  });

  it('accepts a tombstone with no value', () => {
    expect(parseRecord({ kind: 'pantry', id: 'p', updatedAt: 5, deleted: true })).toEqual({
      kind: 'pantry',
      id: 'p',
      updatedAt: 5,
      deleted: true,
    });
  });

  it.each([
    ['an unknown kind', { kind: 'secrets', id: 'a', updatedAt: 1, value: {} }],
    ['a missing id', { kind: 'pantry', updatedAt: 1, value: {} }],
    ['an empty id', { kind: 'pantry', id: '', updatedAt: 1, value: {} }],
    ['a non-numeric timestamp', { kind: 'pantry', id: 'a', updatedAt: 'now', value: {} }],
    ['a negative timestamp', { kind: 'pantry', id: 'a', updatedAt: -1, value: {} }],
    ['neither a value nor a tombstone', { kind: 'pantry', id: 'a', updatedAt: 1 }],
    ['not an object at all', 'hello'],
  ])('rejects %s', (_label, input) => {
    expect(parseRecord(input)).toBeNull();
  });

  it('rejects an absurdly long id rather than storing it', () => {
    expect(parseRecord({ kind: 'pantry', id: 'x'.repeat(200), updatedAt: 1, value: {} })).toBeNull();
  });

  it('drops fields it does not know about', () => {
    const parsed = parseRecord({ kind: 'pantry', id: 'a', updatedAt: 1, value: {}, seq: 99 });
    expect(parsed).not.toHaveProperty('seq');
  });
});
