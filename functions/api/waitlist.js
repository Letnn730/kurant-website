// POST /api/waitlist: sign-up from the form on kurant.ca.
// Stores the sign-up in D1 (bound as "DB"), then sends the confirmation email (double opt-in).
// A sign-up counts (founder number, referrals, brand race) only once its email is confirmed.

import { json, clip, oneOf, EMAIL_RE, CODE_RE, normEmail, randomHex, randomCode, sha256Hex, origin, readJson } from "../_lib/util.js";
import { sendConfirmation, RESEND_GAP_MINUTES } from "../_lib/list.js";
import { syncContact } from "../_lib/mail.js";

const PROVINCES = ["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE", "YT", "NT", "NU", "XX"];
// Keep in step with assets/compat.js.
const FAMILIES = ["kt", "bafang-uart", "bafang-can", "lishui", "rad-lishui", "rad-asi", "lectric",
  "happyrun-48", "happyrun-pro", "aventon", "bosch", "shimano", "other"];
const VOLTAGES = ["36", "48", "52", "60-72", "unknown"];

const MAX_PER_IP_PER_HOUR = 8;

export async function onRequestPost({ request, env, waitUntil }) {
  const data = await readJson(request);
  if (!data) return json({ ok: false, error: "bad_request" }, 400);

  // Honeypot: real people never fill this hidden field.
  if (data.website) return json({ ok: true, status: "check_email" });

  const email = clip(data.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ ok: false, error: "email" }, 400);
  if (data.consent !== true) return json({ ok: false, error: "consent" }, 400);

  const DB = env.DB;

  // Throttle per IP (hashed, kept 24 h), and tidy old rows while we're here.
  const ipHash = await sha256Hex(`${request.headers.get("CF-Connecting-IP") || ""}|${env.IP_SALT || "kurant"}`);
  const recent = await DB.prepare(
    "SELECT COUNT(*) AS n FROM signup_events WHERE ip_hash = ?1 AND at > datetime('now', '-1 hour')"
  ).bind(ipHash).first();
  if (recent && recent.n >= MAX_PER_IP_PER_HOUR) return json({ ok: false, error: "slow_down" }, 429);
  await DB.batch([
    DB.prepare("INSERT INTO signup_events (ip_hash) VALUES (?1)").bind(ipHash),
    DB.prepare("DELETE FROM signup_events WHERE at < datetime('now', '-1 day')"),
    // Never-confirmed sign-ups are deleted 30 days after their last confirmation email.
    DB.prepare(`DELETE FROM waitlist WHERE confirmed_at IS NULL AND confirm_sent_at IS NOT NULL
                AND confirm_sent_at < datetime('now', '-30 days')`),
  ]);

  const lang = oneOf(data.lang, ["fr", "en"]) || "fr";
  const fields = [
    clip(data.bike, 120),
    clip(data.controller_label, 120),
    oneOf(data.family, FAMILIES),
    oneOf(data.voltage, VOLTAGES),
    oneOf(data.phone_os, ["android", "ios"]),
    oneOf(data.province, PROVINCES),
    lang,
    clip(data.consent_version, 20),
  ];
  const norm = normEmail(email);
  const base = origin(request);

  try {
    let row = await DB.prepare(
      "SELECT * FROM waitlist WHERE email = ?1 OR email_norm = ?2 ORDER BY (email = ?1) DESC LIMIT 1"
    ).bind(email, norm).first();

    if (row) {
      // Same person again: refresh what they told us (empty answers keep the old ones) and their consent.
      const wasUnsubscribed = Boolean(row.unsubscribed_at);
      await DB.prepare(
        `UPDATE waitlist SET
           bike = COALESCE(NULLIF(?1, ''), bike),
           controller_label = COALESCE(NULLIF(?2, ''), controller_label),
           family = COALESCE(NULLIF(?3, ''), family),
           voltage = COALESCE(NULLIF(?4, ''), voltage),
           phone_os = COALESCE(NULLIF(?5, ''), phone_os),
           province = COALESCE(NULLIF(?6, ''), province),
           lang = ?7,
           consent_version = ?8,
           consent_at = CURRENT_TIMESTAMP,
           unsubscribed_at = NULL,
           email_norm = COALESCE(email_norm, ?9),
           token = COALESCE(token, ?10),
           ref_code = COALESCE(ref_code, ?11)
         WHERE id = ?12`
      ).bind(...fields, norm, randomHex(16), randomCode(), row.id).run();
      row = await DB.prepare("SELECT * FROM waitlist WHERE id = ?1").bind(row.id).first();

      if (wasUnsubscribed && row.confirmed_at) {
        waitUntil(syncContact(env, { email: row.email, lang: row.lang, unsubscribed: false }));
      }

      const lastSent = row.confirm_sent_at ? Date.parse(row.confirm_sent_at.replace(" ", "T") + "Z") : 0;
      if (Date.now() - lastSent < RESEND_GAP_MINUTES * 60000) {
        return json({ ok: true, status: row.confirmed_at ? "confirmed" : "check_email", email_sent: false, throttled: true });
      }
      const sent = await sendConfirmation(env, base, row);
      return json({
        ok: true,
        status: row.confirmed_at ? "confirmed" : "check_email",
        email_sent: sent.ok,
        ...(sent.dev ? { dev_links: sent.links } : {}),
      });
    }

    // New sign-up. Credit the referrer only if the code exists and isn't the same person.
    let referredBy = null;
    const ref = clip(data.ref, 6).toLowerCase();
    if (CODE_RE.test(ref)) {
      const referrer = await DB.prepare("SELECT email_norm FROM waitlist WHERE ref_code = ?1").bind(ref).first();
      if (referrer && referrer.email_norm !== norm) referredBy = ref;
    }

    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const token = randomHex(16);
      try {
        await DB.prepare(
          `INSERT INTO waitlist
             (email, bike, controller_label, family, voltage, phone_os, province, lang, consent_version,
              email_norm, token, ref_code, referred_by)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
        ).bind(email, ...fields, norm, token, randomCode(), referredBy).run();
        created = await DB.prepare("SELECT * FROM waitlist WHERE token = ?1").bind(token).first();
      } catch (err) {
        // A referral code collision is retried with a new code; anything else is a real failure.
        if (!String(err).includes("ref_code")) throw err;
      }
    }
    if (!created) throw new Error("could not allocate a referral code");

    const sent = await sendConfirmation(env, base, created);
    return json({
      ok: true,
      status: "check_email",
      email_sent: sent.ok,
      ...(sent.dev ? { dev_links: sent.links } : {}),
    });
  } catch (err) {
    console.error("waitlist sign-up failed", err);
    return json({ ok: false, error: "server" }, 500);
  }
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
