import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { requireUser } from '../auth.ts';
import { pushConfigured } from '../notify.ts';

export function registerPushRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * The public half of the VAPID pair. Null rather than an error when the server
   * has no keys, so the app can say "notifications are not set up on this
   * server" instead of looking broken.
   */
  app.get('/api/push/key', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;
    return reply.send({ publicKey: pushConfigured(ctx) ? ctx.env.vapidPublicKey : null });
  });

  app.post('/api/push/subscribe', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;

    const body = (request.body ?? {}) as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : '';
    const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : '';

    if (!/^https:\/\/\S+$/.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth) {
      return reply.code(400).send({ error: 'invalid', message: 'اشتراک نوتیفیکیشن معتبر نیست' });
    }

    ctx.repo.savePushSub(user.id, { endpoint, p256dh, auth });
    return reply.send({ ok: true });
  });

  app.delete('/api/push/subscribe', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;

    const endpoint = (request.body as { endpoint?: unknown } | undefined)?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      return reply.code(400).send({ error: 'invalid', message: 'endpoint لازم است' });
    }
    // Only this user's own device: an endpoint is a bearer capability, and one
    // account must not be able to silence another's phone.
    if (ctx.repo.pushSubs(user.id).some((sub) => sub.endpoint === endpoint)) {
      ctx.repo.dropPushSub(endpoint);
    }
    return reply.send({ ok: true });
  });
}
