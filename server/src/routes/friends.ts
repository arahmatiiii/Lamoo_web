import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { requireUser } from '../auth.ts';
import { normaliseCode } from '../ids.ts';
import type { FriendshipRow, UserRow } from '../repo.ts';

/**
 * A friend sees your share cards, so unlike the household invite code a friend
 * code grants nothing by itself — it only lets someone ask, and the owner
 * decides. That is the whole reason the two codes are different lengths.
 */
function friendView(user: UserRow, friendship: FriendshipRow) {
  return {
    friendshipId: friendship.id,
    id: user.id,
    handle: user.handle,
    displayName: user.display_name,
    since: friendship.created_at,
  };
}

export function registerFriendRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/friends', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const friends: ReturnType<typeof friendView>[] = [];
    const incoming: ReturnType<typeof friendView>[] = [];
    const outgoing: ReturnType<typeof friendView>[] = [];

    for (const friendship of ctx.repo.friendshipsFor(me.id)) {
      const otherId =
        friendship.requester_id === me.id ? friendship.addressee_id : friendship.requester_id;
      const other = ctx.repo.userById(otherId);
      if (!other) continue;
      const view = friendView(other, friendship);
      if (friendship.status === 'accepted') friends.push(view);
      else if (friendship.addressee_id === me.id) incoming.push(view);
      else outgoing.push(view);
    }

    return reply.send({ friends, incoming, outgoing, myCode: me.friend_code });
  });

  app.post('/api/friends/request', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;
    if (!ctx.codeLimiter.take(request.ip)) {
      return reply.code(429).send({ error: 'slow_down', message: 'تلاش‌های زیاد — کمی بعد امتحان کن' });
    }

    const raw = (request.body as { code?: unknown } | undefined)?.code;
    const code = normaliseCode(typeof raw === 'string' ? raw : '');
    const other = code ? ctx.repo.userByFriendCode(code) : null;
    if (!other) return reply.code(404).send({ error: 'no_such_code', message: 'این کد پیدا نشد' });
    if (other.id === me.id) {
      return reply.code(400).send({ error: 'self', message: 'این کد خودته' });
    }

    const existing = ctx.repo.friendshipBetween(me.id, other.id);
    if (existing) {
      // They asked first and we are asking back: read that as acceptance
      // rather than making them tap a second button.
      if (existing.status === 'pending' && existing.addressee_id === me.id) {
        ctx.repo.acceptFriendship(existing.id);
      }
      const fresh = ctx.repo.friendshipById(existing.id);
      ctx.codeLimiter.clear(request.ip);
      return reply.send({ friendship: fresh && friendView(other, fresh), status: fresh?.status });
    }

    const friendship = ctx.repo.requestFriendship(me.id, other.id);
    ctx.codeLimiter.clear(request.ip);
    return reply.code(201).send({ friendship: friendView(other, friendship), status: 'pending' });
  });

  app.post<{ Params: { id: string } }>('/api/friends/:id/accept', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const friendship = ctx.repo.friendshipById(request.params.id);
    // Only the person who was asked can accept, and 404 rather than 403 so a
    // stranger cannot probe which friendship ids exist.
    if (!friendship || friendship.addressee_id !== me.id) {
      return reply.code(404).send({ error: 'not_found', message: 'درخواستی پیدا نشد' });
    }
    ctx.repo.acceptFriendship(friendship.id);
    const other = ctx.repo.userById(friendship.requester_id);
    const fresh = ctx.repo.friendshipById(friendship.id);
    return reply.send({ friendship: other && fresh ? friendView(other, fresh) : null });
  });

  app.delete<{ Params: { id: string } }>('/api/friends/:id', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const friendship = ctx.repo.friendshipById(request.params.id);
    if (!friendship || (friendship.requester_id !== me.id && friendship.addressee_id !== me.id)) {
      return reply.code(404).send({ error: 'not_found', message: 'پیدا نشد' });
    }
    ctx.repo.removeFriendship(friendship.id);
    return reply.send({ ok: true });
  });
}
