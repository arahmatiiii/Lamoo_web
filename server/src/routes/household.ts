import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { requireHousehold, requireUser } from '../auth.ts';
import { normaliseCode } from '../ids.ts';
import { parseRecord, type SyncRecord } from '../records.ts';

const MAX_PUSH_ROWS = 500;

function householdView(ctx: AppContext, id: string) {
  const household = ctx.repo.householdById(id);
  if (!household) return null;
  return {
    id: household.id,
    name: household.name,
    inviteCode: household.invite_code,
    cursor: household.seq,
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
  app.post('/api/household', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;
    if (user.household_id) {
      return reply
        .code(409)
        .send({ error: 'already_joined', message: 'الان عضو یک آشپزخانهٔ مشترک هستی' });
    }
    const name = (request.body as { name?: unknown } | undefined)?.name;
    const household = ctx.repo.createHousehold(typeof name === 'string' ? name : '', user.id);
    return reply.code(201).send({ household: householdView(ctx, household.id) });
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

    // Anything this phone had on its own is pushed up after joining, exactly as
    // if it had been edited offline — last-write-wins means nothing is lost.
    ctx.repo.leaveHousehold(user);
    ctx.repo.setHousehold(user.id, household.id);
    ctx.codeLimiter.clear(request.ip);
    return reply.send({ household: householdView(ctx, household.id) });
  });

  app.post('/api/household/leave', async (request, reply) => {
    const user = await requireUser(ctx, request, reply);
    if (!user) return reply;
    ctx.repo.leaveHousehold(user);
    return reply.send({ ok: true });
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
