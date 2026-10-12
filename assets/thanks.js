/* Thank-you page (/merci/, /en/thanks/): founder number, the day-one question, the referral link
   and ladder, and the brand race. The confirmation link brings the person here with #t=TOKEN;
   the token is kept on this device so the page still works when they come back later. */
(function () {
  "use strict";
  var root = document.querySelector("[data-lang]");
  if (!root) return;
  var lang = root.getAttribute("data-lang") === "en" ? "en" : "fr";

  /* ---- Promises shown on this page. Alex: edit these before the page goes live. ---- */
  var PERKS = {
    fr: {
      founder: "Gardez-le : si vous contribuez, votre numéro sera imprimé sur la carte de démarrage dans votre boîte, et les 500 premiers numéros auront l'insigne Fondateur dans l'application.",
      ladder: [
        { n: 1, text: "Le courriel du lancement en priorité, 30 minutes avant tout le monde." },
        { n: 3, text: "Votre nom dans l'écran de remerciements de l'application." },
        { n: 5, text: "Un deuxième câble offert pour une autre marque, dès qu'elle est vérifiée (avec un module contribué)." }
      ],
      top: "Les 3 meilleurs parrains au lancement reçoivent un module Kurant.",
      rules: "Seuls les amis qui confirment leur adresse comptent. Les inscriptions sont vérifiées à la main avant toute récompense ; les inscriptions fictives sont retirées."
    },
    en: {
      founder: "Keep it: if you back Kurant, your number will be printed on the quick-start card in your box, and the first 500 numbers get the Founder badge in the app.",
      ladder: [
        { n: 1, text: "The launch email first, 30 minutes before everyone else." },
        { n: 3, text: "Your name on the app's thank-you screen." },
        { n: 5, text: "A free second cable for another brand, as soon as it's verified (with a backed module)." }
      ],
      top: "The top 3 referrers at launch get a Kurant module.",
      rules: "Only friends who confirm their address count. Sign-ups are checked by hand before any reward; fake sign-ups are removed."
    }
  }[lang];

  var T = {
    fr: {
      friends: function (n) { return n === 1 ? "ami confirmé" : "amis confirmés"; },
      rung: function (n) { return n === 1 ? "1 ami" : n + " amis"; },
      top: "Top 3",
      copied: "Copié",
      copy: "Copier",
      saved: "Merci, c'est noté.",
      fail: "La réponse n'a pas été enregistrée. Réessayez.",
      shareTitle: "Kurant",
      shareText: "J'attends Kurant : un module qui transforme le téléphone en écran de vélo électrique. Essayez l'application dans votre navigateur :",
      mailSubject: "Ton téléphone comme écran de vélo électrique",
      home: "/"
    },
    en: {
      friends: function (n) { return n === 1 ? "confirmed friend" : "confirmed friends"; },
      rung: function (n) { return n === 1 ? "1 friend" : n + " friends"; },
      top: "Top 3",
      copied: "Copied",
      copy: "Copy",
      saved: "Thanks, noted.",
      fail: "Your answer wasn't saved. Try again.",
      shareTitle: "Kurant",
      shareText: "I'm waiting for Kurant: a module that turns your phone into your e-bike's display. Try the app in your browser:",
      mailSubject: "Your phone as your e-bike's display",
      home: "/en/"
    }
  }[lang];

  var $ = function (id) { return document.getElementById(id); };
  function show(id) {
    ["t-loading", "t-error", "t-pending", "t-ok"].forEach(function (s) { $(s).hidden = s !== id; });
  }

  // Token: from the confirmation link (#t=...), else from an earlier visit on this device.
  var token = "";
  var m = /[#&]t=([0-9a-f]{32})\b/.exec(location.hash);
  try {
    if (m) localStorage.setItem("kurant-t", m[1]);
    token = (m && m[1]) || localStorage.getItem("kurant-t") || "";
  } catch (err) { token = m ? m[1] : ""; }
  // Take the secret out of the address bar, so a shared screenshot or URL can't carry it.
  if (m && history.replaceState) history.replaceState(null, "", location.pathname);

  if (/[?&]e=lien\b/.test(location.search) || !/^[0-9a-f]{32}$/.test(token)) { show("t-error"); return; }

  function post(url, body) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); });
  }

  post("/api/me", { t: token }).then(function (me) {
    if (!me || !me.ok) { show("t-error"); return; }
    if (!me.confirmed) { show("t-pending"); return; }
    fill(me);
    show("t-ok");
  }).catch(function () { show("t-error"); });

  function fill(me) {
    var no = String(me.founder_no || "");
    $("t-no").textContent = no.length < 4 ? ("0000" + no).slice(-4) : no;
    $("t-perk").textContent = PERKS.founder;

    // Day-one question
    var buttons = document.querySelectorAll(".choice-btn");
    function mark(v) {
      Array.prototype.forEach.call(buttons, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-intent") === v)); });
    }
    mark(me.intent);
    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-intent");
        var msg = $("t-intent-msg");
        mark(v);
        post("/api/intent", { t: token, v: v }).then(function (r) {
          msg.className = "form-msg " + (r && r.ok ? "ok" : "err");
          msg.textContent = r && r.ok ? T.saved : T.fail;
        }).catch(function () { msg.className = "form-msg err"; msg.textContent = T.fail; });
      });
    });

    // Personal link and sharing
    var link = location.origin + T.home + "?r=" + me.code;
    var input = $("t-link");
    input.value = link;
    input.addEventListener("focus", function () { input.select(); });
    $("t-copy").addEventListener("click", function () {
      var btn = $("t-copy");
      var done = function () { btn.textContent = T.copied; setTimeout(function () { btn.textContent = T.copy; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { input.select(); });
      else { input.select(); try { document.execCommand("copy"); done(); } catch (err) { /* selected for manual copy */ } }
    });
    var text = T.shareText + " " + link;
    if (navigator.share) {
      var nat = $("t-native");
      nat.hidden = false;
      nat.addEventListener("click", function () {
        navigator.share({ title: T.shareTitle, text: T.shareText, url: link }).catch(function () { /* cancelled */ });
      });
    }
    $("t-fb").href = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(link);
    $("t-wa").href = "https://wa.me/?text=" + encodeURIComponent(text);
    $("t-sms").href = "sms:?&body=" + encodeURIComponent(text);
    $("t-mail").href = "mailto:?subject=" + encodeURIComponent(T.mailSubject) + "&body=" + encodeURIComponent(text);

    // Referral ladder
    var n = me.referrals || 0;
    $("t-refs").textContent = String(n);
    $("t-refs-label").textContent = T.friends(n);
    var ladder = $("t-ladder");
    PERKS.ladder.forEach(function (r) { ladder.appendChild(rung(T.rung(r.n), r.text, n >= r.n)); });
    ladder.appendChild(rung(T.top, PERKS.top, false));
    $("t-rules").textContent = PERKS.rules;

    if (window.KurantRace) window.KurantRace.load($("race"), { lang: lang, highlight: me.family });
  }

  function rung(label, text, reached) {
    var li = document.createElement("li");
    li.className = reached ? "reached" : "";
    var b = document.createElement("b");
    b.textContent = label;
    var s = document.createElement("span");
    s.textContent = text;
    li.appendChild(b);
    li.appendChild(s);
    return li;
  }
})();
