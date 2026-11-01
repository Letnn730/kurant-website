// POST /api/profile { t, bike, controller_label, phone_os, province }: the optional details asked on
// the thank-you page ("help us prioritize your bike"). They used to be on the sign-up form; asking
// them after confirmation keeps the form at two fields. Only confirmed sign-ups can answer, and an
// empty answer keeps the one already stored.

import { json, TOKEN_RE, clip, oneOf, readJson } from "../_lib/util.js";
import { PROVINCES } from "../_lib/fields.js";

export async function onRequestPost({ request, env }) {
  const data = await readJson(request, 2048);
  const token = data && typeof data.t === "string" ? data.t : "";
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: "token" }, 400);

  const r = await env.DB.prepare(
    `UPDATE waitlist SET
       bike = COALESCE(NULLIF(?1, ''), bike),
       controller_label = COALESCE(NULLIF(?2, ''), controller_label),
       phone_os = COALESCE(NULLIF(?3, ''), phone_os),
       province = COALESCE(NULLIF(?4, ''), province)
     WHERE token = ?5 AND confirmed_at IS NOT NULL`
  ).bind(
    clip(data.bike, 120),
    clip(data.controller_label, 120),
    oneOf(data.phone_os, ["android", "ios"]),
    oneOf(data.province, PROVINCES),
    token
  ).run();
  if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "token" }, 404);
  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
