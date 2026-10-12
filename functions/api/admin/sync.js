// POST /api/admin/sync[?limit=50]
// Copies confirmed sign-ups that aren't in Resend's contact list yet (for example, people who confirmed
// before the segments were set up). Run it again until "left" is 0.

import { json } from "../../_lib/util.js";
import { denied, pace, limitParam } from "../../_lib/admin.js";
import { syncContact } from "../../_lib/mail.js";

export async function onRequestPost({ request, env }) {
  const no = denied(request, env);
  if (no) return no;

  const limit = limitParam(request, 50, 95);
  const { results } = await env.DB.prepare(
    `SELECT email, lang, token FROM waitlist
      WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND synced_at IS NULL
      ORDER BY id LIMIT ?1`
  ).bind(limit).all();

  let synced = 0, failed = 0;
  for (const row of results || []) {
    if (await syncContact(env, { email: row.email, lang: row.lang, unsubscribed: false })) {
      await env.DB.prepare("UPDATE waitlist SET synced_at = CURRENT_TIMESTAMP WHERE token = ?1").bind(row.token).run();
      synced++;
    } else failed++;
    await pace();
  }
  const left = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM waitlist WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND synced_at IS NULL"
  ).first();
  return json({ ok: true, synced, failed, left: left ? left.n : 0 });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
