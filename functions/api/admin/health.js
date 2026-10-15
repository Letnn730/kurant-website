// GET /api/admin/health: is the email list wired up? One call, read-only.
//
// Reports which settings are present (never their values), the database, and what Resend says:
// whether the API key works, whether it can manage contacts (needed to copy sign-ups into the
// newsletter segments), the sending domain's status, and whether the FR/EN segments exist.
// "problems" lists, in plain words, anything that stops confirmation emails or newsletters.
//
//   curl.exe -H "Authorization: Bearer TOKEN" https://kurant.ca/api/admin/health

import { json } from "../../_lib/util.js";
import { denied } from "../../_lib/admin.js";

const API = "https://api.resend.com";

async function resend(env, path) {
  try {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { message: String(err) } };
  }
}

const domainOf = (from) => {
  const m = /@([^>\s]+)>?\s*$/.exec(String(from || ""));
  return m ? m[1].toLowerCase() : "";
};

export async function onRequestGet({ request, env }) {
  const no = denied(request, env);
  if (no) return no;

  const problems = [];
  const settings = {
    RESEND_API_KEY: Boolean(env.RESEND_API_KEY),
    MAIL_FROM: Boolean(env.MAIL_FROM),
    RESEND_SEGMENT_FR: Boolean(env.RESEND_SEGMENT_FR),
    RESEND_SEGMENT_EN: Boolean(env.RESEND_SEGMENT_EN),
    RESEND_WEBHOOK_SECRET: Boolean(env.RESEND_WEBHOOK_SECRET),
    MAIL_POSTAL: Boolean(env.MAIL_POSTAL),
    IP_SALT: Boolean(env.IP_SALT),
    MAIL_DEV_is_off: env.MAIL_DEV !== "1",
  };
  if (!settings.RESEND_API_KEY) problems.push("RESEND_API_KEY is missing: no email is sent.");
  if (!settings.MAIL_FROM) problems.push("MAIL_FROM is missing: no email is sent.");
  if (!settings.MAIL_DEV_is_off) problems.push("MAIL_DEV is set to 1 in production: emails are only logged, never sent.");
  if (!settings.RESEND_SEGMENT_FR || !settings.RESEND_SEGMENT_EN) problems.push("A segment id is missing: confirmed sign-ups aren't copied to Resend, so newsletters would reach nobody in that language.");
  if (!settings.MAIL_POSTAL) problems.push("MAIL_POSTAL is missing: emails show only \"Montréal (Québec), Canada\". CASL asks for a mailing address.");
  if (!settings.RESEND_WEBHOOK_SECRET) problems.push("RESEND_WEBHOOK_SECRET is missing: unsubscribes from newsletters don't reach the list on kurant.ca.");

  // Database
  let list = null;
  try {
    list = await env.DB.prepare(
      `SELECT
         SUM(confirmed_at IS NOT NULL AND unsubscribed_at IS NULL) AS confirmed,
         SUM(confirmed_at IS NULL AND unsubscribed_at IS NULL) AS pending,
         SUM(confirmed_at IS NOT NULL AND unsubscribed_at IS NULL AND synced_at IS NULL) AS confirmed_not_in_resend,
         SUM(confirmed_at IS NULL AND unsubscribed_at IS NULL AND confirm_sent_at IS NULL) AS never_emailed
       FROM waitlist`
    ).first();
  } catch (err) {
    problems.push("The database can't be read: check the D1 binding named DB.");
  }
  if (list && list.confirmed_not_in_resend > 0) {
    problems.push(`${list.confirmed_not_in_resend} confirmed sign-up(s) aren't in Resend yet: run POST /api/admin/sync until "left" is 0.`);
  }
  if (list && list.never_emailed > 0) {
    problems.push(`${list.never_emailed} sign-up(s) never got their confirmation email: run POST /api/admin/resend.`);
  }

  // Resend
  const out = { key_works: false, can_manage_contacts: false, domain: null, segments: { fr: null, en: null } };
  if (settings.RESEND_API_KEY) {
    const domains = await resend(env, "/domains");
    if (domains.status === 200) {
      out.key_works = true;
      const want = domainOf(env.MAIL_FROM);
      const d = (domains.data && domains.data.data || []).find((x) => String(x.name).toLowerCase() === want);
      out.domain = d ? { name: d.name, status: d.status } : { name: want, status: "not_added" };
      if (!d) problems.push(`The sending domain ${want || "(from MAIL_FROM)"} isn't added in Resend.`);
      else if (d.status !== "verified") problems.push(`The sending domain ${d.name} is "${d.status}" in Resend, not "verified".`);
    } else if (domains.status === 401 || domains.status === 403) {
      // A "Sending access" key can send but can't read domains or manage contacts.
      out.key_works = "sending_only_or_invalid";
    } else {
      problems.push(`Resend didn't answer as expected (HTTP ${domains.status}).`);
    }

    const segments = await resend(env, "/segments");
    if (segments.status === 200) {
      out.can_manage_contacts = true;
      const all = segments.data && segments.data.data || [];
      for (const [lang, id] of [["fr", env.RESEND_SEGMENT_FR], ["en", env.RESEND_SEGMENT_EN]]) {
        const s = id ? all.find((x) => x.id === id) : null;
        out.segments[lang] = id ? (s ? { name: s.name, found: true } : { found: false }) : null;
        if (id && !s) problems.push(`RESEND_SEGMENT_${lang.toUpperCase()} doesn't match any segment in Resend.`);
      }
    } else {
      problems.push("The Resend API key can't manage contacts (it needs \"Full access\"): confirmed sign-ups can't be copied to the newsletter segments.");
    }
  }

  return json({ ok: problems.length === 0, problems, settings, list, resend: out });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
