import type { FastifyInstance } from 'fastify';
import type { AppContext } from './context.ts';
import { bearerToken } from './auth.ts';
import { collectRecords } from './routes/household.ts';

/** Close codes the client can tell apart from a network drop. */
const CLOSE_UNAUTHORIZED = 4401;
const CLOSE_NO_HOUSEHOLD = 4409;

/**
 * The live half of household sync. The wire format is the same three messages
 * the encrypted Cloudflare relay speaks (`pull` / `push` / `records`), so the
 * client's sync engine needs a different transport, not a different engine.
 */
export function registerHouseholdSocket(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/household/socket', { websocket: true }, (socket, request) => {
    const token = bearerToken(request);
    const user = token ? ctx.repo.userForToken(token) : null;
    if (!user) {
      socket.close(CLOSE_UNAUTHORIZED, 'unauthorized');
      return;
    }
    const householdId = user.household_id;
    if (!householdId) {
      socket.close(CLOSE_NO_HOUSEHOLD, 'no household');
      return;
    }

    ctx.rooms.join(householdId, socket);
    socket.send(JSON.stringify({ type: 'hello', cursor: ctx.repo.cursor(householdId) }));

    socket.on('message', (raw: unknown) => {
      let message: { type?: unknown; since?: unknown; records?: unknown };
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (message.type === 'pull') {
        const since = Number(message.since);
        const records = ctx.repo.recordsSince(
          householdId,
          Number.isFinite(since) && since > 0 ? Math.floor(since) : 0
        );
        socket.send(
          JSON.stringify({ type: 'records', records, cursor: ctx.repo.cursor(householdId) })
        );
        return;
      }

      if (message.type === 'push') {
        const { records } = collectRecords(message.records);
        const { stored, cursor } = ctx.repo.applyRecords(householdId, records);
        // Echoed to the sender too: that is how it learns the server's seq for
        // its own rows, and hears about it when the server's copy won.
        if (stored.length > 0) {
          ctx.rooms.broadcast(householdId, { type: 'records', records: stored, cursor });
        }
        socket.send(JSON.stringify({ type: 'ack', cursor }));
      }
    });

    socket.on('close', () => ctx.rooms.leave(householdId, socket));
    socket.on('error', () => ctx.rooms.leave(householdId, socket));
  });
}
