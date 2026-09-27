import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.ts';
import { requireUser } from '../auth.ts';
import type { CardRow, UserRow } from '../repo.ts';

const ALLOWED_IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_RECIPE_JSON = 32_000;
const MAX_TITLE = 120;
const MAX_NOTE = 500;

interface DecodedImage {
  mime: string;
  bytes: Uint8Array;
}

/** Accepts exactly what the app's canvas share card produces: a data URL. */
export function decodeDataUrl(input: string, maxBytes: number): DecodedImage | string {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(input);
  if (!match) return 'فرمت تصویر شناخته نشد';
  const mime = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME.has(mime)) return 'فقط jpeg، png یا webp';
  const bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (bytes.length === 0) return 'تصویر خالی است';
  if (bytes.length > maxBytes) return 'تصویر بزرگ‌تر از حد مجاز است';
  return { mime, bytes: new Uint8Array(bytes) };
}

function cardSummary(ctx: AppContext, card: CardRow, author: UserRow, viewerId: string) {
  return {
    id: card.id,
    title: card.title,
    note: card.note,
    imageUrl: card.image_id ? `/media/${card.image_id}` : null,
    createdAt: card.created_at,
    expiresAt: card.expires_at,
    saves: ctx.repo.cardSaveCount(card.id),
    seen: ctx.repo.cardSeenBy(card.id, viewerId),
    author: { id: author.id, handle: author.handle, displayName: author.display_name },
  };
}

export function registerFeedRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/cards', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const body = (request.body ?? {}) as {
      title?: unknown;
      note?: unknown;
      recipe?: unknown;
      image?: unknown;
      ttlHours?: unknown;
    };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, MAX_TITLE) : '';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
    if (!title) return reply.code(400).send({ error: 'invalid', message: 'عنوان لازم است' });
    if (!body.recipe || typeof body.recipe !== 'object') {
      return reply.code(400).send({ error: 'invalid', message: 'دستور پخت لازم است' });
    }
    if (JSON.stringify(body.recipe).length > MAX_RECIPE_JSON) {
      return reply.code(413).send({ error: 'too_big', message: 'دستور پخت بیش از حد بزرگ است' });
    }

    let imageId: string | null = null;
    if (typeof body.image === 'string' && body.image.length > 0) {
      const decoded = decodeDataUrl(body.image, ctx.env.maxImageBytes);
      if (typeof decoded === 'string') {
        return reply.code(413).send({ error: 'bad_image', message: decoded });
      }
      imageId = ctx.repo.storeMedia(me.id, decoded.mime, decoded.bytes);
    }

    const ttlHours =
      typeof body.ttlHours === 'number' && body.ttlHours > 0 && body.ttlHours <= 24 * 30
        ? body.ttlHours
        : ctx.env.cardTtlHours;

    const card = ctx.repo.createCard({
      authorId: me.id,
      title,
      note,
      recipe: body.recipe,
      imageId,
      ttlMs: ttlHours * 3_600_000,
    });
    return reply.code(201).send({ card: cardSummary(ctx, card, me, me.id) });
  });

  app.get('/api/feed', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    ctx.repo.pruneExpiredCards();
    const cards = ctx.repo.feedFor(me.id).flatMap((card) => {
      const author = ctx.repo.userById(card.author_id);
      return author ? [cardSummary(ctx, card, author, me.id)] : [];
    });
    return reply.send({ cards });
  });

  app.get('/api/cards/mine', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;
    ctx.repo.pruneExpiredCards();
    const rows = ctx.repo.db
      .prepare('SELECT * FROM cards WHERE author_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(me.id) as unknown[];
    const cards = rows.map((row) => cardSummary(ctx, { ...(row as object) } as CardRow, me, me.id));
    return reply.send({ cards });
  });

  app.get<{ Params: { id: string } }>('/api/cards/:id', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const card = ctx.repo.cardById(request.params.id);
    if (!card || card.expires_at <= Date.now()) {
      return reply.code(404).send({ error: 'not_found', message: 'این کارت دیگر نیست' });
    }
    const author = ctx.repo.userById(card.author_id);
    const allowed =
      card.author_id === me.id || ctx.repo.acceptedFriendIds(me.id).includes(card.author_id);
    // 404 rather than 403: a card id should not confirm its own existence to a
    // stranger who guessed it.
    if (!author || !allowed) {
      return reply.code(404).send({ error: 'not_found', message: 'این کارت دیگر نیست' });
    }

    return reply.send({
      card: { ...cardSummary(ctx, card, author, me.id), recipe: JSON.parse(card.recipe_json) },
    });
  });

  app.post<{ Params: { id: string } }>('/api/cards/:id/seen', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;
    if (ctx.repo.cardById(request.params.id)) ctx.repo.markCardSeen(request.params.id, me.id);
    return reply.send({ ok: true });
  });

  app.post<{ Params: { id: string } }>('/api/cards/:id/save', async (request, reply) => {
    const me = await requireUser(ctx, request, reply);
    if (!me) return reply;

    const card = ctx.repo.cardById(request.params.id);
    const allowed =
      card &&
      (card.author_id === me.id || ctx.repo.acceptedFriendIds(me.id).includes(card.author_id));
    if (!card || !allowed) {
      return reply.code(404).send({ error: 'not_found', message: 'این کارت دیگر نیست' });
    }
    ctx.repo.markCardSaved(card.id, me.id);
    // The recipe comes back with the save so the client can write it straight
    // into the user's own book without a second round trip.
    return reply.send({ ok: true, recipe: JSON.parse(card.recipe_json), saves: ctx.repo.cardSaveCount(card.id) });
  });

  /**
   * Served without auth: an <img> tag cannot send a bearer token. The id is 128
   * random bits, so the URL is the capability — anyone a friend forwards it to
   * can see that one picture, and nothing else.
   */
  app.get<{ Params: { id: string } }>('/media/:id', async (request, reply) => {
    const media = ctx.repo.mediaById(request.params.id);
    if (!media) return reply.code(404).send({ error: 'not_found' });
    return reply
      .header('content-type', media.mime)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .send(Buffer.from(media.bytes));
  });
}
