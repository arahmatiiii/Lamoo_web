import type { Recipe } from '../store/useStore';

/**
 * Thin client for the Lamoo server (`server/` in this repo).
 *
 * Every call goes through `request`, which turns a failure into an `Error` with
 * a message already written in Persian — the server sends one with every error,
 * and inventing a second copy here would mean two wordings to keep in step.
 */

export interface ServerAccount {
  id: string;
  handle: string;
  displayName: string;
  friendCode: string;
  householdId: string | null;
}

export interface ServerHousehold {
  id: string;
  name: string;
  inviteCode: string;
  cursor: number;
  members: { id: string; handle: string; displayName: string }[];
}

export interface FriendSummary {
  friendshipId: string;
  id: string;
  handle: string;
  displayName: string;
  since: number;
}

export interface FriendLists {
  friends: FriendSummary[];
  incoming: FriendSummary[];
  outgoing: FriendSummary[];
  myCode: string;
}

export interface CardSummary {
  id: string;
  title: string;
  note: string;
  imageUrl: string | null;
  createdAt: number;
  expiresAt: number;
  saves: number;
  seen: boolean;
  author: { id: string; handle: string; displayName: string };
}

export interface CardDetail extends CardSummary {
  recipe: Recipe;
}

/** Trailing slashes and a missing scheme are the two things people always paste. */
export function normaliseServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** `https://host` → `wss://host/...`, keeping plain `http` on `ws` for local runs. */
export function serverSocketUrl(serverUrl: string, token: string): string {
  const base = normaliseServerUrl(serverUrl);
  const socket = base.replace(/^http/i, 'ws');
  return `${socket}/api/household/socket?token=${encodeURIComponent(token)}`;
}

/** Absolute URL for something the server serves relatively, such as `/media/x`. */
export function serverAssetUrl(serverUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${normaliseServerUrl(serverUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  token?: string;
  body?: unknown;
}

export async function request<T>(
  serverUrl: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const base = normaliseServerUrl(serverUrl);
  if (!base) throw new Error('آدرس سرور را وارد کن');

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // A DNS failure, a bad certificate and a firewall all land here, and the
    // browser deliberately tells us nothing more.
    throw new Error('به سرور وصل نشد — آدرس و اینترنت را بررسی کن');
  }

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message;
    throw new Error(message || `سرور خطا داد (${response.status})`);
  }
  return payload as T;
}

// ---- accounts ---------------------------------------------------------------

interface SessionResponse {
  token: string;
  user: ServerAccount;
}

export function signUp(serverUrl: string, handle: string, password: string, displayName: string) {
  return request<SessionResponse>(serverUrl, '/api/auth/register', {
    method: 'POST',
    body: { handle, password, displayName },
  });
}

export function signIn(serverUrl: string, handle: string, password: string) {
  return request<SessionResponse>(serverUrl, '/api/auth/login', {
    method: 'POST',
    body: { handle, password },
  });
}

export function signOut(serverUrl: string, token: string) {
  return request<{ ok: true }>(serverUrl, '/api/auth/logout', { method: 'POST', token });
}

export function fetchMe(serverUrl: string, token: string) {
  return request<{ user: ServerAccount; household: ServerHousehold | null }>(serverUrl, '/api/me', {
    token,
  });
}

// ---- household --------------------------------------------------------------

export function createServerHousehold(serverUrl: string, token: string, name: string) {
  return request<{ household: ServerHousehold }>(serverUrl, '/api/household', {
    method: 'POST',
    token,
    body: { name },
  });
}

export function joinServerHousehold(serverUrl: string, token: string, code: string) {
  return request<{ household: ServerHousehold }>(serverUrl, '/api/household/join', {
    method: 'POST',
    token,
    body: { code },
  });
}

export function leaveServerHousehold(serverUrl: string, token: string) {
  return request<{ ok: true }>(serverUrl, '/api/household/leave', { method: 'POST', token });
}

// ---- friends ----------------------------------------------------------------

export function fetchFriends(serverUrl: string, token: string) {
  return request<FriendLists>(serverUrl, '/api/friends', { token });
}

export function requestFriend(serverUrl: string, token: string, code: string) {
  return request<{ status: 'pending' | 'accepted' }>(serverUrl, '/api/friends/request', {
    method: 'POST',
    token,
    body: { code },
  });
}

export function acceptFriend(serverUrl: string, token: string, friendshipId: string) {
  return request<unknown>(serverUrl, `/api/friends/${friendshipId}/accept`, {
    method: 'POST',
    token,
  });
}

export function removeFriend(serverUrl: string, token: string, friendshipId: string) {
  return request<{ ok: true }>(serverUrl, `/api/friends/${friendshipId}`, {
    method: 'DELETE',
    token,
  });
}

// ---- share cards ------------------------------------------------------------

export function postCard(
  serverUrl: string,
  token: string,
  card: { title: string; note: string; recipe: Recipe; image?: string; ttlHours?: number }
) {
  return request<{ card: CardSummary }>(serverUrl, '/api/cards', {
    method: 'POST',
    token,
    body: card,
  });
}

export function fetchFeed(serverUrl: string, token: string) {
  return request<{ cards: CardSummary[] }>(serverUrl, '/api/feed', { token });
}

export function fetchMyCards(serverUrl: string, token: string) {
  return request<{ cards: CardSummary[] }>(serverUrl, '/api/cards/mine', { token });
}

export function fetchCard(serverUrl: string, token: string, id: string) {
  return request<{ card: CardDetail }>(serverUrl, `/api/cards/${id}`, { token });
}

export function markCardSeen(serverUrl: string, token: string, id: string) {
  return request<{ ok: true }>(serverUrl, `/api/cards/${id}/seen`, { method: 'POST', token });
}

export function saveCard(serverUrl: string, token: string, id: string) {
  return request<{ ok: true; recipe: Recipe; saves: number }>(
    serverUrl,
    `/api/cards/${id}/save`,
    { method: 'POST', token }
  );
}

// ---- push -------------------------------------------------------------------

export function fetchPushKey(serverUrl: string, token: string) {
  return request<{ publicKey: string | null }>(serverUrl, '/api/push/key', { token });
}

export function subscribePush(
  serverUrl: string,
  token: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  return request<{ ok: true }>(serverUrl, '/api/push/subscribe', {
    method: 'POST',
    token,
    body: subscription,
  });
}

export function unsubscribePush(serverUrl: string, token: string, endpoint: string) {
  return request<{ ok: true }>(serverUrl, '/api/push/subscribe', {
    method: 'DELETE',
    token,
    body: { endpoint },
  });
}
