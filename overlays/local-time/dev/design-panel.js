/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The panel on every overlay's dev page that carries a look from one overlay to the next, so it only has to be set up once.
 *
 * Only the design settings travel: the style preset, font, colours, shape, frame and decorations. An overlay's own wording
 * and behaviour are left alone, and so is anything this overlay does not have. A design can be saved in the browser, which every
 * dev page on the same site shares, copied or downloaded as a small JSON file, and applied from a pasted or chosen file.
 *
 * The page's own script gives it two hooks: `window.__exportFields()`, which returns fields.json with the current values, and
 * `window.__importFields(values)`, which sets those values, rebuilds the settings and reloads the widget. The panel adds
 * itself once the page has built its controls. */
(function () {
  "use strict";

  var STORE_KEY = "stream-overlays-design";
  var AUTO_KEY = "stream-overlays-design-auto";
  var MARK = "stream-overlays-design";

  // What counts as design. Behaviour (animate, fit, mute, debug) and wording stay with each overlay.
  var DESIGN_KEYS = [
    "themePreset", "fontFamily", "weight", "radius", "pad", "outerFrame", "borderWidth", "borderColor", "shadow",
    "colorPanel", "usePanelOpacity", "panelOpacity", "cText", "cAccent", "cTrack", "cWarn",
    "decoration", "decorationCount", "decorationSize", "decorationMotion", "decorationPlacement", "decorationColor", "decorationTint", "decorationOpacity"
  ];

  // Settings known to be wording or behaviour. A design file never carries these, and one that does is not obeyed, so a file that was
  // edited by hand cannot change an overlay's commands or title. A setting this list has never heard of is allowed through.
  var NOT_DESIGN = ["command", "whoCanManage", "title", "showTitle", "animate", "fit", "fillBox", "mute", "debug"];

  // Every decoration setting is design, including any that are added later, so a new one travels without this list changing.
  var DESIGN_PREFIXES = ["decoration"];
  function isDesign(k) {
    if (DESIGN_KEYS.indexOf(k) !== -1) return true;
    for (var i = 0; i < DESIGN_PREFIXES.length; i++) { if (k.indexOf(DESIGN_PREFIXES[i]) === 0) return true; }
    return false;
  }
  // A key that could reach into an object's own plumbing is never a setting.
  function safeKey(k) { return k !== "__proto__" && k !== "constructor" && k !== "prototype"; }

  // The design in a fields.json, the file the page exports: each setting's current value.
  function pick(fields) {
    var out = {};
    Object.keys(fields || {}).forEach(function (k) {
      var d = fields[k];
      if (safeKey(k) && isDesign(k) && d && typeof d === "object" && d.type !== "button" && d.value !== undefined) out[k] = d.value;
    });
    return out;
  }

  // Reads what was pasted or chosen. It can be a design file, a plain object of settings, or a whole fields.json.
  // A design file was written by this panel, so everything in it is design, including settings this version of the panel has never
  // heard of: a design saved by a newer overlay still works here, and what this overlay lacks is left alone. A plain object or a
  // fields.json could hold anything, so only the settings known to be design are taken from those.
  function parse(text) {
    var data, bad = { error: "That is not a design. It should be the text from Copy design, or a design.json file." };
    try { data = JSON.parse(String(text || "").replace(new RegExp("^" + String.fromCharCode(0xFEFF)), "")); } catch (e) { return bad; }
    if (!data || typeof data !== "object" || Array.isArray(data)) return bad;
    var isFile = !!data[MARK] && data.settings && typeof data.settings === "object" && !Array.isArray(data.settings);
    var from = typeof data.from === "string" ? data.from : "";
    var src = isFile ? data.settings : data;
    var settings = {};
    Object.keys(src).forEach(function (k) {
      if (!safeKey(k) || NOT_DESIGN.indexOf(k) !== -1 || (!isFile && !isDesign(k))) return;
      var v = src[k];
      // A fields.json setting is an object with its value inside.
      if (v && typeof v === "object" && !Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, "value")) v = v.value;
      if (v === null || typeof v === "object" || v === undefined) return;
      settings[k] = v;
    });
    if (!Object.keys(settings).length) return { error: "There are no design settings in that, such as a style preset, colours or decorations." };
    return { settings: settings, from: from };
  }

  // Which of the settings suit this overlay, in the form its setting wants. Anything it does not have is counted and left
  // alone, and a value its setting cannot take (a preset it lacks, a number that is not one) is skipped and named.
  function choose(settings, defs) {
    var values = {}, missing = 0, skipped = [];
    Object.keys(settings).forEach(function (k) {
      var d = defs && Object.prototype.hasOwnProperty.call(defs, k) && defs[k], v = settings[k];
      if (!d || d.type === "button") { missing++; return; }
      if (d.type === "dropdown") {
        if (d.options && Object.prototype.hasOwnProperty.call(d.options, String(v))) values[k] = String(v); else skipped.push(k);
      } else if (d.type === "checkbox") {
        if (v === true || v === "true" || v === 1) values[k] = true; else if (v === false || v === "false" || v === 0) values[k] = false; else skipped.push(k);
      } else if (d.type === "number" || d.type === "slider") {
        var n = typeof v === "number" ? v : (typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
        if (!isFinite(n)) { skipped.push(k); return; }
        if (typeof d.min === "number") n = Math.max(d.min, n);
        if (typeof d.max === "number") n = Math.min(d.max, n);
        values[k] = n;
      } else {
        values[k] = String(v);
      }
    });
    return { values: values, missing: missing, skipped: skipped };
  }

  function describe(from, applied, r) {
    var s = "Applied " + applied + " design setting" + (applied === 1 ? "" : "s") + (from ? " from " + from : "") + ".";
    if (r.missing) s += " " + r.missing + " " + (r.missing === 1 ? "is" : "are") + " not in this overlay, so " + (r.missing === 1 ? "it was" : "they were") + " left out.";
    if (r.skipped.length) s += " " + r.skipped.join(", ") + " could not be used here, so " + (r.skipped.length === 1 ? "it was" : "they were") + " left as it was.";
    return s;
  }

  var api = { DESIGN_KEYS: DESIGN_KEYS, NOT_DESIGN: NOT_DESIGN, isDesign: isDesign, pick: pick, parse: parse, choose: choose, describe: describe, STORE_KEY: STORE_KEY };
  if (typeof module === "object" && module.exports) { module.exports = api; return; }

  var STYLE = "#design-panel { margin: 0 0 14px; padding: 12px; border: 2px solid #9fd8c8; border-radius: 12px; background: #f2fbf8; }" +
    "#design-panel h2 { margin-top: 0; }" +
    "#design-panel .hint { margin: 0 0 8px; }" +
    "#design-panel button { margin: 0 4px 6px 0; }" +
    "#design-panel button[disabled] { opacity: 0.5; cursor: default; }" +
    "#design-panel textarea { display: block; width: 100%; height: 70px; margin: 6px 0; font-size: 11px; box-sizing: border-box; }" +
    "#design-panel label.auto { display: block; font-size: 12px; margin: 4px 0 8px; }" +
    "#design-panel #design-msg { min-height: 1.3em; font-size: 12px; margin: 6px 0 0; }" +
    "#design-panel #design-saved { font-size: 12px; margin: 0 0 8px; }" +
    "html:not([data-theme=\"light\"]) #design-panel { border-color: #3f8a73; background: #17302a; }" +
    "html:not([data-theme=\"light\"]) #design-panel textarea { background: #15121d; color: inherit; border: 1px solid #443a63; }";

  function title() { var h = document.querySelector("#controls h1"); return h ? h.textContent.replace(/\s+Overlay$/, "") : ""; }
  function saved() { try { var s = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return s && s.settings ? s : null; } catch (e) { return null; } }
  function defs() {
    try { return JSON.parse(window.__exportFields()); } catch (e) { return {}; }
  }
  function current() { return { from: title(), settings: pick(defs()) }; }
  function fileText(d) {
    var o = {}; o[MARK] = 1; o.from = d.from; o.settings = d.settings;
    return JSON.stringify(o, null, 2) + "\n";
  }
  function apply(d, say) {
    if (typeof window.__importFields !== "function") { say("This page is not ready yet."); return; }
    var r = choose(d.settings, defs());
    if (!Object.keys(r.values).length) { say("None of those design settings are in this overlay."); return; }
    window.__importFields(r.values);
    say(describe(d.from, Object.keys(r.values).length, r));
  }

  function build() {
    var panel = document.createElement("div");
    panel.id = "design-panel";
    var h = document.createElement("h2"); h.textContent = "Design: set it once"; panel.appendChild(h);
    var hint = document.createElement("p"); hint.className = "hint";
    hint.textContent = "Set the look in one overlay, save it, then apply it in the others. Only the design travels: style preset, font, colours, shape, frame and decorations. Wording and behaviour stay as they are.";
    panel.appendChild(hint);
    var msg = document.createElement("p"); msg.id = "design-msg";
    var say = function (t) { msg.textContent = t; };
    var info = document.createElement("p"); info.id = "design-saved";
    function btn(label, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", fn); return b; }

    var use, forget;
    function refresh() {
      var s = saved();
      info.textContent = s ? "Saved design: from " + (s.from || "another overlay") + (s.savedAt ? ", " + new Date(s.savedAt).toLocaleDateString() : "") + "." : "No design saved yet.";
      use.disabled = forget.disabled = !s;
    }
    var save = btn("Save this design", function () {
      var d = current();
      if (!Object.keys(d.settings).length) { say("There is no design to save yet."); return; }
      d.savedAt = Date.now();
      try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); say("Saved this look. Open any other overlay and press Use saved design."); } catch (e) { say("This browser would not keep it. Use Copy design instead."); }
      refresh();
    });
    use = btn("Use saved design", function () { var s = saved(); if (s) apply(s, say); });
    forget = btn("Forget it", function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} say("Forgot the saved design."); refresh(); });
    panel.appendChild(save); panel.appendChild(use); panel.appendChild(forget); panel.appendChild(info);

    var auto = document.createElement("label"); auto.className = "auto";
    var cb = document.createElement("input"); cb.type = "checkbox";
    try { cb.checked = localStorage.getItem(AUTO_KEY) === "1"; } catch (e) {}
    cb.addEventListener("change", function () {
      try { if (cb.checked) localStorage.setItem(AUTO_KEY, "1"); else localStorage.removeItem(AUTO_KEY); } catch (e) {}
      if (cb.checked && saved()) apply(saved(), say);
    });
    auto.appendChild(cb); auto.appendChild(document.createTextNode(" Use my saved design whenever I open an overlay"));
    panel.appendChild(auto);

    var box = document.createElement("textarea"); box.placeholder = "Paste a design here to apply it";
    panel.appendChild(btn("Copy design", function () {
      var text = fileText(current());
      var fallback = function () { box.value = text; box.select(); try { document.execCommand("copy"); say("Copied this design."); } catch (e) { say("Select the text in the box and copy it."); } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { say("Copied this design."); }, fallback); else fallback();
    }));
    panel.appendChild(btn("Download design.json", function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([fileText(current())], { type: "application/json" }));
      a.download = "design.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      say("Downloaded design.json.");
    }));
    panel.appendChild(box);
    var fromText = function (text) { var p = parse(text); if (p.error) say(p.error); else apply(p, say); };
    panel.appendChild(btn("Apply pasted design", function () { fromText(box.value); }));
    var file = document.createElement("input"); file.type = "file"; file.accept = ".json,application/json"; file.hidden = true;
    file.addEventListener("change", function () {
      var f = file.files && file.files[0]; if (!f) return;
      var r = new FileReader(); r.onload = function () { fromText(String(r.result)); file.value = ""; }; r.readAsText(f);
    });
    panel.appendChild(btn("Choose a design.json", function () { file.click(); }));
    panel.appendChild(file);
    panel.appendChild(msg);
    refresh();
    return { panel: panel, auto: function () { var s = saved(); if (cb.checked && s) apply(s, say); } };
  }

  var autoDone = false;
  function place() {
    var c = document.getElementById("controls");
    if (!c || !c.querySelector("h2") || document.getElementById("design-panel") || typeof window.__importFields !== "function") return;
    var made = build();
    // Straight after the copy panel, which comes after the page's title and its introduction.
    var after = document.getElementById("copy-panel");
    if (after) c.insertBefore(made.panel, after.nextSibling);
    else { var first = c.firstChild, ref = first; if (first && first.tagName === "H1") { ref = first.nextSibling; if (ref && ref.className && /hint/.test(ref.className)) ref = ref.nextSibling; } c.insertBefore(made.panel, ref); }
    if (!autoDone) { autoDone = true; made.auto(); }
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
