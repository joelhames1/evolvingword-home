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
  let db: Map<string, string>;
  const calls: { url: string; command: string[]; auth: string }[] = [];
  beforeEach(() => {
    calls.length = 0;
    db = new Map([['evolvingword:shown', JSON.stringify(['tower', 'alps'])]]);
    // A little Redis: just the commands the switch sends.
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      const command = JSON.parse(init.body as string) as string[];
      calls.push({ url, command, auth: (init.headers as Record<string, string>).authorization });
      const [op, key, value] = command;
      const result =
        op === 'GET' ? (db.get(key) ?? null)
        : op === 'MGET' ? command.slice(1).map((k) => db.get(k) ?? null)
        : op === 'SET' ? (db.set(key, value), 'OK')
        : op === 'DEL' ? Number(db.delete(key))
        : op === 'INCR' ? (db.set(key, String(Number(db.get(key) ?? 0) + 1)), Number(db.get(key)))
        : op === 'EXPIRE' ? 1
        : null;
      return new Response(JSON.stringify({ result }));
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env = { ...env };
  });
  const setUp = () => {
    process.env.KV_REST_API_URL = 'https://fine-owl-123.upstash.io/';
    process.env.KV_REST_API_TOKEN = 'write-456';
    process.env.KV_REST_API_READ_ONLY_TOKEN = 'read-123';
    process.env.OWNER_PASSWORD = 'open sesame';
  };
  const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json', 'x-real-ip': '203.0.113.7' }) =>
    handler(new Request('https://x/api/worlds', { method: 'POST', headers, body: JSON.stringify(body) }));
  const get = () => handler(new Request('https://x/api/worlds'));
  const writes = () => calls.filter((c) => c.command[0] === 'SET' || c.command[0] === 'DEL');

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
    expect(await (await get()).json()).toEqual({ shown: null });
    expect((await post({ password: 'open sesame', shown: ['alps'] })).status).toBe(503);
  });

  it('gives the live choice, read with the read-only token, and lets the CDN hold it briefly', async () => {
    setUp();
    const res = await get();
    expect(await res.json()).toEqual({ shown: ['tower', 'alps'] });
    expect(res.headers.get('cache-control')).toContain('s-maxage=10');
    expect(calls[0]).toMatchObject({ url: 'https://fine-owl-123.upstash.io', auth: 'Bearer read-123' });
  });

  it('gives nothing when nothing is saved', async () => {
    setUp();
    db.clear();
    expect(await (await get()).json()).toEqual({ shown: null });
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
    expect(await (await get()).json()).toEqual({ shown: ['monastery', 'tower'] });

    expect((await post({ password: 'open sesame', shown: ['nowhere'] })).status).toBe(400);
    const cleared = await post({ password: 'open sesame', shown: null });
    expect(await cleared.json()).toEqual({ shown: null });
    expect(writes().at(-1)!.command).toEqual(['DEL', 'evolvingword:shown']);
  });

  it('takes JSON only, and nothing big', async () => {
    setUp();
    expect((await post({ password: 'open sesame', shown: ['tower'] }, { 'content-type': 'text/plain' })).status).toBe(415);
    expect((await post({ password: 'open sesame', shown: ['tower'], pad: 'x'.repeat(5000) })).status).toBe(413);
    expect(writes()).toHaveLength(0);
  });

  it('stops checking passwords after too many wrong ones, from one address or from many', async () => {
    setUp();
    // Count without waiting out the pause after each.
    vi.stubGlobal('setTimeout', (fn: () => void) => (fn(), 0));
    for (let i = 0; i < 8; i++) expect((await post({ password: `guess ${i}`, shown: ['alps'] })).status).toBe(401);
    // Now even the right password waits.
    expect((await post({ password: 'open sesame', shown: ['alps'] })).status).toBe(429);
    // The counters clear themselves: each started its clock on its first wrong try.
    expect(calls.filter((c) => c.command[0] === 'EXPIRE').map((c) => c.command[2])).toEqual(['900', '3600']);
    // Another address still gets in, until wrong tries from everywhere add up.
    const from = (ip: string) => ({ 'content-type': 'application/json', 'x-real-ip': ip });
    expect((await post({ password: 'open sesame', shown: ['alps'] }, from('198.51.100.1'))).status).toBe(200);
    for (let i = 0; i < 32; i++) await post({ password: 'guess', shown: ['alps'] }, from(`198.51.100.${10 + i}`));
    expect((await post({ password: 'open sesame', shown: ['alps'] }, from('198.51.100.99'))).status).toBe(429);
    // No address is kept as it is.
    expect([...db.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false);
  });

  it('passes on what the store said when it refuses', async () => {
    setUp();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: 'WRONGPASS invalid password' }), { status: 401 }));
    const res = await post({ password: 'open sesame', shown: ['tower'] });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('Couldn’t check: store said 401: WRONGPASS invalid password.');
  });
});
