// GET /api/stats: the real, public numbers behind the sign-up counter and the brand race.
// Counts confirmed, still-subscribed sign-ups only. Cached for 60 seconds at the edge.

import { json } from "../_lib/util.js";

const TTL = 60;

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const key = new Request(new URL("/api/stats", request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;

  const { results } = await env.DB.prepare(
    `SELECT COALESCE(NULLIF(family, ''), 'other') AS family, COUNT(*) AS n
       FROM waitlist WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
      GROUP BY 1`
  ).all();
  const families = {};
  let total = 0;
  for (const r of results || []) { families[r.family] = r.n; total += r.n; }

  const res = json({ ok: true, total, families }, 200, { "Cache-Control": `public, max-age=${TTL}` });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
