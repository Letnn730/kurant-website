/* Light or dark theme. Loaded without `defer` in <head>, before the page paints, so there is no flash:
   the saved choice wins, otherwise the system setting. The switch ([data-theme-toggle], in the header)
   flips it and remembers it on this device. Storage can be missing (private mode, blocked site data):
   the page then follows the system setting and the switch still works for the visit. */
(function () {
  "use strict";
  var KEY = "kurant-theme";
  var root = document.documentElement;
  var media = window.matchMedia ? matchMedia("(prefers-color-scheme: light)") : null;

  function saved() {
    try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : ""; } catch (e) { return ""; }
  }
  function system() { return media && media.matches ? "light" : "dark"; }
  function apply(theme) {
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#F6F5F2" : "#0B0B0C");
  }
  apply(saved() || system());

  // Follow the system while the visitor hasn't chosen.
  if (media && media.addEventListener) media.addEventListener("change", function () { if (!saved()) { apply(system()); sync(); } });

  var LABEL = {
    fr: { light: "Passer au thème clair", dark: "Passer au thème sombre" },
    en: { light: "Switch to light theme", dark: "Switch to dark theme" }
  };
  function sync() {
    var lang = (root.getAttribute("lang") || "fr").slice(0, 2) === "en" ? "en" : "fr";
    var now = root.getAttribute("data-theme");
    var next = now === "light" ? "dark" : "light";
    Array.prototype.forEach.call(document.querySelectorAll("[data-theme-toggle]"), function (btn) {
      btn.setAttribute("aria-label", LABEL[lang][next]);
      btn.setAttribute("title", LABEL[lang][next]);
    });
  }
  document.addEventListener("DOMContentLoaded", function () {
    sync();
    document.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("[data-theme-toggle]") : null;
      if (!btn) return;
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.classList.add("theme-switching");
      apply(next);
      try { localStorage.setItem(KEY, next); } catch (err) { /* this visit only */ }
      sync();
      setTimeout(function () { root.classList.remove("theme-switching"); }, 400);
    });
  });
})();
