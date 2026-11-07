import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { requireHousehold, requireUser } from '../auth.ts';
import { normaliseCode } from '../ids.ts';
import { parseRecord, type SyncRecord } from '../records.ts';
import { MAX_HOUSEHOLD_MEMBERS } from '../repo.ts';

const MAX_PUSH_ROWS = 500;

export function householdView(ctx: AppContext, id: string) {
  const household = ctx.repo.householdById(id);
  if (!household) return null;
  return {
    id: household.id,
    name: household.name,
    inviteCode: household.invite_code,
    cursor: household.seq,
    maxMembers: MAX_HOUSEHOLD_MEMBERS,
    members: ctx.repo.members(household.id).map((m) => ({
      id: m.id,
      handle: m.handle,
      displayName: m.display_name,
    })),
  };
}

/** Shared by the HTTP route and the WebSocket handler. */
export function collectRecords(input: unknown): { records: SyncRecord[]; rejected: number } {
  if (!Array.isArray(input)) return { records: [], rejected: 0 };
  const records: SyncRecord[] = [];
  let rejected = 0;
  for (const raw of input.slice(0, MAX_PUSH_ROWS)) {
    const record = parseRecord(raw);
    if (record) records.push(record);
    else rejected += 1;
  }
  return { records, rejected };
}

export function registerHouseholdRoutes(app: FastifyInstance, ctx: AppContext): void {
  /**
   * My kitchen: the code to give away, who is in it, and how far its rows go.
   * Asking for it is also what creates a solo kitchen for a brand-new account.
   */
  app.get('/api/household', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;
    const household = ctx.repo.ensureHousehold(user);
    return reply.send({ household: householdView(ctx, household.id) });
  });

  app.post('/api/household/join', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;
    if (!ctx.codeLimiter.take(request.ip)) {
      return reply.code(429).send({ error: 'slow_down', message: 'تلاش‌های زیاد — کمی بعد امتحان کن' });
    }

    const raw = (request.body as { code?: unknown } | undefined)?.code;
    const code = normaliseCode(typeof raw === 'string' ? raw : '');
    const household = code ? ctx.repo.householdByInviteCode(code) : null;
    if (!household) {
      return reply.code(404).send({ error: 'no_such_code', message: 'این کد درست نیست' });
    }
    if (user.household_id === household.id) {
      return reply.send({ household: householdView(ctx, household.id) });
    }
    if (ctx.repo.members(household.id).length >= MAX_HOUSEHOLD_MEMBERS) {
      return reply
        .code(409)
        .send({ error: 'kitchen_full', message: 'این آشپزخانه پره — سقف دو نفر است' });
    }

    // Joining gives up whatever kitchen this account had on its own. Anything
    // it had stored there is pushed up again from the phone, exactly as if it
    // had been edited offline — last-write-wins means nothing is lost.
    ctx.repo.leaveHousehold(user);
    ctx.repo.setHousehold(user.id, household.id);
    ctx.codeLimiter.clear(request.ip);
    return reply.send({ household: householdView(ctx, household.id) });
  });

  /**
   * Leave the shared kitchen and get a fresh solo one in the same reply, so the
   * user is never left without a code to hand out.
   */
  app.post('/api/household/leave', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;

    ctx.repo.leaveHousehold(user);
    const fresh = ctx.repo.userById(user.id);
    const household = fresh ? ctx.repo.ensureHousehold(fresh) : null;
    return reply.send({ household: household && householdView(ctx, household.id) });
  });

  app.get('/api/household/members', async (request, reply) => {
    const found = await requireHousehold(ctx, request, reply);
    if (!found) return reply;
    return reply.send({ household: householdView(ctx, found.householdId) });
  });

  app.get('/api/household/records', async (request, reply) => {
    const found = await requireHousehold(ctx, request, reply);
    if (!found) return reply;

    const sinceRaw = (request.query as { since?: unknown }).since;
    const since = Number(sinceRaw);
    const records = ctx.repo.recordsSince(
      found.householdId,
      Number.isFinite(since) && since > 0 ? Math.floor(since) : 0
    );
    return reply.send({ records, cursor: ctx.repo.cursor(found.householdId) });
  });

  app.post('/api/household/records', async (request, reply) => {
    const found = await requireHousehold(ctx, request, reply);
    if (!found) return reply;

    const body = (request.body ?? {}) as { records?: unknown };
    const { records, rejected } = collectRecords(body.records);
    const { stored, cursor } = ctx.repo.applyRecords(found.householdId, records);

    // Everyone else in the household hears about it before the writer's own
    // reply lands, which is what makes two phones feel like one fridge.
    if (stored.length > 0) {
      ctx.rooms.broadcast(found.householdId, { type: 'records', records: stored });
    }
    return reply.send({ records: stored, cursor, rejected });
  });
}
