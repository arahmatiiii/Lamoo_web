import webpush from 'web-push';
import type { AppContext } from './context.ts';

/**
 * The one thing a client-only app can never do: tell you about a reminder while
 * Lamoo is closed. A scan runs on a timer, works out what is due across every
 * household, and pushes it to each member's devices.
 */

export interface Notification {
  title: string;
  body: string;
  /** Collapses repeats in the notification tray, and dedupes in `push_log`. */
  tag: string;
}

/**
 * A reminder that came due while the server was down is worth sending; one from
 * last month is not. Anything older than this window is treated as missed.
 */
const LATE_GRACE_MS = 12 * 3_600_000;
const LOG_KEEP_MS = 30 * 24 * 3_600_000;

export function pushConfigured(ctx: AppContext): boolean {
  return Boolean(ctx.env.vapidPublicKey && ctx.env.vapidPrivateKey);
}

export function configurePush(ctx: AppContext): void {
  if (!pushConfigured(ctx)) return;
  webpush.setVapidDetails(ctx.env.vapidSubject, ctx.env.vapidPublicKey, ctx.env.vapidPrivateKey);
}

/** Whole days from today to an ISO date, negative once it is past. */
export function daysUntil(isoDate: string, now = new Date()): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) return undefined;
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

interface ReminderValue {
  text?: unknown;
  completed?: unknown;
  dueAt?: unknown;
}

interface PantryValue {
  name?: unknown;
  available?: unknown;
  expiryDate?: unknown;
}

/**
 * What every member of this household should be told about right now.
 *
 * Pure, so the interesting decisions — is it due, is it too late, how close to
 * expiry counts — are testable without a push service anywhere in sight.
 */
export function dueNotifications(ctx: AppContext, householdId: string, now = Date.now()): Notification[] {
  const out: Notification[] = [];

  for (const record of ctx.repo.recordsOfKind(householdId, 'reminder')) {
    const value = (record.value ?? {}) as ReminderValue;
    if (value.completed === true) continue;
    if (typeof value.dueAt !== 'number' || !Number.isFinite(value.dueAt)) continue;
    if (value.dueAt > now || value.dueAt < now - LATE_GRACE_MS) continue;
    const text = typeof value.text === 'string' && value.text.trim() ? value.text.trim() : 'یادآور';
    out.push({ title: 'یادآور لامو', body: text, tag: `reminder:${record.id}:${value.dueAt}` });
  }

  for (const record of ctx.repo.recordsOfKind(householdId, 'pantry')) {
    const value = (record.value ?? {}) as PantryValue;
    if (value.available === false) continue;
    if (typeof value.expiryDate !== 'string') continue;
    const days = daysUntil(value.expiryDate, new Date(now));
    if (days === undefined || days < 0 || days > ctx.env.expiryWarningDays) continue;
    const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'یک قلم';
    out.push({
      title: days === 0 ? `${name} امروز تمام می‌شود` : `${name} دارد تمام می‌شود`,
      body: days === 0 ? 'امروز مصرفش کن یا نجاتش بده.' : `${days} روز مانده — یک دستور با آن پیدا کن.`,
      // Keyed by date so tomorrow's warning is a new notification, not a repeat.
      tag: `expiry:${record.id}:${value.expiryDate}`,
    });
  }

  return out;
}

/** Sends one notification to every device a user has registered. */
async function sendToUser(ctx: AppContext, userId: string, notification: Notification): Promise<void> {
  const subs = ctx.repo.pushSubs(userId);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(notification)
        );
      } catch (error) {
        // 404/410 mean the browser threw the subscription away — so should we,
        // or the scan retries a dead endpoint for ever.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) ctx.repo.dropPushSub(sub.endpoint);
      }
    })
  );
}

/**
 * One pass over every household. Returns how many notifications were sent, which
 * is what the tests assert on.
 */
export async function runNotificationScan(ctx: AppContext, now = Date.now()): Promise<number> {
  if (!pushConfigured(ctx)) return 0;

  let sent = 0;
  for (const householdId of ctx.repo.householdIds()) {
    const notifications = dueNotifications(ctx, householdId, now);
    if (notifications.length === 0) continue;

    for (const member of ctx.repo.members(householdId)) {
      for (const notification of notifications) {
        // Claim first: if two scans overlap, only one of them sends.
        if (!ctx.repo.claimPush(member.id, notification.tag, now)) continue;
        await sendToUser(ctx, member.id, notification);
        sent += 1;
      }
    }
  }

  ctx.repo.prunePushLog(now - LOG_KEEP_MS);
  return sent;
}
