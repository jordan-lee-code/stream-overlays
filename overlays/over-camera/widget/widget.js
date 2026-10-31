/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Over Camera Overlay. StreamElements custom widget logic. */
(function () {
  "use strict";

  var PRESETS = {
    glass: { panel: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.2)", alarm: "#D64545", font: "BioRhyme" },
    frost: { panel: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", track: "rgba(0, 0, 0, 0.14)", alarm: "#C0392B", font: "BioRhyme" },
    midnight: { panel: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#89AFFF", track: "rgba(127, 168, 255, 0.22)", alarm: "#FF6B6B", font: "BioRhyme" },
    sunset: { panel: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", track: "rgba(255, 154, 90, 0.24)", alarm: "#FF4D4D", font: "BioRhyme" },
    forest: { panel: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", track: "rgba(111, 214, 160, 0.22)", alarm: "#FF7A59", font: "BioRhyme" },
    ocean: { panel: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", track: "rgba(76, 211, 224, 0.22)", alarm: "#FF6B6B", font: "BioRhyme" },
    rose: { panel: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF98BE", track: "rgba(255, 143, 184, 0.24)", alarm: "#FF4D6D", font: "BioRhyme" },
    neon: { panel: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", track: "rgba(0, 240, 255, 0.2)", alarm: "#FF3366", font: "BioRhyme" },
    cosycabin: { panel: "#F5ECD6", text: "#57442E", accent: "#7C6142", track: "rgba(0, 0, 0, 0.11)", alarm: "#C05746", font: "Chicle" },
    pastel: { panel: "#FFF6E9", text: "#6B4F3A", accent: "#BF684C", track: "rgba(0, 0, 0, 0.11)", alarm: "#F4587A", font: "Baloo 2" },
    celestial: { panel: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", track: "rgba(255, 255, 255, 0.18)", alarm: "#B5495B", font: "Cinzel" },
    pastelgoth: { panel: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", track: "rgba(255, 255, 255, 0.18)", alarm: "#C96A8E", font: "Quicksand" },
    pastelpink: { panel: "#FFE3EC", text: "#6A2E4B", accent: "#BF5179", track: "rgba(106, 46, 75, 0.14)", alarm: "#D6456F", font: "Fredoka" },
    pastelsage: { panel: "#DEEBD8", text: "#2B4636", accent: "#4A7A5A", track: "rgba(43, 70, 54, 0.14)", alarm: "#C5533F", font: "Fredoka" },
    faegreen: { panel: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", track: "rgba(238, 245, 218, 0.2)", alarm: "#E0805A", font: "Almendra" },
    pride: { panel: "rgba(194, 168, 154, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #E50000, #FF8D00, #FFEE00, #028121, #004CFF, #770088)" },
    trans: { panel: "rgba(185, 201, 225, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"], bgimg: "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)" },
    bi: { panel: "rgba(117, 39, 142, 0.9)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.24)", alarm: "#FF6B6B", font: "Fredoka", flag: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"], bgimg: "linear-gradient(135deg, #D60270, #D60270, #9B4F96, #0038A8, #0038A8)" },
    pan: { panel: "rgba(181, 142, 132, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#FF218C", "#FFD800", "#21B1FF"], bgimg: "linear-gradient(135deg, #FF218C, #FFD800, #21B1FF)" },
    enby: { panel: "rgba(212, 202, 192, 0.9)", text: "#1A1426", accent: "#2D2D2D", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #FFF433, #FFFFFF, #9B59D0, #2D2D2D)" },
    lesbian: { panel: "rgba(232, 167, 169, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.40), rgba(255, 255, 255, 0.40)), linear-gradient(135deg, #D52D00, #EF7627, #FF9A56, #FFFFFF, #D162A4, #B55690, #A30262)" },
    ace: { panel: "rgba(202, 187, 202, 0.9)", text: "#1A1426", accent: "#000000", track: "rgba(26, 20, 38, 0.34)", alarm: "#B3123A", font: "Fredoka", flag: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), linear-gradient(135deg, #000000, #A3A3A3, #FFFFFF, #800080)" }
  };

  // ---- shared by every overlay in this set ----
  function str(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  // For wording where an empty field is a real choice (no tag, no currency symbol, no title).
  // StreamElements sends "" for a cleared field, which str() would turn back into the default.
  function txt(v, d) { return (v === undefined || v === null) ? d : String(v); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function bool(v, d) {
    if (v === undefined || v === null || v === "") return d;
    return v === true || v === "true" || v === 1 || v === "1" || v === "on";
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return document.getElementById(id); }
  function rgba(hex, opacity) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex === undefined || hex === null ? "" : hex).trim());
    if (!m) return "rgba(0, 0, 0, " + clamp(opacity, 0, 1) + ")";
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + clamp(opacity, 0, 1) + ")";
  }
  function rolesOf(data) {
    var r = { broadcaster: false, mod: false, sub: false, vip: false };
    var badges = (data && data.badges) || [];
    for (var i = 0; i < badges.length; i++) {
      var t = String(badges[i].type || "").toLowerCase();
      if (t === "broadcaster") r.broadcaster = true;
      else if (t === "moderator") r.mod = true;
      else if (t === "subscriber" || t === "founder") r.sub = true;
      else if (t === "vip") r.vip = true;
    }
    var tags = (data && data.tags) || {};
    if (tags.mod === "1" || tags.mod === 1) r.mod = true;
    if (tags.subscriber === "1" || tags.subscriber === 1 || tags.subscriber === true) r.sub = true;
    if (tags.vip === "1" || tags.vip === 1) r.vip = true;
    if (typeof tags.badges === "string") {
      if (/broadcaster/.test(tags.badges)) r.broadcaster = true;
      if (/vip/.test(tags.badges)) r.vip = true;
    }
    return r;
  }
  // Shrinks a card until it fits the box it has been given, and never enlarges it. The text already scales with
  // the box's width, so this is for a box that is short for its width, where the card would run off the bottom.
  // CSS zoom keeps the card full width and scales its text, padding and corners together. The height does not
  // shrink in step with the zoom, because the text wraps differently as it gets smaller, so the zoom is searched
  // for and not calculated.
  // `share` is how much of the box the card may use: a number, or a function for a card that shares the box
  // with something that comes and goes.
  function fitToBox(root, app, share) {
    if (!root || !app || !app.style || typeof app.getBoundingClientRect !== "function") return;
    app.style.zoom = "";
    var room = root.clientHeight * (typeof share === "function" ? share() : (share || 1));
    if (!(room > 0) || app.getBoundingClientRect().height <= room + 0.5) return;
    var lo = 0.1, hi = 1;
    for (var i = 0; i < 9; i++) {
      var mid = (lo + hi) / 2;
      app.style.zoom = String(mid);
      if (app.getBoundingClientRect().height <= room + 0.5) lo = mid; else hi = mid;
    }
    app.style.zoom = String(Math.round(lo * 1000) / 1000);
  }
  // Keeps a card fitted as the box is resized, as its content changes, and once its font has loaded. A change of
  // class is left out on purpose: that is how a card pops when something happens, and measuring in the middle of
  // the pop would shrink it for good.
  // `opts.share` is passed on to fitToBox, `opts.also` is another element whose appearing or disappearing should
  // refit the card, and `opts.after` is called whenever the zoom actually changes, for something else that depends on
  // how much room is left.
  function watchFit(root, app, on, opts) {
    if (!root || !app) return;
    opts = opts || {};
    app.__fitShare = opts.share;
    app.__fitAfter = opts.after;
    app.__fitOn = !!on;
    if (!app.__fitWatching) {
      app.__fitWatching = true;
      var queued = false;
      app.__fitSoon = function () {
        if (queued) return;
        queued = true;
        // A timer and not an animation frame: measuring layout needs no frame, and a page that is hidden or has
        // nothing animating may not produce one.
        setTimeout(function () {
          queued = false;
          var was = app.__fitZoom || "";
          if (app.__fitOn) fitToBox(root, app, app.__fitShare); else if (app.style) app.style.zoom = "";
          app.__fitZoom = (app.style && app.style.zoom) || "";
          if (app.__fitZoom !== was && app.__fitAfter) app.__fitAfter();
        }, 30);
      };
      if (typeof ResizeObserver === "function") new ResizeObserver(app.__fitSoon).observe(root);
      if (typeof MutationObserver === "function") {
        new MutationObserver(app.__fitSoon).observe(app, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
        if (opts.also) new MutationObserver(app.__fitSoon).observe(opts.also, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
      }
      if (typeof document !== "undefined" && document.fonts && document.fonts.ready) document.fonts.ready.then(app.__fitSoon);
    }
    app.__fitSoon();
  }
  // ---- end of the shared primitives ----
  // The settings every overlay in this set shares. Each widget adds its own on top.
  function readCommon(f, d) {
    f = f || {}; d = d || {};
    return {
      command: str(f.command, d.command || "!command"),
      whoCanManage: str(f.whoCanManage, "mods"),
      title: txt(f.title, d.title || ""),
      showTitle: bool(f.showTitle, true),
      themePreset: str(f.themePreset, "glass"),
      colorPanel: str(f.colorPanel, "#000000"),
      panelOpacity: num(f.panelOpacity, 0.55),
      cText: str(f.cText, "#FFFFFF"),
      cAccent: str(f.cAccent, "#FFFFFF"),
      cTrack: str(f.cTrack, "#444444"),
      cWarn: str(f.cWarn, "#D64545"),
      fontFamily: str(f.fontFamily, "BioRhyme"),
      radius: Math.max(0, num(f.radius, 24)),
      borderWidth: Math.max(0, num(f.borderWidth, 0)),
      borderColor: str(f.borderColor, "#FFFFFF"),
      shadow: bool(f.shadow, false),
      pad: Math.max(0, num(f.pad, 0.5)),
      weight: clamp(num(f.weight, 800), 100, 900),
      animate: bool(f.animate, true),
      fit: bool(f.fit, true),
      mute: bool(f.mute, false),
      debug: bool(f.debug, false)
    };
  }
  function themeOf(c) {
    var p = c.themePreset !== "custom" ? PRESETS[c.themePreset] : null;
    if (p) return p;
    return { panel: rgba(c.colorPanel, c.panelOpacity), text: c.cText, accent: c.cAccent, track: c.cTrack, alarm: c.cWarn, font: c.fontFamily };
  }
  function loadFont(linkId, name) {
    if (!name || typeof document === "undefined" || !document.head) return;
    var link = byId(linkId);
    if (!link) {
      link = document.createElement("link");
      link.id = linkId; link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":wght@400;700;800&display=swap";
  }
  // A flag is a list of stripes, top to bottom. A bar can wear it as horizontal bands.
  function flagGradient(stripes) {
    var n = stripes.length, parts = [];
    for (var i = 0; i < n; i++) parts.push(stripes[i] + " " + (i * 100 / n) + "% " + ((i + 1) * 100 / n) + "%");
    return "linear-gradient(180deg, " + parts.join(", ") + ")";
  }
  function applyCommonTheme(c, root, app, fontLinkId) {
    var t = themeOf(c), s = app.style;
    s.setProperty("--w-bg", t.panel);
    s.setProperty("--w-text", t.text);
    s.setProperty("--w-accent", t.accent);
    s.setProperty("--w-track", t.track);
    s.setProperty("--w-alarm", t.alarm);
    s.setProperty("--w-flag", t.flag ? flagGradient(t.flag) : t.accent);
    s.setProperty("--w-bgimg", t.bgimg || "none");
    s.setProperty("--w-edge", t.flag ? "inset 0 0 0 1px rgba(20, 16, 38, 0.38)" : "none");
    s.setProperty("--w-font", '"' + t.font + '", Georgia, serif');
    s.setProperty("--w-radius", c.radius + "px");
    s.setProperty("--w-pad", c.pad);
    s.setProperty("--w-weight", c.weight);
    s.setProperty("--w-border", c.borderWidth + "px solid " + c.borderColor);
    s.setProperty("--w-shadow", c.shadow ? "0 0.3em 1.2em rgba(0, 0, 0, 0.45)" : "none");
    root.classList.toggle("no-motion", !c.animate);
    watchFit(root, app, c.fit);
    loadFont(fontLinkId, t.font);
    return t;
  }
  function canManage(c, roles) {
    if (roles.broadcaster) return true;
    return c.whoCanManage === "mods" && roles.mod;
  }
  function playUrl(c, url, volume) {
    if (c.mute || !url || typeof Audio === "undefined") return;
    try {
      var a = new Audio(url);
      a.volume = clamp(volume / 100, 0, 1);
      var p = a.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) { /* a sound that will not play is never worth breaking the widget */ }
  }
  function hasStore() {
    return typeof SE_API !== "undefined" && SE_API && SE_API.store && typeof SE_API.store.set === "function";
  }
  function storeSave(key, value) {
    if (!hasStore()) return;
    try { SE_API.store.set(key, value); } catch (e) { /* it still works unsaved */ }
  }
  function storeLoad(key, done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(null); return; }
    var got = SE_API.store.get(key);
    if (got && typeof got.then === "function") got.then(done, function () { done(null); });
    else done(got);
  }
  function debugLog(c, tag, listener, event) {
    if (!c.debug || typeof console === "undefined" || !console.log) return;
    try { console.log("[" + tag + "]", listener, JSON.stringify(event)); } catch (e) { /* unprintable payloads are skipped */ }
  }
  // ---- end of the shared settings and theme ----

  var STORE_KEY = "overcamera_v1";
  var MODES = ["live", "off", "brb", "away", "cover"];
  var MAX_MS = 12 * 3600000;        // a countdown longer than this is not one
  var MAX_TEXT = 120;
  var HOLD_MS = 3000;               // how long the cover waits for the saved state before it stops waiting
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var waitTimer = null;
  var shown = "";

  function blankState() { return { mode: "live", text: "", until: 0 }; }
  function now() { return Date.now(); }

  // Durations the way the other overlays read them: 5m, 90s, 1h30m, 2:30 (minutes and seconds), or a bare 5 for minutes.
  function parseDuration(text) {
    var t = String(text === undefined || text === null ? "" : text).replace(/^\s+|\s+$/g, "").toLowerCase();
    if (!t) return NaN;
    if (/^\d+(:\d+){1,2}$/.test(t)) {
      var p = t.split(":").map(Number);
      return p.length === 3 ? ((p[0] * 60 + p[1]) * 60 + p[2]) * 1000 : (p[0] * 60 + p[1]) * 1000;
    }
    if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60000);
    var re = /(\d+(?:\.\d+)?)\s*(d|h|m|s)/g;
    var units = { d: 86400000, h: 3600000, m: 60000, s: 1000 };
    var total = 0, used = "", m;
    while ((m = re.exec(t))) { total += parseFloat(m[1]) * units[m[2]]; used += m[0]; }
    if (!used || used.replace(/\s/g, "") !== t.replace(/\s/g, "")) return NaN;
    return Math.round(total);
  }
  function short(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + ":" + pad2(m) + ":" + pad2(s % 60) : m + ":" + pad2(s % 60);
  }
  // The cover has to be solid, and every style preset has a see-through panel, so the cover takes the
  // colour of the panel with its transparency removed.
  function solid(css) {
    var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(String(css || "")) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(css || "").trim());
    if (!m) return "rgb(0, 0, 0)";
    var hex = m[0].charAt(0) === "#";
    return "rgb(" + (hex ? parseInt(m[1], 16) : +m[1]) + ", " + (hex ? parseInt(m[2], 16) : +m[2]) + ", " + (hex ? parseInt(m[3], 16) : +m[3]) + ")";
  }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!camera" });
    c.fit = false;                                         // the cover fills the box, so there is nothing to shrink
    c.start = str(f.startMode, "live") === "off" ? "off" : "live";
    c.hold = bool(f.holdWhileLoading, true);
    c.autoReveal = bool(f.autoReveal, false);
    c.circle = str(f.shape, "rounded") === "circle";
    c.textSize = clamp(num(f.textSize, 9), 2, 30);
    c.text = { off: txt(f.offText, "Camera off"), brb: txt(f.brbText, "Be right back"), away: txt(f.awayText, "Away for a moment") };
    c.icon = { off: txt(f.offIcon, "\ud83d\udd12"), brb: txt(f.brbIcon, "\u2615"), away: txt(f.awayIcon, "\ud83d\udca4"), cover: txt(f.coverIcon, "") };
    c.offSub = txt(f.offSub, "Back soon");
    c.timerText = txt(f.timerText, "Back in {time}");
    c.overText = txt(f.overText, "Back any moment now");
    c.soundCover = str(f.soundCover, "");
    c.volCover = num(f.soundCoverVol, 60);
    c.soundReveal = str(f.soundReveal, "");
    c.volReveal = num(f.soundRevealVol, 60);
    return c;
  }

  // What the cover says for the state it is in.
  function view() {
    var s = state, v;
    if (s.mode === "brb") v = { icon: cfg.icon.brb, text: cfg.text.brb, sub: "" };
    else if (s.mode === "away") v = { icon: cfg.icon.away, text: cfg.text.away, sub: "" };
    else if (s.mode === "cover") v = { icon: cfg.icon.cover, text: s.text || cfg.text.off, sub: "" };
    else v = { icon: cfg.icon.off, text: cfg.text.off, sub: cfg.offSub };
    if (s.until) v.sub = s.until > now() ? cfg.timerText.split("{time}").join(short(s.until - now())) : cfg.overText;
    return v;
  }

  function render() {
    if (!el.cover) return;
    // While the saved state is still loading, and the hold is on, the cover is up and says nothing, because it
    // does not know what to say yet.
    var holdingNow = !loaded && cfg.hold;
    var covered = holdingNow || state.mode !== "live";
    el.cover.classList.toggle("live", !covered);
    var v = !holdingNow && state.mode !== "live" ? view() : { icon: "", text: "", sub: "" };
    var key = v.icon + "|" + v.text + "|" + v.sub;
    if (key === shown) return;
    shown = key;
    el.icon.textContent = v.icon; el.icon.hidden = !v.icon;
    el.text.textContent = v.text;
    el.sub.textContent = v.sub; el.sub.hidden = !v.sub;
  }

  // ---------------------------------------------------------------------------
  // Covering and revealing
  // ---------------------------------------------------------------------------
  function setMode(mode, text, until) {
    var was = state.mode;
    state = { mode: mode, text: text || "", until: until || 0 };
    save(); render();
    if (was === "live" && mode !== "live") playUrl(cfg, cfg.soundCover, cfg.volCover);
    else if (was !== "live" && mode === "live") playUrl(cfg, cfg.soundReveal, cfg.volReveal);
  }
  // A countdown the streamer typed, or none: a time that cannot be read, or is absurd, is left out, and the cover goes up anyway.
  function untilFrom(arg) {
    var ms = parseDuration(arg);
    return ms > 0 && ms <= MAX_MS ? now() + ms : 0;
  }
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var m = /^(\S+)\s*(.*)$/.exec(text.slice(base.length).replace(/^\s+|\s+$/g, ""));
    if (!m) return;                                         // the bare word does nothing: there is nothing to show while the camera is live
    if (!canManage(cfg, rolesOf(data))) return;
    var verb = m[1].toLowerCase(), arg = m[2].replace(/^\s+|\s+$/g, "");
    if (verb === "off") setMode("off");
    else if (verb === "on" || verb === "live") setMode("live");
    else if (verb === "brb" || verb === "away") setMode(verb, "", untilFrom(arg));
    else if (verb === "cover") setMode("cover", arg.slice(0, MAX_TEXT));
  }
  function handleButton(field) {
    switch (field) {
      case "btnOff": setMode("off"); break;
      case "btnBrb": setMode("brb"); break;
      case "btnAway": setMode("away"); break;
      case "btnOn": setMode("live"); break;
      case "test_soundCover": playUrl(cfg, cfg.soundCover, cfg.volCover); break;
      case "test_soundReveal": playUrl(cfg, cfg.soundReveal, cfg.volReveal); break;
    }
  }

  // A countdown ends by itself, and the cover stays up unless the streamer has asked for it to come down.
  function tick() {
    if (!loaded || state.mode === "live" || !state.until) return;
    if (state.until <= now() && cfg.autoReveal) setMode("live"); else render();
  }

  // ---------------------------------------------------------------------------
  // Storage and load
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  // Reads a save back, however damaged. A save that cannot be read is no save, and the first time's state is used.
  function restore(saved) {
    if (!saved || typeof saved !== "object" || MODES.indexOf(saved.mode) === -1) return null;
    var s = blankState();
    s.mode = saved.mode;
    if (s.mode === "cover" && typeof saved.text === "string") s.text = saved.text.slice(0, MAX_TEXT);
    if (s.mode === "brb" || s.mode === "away") s.until = num(saved.until, 0) > 0 && num(saved.until, 0) < 1e15 ? Math.floor(num(saved.until, 0)) : 0;
    return s;
  }
  function firstState() { var s = blankState(); s.mode = cfg.start; return s; }

  function applyLook() {
    var t = applyCommonTheme(cfg, el.root, el.cover, "oc-font-link");
    var s = el.cover.style;
    s.setProperty("--oc-solid", solid(t.panel));
    s.setProperty("--oc-size", cfg.textSize);
    s.setProperty("--oc-radius", cfg.circle ? "50%" : cfg.radius + "px");
  }
  function bind() {
    var ids = { root: "oc-root", cover: "oc-cover", icon: "oc-icon", text: "oc-text", sub: "oc-sub" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  setInterval(tick, 250);

  window.addEventListener("onWidgetLoad", function (obj) {
    loaded = false; shown = "";
    if (waitTimer) clearTimeout(waitTimer);
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.cover) return;
    applyLook();
    // The cover stays up until the saved state is known, so a refresh cannot flash the camera. If the state
    // never arrives it stops waiting, but stays covered: not knowing what the state was, it will not guess that
    // it was safe to show the camera, and "!camera on" lifts it. With the hold switched off it uses where it starts.
    el.cover.classList.toggle("holding", cfg.hold);
    state = firstState();
    render();                                          // straight away, and not when the saved state arrives
    var settled = false;
    function settle(saved, timedOut) {
      if (settled) return;
      settled = true;
      if (waitTimer) { clearTimeout(waitTimer); waitTimer = null; }
      state = restore(saved) || (timedOut && cfg.hold ? { mode: "off", text: "", until: 0 } : firstState());
      loaded = true;
      el.cover.classList.remove("holding");
      render();
      save();
    }
    waitTimer = setTimeout(function () { settle(null, true); }, HOLD_MS);
    if (!cfg.hold) el.cover.classList.remove("holding");
    storeLoad(STORE_KEY, settle);
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "overcamera", d.listener, ev);
    try {
      switch (d.listener) {
        case "message": handleChat(ev.data); break;
        case "widget-button": handleButton(ev.field); break;
      }
    } catch (e) { if (cfg.debug && typeof console !== "undefined" && console.log) console.log("[overcamera] could not handle", d.listener, e && e.message); }
  });
})();
