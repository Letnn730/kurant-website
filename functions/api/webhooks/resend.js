// POST /api/webhooks/resend: events from Resend, so the list on kurant.ca follows what happens in Resend.
//
//   contact.updated with unsubscribed: true -> the person used the unsubscribe link of a broadcast
//                                              (or was unsubscribed in Resend's dashboard)
//   email.complained                        -> the person marked one of our emails as spam
//
// Both mark the sign-up as unsubscribed, so it stops counting (founder list, votes, report) and the
// site never emails it again. Nothing is ever re-subscribed from here: only the person signing up
// again on kurant.ca does that.
//
// Setup: Resend -> Webhooks -> Add endpoint https://kurant.ca/api/webhooks/resend with the events
// contact.updated and email.complained, then copy its signing secret ("whsec_...") into the Pages
// variable RESEND_WEBHOOK_SECRET (type Secret). Without the secret, every call is refused.

import { json } from "../../_lib/util.js";

const TOLERANCE_SECONDS = 5 * 60;

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Svix signature scheme (what Resend uses): HMAC-SHA256 over "id.timestamp.body" with the
// base64-decoded part of the secret after "whsec_"; the header lists "v1,<base64>" entries.
export async function verifySignature(secret, headers, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) return false;

  let keyBytes;
  try { keyBytes = b64ToBytes(secret.startsWith("whsec_") ? secret.slice(6) : secret); } catch { return false; }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = bytesToB64(new Uint8Array(mac));

  return signatures.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    return version === "v1" && typeof sig === "string" && sameString(sig, expected);
  });
}

// The addresses an event is about, lower-cased.
function addressesOf(event) {
  const d = event && event.data ? event.data : {};
  if (event.type === "contact.updated") return d.unsubscribed === true && d.email ? [String(d.email)] : [];
  if (event.type === "email.complained") return Array.isArray(d.to) ? d.to.map(String) : d.to ? [String(d.to)] : [];
  return [];
}

export async function onRequestPost({ request, env }) {
  const body = await request.text();
  if (body.length > 64 * 1024) return json({ ok: false, error: "too_large" }, 413);
  if (!(await verifySignature(env.RESEND_WEBHOOK_SECRET, request.headers, body))) {
    return json({ ok: false, error: "signature" }, 401);
  }

  let event;
  try { event = JSON.parse(body); } catch { return json({ ok: false, error: "bad_request" }, 400); }

  const emails = addressesOf(event).map((e) => e.trim().toLowerCase()).filter(Boolean);
  let marked = 0;
  for (const email of emails) {
    const r = await env.DB.prepare(
      "UPDATE waitlist SET unsubscribed_at = CURRENT_TIMESTAMP WHERE lower(email) = ?1 AND unsubscribed_at IS NULL"
    ).bind(email).run();
    marked += (r.meta && r.meta.changes) || 0;
  }
  if (marked) console.log(`resend webhook ${event.type}: ${marked} sign-up(s) marked unsubscribed`);

  // Always 200 for a verified event, even when it changes nothing, so Resend doesn't retry it.
  return json({ ok: true, type: event.type || "", marked });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
