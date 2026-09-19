/**
 * Shared-household plumbing: one secret, held by every member, that both
 * names the relay room and encrypts everything sent through it.
 *
 * The secret is 32 random bytes — deliberately the same shape as a secp256k1
 * key, so the friends/stories phase can reuse this identity on real Nostr
 * without a second key system. Content encryption here is plain WebCrypto:
 * both ends are ours, so there is nothing for a Nostr NIP to buy us yet.
 */

const HEX = /^[0-9a-f]{64}$/;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** A fresh household secret. Whoever holds this is a member. */
export function createHouseholdSecret(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export function isHouseholdSecret(value: string): boolean {
  return HEX.test(value.trim().toLowerCase());
}

async function derive(secret: string, info: string, bits: number): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey('raw', fromHex(secret), 'HKDF', false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('lamoo/v1'), info: new TextEncoder().encode(info) },
    base,
    bits
  );
}

/**
 * Public name of the household's room on the relay. Derived from the secret
 * but useless on its own — it identifies where to sync without handing the
 * relay operator the ability to read anything.
 */
export async function roomIdFor(secret: string): Promise<string> {
  return toHex(new Uint8Array(await derive(secret, 'room', 256)));
}

async function contentKey(secret: string): Promise<CryptoKey> {
  const bits = await derive(secret, 'content', 256);
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** AES-GCM, nonce prepended, base64. */
export async function encryptJson(secret: string, value: unknown): Promise<string> {
  const key = await contentKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext));

  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv);
  packed.set(cipher, iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptJson<T>(secret: string, payload: string): Promise<T> {
  const key = await contentKey(secret);
  const packed = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.slice(0, 12) },
    key,
    packed.slice(12)
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

// ---------------------------------------------------------------------------
// Invite codes
// ---------------------------------------------------------------------------

/**
 * The invite code carries the secret itself, so it is the household — treat it
 * like a password, not a username. Grouped for reading aloud over the phone.
 */
export function formatInviteCode(secret: string): string {
  return (secret.match(/.{1,8}/g) ?? []).join('-').toUpperCase();
}

/** Accepts the grouped form, raw hex, spaces, any case. */
export function parseInviteCode(code: string): string | null {
  const cleaned = code.replace(/[\s-]/g, '').toLowerCase();
  return isHouseholdSecret(cleaned) ? cleaned : null;
}

/**
 * Opaque per-row key for the relay. Derived from the secret, so the relay
 * stores rows it can neither read nor label — it never learns that a row is
 * "a pantry item called شیر".
 */
export async function rowKeyFor(secret: string, recordKey: string): Promise<string> {
  const bits = await derive(secret, `row/${recordKey}`, 256);
  return toHex(new Uint8Array(bits));
}

/** https://host → wss://host/room/<id> */
export function relaySocketUrl(relayUrl: string, roomId: string): string {
  const base = relayUrl.trim().replace(/\/+$/, '');
  return `${base.replace(/^http/, 'ws')}/room/${roomId}`;
}
