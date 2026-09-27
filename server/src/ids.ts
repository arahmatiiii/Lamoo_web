import { randomBytes, randomInt } from 'node:crypto';

/**
 * Codes people read off a screen and type into another phone, so the alphabet
 * leaves out the pairs that get mistyped: 0/O, 1/I/L, 5/S, 8/B.
 */
const HUMAN_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY2346789';

export function newId(): string {
  return randomBytes(16).toString('hex');
}

function humanCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += HUMAN_ALPHABET[randomInt(HUMAN_ALPHABET.length)];
  return out;
}

/** Grants membership of a household on its own, so it is long. */
export function newInviteCode(): string {
  return humanCode(12);
}

/**
 * Grants nothing on its own — it only lets someone send a friend request that
 * the owner has to accept — so it can be short enough to say out loud.
 */
export function newFriendCode(): string {
  return humanCode(8);
}

/** Accepts the code however it was pasted: spaces, dashes, wrong case. */
export function normaliseCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
