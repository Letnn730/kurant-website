// GET /api/admin/report: the launch gates in one call.
// Confirmed and pending counts, day-one answers, sign-ups per system, and the referral leaders
// (with their email, so you can check them by hand before giving a prize).

import { json } from "../../_lib/util.js";
import { denied } from "../../_lib/admin.js";

export async function onRequestGet({ request, env }) {
  const no = denied(request, env);
  if (no) return no;
  const DB = env.DB;

  const totals = await DB.prepare(
    `SELECT
       SUM(confirmed_at IS NOT NULL AND unsubscribed_at IS NULL) AS confirmed,
       SUM(confirmed_at IS NULL AND unsubscribed_at IS NULL) AS pending,
       SUM(unsubscribed_at IS NOT NULL) AS unsubscribed,
       SUM(intent = 'yes' AND unsubscribed_at IS NULL) AS day_one_yes,
       SUM(intent = 'maybe' AND unsubscribed_at IS NULL) AS day_one_maybe,
       SUM(intent = 'curious' AND unsubscribed_at IS NULL) AS curious,
       SUM(province IS NOT NULL AND province <> 'XX' AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL) AS confirmed_in_canada
     FROM waitlist`
  ).first();

  const families = (await DB.prepare(
    `SELECT COALESCE(NULLIF(family, ''), 'other') AS family, COUNT(*) AS confirmed
       FROM waitlist WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
      GROUP BY 1 ORDER BY 2 DESC`
  ).all()).results;

  const leaders = (await DB.prepare(
    `SELECT r.founder_no, r.email, r.ref_code,
            COUNT(f.id) AS referrals,
            SUM(f.created_at > datetime('now', '-1 day')) AS last_24h
       FROM waitlist r
       JOIN waitlist f ON f.referred_by = r.ref_code AND f.confirmed_at IS NOT NULL AND f.unsubscribed_at IS NULL
      GROUP BY r.id ORDER BY referrals DESC LIMIT 20`
  ).all()).results;

  return json({ ok: true, totals, families, leaders });
}
