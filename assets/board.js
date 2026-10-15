/* "Où en est chaque marque" / "Where each brand stands", under the checker and the
   pre-launch form on the home pages (#marques, #brands).

   Draws every family from assets/compat.js with a 4-step progress meter and the real
   vote count: confirmed, still-subscribed sign-ups per system, from /api/stats.
   Order: ready systems, then systems in progress from most to least voted (ties keep
   the compat.js order), then later, then not planned.

   "Vote for this system" chooses that system in the checker and the form
   (window.KurantPick, assets/site.js) and brings the form into view.
   Also fills the Kickstarter section's "N people have confirmed" line once
   SHOW_TOTAL_MIN people have confirmed, as the brand race did. */
(function () {
  "use strict";
  var root = document.querySelector("[data-board]");
  var data = window.KURANT_COMPAT;
  if (!root || !data) return;
  var lang = root.getAttribute("data-board") === "en" ? "en" : "fr";
  var locale = lang === "en" ? "en-CA" : "fr-CA";
  var SHOW_TOTAL_MIN = 50;

  var T = {
    fr: {
      steps: ["Étudié", "Au banc", "Vérifié au banc", "Confirmé sur la route"],
      stepOf: function (n) { return "Étape " + n + " sur 4"; },
      chip: { road: "Confirmé sur la route", verified: "Vérifié au banc", bench: "Au banc", dev: "En développement", later: "Plus tard", no: "Pas prévu" },
      look: "Comment le reconnaître",
      tested: { road: "Vérifié avec", verified: "Vérifié avec", bench: "Au banc avec" },
      next: "Prochaine étape",
      details: "Détails",
      done: "Terminé",
      empty: "Aucun système pour le moment.",
      votes: function (n) { return n === 1 ? "vote confirmé" : "votes confirmés"; },
      signups: function (n) { return n === 1 ? "inscrit confirmé" : "inscrits confirmés"; },
      total: function (n) { return n.toLocaleString(locale) + (n === 1 ? " vote confirmé au total" : " votes confirmés au total"); },
      lead: "En tête",
      act: { ready: "Rejoindre la liste", progress: "Voter pour ce système", later: "M'inscrire pour ce système" },
      ks: function (n) { return n.toLocaleString(locale) + " personnes ont déjà confirmé leur inscription."; }
    },
    en: {
      steps: ["Researched", "On the bench", "Bench-verified", "Road-confirmed"],
      stepOf: function (n) { return "Step " + n + " of 4"; },
      chip: { road: "Road-confirmed", verified: "Bench-verified", bench: "On the bench", dev: "In development", later: "Later", no: "Not planned" },
      look: "How to recognize it",
      tested: { road: "Verified with", verified: "Verified with", bench: "On the bench with" },
      next: "Next step",
      details: "Details",
      done: "Done",
      empty: "No systems here yet.",
      votes: function (n) { return n === 1 ? "confirmed vote" : "confirmed votes"; },
      signups: function (n) { return n === 1 ? "confirmed sign-up" : "confirmed sign-ups"; },
      total: function (n) { return n.toLocaleString(locale) + (n === 1 ? " confirmed vote in total" : " confirmed votes in total"); },
      lead: "Leading",
      act: { ready: "Join the list", progress: "Vote for this system", later: "Sign up for this system" },
      ks: function (n) { return n.toLocaleString(locale) + " people have already confirmed."; }
    }
  }[lang];

  var STEP = { dev: 1, bench: 2, verified: 3, road: 4 };
  var GROUP = { road: "ready", verified: "ready", bench: "progress", dev: "progress", later: "later", no: "no" };
  var ORDER = { road: 0, verified: 1 };
  var CHIP = { road: "ok", verified: "ok", bench: "check", dev: "check", later: "idle", no: "no" };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function num(n) { return n.toLocaleString(locale); }

  function checkMark() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "cp-check");
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", "M3 8.5l3.2 3.2L13 4.8");
    svg.appendChild(p);
    return svg;
  }

  function meter(stage) {
    var at = STEP[stage];
    var ol = el("ol", "cp-meter");
    ol.setAttribute("aria-label", T.stepOf(at));
    // Steps before the current one are done. The current step is done too once
    // the system is verified; otherwise it is the step being worked on.
    var reached = stage === "verified" || stage === "road";
    T.steps.forEach(function (label, i) {
      var n = i + 1;
      var done = n < at || (n === at && reached);
      var li = el("li", done ? "done" : n === at ? "now" : "");
      if (done) li.appendChild(checkMark());
      li.appendChild(el("span", null, label));
      if (n === at) li.setAttribute("aria-current", "step");
      ol.appendChild(li);
    });
    return ol;
  }

  function facts(f) {
    var t = f[lang];
    var dl = el("dl", "cp-facts");
    function row(k, v) {
      if (!v) return;
      var d = el("div");
      d.appendChild(el("dt", null, k));
      d.appendChild(el("dd", null, v));
      dl.appendChild(d);
    }
    row(T.look, t.look);
    if (t.tested && t.tested.length) row(T.tested[f.stage] || T.tested.verified, t.tested.join(" · "));
    if (STEP[f.stage]) row(T.next, t.next);
    return dl.childNodes.length ? dl : null;
  }

  // The vote button: chooses the system in the checker and the form, then shows the form.
  function voteButton(f, group) {
    var a = el("a", "btn btn-sm " + (group === "ready" ? "btn-primary" : "btn-ghost"), T.act[group]);
    a.href = "#waitlist";
    a.setAttribute("data-pick", f.id);
    return a;
  }

  // ctx = { n (votes, null while unknown), max, lead }
  function votes(f, group, ctx) {
    var box = el("div", "cp-votes");
    if (ctx.n != null) {
      var head = el("div", "cp-votes-head");
      head.appendChild(el("b", null, num(ctx.n)));
      head.appendChild(el("span", null, group === "ready" ? T.signups(ctx.n) : T.votes(ctx.n)));
      if (ctx.lead) head.appendChild(el("small", "tag tag-lead", T.lead));
      box.appendChild(head);
      if (group === "progress") {
        var track = el("div", "race-track" + (ctx.lead ? " is-lead" : ""));
        var bar = el("i");
        bar.style.width = (ctx.n === 0 ? 0 : Math.max(3, Math.round(ctx.n / Math.max(1, ctx.max) * 100))) + "%";
        track.appendChild(bar);
        box.appendChild(track);
      }
    }
    box.appendChild(voteButton(f, group));
    return box;
  }

  function card(f, group, ctx) {
    var t = f[lang];
    var ready = group === "ready";
    var art = el("article", "cp-item" + (ready ? " is-ready" : "") + (ctx.lead ? " is-lead" : ""));
    art.id = "sys-" + f.id;

    var head = el("div", "cp-item-head");
    var title = el("h5", null);
    if (ready) {
      var badge = el("span", "cp-badge");
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", T.done);
      badge.appendChild(checkMark());
      title.appendChild(badge);
    }
    title.appendChild(document.createTextNode(t.name));
    head.appendChild(title);
    head.appendChild(el("span", "chip " + CHIP[f.stage], T.chip[f.stage]));
    art.appendChild(head);
    art.appendChild(meter(f.stage));

    var dl = facts(f);
    if (ready) {
      // Proof first: what it was verified with, and what is included.
      if (dl) art.appendChild(dl);
      art.appendChild(el("p", "cp-note", t.note));
    } else if (dl) {
      var more = el("details", "cp-more");
      more.appendChild(el("summary", null, T.details));
      more.appendChild(dl);
      art.appendChild(more);
    }
    art.appendChild(votes(f, group, ctx));
    return art;
  }

  // Later and not planned: one compact row each.
  function row(f, group, n) {
    var t = f[lang];
    var li = el("li", "cp-row");
    li.id = "sys-" + f.id;
    var text = el("div", "cp-row-text");
    text.appendChild(el("b", null, t.name));
    text.appendChild(el("span", null, t.note));
    li.appendChild(text);
    if (group === "later") {
      var side = el("div", "cp-row-side");
      if (n != null) side.appendChild(el("small", null, num(n) + " " + T.votes(n)));
      var a = el("a", "dev-link", T.act.later);
      a.href = "#waitlist";
      a.setAttribute("data-pick", f.id);
      side.appendChild(a);
      li.appendChild(side);
    }
    return li;
  }

  // stats = { total, families: { id: n } }, or null while loading or unavailable.
  function render(stats) {
    var fam = stats ? stats.families || {} : null;
    var buckets = { ready: [], progress: [], later: [], no: [] };
    data.families.forEach(function (f, i) {
      var g = GROUP[f.stage];
      if (g) buckets[g].push({ f: f, i: i, n: fam ? fam[f.id] || 0 : null });
    });
    buckets.ready.sort(function (a, b) { return (ORDER[a.f.stage] - ORDER[b.f.stage]) || (a.i - b.i); });
    // Most voted first; ties (and the loading state) keep the planned order.
    buckets.progress.sort(function (a, b) { return ((b.n || 0) - (a.n || 0)) || (a.i - b.i); });
    var max = 0;
    buckets.progress.forEach(function (x) { if ((x.n || 0) > max) max = x.n; });

    Object.keys(buckets).forEach(function (key) {
      var box = root.querySelector('[data-group="' + key + '"]');
      if (!box) return;
      box.textContent = "";
      if (!buckets[key].length) { box.appendChild(el("p", "hint", T.empty)); return; }
      buckets[key].forEach(function (x, idx) {
        if (key === "later" || key === "no") box.appendChild(row(x.f, key, x.n));
        else box.appendChild(card(x.f, key, { n: x.n, max: max, lead: key === "progress" && idx === 0 && x.n > 0 }));
      });
    });

    var total = root.querySelector("[data-board-total]");
    if (total) {
      total.hidden = !stats;
      if (stats) total.textContent = T.total(stats.total || 0);
    }
    if (stats && stats.total >= SHOW_TOTAL_MIN) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-ks-count]"), function (n) {
        n.textContent = T.ks(stats.total);
        n.hidden = false;
      });
    }
    reveal();
  }

  // #sys-ID (from the checker's "See where this system stands"): outline that card.
  function reveal() {
    var id = location.hash.slice(1);
    Array.prototype.forEach.call(root.querySelectorAll(".is-target"), function (n) { n.classList.remove("is-target"); });
    if (!/^sys-[a-z0-9-]+$/.test(id)) return;
    var target = document.getElementById(id);
    if (target) target.classList.add("is-target");
  }
  window.addEventListener("hashchange", reveal);

  root.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("[data-pick]") : null;
    if (!a || !window.KurantPick) return;
    e.preventDefault();
    window.KurantPick(a.getAttribute("data-pick"), { scroll: true });
  });

  render(null);

  // Real numbers on kurant.ca and previews. A made-up set only off production with ?race=demo,
  // to check the layout.
  var PROD = /(^|\.)kurant\.ca$/.test(location.hostname);
  if (!PROD && /[?&]race=demo\b/.test(location.search)) {
    render({ total: 312, families: { kt: 121, "bafang-uart": 64, lectric: 41, "rad-asi": 22, "rad-lishui": 9, lishui: 17, aventon: 14, "happyrun-48": 11, shimano: 6, other: 7 } });
    return;
  }
  if (!window.fetch) return;
  fetch("/api/stats", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (s) { if (s && s.ok) render(s); })
    .catch(function () { /* counts stay hidden; the list keeps its planned order */ });
})();
