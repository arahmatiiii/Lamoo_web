import { describe, expect, it } from 'vitest';
import { relayTransport, serverTransport } from './syncTransport';
import { createHouseholdSecret, roomIdFor, rowKeyFor } from './household';
import type { SyncRecord } from './sync';

const record: SyncRecord = {
  kind: 'pantry',
  id: 'p1',
  updatedAt: 1000,
  value: { id: 'p1', name: 'شیر', category: 'لبنیات', amount: '', unit: '', emoji: '🥛', available: true },
};

describe('serverTransport', () => {
  const transport = serverTransport('https://a.com', 'tok', 'house');

  it('reconnects when the account, server or household changes', () => {
    expect(transport.identity).not.toBe(serverTransport('https://a.com', 'tok2', 'house').identity);
    expect(transport.identity).not.toBe(serverTransport('https://b.com', 'tok', 'house').identity);
    expect(transport.identity).not.toBe(serverTransport('https://a.com', 'tok', 'other').identity);
    expect(transport.identity).toBe(serverTransport('https://a.com', 'tok', 'house').identity);
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

describe('relayTransport', () => {
  const secret = createHouseholdSecret();
  const transport = relayTransport(secret, 'https://relay.example.com');

  it('reconnects when the household secret or relay changes', () => {
    expect(transport.identity).not.toBe(relayTransport(createHouseholdSecret(), 'https://relay.example.com').identity);
    expect(transport.identity).not.toBe(relayTransport(secret, 'https://other.example.com').identity);
  });

  it('is never confused with the server transport', () => {
    expect(transport.identity.startsWith('relay|')).toBe(true);
    expect(serverTransport('https://a.com', 't', 'h').identity.startsWith('server|')).toBe(true);
  });

  it('addresses the room without revealing the secret', async () => {
    const url = await transport.socketUrl();
    expect(url).toBe(`wss://relay.example.com/room/${await roomIdFor(secret)}`);
    expect(url).not.toContain(secret);
  });

  it('encrypts rows under a derived key, and reads its own back', async () => {
    const [row] = (await transport.encode([{ key: 'pantry:p1', record }])) as {
      key: string;
      payload: string;
    }[];
    expect(row.key).toBe(await rowKeyFor(secret, 'pantry:p1'));
    expect(row.payload).not.toContain('شیر');

    const { records, cursor } = await transport.decode([{ ...row, seq: 5 }], 0);
    expect(records).toEqual([record]);
    expect(cursor).toBe(5);
  });

  it('ignores a row left behind by a previous household secret', async () => {
    const [stale] = (await relayTransport(createHouseholdSecret(), 'https://relay.example.com').encode([
      { key: 'pantry:p1', record },
    ])) as { key: string; payload: string }[];

    const { records, cursor } = await transport.decode([{ ...stale, seq: 4 }], 0);
    expect(records).toEqual([]);
    // The cursor still advances, or the same unreadable row is fetched for ever.
    expect(cursor).toBe(4);
  });
});
