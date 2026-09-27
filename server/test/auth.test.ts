import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, handleProblem, passwordProblem } from '../src/passwords.ts';
import { auth, register, testApp } from './helpers.ts';
import type { App } from '../src/app.ts';

let app: App;
beforeEach(() => {
  app = testApp();
});
afterEach(() => app.close());

describe('password hashing', () => {
  it('round-trips a password', async () => {
    const stored = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', stored)).toBe(true);
    expect(await verifyPassword('correct-horsé', stored)).toBe(false);
  });

  it('salts, so the same password hashes differently each time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('refuses a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$1$2$3$bad')).toBe(false);
  });
});

describe('validation', () => {
  it('rejects short passwords and odd handles', () => {
    expect(passwordProblem('short')).not.toBeNull();
    expect(passwordProblem('longenough')).toBeNull();
    expect(handleProblem('a')).not.toBeNull();
    expect(handleProblem('علی')).not.toBeNull();
    expect(handleProblem('ali.rahmati')).toBeNull();
  });
});

describe('register and login', () => {
  it('issues a token on signup and accepts it', async () => {
    const account = await register(app, 'ali');
    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(account) });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.handle).toBe('ali');
    expect(me.json().household).toBeNull();
  });

  it('gives every account a friend code', async () => {
    const a = await register(app, 'ali');
    const b = await register(app, 'sara');
    expect(a.friendCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(a.friendCode).not.toBe(b.friendCode);
  });

  it('refuses a duplicate handle, case-insensitively', async () => {
    await register(app, 'ali');
    const again = await app.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { handle: 'ALI', password: 'correct-horse' },
    });
    expect(again.statusCode).toBe(409);
  });

  it('logs in with the right password and not the wrong one', async () => {
    await register(app, 'ali', 'correct-horse');
    const good = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { handle: 'ali', password: 'correct-horse' },
    });
    expect(good.statusCode).toBe(200);
    expect(good.json().token).toBeTypeOf('string');

    const bad = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { handle: 'ali', password: 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
  });

  it('does not say whether the account exists when the password is wrong', async () => {
    await register(app, 'ali');
    const missing = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { handle: 'nobody', password: 'whatever!!' },
    });
    const wrong = await app.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { handle: 'ali', password: 'whatever!!' },
    });
    expect(missing.statusCode).toBe(wrong.statusCode);
    expect(missing.json().message).toBe(wrong.json().message);
  });

  it('stops guessing after enough wrong passwords', async () => {
    await register(app, 'ali');
    const attempt = () =>
      app.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { handle: 'ali', password: 'wrong-guess' },
      });
    let limited = false;
    for (let i = 0; i < 12; i += 1) {
      if ((await attempt()).statusCode === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  it('revokes the token on logout', async () => {
    const account = await register(app, 'ali');
    await app.app.inject({ method: 'POST', url: '/api/auth/logout', headers: auth(account) });
    const me = await app.app.inject({ method: 'GET', url: '/api/me', headers: auth(account) });
    expect(me.statusCode).toBe(401);
  });

  it('rejects a made-up token', async () => {
    const me = await app.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer deadbeef' },
    });
    expect(me.statusCode).toBe(401);
  });

  it('can be run as a closed server', async () => {
    const closed = testApp({ allowRegistration: false });
    try {
      const response = await closed.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { handle: 'stranger', password: 'correct-horse' },
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await closed.close();
    }
  });
});
