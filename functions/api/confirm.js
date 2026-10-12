// GET /api/confirm?t=TOKEN: the link in the confirmation email.
// Marks the address confirmed, gives the next founder number (once), copies the contact to the
// email provider, then sends the person to their thank-you page.

import { redirect, TOKEN_RE, thanksPath } from "../_lib/util.js";
import { syncContact } from "../_lib/mail.js";

export async function onRequestGet({ request, env, waitUntil }) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!TOKEN_RE.test(token)) return redirect("/merci/?e=lien");

  const DB = env.DB;
  const before = await DB.prepare("SELECT lang, confirmed_at, synced_at FROM waitlist WHERE token = ?1").bind(token).first();
  if (!before) return redirect("/merci/?e=lien");

  if (!before.confirmed_at) {
    // Statements run one at a time in D1, so MAX + 1 can't hand out the same number twice
    // (and the unique index would refuse it anyway).
    await DB.prepare(
      `UPDATE waitlist SET
         confirmed_at = CURRENT_TIMESTAMP,
         founder_no = COALESCE(founder_no, (SELECT COALESCE(MAX(founder_no), 0) + 1 FROM waitlist))
       WHERE token = ?1 AND confirmed_at IS NULL`
    ).bind(token).run();
  }

  const row = await DB.prepare("SELECT email, lang, unsubscribed_at, synced_at FROM waitlist WHERE token = ?1").bind(token).first();
  if (row && !row.synced_at && !row.unsubscribed_at) {
    waitUntil(
      syncContact(env, { email: row.email, lang: row.lang, unsubscribed: false }).then((ok) =>
        ok ? DB.prepare("UPDATE waitlist SET synced_at = CURRENT_TIMESTAMP WHERE token = ?1").bind(token).run() : null
      )
    );
  }

  // The token travels in the fragment: it never reaches a server log or a Referer header.
  return redirect(`${thanksPath(before.lang)}#t=${token}`);
}
