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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

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
      return json({ shown: await read() });
    } catch {
      return json({ shown: null });
    }
  }
  if (req.method !== 'POST') return json({ error: 'GET or POST' }, 405);

  const password = process.env.OWNER_PASSWORD;
  if (!password || !store()) return json({ error: 'The owner switch isn’t set up on Vercel yet: connect an Upstash Redis store and set OWNER_PASSWORD.' }, 503);
  let body: { password?: unknown; shown?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  if (typeof body.password !== 'string' || !(await same(body.password, password))) {
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
