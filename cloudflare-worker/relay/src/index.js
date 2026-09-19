/**
 * Lamoo household relay.
 *
 * A tiny message store so two phones in the same home can see the same fridge.
 * One Durable Object per household room; the room id is derived from the
 * household secret, so knowing the id is the only access control there is —
 * which is enough, because every payload arriving here is already encrypted
 * on the phone. This relay cannot read a single item name.
 */

const MAX_RECORDS = 5000;
const MAX_BODY_BYTES = 512 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

export class HouseholdRoom {
  constructor(state) {
    this.state = state;
    this.sockets = new Set();
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.accept(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    if (request.method === 'GET') {
      const since = Number(url.searchParams.get('since') ?? 0);
      return json({ records: await this.since(Number.isFinite(since) ? since : 0) });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => null);
      const records = Array.isArray(body?.records) ? body.records : null;
      if (!records) return json({ error: 'expected { records: [] }' }, 400);

      const stored = await this.put(records);
      this.broadcast(stored, null);
      return json({ ok: true, stored: stored.length });
    }

    return json({ error: 'method not allowed' }, 405);
  }

  accept(socket) {
    socket.accept();
    this.sockets.add(socket);

    socket.addEventListener('message', async (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      // "pull": catch up since a watermark. "push": store and fan out.
      if (message.type === 'pull') {
        const records = await this.since(Number(message.since) || 0);
        socket.send(JSON.stringify({ type: 'records', records }));
        return;
      }

      if (message.type === 'push' && Array.isArray(message.records)) {
        const stored = await this.put(message.records);
        socket.send(JSON.stringify({ type: 'ack', stored: stored.length }));
        this.broadcast(stored, socket);
      }
    });

    const drop = () => this.sockets.delete(socket);
    socket.addEventListener('close', drop);
    socket.addEventListener('error', drop);
  }

  broadcast(records, except) {
    if (records.length === 0) return;
    const payload = JSON.stringify({ type: 'records', records });
    for (const socket of this.sockets) {
      if (socket === except) continue;
      try {
        socket.send(payload);
      } catch {
        this.sockets.delete(socket);
      }
    }
  }

  /**
   * Rows are keyed by the household's own row key, so a re-sync of the same
   * item overwrites rather than piling up. `seq` is assigned here: phone
   * clocks disagree, but everyone agrees on the order this room saw things,
   * which is all the "since" watermark needs to mean.
   */
  async put(records) {
    let seq = (await this.state.storage.get('seq')) ?? 0;
    const writes = new Map();
    const stored = [];

    for (const record of records) {
      if (!record || typeof record.key !== 'string' || typeof record.payload !== 'string') continue;
      if (record.payload.length > MAX_BODY_BYTES) continue;

      seq += 1;
      const row = { key: record.key, payload: record.payload, seq };
      writes.set(`row:${record.key}`, row);
      stored.push(row);
    }

    if (writes.size === 0) return [];

    writes.set('seq', seq);
    await this.state.storage.put(Object.fromEntries(writes));
    await this.prune();
    return stored;
  }

  async since(watermark) {
    const rows = await this.state.storage.list({ prefix: 'row:' });
    return [...rows.values()].filter((r) => r.seq > watermark).sort((a, b) => a.seq - b.seq);
  }

  /** Keep a household from growing without bound; drop the oldest rows. */
  async prune() {
    const rows = await this.state.storage.list({ prefix: 'row:' });
    if (rows.size <= MAX_RECORDS) return;

    const sorted = [...rows.entries()].sort((a, b) => a[1].seq - b[1].seq);
    await this.state.storage.delete(sorted.slice(0, rows.size - MAX_RECORDS).map(([k]) => k));
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const room = url.pathname.split('/').filter(Boolean)[1];

    // 64 hex chars: derived from the household secret, never the secret itself.
    if (!room || !/^[0-9a-f]{64}$/.test(room)) {
      return json({ error: 'expected /room/<64-hex>' }, 400);
    }

    const id = env.HOUSEHOLD.idFromName(room);
    return env.HOUSEHOLD.get(id).fetch(request);
  },
};
