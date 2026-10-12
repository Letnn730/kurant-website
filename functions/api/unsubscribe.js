// /api/unsubscribe?t=TOKEN
//   GET  shows a page with one button. Link scanners in mail systems open every link, so a GET alone
//        never unsubscribes anyone.
//   POST unsubscribes: the button on that page, or a mail client's one-click unsubscribe (RFC 8058).
// CASL asks for unsubscribes to take effect within 10 business days; this one is immediate.

import { TOKEN_RE, escapeHtml } from "../_lib/util.js";
import { syncContact } from "../_lib/mail.js";

const T = {
  fr: {
    title: "Désabonnement – Kurant",
    ask: "Ne plus recevoir de courriels de Kurant ?",
    askP: "Vous ne recevrez plus rien de FORGE au sujet de Kurant. Vous pourrez vous réinscrire sur kurant.ca en tout temps.",
    button: "Me désabonner",
    done: "C'est fait.",
    doneP: "Vous ne recevrez plus de courriels de Kurant. Vous pouvez vous réinscrire sur kurant.ca en tout temps.",
    bad: "Ce lien ne fonctionne pas.",
    badP: "Écrivez à bonjour@kurant.ca avec l'objet « désabonnement » : nous retirons votre adresse à la main.",
    home: "Retour à kurant.ca",
    homeUrl: "/",
  },
  en: {
    title: "Unsubscribe – Kurant",
    ask: "Stop getting Kurant emails?",
    askP: "You won't get anything more from FORGE about Kurant. You can sign up again on kurant.ca any time.",
    button: "Unsubscribe me",
    done: "Done.",
    doneP: "You won't get any more Kurant emails. You can sign up again on kurant.ca any time.",
    bad: "This link doesn't work.",
    badP: "Write to bonjour@kurant.ca with the subject \"unsubscribe\" and we'll remove your address by hand.",
    home: "Back to kurant.ca",
    homeUrl: "/en/",
  },
};

function page(lang, heading, body, form) {
  const t = T[lang] || T.fr;
  const e = escapeHtml;
  return new Response(
    `<!doctype html><html lang="${lang === "en" ? "en-CA" : "fr-CA"}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>${e(t.title)}</title>
<style>
body{margin:0;background:#0B0B0C;color:#fff;font:17px/1.6 Inter,system-ui,Segoe UI,Arial,sans-serif;display:grid;min-height:100vh;place-items:center;padding:20px;box-sizing:border-box}
main{max-width:34rem;display:grid;gap:18px}
.w{font-weight:800;letter-spacing:.22em;font-size:15px}
h1{margin:0;font-size:28px;line-height:1.2}
p{margin:0;color:#A3A9AE}
button{font:600 15px/1 Inter,system-ui,sans-serif;background:#00D2FF;color:#0B0B0C;border:0;border-radius:8px;padding:14px 20px;cursor:pointer;justify-self:start}
a{color:#A3A9AE}
</style></head><body><main>
<span class="w">KURANT</span><h1>${e(heading)}</h1><p>${e(body)}</p>${form || ""}
<p><a href="${t.homeUrl}">${e(t.home)}</a></p>
</main></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  );
}

async function lookup(env, request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!TOKEN_RE.test(token)) return null;
  const row = await env.DB.prepare("SELECT email, lang, unsubscribed_at FROM waitlist WHERE token = ?1").bind(token).first();
  return row ? { ...row, token } : null;
}

export async function onRequestGet({ request, env }) {
  const row = await lookup(env, request);
  if (!row) return page("fr", T.fr.bad, T.fr.badP);
  const t = T[row.lang] || T.fr;
  if (row.unsubscribed_at) return page(row.lang, t.done, t.doneP);
  const action = `/api/unsubscribe?t=${row.token}`;
  return page(row.lang, t.ask, t.askP, `<form method="post" action="${action}"><button type="submit">${escapeHtml(t.button)}</button></form>`);
}

export async function onRequestPost({ request, env, waitUntil }) {
  const row = await lookup(env, request);
  if (!row) return page("fr", T.fr.bad, T.fr.badP);
  if (!row.unsubscribed_at) {
    await env.DB.prepare("UPDATE waitlist SET unsubscribed_at = CURRENT_TIMESTAMP WHERE token = ?1").bind(row.token).run();
    waitUntil(syncContact(env, { email: row.email, lang: row.lang, unsubscribed: true }));
  }
  const t = T[row.lang] || T.fr;
  return page(row.lang, t.done, t.doneP);
}
