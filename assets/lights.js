/* Status lights on the hero module: the R7's eight WS2812B LEDs, driven by the same rules as the
   firmware. The Controller below is a line-for-line port of ebike-firmware
   include/status_lights.h (firmware 0.6.x): same colours, timings, levels and brightness cap.
   Keep it in step when the firmware changes.

   Chain order: 0-2 the line (bottom light), 3-5 the front logo, 6 the back emblem's white bar,
   7 its blue tip. The page shows the line and the logo on the render, and the emblem on the
   small back view under it. Without JavaScript the render stays as it is. */
(function () {
  "use strict";
  var ui = document.querySelector("[data-lights]");
  var stage = document.querySelector(".hp-stage");
  if (!ui || !stage) return;

  // ---- Port of status_lights.h --------------------------------------------------------------
  var BRIGHTNESS_CAP = 64, IDLE_OFF_MS = 120000, BOOT_SWEEP_MS = 600, BREATHE_LINE_MS = 2000,
      BREATHE_LOGO_MS = 3000, BLINK_LOGO_MS = 250, CHASE_STEP_MS = 150;
  var WHITE = [255, 255, 255], CYAN = [0, 180, 255], BLUE = [0, 60, 255], AMBER = [255, 110, 0], OFF = [0, 0, 0];
  var LEVEL_FULL = 255, LEVEL_STANDBY = 40, LEVEL_BREATHE_MIN = 25;
  var LINE_FIRST = 0, LINE_COUNT = 3, LOGO_FIRST = 3, LOGO_COUNT = 3, EMBLEM_BAR = 6, EMBLEM_TIP = 7;

  function scaled(c, level) {
    return c.map(function (v) {
      return Math.floor((v * level * BRIGHTNESS_CAP + Math.floor(255 * 255 / 2)) / (255 * 255));
    });
  }
  function breathe(now, period) {
    var half = Math.floor(period / 2), t = now % period, ramp = t < half ? t : period - t;
    return LEVEL_BREATHE_MIN + Math.floor((LEVEL_FULL - LEVEL_BREATHE_MIN) * ramp / (half || 1));
  }
  function fill(f, first, count, c) { for (var i = 0; i < count; i++) f[first + i] = c; }

  function Controller() { this.started = false; }
  Controller.prototype.begin = function (now) {
    this.boot = now; this.lastActivity = now; this.started = true; this.prev = null;
  };
  Controller.prototype.update = function (inp, now) {
    if (!this.started) this.begin(now);
    var p = this.prev;
    var changed = !!p && (inp.bike_on !== p.bike_on || inp.phone_connected !== p.phone_connected ||
      inp.pairing_open !== p.pairing_open || inp.ota_active !== p.ota_active);
    if (changed || inp.bike_on || inp.phone_connected || inp.ota_active) this.lastActivity = now;
    this.prev = inp;

    var f = [OFF, OFF, OFF, OFF, OFF, OFF, OFF, OFF];
    if (now - this.lastActivity >= IDLE_OFF_MS) return f;   // parked: lights and LED_5V off

    if (now - this.boot < BOOT_SWEEP_MS) {
      var lit = 1 + Math.floor((now - this.boot) * LINE_COUNT / BOOT_SWEEP_MS);
      for (var i = 0; i < LINE_COUNT && i < lit; i++) f[LINE_FIRST + i] = scaled(WHITE, LEVEL_FULL);
    } else if (inp.ota_active) {
      f[LINE_FIRST + Math.floor(now / CHASE_STEP_MS) % LINE_COUNT] = scaled(CYAN, LEVEL_FULL);
    } else if (inp.bike_on && inp.controller_locked) {
      fill(f, LINE_FIRST, LINE_COUNT, scaled(WHITE, LEVEL_FULL));
    } else if (inp.bike_on) {
      fill(f, LINE_FIRST, LINE_COUNT, scaled(AMBER, breathe(now, BREATHE_LINE_MS)));
    } else {
      fill(f, LINE_FIRST, LINE_COUNT, scaled(WHITE, LEVEL_STANDBY));
    }

    if (inp.phone_secure) {
      fill(f, LOGO_FIRST, LOGO_COUNT, scaled(CYAN, LEVEL_FULL));
    } else if (inp.phone_connected) {
      if (Math.floor(now / BLINK_LOGO_MS) % 2 === 0) fill(f, LOGO_FIRST, LOGO_COUNT, scaled(CYAN, LEVEL_FULL));
    } else if (inp.pairing_open) {
      fill(f, LOGO_FIRST, LOGO_COUNT, scaled(CYAN, breathe(now, BREATHE_LOGO_MS)));
    }

    if (inp.bike_on) { f[EMBLEM_BAR] = scaled(WHITE, LEVEL_FULL); f[EMBLEM_TIP] = scaled(BLUE, LEVEL_FULL); }
    return f;
  };

  // ---- Scenarios: the inputs the firmware sees in each everyday situation -----------------
  var EN = (document.documentElement.lang || "").indexOf("en") === 0;
  function inputs(o) {
    return { bike_on: !!o.bike, controller_locked: !!o.ctl, phone_secure: !!o.secure,
             phone_connected: !!(o.secure || o.phone), pairing_open: !!o.window, ota_active: !!o.ota };
  }
  var SCENARIOS = [
    { id: "boot", ms: 4200, reboot: true, inp: inputs({ window: true }),
      fr: ["Mise sous tension", "La ligne s'allume une lumière à la fois, puis veille doucement. Le logo respire : pendant 2 minutes, un nouveau téléphone peut s'appairer."],
      en: ["Power-up", "The line lights one LED at a time, then glows softly. The logo breathes: for 2 minutes, a new phone may pair."] },
    { id: "pairing", ms: 3000, inp: inputs({ phone: true, window: true }),
      fr: ["Appairage", "Un téléphone se connecte : le logo clignote jusqu'à ce que le lien soit sécurisé par le code à 6 chiffres."],
      en: ["Pairing", "A phone is connecting: the logo blinks until the link is secured with the 6-digit code."] },
    { id: "phone", ms: 3200, inp: inputs({ secure: true }),
      fr: ["Téléphone connecté", "Logo cyan fixe : votre téléphone est appairé et connecté. Le vélo est éteint, la ligne veille."],
      en: ["Phone connected", "Steady cyan logo: your phone is paired and connected. The bike is off, so the line glows softly."] },
    { id: "ride", ms: 4200, inp: inputs({ secure: true, bike: true, ctl: true }),
      fr: ["Vélo allumé", "La ligne passe au blanc : le contrôleur répond. À l'arrière, l'emblème s'allume : le module tient le vélo allumé."],
      en: ["Bike on", "The line turns white: the controller is answering. On the back, the emblem lights: the module is keeping the bike on."] },
    { id: "nodata", ms: 4200, inp: inputs({ secure: true, bike: true }),
      fr: ["Contrôleur muet", "Vélo allumé, mais aucune donnée du contrôleur : la ligne respire en ambre. Vérifiez le câble."],
      en: ["No controller data", "The bike is on but the controller isn't answering: the line breathes amber. Check the cable."] },
    { id: "ota", ms: 3200, inp: inputs({ secure: true, ota: true }),
      fr: ["Mise à jour", "Une mise à jour signée arrive du téléphone : une lumière cyan parcourt la ligne."],
      en: ["Update", "A signed update is coming in from the phone: one cyan LED runs along the line."] },
    { id: "parked", ms: 3200, parked: true, inp: inputs({}),
      fr: ["Stationné", "Vélo éteint, aucun téléphone, rien de changé depuis 2 minutes : tout s'éteint, et le module coupe l'alimentation des lumières pour ne pas vider la batterie."],
      en: ["Parked", "Bike off, no phone, nothing changed for 2 minutes: everything goes dark, and the module cuts the lights' power so they can't drain the battery."] },
  ];

  // ---- Build the light layers over the render --------------------------------------------
  // Mask boxes, in % of the 967 x 1100 render, from tools/lights-masks.py.
  var BOX = {
    logo:  [70.321, 14.273, 17.787, 21.364],
    line:  [60.393, 79.091, 32.058, 11.364],
    line0: [60.393, 85.364, 14.891, 5.091],
    line1: [67.632, 82.273, 18.097, 6.636],
    line2: [78.490, 79.091, 13.961, 7.727],
  };
  var base = (document.querySelector('script[src*="assets/lights.js"]').getAttribute("src") || "").replace(/lights\.js.*$/, "media/lights/");
  var img = stage.querySelector(".hp-r7");
  var unit = document.createElement("div");
  unit.className = "hp-unit";
  img.parentNode.insertBefore(unit, img);
  unit.appendChild(img);
  var layer = document.createElement("div");
  layer.className = "lt";
  layer.setAttribute("aria-hidden", "true");
  unit.appendChild(layer);

  function piece(cls, name) {
    var b = BOX[name], el = document.createElement("i");
    var url = "url(\"" + new URL(base + name + ".png?v=20261119", document.baseURI).href + "\")";
    el.className = cls;
    el.style.cssText = "left:" + b[0] + "%;top:" + b[1] + "%;width:" + b[2] + "%;height:" + b[3] + "%";
    el.style.webkitMaskImage = url;
    el.style.maskImage = url;
    return el;
  }
  // Unlit lenses read as smoked plastic; each LED then adds its colour and a soft bloom.
  layer.appendChild(piece("lt-smoke", "logo"));
  layer.appendChild(piece("lt-smoke", "line"));
  var bloom = document.createElement("div");
  bloom.className = "lt-bloom";
  layer.appendChild(bloom);
  var lens = { logo: [], line0: [], line1: [], line2: [] };
  ["logo", "line0", "line1", "line2"].forEach(function (n) {
    var a = piece("lt-led", n), g = piece("lt-led", n);
    layer.appendChild(a); bloom.appendChild(g);
    lens[n] = [a, g];
  });

  var back = ui.querySelector("[data-lights-back]");
  var backBar = back && back.querySelector(".lb-bar"), backTip = back && back.querySelector(".lb-tip");

  // Frame value (0..BRIGHTNESS_CAP) to a screen colour at full strength and an opacity.
  function show(els, c) {
    var m = Math.max(c[0], c[1], c[2]);
    var a = m / BRIGHTNESS_CAP;
    var col = m ? "rgb(" + c.map(function (v) { return Math.round(v / m * 255); }).join(",") + ")" : "transparent";
    els.forEach(function (el, k) {
      el.style.backgroundColor = col;
      el.style.opacity = (k ? Math.min(1, a * 1.15) : a).toFixed(3);
    });
  }
  function showBack(el, c) {
    if (!el) return;
    var m = Math.max(c[0], c[1], c[2]);
    el.style.fill = m ? "rgb(" + c.map(function (v) { return Math.round(v / m * 255); }).join(",") + ")" : "";
    el.classList.toggle("on", m > 0);
  }
  function paint(f) {
    show(lens.line0, f[0]); show(lens.line1, f[1]); show(lens.line2, f[2]);
    show(lens.logo, f[3]);
    showBack(backBar, f[6]); showBack(backTip, f[7]);
    unit.classList.toggle("lit", f.some(function (c) { return c[0] || c[1] || c[2]; }));
  }

  // ---- Controls ------------------------------------------------------------------------------
  var chips = ui.querySelector("[data-lights-chips]");
  var say = ui.querySelector("[data-lights-say]");
  var pauseBtn = ui.querySelector("[data-lights-pause]");
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var buttons = SCENARIOS.map(function (s, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "lc";
    b.setAttribute("aria-pressed", "false");
    b.textContent = (EN ? s.en : s.fr)[0];
    b.addEventListener("click", function () {
      if (window.KurantTrack) window.KurantTrack("lights_interact");
      say.setAttribute("aria-live", "polite");   // announce only what the visitor chose, not the auto tour
      setAuto(false);
      go(i);
    });
    chips.appendChild(b);
    return b;
  });

  var ctl = new Controller(), cur = -1, since = 0, auto = !reduce, raf = 0, visible = false, clock = 0, last = 0;
  function now() { return clock; }
  function go(i) {
    cur = i;
    var s = SCENARIOS[i];
    since = now();
    if (s.reboot || !ctl.started) ctl.begin(now());
    if (s.parked) { ctl.update(s.inp, now()); ctl.lastActivity = now() - IDLE_OFF_MS; }
    buttons.forEach(function (b, k) { b.setAttribute("aria-pressed", String(k === i)); });
    say.textContent = (EN ? s.en : s.fr)[1];
    frame();
  }
  function frame() {
    var s = SCENARIOS[cur];
    // Reduced motion: hold each state still, at the middle of any breathing or blinking.
    var t = reduce ? since + 1500 : now();
    paint(ctl.update(s.inp, t));
  }
  function tick(ts) {
    raf = 0;
    if (!visible || document.hidden) return;
    clock += last ? Math.min(ts - last, 100) : 16;
    last = ts;
    if (auto && now() - since >= SCENARIOS[cur].ms) go((cur + 1) % SCENARIOS.length);
    else frame();
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && !reduce) { last = 0; raf = requestAnimationFrame(tick); } }
  function setAuto(on) {
    auto = on && !reduce;
    pauseBtn.setAttribute("aria-pressed", String(!auto));
    pauseBtn.textContent = auto ? (EN ? "Pause" : "Pause") : (EN ? "Play all" : "Tout jouer");
  }
  pauseBtn.addEventListener("click", function () {
    var turnOn = !auto;
    setAuto(turnOn);
    if (turnOn) go((cur + 1) % SCENARIOS.length);
  });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) start();
    }, { threshold: 0.15 }).observe(stage);
  } else { visible = true; }
  document.addEventListener("visibilitychange", function () { if (!document.hidden && visible) start(); });

  ui.hidden = false;
  setAuto(!reduce);
  go(reduce ? 3 : 0);
  if (reduce) pauseBtn.hidden = true;
  if (visible) start();
})();
