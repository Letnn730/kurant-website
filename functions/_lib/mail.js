// Email through Resend (https://resend.com): the confirmation email from the site, and a copy of each
// confirmed sign-up in Resend's contact list, so broadcasts are written and sent from Resend's editor.
//
// Environment (Pages project, Settings -> Variables and secrets):
//   RESEND_API_KEY      secret, "re_..."; without it nothing is sent
//   MAIL_FROM           e.g. "Kurant <bonjour@kurant.ca>" (the domain must be verified in Resend)
//   RESEND_SEGMENT_FR   segment id for French contacts (optional: without it contacts are not copied)
//   RESEND_SEGMENT_EN   segment id for English contacts
//   MAIL_DEV            "1" only on a local test run: log emails instead of sending them

const API = "https://api.resend.com";

async function call(env, method, path, body, extraHeaders = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data };
}

export const mailConfigured = (env) => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

// Returns { ok, dev?, status? }. Never throws.
export async function sendMail(env, { to, subject, html, text, headers = {}, idempotencyKey }) {
  if (env.MAIL_DEV === "1") {
    console.log(`[MAIL_DEV] to=${to} subject=${subject}\n${text}`);
    return { ok: true, dev: true };
  }
  if (!mailConfigured(env)) {
    console.error("mail not configured: set RESEND_API_KEY and MAIL_FROM");
    return { ok: false, status: 0 };
  }
  try {
    const r = await call(
      env, "POST", "/emails",
      { from: env.MAIL_FROM, to: [to], reply_to: "bonjour@kurant.ca", subject, html, text, headers },
      idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
    );
    if (!r.ok) console.error("resend send failed", r.status, JSON.stringify(r.data));
    return { ok: r.ok, status: r.status };
  } catch (err) {
    console.error("resend send error", err);
    return { ok: false, status: 0 };
  }
}

// Copy a contact to Resend (create, or update if it exists). Returns true when Resend has it.
export async function syncContact(env, { email, lang, unsubscribed }) {
  if (env.MAIL_DEV === "1") {
    console.log(`[MAIL_DEV] contact ${email} lang=${lang} unsubscribed=${unsubscribed}`);
    return true;
  }
  if (!env.RESEND_API_KEY) return false;
  const segment = lang === "en" ? env.RESEND_SEGMENT_EN : env.RESEND_SEGMENT_FR;
  if (!segment && !unsubscribed) return false; // contact copying not set up
  try {
    const created = await call(env, "POST", "/contacts", {
      email,
      unsubscribed: Boolean(unsubscribed),
      ...(segment ? { segments: [{ id: segment }] } : {}),
    });
    if (created.ok) return true;
    // Already there: update the status, and make sure it sits in the right segment.
    const id = encodeURIComponent(email);
    const updated = await call(env, "PATCH", `/contacts/${id}`, { unsubscribed: Boolean(unsubscribed) });
    if (!updated.ok) {
      console.error("resend contact update failed", updated.status, JSON.stringify(updated.data));
      return false;
    }
    if (segment && !unsubscribed) await call(env, "POST", `/contacts/${id}/segments/${segment}`);
    return true;
  } catch (err) {
    console.error("resend contact error", err);
    return false;
  }
}
