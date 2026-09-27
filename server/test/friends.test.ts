import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../src/app.ts';
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

const friends = (account: Account) =>
  app.app.inject({ method: 'GET', url: '/api/friends', headers: auth(account) });

const request = (from: Account, code: string) =>
  app.app.inject({
    method: 'POST',
    url: '/api/friends/request',
    headers: auth(from),
    payload: { code },
  });

describe('friend requests', () => {
  it('shows you your own code', async () => {
    expect((await friends(ali)).json().myCode).toBe(ali.friendCode);
  });

  it('stays pending until the other side accepts', async () => {
    const sent = await request(ali, sara.friendCode);
    expect(sent.statusCode).toBe(201);
    expect(sent.json().status).toBe('pending');

    expect((await friends(ali)).json().outgoing).toHaveLength(1);
    expect((await friends(ali)).json().friends).toHaveLength(0);
    expect((await friends(sara)).json().incoming).toHaveLength(1);
  });

  it('becomes mutual once accepted', async () => {
    await befriend(app, ali, sara);
    expect((await friends(ali)).json().friends[0].handle).toBe('sara');
    expect((await friends(sara)).json().friends[0].handle).toBe('ali');
  });

  it('reads a request back as acceptance', async () => {
    await request(ali, sara.friendCode);
    const back = await request(sara, ali.friendCode);
    expect(back.json().status).toBe('accepted');
    expect((await friends(ali)).json().friends).toHaveLength(1);
  });

  it('refuses a code nobody owns', async () => {
    expect((await request(ali, 'AAAAAAAA')).statusCode).toBe(404);
  });

  it('refuses your own code', async () => {
    expect((await request(ali, ali.friendCode)).statusCode).toBe(400);
  });

  it('does not duplicate a request that already exists', async () => {
    await request(ali, sara.friendCode);
    await request(ali, sara.friendCode);
    expect((await friends(ali)).json().outgoing).toHaveLength(1);
  });

  it('only lets the person who was asked accept', async () => {
    const sent = await request(ali, sara.friendCode);
    const id = sent.json().friendship.friendshipId;
    const selfAccept = await app.app.inject({
      method: 'POST',
      url: `/api/friends/${id}/accept`,
      headers: auth(ali),
    });
    expect(selfAccept.statusCode).toBe(404);
    expect((await friends(ali)).json().friends).toHaveLength(0);
  });

  it('hides other people’s friendships behind a 404', async () => {
    const reza = await register(app, 'reza');
    const sent = await request(ali, sara.friendCode);
    const id = sent.json().friendship.friendshipId;
    const meddle = await app.app.inject({
      method: 'DELETE',
      url: `/api/friends/${id}`,
      headers: auth(reza),
    });
    expect(meddle.statusCode).toBe(404);
  });

  it('lets either side unfriend', async () => {
    const id = await befriend(app, ali, sara);
    const removed = await app.app.inject({
      method: 'DELETE',
      url: `/api/friends/${id}`,
      headers: auth(sara),
    });
    expect(removed.statusCode).toBe(200);
    expect((await friends(ali)).json().friends).toHaveLength(0);
  });

  it('needs a login', async () => {
    expect((await app.app.inject({ method: 'GET', url: '/api/friends' })).statusCode).toBe(401);
  });
});
