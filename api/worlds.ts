// Which worlds the chooser shows, live: the owner's choice, kept in a Vercel
// Global Config store (called Edge Config until mid 2026) so it changes
// without a deploy.
//
//   GET  /api/worlds                               -> { shown: [...] } or { shown: null } (use the repo's list)
//   POST /api/worlds { password, shown: [...] }    -> sets it (known worlds only, at most five)
//   POST /api/worlds { password, shown: null }     -> clears it, back to the repo's list
//
// Setup (all in the Vercel dashboard, see the README): a Global Config store
// connected to the project (which sets GLOBAL_CONFIG, or EDGE_CONFIG on a store
// made before the rename), and three environment
// variables: OWNER_PASSWORD, VERCEL_API_TOKEN (a token that can write to the
// store) and, for a team account, VERCEL_TEAM_ID. Without them, GET answers
// { shown: null } and the site uses the list in src/worlds/shown.ts.
import { cleanShown } from '../src/worlds';

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const KEY = 'shown';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });

/** The store's id, read token and host, from the connection string Vercel sets. */
export function store(
  conn = process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG,
): { id: string; token: string; origin: string } | null {
  if (!conn) return null;
  try {
    const url = new URL(conn);
    const id = url.pathname.split('/').filter(Boolean).pop();
    const token = url.searchParams.get('token');
    return id && token ? { id, token, origin: url.origin } : null;
  } catch {
    return null;
  }
}

/** Compares two strings without giving away, by timing, how much of them matched. */
export async function same(a: string, b: string) {
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

async function read(): Promise<string[] | null> {
  const s = store();
  if (!s) return null;
  const res = await fetch(`${s.origin}/${s.id}/item/${KEY}?token=${s.token}`);
  if (!res.ok) return null;
  return cleanShown(await res.json());
}

/** What Vercel said went wrong, in its own words where it gave any. */
async function why(res: Response) {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body.error?.message) return `store said ${res.status}: ${body.error.message}`;
  } catch {
    // No JSON; the status will do.
  }
  return `store said ${res.status}`;
}

async function write(shown: string[] | null) {
  const s = store();
  const token = process.env.VERCEL_API_TOKEN;
  if (!s || !token) throw new Error('not set up');
  const auth = { authorization: `Bearer ${token}` };
  const body = JSON.stringify({ items: [shown ? { operation: 'upsert', key: KEY, value: shown } : { operation: 'delete', key: KEY }] });
  // The store belongs to an account or a team (every account is a team now),
  // and the API only finds it when asked under the right one. Without
  // VERCEL_TEAM_ID, try the token's own account, then each team it can reach.
  // Vercel renamed Edge Config to Global Config in 2026; try both paths.
  const given = process.env.VERCEL_TEAM_ID;
  let teams: (string | undefined)[] = given ? [given] : [undefined];
  let looked = !!given;
  let last = 'store not found';
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i] ? `?teamId=${encodeURIComponent(teams[i]!)}` : '';
    for (const kind of ['edge-config', 'global-config']) {
      const res = await fetch(`https://api.vercel.com/v1/${kind}/${s.id}/items${team}`, {
        method: 'PATCH',
        headers: { ...auth, 'content-type': 'application/json' },
        body,
      });
      if (res.ok) return;
      last = await why(res);
      if (res.status !== 404) throw new Error(last);
    }
    if (!looked && i === teams.length - 1) {
      looked = true;
      const res = await fetch('https://api.vercel.com/v2/teams', { headers: auth });
      if (res.ok) teams = teams.concat(((await res.json()) as { teams?: { id: string }[] }).teams?.map((t) => t.id) ?? []);
    }
  }
  throw new Error(`${last} (store ${s.id}${given ? `, team ${given}` : ''})`);
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
  if (!password || !store() || !process.env.VERCEL_API_TOKEN) return json({ error: 'The owner switch isn’t set up on Vercel yet.' }, 503);
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
