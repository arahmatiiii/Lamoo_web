import { buildApp, type App } from '../src/app.ts';
import type { Env } from '../src/env.ts';

/** Every test gets a throwaway in-memory database, so nothing leaks between them. */
export function testApp(overrides: Partial<Env> = {}): App {
  return buildApp({ dbPath: ':memory:', ...overrides });
}

export interface Account {
  token: string;
  id: string;
  handle: string;
  friendCode: string;
}

export async function register(app: App, handle: string, password = 'correct-horse'): Promise<Account> {
  const response = await app.app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { handle, password, displayName: handle },
  });
  if (response.statusCode !== 201) throw new Error(`register failed: ${response.body}`);
  const body = response.json() as { token: string; user: { id: string; friendCode: string } };
  return { token: body.token, id: body.user.id, handle, friendCode: body.user.friendCode };
}

export function auth(account: Account): Record<string, string> {
  return { authorization: `Bearer ${account.token}` };
}

/**
 * The invite code of `account`'s own kitchen. Every account gets one on demand,
 * so there is no separate "create" step any more.
 */
export async function kitchenCode(app: App, account: Account): Promise<string> {
  const response = await app.app.inject({
    method: 'GET',
    url: '/api/household',
    headers: auth(account),
  });
  if (response.statusCode !== 200) throw new Error(`kitchen lookup failed: ${response.body}`);
  return (response.json() as { household: { inviteCode: string } }).household.inviteCode;
}

export async function joinHousehold(app: App, account: Account, code: string): Promise<void> {
  const response = await app.app.inject({
    method: 'POST',
    url: '/api/household/join',
    headers: auth(account),
    payload: { code },
  });
  if (response.statusCode !== 200) throw new Error(`join failed: ${response.body}`);
}

export async function push(app: App, account: Account, records: unknown[]) {
  const response = await app.app.inject({
    method: 'POST',
    url: '/api/household/records',
    headers: auth(account),
    payload: { records },
  });
  return response;
}

export async function pull(app: App, account: Account, since = 0) {
  return app.app.inject({
    method: 'GET',
    url: `/api/household/records?since=${since}`,
    headers: auth(account),
  });
}

export function pantryRecord(id: string, name: string, updatedAt: number) {
  return { kind: 'pantry', id, updatedAt, value: { id, name, available: true } };
}

/** Makes two accounts friends, handling both halves of the handshake. */
export async function befriend(app: App, a: Account, b: Account): Promise<string> {
  const requested = await app.app.inject({
    method: 'POST',
    url: '/api/friends/request',
    headers: auth(a),
    payload: { code: b.friendCode },
  });
  if (requested.statusCode !== 201) throw new Error(`request failed: ${requested.body}`);
  const id = (requested.json() as { friendship: { friendshipId: string } }).friendship.friendshipId;
  const accepted = await app.app.inject({
    method: 'POST',
    url: `/api/friends/${id}/accept`,
    headers: auth(b),
  });
  if (accepted.statusCode !== 200) throw new Error(`accept failed: ${accepted.body}`);
  return id;
}
