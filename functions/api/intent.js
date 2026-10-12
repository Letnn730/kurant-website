// POST /api/intent { t, v }: the day-one question on the thank-you page.
// v = "yes" (I'll back it on day one), "maybe", or "curious". Only confirmed sign-ups can answer.

import { json, TOKEN_RE, oneOf, readJson } from "../_lib/util.js";

export async function onRequestPost({ request, env }) {
  const data = await readJson(request, 1024);
  const token = data && typeof data.t === "string" ? data.t : "";
  const value = data ? oneOf(data.v, ["yes", "maybe", "curious"]) : "";
  if (!TOKEN_RE.test(token) || !value) return json({ ok: false, error: "bad_request" }, 400);

  const r = await env.DB.prepare(
    "UPDATE waitlist SET intent = ?1 WHERE token = ?2 AND confirmed_at IS NOT NULL"
  ).bind(value, token).run();
  if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "token" }, 404);
  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
