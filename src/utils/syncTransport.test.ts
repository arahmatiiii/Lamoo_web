import { describe, expect, it } from 'vitest';
import { serverTransport } from './syncTransport';
import type { SyncRecord } from './sync';

const record: SyncRecord = {
  kind: 'pantry',
  id: 'p1',
  updatedAt: 1000,
  value: { id: 'p1', name: 'شیر', category: 'لبنیات', amount: '', unit: '', emoji: '🥛', available: true },
};

describe('serverTransport', () => {
  const transport = serverTransport('tok', 'house');

  it('reconnects when the account or kitchen changes', () => {
    expect(transport.identity).not.toBe(serverTransport('tok2', 'house').identity);
    expect(transport.identity).not.toBe(serverTransport('tok', 'other').identity);
    expect(transport.identity).toBe(serverTransport('tok', 'house').identity);
  });

  it('sends rows as they are — the server reads them', async () => {
    expect(await transport.encode([{ key: 'pantry:p1', record }])).toEqual([record]);
  });

  it('strips the server’s sequence number back off and uses it as the cursor', async () => {
    const { records, cursor } = await transport.decode([{ ...record, seq: 7 }], 3);
    expect(records).toEqual([record]);
    expect(cursor).toBe(7);
  });

  it('never moves the cursor backwards', async () => {
    const { cursor } = await transport.decode([{ ...record, seq: 2 }], 9);
    expect(cursor).toBe(9);
  });

  it('takes the highest sequence in a batch', async () => {
    const { cursor } = await transport.decode(
      [
        { ...record, seq: 4 },
        { ...record, id: 'p2', seq: 11 },
        { ...record, id: 'p3', seq: 6 },
      ],
      0
    );
    expect(cursor).toBe(11);
  });

  it('skips junk rather than poisoning the store with it', async () => {
    const { records } = await transport.decode([null, 'nope', { seq: 1 }, { ...record, seq: 2 }], 0);
    expect(records).toEqual([record]);
  });
});
