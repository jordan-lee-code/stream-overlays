/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The panel on this overlay's dev page that loads a snapshot from the real overlay, so a problem seen on stream can be looked at
 * again here, with the same settings and the same counts.
 *
 * A snapshot comes from the overlay itself (the Show a snapshot button, or the snapshot chat command): the settings and the saved
 * counts as one line of JSON. Paste it here and load it. Anything before the first curly bracket is ignored, so the whole line from
 * the browser console can be pasted as it is.
 *
 * The page's own script gives it two hooks: `window.__getSnapshot()` and `window.__applySnapshot(snapshot)`. The panel adds itself
 * once the page has built its controls. */
(function () {
  "use strict";

  var OVERLAY = "stream-goals";
  var STYLE = "#snapshot-panel { margin: 0 0 14px; padding: 12px; border: 2px solid #8fd3c2; border-radius: 12px; background: #f1fbf8; }" +
    "#snapshot-panel h2 { margin-top: 0; }" +
    "#snapshot-panel textarea { width: 100%; height: 90px; font: 11px/1.3 monospace; box-sizing: border-box; }" +
    "#snapshot-panel .snap-msg { min-height: 1.3em; margin: 4px 0 0; }" +
    "html:not([data-theme=\"light\"]) #snapshot-panel { background: #172a2a; border-color: #3f7d70; }";

  function parse(text) {
    var s = String(text || ""), i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i === -1 || j <= i) throw new Error("There is no snapshot in what was pasted.");
    var snap;
    try { snap = JSON.parse(s.slice(i, j + 1)); } catch (e) { throw new Error("That is not a whole snapshot, so it may have been cut short when it was copied."); }
    if (!snap || snap.overlay !== OVERLAY) throw new Error("That snapshot is not from this overlay" + (snap && snap.overlay ? " (it is from " + snap.overlay + ")." : "."));
    if (!snap.fields || typeof snap.fields !== "object") throw new Error("That snapshot has no settings in it.");
    return snap;
  }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  function build() {
    var box = el("textarea", { id: "snapshot-text", placeholder: "Paste a snapshot here" });
    var msg = el("p", { "class": "hint snap-msg", id: "snapshot-msg" });
    function say(t) { msg.textContent = t; }
    function button(label, fn, cls) { var b = el("button", { text: label, "class": cls || "" }); b.addEventListener("click", fn); return b; }
    var load = button("Load this snapshot", function () {
      try {
        var snap = parse(box.value), n = window.__applySnapshot(snap);
        var when = snap.takenAt ? new Date(snap.takenAt).toLocaleString() : "an unknown time";
        say("Loaded " + n + " settings" + (snap.state ? " and the saved counts" : "") + ", as they were at " + when + ". The page's clock is set to match.");
      } catch (e) { say(e.message); }
    }, "go");
    var copy = button("Copy a snapshot of this page", function () {
      var text = JSON.stringify(window.__getSnapshot());
      var fallback = function () { box.value = text; box.select(); try { document.execCommand("copy"); say("Copied, and it is in the box too."); } catch (e) { say("Select the text in the box and copy it."); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { box.value = text; say("Copied a snapshot of this page."); }, fallback); else fallback();
    });
    return el("div", { id: "snapshot-panel" }, [
      el("h2", { text: "Troubleshooting snapshot" }),
      el("p", { "class": "hint", text: "To look at a problem from your stream here: in StreamElements press Show a snapshot for troubleshooting under Manual controls, or send the snapshot command in chat as a moderator. Copy the text it shows, paste it below, and load it. The settings, the counts and the time come across as they were." }),
      box, load, copy, msg
    ]);
  }

  function place() {
    var c = document.getElementById("controls");
    if (!c || !c.querySelector("h2") || document.getElementById("snapshot-panel") || typeof window.__applySnapshot !== "function") return;
    var after = document.getElementById("design-panel") || document.getElementById("copy-panel");
    var panel = build();
    if (after) c.insertBefore(panel, after.nextSibling); else c.insertBefore(panel, c.querySelector("h2"));
  }
  function start() {
    var s = document.createElement("style"); s.textContent = STYLE; document.head.appendChild(s);
    var c = document.getElementById("controls");
    if (!c) return;
    place();
    if (typeof MutationObserver === "function") new MutationObserver(place).observe(c, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}());
