import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppContext } from './context.ts';
import type { UserRow } from './repo.ts';

/** `Authorization: Bearer <token>`, or `?token=` for the WebSocket handshake. */
export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim() || null;
  }
  const query = request.query as Record<string, unknown> | undefined;
  const fromQuery = query?.token;
  return typeof fromQuery === 'string' && fromQuery.length > 0 ? fromQuery : null;
}

/** Replies 401 and returns null when there is no valid token. */
export async function requireUser(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<UserRow | null> {
  const token = bearerToken(request);
  const user = token ? ctx.repo.userForToken(token) : null;
  if (!user) {
    await reply.code(401).send({ error: 'unauthorized', message: 'باید وارد شوی' });
    return null;
  }
  return user;
}

/** Like `requireUser`, and also insists the account is in a household. */
export async function requireHousehold(
  ctx: AppContext,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ user: UserRow; householdId: string } | null> {
  const user = await requireUser(ctx, request, reply);
  if (!user) return null;
  if (!user.household_id) {
    await reply
      .code(409)
      .send({ error: 'no_household', message: 'اول یک آشپزخانهٔ مشترک بساز یا به یکی وصل شو' });
    return null;
  }
  return { user, householdId: user.household_id };
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    handle: user.handle,
    displayName: user.display_name,
    friendCode: user.friend_code,
    householdId: user.household_id,
  };
}
