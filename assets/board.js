/* The system list in "Vérifier mon vélo" / "Check my bike" (home pages).

   It is the checker's system picker: one row per family from assets/compat.js, with its
   stage on a 4-step meter and the real vote count (confirmed, still-subscribed sign-ups
   per system, from /api/stats). Choosing a row sets the checker's hidden select
   (#chk-family), so assets/site.js updates the result and the form exactly as before.

   Order: ready systems, then systems in progress from most to least voted (ties keep the
   compat.js order), then later, then not planned, then "Other brand".
   The chosen row opens to show how to recognize the system, what it was tested on, its
   next step, and a "Sign up to vote" button that brings the form up (window.KurantPick).

   Also fills the Kickstarter section's "N people have confirmed" line once
   SHOW_TOTAL_MIN people have confirmed, as the brand race did. */
(function () {
  "use strict";
  var root = document.querySelector("[data-board]");
  var list = root ? root.querySelector("[data-sys-list]") : null;
  var data = window.KURANT_COMPAT;
  var famSel = document.getElementById("chk-family");
  if (!root || !list || !data || !famSel) return;
  var lang = root.getAttribute("data-board") === "en" ? "en" : "fr";
  var locale = lang === "en" ? "en-CA" : "fr-CA";
  var SHOW_TOTAL_MIN = 50;

  var T = {
    fr: {
      stage: { road: "Confirmé sur la route", verified: "Vérifié au banc", bench: "Au banc", dev: "En développement", later: "Plus tard", no: "Pas prévu" },
      stepOf: function (n) { return "Étape " + n + " sur 4"; },
      group: { ready: "Prêt au lancement", progress: "En cours · du plus voté au moins voté", later: "Plus tard", no: "Pas prévu", other: "Autre" },
      look: "Comment le reconnaître",
      tested: { road: "Vérifié avec", verified: "Vérifié avec", bench: "Au banc avec" },
      next: "Prochaine étape",
      votes: function (n) { return n === 1 ? "vote" : "votes"; },
      signups: function (n) { return n === 1 ? "inscrit" : "inscrits"; },
      total: function (n) { return n.toLocaleString(locale) + (n === 1 ? " vote confirmé au total" : " votes confirmés au total"); },
      lead: "En tête",
      done: "Terminé",
      act: { ready: "M'inscrire", vote: "M'inscrire pour voter" },
      ks: function (n) { return n.toLocaleString(locale) + " personnes ont déjà confirmé leur inscription."; }
    },
    en: {
      stage: { road: "Road-confirmed", verified: "Bench-verified", bench: "On the bench", dev: "In development", later: "Later", no: "Not planned" },
      stepOf: function (n) { return "Step " + n + " of 4"; },
      group: { ready: "Ready at launch", progress: "In progress · most voted first", later: "Later", no: "Not planned", other: "Other" },
      look: "How to recognize it",
      tested: { road: "Verified with", verified: "Verified with", bench: "On the bench with" },
      next: "Next step",
      votes: function (n) { return n === 1 ? "vote" : "votes"; },
      signups: function (n) { return n === 1 ? "sign-up" : "sign-ups"; },
      total: function (n) { return n.toLocaleString(locale) + (n === 1 ? " confirmed vote in total" : " confirmed votes in total"); },
      lead: "Leading",
      done: "Done",
      act: { ready: "Sign up", vote: "Sign up to vote" },
      ks: function (n) { return n.toLocaleString(locale) + " people have already confirmed."; }
    }
  }[lang];

  var STEP = { dev: 1, bench: 2, verified: 3, road: 4 };
  var GROUP = { road: "ready", verified: "ready", bench: "progress", dev: "progress", later: "later", no: "no", other: "other" };
  var GROUPS = ["ready", "progress", "later", "no", "other"];
  var ORDER = { road: 0, verified: 1 };

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

  // Four short segments: cyan when done, amber for the step being worked on.
  function dots(stage) {
    var at = STEP[stage];
    var box = el("span", "sys-dots");
    box.setAttribute("role", "img");
    box.setAttribute("aria-label", T.stepOf(at));
    var reached = stage === "verified" || stage === "road";
    for (var n = 1; n <= 4; n++) {
      box.appendChild(el("i", n < at || (n === at && reached) ? "done" : n === at ? "now" : ""));
    }
    return box;
  }

  function detail(f, group) {
    var t = f[lang];
    var box = el("div", "sys-detail");
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
    if (dl.childNodes.length) box.appendChild(dl);
    if (group === "ready" || group === "progress" || group === "later") {
      var a = el("a", "btn btn-sm " + (group === "ready" ? "btn-primary" : "btn-ghost"), group === "ready" ? T.act.ready : T.act.vote);
      a.href = "#waitlist";
      a.setAttribute("data-pick", f.id);
      box.appendChild(a);
    }
    return box;
  }

  // ctx = { n (votes, null while unknown), max, lead }
  function row(f, group, ctx) {
    var t = f[lang];
    var wrap = el("div", "sys sys-" + group + (ctx.lead ? " is-lead" : ""));
    wrap.id = "sys-" + f.id;

    var label = el("label", "sys-row");
    var input = el("input");
    input.type = "radio";
    input.name = "chk-sys";
    input.value = f.id;
    input.id = "sys-pick-" + f.id;
    label.appendChild(input);

    var main = el("span", "sys-main");
    var name = el("span", "sys-name");
    if (group === "ready") {
      var badge = el("span", "cp-badge");
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", T.done);
      badge.appendChild(checkMark());
      name.appendChild(badge);
    }
    name.appendChild(el("span", "sys-name-text", t.name));
    if (ctx.lead) name.appendChild(el("small", "tag tag-lead", T.lead));
    main.appendChild(name);
    if (STEP[f.stage]) {
      var st = el("span", "sys-stage");
      st.appendChild(dots(f.stage));
      st.appendChild(el("span", null, T.stage[f.stage]));
      main.appendChild(st);
    } else if (group === "later" || group === "no" || group === "other") {
      main.appendChild(el("span", "sys-stage sys-note", t.note));
    }
    if (group === "progress" && ctx.n != null) {
      var track = el("span", "race-track" + (ctx.lead ? " is-lead" : ""));
      var bar = el("i");
      bar.style.width = (ctx.n === 0 ? 0 : Math.max(3, Math.round(ctx.n / Math.max(1, ctx.max) * 100))) + "%";
      track.appendChild(bar);
      main.appendChild(track);
    }
    label.appendChild(main);

    if (ctx.n != null && group !== "no" && group !== "other") {
      var v = el("span", "sys-votes");
      v.appendChild(el("b", null, num(ctx.n)));
      v.appendChild(el("small", null, group === "ready" ? T.signups(ctx.n) : T.votes(ctx.n)));
      label.appendChild(v);
    }
    wrap.appendChild(label);

    var d = detail(f, group);
    d.hidden = true;
    wrap.appendChild(d);
    return wrap;
  }

  // The checker's result box moves into the chosen row, so the answer appears where you clicked.
  var result = root.querySelector(".result");
  var resultHome = root.querySelector("[data-result-home]");

  // Mark the chosen row, open its details and show the result in it.
  function sync() {
    var id = famSel.value;
    var host = null;
    Array.prototype.forEach.call(list.querySelectorAll(".sys"), function (s) {
      var on = s.id === "sys-" + id;
      s.classList.toggle("is-on", on);
      var input = s.querySelector("input");
      if (input) input.checked = on;
      var d = s.querySelector(".sys-detail");
      if (d) { d.hidden = !on; if (on) host = d; }
    });
    if (!result) return;
    if (host) { if (result.parentNode !== host) host.insertBefore(result, host.firstChild); }
    else if (resultHome && result.parentNode !== resultHome) resultHome.appendChild(result);
    if (resultHome) resultHome.hidden = !!host;
  }

  // stats = { total, families: { id: n } }, or null while loading or unavailable.
  function render(stats) {
    var fam = stats ? stats.families || {} : null;
    var buckets = { ready: [], progress: [], later: [], no: [], other: [] };
    data.families.forEach(function (f, i) {
      var g = GROUP[f.stage];
      if (g) buckets[g].push({ f: f, i: i, n: fam ? fam[f.id] || 0 : null });
    });
    buckets.ready.sort(function (a, b) { return (ORDER[a.f.stage] - ORDER[b.f.stage]) || (a.i - b.i); });
    // Most voted first; ties (and the loading state) keep the planned order.
    buckets.progress.sort(function (a, b) { return ((b.n || 0) - (a.n || 0)) || (a.i - b.i); });
    var max = 0;
    buckets.progress.forEach(function (x) { if ((x.n || 0) > max) max = x.n; });

    list.textContent = "";
    GROUPS.forEach(function (g) {
      if (!buckets[g].length) return;
      var group = el("div", "sys-group");
      group.setAttribute("role", "group");
      var head = el("p", "sys-group-label", T.group[g]);
      head.id = "sys-group-" + g;
      group.setAttribute("aria-labelledby", head.id);
      group.appendChild(head);
      buckets[g].forEach(function (x, idx) {
        group.appendChild(row(x.f, g, { n: x.n, max: max, lead: g === "progress" && idx === 0 && x.n > 0 }));
      });
      list.appendChild(group);
    });
    sync();

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
  }

  // A row chosen here drives the checker's select; site.js then updates the result and the form.
  list.addEventListener("change", function (e) {
    if (e.target.name !== "chk-sys") return;
    famSel.value = e.target.value;
    famSel.dispatchEvent(new Event("change"));
  });
  // A choice made elsewhere (the form's own menu, a ?systeme= link) moves the list too.
  document.addEventListener("kurant:system", sync);
  list.addEventListener("click", function (e) {
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
