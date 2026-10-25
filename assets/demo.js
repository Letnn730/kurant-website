/* Kurant app demo.
 *
 * A browser mirror of the Android app (ebike-app 0.9, ride screen v2) connected to its built-in
 * simulator. Screens, geometry, colours, wording and safety rules follow ebike-app:
 *   - RideSurface / RideLayout (portrait 390x844 geometry), RideScrims, RideControls (link pill,
 *     mode chip, headlight, Ride controls sheet), AssistLadder, RangeChips, Gauges (Arc, Needle,
 *     Tape, Minimal, drawn from the design's 300x300 geometry), SpeedSignal (the gauge spring)
 *   - SettingsScreen, RideDisplayScreen, SpeedModeUi, ConnectionSheet, ConfirmWriteDialog
 *   - MockTransport physics, SpeedModeController.reconcile, settingWritability
 *   - strings: res/values and res/values-fr
 * The map is an illustration in the app's Kurant Night palette, not real map data.
 * Only the Simulator source is offered. Nothing is sent or stored.
 */
(() => {
  "use strict";

  const host = document.querySelector("[data-demo]");
  if (!host) return;

  const FR = /^fr/i.test(document.documentElement.lang || "");
  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------- constants */

  const W = 390, H = 844;           // RideLayout portrait reference, dp
  const TOP_INSET = 28;             // status bar
  const TICK_MS = 100;              // KT frame interval (profile transport.txIntervalMs)
  const STOPPED_KMH = 0.5;          // STOPPED_SPEED_KMH
  const MOVING_KMH = 3;             // UX rule 3: glance rules above 3 km/h
  const HOLD_MS = 1500;             // MODE_SWITCH_HOLD_MS
  const ACK_SECONDS = 3;
  const WRITE_MS = 450;
  const LIMIT_MIN = 10, LIMIT_MAX = 72;
  const START_SOC = 87;             // MockTransport
  const CAPS = { AB: 32, BC: 32, MB: 32, NB: 32, NL: 32, NS: 30, NT: 32, NU: 32, ON: 32, PE: 32, QC: 32, SK: 32, YT: 32 };
  const PROFILE = { id: "kt-uart-generic", name: "KT / Kunteng UART (LCD3-class)", version: "0.4.0", brands: "KT / Kunteng · BMSBattery S-series" };
  const APP_VERSION = "0.9.0";
  const ASSIST_LEVELS = [0, 1, 2, 3, 4, 5];
  const WH_PER_KM = { 0: 3, 1: 7, 2: 9, 3: 12, 4: 15, 5: 19 };   // EnergyMeter.PRIORS
  const STYLES = ["ARC", "NEEDLE", "TAPE", "MINIMAL"];

  // RideTheme palette
  const C = {
    ink: "#0A0D10", inkLow: "#0F1318", panel: "#141A20", high: "#1A2129", highest: "#212A33",
    line: "#3A4652", lineSoft: "#26303A", text: "#EEF2F5", soft: "#C4CED8", muted: "#9AA7B4", faint: "#6B7885", dim: "#5E6B78",
    volt: "#C8F031", onVolt: "#121A04", voltLit: "#9DBE24", amber: "#FFB547", onAmber: "#2A1A00",
    sky: "#5BC8F5", red: "#FF6B6B", green: "#4ADE80",
    mapBase: "#0B1014", mapMinor: "#182029", mapMajor: "#27323D", mapMid: "#222C36", lotA: "#121920", lotB: "#151C23", lotEdge: "#1B242D",
    park: "#0F1E19", parkEdge: "#12271F", water: "#0E2533", waterLabel: "#3F6A80", label: "#5E6B78",
  };
  const SANS = 'Roboto, system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

  /* ---------------------------------------------------------------- strings (res/values, res/values-fr) */

  const P = (n) => String(n);
  const fmt1 = (v) => (FR ? v.toFixed(1).replace(".", ",") : v.toFixed(1));
  const T = FR ? {
    region: "Démo interactive de l'application Kurant, en simulation",
    simulator: "Simulateur", virtualBike: "Vélo virtuel", dongle: "Dongle", source: "Source",
    connection: "Connexion", connectionSettings: "Réglages de connexion",
    street: "Route", offroad: "Hors route",
    settings: "Réglages", back: "Retour",
    whereTo: "Où aller ?", whereToDemo: "La recherche d'itinéraire fonctionne dans l'application, pas dans cette démo.",
    headlight: "Éclairage",
    assistHeader: "ASSISTANCE", assistOff: "ARRÊT", assistLevel: "Niveau d'assistance",
    assistState: (l, m) => `${l} sur ${m}`, assistDisabled: "Assistance désactivée",
    motor: (w) => `MOTEUR ${w} W`, unit: "KM/H", limitLabel: (n) => `LIMITE ${n}`,
    steady: "stable", trend: (v) => `${v >= 0 ? "+" : "−"}${fmt1(Math.abs(v))} en 3 s`,
    gaugeDesc: (s, l) => `Vitesse ${s} km/h, limite ${l}`,
    startSpare: (p) => `Retour au départ avec ≈ ${p} % de réserve`,
    pendingLimit: (n) => `La limite de ${n} km/h s'applique au prochain arrêt`,
    rideControls: "Commandes de conduite",
    holdSwitch: (m) => `Maintenez pour passer en mode ${m}`,
    stopTo: (m) => (m === "street" ? "Arrêtez-vous pour passer en mode Route" : "Arrêtez-vous pour passer en mode Hors route"),
    power: "Puissance", battery: "Batterie",
    runSetup: "Relancer la configuration", runSetupSub: "Affiche vos valeurs actuelles ; rien n'est réinitialisé",
    rideDisplay: "Affichage de conduite", rideDisplaySub: "Compteur, réactivité, orientation, boutons de volume",
    profile: "Profil du contrôleur", bench: "Vérifié sur banc", bundled: "Inclus dans l'application", change: "Changer",
    language: "Langue", langSystem: "Langue du téléphone",
    rangeSettings: "Estimations d'autonomie", home: "Domicile", start: "Départ",
    pack: (v, ah, wh) => `${v} V × ${fmt1(ah)} Ah · ${wh} Wh`,
    smartAssist: "Assistance intelligente",
    ceiling: "Niveau automatique maximal", ceilingSub: "Le Boost et l'assistance intelligente ne le dépassent jamais.",
    climb: "Niveau en montée", climbSub: "Le niveau pour les montées, jusqu'au niveau automatique maximal.",
    arrive: "Arriver avec au moins", arriveSub: "L'assistance intelligente réduit sur le plat, puis en montée, pour garder cette batterie à l'arrivée.",
    less: (t) => `Baisser ${t}`, more: (t) => `Augmenter ${t}`,
    secSpeed: "Limite de vitesse", active: "Actif",
    switchTo: (m) => `Passer en mode ${m}`, pressHold: "Maintenez enfoncé",
    ctrlLimit: "Limite du contrôleur", ctrlLimitSub: "Limite actuellement appliquée par le contrôleur",
    applied: "Appliquée", applying: "Application…", whenStopped: "S'applique à l'arrêt", waitingOk: "En attente de votre accord", lowerThan: "Inférieure au mode",
    maxSpeed: "Vitesse maximale",
    streetCap: (c) => `Limite Route · maximum légal de ${c} km/h`,
    aboveSaves: (c) => `Au-delà de la limite légale de ${c} km/h · enregistré pour Hors route`,
    offAbove: (c) => `Limite Hors route · au-delà de la limite légale de ${c} km/h`,
    offSub: "Limite Hors route",
    jurisdiction: "Province ou territoire", jurisdictionCap: (p, c) => `${p} · limite légale de ${c} km/h`, chooseJurisdiction: "Choisir la province ou le territoire",
    lowerMoving: "Passer en mode Route pendant le trajet",
    lowerMovingSub: "La limite du contrôleur diminue au prochain arrêt. Le mode Hors route exige toujours un arrêt.",
    saveAsOff: (n) => `Enregistrer ${n} km/h pour Hors route ?`,
    saveAsOffBody: (c, p, s) => `Cette vitesse dépasse la limite de ${c} km/h pour les vélos à assistance électrique dans votre province ou territoire (${p}). Elle peut seulement être utilisée en mode Hors route. Le mode Route reste à ${s} km/h.`,
    saveAsOffBtn: "Enregistrer pour Hors route", cancel: "Annuler",
    ackTitle: (n) => `Mode Hors route · ${n} km/h`,
    ackAbove: (c, p) => `Cette vitesse dépasse la limite légale de ${c} km/h pour les vélos à assistance électrique dans votre province ou territoire (${p}).`,
    ackBody: "Utilisez le mode Hors route uniquement sur un terrain privé ou là où il est autorisé. Vous êtes responsable de l'utilisation du vélo.",
    useStreet: "Utiliser Route", okSeconds: (n) => `OK (${n})`,
    secGps: "Précision de la vitesse", gpsTitle: "Fonctionne avec le dongle",
    gpsSub: "Compare la vitesse GPS à celle du contrôleur pour détecter une taille de roue incorrecte.",
    groups: { bike: "Vélo", battery: "Batterie", pas: "Assistance au pédalage", motor: "Moteur" },
    critical: "Critique", caution: "Prudence",
    stopToChange: "Arrêtez le vélo pour modifier ce réglage.",
    revert: "Annuler la modification", apply: "Appliquer", saved: "Enregistré.",
    decrease: (l) => `Diminuer ${l}`, increase: (l) => `Augmenter ${l}`,
    changeQ: (l) => `Modifier ${l} ?`,
    typedBody: "Ce réglage touche la sécurité ou la conformité légale. Saisissez CONFIRM pour l'appliquer.",
    typedWord: "CONFIRM", typedLabel: "Saisissez CONFIRM",
    device: "Appareil", firmware: "Micrologiciel du dongle", versionUpdates: "Version et mises à jour",
    about: "À propos", privacy: "Politique de confidentialité", privacySub: "Ce que l'application conserve et pourquoi",
    credits: "Crédits de la carte", creditsSub: "MapLibre, OpenMapTiles, OpenStreetMap et plus",
    demoOnly: "Disponible dans l'application.",
    footer: `Application ${APP_VERSION} · ${PROFILE.id} v${PROFILE.version}`,
    simulated: (p) => `Simulation du vélo en cours · ${p}`,
    close: "Fermer",
    preview: "APERÇU EN DIRECT", gaugeSec: "Compteur",
    styles: { ARC: "Arc", NEEDLE: "Aiguille", TAPE: "Ruban", MINIMAL: "Minimal" },
    opacity: "Opacité du compteur", opacityHint: "Baissez-la pour voir plus de carte. Les chiffres de vitesse restent lisibles.",
    placement: "Taille et position du compteur", placementHint: "À l'arrêt, appuyez longuement sur le compteur pour le déplacer ou le redimensionner", reset: "Réinitialiser",
    feel: "Réactivité du compteur", calm: "Calme", lively: "Vive",
    orientation: "Orientation de l'écran", orientations: ["Auto", "Portrait", "Paysage"],
    volume: "Les boutons de volume changent l'assistance", volumeHint: "Haut = plus, bas = moins, avec des gants",
    sweep: "Balayage au démarrage", sweepHint: "Le compteur balaie quand le vélo s'allume",
    hills: "Ombrage du relief", hills3d: "En navigation 3D", hills3dHint: "Ombre les pentes autour de l'itinéraire.",
    hills2d: "Sur la carte 2D", hills2dHint: "Trajet libre et aperçus. Charge aussi les données de relief.",
    provinces: { AB: "Alberta", BC: "Colombie-Britannique", MB: "Manitoba", NB: "Nouveau-Brunswick", NL: "Terre-Neuve-et-Labrador", NS: "Nouvelle-Écosse", NT: "Territoires du Nord-Ouest", NU: "Nunavut", ON: "Ontario", PE: "Île-du-Prince-Édouard", QC: "Québec", SK: "Saskatchewan", YT: "Yukon" },
    settings_: {
      wheelSize: ["Taille de roue", "Diamètre de vos roues, utilisé par le contrôleur pour mesurer la vitesse et appliquer sa limite. Une valeur incorrecte fausse la vitesse affichée."],
      p5: ["Comportement de la jauge de batterie (P5)", "Calcul de la jauge de batterie. Les valeurs basses réagissent immédiatement à la tension (la jauge varie sous charge); les valeurs élevées lissent la mesure."],
      c12: ["Réglage de la coupure basse tension (C12)", "Modifie la tension à laquelle le contrôleur s'arrête pour protéger la batterie. Une valeur trop basse peut décharger excessivement et détruire les batteries au lithium, ce qui présente un danger."],
      c1: ["Type de capteur de pédalage (C1)", "Type de capteur d'assistance au pédalage du vélo. Une valeur incorrecte peut désactiver l'assistance ou l'empêcher de s'arrêter. Modifiez seulement si l'assistance fonctionne mal."],
      c5: ["Courant maximal (C5)", "Limite le courant consommé par le contrôleur. L'augmenter accroît la puissance ET la chaleur dans le moteur, les câbles et la batterie. Peut endommager définitivement les composants et annuler les garanties."],
      c13: ["Freinage régénératif (C13)", "Intensité du freinage régénératif si le moteur le prend en charge (moyeux à entraînement direct uniquement). Sans effet sur les moteurs à engrenages."],
    },
    streets: ["Rue Ontario", "Av. du Parc", "Rue Rachel", "Boul. Saint-Laurent", "Rue Sherbrooke", "Av. Papineau"],
    canal: "Canal",
  } : {
    region: "Interactive demo of the Kurant app, in simulation",
    simulator: "Simulator", virtualBike: "Virtual bike", dongle: "Dongle", source: "Source",
    connection: "Connection", connectionSettings: "Connection settings",
    street: "Street", offroad: "Offroad",
    settings: "Settings", back: "Back",
    whereTo: "Where to?", whereToDemo: "Route search works in the app, not in this demo.",
    headlight: "Headlight",
    assistHeader: "ASSIST", assistOff: "OFF", assistLevel: "Assist level",
    assistState: (l, m) => `${l} of ${m}`, assistDisabled: "Assist off",
    motor: (w) => `MOTOR ${w} W`, unit: "KM/H", limitLabel: (n) => `LIMIT ${n}`,
    steady: "steady", trend: (v) => `${v >= 0 ? "+" : "−"}${fmt1(Math.abs(v))} in 3 s`,
    gaugeDesc: (s, l) => `Speed ${s} km/h, limit ${l}`,
    startSpare: (p) => `Back to start with ≈ ${p}% spare`,
    pendingLimit: (n) => `${n} km/h limit applies when you stop`,
    rideControls: "Ride controls",
    holdSwitch: (m) => `Hold to switch to ${m}`,
    stopTo: (m) => (m === "street" ? "Stop to switch to Street" : "Stop to switch to Offroad"),
    power: "Power", battery: "Battery",
    runSetup: "Run setup again", runSetupSub: "Shows your current values; nothing is reset",
    rideDisplay: "Ride display", rideDisplaySub: "Gauge, feel, orientation, volume buttons",
    profile: "Controller profile", bench: "Bench-verified", bundled: "Bundled with app", change: "Change",
    language: "Language", langSystem: "Phone language",
    rangeSettings: "Range estimates", home: "Home", start: "Start",
    pack: (v, ah, wh) => `${v} V × ${fmt1(ah)} Ah · ${wh} Wh`,
    smartAssist: "Smart assist",
    ceiling: "Highest automatic level", ceilingSub: "Boost and Smart assist never go above it.",
    climb: "Climb level", climbSub: "The level for climbs, up to the highest automatic level.",
    arrive: "Arrive with at least", arriveSub: "Smart assist eases off on flats, then on climbs, to keep this battery on arrival.",
    less: (t) => `Lower ${t}`, more: (t) => `Raise ${t}`,
    secSpeed: "Speed limit", active: "Active",
    switchTo: (m) => `Switch to ${m}`, pressHold: "Press and hold",
    ctrlLimit: "Controller limit", ctrlLimitSub: "What the controller enforces right now",
    applied: "Applied", applying: "Applying…", whenStopped: "Applies when stopped", waitingOk: "Waiting for your OK", lowerThan: "Lower than mode",
    maxSpeed: "Max speed",
    streetCap: (c) => `Street limit · legal maximum ${c} km/h`,
    aboveSaves: (c) => `Above the ${c} km/h legal limit — saves as Offroad`,
    offAbove: (c) => `Offroad limit · above the ${c} km/h legal limit`,
    offSub: "Offroad limit",
    jurisdiction: "Province or territory", jurisdictionCap: (p, c) => `${p} · legal limit ${c} km/h`, chooseJurisdiction: "Choose province or territory",
    lowerMoving: "Switch to Street while riding",
    lowerMovingSub: "The controller limit drops at your next stop. Offroad always needs a stop.",
    saveAsOff: (n) => `Save ${n} km/h as Offroad?`,
    saveAsOffBody: (c, p, s) => `That's above the ${c} km/h limit for power-assisted bicycles in ${p}, so it can only be your Offroad limit. Street mode stays at ${s} km/h.`,
    saveAsOffBtn: "Save as Offroad", cancel: "Cancel",
    ackTitle: (n) => `Offroad mode · ${n} km/h`,
    ackAbove: (c, p) => `This is above the ${c} km/h legal limit for power-assisted bicycles in ${p}.`,
    ackBody: "Use Offroad mode only on private land or where it's permitted. You're responsible for how the bike is ridden.",
    useStreet: "Use Street", okSeconds: (n) => `OK (${n})`,
    secGps: "Speed accuracy", gpsTitle: "Runs with the dongle",
    gpsSub: "Compares GPS speed with the controller's to catch a wrong wheel size.",
    groups: { bike: "Bike", battery: "Battery", pas: "Pedal Assist", motor: "Motor" },
    critical: "Critical", caution: "Caution",
    stopToChange: "Stop the bike to change this setting.",
    revert: "Revert", apply: "Apply", saved: "Saved.",
    decrease: (l) => `Decrease ${l}`, increase: (l) => `Increase ${l}`,
    changeQ: (l) => `Change ${l}?`,
    typedBody: "This setting affects safety or legality. Type CONFIRM to apply it.",
    typedWord: "CONFIRM", typedLabel: "Type CONFIRM",
    device: "Device", firmware: "Dongle firmware", versionUpdates: "Version and updates",
    about: "About", privacy: "Privacy policy", privacySub: "What the app stores and why",
    credits: "Map credits", creditsSub: "MapLibre, OpenMapTiles, OpenStreetMap and more",
    demoOnly: "Available in the app.",
    footer: `App ${APP_VERSION} · ${PROFILE.id} v${PROFILE.version}`,
    simulated: (p) => `Simulated bike running · ${p}`,
    close: "Close",
    preview: "LIVE PREVIEW", gaugeSec: "Gauge",
    styles: { ARC: "Arc", NEEDLE: "Needle", TAPE: "Tape", MINIMAL: "Minimal" },
    opacity: "Gauge opacity", opacityHint: "Lower it to see more of the map. Speed digits stay readable.",
    placement: "Gauge size and position", placementHint: "Long-press the gauge while stopped to move or resize it", reset: "Reset",
    feel: "Gauge feel", calm: "Calm", lively: "Lively",
    orientation: "Screen orientation", orientations: ["Auto", "Portrait", "Landscape"],
    volume: "Volume buttons change assist", volumeHint: "Up = more, down = less, with gloves",
    sweep: "Ignition sweep", sweepHint: "The gauge sweeps when the bike turns on",
    hills: "Hill shading", hills3d: "In 3D navigation", hills3dHint: "Shades the slopes around the route.",
    hills2d: "On the 2D map", hills2dHint: "Free ride and previews. Loads terrain data too.",
    provinces: { AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon" },
    settings_: {
      wheelSize: ["Wheel size", "Your wheel diameter. Used by the controller for speed measurement and the speed limit. Wrong values make the speedometer lie."],
      p5: ["Battery meter behavior (P5)", "How the battery gauge is computed. Low values react to voltage instantly (gauge bounces under load), higher values average it."],
      c12: ["Low-voltage cutoff adjust (C12)", "Shifts the voltage at which the controller shuts down to protect the battery. Setting it too low can over-discharge and destroy lithium batteries — a safety hazard."],
      c1: ["Pedal sensor type (C1)", "Which pedal-assist sensor your bike has. Wrong values mean no assist or assist that won't stop. Change only if pedal assist misbehaves."],
      c5: ["Maximum current (C5)", "Limits how much current the controller draws. Raising it increases power AND heat in your motor, wiring and battery. Can permanently damage components and void warranties."],
      c13: ["Regenerative braking (C13)", "Strength of regenerative braking, if your motor supports it (direct-drive hubs only). Geared motors ignore this."],
    },
    streets: ["Rue Ontario", "Av. du Parc", "Rue Rachel", "Boul. Saint-Laurent", "Rue Sherbrooke", "Av. Papineau"],
    canal: "Canal",
  };

  /* Profile settings (kt-uart-generic.json 0.4.0), in the app's display order. maxSpeedKmh is owned
     by the Speed limit section (SPEED_MODE_OWNED_SETTINGS). */
  const WHEELS = [16, 18, 20, 22, 24, 26, 27, 28, 29];
  const SETTINGS = [
    { id: "wheelSize", group: "bike", type: "enum", danger: "critical", options: WHEELS },
    { id: "p5", group: "battery", type: "int", min: 0, max: 40, danger: "none" },
    { id: "c12", group: "battery", type: "int", min: 0, max: 7, danger: "critical" },
    { id: "c1", group: "pas", type: "int", min: 0, max: 7, danger: "caution" },
    { id: "c5", group: "motor", type: "int", min: 0, max: 10, danger: "critical" },
    { id: "c13", group: "motor", type: "int", min: 0, max: 5, danger: "caution" },
  ];

  /* ---------------------------------------------------------------- state */

  const S = {
    speed: 0, currentA: 0, soc: START_SOC,
    assist: 2, light: false,
    mode: "street", jur: "QC",
    streetLimit: Infinity, offroadLimit: 45,
    ackLimit: null, pendingAck: null, allowLowerMoving: false, raiseApproved: 32,
    writing: false,
    held: { maxSpeedKmh: 32, wheelSize: 26, p5: 15, c12: 4, c1: 2, c5: 10, c13: 0 },
    // Ride display (RideDisplayPrefs defaults: Arc, Lively, 100 %, Auto)
    style: "ARC", feel: "LIVELY", opacity: 1, orientation: 0, volume: false, sweep: true, hills3d: true, hills2d: false,
    // Range and Smart assist (RangePrefs / SmartAssistPrefs defaults)
    pack: { v: 48, ah: 14 }, smart: { ceiling: 4, climb: 4, arrive: 25 },
    lang: FR ? "fr" : "en",
    // virtual ride
    along: 900,                    // metres along the loop
    startAlong: 0, usedWh: 0,
  };

  const cap = () => CAPS[S.jur];
  const provinceName = () => T.provinces[S.jur];
  const streetLimit = () => Math.min(cap(), S.streetLimit);
  const activeLimit = () => (S.mode === "street" ? streetLimit() : S.ackLimit);
  const moving = () => S.speed > STOPPED_KMH;
  const glanceMoving = () => S.speed > MOVING_KMH;
  const modeName = (m) => (m === "street" ? T.street : T.offroad);

  /** SpeedModeController.reconcile */
  function reconcile() {
    if (S.pendingAck != null) return { k: "confirm" };
    const desired = activeLimit();
    if (desired == null) return { k: "na" };
    const held = S.held.maxSpeedKmh;
    const stopped = !moving();
    if (held < desired) {
      if (S.raiseApproved !== desired) return { k: "sync" };
      return stopped ? { k: "write", v: desired } : { k: "pending", v: desired };
    }
    if (held === desired) return { k: "sync" };
    return stopped || S.allowLowerMoving ? { k: "write", v: desired } : { k: "pending", v: desired };
  }

  /** RidePresentation.modeSwitch */
  function modeSwitch() {
    const target = S.mode === "street" ? "offroad" : "street";
    if (!moving()) return { target, ok: true };
    if (target === "street" && S.allowLowerMoving) return { target, ok: true };
    return { target, ok: false, reason: T.stopTo(target) };
  }

  /** DashboardViewModel.settingWritability */
  function writability(setting) {
    if ((setting.danger === "critical" || setting.danger === "caution") && moving()) return "locked";
    if (setting.danger === "critical") return "typed";
    if (setting.danger === "caution") return "confirm";
    return "editable";
  }

  /** RidePresentation.gaugeMaxKmh */
  const gaugeMax = (limit) => Math.min(100, Math.max(40, Math.floor(((limit ?? 32) + 15 + 9) / 10) * 10));

  function formatSetting(setting, value) {
    if (setting.id === "wheelSize") return value === 27 ? '27" / 700C' : `${value}"`;
    return String(value);
  }
  const powerW = () => S.currentA * (44 + S.soc * 0.08);

  /* ---------------------------------------------------------------- icons (Material, filled) */

  const ICON = {
    settings: "M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
    search: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    flashOn: "M6 2h12v3H6zm0 5v1l2 3v11h8V11l2-3V7H6zm6 8.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
    flashOff: "M18 5V2H6v1.17L7.83 5zm-2 6 2-3V7H9.83L16 13.17zM2.81 2.81 1.39 4.22 8 10.83V22h8v-3.17l3.78 3.78 1.41-1.41z",
    back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
    check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    city: "M15 11V5l-3-3-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z",
    terrain: "M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z",
    schedule: "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z",
    lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z",
    warning: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
    bluetooth: "M17.71 7.71 12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29zM13 5.83l1.88 1.88L13 9.59V5.83zm1.88 10.46L13 18.17v-3.76l1.88 1.88z",
    memory: "M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z",
    privacy: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm1 16h-2v-6h2v6zm0-8h-2V7h2v2z",
    map: "M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z",
    speed: "M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z",
    replay: "M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z",
    battery: "M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z",
    home: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
    chevron: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
    add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
    remove: "M19 13H5v-2h14v2z",
    science: "M19.8 18.4 14 10.67V6.5l1.35-1.69c.26-.33.03-.81-.39-.81H9.04c-.42 0-.65.48-.39.81L10 6.5v4.17L4.2 18.4c-.49.66-.02 1.6.8 1.6h14c.82 0 1.29-.94.8-1.6z",
    gps: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.94 3A9 9 0 0 0 13 3.06V1h-2v2.06A9 9 0 0 0 3.06 11H1v2h2.06A9 9 0 0 0 11 20.94V23h2v-2.06A9 9 0 0 0 20.94 13H23v-2h-2.06zM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14z",
    battFull: "M17 5.33C17 4.6 16.4 4 15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33z",
    signal: "M2 22h20V2z",
    wifi: "M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8 3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4 2 2a7.07 7.07 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z",
  };
  const icon = (name, size = 24, color = "currentColor") =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${ICON[name]}" fill="${color}"/></svg>`;

  /* ---------------------------------------------------------------- DOM helpers */

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "html") node.innerHTML = value; // only ever trusted, static markup (icons)
      else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of [].concat(children)) if (child != null) node.append(child);
    return node;
  }
  const ico = (name, size, color) => el("span", { class: "kd-i", html: icon(name, size, color) });
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const toggleClass = (node, name, on) => node.classList.toggle(name, Boolean(on));

  /* ---------------------------------------------------------------- shell */

  const frame = el("div", { class: "kd-frame" });
  const app = el("div", { class: "kd", role: "group", "aria-label": T.region });
  frame.append(app);

  const mapCanvas = el("canvas", { class: "kd-map", "aria-hidden": "true" });
  const scrimTop = el("div", { class: "kd-scrim-top", "aria-hidden": "true" });
  const scrimBottom = el("div", { class: "kd-scrim-bottom", "aria-hidden": "true" });
  const hud = el("div", { class: "kd-hud" });
  const sysbar = el("div", { class: "kd-sysbar", "aria-hidden": "true" }, [
    el("span", { text: "9:41" }),
    el("span", { class: "kd-sysicons", html: icon("wifi", 15, "#EEF2F5") + icon("signal", 14, "#EEF2F5") + icon("battFull", 15, "#EEF2F5") }),
  ]);
  const snack = el("div", { class: "kd-snack", role: "status", "aria-live": "polite" });
  app.append(mapCanvas, scrimTop, scrimBottom, hud, sysbar, snack);

  let snackTimer = 0;
  function showSnack(message) {
    snack.textContent = message;
    snack.classList.add("show");
    clearTimeout(snackTimer);
    snackTimer = setTimeout(() => snack.classList.remove("show"), 2600);
  }

  /* Scale the 390x844 dp screen to the phone frame. */
  let scale = 1;
  function fit() {
    const w = frame.clientWidth || 276;
    scale = w / W;
    app.style.transform = `scale(${scale})`;
    sizeCanvases();
  }

  /* ---------------------------------------------------------------- overlays (sheets and dialogs) */

  let overlay = null; // { nodes, onDismiss, returnFocus }
  function openOverlay(panel, { onDismiss, label } = {}) {
    closeOverlay(false);
    const scrim = el("div", { class: "kd-scrim", onclick: () => dismissOverlay() });
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    if (label) panel.setAttribute("aria-label", label);
    panel.tabIndex = -1;
    app.append(scrim, panel);
    overlay = { nodes: [scrim, panel], onDismiss, returnFocus: document.activeElement };
    const first = panel.querySelector("button:not(:disabled), input");
    (first || panel).focus({ preventScroll: true });
  }
  function closeOverlay(restoreFocus = true) {
    if (!overlay) return;
    const { nodes, returnFocus } = overlay;
    overlay = null;
    nodes.forEach((n) => n.remove());
    if (restoreFocus && returnFocus && app.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  function dismissOverlay() {
    if (!overlay) return;
    const handler = overlay.onDismiss;
    closeOverlay();
    if (handler) handler();
  }
  app.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (overlay) { e.stopPropagation(); dismissOverlay(); return; }
    if (!rideDisplayPage.hidden) { e.stopPropagation(); showScreen("settings"); return; }
    if (!settingsPage.hidden) { e.stopPropagation(); showScreen("ride"); }
  });

  function dialog({ iconName, iconTone, title, paragraphs = [], extra = [], actions }) {
    const head = iconName ? el("div", { class: `kd-ico-head ${iconTone || ""}`, html: icon(iconName, 24) }) : null;
    return el("div", { class: "kd-dialog" }, [
      head,
      el("h3", { text: title }),
      ...paragraphs.map((p) => el("p", { text: p })),
      ...extra,
      el("div", { class: "kd-actions" }, actions),
    ]);
  }
  function sheet(children, label) {
    const node = el("div", { class: "kd-sheet" }, [el("div", { class: "kd-grip", "aria-hidden": "true" }), ...children]);
    openOverlay(node, { label });
    return node;
  }

  /* ---------------------------------------------------------------- hold-to-confirm (HoldToConfirmButton) */

  function holdButton({ onConfirmed, container }) {
    const titleNode = el("span", { class: "kd-t" });
    const hintNode = el("span", { class: "kd-s" });
    const leading = el("span", { class: "kd-hold-lead" });
    const button = el("button", { class: "kd-hold", type: "button", style: container ? { background: container } : null }, [
      leading, el("span", { class: "kd-grow" }, [titleNode, el("br"), hintNode]),
    ]);
    let start = 0, rafId = 0, progress = 0;
    const setProgress = (p) => { progress = p; button.style.setProperty("--p", p.toFixed(3)); };
    function step(now) {
      const p = Math.min(1, progress + (now - start) / HOLD_MS);
      start = now;
      setProgress(p);
      if (p >= 1) { finish(); onConfirmed(); return; }
      rafId = requestAnimationFrame(step);
    }
    function begin() {
      if (button.disabled || rafId) return;
      button.classList.remove("releasing");
      start = performance.now();
      rafId = requestAnimationFrame(step);
    }
    function finish() {
      cancelAnimationFrame(rafId);
      rafId = 0;
      button.classList.add("releasing");
      setProgress(0);
    }
    button.addEventListener("pointerdown", (e) => { if (e.button === 0) begin(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach((t) => button.addEventListener(t, () => { if (rafId) finish(); }));
    button.addEventListener("contextmenu", (e) => e.preventDefault());
    button.addEventListener("keydown", (e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); begin(); } });
    button.addEventListener("keyup", (e) => { if ((e.key === " " || e.key === "Enter") && rafId) finish(); });
    button.addEventListener("blur", () => { if (rafId) finish(); });
    return {
      node: button,
      set({ title, hint, enabled, fill, leadIcon, leadColor }) {
        text(titleNode, title);
        text(hintNode, hint);
        if (button.disabled === enabled) {
          button.disabled = !enabled;
          if (!enabled && rafId) finish();
        }
        button.style.setProperty("--hold-fill", fill);
        leading.hidden = !leadIcon;
        if (leadIcon && leading.dataset.icon !== leadIcon + leadColor) {
          leading.dataset.icon = leadIcon + leadColor;
          leading.innerHTML = icon(leadIcon, 24, leadColor);
        }
        button.setAttribute("aria-label", `${title}. ${hint}`);
      },
    };
  }

  /* ---------------------------------------------------------------- instrument engine (SpeedSignal) */

  const instrument = { speed: 0, velocity: 0, needle: 0, needleVelocity: 0, accel: 0, last: 0 };
  function advanceInstrument(now) {
    if (!instrument.last) { instrument.last = now; return; }
    let dtTotal = Math.min(0.25, (now - instrument.last) / 1000);
    instrument.last = now;
    const target = Math.max(0, S.speed);
    while (dtTotal > 0) {
      const dt = Math.min(0.004, dtTotal);
      dtTotal -= dt;
      const omega = S.feel === "CALM" ? 8 : 14;
      const d = instrument.speed - target;
      const c = instrument.velocity + omega * d;
      const decay = Math.exp(-omega * dt);
      instrument.speed = Math.max(0, target + (d + c * dt) * decay);
      instrument.velocity = (instrument.velocity - omega * c * dt) * decay;
      instrument.accel += (instrument.velocity - instrument.accel) * (1 - Math.exp(-dt / 0.25));
      // needle: zeta 0.55, omega 10
      const nOmega = 10, zeta = 0.55, nd = instrument.needle - target;
      const damp = zeta * nOmega, wd = nOmega * Math.sqrt(1 - zeta * zeta);
      const c2 = (instrument.needleVelocity + damp * nd) / wd;
      const cs = Math.cos(wd * dt), sn = Math.sin(wd * dt), e = Math.exp(-damp * dt);
      instrument.needle = target + e * (nd * cs + c2 * sn);
      instrument.needleVelocity = e * ((-damp * nd + wd * c2) * cs + (-damp * c2 - wd * nd) * sn);
    }
  }

  /* ---------------------------------------------------------------- gauge (Gauges.kt, 300x300 design geometry) */

  /**
   * Draws one gauge face into ctx at the current transform (300x300 units).
   * f: { speed, needle, accel, power, limit, style, onMap, dial (0..1) }
   */
  function drawGauge(ctx, f) {
    const fullScale = gaugeMax(f.limit);
    const dial = Math.min(1, Math.max(0, f.dial ?? 1));
    const readout = Math.max(dial, 0.85);
    let layer = dial;
    const speed = Math.max(0, f.speed);
    const fraction = Math.min(1, Math.max(0, speed / fullScale));
    const pf = Math.min(1, Math.max(0, (f.power || 0) / 1000));
    const over = f.limit != null && speed > f.limit + 0.5;
    const active = over ? C.red : C.volt;
    const digit = over ? C.red : C.text;
    const end = 135 + 270 * fraction;
    const limitAngle = 135 + 270 * Math.min(1, Math.max(0, (f.limit ?? 0) / fullScale));
    const zoneEnd = 135 + 270 * Math.min(1, Math.max(0, ((f.limit ?? 0) + 3) / fullScale));
    const track = f.onMap ? "rgba(10,13,16,1)" : C.highest;
    const trackAlpha = f.onMap ? 0.75 : 1;
    const rad = (d) => (d * Math.PI) / 180;
    const tenths = Math.round(speed * 10);
    const whole = String(Math.floor(tenths / 10));
    const decimal = (FR ? "," : ".") + (tenths % 10);
    const motorLabel = T.motor(Math.round(f.power || 0));

    const line = (x1, y1, x2, y2, color, width) => {
      ctx.globalAlpha = layer; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    const arc = (r, start, sweep, color, width, alpha = 1, cx = 150, cy = 150) => {
      if (sweep <= 0.01) return;
      ctx.globalAlpha = alpha * layer; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, r, rad(start), rad(start + sweep)); ctx.stroke();
    };
    const rect = (x, y, w, h, r, color, alpha = 1) => {
      if (w <= 0) return;
      ctx.globalAlpha = alpha * layer; ctx.fillStyle = color;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); ctx.fill();
    };
    const circle = (x, y, r, color, alpha = 1) => {
      ctx.globalAlpha = alpha * layer; ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    const label = (value, x, y, size, color, align = "center") => {
      ctx.font = `700 ${size}px ${SANS}`;
      ctx.textAlign = align; ctx.textBaseline = "alphabetic";
      if (f.onMap) {
        ctx.globalAlpha = layer; ctx.strokeStyle = C.ink; ctx.lineWidth = 7; ctx.lineJoin = "round";
        ctx.strokeText(value, x, y);
      }
      ctx.globalAlpha = layer; ctx.fillStyle = color;
      ctx.fillText(value, x, y);
    };
    const readable = (draw) => { layer = readout; draw(); layer = dial; };
    const digits = (y, big, small) => readable(() => {
      ctx.font = `700 ${big}px ${SANS}`;
      const ww = ctx.measureText(whole).width;
      ctx.font = `700 ${small}px ${SANS}`;
      const dw = ctx.measureText(decimal).width;
      const x = 150 - (ww + dw) / 2;
      label(whole, x, y, big, digit, "left");
      label(decimal, x + ww, y, small, digit, "left");
    });
    const limitTick = (inner, outer, width) => {
      if (f.limit == null) return;
      const a = rad(limitAngle), x = Math.cos(a), y = Math.sin(a);
      readable(() => line(150 + inner * x, 150 + inner * y, 150 + outer * x, 150 + outer * y, C.amber, width));
    };
    const tick = (v) => { const a = rad(135 + 270 * v / fullScale); return [Math.cos(a), Math.sin(a)]; };

    ctx.save();
    if (f.style === "ARC") {
      arc(118, 135, 270, track, 14, trackAlpha);
      if (f.limit != null) {
        arc(118, limitAngle, zoneEnd - limitAngle, C.amber, 14, 0.45);
        arc(118, zoneEnd, 405 - zoneEnd, C.red, 14, 0.22);
      }
      for (let v = 0; v <= fullScale; v += 10) {
        const [x, y] = tick(v);
        line(150 + 100 * x, 150 + 100 * y, 150 + 92 * x, 150 + 92 * y, C.line, 2);
        label(String(v), 150 + 80 * x, 154 + 80 * y, 11, C.muted);
      }
      arc(140, 135, 270 * pf, C.sky, 4, 0.35 + 0.65 * pf);
      arc(118, 135, end - 135, active, 14, 0.55);
      const tail = 8 + 34 * Math.min(1, Math.max(0, f.accel / 4));
      arc(118, Math.max(135, end - tail), Math.min(tail, end - 135), active, 18);
      if (speed > 0.3) {
        const a = rad(end), x = 150 + 118 * Math.cos(a), y = 150 + 118 * Math.sin(a);
        circle(x, y, 17, active, 0.18); circle(x, y, 7, C.text);
      }
      limitTick(104, 134, 4);
      digits(158, 78, 28);
      readable(() => label(T.unit, 150, 186, 13, C.muted));
      label(motorLabel, 150, 222, 15, C.sky);
    } else if (f.style === "NEEDLE") {
      if (!f.onMap) circle(150, 150, 138, C.inkLow);
      arc(138, 0, 360, track, 2, trackAlpha);
      if (f.limit != null) readable(() => {
        arc(128, limitAngle, zoneEnd - limitAngle, C.amber, 7);
        arc(128, zoneEnd, 405 - zoneEnd, C.red, 7, 0.7);
      });
      for (let v = 0; v <= fullScale; v += 2) {
        const major = v % 10 === 0;
        const [x, y] = tick(v), inner = major ? 116 : 124;
        line(150 + 132 * x, 150 + 132 * y, 150 + inner * x, 150 + inner * y, major ? C.muted : C.line, major ? 3 : 1.5);
        if (major) label(String(v), 150 + 98 * x, 155 + 98 * y, 15, C.muted);
      }
      arc(26, 180, 180, track, 6, 1, 150, 232);
      arc(26, 180, 180 * pf, C.sky, 6, 1, 150, 232);
      label(motorLabel, 150, 246, 11, C.sky);
      readable(() => label(whole, 150, 200, 30, digit));
      const a = rad(135 + 270 * Math.min(1.02, Math.max(-0.02, f.needle / fullScale)));
      const x = Math.cos(a), y = Math.sin(a);
      ctx.globalAlpha = layer; ctx.fillStyle = active;
      ctx.beginPath();
      ctx.moveTo(150 + 118 * x, 150 + 118 * y); ctx.lineTo(150 + 6 * y, 150 - 6 * x);
      ctx.lineTo(150 - 24 * x, 150 - 24 * y); ctx.lineTo(150 - 6 * y, 150 + 6 * x);
      ctx.closePath(); ctx.fill();
      circle(150, 150, 11, C.text); circle(150, 150, 4, C.ink);
    } else if (f.style === "TAPE") {
      digits(118, 96, 32);
      readable(() => label(T.unit, 150, 144, 13, C.muted));
      const prediction = f.accel * 3;
      const trendX = Math.min(280, Math.max(20, 150 + prediction * 11));
      if (Math.abs(trendX - 150) > 6) {
        const dir = trendX > 150 ? 1 : -1;
        line(150, 176, trendX - dir * 8, 176, C.volt, 3);
        ctx.globalAlpha = layer; ctx.fillStyle = C.volt;
        ctx.beginPath(); ctx.moveTo(trendX, 176); ctx.lineTo(trendX - dir * 10, 169); ctx.lineTo(trendX - dir * 10, 183); ctx.closePath(); ctx.fill();
      }
      label(Math.abs(prediction) < 0.55 ? T.steady : T.trend(prediction), (150 + trendX) / 2, 166, 11, C.volt);
      rect(12, 192, 276, 62, 12, track, trackAlpha);
      const limitX = 150 + ((f.limit ?? 0) - speed) * 11;
      if (f.limit != null) { const zx = Math.min(288, Math.max(12, limitX)); rect(zx, 192, 288 - zx, 62, 0, C.red, 0.12); }
      const first = Math.floor(speed) - 14;
      for (let v = first; v <= first + 29; v++) {
        const x = 150 + (v - speed) * 11;
        if (v < 0 || x < 16 || x > 284) continue;
        const major = v % 5 === 0;
        const color = f.limit != null && v > f.limit ? C.red : major ? C.muted : C.line;
        line(x, major ? 218 : 236, x, 252, color, major ? 2 : 1);
        if (major) label(String(v), x, 210, 13, C.muted);
      }
      if (f.limit != null && limitX >= 12 && limitX <= 288) readable(() => line(limitX, 192, limitX, 254, C.amber, 4));
      line(150, 188, 150, 256, C.volt, 3);
      ctx.globalAlpha = layer; ctx.fillStyle = C.volt;
      ctx.beginPath(); ctx.moveTo(150, 256); ctx.lineTo(140, 272); ctx.lineTo(160, 272); ctx.closePath(); ctx.fill();
      label(motorLabel, 150, 292, 14, C.sky);
    } else {
      readable(() => { label(whole, 150, 190, 168, digit); label(T.unit, 150, 222, 14, C.muted); });
      rect(30, 246, 240, 8, 4, track, trackAlpha);
      rect(30, 268, 240, 3, 1.5, track, trackAlpha);
      const breath = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(performance.now() / 600));
      rect(30, 246, 240 * pf, 8, 4, C.sky, breath);
      rect(30, 268, 240 * fraction, 3, 1.5, active);
      if (f.limit != null) readable(() => { const x = 30 + 240 * Math.min(1, f.limit / fullScale); line(x, 262, x, 277, C.amber, 3); });
      label(motorLabel, 30, 294, 12, C.sky, "left");
      if (f.limit != null) readable(() => label(T.limitLabel(f.limit), 270, 294, 12, C.amber, "right"));
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- the map (illustration, Kurant Night palette) */

  // A city on a grid rotated 12° from north, in metres. The virtual bike rides a loop of major roads.
  const CELL_U = 110, CELL_V = 82, GRID_DEG = -12;
  const MAJOR_EVERY = 5;
  const LOOP = [[0, 0], [10 * CELL_U, 0], [10 * CELL_U, 10 * CELL_V], [0, 10 * CELL_V]];
  const LOOP_SEGS = LOOP.map((p, i) => {
    const q = LOOP[(i + 1) % LOOP.length];
    return { a: p, b: q, len: Math.hypot(q[0] - p[0], q[1] - p[1]) };
  });
  const LOOP_LEN = LOOP_SEGS.reduce((s, x) => s + x.len, 0);
  function loopAt(along) {
    let d = ((along % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
    for (const s of LOOP_SEGS) {
      if (d <= s.len) {
        const t = d / s.len;
        return { u: s.a[0] + (s.b[0] - s.a[0]) * t, v: s.a[1] + (s.b[1] - s.a[1]) * t, dir: Math.atan2(s.b[0] - s.a[0], -(s.b[1] - s.a[1])) };
      }
      d -= s.len;
    }
    return { u: 0, v: 0, dir: 0 };
  }
  const hash = (x, y, k = 0) => {
    let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const isPark = (i, j) => (i === 3 && j >= 2 && j <= 4) || (i === 4 && j >= 2 && j <= 4) || (i >= -6 && i <= -4 && j >= 6 && j <= 8) || (hash(i, j, 7) < 0.035);
  const CANAL_V = -2.5 * CELL_V; // a canal parallel to the grid, north of the loop

  const view = { bearing: GRID_DEG, mPerPx: 1, trail: [] };
  let mapCtx = null, gaugeCtx = null, dpr = 1;
  function sizeCanvases() {
    dpr = Math.min(2.5, (window.devicePixelRatio || 1) * scale);
    const rw = Math.round(W * dpr), rh = Math.round(H * dpr);
    if (mapCanvas.width !== rw) { mapCanvas.width = rw; mapCanvas.height = rh; }
    const gs = Math.round(gaugeBox.w * dpr);
    if (gaugeCanvas.width !== gs) { gaugeCanvas.width = gs; gaugeCanvas.height = gs; }
    mapCtx = mapCanvas.getContext("2d");
    gaugeCtx = gaugeCanvas.getContext("2d");
    dirty = true;
  }

  const PUCK = { x: W * 0.5, y: H * 0.43 };            // Integration contract: 2D follow at x 50 %, y 43 %
  const zoomForSpeed = (kmh) => 17 + (15 - 17) * Math.min(1, Math.max(0, (kmh - 10) / 25));
  const mPerPxAtZoom = (z) => 109725 / Math.pow(2, z);   // 156543 · cos(45.5°) / 2^z

  function angleLerp(a, b, t) {
    let d = ((b - a + 540) % 360) - 180;
    return a + d * t;
  }

  function drawMap(dt) {
    const ctx = mapCtx;
    if (!ctx) return;
    const pos = loopAt(S.along);
    // Heading-up while moving, north-up when stopped (MapCamera.cameraBearingFor).
    const targetBearing = glanceMoving() ? (pos.dir * 180) / Math.PI : GRID_DEG;
    view.bearing = REDUCE ? targetBearing : angleLerp(view.bearing, targetBearing, Math.min(1, dt * 2.2));
    const targetM = mPerPxAtZoom(zoomForSpeed(S.speed));
    view.mPerPx = REDUCE ? targetM : view.mPerPx + (targetM - view.mPerPx) * Math.min(1, dt * 1.2);
    const k = 1 / view.mPerPx;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = C.mapBase;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(PUCK.x, PUCK.y);
    ctx.rotate((-view.bearing * Math.PI) / 180);
    ctx.scale(k, k);
    ctx.translate(-pos.u, -pos.v);

    const R = Math.hypot(W, H) * view.mPerPx * 0.62;
    const i0 = Math.floor((pos.u - R) / CELL_U) - 1, i1 = Math.ceil((pos.u + R) / CELL_U) + 1;
    const j0 = Math.floor((pos.v - R) / CELL_V) - 1, j1 = Math.ceil((pos.v + R) / CELL_V) + 1;
    const px = view.mPerPx;

    // water
    ctx.fillStyle = C.water;
    ctx.fillRect(i0 * CELL_U, CANAL_V - 18, (i1 - i0) * CELL_U, 36);

    // lots and parks
    const lotsA = new Path2D(), lotsB = new Path2D(), parks = new Path2D();
    const inset = 7;
    for (let i = i0; i < i1; i++) {
      for (let j = j0; j < j1; j++) {
        const u = i * CELL_U, v = j * CELL_V;
        if (v < CANAL_V + 20 && v + CELL_V > CANAL_V - 20) continue;
        if (isPark(i, j)) { parks.rect(u + inset - 2, v + inset - 2, CELL_U - 2 * inset + 4, CELL_V - 2 * inset + 4); continue; }
        if (hash(i, j, 1) < 0.08) continue;
        const split = hash(i, j, 2);
        const target = hash(i, j, 3) < 0.3 ? lotsB : lotsA;
        const w = CELL_U - 2 * inset, h = CELL_V - 2 * inset;
        const x = u + inset, y = v + inset;
        if (split < 0.35) target.rect(x, y, w, h);
        else if (split < 0.7) { target.rect(x, y, w * 0.45, h); (hash(i, j, 4) < 0.5 ? lotsA : lotsB).rect(x + w * 0.5, y, w * 0.5, h); }
        else { target.rect(x, y, w, h * 0.42); lotsA.rect(x, y + h * 0.48, w * 0.58, h * 0.52); lotsB.rect(x + w * 0.62, y + h * 0.48, w * 0.38, h * 0.52); }
      }
    }
    ctx.fillStyle = C.park; ctx.fill(parks);
    ctx.lineWidth = px * 1; ctx.strokeStyle = C.parkEdge; ctx.stroke(parks);
    ctx.fillStyle = C.lotA; ctx.fill(lotsA);
    ctx.fillStyle = C.lotB; ctx.fill(lotsB);
    if (px < 1.6) { ctx.lineWidth = px * 0.8; ctx.strokeStyle = C.lotEdge; ctx.stroke(lotsA); ctx.stroke(lotsB); }

    // minor roads
    const minor = new Path2D(), major = new Path2D();
    for (let i = i0; i <= i1; i++) {
      const u = i * CELL_U;
      (i % MAJOR_EVERY === 0 ? major : minor).moveTo(u, j0 * CELL_V);
      (i % MAJOR_EVERY === 0 ? major : minor).lineTo(u, j1 * CELL_V);
    }
    for (let j = j0; j <= j1; j++) {
      const v = j * CELL_V;
      (j % MAJOR_EVERY === 0 ? major : minor).moveTo(i0 * CELL_U, v);
      (j % MAJOR_EVERY === 0 ? major : minor).lineTo(i1 * CELL_U, v);
    }
    ctx.lineCap = "butt";
    ctx.strokeStyle = C.mapMinor; ctx.lineWidth = Math.max(8, 3.5 * px); ctx.stroke(minor);
    ctx.strokeStyle = C.mapBase; ctx.lineWidth = Math.max(15, 14 * px); ctx.stroke(major);
    ctx.strokeStyle = C.mapMajor; ctx.lineWidth = Math.max(10, 9 * px); ctx.stroke(major);
    // bike lane (Sky), along the loop's first avenue
    ctx.strokeStyle = "rgba(91,200,245,.55)"; ctx.lineWidth = Math.max(2.5, 3 * px);
    ctx.beginPath(); ctx.moveTo(i0 * CELL_U, 11); ctx.lineTo(i1 * CELL_U, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10 * CELL_U + 11, j0 * CELL_V); ctx.lineTo(10 * CELL_U + 11, j1 * CELL_V); ctx.stroke();

    // trail behind the rider (Volt)
    if (view.trail.length > 1) {
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = C.ink; ctx.lineWidth = 9 * px;
      ctx.beginPath(); view.trail.forEach(([u, v], n) => (n ? ctx.lineTo(u, v) : ctx.moveTo(u, v))); ctx.lineTo(pos.u, pos.v); ctx.stroke();
      ctx.strokeStyle = C.volt; ctx.lineWidth = 5 * px;
      ctx.beginPath(); view.trail.forEach(([u, v], n) => (n ? ctx.lineTo(u, v) : ctx.moveTo(u, v))); ctx.lineTo(pos.u, pos.v); ctx.stroke();
    }

    // street names along the major roads, kept upright
    ctx.font = `400 ${11 * px}px ${SANS}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const upright = (deg) => { const a = ((deg % 360) + 360) % 360; return a > 90 && a < 270; };
    for (let i = Math.ceil(i0 / MAJOR_EVERY) * MAJOR_EVERY; i <= i1; i += MAJOR_EVERY) {
      for (let j = j0 - (j0 % 4); j <= j1; j += 4) {
        const name = T.streets[((i / MAJOR_EVERY) % 3 + 3) % 3];
        ctx.save(); ctx.translate(i * CELL_U + 16 * px, (j + 0.5) * CELL_V);
        ctx.rotate(Math.PI / 2 + (upright(view.bearing - 90) ? Math.PI : 0));
        ctx.lineWidth = 3 * px; ctx.strokeStyle = C.mapBase; ctx.strokeText(name, 0, 0);
        ctx.fillStyle = C.label; ctx.fillText(name, 0, 0); ctx.restore();
      }
    }
    for (let j = Math.ceil(j0 / MAJOR_EVERY) * MAJOR_EVERY; j <= j1; j += MAJOR_EVERY) {
      for (let i = i0 - (i0 % 4); i <= i1; i += 4) {
        const name = T.streets[3 + ((j / MAJOR_EVERY) % 3 + 3) % 3];
        ctx.save(); ctx.translate((i + 0.5) * CELL_U, j * CELL_V - 14 * px);
        if (upright(view.bearing)) ctx.rotate(Math.PI);
        ctx.lineWidth = 3 * px; ctx.strokeStyle = C.mapBase; ctx.strokeText(name, 0, 0);
        ctx.fillStyle = C.label; ctx.fillText(name, 0, 0); ctx.restore();
      }
    }
    ctx.restore();

    // the rider: cone, halo and dot, always pointing the way the map is turned
    const rel = ((pos.dir * 180) / Math.PI - view.bearing) * Math.PI / 180;
    ctx.save();
    ctx.translate(PUCK.x, PUCK.y);
    ctx.rotate(rel);
    ctx.fillStyle = "rgba(200,240,49,.22)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-52 * Math.sin(0.42), -52 * Math.cos(0.42)); ctx.lineTo(52 * Math.sin(0.42), -52 * Math.cos(0.42)); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(200,240,49,.2)"; ctx.beginPath(); ctx.arc(PUCK.x, PUCK.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.volt; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(PUCK.x, PUCK.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  /* ---------------------------------------------------------------- ride surface: status row */

  const linkPill = el("button", { class: "kd-link", type: "button", "aria-label": `${T.simulator}. ${T.connectionSettings}` }, [
    el("span", { class: "kd-link-pill" }, [el("span", { class: "kd-dot", "aria-hidden": "true" }), el("span", { text: T.simulator })]),
  ]);
  linkPill.addEventListener("click", openConnectionSheet);
  const modeWord = el("span", { class: "kd-mode-word" });
  const modeLimit = el("span", { class: "kd-mode-limit" });
  const modeChip = el("button", { class: "kd-mode", type: "button" }, [el("span", { class: "kd-mode-pill" }, [modeWord, modeLimit])]);
  modeChip.addEventListener("click", openRideControls);
  const settingsButton = el("button", { class: "kd-round64", type: "button", "aria-label": T.settings }, [
    el("span", { class: "kd-round48", html: icon("settings", 22) }),
  ]);
  settingsButton.addEventListener("click", () => showScreen("settings"));
  const statusRow = el("div", { class: "kd-status-row" }, [linkPill, modeChip, settingsButton]);

  /* chips (two at most) */
  const chips = el("div", { class: "kd-chips" });

  /* gauge */
  const gaugeBox = (() => {
    // rideGeometry(390, 844, 0): gauge 260 dp at top 404 (shrunk to clear the ladder at 668)
    const rowTop = H - 20 - 64, ladderTop = Math.min(H * 676 / 844, rowTop - 8 - 84);
    const side = 300, top = 404, limit = ladderTop - 4;
    const fitted = Math.min(side, Math.max(Math.min(side, Math.max(side * 0.85, 255)), limit - top));
    const gaugeTop = Math.min(top, limit - fitted);
    return { x: W / 2 - fitted / 2, y: gaugeTop, w: fitted, ladderTop, rowTop };
  })();
  const gaugeCanvas = el("canvas", { class: "kd-gauge", role: "img",
    style: { left: `${gaugeBox.x}px`, top: `${gaugeBox.y}px`, width: `${gaugeBox.w}px`, height: `${gaugeBox.w}px` } });

  /* assist ladder */
  const ladderValue = el("span", { class: "kd-overline" });
  const ladderBars = ASSIST_LEVELS.map((level) => {
    const label = el("span", { class: level === 0 ? "kd-bar-off" : "kd-bar-n", text: level === 0 ? T.assistOff : String(level) });
    const sheen = el("span", { class: "kd-bar-sheen" });
    const bar = el("span", { class: "kd-bar-fill", style: { height: `${[28, 32, 38, 44, 50, 56][level]}px` } }, [sheen, label]);
    const slot = el("span", { class: `kd-bar ${level === 0 ? "off" : ""}` }, bar);
    return { level, slot, bar, sheen };
  });
  const ladderRow = el("div", { class: "kd-ladder-row" }, ladderBars.map((b) => b.slot));
  const ladder = el("div", { class: "kd-ladder", role: "slider", tabindex: "0", "aria-label": T.assistLevel, "aria-valuemin": "0", "aria-valuemax": "5",
    style: { top: `${gaugeBox.ladderTop}px` } }, [
    el("div", { class: "kd-ladder-head" }, [el("span", { class: "kd-overline mute", text: T.assistHeader }), ladderValue]),
    ladderRow,
  ]);
  let ladderPreview = null;
  const levelAtX = (clientX) => {
    const rects = ladderBars.map((b) => b.slot.getBoundingClientRect());
    let best = 0, bestD = Infinity;
    rects.forEach((r, i) => {
      const d = clientX < r.left ? r.left - clientX : clientX > r.right ? clientX - r.right : 0;
      if (d < bestD) { bestD = d; best = i; }
    });
    return ASSIST_LEVELS[best];
  };
  ladderRow.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ladderRow.setPointerCapture(e.pointerId);
    ladderPreview = levelAtX(e.clientX);
    syncLadder();
  });
  ladderRow.addEventListener("pointermove", (e) => {
    if (ladderPreview == null) return;
    const next = levelAtX(e.clientX);
    if (next !== ladderPreview) { ladderPreview = next; syncLadder(); }
  });
  const endLadder = (send) => {
    if (ladderPreview == null) return;
    const level = ladderPreview;
    ladderPreview = null;
    if (send) setAssist(level); else syncLadder();
  };
  ladderRow.addEventListener("pointerup", () => endLadder(true));
  ladderRow.addEventListener("pointercancel", () => endLadder(false));
  ladder.addEventListener("keydown", (e) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    setAssist(Math.min(5, Math.max(0, S.assist + delta)));
  });

  /* bottom row */
  const whereTo = el("button", { class: "kd-where", type: "button" }, [ico("search", 24), el("span", { text: T.whereTo })]);
  whereTo.addEventListener("click", () => showSnack(T.whereToDemo));
  const headlight = el("button", { class: "kd-headlight", type: "button", role: "switch", "aria-checked": "false", "aria-label": T.headlight }, [
    el("span", { class: "kd-headlight-c", html: icon("flashOff", 30) }),
  ]);
  headlight.addEventListener("click", () => { S.light = !S.light; syncRide(); });
  const bottomRow = el("div", { class: "kd-bottom-row", style: { top: `${gaugeBox.rowTop}px` } }, [whereTo, headlight]);

  hud.append(statusRow, chips, gaugeCanvas, ladder, bottomRow);

  function setAssist(level) {
    if (S.assist === level) { syncLadder(); return; }
    S.assist = level;
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* not allowed */ } }
    syncRide();
    popBar(level);
  }
  function popBar(level) {
    const bar = ladderBars[level].bar;
    if (REDUCE) return;
    bar.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)", offset: 0.3 }, { transform: "scale(1)" }], { duration: 320, easing: "ease-out" });
  }

  function syncLadder() {
    const shown = ladderPreview ?? S.assist;
    text(ladderValue, shown === 0 ? T.assistOff : `${shown} / 5`);
    ladderValue.classList.toggle("mute", shown === 0);
    ladderValue.classList.toggle("volt", shown !== 0);
    ladderBars.forEach(({ level, bar }) => {
      const lit = level > 0 && level <= shown;
      bar.classList.toggle("lit", lit);
      bar.classList.toggle("current", lit && level === shown);
      bar.classList.toggle("off-selected", level === 0 && shown === 0);
    });
    ladder.setAttribute("aria-valuenow", String(S.assist));
    ladder.setAttribute("aria-valuetext", S.assist === 0 ? T.assistDisabled : T.assistState(S.assist, 5));
  }

  let chipsKey = "";
  function syncChips() {
    const list = [];
    const sync = reconcile();
    if (sync.k === "pending") list.push({ key: `pending-${sync.v}`, node: () => el("div", { class: "kd-alert-chip" }, [ico("schedule", 24, C.sky), el("span", { text: T.pendingLimit(sync.v) })]) });
    // Range chip: way back to where this ride started (no home set), hidden within 500 m of it.
    const p = loopAt(S.along), st = loopAt(S.startAlong);
    const distKm = Math.hypot(p.u - st.u, p.v - st.v) / 1000;
    if (distKm > 0.5) {
      const capacity = S.pack.v * S.pack.ah;
      const spare = Math.max(0, Math.min(1, (capacity * (S.soc / 100) - distKm * 1.25 * WH_PER_KM[S.assist]) / capacity));
      const pct = Math.round(spare * 100);
      list.push({ key: `range-${pct}`, node: () => el("div", { class: "kd-range-chip" }, [ico("check", 16, C.volt), el("span", { text: T.startSpare(pct) })]) });
    }
    const shown = list.slice(0, 2);
    const key = shown.map((c) => c.key).join("|");
    if (key === chipsKey) return;
    const kinds = (k) => k.split("|").map((x) => x.split("-")[0]).join("|");
    const replay = kinds(key) !== kinds(chipsKey);
    chipsKey = key;
    chips.replaceChildren(...shown.map((c) => {
      const node = c.node();
      if (replay && !REDUCE) node.animate([{ opacity: 0, transform: "translateY(-12px)" }, { opacity: 1, transform: "none" }], { duration: 250, easing: "cubic-bezier(.2,0,0,1)" });
      return node;
    }));
  }

  function syncRide() {
    const active = activeLimit();
    text(modeWord, `${modeName(S.mode).toLocaleUpperCase(FR ? "fr" : "en")}\u00A0·\u00A0`);
    text(modeLimit, active != null ? String(active) : "––");
    modeChip.setAttribute("aria-label", `${modeName(S.mode)} · ${active ?? "––"}`);
    syncLadder();
    whereTo.disabled = glanceMoving();
    headlight.setAttribute("aria-checked", String(S.light));
    headlight.classList.toggle("on", S.light);
    const hc = headlight.firstChild;
    if (hc.dataset.on !== String(S.light)) { hc.dataset.on = String(S.light); hc.innerHTML = icon(S.light ? "flashOn" : "flashOff", 30); }
    syncChips();
    const limit = S.held.maxSpeedKmh ?? active;
    gaugeCanvas.setAttribute("aria-label", T.gaugeDesc(fmt1(S.speed), limit));
    if (rideSheet) rideSheet.sync();
    dirty = true;
  }

  /* ---------------------------------------------------------------- Ride controls sheet (mode chip) */

  let rideSheet = null;
  function openRideControls() {
    const control = holdButton({ onConfirmed: () => requestModeSwitch(modeSwitch().target) });
    const powerValue = el("b"), batteryValue = el("b"), batteryBar = el("i");
    const stats = el("div", { class: "kd-stats" }, [
      el("div", { class: "kd-stat" }, [el("div", { class: "kd-overline mute", text: T.power.toLocaleUpperCase() }), el("div", { class: "kd-stat-v" }, [powerValue, el("span", { text: "W" })])]),
      el("div", { class: "kd-stat" }, [el("div", { class: "kd-overline mute", text: T.battery.toLocaleUpperCase() }), el("div", { class: "kd-stat-v" }, [batteryValue, el("span", { text: "%" })]), el("div", { class: "kd-batt", "aria-hidden": "true" }, batteryBar)]),
    ]);
    sheet([el("h3", { class: "kd-sheet-title", text: T.rideControls }), control.node, stats], T.rideControls);
    rideSheet = {
      sync() {
        const sw = modeSwitch();
        const active = activeLimit();
        control.set({
          title: `${modeName(S.mode)}${active != null ? ` · ${active} km/h` : ""}`,
          hint: sw.ok ? T.holdSwitch(modeName(sw.target)) : sw.reason,
          enabled: sw.ok,
          fill: sw.target === "offroad" ? C.amber : C.volt,
          leadIcon: S.mode === "street" ? "city" : "terrain",
          leadColor: S.mode === "street" ? C.volt : C.amber,
        });
        text(powerValue, String(Math.round(powerW())));
        const soc = Math.round(S.soc);
        text(batteryValue, String(soc));
        batteryBar.style.width = `${soc}%`;
        batteryBar.style.background = soc <= 10 ? C.red : soc <= 25 ? C.amber : C.green;
      },
    };
    const prev = overlay.onDismiss;
    overlay.onDismiss = () => { rideSheet = null; if (prev) prev(); };
    rideSheet.sync();
  }
  const closeRideSheet = () => { if (rideSheet) { rideSheet = null; closeOverlay(); } };

  /* ---------------------------------------------------------------- cover screens: Settings and Ride display */

  const settingsPage = el("section", { class: "kd-cover", "aria-label": T.settings, hidden: true });
  const rideDisplayPage = el("section", { class: "kd-cover", "aria-label": T.rideDisplay, hidden: true });
  app.insertBefore(settingsPage, sysbar);
  app.insertBefore(rideDisplayPage, sysbar);

  function showScreen(name) {
    closeRideSheet();
    settingsPage.hidden = name !== "settings";
    rideDisplayPage.hidden = name !== "ride-display";
    hud.inert = name !== "ride";
    if (name === "settings") { syncSettings(); settingsScroll.focus({ preventScroll: true }); }
    if (name === "ride-display") { syncRideDisplay(); rdScroll.scrollTop = 0; rdScroll.focus({ preventScroll: true }); }
    if (name === "ride") settingsButton.focus({ preventScroll: true });
  }

  const section = (label) => el("div", { class: "kd-section", text: label.toLocaleUpperCase(FR ? "fr" : "en") });
  const navRow = (iconName, title, sub, onClick) => el("button", { class: "kd-nav-row", type: "button", onclick: onClick }, [
    el("span", { class: "kd-nav-ico", html: icon(iconName, 20) }),
    el("span", { class: "kd-grow" }, [el("span", { class: "kd-t", text: title }), sub ? el("span", { class: "kd-s block", text: sub }) : null]),
  ]);
  const badge = (label, tone) => el("span", { class: `kd-badge ${tone || ""}`, text: label });

  /* Settings */
  const settingsScroll = el("div", { class: "kd-scroll", tabindex: "-1" });
  settingsPage.append(
    el("div", { class: "kd-cover-top" }, el("button", { class: "kd-back", type: "button", "aria-label": T.back, html: icon("back", 24), onclick: () => showScreen("ride") })),
    settingsScroll,
  );

  const profileCard = el("div", { class: "kd-panel" }, [
    el("div", { class: "kd-row kd-top" }, [
      el("div", { class: "kd-grow" }, [
        el("div", { class: "kd-overline mute", text: T.profile.toLocaleUpperCase() }),
        el("div", { class: "kd-title-m", text: PROFILE.name }),
        el("div", { class: "kd-s", text: PROFILE.brands }),
      ]),
      badge(T.bench, "ok"),
    ]),
    el("div", { class: "kd-row", style: { marginTop: "12px", gap: "8px" } }, [
      badge(T.bundled), badge(`v${PROFILE.version}`),
      el("span", { class: "kd-grow" }),
      el("button", { class: "kd-btn-text", type: "button", text: T.change, onclick: openConnectionSheet }),
    ]),
  ]);

  const langChips = [["system", T.langSystem], ["en", "English"], ["fr", "Français"]].map(([tag, label]) => {
    const chip = el("button", { class: "kd-filter", type: "button", "aria-pressed": "false" }, [ico("check", 18), el("span", { text: label })]);
    chip.addEventListener("click", () => { S.lang = tag; syncSettings(); showSnack(T.demoOnly); });
    return { tag, chip };
  });
  const langPanel = el("div", { class: "kd-panel" }, el("div", { class: "kd-chips-row" }, langChips.map((c) => c.chip)));

  const packSub = el("span", { class: "kd-s block" });
  const rangePanel = el("div", { class: "kd-panel flush" }, [
    el("button", { class: "kd-nav-row", type: "button", onclick: () => showSnack(T.demoOnly) }, [
      el("span", { class: "kd-nav-ico", html: icon("battery", 20) }), el("span", { class: "kd-grow" }, [el("span", { class: "kd-t", text: T.battery }), packSub]),
    ]),
    el("hr", { class: "kd-divider inset" }),
    navRow("home", T.home, T.start, () => showSnack(T.demoOnly)),
  ]);

  function stepperRow(title, detail, get, choices, set) {
    const value = el("span", { class: "kd-stepper-v" });
    const less = el("button", { class: "kd-icon-btn", type: "button", "aria-label": T.less(title), html: icon("remove", 20) });
    const more = el("button", { class: "kd-icon-btn", type: "button", "aria-label": T.more(title), html: icon("add", 20) });
    const step = (dir) => { const list = choices(); const i = list.indexOf(get()); const next = list[(i < 0 ? 0 : i + dir)]; if (next != null) { set(next); syncSettings(); } };
    less.addEventListener("click", () => step(-1));
    more.addEventListener("click", () => step(1));
    const node = el("div", { class: "kd-stepper" }, [el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: title }), el("div", { class: "kd-s", text: detail })]), less, value, more]);
    return { node, sync(fmtv) { const list = choices(); const i = list.indexOf(get()); text(value, fmtv(get())); less.disabled = i <= 0; more.disabled = i < 0 || i >= list.length - 1; } };
  }
  const levels = [1, 2, 3, 4, 5];
  const ceilingRow = stepperRow(T.ceiling, T.ceilingSub, () => S.smart.ceiling, () => levels, (v) => { S.smart.ceiling = v; S.smart.climb = Math.min(S.smart.climb, v); });
  const climbRow = stepperRow(T.climb, T.climbSub, () => S.smart.climb, () => levels.filter((l) => l <= S.smart.ceiling), (v) => { S.smart.climb = v; });
  const arriveRow = stepperRow(T.arrive, T.arriveSub, () => S.smart.arrive, () => [5, 10, 15, 20, 25, 30, 35, 40, 45, 50], (v) => { S.smart.arrive = v; });
  const smartPanel = el("div", { class: "kd-panel flush" }, [ceilingRow.node, el("hr", { class: "kd-divider inset" }), climbRow.node, el("hr", { class: "kd-divider inset" }), arriveRow.node]);

  /* Speed limit (SpeedModeSection) */
  function modeTile(mode) {
    const accent = mode === "street" ? C.volt : C.amber;
    const b = badge(T.active, mode === "street" ? "accent" : "caution");
    const value = el("div", { class: "kd-readout" });
    const node = el("div", { class: "kd-mode-tile", style: { "--accent": accent } }, [
      el("div", { class: "kd-row" }, [ico(mode === "street" ? "city" : "terrain", 22, accent), el("span", { class: "kd-grow" }), b]),
      el("div", { class: "kd-t", style: { marginTop: "8px" }, text: modeName(mode) }),
      value,
    ]);
    return {
      node,
      sync() {
        const on = S.mode === mode;
        toggleClass(node, "active", on);
        b.hidden = !on;
        text(value, `${mode === "street" ? streetLimit() : S.offroadLimit} km/h`);
      },
    };
  }
  const streetTile = modeTile("street");
  const offroadTile = modeTile("offroad");
  const settingsSwitch = holdButton({ onConfirmed: () => requestModeSwitch(modeSwitch().target), container: C.highest });

  const ctrlValue = el("div", { class: "kd-readout", style: { textAlign: "right" } });
  const ctrlBadge = el("span", { class: "kd-badge" });
  const ctrlLine = el("div", { class: "kd-row" }, [
    el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.ctrlLimit }), el("div", { class: "kd-s", text: T.ctrlLimitSub })]),
    el("div", { style: { display: "grid", justifyItems: "end", gap: "2px" } }, [ctrlValue, ctrlBadge]),
  ]);

  const maxSub = el("div", { class: "kd-s" });
  const maxValue = el("div", { class: "kd-readout" });
  const maxRange = el("input", { class: "kd-range", type: "range", min: LIMIT_MIN, max: LIMIT_MAX, step: "1", "aria-label": T.maxSpeed });
  const maxControl = el("div", { class: "kd-range-wrap" }, [
    el("div", { class: "kd-row" }, [el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.maxSpeed }), maxSub]), maxValue]),
    maxRange,
  ]);
  const sliderCurrent = () => (S.mode === "street" ? streetLimit() : S.offroadLimit);
  const maxTarget = (kmh) => (S.mode === "offroad" || kmh > cap() ? "offroad" : "street");
  function drawMaxSpeed() {
    const kmh = Number(maxRange.value);
    const above = kmh > cap();
    const target = maxTarget(kmh);
    const accent = target === "offroad" ? C.amber : C.volt;
    text(maxSub, target === "street" ? T.streetCap(cap()) : S.mode === "street" ? T.aboveSaves(cap()) : above ? T.offAbove(cap()) : T.offSub);
    maxSub.style.color = above ? C.amber : "";
    text(maxValue, `${kmh} km/h`);
    maxValue.style.color = accent;
    maxControl.style.setProperty("--accent", accent);
    maxRange.setAttribute("aria-valuetext", `${kmh} km/h`);
  }
  function resetSlider() {
    maxRange.value = String(Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, sliderCurrent())));
    drawMaxSpeed();
  }
  maxRange.addEventListener("input", drawMaxSpeed);
  maxRange.addEventListener("change", () => {
    const kmh = Number(maxRange.value);
    if (maxTarget(kmh) === "street") {
      if (kmh !== streetLimit()) setLimit("street", kmh);
    } else if (kmh !== S.offroadLimit) {
      if (S.mode === "offroad") setLimit("offroad", kmh);
      else { openLegalDialog(kmh); return; }
    }
    resetSlider();
  });

  const provinceSub = el("div", { class: "kd-s" });
  const provinceRow = el("button", { class: "kd-row-btn", type: "button", "aria-haspopup": "dialog", "aria-label": T.chooseJurisdiction }, [
    el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.jurisdiction }), provinceSub]),
    ico("chevron", 20, C.muted),
  ]);
  provinceRow.addEventListener("click", openProvincePicker);

  const switchEl = (onToggle, label) => {
    const node = el("button", { class: "kd-switch", type: "button", role: "switch", "aria-checked": "false", "aria-label": label });
    node.addEventListener("click", onToggle);
    return node;
  };
  const lowerSwitch = switchEl(() => { S.allowLowerMoving = !S.allowLowerMoving; syncAll(); }, T.lowerMoving);
  const lowerRow = el("div", { class: "kd-row-btn" }, [
    el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.lowerMoving }), el("div", { class: "kd-s", text: T.lowerMovingSub })]),
    lowerSwitch,
  ]);

  const speedPanel = el("div", { class: "kd-panel" }, [
    el("div", { class: "kd-mode-tiles" }, [streetTile.node, offroadTile.node]),
    el("div", { class: "kd-gap" }),
    settingsSwitch.node,
    el("div", { class: "kd-gap" }),
    ctrlLine,
    el("div", { class: "kd-gap" }),
    el("hr", { class: "kd-divider" }),
    maxControl,
    el("hr", { class: "kd-divider" }),
    provinceRow,
    el("hr", { class: "kd-divider" }),
    lowerRow,
  ]);

  const gpsPanel = el("div", { class: "kd-panel" }, [
    el("div", { class: "kd-row kd-top" }, [
      ico("gps", 22, C.muted),
      el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.gpsTitle }), el("div", { class: "kd-s", text: T.gpsSub })]),
    ]),
  ]);

  /** SettingRow with IntEditor / EnumEditor and the staged "old → new" bar. */
  function settingRow(setting) {
    const [label, description] = T.settings_[setting.id];
    const valueNode = el("div", { class: "kd-readout" });
    const b = setting.danger === "critical" ? badge(T.critical, "error") : setting.danger === "caution" ? badge(T.caution, "caution") : null;
    const lockLine = el("div", { class: "kd-lock" }, [ico("lock", 16, C.muted), el("span", { text: T.stopToChange })]);
    const editor = el("div");
    const stagedText = el("span", { class: "kd-grow" });
    const staged = el("div", { class: "kd-staged", hidden: true }, [
      stagedText,
      el("button", { class: "kd-btn-text", type: "button", text: T.revert, onclick: () => setDraft(base()) }),
      el("button", { class: "kd-btn", type: "button", text: T.apply, onclick: () => requestWrite(setting, draft, label) }),
    ]);
    const node = el("div", { class: "kd-setting" }, [
      el("div", { class: "kd-row kd-top" }, [
        el("div", { class: "kd-grow" }, [
          el("div", { class: "kd-row", style: { gap: "8px", flexWrap: "wrap" } }, [el("span", { class: "kd-t", text: label }), b]),
          el("div", { class: "kd-s", text: description }),
        ]),
        valueNode,
      ]),
      lockLine, editor, staged,
    ]);
    const base = () => S.held[setting.id];
    let draft = base();
    let chipNodes = [], minus, plus, range;
    if (setting.type === "enum") {
      chipNodes = setting.options.map((value) => {
        const chip = el("button", { class: "kd-chip", type: "button", role: "radio", "aria-checked": "false", text: formatSetting(setting, value) });
        chip.addEventListener("click", () => setDraft(value));
        return chip;
      });
      editor.append(el("div", { class: "kd-chips-row", role: "radiogroup", "aria-label": label }, chipNodes));
    } else {
      minus = el("button", { class: "kd-icon-btn", type: "button", "aria-label": T.decrease(label), html: icon("remove", 20) });
      plus = el("button", { class: "kd-icon-btn", type: "button", "aria-label": T.increase(label), html: icon("add", 20) });
      range = el("input", { class: "kd-range", type: "range", min: setting.min, max: setting.max, step: "1", "aria-label": label });
      minus.addEventListener("click", () => setDraft(Math.max(setting.min, draft - 1)));
      plus.addEventListener("click", () => setDraft(Math.min(setting.max, draft + 1)));
      range.addEventListener("input", () => setDraft(Number(range.value)));
      editor.append(el("div", { class: "kd-int" }, [minus, range, plus]));
    }
    function setDraft(value) { draft = value; drawEditor(); }
    function drawEditor() {
      const held = base();
      chipNodes.forEach((chip, i) => chip.setAttribute("aria-checked", String(setting.options[i] === draft)));
      if (range) { range.value = String(draft); minus.disabled = draft <= setting.min; plus.disabled = draft >= setting.max; }
      staged.hidden = draft === held;
      text(stagedText, `${formatSetting(setting, held)}  →  ${formatSetting(setting, draft)}`);
      text(valueNode, formatSetting(setting, held));
    }
    let locked = null;
    return {
      node,
      sync() {
        const isLocked = writability(setting) === "locked";
        if (isLocked !== locked) {
          locked = isLocked;
          lockLine.hidden = !isLocked;
          editor.hidden = isLocked;
          valueNode.style.color = isLocked ? C.muted : "";
          if (isLocked) draft = base();
        }
        if (isLocked) staged.hidden = true; else drawEditor();
        text(valueNode, formatSetting(setting, base()));
      },
      resetDraft() { draft = base(); },
    };
  }
  const rows = SETTINGS.map(settingRow);
  const groupNodes = [];
  for (const group of ["bike", "battery", "pas", "motor"]) {
    const panel = el("div", { class: "kd-panel flush" });
    rows.filter((_, i) => SETTINGS[i].group === group).forEach((row, i) => {
      if (i > 0) panel.append(el("hr", { class: "kd-divider inset" }));
      panel.append(row.node);
    });
    groupNodes.push(section(T.groups[group]), panel);
  }

  settingsScroll.append(
    el("h2", { class: "kd-headline", text: T.settings }),
    el("div", { class: "kd-panel flush mb" }, navRow("speed", T.rideDisplay, T.rideDisplaySub, () => showScreen("ride-display"))),
    el("div", { class: "kd-panel flush mb" }, navRow("replay", T.runSetup, T.runSetupSub, () => showSnack(T.demoOnly))),
    profileCard,
    section(T.language), langPanel,
    section(T.rangeSettings), rangePanel,
    section(T.smartAssist), smartPanel,
    section(T.secSpeed), speedPanel,
    section(T.secGps), gpsPanel,
    ...groupNodes,
    section(T.device),
    el("div", { class: "kd-panel flush" }, [
      navRow("bluetooth", T.connection, `${T.simulator} · ${PROFILE.name}`, openConnectionSheet),
      el("hr", { class: "kd-divider inset" }),
      navRow("memory", T.firmware, T.versionUpdates, () => showSnack(T.demoOnly)),
    ]),
    section(T.about),
    el("div", { class: "kd-panel flush" }, [
      navRow("privacy", T.privacy, T.privacySub, () => showSnack(T.demoOnly)),
      el("hr", { class: "kd-divider inset" }),
      navRow("map", T.credits, T.creditsSub, () => showSnack(T.demoOnly)),
    ]),
    el("div", { class: "kd-footer", text: T.footer }),
  );

  function syncSettings() {
    if (settingsPage.hidden) return;
    langChips.forEach(({ tag, chip }) => chip.setAttribute("aria-pressed", String(tag === S.lang)));
    text(packSub, T.pack(S.pack.v, S.pack.ah, Math.round(S.pack.v * S.pack.ah)));
    ceilingRow.sync(String); climbRow.sync(String); arriveRow.sync((v) => `${v} %`);
    streetTile.sync(); offroadTile.sync();
    const sw = modeSwitch();
    settingsSwitch.set({ title: T.switchTo(modeName(sw.target)), hint: sw.ok ? T.pressHold : sw.reason, enabled: sw.ok, fill: sw.target === "offroad" ? C.amber : C.volt });
    const sync = reconcile();
    const held = S.held.maxSpeedKmh;
    const active = activeLimit();
    let status = [T.applied, "ok"];
    if (S.writing || sync.k === "write") status = [T.applying, "accent"];
    else if (sync.k === "pending") status = [T.whenStopped, "info"];
    else if (sync.k === "confirm") status = [T.waitingOk, "caution"];
    else if (active != null && held < active) status = [T.lowerThan, "info"];
    text(ctrlValue, `${held} km/h`);
    text(ctrlBadge, status[0]);
    ctrlBadge.className = `kd-badge ${status[1]}`;
    text(provinceSub, T.jurisdictionCap(provinceName(), cap()));
    lowerSwitch.setAttribute("aria-checked", String(S.allowLowerMoving));
    rows.forEach((row) => row.sync());
  }

  /* Ride display (RideDisplayScreen) */
  const rdScroll = el("div", { class: "kd-scroll rd", tabindex: "-1" });
  rideDisplayPage.append(rdScroll);
  const previewCanvas = el("canvas", { class: "kd-preview-gauge", "aria-hidden": "true" });
  const previewStreet = el("canvas", { class: "kd-preview-street", "aria-hidden": "true" });
  const preview = el("div", { class: "kd-preview", "aria-hidden": "true" }, [previewStreet, el("div", { class: "kd-preview-scrim" }), previewCanvas, el("span", { class: "kd-preview-tag", text: T.preview })]);
  const tiles = STYLES.map((style) => {
    const canvas = el("canvas", { class: "kd-tile-gauge", "aria-hidden": "true" });
    const name = el("span", { class: "kd-tile-name", text: T.styles[style] });
    const tile = el("button", { class: "kd-tile", type: "button", role: "radio", "aria-checked": "false", "aria-label": T.styles[style] }, [canvas, name]);
    tile.addEventListener("click", () => { S.style = style; syncRideDisplay(); dirty = true; });
    return { style, tile, canvas };
  });
  const opacityValue = el("span", { class: "kd-volt-b" });
  const opacityRange = el("input", { class: "kd-range", type: "range", min: "30", max: "100", step: "5", "aria-label": T.opacity, style: { "--accent": C.volt } });
  opacityRange.addEventListener("input", () => { S.opacity = Number(opacityRange.value) / 100; syncRideDisplay(); dirty = true; });
  const segmented = (options, get, set) => {
    const buttons = options.map((label, i) => {
      const b = el("button", { class: "kd-seg-b", type: "button", role: "radio", "aria-checked": "false", text: label });
      b.addEventListener("click", () => { set(i); syncRideDisplay(); });
      return b;
    });
    return { node: el("div", { class: "kd-seg", role: "radiogroup" }, buttons), sync() { buttons.forEach((b, i) => b.setAttribute("aria-checked", String(i === get()))); } };
  };
  const feelSeg = segmented([T.calm, T.lively], () => (S.feel === "CALM" ? 0 : 1), (i) => { const next = i === 0 ? "CALM" : "LIVELY"; if (next !== S.feel) { S.feel = next; feelDemo = performance.now(); } });
  const orientSeg = segmented(T.orientations, () => S.orientation, (i) => { S.orientation = i; });
  const toggleRow = (title, hint, key) => {
    const sw = switchEl(() => { S[key] = !S[key]; syncRideDisplay(); }, title);
    return { node: el("div", { class: "kd-toggle-row" }, [el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: title }), el("div", { class: "kd-s", text: hint })]), sw]), sync() { sw.setAttribute("aria-checked", String(S[key])); } };
  };
  const volumeRow = toggleRow(T.volume, T.volumeHint, "volume");
  const sweepRow = toggleRow(T.sweep, T.sweepHint, "sweep");
  const hills3dRow = toggleRow(T.hills3d, T.hills3dHint, "hills3d");
  const hills2dRow = toggleRow(T.hills2d, T.hills2dHint, "hills2d");
  const rdSection = (title, content) => el("div", { class: "kd-rd-sec" }, [el("div", { class: "kd-overline mute", text: title.toLocaleUpperCase(FR ? "fr" : "en") }), content]);
  rdScroll.append(
    el("div", { class: "kd-rd-head" }, [
      el("button", { class: "kd-back48", type: "button", "aria-label": T.back, html: icon("back", 24), onclick: () => showScreen("settings") }),
      el("h2", { class: "kd-page-title", text: T.rideDisplay }),
    ]),
    preview,
    rdSection(T.gaugeSec, el("div", { class: "kd-tiles", role: "radiogroup", "aria-label": T.gaugeSec }, tiles.map((t) => t.tile))),
    el("div", { class: "kd-card pad" }, [
      el("div", { class: "kd-row" }, [el("span", { class: "kd-grow kd-row-title", text: T.opacity }), opacityValue]),
      opacityRange,
      el("div", { class: "kd-s", text: T.opacityHint }),
    ]),
    el("div", { class: "kd-card pad row" }, [
      el("div", { class: "kd-grow" }, [el("div", { class: "kd-row-title", text: T.placement }), el("div", { class: "kd-s", text: T.placementHint })]),
      el("button", { class: "kd-btn-text", type: "button", disabled: true, text: T.reset }),
    ]),
    rdSection(T.feel, feelSeg.node),
    rdSection(T.orientation, orientSeg.node),
    el("div", { class: "kd-card" }, [volumeRow.node, el("hr", { class: "kd-divider" }), sweepRow.node]),
    rdSection(T.hills, el("div", { class: "kd-card" }, [hills3dRow.node, el("hr", { class: "kd-divider" }), hills2dRow.node])),
  );
  let feelDemo = 0;
  function syncRideDisplay() {
    tiles.forEach(({ style, tile }) => tile.setAttribute("aria-checked", String(style === S.style)));
    const pct = Math.round(S.opacity * 100);
    text(opacityValue, `${pct} %`);
    opacityRange.value = String(pct);
    opacityRange.setAttribute("aria-valuetext", `${pct} %`);
    feelSeg.sync(); orientSeg.sync();
    [volumeRow, sweepRow, hills3dRow, hills2dRow].forEach((r) => r.sync());
    drawRideDisplayStatics();
  }
  function prepCanvas(canvas, cssW, cssH) {
    const r = Math.min(3, (window.devicePixelRatio || 1) * scale);
    const w = Math.round(cssW * r), h = Math.round(cssH * r);
    if (canvas.width !== w) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(r, 0, 0, r, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    return ctx;
  }
  function drawRideDisplayStatics() {
    // StreetBackdrop (RideDisplayScreen.kt)
    const sw = 358, sh = 232;
    const ctx = prepCanvas(previewStreet, sw, sh);
    ctx.fillStyle = C.mapBase; ctx.fillRect(0, 0, sw, sh);
    ctx.strokeStyle = C.mapMinor; ctx.lineWidth = 3.5;
    for (let y = sh * 0.12; y < sh; y += 38) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sw, y - sw * 0.2); ctx.stroke(); }
    for (let x = -sw * 0.1; x < sw * 1.2; x += 44) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + sh * 0.2, sh); ctx.stroke(); }
    ctx.lineCap = "round";
    const road = (x1, y1, x2, y2) => {
      ctx.strokeStyle = C.mapBase; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = C.mapMajor; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    road(0, sh * 0.62, sw, sh * 0.42);
    road(sw * 0.38, 0, sw * 0.46, sh);
    ctx.strokeStyle = "rgba(91,200,245,.55)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, sh * 0.3); ctx.lineTo(sw, sh * 0.16); ctx.stroke();
    tiles.forEach(({ style, canvas }) => {
      const c = prepCanvas(canvas, 75, 75);
      c.scale(75 / 300, 75 / 300);
      drawGauge(c, { style, speed: 24.6, needle: 24.6, accel: 1.6, power: 380, limit: 32, onMap: false, dial: 1 });
    });
  }
  function drawPreviewGauge(now) {
    const size = 186;
    const ctx = prepCanvas(previewCanvas, size, size);
    ctx.scale(size / 300, size / 300);
    // feel demo: 24 → 30 → 24 km/h after a feel change (rememberFeelDemoInstrument), else steady 24
    let s = 24, a = 0;
    if (feelDemo) {
      const t = (now - feelDemo) / 1000;
      if (t < 4) {
        const omega = S.feel === "CALM" ? 2.6 : 5.2;
        const step = (tt) => (tt <= 0 ? 0 : 1 - Math.exp(-omega * tt) * (1 + omega * tt));
        s = 24 + 6 * step(t) - 6 * step(t - 1.8);
        a = (24 + 6 * step(t + 0.02) - 6 * step(t - 1.78) - s) / 0.02 / 3;
      } else feelDemo = 0;
    }
    drawGauge(ctx, { style: S.style, speed: s, needle: s, accel: a, power: 380, limit: 32, onMap: true, dial: S.opacity });
  }

  /* ---------------------------------------------------------------- actions */

  function setLimit(mode, kmh) {
    if (mode === "street") {
      S.streetLimit = kmh;
      if (S.mode === "street") S.raiseApproved = activeLimit();
    } else {
      S.offroadLimit = kmh;
      S.ackLimit = null;
      if (S.mode === "offroad") S.pendingAck = kmh;
    }
    syncAll();
    if (S.pendingAck != null) openAckDialog();
  }

  function requestModeSwitch(target) {
    if (target === "street") {
      S.mode = "street";
      S.pendingAck = null;
      S.raiseApproved = activeLimit();
    } else if (S.mode !== "offroad" || S.ackLimit !== S.offroadLimit) {
      S.pendingAck = S.offroadLimit;
    }
    syncAll();
    resetSlider();
    if (S.pendingAck != null) openAckDialog();
  }

  function confirmOffroad() {
    if (S.pendingAck == null) return;
    S.ackLimit = S.pendingAck;
    S.mode = "offroad";
    S.pendingAck = null;
    S.raiseApproved = activeLimit();
    syncAll();
    resetSlider();
  }

  let ackTimer = 0;
  function openAckDialog() {
    rideSheet = null;
    const kmh = S.pendingAck;
    const paragraphs = [];
    if (kmh > cap()) paragraphs.push(T.ackAbove(cap(), provinceName()));
    paragraphs.push(T.ackBody);
    let left = ACK_SECONDS;
    const ok = el("button", { class: "kd-btn", type: "button", disabled: true, text: T.okSeconds(left) });
    const useStreet = el("button", { class: "kd-btn-text", type: "button", text: T.useStreet });
    ok.addEventListener("click", () => { clearInterval(ackTimer); closeOverlay(); confirmOffroad(); });
    useStreet.addEventListener("click", () => { clearInterval(ackTimer); closeOverlay(); requestModeSwitch("street"); });
    clearInterval(ackTimer);
    ackTimer = setInterval(() => {
      left -= 1;
      if (left > 0) { ok.textContent = T.okSeconds(left); return; }
      clearInterval(ackTimer);
      ok.textContent = "OK";
      ok.disabled = false;
    }, 1000);
    openOverlay(dialog({ iconName: "terrain", iconTone: "caution", title: T.ackTitle(kmh), paragraphs, actions: [useStreet, ok] }), {
      label: T.ackTitle(kmh),
      onDismiss: () => { clearInterval(ackTimer); requestModeSwitch("street"); },
    });
  }

  function openLegalDialog(kmh) {
    const save = el("button", { class: "kd-btn", type: "button", text: T.saveAsOffBtn });
    const cancel = el("button", { class: "kd-btn-text", type: "button", text: T.cancel });
    save.addEventListener("click", () => { closeOverlay(); setLimit("offroad", kmh); resetSlider(); });
    cancel.addEventListener("click", () => { closeOverlay(); resetSlider(); });
    openOverlay(dialog({ iconName: "warning", iconTone: "caution", title: T.saveAsOff(kmh), paragraphs: [T.saveAsOffBody(cap(), provinceName(), streetLimit())], actions: [cancel, save] }),
      { label: T.saveAsOff(kmh), onDismiss: resetSlider });
  }

  function openProvincePicker() {
    const codes = Object.keys(CAPS).sort((a, b) => T.provinces[a].localeCompare(T.provinces[b], FR ? "fr" : "en"));
    const list = el("div", { class: "kd-list", role: "radiogroup", "aria-label": T.jurisdiction }, codes.map((code) => {
      const b = el("button", { type: "button", role: "radio", "aria-checked": String(code === S.jur) }, [
        el("span", { text: T.provinces[code] }), el("span", { class: "kd-s", text: `${CAPS[code]} km/h` }),
      ]);
      b.addEventListener("click", () => { S.jur = code; closeOverlay(); syncAll(); resetSlider(); });
      return b;
    }));
    const close = el("button", { class: "kd-btn-text", type: "button", text: T.cancel, onclick: () => closeOverlay() });
    openOverlay(dialog({ title: T.jurisdiction, extra: [list], actions: [close] }), { label: T.chooseJurisdiction });
  }

  function requestWrite(setting, value, label) {
    const mode = writability(setting);
    const row = rows[SETTINGS.indexOf(setting)];
    if (mode === "locked") { showSnack(T.stopToChange); return; }
    if (mode === "editable") { commitWrite(setting, value, row); return; }
    const typed = mode === "typed";
    const input = typed ? el("input", { type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": T.typedLabel, placeholder: T.typedLabel }) : null;
    const apply = el("button", { class: `kd-btn${typed ? " danger" : ""}`, type: "button", text: T.apply, disabled: typed });
    const cancel = el("button", { class: "kd-btn-text", type: "button", text: T.cancel, onclick: () => closeOverlay() });
    if (input) input.addEventListener("input", () => { apply.disabled = input.value.trim().toUpperCase() !== T.typedWord; });
    apply.addEventListener("click", () => {
      closeOverlay();
      if (writability(setting) === "locked") { showSnack(T.stopToChange); return; } // the bike may have moved meanwhile
      commitWrite(setting, value, row);
    });
    const [, description] = T.settings_[setting.id];
    const extra = [el("div", { class: "kd-change", text: `${formatSetting(setting, S.held[setting.id])}  →  ${formatSetting(setting, value)}` })];
    if (typed) extra.push(el("p", { text: T.typedBody }), input);
    openOverlay(dialog({ iconName: "warning", iconTone: typed ? "error" : "caution", title: T.changeQ(label), paragraphs: [description], extra, actions: [cancel, apply] }),
      { label: T.changeQ(label) });
    if (input) input.focus({ preventScroll: true });
  }

  function commitWrite(setting, value, row) {
    setTimeout(() => {
      S.held[setting.id] = value;
      row.resetDraft();
      syncAll();
      showSnack(T.saved);
    }, 120);
  }

  /* Connection sheet: only the simulator is offered on the web. */
  function openConnectionSheet() {
    closeRideSheet();
    sheet([
      el("h3", { class: "kd-sheet-title", text: T.connection }),
      el("div", { class: "kd-row", style: { gap: "8px", marginBottom: "6px" } }, [el("span", { class: "kd-dot", "aria-hidden": "true" }), el("span", { class: "kd-s", text: T.simulated(PROFILE.name) })]),
      section(T.source),
      el("div", { role: "radiogroup", "aria-label": T.source }, [
        el("button", { class: "kd-option", type: "button", role: "radio", "aria-checked": "true" }, [
          ico("science", 22), el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.simulator }), el("div", { class: "kd-s", text: T.virtualBike })]),
        ]),
        el("button", { class: "kd-option", type: "button", role: "radio", "aria-checked": "false", disabled: true }, [
          ico("bluetooth", 22), el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: T.dongle }), el("div", { class: "kd-s", text: T.demoOnly })]),
        ]),
      ]),
      section(T.profile),
      el("div", { class: "kd-option", role: "radio", "aria-checked": "true" }, [
        el("div", { class: "kd-grow" }, [el("div", { class: "kd-t", text: PROFILE.name }), el("div", { class: "kd-s", text: PROFILE.brands })]),
        badge(T.bench, "ok"),
      ]),
      el("div", { class: "kd-actions", style: { marginTop: "8px" } }, el("button", { class: "kd-btn-text", type: "button", text: T.close, onclick: () => closeOverlay() })),
    ], T.connection);
  }

  /* ---------------------------------------------------------------- simulation loop */

  /** MockTransport.stepPhysics, plus the controller cutting assist at its held limit. */
  function stepPhysics(dt) {
    const level = S.assist;
    let target = level === 0 ? 0 : 4 + level * 5 + (Math.random() * 1.2 - 0.6);
    target = Math.min(target, S.held.maxSpeedKmh);
    S.speed += (target - S.speed) * Math.min(1, 0.9 * dt * 3);
    S.speed = Math.max(0, S.speed);
    const effort = Math.max(0, target - S.speed) * 1.8 + level * 1.1;
    S.currentA = Math.max(0, S.currentA + (effort - S.currentA) * 0.4);
    S.soc = Math.max(5, S.soc - S.currentA * dt * 0.004);
    S.along += (S.speed / 3.6) * dt;
    if (S.speed > 0.3) {
      const p = loopAt(S.along);
      const last = view.trail[view.trail.length - 1];
      if (!last || Math.hypot(p.u - last[0], p.v - last[1]) > 6) view.trail.push([p.u, p.v]);
      if (view.trail.length > 160) view.trail.shift();
    }
  }

  function applyLimitSync() {
    const sync = reconcile();
    if (sync.k !== "write" || S.writing) return;
    S.writing = true;
    setTimeout(() => {
      S.writing = false;
      const again = reconcile();
      if (again.k === "write") S.held.maxSpeedKmh = again.v;
      syncAll();
    }, WRITE_MS);
  }

  function syncAll() {
    syncRide();
    syncSettings();
  }

  let dirty = true;
  let lastFrame = 0;
  function render(now) {
    rafId = 0;
    if (!running) return;
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0.016;
    lastFrame = now;
    advanceInstrument(now);
    if (!settingsPage.hidden || !rideDisplayPage.hidden) {
      if (!rideDisplayPage.hidden) drawPreviewGauge(now);
    } else {
      drawMap(dt);
      const ctx = gaugeCtx;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, gaugeCanvas.width, gaugeCanvas.height);
        const k = gaugeCanvas.width / 300;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        drawGauge(ctx, { style: S.style, speed: instrument.speed, needle: instrument.needle, accel: instrument.accel, power: powerW(), limit: S.held.maxSpeedKmh ?? activeLimit(), onMap: true, dial: S.opacity });
      }
      const pw = Math.min(1, Math.max(0, powerW() / 1000));
      ladderBars.forEach(({ sheen, bar }) => { sheen.style.opacity = bar.classList.contains("lit") ? (0.15 + 0.6 * pw).toFixed(2) : "0"; });
    }
    rafId = requestAnimationFrame(render);
  }

  let timer = 0, rafId = 0, running = false, visible = false;
  function tick() {
    stepPhysics(TICK_MS / 1000);
    applyLimitSync();
    syncAll();
  }
  function setRunning() {
    const run = visible && document.visibilityState === "visible";
    running = run;
    if (run && !timer) { timer = setInterval(tick, TICK_MS); lastFrame = 0; instrument.last = 0; rafId = requestAnimationFrame(render); }
    if (!run && timer) { clearInterval(timer); timer = 0; cancelAnimationFrame(rafId); rafId = 0; }
  }

  /* ---------------------------------------------------------------- mount */

  host.replaceChildren(frame);
  host.classList.add("kd-live");
  S.speed = 14;                // already riding at assist 2 when the page opens
  instrument.speed = instrument.needle = 14;
  for (let i = 0; i < 60; i++) { S.along += 4; const p = loopAt(S.along); view.trail.push([p.u, p.v]); }
  view.bearing = (loopAt(S.along).dir * 180) / Math.PI;
  view.mPerPx = mPerPxAtZoom(zoomForSpeed(S.speed));
  fit();
  new ResizeObserver(fit).observe(frame);
  resetSlider();
  syncAll();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load(`700 20px Roboto`), document.fonts.load(`400 12px Roboto`)]).then(() => { dirty = true; if (!rideDisplayPage.hidden) drawRideDisplayStatics(); }).catch(() => {});
  }

  // Hooks for the recording script (tools/record_demo.js): drive the demo to fixed states.
  window.__kurantDemo = {
    state: S, setAssist, showScreen, openRideControls, closeOverlay,
    setStyle(style) { S.style = style; syncRideDisplay(); dirty = true; },
  };

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      setRunning();
    }).observe(host);
  } else {
    visible = true;
  }
  document.addEventListener("visibilitychange", setRunning);
  setRunning();
})();
