import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { App } from '../src/app.ts';
import {
  createHousehold,
  joinHousehold,
  pantryRecord,
  push,
  register,
  testApp,
  type Account,
} from './helpers.ts';

let app: App;
let base: string;
let ali: Account;
let sara: Account;

beforeEach(async () => {
  app = testApp();
  await app.app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.app.server.address();
  if (!address || typeof address === 'string') throw new Error('no port');
  base = `ws://127.0.0.1:${address.port}/api/household/socket`;

  ali = await register(app, 'ali');
  sara = await register(app, 'sara');
  const code = await createHousehold(app, ali);
  await joinHousehold(app, sara, code);
});
afterEach(() => app.close());

interface Message {
  type?: string;
  records?: { id: string; kind: string; deleted?: boolean; value?: { name?: string } }[];
  cursor?: number;
}

/** A tiny client that queues messages, so a test can await the next one. */
class Client {
  private queue: Message[] = [];
  private waiting: ((message: Message) => void)[] = [];
  readonly socket: WebSocket;

  constructor(token: string) {
    this.socket = new WebSocket(`${base}?token=${token}`);
    this.socket.on('message', (raw) => {
      const message = JSON.parse(String(raw)) as Message;
      const next = this.waiting.shift();
      if (next) next(message);
      else this.queue.push(message);
    });
  }

  open(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.once('open', () => resolve());
      this.socket.once('error', reject);
    });
  }

  next(timeoutMs = 3000): Promise<Message> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a message')), timeoutMs);
      this.waiting.push((message) => {
        clearTimeout(timer);
        resolve(message);
      });
    });
  }

  /** Reads until a message of the wanted type arrives, skipping acks. */
  async until(type: string, timeoutMs = 3000): Promise<Message> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const message = await this.next(Math.max(50, deadline - Date.now()));
      if (message.type === type) return message;
    }
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  closed(): Promise<number> {
    return new Promise((resolve) => this.socket.once('close', (code) => resolve(code)));
  }

  stop(): void {
    this.socket.close();
  }
}

describe('household socket', () => {
  it('greets an authenticated client with the current cursor', async () => {
    const client = new Client(ali.token);
    await client.open();
    const hello = await client.next();
    expect(hello.type).toBe('hello');
    expect(hello.cursor).toBe(0);
    client.stop();
  });

  it('turns away a client with no valid token', async () => {
    const client = new Client('not-a-token');
    expect(await client.closed()).toBe(4401);
  });

  it('turns away an account that is in no household', async () => {
    const loner = await register(app, 'reza');
    const client = new Client(loner.token);
    expect(await client.closed()).toBe(4409);
  });

  it('serves a catch-up on pull', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    const client = new Client(sara.token);
    await client.open();
    await client.until('hello');

    client.send({ type: 'pull', since: 0 });
    const records = await client.until('records');
    expect(records.records?.map((r) => r.id)).toEqual(['p1']);
    client.stop();
  });

  it('carries a live change from one phone to the other', async () => {
    const one = new Client(ali.token);
    const two = new Client(sara.token);
    await Promise.all([one.open(), two.open()]);
    await Promise.all([one.until('hello'), two.until('hello')]);

    one.send({ type: 'push', records: [pantryRecord('p1', 'شیر', 1000)] });

    const arrived = await two.until('records');
    expect(arrived.records?.[0].value?.name).toBe('شیر');
    one.stop();
    two.stop();
  });

  it('echoes the push back to its sender so it learns the server’s sequence', async () => {
    const one = new Client(ali.token);
    await one.open();
    await one.until('hello');

    one.send({ type: 'push', records: [pantryRecord('p1', 'شیر', 1000)] });
    const echoed = await one.until('records');
    expect(echoed.cursor).toBe(1);
    one.stop();
  });

  it('carries a deletion, not a silent disappearance', async () => {
    const one = new Client(ali.token);
    const two = new Client(sara.token);
    await Promise.all([one.open(), two.open()]);
    await Promise.all([one.until('hello'), two.until('hello')]);

    one.send({ type: 'push', records: [pantryRecord('p1', 'شیر', 1000)] });
    await two.until('records');

    one.send({ type: 'push', records: [{ kind: 'pantry', id: 'p1', updatedAt: 2000, deleted: true }] });
    const gone = await two.until('records');
    expect(gone.records?.[0].deleted).toBe(true);
    one.stop();
    two.stop();
  });

  it('reaches a socket from a write that came in over HTTP', async () => {
    const listener = new Client(sara.token);
    await listener.open();
    await listener.until('hello');

    await push(app, ali, [pantryRecord('p9', 'نان', 1000)]);
    const arrived = await listener.until('records');
    expect(arrived.records?.[0].id).toBe('p9');
    listener.stop();
  });

  it('does not leak a change into another household', async () => {
    const outsider = await register(app, 'reza');
    await createHousehold(app, outsider);
    const stranger = new Client(outsider.token);
    await stranger.open();
    await stranger.until('hello');

    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    await expect(stranger.until('records', 300)).rejects.toThrow();
    stranger.stop();
  });

  it('shrugs off junk on the wire', async () => {
    const client = new Client(ali.token);
    await client.open();
    await client.until('hello');

    client.socket.send('not json at all');
    client.send({ type: 'push', records: 'nope' });
    client.send({ type: 'pull', since: 0 });
    // Still answering, which is the point.
    expect((await client.until('records')).records).toEqual([]);
    client.stop();
  });

  it('forgets a socket once it closes', async () => {
    const client = new Client(sara.token);
    await client.open();
    await client.until('hello');
    const householdId = app.ctx.repo.userById(sara.id)?.household_id as string;
    expect(app.ctx.rooms.size(householdId)).toBe(1);

    client.stop();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(app.ctx.rooms.size(householdId)).toBe(0);
  });
});
