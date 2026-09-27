import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * scrypt from node:crypto rather than argon2, so the server has no native
 * dependency to compile on a small VPS. These parameters cost roughly 100ms per
 * hash on modest hardware, which is the point.
 */
const N = 16384;
const r = 8;
const p = 1;
const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p }, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, keyRaw] = parts;
  const salt = Buffer.from(saltRaw, 'base64');
  const expected = Buffer.from(keyRaw, 'base64');
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      expected.length,
      { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) },
      (err, out) => (err ? reject(err) : resolve(out))
    );
  }).catch(() => null);
  if (!key || key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

/** Loose on purpose: length is what matters, and we are not the password police. */
export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length < 8) {
    return 'رمز عبور باید حداقل ۸ کاراکتر باشد';
  }
  if (password.length > 200) return 'رمز عبور بیش از حد بلند است';
  return null;
}

export function handleProblem(handle: string): string | null {
  if (typeof handle !== 'string') return 'نام کاربری نامعتبر است';
  const trimmed = handle.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return 'نام کاربری باید بین ۳ تا ۳۲ کاراکتر باشد';
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'نام کاربری فقط می‌تواند حرف انگلیسی، رقم، نقطه، خط تیره و زیرخط داشته باشد';
  }
  return null;
}
