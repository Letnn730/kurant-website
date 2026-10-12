// POST /api/me { t }: what the thank-you page shows. The token is the person's secret from the
// confirmation link; nothing here reveals an email address.

import { json, TOKEN_RE, readJson } from "../_lib/util.js";
import { referralCount } from "../_lib/list.js";

export async function onRequestPost({ request, env }) {
  const data = await readJson(request, 1024);
  const token = data && typeof data.t === "string" ? data.t : "";
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: "token" }, 400);

  const row = await env.DB.prepare(
    "SELECT lang, family, ref_code, founder_no, confirmed_at, unsubscribed_at, intent FROM waitlist WHERE token = ?1"
  ).bind(token).first();
  if (!row) return json({ ok: false, error: "token" }, 404);

  return json({
    ok: true,
    confirmed: Boolean(row.confirmed_at),
    unsubscribed: Boolean(row.unsubscribed_at),
    lang: row.lang,
    family: row.family || "",
    code: row.ref_code,
    founder_no: row.confirmed_at ? row.founder_no : null,
    referrals: row.confirmed_at ? await referralCount(env, row.ref_code) : 0,
    intent: row.intent || "",
  });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
