import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.ts';
import {
  auth,
  createHousehold,
  joinHousehold,
  pantryRecord,
  pull,
  push,
  register,
  testApp,
  type Account,
} from './helpers.ts';

let app: App;
let ali: Account;
let sara: Account;

beforeEach(async () => {
  app = testApp();
  ali = await register(app, 'ali');
  sara = await register(app, 'sara');
});
afterEach(() => app.close());

describe('joining', () => {
  it('creates a household with an invite code and puts the creator in it', async () => {
    const code = await createHousehold(app, ali);
    expect(code).toMatch(/^[A-Z0-9]{12}$/);
    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(ali) });
    expect(me.json().household.inviteCode).toBe(code);
    expect(me.json().household.members).toHaveLength(1);
  });

  it('pairs a second account by code', async () => {
    const code = await createHousehold(app, ali);
    await joinHousehold(app, sara, code);
    const members = await app.app.inject({
      method: 'GET',
      url: '/api/household/members',
      headers: auth(ali),
    });
    expect(members.json().household.members.map((m: { handle: string }) => m.handle).sort()).toEqual([
      'ali',
      'sara',
    ]);
  });

  it('accepts the code however it was pasted', async () => {
    const code = await createHousehold(app, ali);
    const messy = `  ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `;
    await joinHousehold(app, sara, messy);
    expect((await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(sara) })).json()
      .household.inviteCode).toBe(code);
  });

  it('refuses a code that is not a household', async () => {
    const response = await app.app.inject({
      method: 'POST',
      url: '/api/household/join',
      headers: auth(sara),
      payload: { code: 'ZZZZZZZZZZZZ' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('will not let one account hold two households at once', async () => {
    await createHousehold(app, ali);
    const again = await app.app.inject({
      method: 'POST',
      url: '/api/household',
      headers: auth(ali),
      payload: {},
    });
    expect(again.statusCode).toBe(409);
  });

  it('asks for a household before serving records', async () => {
    expect((await pull(app, ali)).statusCode).toBe(409);
  });

  it('retires the household when the last member leaves, so its code dies with it', async () => {
    const code = await createHousehold(app, ali);
    await app.app.inject({ method: 'POST', url: '/api/household/leave', headers: auth(ali) });
    const join = await app.app.inject({
      method: 'POST',
      url: '/api/household/join',
      headers: auth(sara),
      payload: { code },
    });
    expect(join.statusCode).toBe(404);
  });

  it('keeps the household alive for the members who stay', async () => {
    const code = await createHousehold(app, ali);
    await joinHousehold(app, sara, code);
    await app.app.inject({ method: 'POST', url: '/api/household/leave', headers: auth(ali) });
    expect((await pull(app, sara)).statusCode).toBe(200);
  });
});

describe('shared records', () => {
  beforeEach(async () => {
    const code = await createHousehold(app, ali);
    await joinHousehold(app, sara, code);
  });

  it('shows one member what the other added', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    const seen = await pull(app, sara);
    expect(seen.json().records).toHaveLength(1);
    expect(seen.json().records[0].value.name).toBe('شیر');
  });

  it('serves only what is new since the given cursor', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    const first = await pull(app, sara);
    const cursor = first.json().cursor;

    await push(app, ali, [pantryRecord('p2', 'تخم‌مرغ', 2000)]);
    const second = await pull(app, sara, cursor);
    expect(second.json().records.map((r: { id: string }) => r.id)).toEqual(['p2']);
  });

  it('assigns its own increasing sequence, not the sender’s clock', async () => {
    // Ali's phone is an hour fast and Sara's is a day slow; ordering must still
    // follow the order the server heard about them.
    await push(app, ali, [pantryRecord('p1', 'شیر', 9_000_000)]);
    await push(app, sara, [pantryRecord('p2', 'نان', 1)]);
    const all = await pull(app, ali);
    expect(all.json().records.map((r: { id: string }) => r.id)).toEqual(['p1', 'p2']);
    expect(all.json().records[1].seq).toBeGreaterThan(all.json().records[0].seq);
  });

  it('ignores a stale write that would undo a newer one', async () => {
    await push(app, ali, [pantryRecord('p1', 'ماست', 2000)]);
    const response = await push(app, sara, [pantryRecord('p1', 'شیر', 1000)]);
    expect(response.json().records).toHaveLength(0);
    expect((await pull(app, ali)).json().records[0].value.name).toBe('ماست');
  });

  it('does not re-announce a row that was pushed again unchanged', async () => {
    const record = pantryRecord('p1', 'شیر', 1000);
    await push(app, ali, [record]);
    const again = await push(app, ali, [record]);
    expect(again.json().records).toHaveLength(0);
  });

  it('keeps a deletion deleted when the other phone pushes its old copy', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    await push(app, ali, [{ kind: 'pantry', id: 'p1', updatedAt: 2000, deleted: true }]);
    await push(app, sara, [pantryRecord('p1', 'شیر', 1000)]);

    const rows = (await pull(app, sara)).json().records;
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted).toBe(true);
    expect(rows[0].value).toBeUndefined();
  });

  it('carries all four collections, not just the pantry', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p', updatedAt: 1, value: { name: 'شیر' } },
      { kind: 'recipe', id: 'r', updatedAt: 1, value: { title: 'قرمه‌سبزی' } },
      { kind: 'shopping', id: 's', updatedAt: 1, value: { name: 'نان' } },
      { kind: 'reminder', id: 'm', updatedAt: 1, value: { text: 'ماست بگیر' } },
    ]);
    const kinds = (await pull(app, sara)).json().records.map((r: { kind: string }) => r.kind);
    expect(kinds.sort()).toEqual(['pantry', 'recipe', 'reminder', 'shopping']);
  });

  it('drops malformed rows and keeps the good ones in the same push', async () => {
    const response = await push(app, ali, [
      pantryRecord('good', 'شیر', 1000),
      { kind: 'nonsense', id: 'bad', updatedAt: 1, value: {} },
      { kind: 'pantry', updatedAt: 1, value: {} },
    ]);
    expect(response.json().rejected).toBe(2);
    expect(response.json().records.map((r: { id: string }) => r.id)).toEqual(['good']);
  });

  it('keeps two households apart', async () => {
    const other = await register(app, 'reza');
    await createHousehold(app, other);
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    expect((await pull(app, other)).json().records).toEqual([]);
  });

  it('will not serve another household’s rows to an account that left', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    await app.app.inject({ method: 'POST', url: '/api/household/leave', headers: auth(sara) });
    expect((await pull(app, sara)).statusCode).toBe(409);
  });

  it('turns down an unauthenticated push', async () => {
    const response = await app.app.inject({
      method: 'POST',
      url: '/api/household/records',
      payload: { records: [pantryRecord('p1', 'شیر', 1)] },
    });
    expect(response.statusCode).toBe(401);
  });

  it('converges when both phones edit the same row at the same millisecond', async () => {
    const at = 5000;
    await push(app, ali, [{ kind: 'pantry', id: 'p1', updatedAt: at, value: { name: 'شیر' } }]);
    await push(app, sara, [{ kind: 'pantry', id: 'p1', updatedAt: at, value: { name: 'ماست' } }]);

    const fromAli = (await pull(app, ali)).json().records;
    const fromSara = (await pull(app, sara)).json().records;
    expect(fromAli).toEqual(fromSara);
    expect(fromAli).toHaveLength(1);
  });
});
