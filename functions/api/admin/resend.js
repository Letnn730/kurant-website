// POST /api/admin/resend[?limit=50][&remind=1]
// Sends the confirmation email to sign-ups that never got one: rows from before the pre-launch list,
// and sign-ups whose email failed (for example on a day past Resend's free daily cap).
// remind=1 also sends ONE reminder to unconfirmed sign-ups whose last email is more than 3 days old.

import { json, origin } from "../../_lib/util.js";
import { denied, pace, limitParam } from "../../_lib/admin.js";
import { sendConfirmation } from "../../_lib/list.js";

export async function onRequestPost({ request, env }) {
  const no = denied(request, env);
  if (no) return no;

  const limit = limitParam(request, 50, 95);
  const remind = new URL(request.url).searchParams.get("remind") === "1";
  const { results } = await env.DB.prepare(
    `SELECT * FROM waitlist
      WHERE confirmed_at IS NULL AND unsubscribed_at IS NULL
        AND (confirm_sent_at IS NULL ${remind ? "OR confirm_sent_at < datetime('now', '-3 days')" : ""})
      ORDER BY id LIMIT ?1`
  ).bind(limit).all();

  const base = origin(request);
  let sent = 0, failed = 0;
  for (const row of results || []) {
    const r = await sendConfirmation(env, base, row);
    if (r.ok) sent++; else failed++;
    await pace();
  }
  const left = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM waitlist WHERE confirmed_at IS NULL AND unsubscribed_at IS NULL AND confirm_sent_at IS NULL"
  ).first();
  return json({ ok: true, sent, failed, never_emailed_left: left ? left.n : 0 });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
