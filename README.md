# kurant.ca

Bilingual landing page for **Kurant by FORGE**: product explanation, compatibility check and the pre-launch list (double opt-in, founder numbers, referrals, brand race).
French at `/`, English at `/en/`. Plain HTML, CSS and JS: no build step.

## Structure

| Path | What |
| --- | --- |
| `index.html` | French home page |
| `en/index.html` | English home page |
| `confidentialite/`, `en/privacy/` | Privacy policy (Quebec Law 25) |
| `assets/site.css` | Styles, following the FORGE brand guide (Obsidienne / Blanc Titane / Cyan Glacial, Inter + JetBrains Mono) |
| `assets/compat.js` | Compatibility list used by "Vérifier mon vélo": the system list and the form. Keep in step with `ebike-profiles` |
| `assets/board.js` | The checker's system list: every system with its stage (4-step meter) and real confirmed votes from `/api/stats`, systems in progress ranked by votes. Later, not planned and other systems share a collapsed "Other systems" disclosure that opens for a selected system, including shared links. The chosen row opens with the result, its details and "M'inscrire pour voter", and stays in sync with the form |
| `assets/site.js` | Compatibility tool and waitlist form |
| `assets/demo.js`, `assets/demo.css` | Hero demo: the app's Ride and Settings screens running its simulator in the browser. Mirrors `ebike-app` (screens, wording, safety rules); only the Simulator source is offered. Keep in step when the app's UI changes |
| `assets/campaign.json`, `assets/campaign.js` | Kickstarter state and link; the script shows the matching banner and buttons |
| `functions/kickstarter.js` | `kurant.ca/kickstarter` short link, redirects to the URL in `campaign.json` (Kickstarter only), else to the waitlist |
| `functions/api/waitlist.js` | Sign-up: stores it in D1 and sends the confirmation email (double opt-in) |
| `functions/api/confirm.js` | The confirmation link: founder number, contact copied to Resend, then the thank-you page |
| `functions/api/me.js`, `intent.js` | Thank-you page data, and the day-one question |
| `functions/api/unsubscribe.js` | Unsubscribe page and one-click unsubscribe (CASL, RFC 8058) |
| `functions/api/stats.js` | Public counts for the brand race (confirmed sign-ups only) |
| `functions/api/admin/` | `resend`, `sync`, `report`: protected by `ADMIN_TOKEN` |
| `functions/_lib/` | Shared code: email (Resend), email texts, helpers |
| `merci/`, `en/thanks/` | Thank-you page: founder number, personal link, referral ladder, brand race |
| `assets/race.js`, `assets/thanks.js` | Brand race (now on the thank-you page only; the home page shows the ranking in the checker, from `board.js`) and thank-you page scripts. The promises shown on the thank-you page are at the top of `thanks.js` |
| `assets/module3d.js` | "Le module, ouvert": the 3D model that opens as you scroll (three.js, loaded only near that section; falls back to the animation video) |
| `assets/model/crown.bin`, `crown.json` | The model, built from the CAD by `tools/build_crown_model.py` (see below) |
| `assets/vendor/three.module.min.js` | three.js r160 (MIT, see `three.LICENSE.txt`), self-hosted for the CSP |
| `assets/media/` | The R4 design-file animation (`crown_r6_story_680.mp4`) and its poster frame |
| `schema.sql` | D1 schema for a new database |
| `migrations/0002_prelaunch.sql` | Run once on the existing database to add the pre-launch list |
| `_headers` | Security headers (CSP, HSTS), and no-cache on `/assets/` so browsers always check for a newer CSS, JS or `campaign.json`. The home pages also tag their CSS and JS links with `?v=DATE`: bump it on both home pages when you change those files, and keep the shared `site.css` tags in the journal, privacy, thank-you and 404 pages in step. Also bump shared script tags on any other page loading a changed file |
| `404.html`, `robots.txt`, `sitemap.xml` | Not-found page, crawler rules, sitemap with FR/EN alternates |
| `assets/og-fr.png`, `assets/og-en.png` | Share images (1200 × 630) for social posts |

## Deploy (Cloudflare Pages)

Everything below is free except the domain (about USD 9 a year for `.ca` at Cloudflare Registrar, at cost).

1. **Domain.** Cloudflare dashboard → **Domain Registration → Register Domains** → `kurant.ca`. CIRA's Canadian-presence rule applies (a Canadian resident qualifies). Registering it here puts its DNS on Cloudflare automatically.
2. **Database.** **Storage & Databases → D1 → Create database** named `kurant-waitlist`. Open its **Console**, paste `schema.sql`, run it.
3. **Pages project.** **Workers & Pages → Create → Pages → Connect to Git** → this repo, production branch `main`. Framework preset *None*, build command `exit 0`, build output directory `/`.
4. **Binding.** Pages project → **Settings → Bindings → Add → D1 database**: variable name `DB`, database `kurant-waitlist`. Then **Deployments → Retry deployment** so the binding takes effect.
5. **Custom domain.** Pages project → **Custom domains** → add `kurant.ca`, then `www.kurant.ca`.
6. **Email.** Domain → **Email → Email Routing** → enable, add the DNS records it proposes, create `bonjour@kurant.ca` forwarding to your inbox and confirm the verification email.
7. **Check.** Open `https://kurant.ca`, sign up with your own email, and confirm the row appears in the D1 console. Then switch on the pre-launch list (below).

Every pull request gets its own preview URL (`*.pages.dev`), where the form is live and `?campaign=` previews work.

To test locally on the same runtime: copy the site to a scratch folder, add a throwaway `wrangler.toml` with a `DB` D1 binding, run `wrangler d1 execute DB --local --file schema.sql`, then `wrangler pages dev .`. Don't commit that `wrangler.toml`: once one exists, it overrides the dashboard bindings.

## Kickstarter campaign

Edit only `assets/campaign.json`, then push:

| `state` | What the site shows |
| --- | --- |
| `off` | Nothing (waitlist only) |
| `prelaunch` | Banner "launching on `launch`, get notified", linking to the pre-launch page |
| `live` | Banner and a main hero button "Back Kurant on Kickstarter" |
| `funded` | Banner "late pledges open" |

- `url`: paste the link Kickstarter generates for the referral tag `kurant-site` (Promotion tab), so pledges from the site show in the creator dashboard. Only `https://*.kickstarter.com` links are used.
- `launch`: `YYYY-MM-DD`, shown in the pre-launch banner.
- `kurant.ca/kickstarter` follows the same file: use it on flyers, QR codes and social bios.
- To preview a state before switching, open any non-production URL with `?campaign=prelaunch`, `live` or `funded`.

## Updating compatibility

Edit `assets/compat.js`: the checker's system list and the form both read it.

- `status` drives the checker: `"ok"` only when the family's profile in `ebike-profiles` is `bench-verified`.
- `stage` drives the ranking: `dev` (in development) → `bench` (a controller on the bench) → `verified` (bench-verified, set together with `status: "ok"`) → `road` (confirmed by riders). `later` and `no` list systems for a future module or not planned.
- Per language, `look` (how to recognize the system), `tested` (hardware it was verified or is being recorded on) and `next` (next step) are optional and shown on the system's card.

Links: `kurant.ca/?systeme=ID#waitlist` (or `/en/?system=ID#waitlist`) opens the form with that system chosen, for example to share "vote for Bafang". Add `?race=demo` on a non-production URL to see the vote counts with made-up numbers.

## Pre-launch list: how it works

1. The form sends the sign-up to `/api/waitlist`. It is stored, and a confirmation email goes out.
2. The person clicks **Confirmer** → `/api/confirm`. They get the next founder number, they are copied to Resend's contact list (FR or EN segment), and they land on `/merci/` or `/en/thanks/`.
3. The thank-you page shows the founder number, asks the day-one question, and gives a personal link `kurant.ca/?r=CODE`. A friend who signs up through it and confirms counts as one referral.
4. `/api/stats` feeds the brand race on the home page and the thank-you page. It appears once 50 people have confirmed.
5. Broadcasts (weekly emails, launch email) are written and sent from Resend's dashboard, to the FR and EN segments. Resend adds its unsubscribe link and handles those unsubscribes.

Only confirmed, still-subscribed sign-ups count anywhere. One inbox is one person: `Jo.Doe+x@gmail.com` and `jodoe@gmail.com` share an entry, so aliases can't farm referrals. One IP can sign up 8 times an hour. An address that never confirms is deleted 30 days after its last confirmation email.

### Switch it on (once)

1. **Resend account.** Create it at resend.com with your own email.
2. **Domain.** In Resend, open **Domains → Add domain** and enter `kurant.ca`. Choose the automatic Cloudflare setup, or copy the DNS records it lists into Cloudflare DNS.
   - The records go on a `send` subdomain and a `resend._domainkey` record, so they don't touch Email Routing for `bonjour@kurant.ca`.
   - Wait for **Verified**.
   - If a record stays pending after an hour, check that it isn't proxied (DNS only, grey cloud).
3. **API key.** In Resend, open **API Keys → Create**, with permission **Sending access**, then copy the key.
   - Sending access is enough for confirmation emails. Copying contacts to segments needs a **Full access** key; use one only if you want the contact sync.
4. **Segments.** In Resend's contacts area (**Audience** or **Contacts**, then **Segments**), create `Kurant FR` and `Kurant EN`. Copy each segment's id.
5. **Variables.** In the Pages project, open **Settings → Variables and secrets** and add the values below under Production:

   | Name | Type | Value |
   | --- | --- | --- |
   | `RESEND_API_KEY` | Secret | the key from step 3 |
   | `MAIL_FROM` | Text | `Kurant <bonjour@kurant.ca>` |
   | `RESEND_SEGMENT_FR` | Text | id of `Kurant FR` |
   | `RESEND_SEGMENT_EN` | Text | id of `Kurant EN` |
   | `ADMIN_TOKEN` | Secret | a long random string (for example, 40 characters from a password manager) |
   | `IP_SALT` | Secret | another random string |
   | `MAIL_POSTAL` | Text | FORGE's mailing address (a PO box works). CASL requires one in every email; until it's set, emails show only "Montréal (Québec), Canada" |

   Never set `MAIL_DEV` in production: it turns sending off.
6. **Database.** In the D1 console of `kurant-waitlist`, paste `migrations/0002_prelaunch.sql` and run it **once**.
   - If it says `duplicate column name`, it has already run.
7. **Deploy.** Merge the pull request, or retry the last deployment so the variables take effect.
8. **Test.** Sign up with your own address. You should get the email within a minute, land on `/merci/` with a founder number, and see your row with `confirmed_at` set.
   - **No email?** In Resend, open **Logs**. A `403` means the domain isn't verified yet. No entry at all means `RESEND_API_KEY` or `MAIL_FROM` is missing (Pages, **Functions → Logs**, shows `mail not configured`).
9. **Older sign-ups.** People who joined before this update have founder numbers 1, 2, 3… in sign-up order, but they still need to confirm. Send them the confirmation email (step "Admin calls" below, `resend`).

Resend's free plan sends 100 emails a day and 3,000 a month, with up to 1,000 marketing contacts. On a busy day, confirmations past the daily cap aren't lost: the person sees "may take a few hours", and `resend` sends them the next day. For the launch month, if the list passes 1,000 contacts, take the paid Marketing plan for that month.

### Admin calls (Windows PowerShell)

Replace `TOKEN` with your `ADMIN_TOKEN`. Use `curl.exe`: plain `curl` in PowerShell is a different command.

```powershell
# The launch gates: confirmed, pending, day-one answers, per system, referral leaders
curl.exe -H "Authorization: Bearer TOKEN" https://kurant.ca/api/admin/report

# Send the confirmation email to sign-ups that never got one (up to 50 per call; repeat until never_emailed_left is 0)
curl.exe -X POST -H "Authorization: Bearer TOKEN" https://kurant.ca/api/admin/resend

# Same, plus ONE reminder to unconfirmed sign-ups whose last email is more than 3 days old
curl.exe -X POST -H "Authorization: Bearer TOKEN" "https://kurant.ca/api/admin/resend?remind=1"

# Copy confirmed sign-ups to Resend's segments (after setting up segments late; repeat until left is 0)
curl.exe -X POST -H "Authorization: Bearer TOKEN" https://kurant.ca/api/admin/sync
```

### Useful D1 queries

```sql
-- Day-one forecast (the launch gate is 60)
SELECT intent, COUNT(*) FROM waitlist WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL GROUP BY intent;
-- Export of the confirmed list
SELECT email, lang, family, voltage, province, founder_no FROM waitlist
 WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL ORDER BY founder_no;
-- Referrers with at least 1 confirmed friend: import this as a CSV into a "Kurant priorité" segment
-- in Resend for the launch email 30 minutes before everyone else
SELECT r.email, r.lang FROM waitlist r
 WHERE r.confirmed_at IS NOT NULL AND r.unsubscribed_at IS NULL
   AND EXISTS (SELECT 1 FROM waitlist f WHERE f.referred_by = r.ref_code AND f.confirmed_at IS NOT NULL AND f.unsubscribed_at IS NULL);
-- Who a referral leader brought in (check before giving a prize)
SELECT email, created_at, confirmed_at FROM waitlist WHERE referred_by = 'CODE' ORDER BY created_at;
```

Every email you send must include FORGE's name, a mailing address and a working unsubscribe link (CASL).

### Local test

As above (`wrangler pages dev .` with a throwaway `wrangler.toml`), plus `--binding MAIL_DEV=1 --binding ADMIN_TOKEN=test`. Nothing is emailed: the form shows the confirmation link instead. Add `?race=demo` to any non-production URL to see the brand race with made-up numbers.

## Updating the 3D model

When the enclosure design changes, export `parts.json` from the CAD folder again, then rebuild:

```bash
pip install numpy fast-simplification
python3 tools/build_crown_model.py path/to/parts.json
```

It rewrites `assets/model/crown.bin` and `crown.json`. Small hardware (pads, inserts, nuts, washers, LEDs) is left out, as in the R4 animation, and the housing is reduced to about 16,000 triangles; its design edges still come from the full-resolution mesh. Keep the model a presentation of the design files: no photorealistic rendering (Kickstarter's hardware rules apply to the campaign page, and the site shows the same thing).
