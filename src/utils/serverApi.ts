import type { Recipe } from '../store/useStore';

/**
 * Client for the Lamoo server (`server/` in this repo) — the one place the app
 * keeps accounts, the shared kitchen, friends and stories.
 *
 * The address is fixed at build time (`VITE_SERVER_URL`) so the app has a
 * single backend and the user never has to type a URL. `npm run dev` falls
 * back to the local API, and a build that forgets the variable fails loudly
 * with a Persian message rather than calling the WebView's own origin.
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

const CONFIGURED = normaliseServerUrl(String(import.meta.env.VITE_SERVER_URL ?? ''));

/** The single backend. Empty means the build never set `VITE_SERVER_URL`. */
export const SERVER_URL = CONFIGURED || (import.meta.env.DEV ? 'http://localhost:8787' : '');

function baseUrl(): string {
  if (!SERVER_URL) {
    throw new Error('آدرس سرور در بیلد تنظیم نشده — VITE_SERVER_URL را بگذار و دوباره بساز');
  }
  return SERVER_URL;
}

/** `https://host` → `wss://host/...`, keeping plain `http` on `ws` for local runs. */
export function serverSocketUrl(token: string): string {
  const base = baseUrl();
  const socket = base.replace(/^http/i, 'ws');
  return `${socket}/api/household/socket?token=${encodeURIComponent(token)}`;
}

/** Absolute URL for something the server serves relatively, such as `/media/x`. */
export function serverAssetUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  token?: string;
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = baseUrl();

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
    throw new Error('به سرور وصل نشد — اینترنت و آدرس سرور را بررسی کن');
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

export function signUp(handle: string, password: string, displayName: string) {
  return request<SessionResponse>('/api/auth/register', {
    method: 'POST',
    body: { handle, password, displayName },
  });
}

export function signIn(handle: string, password: string) {
  return request<SessionResponse>('/api/auth/login', {
    method: 'POST',
    body: { handle, password },
  });
}

export function signOut(token: string) {
  return request<{ ok: true }>('/api/auth/logout', { method: 'POST', token });
}

export function fetchMe(token: string) {
  return request<{ user: ServerAccount; household: ServerHousehold | null }>('/api/me', { token });
}

// ---- shared kitchen ---------------------------------------------------------

/** My kitchen (its code, members and cursor). The server creates a solo one on demand. */
export function fetchHousehold(token: string) {
  return request<{ household: ServerHousehold }>('/api/household', { token });
}

/** Pair with the person whose kitchen code this is. Two people at most. */
export function joinHousehold(token: string, code: string) {
  return request<{ household: ServerHousehold }>('/api/household/join', {
    method: 'POST',
    token,
    body: { code },
  });
}

/** Leave the shared kitchen; the server hands back a fresh solo one with a new code. */
export function leaveHousehold(token: string) {
  return request<{ household: ServerHousehold }>('/api/household/leave', { method: 'POST', token });
}

// ---- friends ----------------------------------------------------------------

export function fetchFriends(token: string) {
  return request<FriendLists>('/api/friends', { token });
}

export function requestFriend(token: string, code: string) {
  return request<{ status: 'pending' | 'accepted' }>('/api/friends/request', {
    method: 'POST',
    token,
    body: { code },
  });
}

export function acceptFriend(token: string, friendshipId: string) {
  return request<unknown>(`/api/friends/${friendshipId}/accept`, { method: 'POST', token });
}

export function removeFriend(token: string, friendshipId: string) {
  return request<{ ok: true }>(`/api/friends/${friendshipId}`, { method: 'DELETE', token });
}

// ---- share cards ------------------------------------------------------------

export function postCard(
  token: string,
  card: { title: string; note: string; recipe: Recipe; image?: string; ttlHours?: number }
) {
  return request<{ card: CardSummary }>('/api/cards', { method: 'POST', token, body: card });
}

export function fetchFeed(token: string) {
  return request<{ cards: CardSummary[] }>('/api/feed', { token });
}

export function fetchMyCards(token: string) {
  return request<{ cards: CardSummary[] }>('/api/cards/mine', { token });
}

export function fetchCard(token: string, id: string) {
  return request<{ card: CardDetail }>(`/api/cards/${id}`, { token });
}

export function markCardSeen(token: string, id: string) {
  return request<{ ok: true }>(`/api/cards/${id}/seen`, { method: 'POST', token });
}

export function saveCard(token: string, id: string) {
  return request<{ ok: true; recipe: Recipe; saves: number }>(`/api/cards/${id}/save`, {
    method: 'POST',
    token,
  });
}
