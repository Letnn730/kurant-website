// Waitlist operations shared by the public endpoints and the admin endpoints.

import { sendMail } from "./mail.js";
import { confirmEmail, againEmail, unsubscribeHeaders, postalOf } from "./templates.js";
import { thanksPath } from "./util.js";

export const RESEND_GAP_MINUTES = 10; // at most one email per address per 10 minutes

export const links = (base, row) => ({
  confirmUrl: `${base}/api/confirm?t=${row.token}`,
  thanksUrl: `${base}${thanksPath(row.lang)}#t=${row.token}`,
  unsubUrl: `${base}/api/unsubscribe?t=${row.token}`,
});

// Sends the confirmation email (or, for a confirmed address, a "here is your page" email) and records
// when it went out. Returns { ok, dev?, links }.
export async function sendConfirmation(env, base, row) {
  const l = links(base, row);
  const opts = { unsubUrl: l.unsubUrl, postal: postalOf(env) };
  const mail = row.confirmed_at
    ? againEmail(row.lang, { ...opts, actionUrl: l.thanksUrl })
    : confirmEmail(row.lang, { ...opts, actionUrl: l.confirmUrl });
  const bucket = Math.floor(Date.now() / (RESEND_GAP_MINUTES * 60000));
  const sent = await sendMail(env, {
    to: row.email,
    ...mail,
    headers: unsubscribeHeaders(l.unsubUrl),
    idempotencyKey: `kurant-${row.confirmed_at ? "again" : "confirm"}-${row.token}-${bucket}`,
  });
  if (sent.ok) {
    await env.DB.prepare("UPDATE waitlist SET confirm_sent_at = CURRENT_TIMESTAMP WHERE token = ?1")
      .bind(row.token).run();
  }
  return { ...sent, links: l };
}

// Confirmed referrals of one person (unsubscribed friends don't count).
export async function referralCount(env, code) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM waitlist WHERE referred_by = ?1 AND confirmed_at IS NOT NULL AND unsubscribed_at IS NULL"
  ).bind(code).first();
  return r ? r.n : 0;
}
