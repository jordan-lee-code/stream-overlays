/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The panel at the top of every overlay's dev page that copies the overlay's files, one button for
 * each tab of StreamElements' custom widget editor, so nobody has to download the repository.
 *
 * The page's own script makes the current settings available as `window.__exportFields()`, which
 * returns fields.json with the starting value of every setting filled in as it is configured here.
 * The other three files are fetched from the widget folder, exactly as the page itself loads them.
 * The panel adds itself once the page has built its controls. */
(function () {
  "use strict";

  var FILES = [
    { name: "widget.html", tab: "HTML", note: "the HTML tab", get: function () { return fetchText("../widget/widget.html"); } },
    { name: "widget.css", tab: "CSS", note: "the CSS tab", get: function () { return fetchText("../widget/widget.css"); } },
    { name: "widget.js", tab: "JS", note: "the JS tab", get: function () { return fetchText("../widget/widget.js"); } },
    { name: "fields.json", tab: "Fields", note: "the Fields tab, with your settings", get: function () {
      if (typeof window.__exportFields !== "function") return Promise.reject(new Error("The page's settings are not ready yet."));
      return Promise.resolve(window.__exportFields());
    } }
  ];

  var STYLE = "#copy-panel { margin: 0 0 14px; padding: 12px; border: 2px solid #c9a7ff; border-radius: 12px; background: #faf6ff; }" +
    "#copy-panel h2 { margin-top: 0; }" +
    "#copy-panel ol { margin: 6px 0 10px; padding-left: 20px; font-size: 12px; color: #4b4560; }" +
    "#copy-panel li { margin: 2px 0; }" +
    "#copy-panel .copy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }" +
    "#copy-panel .copy-btn { display: block; width: 100%; margin: 0; padding: 8px 6px; text-align: center; font-weight: 700; line-height: 1.25; }" +
    "#copy-panel .copy-btn small { display: block; font-weight: 400; font-size: 11px; color: #667; }" +
    "#copy-panel .copy-btn.done { background: #dff5e1; border-color: #7bc58a; }" +
    "#copy-panel .copy-btn.failed { background: #fde3e3; border-color: #e08a8a; }" +
    "#copy-panel #copy-msg { min-height: 1.3em; margin: 8px 0 0; font-size: 12px; }" +
    "#copy-panel textarea { display: block; width: 100%; height: 90px; margin-top: 8px; font-size: 11px; }";

  function fetchText(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + url.replace("../widget/", "") + " (" + r.status + ").");
      return r.text();
    });
  }

  // The clipboard API where the page is allowed to use it, and the old way where it is not.
  function copyText(text, fallbackBox) {
    function old() {
      fallbackBox.hidden = false;
      fallbackBox.value = text;
      fallbackBox.focus();
      fallbackBox.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      if (ok) fallbackBox.hidden = true;
      return ok;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return old(); });
    }
    return Promise.resolve(old());
  }

  function kb(text) { return Math.max(1, Math.round(text.length / 1024)) + " KB"; }

  function build() {
    var panel = document.createElement("div");
    panel.id = "copy-panel";
    var style = document.createElement("style");
    style.textContent = STYLE;
    panel.appendChild(style);

    var h = document.createElement("h2");
    h.textContent = "Copy into StreamElements";
    panel.appendChild(h);

    var steps = document.createElement("ol");
    ["Set the overlay up below. Everything on this page, including the style preset, goes into the copy of fields.json.",
     "In StreamElements, add a Custom Widget to your overlay (+ Add Widget, Static/Custom, Custom Widget), then open Settings and Open Editor.",
     "Press each button and paste into the tab it names, replacing what is there, then click Done."].forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      steps.appendChild(li);
    });
    panel.appendChild(steps);

    var grid = document.createElement("div");
    grid.className = "copy-grid";
    var msg = document.createElement("p");
    msg.id = "copy-msg";
    msg.className = "hint";
    var box = document.createElement("textarea");
    box.hidden = true;
    box.readOnly = true;

    FILES.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "copy-btn";
      var label = document.createElement("span");
      label.textContent = "Copy " + f.name;
      var small = document.createElement("small");
      small.textContent = "paste into " + f.note;
      b.appendChild(label);
      b.appendChild(small);
      b.addEventListener("click", function () {
        b.classList.remove("done", "failed");
        f.get().then(function (text) {
          return copyText(text, box).then(function (ok) {
            if (ok) {
              b.classList.add("done");
              label.textContent = "Copied " + f.name;
              msg.textContent = "Copied " + f.name + " (" + kb(text) + "). Paste it into " + f.note + ".";
              setTimeout(function () { b.classList.remove("done"); label.textContent = "Copy " + f.name; }, 2500);
            } else {
              b.classList.add("failed");
              msg.textContent = "The browser would not copy it. It is in the box below: press Ctrl+C (or Cmd+C) to copy it.";
            }
          });
        }).catch(function (e) {
          b.classList.add("failed");
          msg.textContent = e && e.message ? e.message : "Could not copy " + f.name + ".";
        });
      });
      grid.appendChild(b);
    });
    panel.appendChild(grid);
    panel.appendChild(msg);
    panel.appendChild(box);
    return panel;
  }

  // The page builds its controls after it has fetched the widget, so wait for them, and put the
  // panel back if the page ever rebuilds them.
  function place() {
    var c = document.getElementById("controls");
    // The controls hold only a loading note until the page has built its sections, which have headings.
    if (!c || !c.querySelector("h2") || document.getElementById("copy-panel")) return;
    // After the page's title and its introduction, or at the very top when the page has no title.
    var first = c.firstChild, ref = first;
    if (first.tagName === "H1") {
      ref = first.nextSibling;
      if (ref && ref.className && /hint/.test(ref.className)) ref = ref.nextSibling;
    }
    c.insertBefore(build(), ref);
  }

  function start() {
    var c = document.getElementById("controls");
    if (!c) return;
    place();
    if (typeof MutationObserver === "function") new MutationObserver(place).observe(c, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}());
