// POST /api/event { e, l, p }: anonymous funnel counters for the home pages.
// Only a daily count per (page language, event, label) is kept: no IP address, no cookie, no
// identifier, nothing that links two events to the same person. The page sends at most one of
// each event per page view (assets/site.js), only on kurant.ca and its previews.
// Counts are indicative: anyone can post to this endpoint, so they guide design choices, not
// money decisions. The real numbers (sign-ups, confirmations) stay in the waitlist table.

import { json, oneOf, readJson } from "../_lib/util.js";

// Keep in step with data-track attributes and track() calls in assets/site.js.
const EVENTS = [
  "cta_nav_signup", "cta_hero_signup", "cta_hero_compat", "cta_how_compat", "cta_ks_signup",
  "cta_mobile_signup", "compat_pick", "compat_result", "demo_interact", "module_interact",
  "journal_open", "signup_start", "signup_submit_ok", "signup_details_ok", "signup_details_skip",
];
// Labels allowed per event; any other event takes no label.
const FAMILIES = ["kt", "bafang-uart", "bafang-can", "lishui", "rad-lishui", "rad-asi", "lectric",
  "happyrun-48", "happyrun-pro", "aventon", "bosch", "shimano", "other"];
const LABELS = {
  compat_pick: FAMILIES,
  compat_result: ["ok", "check", "no"],
};

export async function onRequestPost({ request, env }) {
  const data = await readJson(request, 256);
  const name = data ? oneOf(data.e, EVENTS) : "";
  if (!name) return json({ ok: false, error: "bad_request" }, 400);
  const label = LABELS[name] ? oneOf(data.l, LABELS[name]) : "";
  const page = oneOf(data.p, ["fr", "en"]) || "fr";

  try {
    await env.DB.prepare(
      `INSERT INTO events (day, page, name, label, n) VALUES (date('now'), ?1, ?2, ?3, 1)
       ON CONFLICT (day, page, name, label) DO UPDATE SET n = n + 1`
    ).bind(page, name, label).run();
  } catch (err) {
    // Table not created yet (migrations/0003_events.sql): the page never waits on this, so just say so.
    return json({ ok: false, error: "unavailable" }, 503);
  }
  return json({ ok: true });
}

export async function onRequest() {
  return json({ ok: false, error: "method" }, 405);
}
