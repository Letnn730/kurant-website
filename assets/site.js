(function () {
  "use strict";
  var root = document.querySelector("[data-lang]");
  if (!root) return;
  var lang = root.getAttribute("data-lang") === "en" ? "en" : "fr";
  var data = window.KURANT_COMPAT;

  // Outside the real site (e.g. a design preview), the form shows a message instead of sending.
  var LIVE = /(^|\.)kurant\.ca$|\.pages\.dev$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);

  var T = {
    fr: {
      choose: "Choisir…",
      status: { ok: "Pris en charge", check: "À vérifier", no: "Non pris en charge pour le moment", idle: "En attente" },
      idle: "Choisissez le système et la tension de votre vélo pour voir le résultat.",
      okText: "Votre configuration est prévue au lancement.",
      sending: "Envoi…",
      done: function (e) { return "Presque fini\u202F: ouvrez le courriel envoyé à " + e + " et cliquez «\u202FConfirmer\u202F» pour obtenir votre numéro de fondateur et votre lien personnel. Pensez à vérifier les indésirables."; },
      again: function (e) { return "Vous êtes déjà inscrit\u202F: nous venons d'envoyer à " + e + " le lien vers votre page (numéro de fondateur et parrainages)."; },
      recent: "Un courriel vous a été envoyé il y a quelques minutes\u202F: vérifiez votre boîte de réception et les indésirables.",
      queued: "Inscription reçue. Le courriel de confirmation peut prendre quelques heures à arriver.",
      slow: "Trop d'inscriptions depuis cet appareil. Réessayez dans une heure.",
      family: "Choisissez le système de votre vélo (ou «\u202FAutre marque\u202F»).",
      devLink: "Lien de confirmation (test local)",
      preview: "Aperçu\u202F: rien n'a été envoyé. Le formulaire sera actif sur kurant.ca.",
      fail: "L'inscription n'a pas fonctionné. Vérifiez votre connexion et réessayez.",
      email: "Entrez une adresse courriel valide.",
      consent: "Cochez la case de consentement pour vous inscrire."
    },
    en: {
      choose: "Choose…",
      status: { ok: "Supported", check: "To be confirmed", no: "Not supported yet", idle: "Waiting" },
      idle: "Choose your bike's system and voltage to see the result.",
      okText: "Your setup is planned for launch.",
      sending: "Sending…",
      done: function (e) { return "Almost done: open the email sent to " + e + " and click \u201cConfirm\u201d to get your founder number and your personal link. Check your spam folder too."; },
      again: function (e) { return "You're already on the list: we just sent " + e + " the link to your page (founder number and referrals)."; },
      recent: "We sent you an email a few minutes ago: check your inbox and your spam folder.",
      queued: "Sign-up received. The confirmation email may take a few hours to arrive.",
      slow: "Too many sign-ups from this device. Try again in an hour.",
      family: "Choose your bike's system (or \u201cOther brand\u201d).",
      devLink: "Confirmation link (local test)",
      preview: "Preview: nothing was sent. The form will be live on kurant.ca.",
      fail: "Sign-up didn't go through. Check your connection and try again.",
      email: "Enter a valid email address.",
      consent: "Tick the consent box to sign up."
    }
  }[lang];

  var rank = { ok: 0, check: 1, no: 2 };
  var famSel = document.getElementById("chk-family");
  var voltSel = document.getElementById("chk-volt");
  var chip = document.getElementById("chk-chip");
  var text = document.getElementById("chk-text");

  function fill(select, list) {
    var first = document.createElement("option");
    first.value = ""; first.textContent = T.choose;
    select.appendChild(first);
    list.forEach(function (item) {
      var o = document.createElement("option");
      o.value = item.id; o.textContent = item[lang].name;
      select.appendChild(o);
    });
  }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }

  // The form says the sign-up counts as a vote for the chosen system (not for "not planned" or "other").
  var voteNote = null;
  function noteVote(f) {
    var wlForm = document.getElementById("waitlist");
    var perk = wlForm ? wlForm.querySelector(".perk") : null;
    if (!perk) return;
    var show = f && f.stage !== "no" && f.stage !== "other";
    if (!voteNote) {
      voteNote = document.createElement("p");
      voteNote.className = "invited";
      perk.parentNode.insertBefore(voteNote, perk.nextSibling);
    }
    voteNote.hidden = !show;
    if (show) voteNote.textContent = (lang === "en" ? "Your confirmed sign-up will count as a vote for: " : "Votre inscription confirmée comptera comme un vote pour\u202F: ") + f[lang].name;
  }

  function update() {
    var f = find(data.families, famSel.value);
    var v = find(data.voltages, voltSel.value);
    noteVote(f);
    // The system list (assets/board.js) follows the choice, wherever it was made.
    document.dispatchEvent(new CustomEvent("kurant:system", { detail: famSel.value }));
    if (!f || !v) {
      chip.className = "chip idle"; chip.textContent = T.status.idle; text.textContent = T.idle;
      return;
    }
    var worst = rank[f.status] >= rank[v.status] ? f.status : v.status;
    chip.className = "chip " + worst;
    chip.textContent = T.status[worst];
    var notes = [];
    if (f[lang].note) notes.push(f[lang].note);
    if (v[lang].note) notes.push(v[lang].note);
    if (worst === "ok") notes.unshift(T.okText);
    text.textContent = notes.join(" ");
  }

  var wlFam = document.getElementById("wl-family");
  if (famSel && voltSel && data) {
    fill(famSel, data.families);
    fill(voltSel, data.voltages);
    famSel.addEventListener("change", function () { if (wlFam) wlFam.value = famSel.value; update(); });
    voltSel.addEventListener("change", update);
    update();
  }
  if (wlFam && data) {
    fill(wlFam, data.families);
    wlFam.addEventListener("change", function () { if (famSel) { famSel.value = wlFam.value; update(); } });
  }

  // Choose a system from the list's "Sign up to vote" button (assets/board.js), or from a shared
  // link ?systeme=ID / ?system=ID. With opts.scroll, the form comes into view, ready for the email.
  function pickSystem(id, opts) {
    var f = data ? find(data.families, String(id || "").toLowerCase()) : null;
    if (!f) return;
    if (famSel) famSel.value = f.id;
    if (wlFam) wlFam.value = f.id;
    if (famSel && voltSel) update();
    var wlForm = document.getElementById("waitlist");
    if (opts && opts.scroll && wlForm) {
      wlForm.classList.add("from-compat");
      wlForm.scrollIntoView({ block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#waitlist");
      var email = document.getElementById("wl-email");
      if (email) email.focus({ preventScroll: true });
    }
  }
  window.KurantPick = pickSystem;
  var pick = /[?&]system(?:e)?=([a-z0-9-]+)/i.exec(location.search);
  if (pick) pickSystem(pick[1]);

  // Referral: kurant.ca/?r=CODE. Remembered on this device so it survives a browse around the site.
  var ref = "";
  var m = /[?&]r=([0-9a-z]{6})\b/i.exec(location.search);
  try {
    if (m) localStorage.setItem("kurant-ref", m[1].toLowerCase());
    ref = localStorage.getItem("kurant-ref") || "";
  } catch (err) { ref = m ? m[1].toLowerCase() : ""; }
  var invited = document.getElementById("wl-invited");
  if (ref && invited) invited.hidden = false;

  // Navigation: highlight the section on screen.
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"]'));
  if (navLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = byId[en.target.id];
        if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) spy.observe(el); });
  }

  // Phones: a slim "join the list" bar once the hero is gone, hidden while the form is on screen.
  var mcta = document.querySelector(".m-cta");
  var hero = document.querySelector(".hero");
  var formZone = document.getElementById("verifier") || document.getElementById("check");
  if (mcta && hero && formZone && "IntersectionObserver" in window) {
    var pastHero = false, atForm = false, atModel = false;
    mcta.hidden = false;
    var sync = function () { mcta.classList.toggle("show", pastHero && !atForm && !atModel); };
    var model = document.getElementById("module");
    if (model) new IntersectionObserver(function (en) { atModel = en[0].isIntersecting; sync(); }).observe(model);
    new IntersectionObserver(function (en) { pastHero = !en[0].isIntersecting; sync(); }).observe(hero);
    new IntersectionObserver(function (en) { atForm = en[0].isIntersecting; sync(); }).observe(formZone);
  }

  // Waitlist
  var form = document.getElementById("waitlist");
  var msg = document.getElementById("form-msg");
  if (!form) return;
  function say(kind, s) { msg.className = "form-msg " + kind; msg.textContent = s; }
  // Local test runs only (MAIL_DEV=1): the API returns the confirmation link instead of emailing it.
  function devLink(url) {
    var a = document.createElement("a");
    a.href = url; a.textContent = T.devLink; a.className = "dev-link";
    msg.appendChild(document.createElement("br"));
    msg.appendChild(a);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("err", T.email); form.email.focus(); return; }
    var family = wlFam ? wlFam.value : (famSel ? famSel.value : "");
    if (wlFam && !family) { say("err", T.family); wlFam.focus(); return; }
    if (!form.consent.checked) { say("err", T.consent); form.consent.focus(); return; }
    var phone = form.querySelector('input[name="phone"]:checked');
    var payload = {
      email: email,
      bike: form.bike.value.trim(),
      controller_label: form.controller_label.value.trim(),
      family: family,
      voltage: voltSel ? voltSel.value : "",
      phone_os: phone ? phone.value : "",
      province: form.province.value,
      lang: lang,
      consent: true,
      consent_version: form.getAttribute("data-consent-version"),
      website: form.website.value,
      ref: ref
    };
    if (!LIVE) { say("ok", T.preview); return; }
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; say("", T.sending);
    fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (res) {
        if (res && res.ok) {
          if (res.throttled) say("ok", T.recent);
          else if (res.email_sent === false) say("ok", T.queued);
          else if (res.status === "confirmed") say("ok", T.again(email));
          else say("ok", T.done(email));
          if (res.dev_links) devLink(res.dev_links.confirmUrl);
          form.reset();
        }
        else if (res && res.error === "email") say("err", T.email);
        else if (res && res.error === "slow_down") say("err", T.slow);
        else say("err", T.fail);
      })
      .catch(function () { say("err", T.fail); })
      .then(function () { btn.disabled = false; });
  });
})();
