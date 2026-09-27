import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { loadEnv, type Env } from './env.ts';
import { openDatabase } from './db.ts';
import { createRepo } from './repo.ts';
import { Rooms } from './rooms.ts';
import { RateLimiter } from './ratelimit.ts';
import type { AppContext } from './context.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerHouseholdRoutes } from './routes/household.ts';
import { registerFriendRoutes } from './routes/friends.ts';
import { registerFeedRoutes } from './routes/feed.ts';
import { registerPushRoutes } from './routes/push.ts';
import { registerHouseholdSocket } from './ws.ts';
import { configurePush, pushConfigured, runNotificationScan } from './notify.ts';

/** Body cap that a share card with an embedded image still fits inside. */
const BODY_LIMIT = 2_000_000;
const SWEEP_INTERVAL_MS = 10 * 60_000;
/** A reminder set for 19:00 should not arrive at 19:04. */
const NOTIFY_INTERVAL_MS = 60_000;

export interface App {
  app: FastifyInstance;
  ctx: AppContext;
  close(): Promise<void>;
}

export function buildApp(overrides: Partial<Env> = {}): App {
  const env = loadEnv(overrides);
  const db = openDatabase(env.dbPath);
  const ctx: AppContext = {
    env,
    repo: createRepo(db),
    rooms: new Rooms(),
    authLimiter: new RateLimiter(10, 10 * 60_000),
    codeLimiter: new RateLimiter(20, 10 * 60_000),
  };

  const app = Fastify({
    bodyLimit: BODY_LIMIT,
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL ?? 'info' },
    // Behind Caddy, so the client IP the rate limiter keys on has to come from
    // the proxy header rather than the socket.
    trustProxy: true,
  });

  // Hand-rolled CORS rather than a plugin: auth is a bearer token, never a
  // cookie, so there is no credentialed-origin subtlety to get wrong.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', env.corsOrigin);
    reply.header('access-control-allow-headers', 'authorization, content-type');
    reply.header('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    reply.header('access-control-max-age', '86400');
    if (request.method === 'OPTIONS') await reply.code(204).send();
  });

  app.register(websocket, { options: { maxPayload: BODY_LIMIT } });

  configurePush(ctx);

  app.get('/api/health', async () => ({
    ok: true,
    registration: env.allowRegistration,
    push: pushConfigured(ctx),
  }));

  app.register(async (instance) => {
    registerAuthRoutes(instance, ctx);
    registerHouseholdRoutes(instance, ctx);
    registerFriendRoutes(instance, ctx);
    registerFeedRoutes(instance, ctx);
    registerPushRoutes(instance, ctx);
    registerHouseholdSocket(instance, ctx);
  });

  const sweep = setInterval(() => {
    ctx.authLimiter.sweep();
    ctx.codeLimiter.sweep();
    ctx.repo.pruneExpiredCards();
  }, SWEEP_INTERVAL_MS);
  sweep.unref();

  // Tests drive the scan directly; a timer firing underneath them would make
  // their assertions depend on wall-clock luck.
  const notifier =
    process.env.NODE_ENV === 'test' || !pushConfigured(ctx)
      ? null
      : setInterval(() => {
          runNotificationScan(ctx).catch((error) => app.log.error(error, 'notification scan failed'));
        }, NOTIFY_INTERVAL_MS);
  notifier?.unref();

  return {
    app,
    ctx,
    async close() {
      clearInterval(sweep);
      if (notifier) clearInterval(notifier);
      await app.close();
      db.close();
    },
  };
}
