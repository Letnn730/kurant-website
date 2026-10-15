/* Compatibility list: one source for the "Check my bike" tool on the home pages
   and for the compatibility pages (compatibilite/, en/compatibility/).

   status (used by the checker): "ok" = bench-verified, "check" = in development
   (reserve it on Kickstarter; not in the hardware rewards yet), "no" = not planned at launch.

   stage (used by the compatibility pages):
     "verified" = bench-verified (ready at launch)
     "road"     = confirmed on the road by riders
     "bench"    = a real controller is on the bench, its traffic being recorded
     "dev"      = in development, waiting for bench hardware
     "later"    = needs a future version of the module
     "no"       = not planned
     "other"    = the "Other brand" entry, not listed on the pages

   Per language: name and note (both pages), plus optional look (how to recognize
   the system), tested (hardware it was verified or is being recorded on) and next
   (the next step).

   Keep in step with the ebike-profiles repo: a family is "ok" / "verified" only
   when its profile is bench-verified. */
window.KURANT_COMPAT = {
  families: [
    { id: "kt", status: "ok", stage: "verified",
      fr: { name: "KT (Kunteng) – écrans LCD3, LCD5, LCD8, VM-T8", note: "Vérifié sur banc d'essai avec un contrôleur KT. Câble KT inclus.",
            look: "Écran KT-LCD3, LCD5, LCD8 ou VM-T8. L'étiquette du contrôleur commence souvent par «\u202FKT\u202F», par exemple KT36/48SVPRL.",
            tested: ["Contrôleur KT 45\u00A0A à onde sinusoïdale", "Écrans KT-LCD5 et VM-T8", "Batterie de 48\u00A0V"],
            next: "Essai avec le moteur en charge sur le circuit final, puis confirmation sur la route par les premiers cyclistes." },
      en: { name: "KT (Kunteng) – LCD3, LCD5, LCD8, VM-T8 displays", note: "Verified on the bench with a KT controller. KT cable included.",
            look: "KT-LCD3, LCD5, LCD8 or VM-T8 display. The controller's label often starts with “KT”, for example KT36/48SVPRL.",
            tested: ["KT 45 A sine-wave controller", "KT-LCD5 and VM-T8 displays", "48 V battery"],
            next: "A test with the motor under load on the final circuit board, then road confirmation by the first riders." } },
    { id: "bafang-uart", status: "check", stage: "dev",
      fr: { name: "Bafang – connecteur rond à 5 broches (UART)", note: "En développement. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            look: "Moteur Bafang dont le câble d'écran a un connecteur rond à 5 broches, comme sur les pédaliers BBS02 et BBSHD.",
            next: "Brancher un système Bafang à connecteur rond au banc d'essai." },
      en: { name: "Bafang – round 5-pin connector (UART)", note: "In development. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            look: "Bafang motor whose display cable has a round 5-pin connector, as on BBS02 and BBSHD mid-drives.",
            next: "Put a round-connector Bafang system on the test bench." } },
    { id: "bafang-can", status: "no", stage: "later",
      fr: { name: "Bafang – connecteur triangulaire (CAN)", note: "Pas prise en charge pour le moment. Prévue dans une version ultérieure du module.",
            look: "Moteur Bafang dont le câble d'écran a un connecteur triangulaire." },
      en: { name: "Bafang – triangular connector (CAN)", note: "Not supported yet. Planned for a later version of the module.",
            look: "Bafang motor whose display cable has a triangular connector." } },
    { id: "lishui", status: "check", stage: "dev",
      fr: { name: "Lishui – écrans de type S866", note: "En développement. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            look: "Écran S866 ou semblable, avec un contrôleur Lishui\u202F: le nom figure sur son étiquette.",
            next: "Brancher un contrôleur Lishui au banc d'essai." },
      en: { name: "Lishui – S866-type displays", note: "In development. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            look: "S866 or similar display, with a Lishui controller: the name is on its label.",
            next: "Put a Lishui controller on the test bench." } },
    { id: "rad-lishui", status: "check", stage: "dev",
      fr: { name: "Rad Power Bikes – RadRunner 1 ou 2", note: "En développement. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            next: "Brancher le contrôleur d'une RadRunner 1 ou 2 au banc d'essai." },
      en: { name: "Rad Power Bikes – RadRunner 1 or 2", note: "In development. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            next: "Put a RadRunner 1 or 2 controller on the test bench." } },
    { id: "rad-asi", status: "check", stage: "dev",
      fr: { name: "Rad Power Bikes – RadRunner 3 Plus", note: "En développement. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            next: "Brancher le contrôleur d'une RadRunner 3 Plus au banc d'essai." },
      en: { name: "Rad Power Bikes – RadRunner 3 Plus", note: "In development. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            next: "Put a RadRunner 3 Plus controller on the test bench." } },
    { id: "lectric", status: "check", stage: "dev",
      fr: { name: "Lectric XP", note: "En développement. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            next: "Brancher une Lectric XP au banc d'essai pour identifier son système." },
      en: { name: "Lectric XP", note: "In development. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            next: "Put a Lectric XP on the test bench to identify its system." } },
    { id: "happyrun-48", status: "check", stage: "bench",
      fr: { name: "HappyRun G100 (48\u00A0V)", note: "Vérification en cours sur un G100.",
            look: "HappyRun G100 de 48\u00A0V. La version Pro (72\u00A0V) n'est pas prise en charge.",
            tested: ["HappyRun G100 de 48\u00A0V", "Simulateur des capteurs du moteur"],
            next: "Relever les échanges entre le contrôleur et l'écran, puis écrire et vérifier son profil." },
      en: { name: "HappyRun G100 (48 V)", note: "Verification in progress on a G100.",
            look: "48 V HappyRun G100. The Pro version (72 V) isn't supported.",
            tested: ["48 V HappyRun G100", "Motor sensor simulator"],
            next: "Record what the controller and display exchange, then write and verify its profile." } },
    { id: "happyrun-pro", status: "no", stage: "no",
      fr: { name: "HappyRun G100 Pro (72\u00A0V)", note: "Tension trop élevée pour cette version du module." },
      en: { name: "HappyRun G100 Pro (72 V)", note: "Voltage too high for this version of the module." } },
    { id: "aventon", status: "check", stage: "dev",
      fr: { name: "Aventon", note: "Modèles 48\u00A0V en développement, modèles 36\u00A0V plus tard. Réservez votre système à 1\u00A0$ sur Kickstarter\u202F: les plus réservés passent au banc en premier.",
            look: "Modèles Aventon de 48\u00A0V. Les modèles de 36\u00A0V viendront avec une version future du module.",
            next: "Brancher un contrôleur Aventon de 48\u00A0V au banc d'essai." },
      en: { name: "Aventon", note: "48 V models in development, 36 V models later. Reserve your system for CAD 1 on Kickstarter: the most reserved go on the bench first.",
            look: "48 V Aventon models. 36 V models come with a future version of the module.",
            next: "Put a 48 V Aventon controller on the test bench." } },
    { id: "bosch", status: "no", stage: "no",
      fr: { name: "Bosch", note: "Système fermé, pas prévu au lancement." },
      en: { name: "Bosch", note: "Closed system, not planned at launch." } },
    { id: "shimano", status: "check", stage: "later",
      fr: { name: "Shimano STEPS", note: "Plus tard\u202F: Shimano STEPS fonctionne en 36\u00A0V, une tension prévue pour une version future du module. Réservez-le à 1\u00A0$ pour être avisé." },
      en: { name: "Shimano STEPS", note: "Later: Shimano STEPS runs on 36 V, planned for a future version of the module. Reserve it for CAD 1 to be told when it's ready." } },
    { id: "other", status: "check", stage: "other",
      fr: { name: "Autre marque / je ne sais pas", note: "Recopiez le texte de l'étiquette du contrôleur dans le formulaire. Nous vérifierons votre configuration." },
      en: { name: "Other brand / I don't know", note: "Copy the text on the controller's label into the form. We will check your setup." } }
  ],
  voltages: [
    { id: "36", status: "no",
      fr: { name: "36\u00A0V", note: "Pas encore\u202F: le module est conçu pour les batteries de 48 et 52\u00A0V." },
      en: { name: "36 V", note: "Not yet: the module is designed for 48 and 52 V batteries." } },
    { id: "48", status: "ok", fr: { name: "48\u00A0V", note: "" }, en: { name: "48 V", note: "" } },
    { id: "52", status: "ok", fr: { name: "52\u00A0V", note: "" }, en: { name: "52 V", note: "" } },
    { id: "60-72", status: "no",
      fr: { name: "60 à 72\u00A0V", note: "Tension non prise en charge par cette version du module." },
      en: { name: "60 to 72 V", note: "This voltage is not supported by this version of the module." } },
    { id: "unknown", status: "check",
      fr: { name: "Je ne sais pas", note: "La tension est inscrite sur la batterie ou le chargeur." },
      en: { name: "I don't know", note: "The voltage is printed on the battery or the charger." } }
  ]
};
