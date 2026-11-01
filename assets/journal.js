/* Home page: the latest entries of the development log.
   journal/index.html (en/journal/index.html in English) is the only source: this script reads its
   newest entries and shows date, title and first paragraph. Without it, the section keeps its
   intro and the button to the full log. */
(function () {
  "use strict";

  var COUNT = 3;
  var list = document.querySelector("[data-journal-preview]");
  var link = document.querySelector("[data-journal-src]");
  if (!list || !link || !window.fetch || !window.DOMParser) return;

  function copyChildren(from, to) {
    Array.prototype.forEach.call(from.childNodes, function (node) {
      to.appendChild(document.importNode(node, true));
    });
  }

  fetch(link.getAttribute("href"), { credentials: "same-origin" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (html) {
      var doc = new DOMParser().parseFromString(html, "text/html");
      var entries = doc.querySelectorAll(".log-list > .log-item");
      if (!entries.length) return;

      Array.prototype.slice.call(entries, 0, COUNT).forEach(function (entry) {
        var time = entry.querySelector("time");
        var title = entry.querySelector("h2");
        var first = entry.querySelector("p");
        if (!time || !title) return;
        var item = document.createElement("li");
        item.className = "log-item";
        item.appendChild(document.importNode(time, true));
        var heading = document.createElement("h3"); // h2 on the log page, h3 under this section's h2
        copyChildren(title, heading);
        item.appendChild(heading);
        if (first) item.appendChild(document.importNode(first, true));
        list.appendChild(item);
      });
      if (!list.children.length) return;
      list.hidden = false;

      var label = link.getAttribute("data-journal-label");
      if (label) link.textContent = label.replace("{n}", String(entries.length));
    })
    .catch(function () {
      // Offline or blocked: the button to the full log is still there.
    });
})();
