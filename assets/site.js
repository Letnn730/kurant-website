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
      details: "Merci\u202F! Vos précisions sont enregistrées. Il reste à confirmer votre courriel.",
      skipped: "D'accord. Vous pourrez ajouter ces précisions plus tard en vous réinscrivant avec le même courriel.",
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
      details: "Thanks! Your details are saved. All that's left is to confirm your email.",
      skipped: "No problem. You can add these details later by signing up again with the same email.",
      devLink: "Confirmation link (local test)",
      preview: "Preview: nothing was sent. The form will be live on kurant.ca.",
      fail: "Sign-up didn't go through. Check your connection and try again.",
      email: "Enter a valid email address.",
      consent: "Tick the consent box to sign up."
    }
  }[lang];

  // Anonymous funnel counters (functions/api/event.js): one count per event and label per page
  // view, no cookie or identifier. Only on the real site and its previews.
  var tracked = {};
  function track(name, label) {
    var key = name + "|" + (label || "");
    if (!LIVE || tracked[key]) return;
    tracked[key] = true;
    try {
      var body = new Blob([JSON.stringify({ e: name, l: label || "", p: lang })], { type: "application/json" });
      if (!(navigator.sendBeacon && navigator.sendBeacon("/api/event", body))) {
        fetch("/api/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
      }
    } catch (err) { /* Counting never gets in the way of the page. */ }
  }
  window.KurantTrack = track;
  document.addEventListener("click", function (e) {
    var el = e.target.closest ? e.target.closest("[data-track]") : null;
    if (el) track(el.getAttribute("data-track"));
  });
  function firstTouch(el, name) {
    if (!el) return;
    var go = function () { track(name); el.removeEventListener("pointerdown", go); el.removeEventListener("keydown", go); el.removeEventListener("input", go); };
    el.addEventListener("pointerdown", go); el.addEventListener("keydown", go); el.addEventListener("input", go);
  }
  firstTouch(document.querySelector("[data-demo]"), "demo_interact");
  firstTouch(document.querySelector("[data-m3d]"), "module_interact");

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
    // The confirmation line sits under the vote field (or the perk, on pages without one).
    var perk = wlForm ? (wlForm.querySelector("[data-vote-field]") || wlForm.querySelector(".perk")) : null;
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

  var touched = false;
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
    if (touched) track("compat_result", worst);
  }

  var wlFam = document.getElementById("wl-family");
  if (famSel && voltSel && data) {
    fill(famSel, data.families);
    fill(voltSel, data.voltages);
    famSel.addEventListener("change", function () {
      if (wlFam) wlFam.value = famSel.value;
      touched = true;
      if (famSel.value) track("compat_pick", famSel.value);
      update();
    });
    voltSel.addEventListener("change", function () { touched = true; update(); });
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
    var zone = document.getElementById("inscription") || document.getElementById("signup") || wlForm;
    if (opts && opts.scroll && wlForm) {
      wlForm.classList.add("from-compat");
      zone.scrollIntoView({ block: "start" });
      if (history.replaceState) history.replaceState(null, "", "#" + zone.id);
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

  // Quiet entrances: content below the first screen fades up once, as it arrives. Nothing on the
  // first screen is touched (no flash), and nothing moves for people who ask for reduced motion.
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var revealSel = ".env .section-head, .plate, .ba-after, .ba-item figcaption, .how-steps li, .need, .stages, .check-panel, " +
      ".sheet > div, .rules-list li, .log-preview, .journal-more, .prices > *, .ks-facts, .budget, .signup, .next li, .faq-group";
    var fold = innerHeight * 0.92;
    var shown = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        shown.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll(revealSel), function (el) {
      if (el.closest(".m3d") || el.getBoundingClientRect().top < fold) return;
      var i = 0, sib = el;
      while ((sib = sib.previousElementSibling) && i < 5) if (sib.matches(revealSel)) i++;
      el.style.setProperty("--d", (i * 0.06).toFixed(2) + "s");
      el.classList.add("rv");
      shown.observe(el);
    });
  }

  // Phones: a slim "join the list" bar once the hero is gone, hidden while the form is on screen.
  var mcta = document.querySelector(".m-cta");
  var hero = document.querySelector(".hero");
  var formZone = document.getElementById("inscription") || document.getElementById("signup") || document.getElementById("verifier") || document.getElementById("check");
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

  // Step 1: the email and consent are all that's needed. The system chosen in the checker, if any,
  // goes with it (it counts as a vote once the email is confirmed).
  // Step 2 (optional): bike details, sent as a second sign-up with the same email. The API keeps
  // the earlier answers, fills in the new ones, and sends no second email within a few minutes.
  var step1 = form.querySelector("[data-su-step1]");
  var details = form.querySelector("[data-su-details]");
  var sentEmail = "";
  var emailIn = document.getElementById("wl-email");
  if (emailIn) emailIn.addEventListener("focus", function () { track("signup_start"); });

  function payload(email) {
    var phone = form.querySelector('input[name="phone"]:checked');
    return {
      email: email,
      bike: form.bike ? form.bike.value.trim() : "",
      controller_label: form.controller_label ? form.controller_label.value.trim() : "",
      family: (wlFam && wlFam.value) || (famSel && famSel.value) || "",
      voltage: voltSel ? voltSel.value : "",
      phone_os: phone ? phone.value : "",
      province: form.province ? form.province.value : "",
      lang: lang,
      consent: true,
      consent_version: form.getAttribute("data-consent-version"),
      website: form.website.value,
      ref: ref
    };
  }
  function post(body) {
    return fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  }
  function fail(res) {
    if (res && res.error === "email") say("err", T.email);
    else if (res && res.error === "slow_down") say("err", T.slow);
    else say("err", T.fail);
  }
  function showDetails() {
    if (!details) return;
    if (step1) step1.hidden = true;
    details.hidden = false;
    var first = details.querySelector("select, input");
    if (first) first.focus({ preventScroll: true });
  }
  function closeDetails(text) {
    if (details) details.hidden = true;
    if (text) {
      var p = document.createElement("span");
      p.textContent = " " + text;
      msg.appendChild(p);
    }
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sentEmail) {
      // Enter in a details field sends the details.
      var send = form.querySelector("[data-su-send]");
      if (details && !details.hidden && send) send.click();
      return;
    }
    var email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say("err", T.email); form.email.focus(); return; }
    if (!form.consent.checked) { say("err", T.consent); form.consent.focus(); return; }
    var body = payload(email);
    if (!LIVE) { say("ok", T.preview); sentEmail = email; showDetails(); return; }
    var btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; say("", T.sending);
    post(body)
      .then(function (res) {
        if (res && res.ok) {
          if (res.throttled) say("ok", T.recent);
          else if (res.email_sent === false) say("ok", T.queued);
          else if (res.status === "confirmed") say("ok", T.again(email));
          else say("ok", T.done(email));
          if (res.dev_links) devLink(res.dev_links.confirmUrl);
          track("signup_submit_ok");
          sentEmail = email;
          showDetails();
        }
        else fail(res);
      })
      .catch(function () { say("err", T.fail); })
      .then(function () { btn.disabled = false; });
  });

  var sendBtn = form.querySelector("[data-su-send]");
  var skipBtn = form.querySelector("[data-su-skip]");
  if (skipBtn) skipBtn.addEventListener("click", function () { track("signup_details_skip"); closeDetails(T.skipped); });
  if (sendBtn) sendBtn.addEventListener("click", function () {
    if (!sentEmail) return;
    if (!LIVE) { closeDetails(T.details); return; }
    sendBtn.disabled = true;
    post(payload(sentEmail))
      .then(function (res) {
        if (res && res.ok) { track("signup_details_ok"); closeDetails(T.details); }
        else fail(res);
      })
      .catch(function () { say("err", T.fail); })
      .then(function () { sendBtn.disabled = false; });
  });
})();
