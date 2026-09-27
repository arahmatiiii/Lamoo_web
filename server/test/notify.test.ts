import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../src/app.ts';
import { daysUntil, dueNotifications, pushConfigured, runNotificationScan } from '../src/notify.ts';
import { auth, createHousehold, joinHousehold, push, register, testApp, type Account } from './helpers.ts';

const VAPID = {
  // A throwaway pair, generated for this test file only.
  vapidPublicKey:
    'BLcaGRi2VFE0h1Z2h6wwuT3r0aLKXqDvJ2RkYZvQmdUHT9lhAs0sOcLOChKgMuCRVXAHxvwrIsftbPf6Su4fGNU',
  vapidPrivateKey: 'wJ8lMfIYH0nWmKlTQ0gB6ZmXEhRgq3sCKGnZqm0hRTw',
};

const ISO = (offsetDays: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

let app: App;
let ali: Account;
let sara: Account;

beforeEach(async () => {
  app = testApp(VAPID);
  ali = await register(app, 'ali');
  sara = await register(app, 'sara');
  const code = await createHousehold(app, ali);
  await joinHousehold(app, sara, code);
});
afterEach(() => app.close());

const householdId = () => app.ctx.repo.userById(ali.id)?.household_id as string;

const subscribe = (account: Account, endpoint: string) =>
  app.app.inject({
    method: 'POST',
    url: '/api/push/subscribe',
    headers: auth(account),
    payload: { endpoint, keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } },
  });

describe('daysUntil', () => {
  it('counts whole days either side of today', () => {
    const now = new Date(2026, 8, 27, 23, 30);
    expect(daysUntil('2026-09-27', now)).toBe(0);
    expect(daysUntil('2026-09-29', now)).toBe(2);
    expect(daysUntil('2026-09-26', now)).toBe(-1);
  });

  it('ignores the time of day, so 23:59 is still today', () => {
    expect(daysUntil('2026-09-27', new Date(2026, 8, 27, 0, 1))).toBe(0);
    expect(daysUntil('2026-09-27', new Date(2026, 8, 27, 23, 59))).toBe(0);
  });

  it('refuses a date it cannot read', () => {
    expect(daysUntil('tomorrow')).toBeUndefined();
    expect(daysUntil('')).toBeUndefined();
  });
});

describe('dueNotifications', () => {
  it('is empty with nothing stored', () => {
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('picks up a reminder that has come due', async () => {
    const dueAt = Date.now() - 60_000;
    await push(app, ali, [
      { kind: 'reminder', id: 'r1', updatedAt: 1, value: { text: 'ماست بگیر', completed: false, dueAt } },
    ]);
    const due = dueNotifications(app.ctx, householdId());
    expect(due).toHaveLength(1);
    expect(due[0].body).toBe('ماست بگیر');
  });

  it('leaves a reminder alone until its time', async () => {
    await push(app, ali, [
      {
        kind: 'reminder',
        id: 'r1',
        updatedAt: 1,
        value: { text: 'فردا', completed: false, dueAt: Date.now() + 3_600_000 },
      },
    ]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('skips a reminder already ticked off', async () => {
    await push(app, ali, [
      {
        kind: 'reminder',
        id: 'r1',
        updatedAt: 1,
        value: { text: 'انجام شده', completed: true, dueAt: Date.now() - 60_000 },
      },
    ]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('does not dig up a reminder from last month after a restart', async () => {
    await push(app, ali, [
      {
        kind: 'reminder',
        id: 'r1',
        updatedAt: 1,
        value: { text: 'خیلی قدیمی', completed: false, dueAt: Date.now() - 30 * 86_400_000 },
      },
    ]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('ignores a reminder with no absolute time, rather than guessing', async () => {
    await push(app, ali, [
      { kind: 'reminder', id: 'r1', updatedAt: 1, value: { text: 'شنبه ۱۹:۰۰', completed: false } },
    ]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('warns about an item close to expiry', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 1, value: { name: 'شیر', available: true, expiryDate: ISO(1) } },
    ]);
    const due = dueNotifications(app.ctx, householdId());
    expect(due).toHaveLength(1);
    expect(due[0].title).toContain('شیر');
  });

  it('says "today" on the last day', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 1, value: { name: 'ماست', available: true, expiryDate: ISO(0) } },
    ]);
    expect(dueNotifications(app.ctx, householdId())[0].title).toContain('امروز');
  });

  it('stays quiet about an item that is still fine, or already used up', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 1, value: { name: 'برنج', available: true, expiryDate: ISO(30) } },
      { kind: 'pantry', id: 'p2', updatedAt: 1, value: { name: 'شیر', available: false, expiryDate: ISO(1) } },
      { kind: 'pantry', id: 'p3', updatedAt: 1, value: { name: 'نان', available: true } },
    ]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('forgets a deleted row', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 1, value: { name: 'شیر', available: true, expiryDate: ISO(0) } },
    ]);
    await push(app, ali, [{ kind: 'pantry', id: 'p1', updatedAt: 2, deleted: true }]);
    expect(dueNotifications(app.ctx, householdId())).toEqual([]);
  });

  it('tags tomorrow’s warning differently from today’s', async () => {
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 1, value: { name: 'شیر', available: true, expiryDate: ISO(0) } },
    ]);
    const today = dueNotifications(app.ctx, householdId())[0].tag;
    await push(app, ali, [
      { kind: 'pantry', id: 'p1', updatedAt: 2, value: { name: 'شیر', available: true, expiryDate: ISO(1) } },
    ]);
    expect(dueNotifications(app.ctx, householdId())[0].tag).not.toBe(today);
  });
});

describe('subscriptions', () => {
  it('hands out the public key when configured, and null when not', async () => {
    const key = await app.app.inject({ method: 'GET', url: '/api/push/key', headers: auth(ali) });
    expect(key.json().publicKey).toBe(VAPID.vapidPublicKey);

    const bare = testApp();
    try {
      const account = await register(bare, 'ali');
      const none = await bare.app.inject({ method: 'GET', url: '/api/push/key', headers: auth(account) });
      expect(none.json().publicKey).toBeNull();
      expect(pushConfigured(bare.ctx)).toBe(false);
    } finally {
      await bare.close();
    }
  });

  it('stores a subscription and replaces it on a repeat', async () => {
    await subscribe(ali, 'https://push.example.com/a');
    await subscribe(ali, 'https://push.example.com/a');
    expect(app.ctx.repo.pushSubs(ali.id)).toHaveLength(1);
  });

  it('keeps one account’s devices separate from another’s', async () => {
    await subscribe(ali, 'https://push.example.com/a');
    await subscribe(sara, 'https://push.example.com/b');
    expect(app.ctx.repo.pushSubs(ali.id)).toHaveLength(1);
    expect(app.ctx.repo.pushSubs(sara.id)).toHaveLength(1);
  });

  it('rejects a subscription that is not a real endpoint', async () => {
    const bad = await app.app.inject({
      method: 'POST',
      url: '/api/push/subscribe',
      headers: auth(ali),
      payload: { endpoint: 'javascript:alert(1)', keys: { p256dh: 'x', auth: 'y' } },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('will not let one account unsubscribe another’s device', async () => {
    await subscribe(sara, 'https://push.example.com/sara');
    await app.app.inject({
      method: 'DELETE',
      url: '/api/push/subscribe',
      headers: auth(ali),
      payload: { endpoint: 'https://push.example.com/sara' },
    });
    expect(app.ctx.repo.pushSubs(sara.id)).toHaveLength(1);
  });

  it('removes your own device on request', async () => {
    await subscribe(ali, 'https://push.example.com/a');
    await app.app.inject({
      method: 'DELETE',
      url: '/api/push/subscribe',
      headers: auth(ali),
      payload: { endpoint: 'https://push.example.com/a' },
    });
    expect(app.ctx.repo.pushSubs(ali.id)).toEqual([]);
  });

  it('needs a login', async () => {
    expect((await app.app.inject({ method: 'GET', url: '/api/push/key' })).statusCode).toBe(401);
  });
});

describe('runNotificationScan', () => {
  beforeEach(async () => {
    await subscribe(ali, 'https://push.example.com/ali');
    await subscribe(sara, 'https://push.example.com/sara');
    await push(app, ali, [
      {
        kind: 'reminder',
        id: 'r1',
        updatedAt: 1,
        value: { text: 'ماست بگیر', completed: false, dueAt: Date.now() - 60_000 },
      },
    ]);
  });

  it('tells everyone in the household, once each', async () => {
    const sent = await runNotificationScan(app.ctx);
    expect(sent).toBe(2);
  });

  it('does not send the same thing twice, however often it scans', async () => {
    await runNotificationScan(app.ctx);
    expect(await runNotificationScan(app.ctx)).toBe(0);
  });

  it('sends nothing when the server has no VAPID keys', async () => {
    const bare = testApp();
    try {
      const account = await register(bare, 'ali');
      await createHousehold(bare, account);
      expect(await runNotificationScan(bare.ctx)).toBe(0);
    } finally {
      await bare.close();
    }
  });

  it('drops a subscription the push service says is gone', async () => {
    // web-push rejects a 410 as an error carrying the status code.
    const webpush = await import('web-push');
    const spy = vi
      .spyOn(webpush.default, 'sendNotification')
      .mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    try {
      await runNotificationScan(app.ctx);
      expect(app.ctx.repo.pushSubs(ali.id)).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps a subscription when the failure was only temporary', async () => {
    const webpush = await import('web-push');
    const spy = vi
      .spyOn(webpush.default, 'sendNotification')
      .mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    try {
      await runNotificationScan(app.ctx);
      expect(app.ctx.repo.pushSubs(ali.id)).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
