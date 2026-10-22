import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { same, store } from '../../api/worlds';
import { cleanShown } from '../../src/worlds';
import { SHOWN } from '../../src/worlds/shown';

declare const process: { env: Record<string, string | undefined> };

describe('the list of worlds to show', () => {
  it('keeps known worlds, each once, at most five', () => {
    expect(cleanShown(['tower', 'nowhere', 'tower', 'alps'])).toEqual(['tower', 'alps']);
    expect(cleanShown(['alps', 'city', 'tower', 'monastery', 'alps'])).toHaveLength(4);
    expect(cleanShown([])).toBeNull();
    expect(cleanShown('tower')).toBeNull();
  });

  it('ships a sensible list in the repo', () => {
    expect(cleanShown(SHOWN)).toEqual(SHOWN);
  });
});

describe('the owner switch', () => {
  const env = { ...process.env };
  let saved: string | null = null;
  const calls: { url: string; command: string[]; auth: string }[] = [];
  beforeEach(() => {
    calls.length = 0;
    saved = JSON.stringify(['tower', 'alps']);
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const command = JSON.parse(init.body as string) as string[];
      calls.push({ url, command, auth: (init.headers as Record<string, string>).authorization });
      if (command[0] === 'GET') return new Response(JSON.stringify({ result: saved }));
      if (command[0] === 'SET') saved = command[2];
      if (command[0] === 'DEL') saved = null;
      return new Response(JSON.stringify({ result: 'OK' }));
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });
  const setUp = () => {
    process.env.KV_REST_API_URL = 'https://fine-owl-123.upstash.io/';
    process.env.KV_REST_API_TOKEN = 'write-456';
    process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-123';
    process.env.OWNER_PASSWORD = 'open sesame';
  };
  const post = (body: unknown) => handler(new Request('https://x/api/worlds', { method: 'POST', body: JSON.stringify(body) }));
  const writes = () => calls.filter((c) => c.command[0] !== 'GET');

  it('finds the store under either name Upstash gives it', () => {
    expect(store({ KV_REST_API_URL: 'https://a.upstash.io/', KV_REST_API_TOKEN: 't' })).toEqual({ url: 'https://a.upstash.io', token: 't', readToken: 't' });
    expect(store({ UPSTASH_REDIS_REST_URL: 'https://b.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'u' })?.url).toBe('https://b.upstash.io');
    expect(store({})).toBeNull();
  });

  it('compares passwords exactly', async () => {
    expect(await same('a', 'a')).toBe(true);
    expect(await same('a', 'b')).toBe(false);
  });

  it('says nothing is set when it isn’t set up, so the repo list is used', async () => {
    delete process.env.KV_REST_API_URL;
    delete process.env.UPSTASH_REDIS_REST_URL;
    process.env.OWNER_PASSWORD = 'open sesame';
    expect(await (await handler(new Request('https://x/api/worlds'))).json()).toEqual({ shown: null });
    expect((await post({ password: 'open sesame', shown: ['alps'] })).status).toBe(503);
  });

  it('gives the live choice, read with the read-only token', async () => {
    setUp();
    const res = await handler(new Request('https://x/api/worlds'));
    expect(await res.json()).toEqual({ shown: ['tower', 'alps'] });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(calls[0]).toMatchObject({ url: 'https://fine-owl-123.upstash.io', auth: 'Bearer read-123' });
  });

  it('gives nothing when nothing is saved', async () => {
    setUp();
    saved = null;
    expect(await (await handler(new Request('https://x/api/worlds'))).json()).toEqual({ shown: null });
  });

  it('only saves with the password, and only real worlds', async () => {
    setUp();
    // A wrong guess waits a second before saying so.
    const t0 = Date.now();
    expect((await post({ password: 'guess', shown: ['alps'] })).status).toBe(401);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
    expect(writes()).toHaveLength(0);

    const res = await post({ password: 'open sesame', shown: ['monastery', 'nowhere', 'tower'] });
    expect(await res.json()).toEqual({ shown: ['monastery', 'tower'] });
    expect(writes()[0]).toMatchObject({ auth: 'Bearer write-456', command: ['SET', 'evolvingword:shown', '["monastery","tower"]'] });
    expect(await (await handler(new Request('https://x/api/worlds'))).json()).toEqual({ shown: ['monastery', 'tower'] });

    expect((await post({ password: 'open sesame', shown: ['nowhere'] })).status).toBe(400);
    const cleared = await post({ password: 'open sesame', shown: null });
    expect(await cleared.json()).toEqual({ shown: null });
    expect(writes().at(-1)!.command).toEqual(['DEL', 'evolvingword:shown']);
  });

  it('passes on what the store said when it refuses', async () => {
    setUp();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'WRONGPASS invalid password' }), { status: 401 }));
    const res = await post({ password: 'open sesame', shown: ['tower'] });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('Couldn’t save: store said 401: WRONGPASS invalid password.');
  });
});
