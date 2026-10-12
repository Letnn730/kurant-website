// The emails the site sends by itself. Everything else is written in Resend's broadcast editor.
// CASL: every message names the sender (FORGE), gives a mailing address and a working unsubscribe link.
// Set MAIL_POSTAL to the mailing address (a PO box works) before sending to the list.

import { escapeHtml } from "./util.js";

const COPY = {
  fr: {
    confirm: {
      subject: "Confirmez votre inscription à Kurant",
      pre: "Un clic pour obtenir votre numéro de fondateur et votre lien personnel.",
      hello: "Bonjour,",
      body: "Merci de votre intérêt pour Kurant. Confirmez votre adresse pour obtenir votre numéro de fondateur et votre lien personnel.",
      button: "Confirmer mon inscription",
      why: "Pendant la campagne Kickstarter, les 100 premiers modules seront à 119 $ au lieu de 159 $. Les inscrits confirmés seront avertis en premier.",
      ignore: "Vous n'avez rien demandé ? Ignorez ce courriel : sans confirmation, vous ne recevrez rien d'autre.",
    },
    again: {
      subject: "Votre lien Kurant",
      pre: "Votre numéro de fondateur et vos parrainages.",
      hello: "Bonjour,",
      body: "Vous êtes déjà inscrit à Kurant. Voici votre page : votre numéro de fondateur, votre lien personnel et les amis qui se sont inscrits grâce à vous.",
      button: "Voir ma page",
      why: "Partagez votre lien : chaque ami confirmé vous fait monter, et fait avancer la marque de son vélo dans la course.",
      ignore: "Vous n'avez rien demandé ? Ignorez ce courriel.",
    },
    footer: (postal) => `FORGE · ${postal} · bonjour@kurant.ca`,
    unsub: "Se désabonner",
    unsubWhy: "Vous recevez ce courriel parce que cette adresse a été inscrite sur kurant.ca.",
  },
  en: {
    confirm: {
      subject: "Confirm your Kurant sign-up",
      pre: "One click to get your founder number and your personal link.",
      hello: "Hi,",
      body: "Thanks for your interest in Kurant. Confirm your address to get your founder number and your personal link.",
      button: "Confirm my sign-up",
      why: "During the Kickstarter campaign, the first 100 modules will be CAD 119 instead of 159. Confirmed sign-ups hear about it first.",
      ignore: "Didn't ask for this? Ignore this email: without confirmation you won't get anything else.",
    },
    again: {
      subject: "Your Kurant link",
      pre: "Your founder number and your referrals.",
      hello: "Hi,",
      body: "You're already on the Kurant list. Here's your page: your founder number, your personal link and the friends who joined through you.",
      button: "See my page",
      why: "Share your link: every confirmed friend moves you up, and moves their bike's brand up the race.",
      ignore: "Didn't ask for this? Ignore this email.",
    },
    footer: (postal) => `FORGE · ${postal} · bonjour@kurant.ca`,
    unsub: "Unsubscribe",
    unsubWhy: "You're getting this email because this address was signed up on kurant.ca.",
  },
};

function render(lang, kind, { actionUrl, unsubUrl, postal }) {
  const L = COPY[lang] || COPY.fr;
  const c = L[kind];
  const footer = L.footer(postal);
  const text = [
    c.hello, "", c.body, "", `${c.button} : ${actionUrl}`, "", c.why, "", c.ignore, "", "—",
    footer, `${L.unsubWhy} ${L.unsub} : ${unsubUrl}`,
  ].join("\n");

  const e = escapeHtml;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F6;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0B0B0C">
<span style="display:none;max-height:0;overflow:hidden">${e(c.pre)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #DDE2E5;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-weight:800;letter-spacing:.22em;font-size:15px">KURANT</td></tr>
<tr><td style="padding:8px 28px 0;font-size:16px;line-height:1.55">
<p style="margin:0 0 14px">${e(c.hello)}</p>
<p style="margin:0 0 22px">${e(c.body)}</p>
<p style="margin:0 0 24px"><a href="${e(actionUrl)}" style="display:inline-block;background:#0091B3;color:#FFFFFF;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:8px">${e(c.button)}</a></p>
<p style="margin:0 0 14px;color:#5D656C">${e(c.why)}</p>
<p style="margin:0 0 24px;color:#8A939A;font-size:14px">${e(c.ignore)}</p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #DDE2E5;font-size:12px;line-height:1.5;color:#8A939A">
${e(footer)}<br>${e(L.unsubWhy)} <a href="${e(unsubUrl)}" style="color:#5D656C">${e(L.unsub)}</a>
</td></tr></table></td></tr></table></body></html>`;

  return { subject: c.subject, html, text };
}

export function confirmEmail(lang, opts) { return render(lang, "confirm", opts); }
export function againEmail(lang, opts) { return render(lang, "again", opts); }

// One-click unsubscribe headers (RFC 8058), which Gmail and Yahoo expect from bulk senders.
export const unsubscribeHeaders = (unsubUrl) => ({
  "List-Unsubscribe": `<${unsubUrl}>, <mailto:bonjour@kurant.ca?subject=unsubscribe>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

export const postalOf = (env) => (env.MAIL_POSTAL && String(env.MAIL_POSTAL).trim()) || "Montréal (Québec), Canada";
