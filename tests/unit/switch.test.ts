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
  const calls: { url: string; init?: RequestInit }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/item/shown')) return new Response(JSON.stringify(['tower', 'alps']), { status: 200 });
      return new Response('{}', { status: 200 });
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });
  const setUp = () => {
    process.env.EDGE_CONFIG = 'https://edge-config.vercel.com/ecfg_abc?token=read-123';
    process.env.OWNER_PASSWORD = 'open sesame';
    process.env.VERCEL_API_TOKEN = 'write-456';
  };
  const post = (body: unknown) => new Request('https://x/api/worlds', { method: 'POST', body: JSON.stringify(body) });

  it('reads the store from the connection string Vercel sets', () => {
    expect(store('https://edge-config.vercel.com/ecfg_abc?token=t')).toEqual({ id: 'ecfg_abc', token: 't' });
    expect(store(undefined)).toBeNull();
    expect(store('nonsense')).toBeNull();
  });

  it('compares passwords exactly', async () => {
    expect(await same('a', 'a')).toBe(true);
    expect(await same('a', 'b')).toBe(false);
  });

  it('says nothing is set when it isn’t set up, so the repo list is used', async () => {
    delete process.env.EDGE_CONFIG;
    const res = await handler(new Request('https://x/api/worlds'));
    expect(await res.json()).toEqual({ shown: null });
    expect((await handler(post({ password: 'x', shown: ['alps'] }))).status).toBe(503);
  });

  it('gives the live choice', async () => {
    setUp();
    const res = await handler(new Request('https://x/api/worlds'));
    expect(await res.json()).toEqual({ shown: ['tower', 'alps'] });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('only saves with the password, and only real worlds', async () => {
    setUp();
    // A wrong guess waits a second before saying so.
    const t0 = Date.now();
    expect((await handler(post({ password: 'guess', shown: ['alps'] }))).status).toBe(401);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
    expect(calls.filter((c) => c.init?.method === 'PATCH')).toHaveLength(0);

    const res = await handler(post({ password: 'open sesame', shown: ['monastery', 'nowhere', 'tower'] }));
    expect(await res.json()).toEqual({ shown: ['monastery', 'tower'] });
    const patch = calls.find((c) => c.init?.method === 'PATCH')!;
    expect(patch.url).toBe('https://api.vercel.com/v1/edge-config/ecfg_abc/items');
    expect((patch.init!.headers as Record<string, string>).authorization).toBe('Bearer write-456');
    expect(JSON.parse(patch.init!.body as string)).toEqual({ items: [{ operation: 'upsert', key: 'shown', value: ['monastery', 'tower'] }] });

    expect((await handler(post({ password: 'open sesame', shown: ['nowhere'] }))).status).toBe(400);
    const cleared = await handler(post({ password: 'open sesame', shown: null }));
    expect(await cleared.json()).toEqual({ shown: null });
    expect(JSON.parse(calls.filter((c) => c.init?.method === 'PATCH').at(-1)!.init!.body as string).items[0]).toEqual({ operation: 'delete', key: 'shown' });
  });
});
