import { SERVER_URL, serverSocketUrl } from './serverApi';
import type { SyncRecord } from './sync';

/**
 * How shared rows travel to the app's single main server.
 *
 * Everything above this line — the merge rule, the tombstones, the cursor — is
 * unaware of the wire. The server merges too, which is why its rows come back
 * stamped with a sequence number of its own choosing rather than the sender's
 * clock.
 */
export interface SyncTransport {
  /** Changing this string means "reconnect": a different account or household. */
  identity: string;
  socketUrl(): Promise<string>;
  /** Wraps rows for the wire. */
  encode(entries: { key: string; record: SyncRecord }[]): Promise<unknown[]>;
  /** Unwraps a `records` message, returning what we could read and how far it got. */
  decode(rows: unknown[], cursor: number): Promise<{ records: SyncRecord[]; cursor: number }>;
}

export function serverTransport(token: string, householdId: string): SyncTransport {
  return {
    identity: `server|${SERVER_URL}|${token}|${householdId}`,

    async socketUrl() {
      return serverSocketUrl(token);
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
