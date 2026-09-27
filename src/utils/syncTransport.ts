import { encryptJson, decryptJson, roomIdFor, rowKeyFor, relaySocketUrl } from './household';
import { serverSocketUrl } from './serverApi';
import type { SyncRecord } from './sync';

/**
 * The two ways shared rows can travel. Everything above this line — the merge
 * rule, the tombstones, the cursor — is identical for both; only the envelope
 * and the addressing differ, so the sync engine takes one of these rather than
 * knowing about either backend.
 */
export interface SyncTransport {
  /** Changing this string means "reconnect": a different household or server. */
  identity: string;
  socketUrl(): Promise<string>;
  /** Wraps rows for the wire. */
  encode(entries: { key: string; record: SyncRecord }[]): Promise<unknown[]>;
  /** Unwraps a `records` message, returning what we could read and how far it got. */
  decode(rows: unknown[], cursor: number): Promise<{ records: SyncRecord[]; cursor: number }>;
}

interface RelayRow {
  key: string;
  payload: string;
  seq: number;
}

/**
 * The encrypted relay: rows are sealed with the household secret and addressed
 * by a key derived from it, so the relay can shuttle them without being able to
 * read or even label them.
 */
export function relayTransport(secret: string, relayUrl: string): SyncTransport {
  return {
    identity: `relay|${secret}|${relayUrl}`,

    async socketUrl() {
      return relaySocketUrl(relayUrl, await roomIdFor(secret));
    },

    async encode(entries) {
      return Promise.all(
        entries.map(async ({ key, record }) => ({
          key: await rowKeyFor(secret, key),
          payload: await encryptJson(secret, record),
        }))
      );
    },

    async decode(rows, cursor) {
      const relayRows = rows as RelayRow[];
      const records: SyncRecord[] = [];
      for (const row of relayRows) {
        try {
          records.push(await decryptJson<SyncRecord>(secret, row.payload));
        } catch {
          // Not ours to read — a stale row from a previous household secret.
        }
      }
      const seqs = relayRows.map((row) => Number(row.seq)).filter((seq) => Number.isFinite(seq));
      return { records, cursor: Math.max(cursor, ...seqs) };
    },
  };
}

/**
 * Your own server: rows travel in the clear over TLS, addressed by the account's
 * token. The server merges too, which is why its rows come back stamped with a
 * sequence number of its own choosing rather than the sender's clock.
 */
export function serverTransport(serverUrl: string, token: string, householdId: string): SyncTransport {
  return {
    identity: `server|${serverUrl}|${token}|${householdId}`,

    async socketUrl() {
      return serverSocketUrl(serverUrl, token);
    },

    async encode(entries) {
      return entries.map(({ record }) => record);
    },

    async decode(rows, cursor) {
      const records: SyncRecord[] = [];
      let highest = cursor;
      for (const row of rows as (SyncRecord & { seq?: number })[]) {
        if (!row || typeof row !== 'object' || typeof row.id !== 'string') continue;
        const { seq, ...record } = row;
        if (typeof seq === 'number' && seq > highest) highest = seq;
        records.push(record as SyncRecord);
      }
      return { records, cursor: highest };
    },
  };
}
