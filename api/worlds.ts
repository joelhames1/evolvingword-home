// Which worlds the chooser shows, live: the owner's choice, kept in a small
// Upstash Redis store so it changes without a deploy.
//
//   GET  /api/worlds                               -> { shown: [...] } or { shown: null } (use the repo's list)
//   POST /api/worlds { password, shown: [...] }    -> sets it (known worlds only, at most five)
//   POST /api/worlds { password, shown: null }     -> clears it, back to the repo's list
//
// Setup (all in the Vercel dashboard, see the README): an Upstash Redis store
// from Storage, connected to the project, which sets its REST address and
// tokens; and one environment variable, OWNER_PASSWORD. The store's tokens
// reach that store and nothing else. Without them, GET answers
// { shown: null } and the site uses the list in src/worlds/shown.ts.
import { cleanShown } from '../src/worlds';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const KEY = 'evolvingword:shown';

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-robots-tag': 'noindex' },
  });

// Every visit to the home page asks for the list. Vercel's CDN keeps the
// answer for a few seconds, so a flood of requests can't run through the
// store's free allowance; a new choice shows within that time.
const SHARED = 'public, max-age=0, s-maxage=10, stale-while-revalidate=60';

// Wrong passwords are counted in the store: a few per address, then a wait;
// and a cap across all addresses, so guessing from many machines is slow too.
// Once either limit is hit, no password is even checked until it lifts.
const TRIES = { each: 8, all: 40, eachFor: 15 * 60, allFor: 60 * 60 };
const BODY_MAX = 2048;

/**
 * The store's REST address and tokens. Vercel's Upstash connection names them
 * KV_REST_API_*; a store set up on Upstash directly, UPSTASH_REDIS_REST_*.
 */
export function store(env = process.env): { url: string; token: string; readToken: string } | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ''), token, readToken: env.KV_REST_API_READ_ONLY_TOKEN || token };
}

/** Compares two strings without giving away, by timing, how much of them matched. */
export async function same(a: string, b: string) {
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Sends one Redis command over Upstash's REST API. */
async function redis(command: string[], token: string): Promise<unknown> {
  const s = store()!;
  const res = await fetch(s.url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) throw new Error(`store said ${res.status}${body.error ? `: ${body.error}` : ''}`);
  return body.result;
}

const sha = async (text: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The counters for this caller's address and for everyone, kept by a hash of the address, not the address. */
async function counters(req: Request) {
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  return { each: `${KEY}:wrong:${(await sha(ip)).slice(0, 24)}`, all: `${KEY}:wrong:all` };
}

async function read(): Promise<string[] | null> {
  const s = store();
  if (!s) return null;
  const value = await redis(['GET', KEY], s.readToken);
  return typeof value === 'string' ? cleanShown(JSON.parse(value)) : null;
}

async function write(shown: string[] | null) {
  const s = store();
  if (!s) throw new Error('not set up');
  await redis(shown ? ['SET', KEY, JSON.stringify(shown)] : ['DEL', KEY], s.token);
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    try {
      return json({ shown: await read() }, 200, SHARED);
    } catch {
      return json({ shown: null });
    }
  }
  if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);

  const password = process.env.OWNER_PASSWORD;
  const s = store();
  if (!password || !s) return json({ error: 'The owner switch isn’t set up on Vercel yet: connect an Upstash Redis store and set OWNER_PASSWORD.' }, 503);
  // JSON only: another site's page can't send that without the browser asking
  // this one first, and nothing here says yes.
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  if (Number(req.headers.get('content-length') ?? 0) > BODY_MAX) return json({ error: 'Too big.' }, 413);

  const keys = await counters(req);
  try {
    const [each, all] = ((await redis(['MGET', keys.each, keys.all], s.token)) as (string | null)[]).map((n) => Number(n ?? 0));
    if (each >= TRIES.each || all >= TRIES.all) return json({ error: 'Too many wrong passwords. Wait a while and try again.' }, 429);
  } catch (e) {
    return json({ error: `Couldn’t check: ${(e as Error).message}.` }, 502);
  }

  let body: { password?: unknown; shown?: unknown };
  try {
    const text = await req.text();
    if (text.length > BODY_MAX) return json({ error: 'Too big.' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (typeof body.password !== 'string' || !(await same(body.password, password))) {
    try {
      // The first wrong try starts each counter's clock; it clears itself when that runs out.
      for (const [key, ttl] of [
        [keys.each, TRIES.eachFor],
        [keys.all, TRIES.allFor],
      ] as const)
        if ((await redis(['INCR', key], s.token)) === 1) await redis(['EXPIRE', key, String(ttl)], s.token);
    } catch {
      // Counting failed; the pause below still slows guessing.
    }
    // A pause on every wrong guess makes guessing slow.
    await new Promise((r) => setTimeout(r, 1000));
    return json({ error: 'That isn’t the password.' }, 401);
  }
  const shown = body.shown === null ? null : cleanShown(body.shown);
  if (body.shown !== null && !shown) return json({ error: 'Pick at least one world.' }, 400);
  try {
    await write(shown);
  } catch (e) {
    return json({ error: `Couldn’t save: ${(e as Error).message}.` }, 502);
  }
  return json({ shown });
}
