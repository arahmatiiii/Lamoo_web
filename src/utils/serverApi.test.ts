import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normaliseServerUrl,
  request,
  serverAssetUrl,
  serverSocketUrl,
  signIn,
} from './serverApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stands in for fetch, recording what it was called with. */
function stubFetch(response: { status?: number; body?: unknown } | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (response instanceof Error) throw response;
      const status = response.status ?? 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => (response.body === undefined ? '' : JSON.stringify(response.body)),
      } as Response;
    })
  );
  return calls;
}

describe('normaliseServerUrl', () => {
  it('assumes https when the scheme is missing', () => {
    expect(normaliseServerUrl('lamoo.example.com')).toBe('https://lamoo.example.com');
  });

  it('keeps an explicit scheme, including http for a local run', () => {
    expect(normaliseServerUrl('http://localhost:8787')).toBe('http://localhost:8787');
  });

  it('trims whitespace and trailing slashes, which is how people paste', () => {
    expect(normaliseServerUrl('  https://a.com///  ')).toBe('https://a.com');
  });

  it('stays empty when nothing was entered', () => {
    expect(normaliseServerUrl('   ')).toBe('');
  });
});

describe('serverSocketUrl', () => {
  it('upgrades https to wss and carries the token', () => {
    expect(serverSocketUrl('https://a.com', 'tok')).toBe(
      'wss://a.com/api/household/socket?token=tok'
    );
  });

  it('keeps plain ws for a local http server', () => {
    expect(serverSocketUrl('http://localhost:8787', 'tok')).toBe(
      'ws://localhost:8787/api/household/socket?token=tok'
    );
  });

  it('escapes a token that would otherwise break the query string', () => {
    expect(serverSocketUrl('https://a.com', 'a b&c')).toContain('token=a%20b%26c');
  });
});

describe('serverAssetUrl', () => {
  it('makes a server-relative path absolute', () => {
    expect(serverAssetUrl('https://a.com', '/media/x')).toBe('https://a.com/media/x');
  });

  it('copes with a path that forgot its leading slash', () => {
    expect(serverAssetUrl('https://a.com', 'media/x')).toBe('https://a.com/media/x');
  });

  it('leaves an already-absolute URL alone', () => {
    expect(serverAssetUrl('https://a.com', 'https://b.com/x')).toBe('https://b.com/x');
  });
});

describe('request', () => {
  it('sends the bearer token and parses the body', async () => {
    const calls = stubFetch({ body: { ok: true } });
    await expect(request('https://a.com', '/api/me', { token: 'tok' })).resolves.toEqual({ ok: true });
    expect(calls[0].url).toBe('https://a.com/api/me');
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer tok');
  });

  it('only sets a content type when there is a body to type', async () => {
    const calls = stubFetch({ body: {} });
    await request('https://a.com', '/api/me', { token: 'tok' });
    expect((calls[0].init.headers as Record<string, string>)['content-type']).toBeUndefined();

    await request('https://a.com', '/api/x', { method: 'POST', body: { a: 1 } });
    expect((calls[1].init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(calls[1].init.body).toBe('{"a":1}');
  });

  it('surfaces the server’s own Persian message on an error', async () => {
    stubFetch({ status: 409, body: { error: 'taken', message: 'این نام کاربری گرفته شده' } });
    await expect(signIn('https://a.com', 'ali', 'pw')).rejects.toThrow('این نام کاربری گرفته شده');
  });

  it('still explains itself when the error body is not JSON', async () => {
    stubFetch({ status: 502, body: undefined });
    await expect(request('https://a.com', '/api/me')).rejects.toThrow('502');
  });

  it('turns a dead connection into advice rather than a stack trace', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    await expect(request('https://a.com', '/api/me')).rejects.toThrow('به سرور وصل نشد');
  });

  it('refuses to call anything when no server is configured', async () => {
    stubFetch({ body: {} });
    await expect(request('', '/api/me')).rejects.toThrow('آدرس سرور را وارد کن');
  });

  it('accepts an empty success body', async () => {
    stubFetch({ status: 200, body: undefined });
    await expect(request('https://a.com', '/api/x', { method: 'POST' })).resolves.toBeNull();
  });
});
