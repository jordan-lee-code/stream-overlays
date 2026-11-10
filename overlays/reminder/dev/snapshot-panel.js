/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The panel on every overlay's dev page that brings a problem seen on stream into the dev page, so it can be looked at again.
 *
 * It takes the Data tab of the StreamElements widget editor, which holds every setting as plain values, and loads those settings. The Fields
 * tab (a fields.json) works too, and so does a snapshot.
 * An overlay whose page can also give and take its saved counts (it offers `window.__getSnapshot()` and `window.__applySnapshot(snapshot)`)
 * takes a full snapshot too, with the counts and the time it was taken, and the panel can copy one of the page itself.
 *
 * Every dev page already offers `window.__importFields(values)`, which sets the settings it has, never a button, rebuilds them and
 * reloads the widget, and that is all the Data tab needs. The panel adds itself once the page has built its controls. */
(function () {
  "use strict";

  var STYLE = "#snapshot-panel { margin: 0 0 14px; padding: 12px; border: 2px solid #8fd3c2; border-radius: 12px; background: #f1fbf8; }" +
    "#snapshot-panel h2 { margin-top: 0; }" +
    "#snapshot-panel textarea { width: 100%; height: 90px; font: 11px/1.3 monospace; box-sizing: border-box; }" +
    "#snapshot-panel .snap-msg { min-height: 1.3em; margin: 4px 0 0; }" +
    "html:not([data-theme=\"light\"]) #snapshot-panel { background: #172a2a; border-color: #3f7d70; }";

  // A fields.json is the settings with their labels, each value an object that has a type. The Data tab is the values alone.
  function looksLikeFields(o) {
    var keys = Object.keys(o);
    return keys.length > 3 && keys.every(function (k) { return o[k] && typeof o[k] === "object" && o[k].type; });
  }
  // What was pasted, as { fields, ... }. `known` is the name of this overlay when the page can tell, so a snapshot from another is
  // refused. Anything before the first curly bracket is ignored, so a whole line from the browser console works as it is.
  function parse(text, known) {
    var s = String(text || ""), i = s.indexOf("{"), j = s.lastIndexOf("}");
    if (i === -1 || j <= i) throw new Error("There is nothing to load in what was pasted.");
    var snap;
    try { snap = JSON.parse(s.slice(i, j + 1)); } catch (e) { throw new Error("That is not whole JSON, so it may have been cut short when it was copied."); }
    if (!snap || typeof snap !== "object" || Array.isArray(snap)) throw new Error("That is not a snapshot or the Data tab: it has no settings in it.");
    if (snap.overlay) {
      if (known && snap.overlay !== known) throw new Error("That snapshot is not from this overlay (it is from " + snap.overlay + ").");
      if (!snap.fields || typeof snap.fields !== "object") throw new Error("That snapshot has no settings in it.");
      return snap;
    }
    // A fields.json, which is what the Fields tab holds: each setting with its label, and its value in `value`. The values are the settings.
    if (looksLikeFields(snap)) {
      var values = {};
      Object.keys(snap).forEach(function (k) { if (snap[k].type !== "button" && snap[k].type !== "section" && "value" in snap[k]) values[k] = snap[k].value; });
      return { fields: values, dataTab: true, fromFields: true };
    }
    // The Data tab: the settings as plain values, with no counts and no clock.
    if (Object.keys(snap).length > 3) return { fields: snap, dataTab: true };
    throw new Error("That is not a snapshot or the Data tab: it has no settings in it.");
  }
  if (typeof module !== "undefined" && module.exports) { module.exports = { parse: parse, looksLikeFields: looksLikeFields }; return; }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function overlayName() { try { return typeof window.__getSnapshot === "function" ? window.__getSnapshot().overlay : ""; } catch (e) { return ""; } }

  // What happens when something is pasted: it is read and loaded, and what happened is said in a sentence, whether it worked or not.
  function importText(text) {
    var full = typeof window.__applySnapshot === "function" && typeof window.__getSnapshot === "function";
    try {
      var snap = parse(text, overlayName()), n;
      if (!snap.dataTab && full) {
        n = window.__applySnapshot(snap);
        return "Loaded " + n + " settings" + (snap.state ? " and the saved counts" : "") + ", as they were at " + (snap.takenAt ? new Date(snap.takenAt).toLocaleString() : "an unknown time") + ". The page's clock is set to match.";
      }
      n = window.__importFields(snap.fields);
      return n ? "Loaded " + n + " settings" + (snap.fromFields ? " from the Fields tab" : snap.dataTab ? " from the Data tab" : "") + ". Anything not in it stays as it was here, and so do the counts on this page." : "None of those settings belong to this overlay, so nothing changed.";
    } catch (e) { return e.message; }
  }
  window.__importFromStreamElements = importText;

  function build() {
    var full = typeof window.__applySnapshot === "function" && typeof window.__getSnapshot === "function";
    var box = el("textarea", { id: "snapshot-text", placeholder: "Paste the Data tab here" });
    var msg = el("p", { "class": "hint snap-msg", id: "snapshot-msg" });
    function say(t) { msg.textContent = t; }
    function button(label, fn, cls) { var b = el("button", { text: label, "class": cls || "" }); b.addEventListener("click", fn); return b; }
    var kids = [
      el("h2", { text: "Troubleshooting import" }),
      el("p", { "class": "hint", text: "To look at a problem from your stream here: in the StreamElements widget editor open the Data tab, copy everything in it, paste it below and load it. The settings come across as they are on stream." +
        (full ? " A snapshot from the overlay's Troubleshooting group works too, and brings the counts and the time as well." : "") })
    ];
    kids.push(box);
    kids.push(button("Load this", function () { say(importText(box.value)); }, "go"));
    if (full) kids.push(button("Copy a snapshot of this page", function () {
      var text = JSON.stringify(window.__getSnapshot());
      var fallback = function () { box.value = text; box.select(); try { document.execCommand("copy"); say("Copied, and it is in the box too."); } catch (e) { say("Select the text in the box and copy it."); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { box.value = text; say("Copied a snapshot of this page."); }, fallback); else fallback();
    }));
    kids.push(msg);
    return el("div", { id: "snapshot-panel" }, kids);
  }

  function place() {
    var c = document.getElementById("controls");
    if (!c || !c.querySelector("h2") || document.getElementById("snapshot-panel") || typeof window.__importFields !== "function") return;
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
