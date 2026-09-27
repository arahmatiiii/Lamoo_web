import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { publicUser, requireUser, bearerToken } from '../auth.ts';
import { handleProblem, hashPassword, passwordProblem, verifyPassword } from '../passwords.ts';

interface Credentials {
  handle?: unknown;
  password?: unknown;
  displayName?: unknown;
}

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/auth/register', async (request, reply) => {
    if (!ctx.env.allowRegistration) {
      return reply.code(403).send({ error: 'closed', message: 'ثبت‌نام روی این سرور بسته است' });
    }
    if (!ctx.authLimiter.take(request.ip)) {
      return reply.code(429).send({ error: 'slow_down', message: 'کمی بعد دوباره تلاش کن' });
    }

    const body = (request.body ?? {}) as Credentials;
    const handle = typeof body.handle === 'string' ? body.handle : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName : handle;

    const problem = handleProblem(handle) ?? passwordProblem(password);
    if (problem) return reply.code(400).send({ error: 'invalid', message: problem });

    if (ctx.repo.userByHandle(handle)) {
      return reply.code(409).send({ error: 'taken', message: 'این نام کاربری گرفته شده' });
    }

    const user = ctx.repo.createUser(handle, await hashPassword(password), displayName);
    ctx.authLimiter.clear(request.ip);
    return reply.code(201).send({ token: ctx.repo.issueToken(user.id), user: publicUser(user) });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const body = (request.body ?? {}) as Credentials;
    const handle = typeof body.handle === 'string' ? body.handle : '';
    const password = typeof body.password === 'string' ? body.password : '';

    // Keyed by IP *and* account, so one attacker cannot lock everyone out and
    // cannot spread guesses for one account across the whole window either.
    const key = `${request.ip}|${handle.toLowerCase()}`;
    if (!ctx.authLimiter.take(key)) {
      return reply.code(429).send({ error: 'slow_down', message: 'تلاش‌های زیاد — کمی بعد امتحان کن' });
    }

    const user = ctx.repo.userByHandle(handle);
    const ok = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !ok) {
      return reply.code(401).send({ error: 'bad_credentials', message: 'نام کاربری یا رمز درست نیست' });
    }

    ctx.authLimiter.clear(key);
    return reply.send({ token: ctx.repo.issueToken(user.id), user: publicUser(user) });
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const token = bearerToken(request);
    if (token) ctx.repo.revokeToken(token);
    return reply.send({ ok: true });
  });

  app.get('/api/me', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;

    const household = user.household_id ? ctx.repo.householdById(user.household_id) : null;
    return reply.send({
      user: publicUser(user),
      household: household && {
        id: household.id,
        name: household.name,
        inviteCode: household.invite_code,
        cursor: household.seq,
        members: ctx.repo.members(household.id).map((m) => ({
          id: m.id,
          handle: m.handle,
          displayName: m.display_name,
        })),
      },
    });
  });
}
