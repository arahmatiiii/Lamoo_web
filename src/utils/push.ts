import { fetchPushKey, subscribePush, unsubscribePush } from './serverApi';

/**
 * Web Push is the one thing the app cannot do on its own: a reminder that has to
 * arrive while Lamoo is closed has to be sent by something that is awake, and
 * that is the server.
 */

/** VAPID keys travel as URL-safe base64; `applicationServerKey` wants bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.trim().replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const raw = atob(withPadding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

/** Asks for permission, subscribes, and hands the subscription to the server. */
export async function enablePush(serverUrl: string, token: string): Promise<void> {
  if (!pushSupported()) {
    throw new Error('این مرورگر نوتیفیکیشن پوش ندارد — روی iOS باید اپ را به هوم‌اسکرین اضافه کنی');
  }

  const { publicKey } = await fetchPushKey(serverUrl, token);
  if (!publicKey) {
    throw new Error('سرور کلید پوش ندارد — VAPID را در فایل .env سرور تنظیم کن');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('اجازهٔ نوتیفیکیشن داده نشد');

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  // A subscription made against a different VAPID key is silently useless, so
  // drop it rather than layering a new one on top.
  if (existing) await existing.unsubscribe().catch(() => undefined);

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) throw new Error('مرورگر کلید اشتراک نداد');
  await subscribePush(serverUrl, token, {
    endpoint: subscription.endpoint,
    keys: { p256dh: keys.p256dh, auth: keys.auth },
  });
}

/** Unsubscribes locally and tells the server to stop sending. */
export async function disablePush(serverUrl: string, token: string): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await unsubscribePush(serverUrl, token, subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}
