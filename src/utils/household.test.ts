import { describe, it, expect } from 'vitest';
import {
  createHouseholdSecret,
  isHouseholdSecret,
  roomIdFor,
  encryptJson,
  decryptJson,
  formatInviteCode,
  parseInviteCode,
  rowKeyFor,
  relaySocketUrl,
} from './household';

describe('createHouseholdSecret', () => {
  it('makes a 32-byte hex secret', () => {
    expect(createHouseholdSecret()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never repeats', () => {
    const many = new Set(Array.from({ length: 50 }, () => createHouseholdSecret()));

    expect(many.size).toBe(50);
  });
});

describe('isHouseholdSecret', () => {
  it('accepts a real secret and rejects junk', () => {
    expect(isHouseholdSecret(createHouseholdSecret())).toBe(true);
    expect(isHouseholdSecret('')).toBe(false);
    expect(isHouseholdSecret('abc')).toBe(false);
    expect(isHouseholdSecret('z'.repeat(64))).toBe(false);
  });
});

describe('roomIdFor', () => {
  it('is stable for the same secret', async () => {
    const secret = createHouseholdSecret();

    expect(await roomIdFor(secret)).toBe(await roomIdFor(secret));
  });

  it('differs between households', async () => {
    expect(await roomIdFor(createHouseholdSecret())).not.toBe(
      await roomIdFor(createHouseholdSecret())
    );
  });

  // The room id travels in a URL; it must not hand the relay the secret.
  it('does not leak the secret', async () => {
    const secret = createHouseholdSecret();
    const room = await roomIdFor(secret);

    expect(room).not.toBe(secret);
    expect(room).not.toContain(secret.slice(0, 16));
  });
});

describe('encryptJson / decryptJson', () => {
  it('round-trips an object', async () => {
    const secret = createHouseholdSecret();
    const value = { name: 'شیر', amount: '۲', nested: { ok: true }, list: [1, 2, 3] };

    expect(await decryptJson(secret, await encryptJson(secret, value))).toEqual(value);
  });

  it('round-trips Persian text intact', async () => {
    const secret = createHouseholdSecret();
    const value = { note: 'گوجه‌فرنگی و سبزی خرد‌شده' };

    expect(await decryptJson<typeof value>(secret, await encryptJson(secret, value))).toEqual(value);
  });

  it('produces different ciphertext each time for the same input', async () => {
    const secret = createHouseholdSecret();

    expect(await encryptJson(secret, { a: 1 })).not.toBe(await encryptJson(secret, { a: 1 }));
  });

  it('cannot be read with a different secret', async () => {
    const payload = await encryptJson(createHouseholdSecret(), { secret: 'شام امشب' });

    await expect(decryptJson(createHouseholdSecret(), payload)).rejects.toThrow();
  });

  it('rejects tampered ciphertext rather than returning garbage', async () => {
    const secret = createHouseholdSecret();
    const payload = await encryptJson(secret, { a: 1 });
    const bytes = atob(payload).split('');
    bytes[bytes.length - 1] = String.fromCharCode(bytes[bytes.length - 1].charCodeAt(0) ^ 0xff);

    await expect(decryptJson(secret, btoa(bytes.join('')))).rejects.toThrow();
  });
});

describe('invite codes', () => {
  it('round-trips through the grouped display form', () => {
    const secret = createHouseholdSecret();

    expect(parseInviteCode(formatInviteCode(secret))).toBe(secret);
  });

  it('is grouped and upper-cased for reading aloud', () => {
    const code = formatInviteCode('a'.repeat(64));

    expect(code).toBe(Array(8).fill('AAAAAAAA').join('-'));
  });

  it('accepts raw hex, stray spaces and mixed case', () => {
    const secret = createHouseholdSecret();

    expect(parseInviteCode(secret)).toBe(secret);
    expect(parseInviteCode(`  ${secret.toUpperCase()}  `)).toBe(secret);
    expect(parseInviteCode(formatInviteCode(secret).replace(/-/g, ' '))).toBe(secret);
  });

  it('returns null for a code that is not one', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('سلام')).toBeNull();
    expect(parseInviteCode('ABC-DEF')).toBeNull();
  });
});

describe('rowKeyFor', () => {
  it('is stable for the same row', async () => {
    const secret = createHouseholdSecret();

    expect(await rowKeyFor(secret, 'pantry:p1')).toBe(await rowKeyFor(secret, 'pantry:p1'));
  });

  it('differs per row and per household', async () => {
    const a = createHouseholdSecret();
    const b = createHouseholdSecret();

    expect(await rowKeyFor(a, 'pantry:p1')).not.toBe(await rowKeyFor(a, 'pantry:p2'));
    expect(await rowKeyFor(a, 'pantry:p1')).not.toBe(await rowKeyFor(b, 'pantry:p1'));
  });

  // The relay should not be able to tell a pantry row from a recipe row.
  it('does not reveal the row it stands for', async () => {
    const key = await rowKeyFor(createHouseholdSecret(), 'pantry:p1');

    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('pantry');
  });
});

describe('relaySocketUrl', () => {
  it('upgrades the scheme and appends the room', () => {
    expect(relaySocketUrl('https://lamoo-relay.me.workers.dev', 'abc')).toBe(
      'wss://lamoo-relay.me.workers.dev/room/abc'
    );
  });

  it('tolerates a trailing slash and stray spaces', () => {
    expect(relaySocketUrl('  https://r.dev/  ', 'abc')).toBe('wss://r.dev/room/abc');
  });

  it('keeps a plain-http relay on ws for local testing', () => {
    expect(relaySocketUrl('http://localhost:8787', 'abc')).toBe('ws://localhost:8787/room/abc');
  });
});
