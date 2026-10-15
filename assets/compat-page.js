/* Compatibility pages (compatibilite/, en/compatibility/).
   Renders every family from assets/compat.js into its group, with a progress
   meter for systems in progress. The page sets data-compat-page="fr" or "en". */
(function () {
  "use strict";
  var root = document.querySelector("[data-compat-page]");
  var data = window.KURANT_COMPAT;
  if (!root || !data) return;
  var lang = root.getAttribute("data-compat-page") === "en" ? "en" : "fr";

  var T = {
    fr: {
      steps: ["Étudié", "Au banc", "Vérifié au banc", "Confirmé sur la route"],
      stepOf: function (n) { return "Étape " + n + " sur 4"; },
      chip: { road: "Confirmé sur la route", verified: "Vérifié au banc", bench: "Au banc", dev: "En développement", later: "Plus tard", no: "Pas prévu" },
      look: "Comment le reconnaître",
      tested: { road: "Vérifié avec", verified: "Vérifié avec", bench: "Au banc avec" },
      next: "Prochaine étape",
      done: "Terminé",
      empty: "Aucun système pour le moment."
    },
    en: {
      steps: ["Researched", "On the bench", "Bench-verified", "Road-confirmed"],
      stepOf: function (n) { return "Step " + n + " of 4"; },
      chip: { road: "Road-confirmed", verified: "Bench-verified", bench: "On the bench", dev: "In development", later: "Later", no: "Not planned" },
      look: "How to recognize it",
      tested: { road: "Verified with", verified: "Verified with", bench: "On the bench with" },
      next: "Next step",
      done: "Done",
      empty: "No systems here yet."
    }
  }[lang];

  // How far along the 4-step meter each stage is.
  var STEP = { dev: 1, bench: 2, verified: 3, road: 4 };
  var GROUP = { road: "ready", verified: "ready", bench: "progress", dev: "progress", later: "later", no: "no" };
  var ORDER = { road: 0, verified: 1, bench: 2, dev: 3, later: 4, no: 5 };
  var CHIP = { road: "ok", verified: "ok", bench: "check", dev: "check", later: "idle", no: "no" };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

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

  function item(f) {
    var t = f[lang];
    var stage = f.stage;
    var ready = stage === "verified" || stage === "road";
    var art = el("article", "cp-item" + (ready ? " is-ready" : "") + (stage === "later" || stage === "no" ? " is-quiet" : ""));

    var head = el("div", "cp-item-head");
    var title = el("h3", null);
    if (ready) {
      var badge = el("span", "cp-badge");
      badge.setAttribute("role", "img");
      badge.setAttribute("aria-label", T.done);
      badge.appendChild(checkMark());
      title.appendChild(badge);
    }
    title.appendChild(document.createTextNode(t.name));
    head.appendChild(title);
    var chip = el("span", "chip " + CHIP[stage], T.chip[stage]);
    head.appendChild(chip);
    art.appendChild(head);

    if (STEP[stage]) art.appendChild(meter(stage));

    var dl = el("dl", "cp-facts");
    function row(k, v) {
      if (!v) return;
      var d = el("div");
      d.appendChild(el("dt", null, k));
      d.appendChild(el("dd", null, v));
      dl.appendChild(d);
    }
    row(T.look, t.look);
    if (t.tested && t.tested.length) row(T.tested[stage] || T.tested.verified, t.tested.join(" · "));
    if (STEP[stage]) row(T.next, t.next);
    if (dl.childNodes.length) art.appendChild(dl);

    // Systems that are ready, later or not planned carry their own note (cable included, reason, version).
    if (ready || stage === "later" || stage === "no") art.appendChild(el("p", "cp-note", t.note));
    return art;
  }

  var buckets = { ready: [], progress: [], later: [], no: [] };
  data.families
    .map(function (f, i) { return { f: f, i: i }; })
    .filter(function (x) { return GROUP[x.f.stage]; })
    .sort(function (a, b) { return (ORDER[a.f.stage] - ORDER[b.f.stage]) || (a.i - b.i); })
    .forEach(function (x) { buckets[GROUP[x.f.stage]].push(x.f); });

  Object.keys(buckets).forEach(function (key) {
    var box = root.querySelector('[data-group="' + key + '"]');
    var count = root.querySelector('[data-count="' + key + '"]');
    if (count) count.textContent = String(buckets[key].length);
    if (!box) return;
    box.textContent = "";
    if (!buckets[key].length) { box.appendChild(el("p", "hint", T.empty)); return; }
    buckets[key].forEach(function (f) { box.appendChild(item(f)); });
  });

  var nReady = root.querySelector('[data-fact="ready"]');
  var nProgress = root.querySelector('[data-fact="progress"]');
  if (nReady) nReady.textContent = String(buckets.ready.length);
  if (nProgress) nProgress.textContent = String(buckets.progress.length);
})();
