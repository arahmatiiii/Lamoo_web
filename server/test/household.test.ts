import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.ts';
import {
  auth,
  joinHousehold,
  kitchenCode,
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

describe('my kitchen code', () => {
  it('gives every account a kitchen of its own with a 12-character code', async () => {
    const code = await kitchenCode(app, ali);
    expect(code).toMatch(/^[A-Z0-9]{12}$/);

    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(ali) });
    expect(me.json().household.inviteCode).toBe(code);
    expect(me.json().household.members).toHaveLength(1);
  });

  it('gives two different accounts two different codes', async () => {
    expect(await kitchenCode(app, ali)).not.toBe(await kitchenCode(app, sara));
  });

  it('reports the same code every time it is asked', async () => {
    expect(await kitchenCode(app, ali)).toBe(await kitchenCode(app, ali));
  });
});

describe('pairing by code', () => {
  it('puts both accounts in the kitchen whose code was entered', async () => {
    const code = await kitchenCode(app, ali);
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

  it('works in the other direction too: the code owner joins the other person', async () => {
    const code = await kitchenCode(app, sara);
    await joinHousehold(app, ali, code);

    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(sara) });
    expect(me.json().household.members).toHaveLength(2);
  });

  it('accepts the code however it was pasted', async () => {
    const code = await kitchenCode(app, ali);
    const messy = `  ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `;
    await joinHousehold(app, sara, messy);
    expect((await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(sara) })).json()
      .household.inviteCode).toBe(code);
  });

  it('refuses a code that is not a kitchen', async () => {
    const response = await app.app.inject({
      method: 'POST',
      url: '/api/household/join',
      headers: auth(sara),
      payload: { code: 'ZZZZZZZZZZZZ' },
    });
    expect(response.statusCode).toBe(404);
  });

  it('is a no-op when entering your own code', async () => {
    const code = await kitchenCode(app, ali);
    await joinHousehold(app, ali, code);
    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(ali) });
    expect(me.json().household.members).toHaveLength(1);
  });

  it('will not let a third person into a full kitchen', async () => {
    const code = await kitchenCode(app, ali);
    await joinHousehold(app, sara, code);

    const reza = await register(app, 'reza');
    const response = await app.app.inject({
      method: 'POST',
      url: '/api/household/join',
      headers: auth(reza),
      payload: { code },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe('kitchen_full');
  });

  it('lets the two members swap which kitchen they live in', async () => {
    // Sara moves into Ali's kitchen, then Ali moves into what is now Sara's
    // fresh solo kitchen: still two people, still one shared kitchen.
    await joinHousehold(app, sara, await kitchenCode(app, ali));
    const saraSolo = await app.app.inject({
      method: 'POST',
      url: '/api/household/leave',
      headers: auth(sara),
    });
    const newCode = saraSolo.json().household.inviteCode;
    await joinHousehold(app, ali, newCode);

    const saraView = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(sara) });
    expect(saraView.json().household.inviteCode).toBe(newCode);
    expect(saraView.json().household.members).toHaveLength(2);
  });
});

describe('leaving', () => {
  it('hands back a fresh solo kitchen with a new code', async () => {
    const before = await kitchenCode(app, ali);
    const response = await app.app.inject({
      method: 'POST',
      url: '/api/household/leave',
      headers: auth(ali),
    });
    const after = response.json().household;

    expect(response.statusCode).toBe(200);
    expect(after.inviteCode).toMatch(/^[A-Z0-9]{12}$/);
    expect(after.inviteCode).not.toBe(before);
    expect(after.members).toHaveLength(1);
  });

  it('retires the household when the last member leaves, so its code dies with it', async () => {
    const code = await kitchenCode(app, ali);
    await app.app.inject({ method: 'POST', url: '/api/household/leave', headers: auth(ali) });

    const join = await app.app.inject({
      method: 'POST',
      url: '/api/household/join',
      headers: auth(sara),
      payload: { code },
    });
    expect(join.statusCode).toBe(404);
  });

  it('keeps the household alive for the member who stays', async () => {
    const code = await kitchenCode(app, ali);
    await joinHousehold(app, sara, code);
    await app.app.inject({ method: 'POST', url: '/api/household/leave', headers: auth(ali) });

    expect((await pull(app, sara)).statusCode).toBe(200);
    const saraView = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(sara) });
    expect(saraView.json().household.members).toHaveLength(1);
  });
});

describe('shared records', () => {
  beforeEach(async () => {
    await joinHousehold(app, sara, await kitchenCode(app, ali));
  });

  it('gives a brand-new account its own kitchen without any setup', async () => {
    const reza = await register(app, 'reza');
    const seen = await pull(app, reza);
    expect(seen.statusCode).toBe(200);
    expect(seen.json().records).toEqual([]);
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
    await kitchenCode(app, other);
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    expect((await pull(app, other)).json().records).toEqual([]);
  });

  it('gives a member who left a fresh kitchen without the old rows', async () => {
    await push(app, ali, [pantryRecord('p1', 'شیر', 1000)]);
    const left = await app.app.inject({
      method: 'POST',
      url: '/api/household/leave',
      headers: auth(sara),
    });
    expect(left.json().household.members).toHaveLength(1);

    const rows = await pull(app, sara);
    expect(rows.statusCode).toBe(200);
    expect(rows.json().records).toEqual([]);
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
