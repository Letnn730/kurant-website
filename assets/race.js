/* The brand race: confirmed sign-ups per system, from /api/stats (real numbers only).
   After KT, the system with the most confirmed sign-ups goes on the bench first.
   Shown only once RACE_MIN people have confirmed, so the room never looks empty.
   36 V systems (Shimano STEPS) are left out: they need a future version of the module. */
(function () {
  "use strict";

  var RACE_MIN = 50;

  // A lane groups compat.js families. Keep in step with assets/compat.js.
  var LANES = [
    { id: "bafang", fams: ["bafang-uart"], fr: "Bafang (UART, 5 broches)", en: "Bafang (UART, 5-pin)" },
    { id: "lishui", fams: ["lishui"], fr: "Lishui (écrans S866)", en: "Lishui (S866 displays)" },
    { id: "rad", fams: ["rad-lishui", "rad-asi"], fr: "Rad Power Bikes", en: "Rad Power Bikes" },
    { id: "lectric", fams: ["lectric"], fr: "Lectric XP", en: "Lectric XP" },
    { id: "happyrun", fams: ["happyrun-48"], fr: "HappyRun G100 (48\u00A0V)", en: "HappyRun G100 (48 V)" },
    { id: "aventon", fams: ["aventon"], fr: "Aventon (48\u00A0V)", en: "Aventon (48 V)" }
  ];

  var T = {
    fr: {
      total: function (n) { return n.toLocaleString("fr-CA") + " inscrits confirmés"; },
      kt: function (n) { return n.toLocaleString("fr-CA") + " sur KT, déjà pris en charge au lancement. Les systèmes 36\u00A0V (Shimano STEPS) viendront avec une version future du module."; },
      lead: "En tête",
      yours: "Votre système",
      count: function (n) { return n.toLocaleString("fr-CA"); }
    },
    en: {
      total: function (n) { return n.toLocaleString("en-CA") + " confirmed sign-ups"; },
      kt: function (n) { return n.toLocaleString("en-CA") + " on KT, already supported at launch. 36 V systems (Shimano STEPS) come with a future version of the module."; },
      lead: "Leading",
      yours: "Your system",
      count: function (n) { return n.toLocaleString("en-CA"); }
    }
  };

  function laneOf(family) {
    for (var i = 0; i < LANES.length; i++) if (LANES[i].fams.indexOf(family) >= 0) return LANES[i].id;
    return "";
  }

  // stats = { total, families: { kt: 12, ... } }. opts = { lang, highlight (a family id), force }.
  // Returns true when the race was shown.
  function render(root, stats, opts) {
    var lang = opts.lang === "en" ? "en" : "fr";
    var t = T[lang];
    if (!root || !stats || (!opts.force && stats.total < RACE_MIN)) return false;

    var fam = stats.families || {};
    var lanes = LANES.map(function (l) {
      var n = 0;
      l.fams.forEach(function (f) { n += fam[f] || 0; });
      return { id: l.id, name: l[lang], n: n };
    }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); });
    var max = Math.max(1, lanes[0].n);
    var mine = laneOf(opts.highlight || "");

    root.querySelector("[data-race-total]").textContent = t.total(stats.total);
    root.querySelector("[data-race-kt]").textContent = t.kt(fam.kt || 0);
    var list = root.querySelector("[data-race-bars]");
    list.textContent = "";
    lanes.forEach(function (l, i) {
      var li = document.createElement("li");
      li.className = "race-row" + (i === 0 && l.n > 0 ? " lead" : "") + (l.id === mine ? " mine" : "");
      var head = document.createElement("div");
      head.className = "race-name";
      var name = document.createElement("span");
      name.textContent = l.name;
      head.appendChild(name);
      if (i === 0 && l.n > 0) head.appendChild(tag(t.lead, "tag-lead"));
      if (l.id === mine) head.appendChild(tag(t.yours, "tag-mine"));
      var count = document.createElement("b");
      count.textContent = t.count(l.n);
      head.appendChild(count);
      var track = document.createElement("div");
      track.className = "race-track";
      var bar = document.createElement("i");
      bar.style.width = (l.n === 0 ? 0 : Math.max(3, Math.round(l.n / max * 100))) + "%";
      track.appendChild(bar);
      li.appendChild(head);
      li.appendChild(track);
      list.appendChild(li);
    });
    root.hidden = false;
    return true;
  }

  function tag(text, cls) {
    var s = document.createElement("small");
    s.className = "tag " + cls;
    s.textContent = text;
    return s;
  }

  // Real numbers on kurant.ca. A made-up set only on preview hosts with ?race=demo, to check the layout.
  var PROD = /(^|\.)kurant\.ca$/.test(location.hostname);
  function load(root, opts) {
    if (!root) return;
    if (!PROD && /[?&]race=demo\b/.test(location.search)) {
      render(root, { total: 312, families: { kt: 121, "bafang-uart": 64, lectric: 41, "rad-asi": 22, "rad-lishui": 9, lishui: 17, aventon: 14, "happyrun-48": 11, shimano: 6, other: 7 } }, { lang: opts.lang, highlight: opts.highlight, force: true });
      return;
    }
    fetch("/api/stats", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (s) {
        if (!s || !s.ok) return;
        render(root, s, opts);
        // Kickstarter section: "N confirmed sign-ups", only past the same threshold as the race.
        if (s.total >= RACE_MIN) {
          Array.prototype.forEach.call(document.querySelectorAll("[data-ks-count]"), function (el) {
            el.textContent = opts.lang === "en"
              ? s.total.toLocaleString("en-CA") + " people have already confirmed."
              : s.total.toLocaleString("fr-CA") + " personnes ont déjà confirmé leur inscription.";
            el.hidden = false;
          });
        }
      })
      .catch(function () { /* the race simply stays hidden */ });
  }

  window.KurantRace = { load: load, render: render, laneOf: laneOf, MIN: RACE_MIN };
})();
