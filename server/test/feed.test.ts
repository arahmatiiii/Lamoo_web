import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.ts';
import { decodeDataUrl } from '../src/routes/feed.ts';
import { auth, befriend, register, testApp, type Account } from './helpers.ts';

let app: App;
let ali: Account;
let sara: Account;

beforeEach(async () => {
  app = testApp();
  ali = await register(app, 'ali');
  sara = await register(app, 'sara');
});
afterEach(() => app.close());

const RECIPE = {
  title: 'قرمه‌سبزی',
  ingredients: [{ name: 'لوبیا قرمز', available: true }],
  steps: ['سبزی را سرخ کن', 'دو ساعت بگذار بجوشد'],
};

/** A one-pixel PNG, as a data URL — the same shape the share card produces. */
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

const postCard = (account: Account, over: Record<string, unknown> = {}) =>
  app.app.inject({
    method: 'POST',
    url: '/api/cards',
    headers: auth(account),
    payload: { title: 'شام امشب', note: 'حتماً امتحان کن', recipe: RECIPE, ...over },
  });

const feed = (account: Account) =>
  app.app.inject({ method: 'GET', url: '/api/feed', headers: auth(account) });

describe('decodeDataUrl', () => {
  it('reads a png data URL', () => {
    const decoded = decodeDataUrl(PNG, 100_000);
    expect(typeof decoded).not.toBe('string');
    expect((decoded as { mime: string }).mime).toBe('image/png');
  });

  it('turns down a format it will not serve', () => {
    expect(decodeDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 100_000)).toBeTypeOf('string');
    expect(decodeDataUrl('data:text/html;base64,PGI+', 100_000)).toBeTypeOf('string');
  });

  it('turns down anything that is not a data URL', () => {
    expect(decodeDataUrl('https://example.com/a.png', 100_000)).toBeTypeOf('string');
  });

  it('enforces the size cap', () => {
    expect(decodeDataUrl(PNG, 10)).toBeTypeOf('string');
  });
});

describe('share cards', () => {
  it('needs a title and a recipe', async () => {
    expect((await postCard(ali, { title: '' })).statusCode).toBe(400);
    expect((await postCard(ali, { recipe: undefined })).statusCode).toBe(400);
  });

  it('posts a card and lists it under your own', async () => {
    expect((await postCard(ali)).statusCode).toBe(201);
    const mine = await app.app.inject({
      method: 'GET',
      url: '/api/cards/mine',
      headers: auth(ali),
    });
    expect(mine.json().cards).toHaveLength(1);
    expect(mine.json().cards[0].title).toBe('شام امشب');
  });

  it('shows a friend’s card in your feed and not a stranger’s', async () => {
    const reza = await register(app, 'reza');
    await befriend(app, ali, sara);
    await postCard(sara);
    await postCard(reza);

    const cards = (await feed(ali)).json().cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].author.handle).toBe('sara');
  });

  it('does not show a card while the request is still pending', async () => {
    await app.app.inject({
      method: 'POST',
      url: '/api/friends/request',
      headers: auth(ali),
      payload: { code: sara.friendCode },
    });
    await postCard(sara);
    expect((await feed(ali)).json().cards).toHaveLength(0);
  });

  it('drops out of the feed the moment you unfriend', async () => {
    const id = await befriend(app, ali, sara);
    await postCard(sara);
    expect((await feed(ali)).json().cards).toHaveLength(1);

    await app.app.inject({ method: 'DELETE', url: `/api/friends/${id}`, headers: auth(ali) });
    expect((await feed(ali)).json().cards).toHaveLength(0);
  });

  it('keeps the feed summary light and holds the recipe back until asked', async () => {
    await befriend(app, ali, sara);
    await postCard(sara);
    const summary = (await feed(ali)).json().cards[0];
    expect(summary.recipe).toBeUndefined();

    const full = await app.app.inject({
      method: 'GET',
      url: `/api/cards/${summary.id}`,
      headers: auth(ali),
    });
    // The whole point of the friends feed: the recipe arrives with every
    // ingredient and step, ready to drop into your own book.
    expect(full.json().card.recipe).toEqual(RECIPE);
  });

  it('hides a card from someone who is not a friend, even with the id', async () => {
    const reza = await register(app, 'reza');
    const posted = await postCard(sara);
    const id = posted.json().card.id;
    const peek = await app.app.inject({
      method: 'GET',
      url: `/api/cards/${id}`,
      headers: auth(reza),
    });
    expect(peek.statusCode).toBe(404);
  });

  it('returns the recipe when a friend saves it', async () => {
    await befriend(app, ali, sara);
    const id = (await postCard(sara)).json().card.id;
    const saved = await app.app.inject({
      method: 'POST',
      url: `/api/cards/${id}/save`,
      headers: auth(ali),
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().recipe).toEqual(RECIPE);
    expect(saved.json().saves).toBe(1);
  });

  it('counts a save once however many times it is tapped', async () => {
    await befriend(app, ali, sara);
    const id = (await postCard(sara)).json().card.id;
    const save = () =>
      app.app.inject({ method: 'POST', url: `/api/cards/${id}/save`, headers: auth(ali) });
    await save();
    expect((await save()).json().saves).toBe(1);
  });

  it('remembers which cards you have already read', async () => {
    await befriend(app, ali, sara);
    const id = (await postCard(sara)).json().card.id;
    expect((await feed(ali)).json().cards[0].seen).toBe(false);

    await app.app.inject({ method: 'POST', url: `/api/cards/${id}/seen`, headers: auth(ali) });
    expect((await feed(ali)).json().cards[0].seen).toBe(true);
  });

  it('serves an attached image and keeps its type', async () => {
    const posted = await postCard(ali, { image: PNG });
    const url = posted.json().card.imageUrl;
    expect(url).toMatch(/^\/media\/[0-9a-f]{32}$/);

    const image = await app.app.inject({ method: 'GET', url });
    expect(image.statusCode).toBe(200);
    expect(image.headers['content-type']).toBe('image/png');
  });

  it('turns down an image bigger than the cap', async () => {
    const small = testApp({ maxImageBytes: 10 });
    try {
      const account = await register(small, 'ali');
      const response = await small.app.inject({
        method: 'POST',
        url: '/api/cards',
        headers: auth(account),
        payload: { title: 'x', recipe: RECIPE, image: PNG },
      });
      expect(response.statusCode).toBe(413);
    } finally {
      await small.close();
    }
  });

  it('turns down a recipe too big to be one', async () => {
    const response = await postCard(ali, { recipe: { steps: ['x'.repeat(40_000)] } });
    expect(response.statusCode).toBe(413);
  });

  it('lets a card expire out of the feed', async () => {
    await befriend(app, ali, sara);
    // Posted with an hour to live, then the clock is moved past it.
    const id = (await postCard(sara, { ttlHours: 1 })).json().card.id;
    app.ctx.repo.db.prepare('UPDATE cards SET expires_at = ? WHERE id = ?').run(Date.now() - 1, id);

    expect((await feed(ali)).json().cards).toHaveLength(0);
    const gone = await app.app.inject({
      method: 'GET',
      url: `/api/cards/${id}`,
      headers: auth(ali),
    });
    expect(gone.statusCode).toBe(404);
  });

  it('needs a login to post or read', async () => {
    expect((await app.app.inject({ method: 'GET', url: '/api/feed' })).statusCode).toBe(401);
    expect(
      (await app.app.inject({ method: 'POST', url: '/api/cards', payload: { title: 'x' } }))
        .statusCode
    ).toBe(401);
  });
});
