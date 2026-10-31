/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Leaderboard Overlay. StreamElements custom widget logic. */
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
  // The colour of a panel with its transparency taken out, for something that has to be solid whatever the preset.
  function solid(css) {
    var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(String(css || "")) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(css || "").trim());
    if (!m) return "rgb(0, 0, 0)";
    var hex = m[0].charAt(0) === "#";
    return "rgb(" + (hex ? parseInt(m[1], 16) : +m[1]) + ", " + (hex ? parseInt(m[2], 16) : +m[2]) + ", " + (hex ? parseInt(m[3], 16) : +m[3]) + ")";
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
      outerFrame: bool(f.outerFrame, true),
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
    // The outer frame: a border round the widget in the accent colour, as thick as the Outline setting says, or, left at 0,
    // a default that grows with the box. With the frame off it is the plain outline the settings describe, if there is one.
    var bw = c.borderWidth > 0 ? c.borderWidth + "px" : (c.outerFrame ? "max(2px, 0.6cqw)" : "0px");
    // A pride preset draws the frame in its flag's stripes, as a ring on the panel (see the stylesheet), and the border is then
    // only the room it takes.
    var stripes = c.outerFrame && t.flag;
    s.setProperty("--w-border", bw + " solid " + (c.outerFrame ? (stripes ? "transparent" : t.accent) : c.borderColor));
    s.setProperty("--w-frame-w", bw);
    s.setProperty("--w-frame-img", stripes ? flagGradient(t.flag) : "none");
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


  var STORE_KEY = "leaderboard_v1";
  var CATS = ["gifts", "bits", "tips"];
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var rotIndex = 0, rotAt = 0;
  var shown = {};          // the totals last drawn, so a change can pop

  function blankState() { return { users: {}, seq: 0, view: "gifts", pinned: false }; }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!leaderboard", title: "" });
    c.mode = str(f.mode, "rotate");
    c.rotateMs = Math.max(3, num(f.rotateSeconds, 15)) * 1000;
    c.rows = clamp(Math.floor(num(f.rows, 5)), 1, 15);
    c.include = { gifts: bool(f.showGifts, true), bits: bool(f.showBits, true), tips: bool(f.showTips, true) };
    c.anon = bool(f.anonymousGifts, false);
    c.ignore = String(str(f.ignoreNames, "")).toLowerCase().split(",").map(function (s) { return s.replace(/^\s+|\s+$/g, ""); }).filter(Boolean);
    c.emptyText = txt(f.emptyText, "No one yet");
    c.titles = { gifts: txt(f.titleGifts, "Top gifters"), bits: txt(f.titleBits, "Top cheerers"), tips: txt(f.titleTips, "Top tippers") };
    c.formats = { gifts: str(f.formatGifts, "{n} gifted"), bits: str(f.formatBits, "{n} bits"), tips: str(f.formatTips, "{c}{n}") };
    c.currency = txt(f.currency, "£");
    c.showRank = bool(f.showRank, true);
    c.highlightFirst = bool(f.highlightFirst, true);
    c.maxName = clamp(Math.floor(num(f.maxName, 16)), 4, 40);
    c.rowSize = Math.max(2, num(f.rowSize, 6));
    c.titleScale = Math.max(0.5, num(f.titleScale, 1.15));
    c.rowGap = Math.max(0, num(f.rowGap, 0.25));
    c.highlightChange = bool(f.highlightChange, true);
    c.sounds = { update: str(f.soundUpdate, ""), lead: str(f.soundLead, "") };
    c.volumes = { update: num(f.soundUpdateVol, 50), lead: num(f.soundLeadVol, 80) };
    return c;
  }

  function sound(kind) { playUrl(cfg, cfg.sounds[kind], cfg.volumes[kind]); }
  function enabledCats() {
    var out = [];
    for (var i = 0; i < CATS.length; i++) if (cfg.include[CATS[i]]) out.push(CATS[i]);
    return out.length ? out : CATS.slice();
  }
  function currentView() {
    if (cfg.mode !== "rotate") return cfg.mode;
    if (state.pinned) return state.view;
    var cats = enabledCats();
    return cats[rotIndex % cats.length];
  }

  // ---------------------------------------------------------------------------
  // Totals
  // ---------------------------------------------------------------------------
  function isAnon(name) { return !name || /^(anonymous|an?anonymous\s?gifter|anon)$/i.test(String(name).replace(/\s+/g, "")); }
  function cleanName(name) {
    name = String(name === undefined || name === null ? "" : name).replace(/^\s+|\s+$/g, "");
    if (isAnon(name)) return cfg.anon ? "Anonymous" : "";
    return name;
  }
  function ignored(name) { return cfg.ignore.indexOf(String(name).toLowerCase()) !== -1; }

  function topOf(cat) {
    var list = [];
    for (var k in state.users) if (state.users.hasOwnProperty(k) && state.users[k][cat] > 0) list.push(state.users[k]);
    list.sort(function (a, b) { return (b[cat] - a[cat]) || (a.seq - b.seq); });
    return list;
  }
  function leaderOf(cat) { var t = topOf(cat); return t.length ? t[0].name : ""; }

  function credit(rawName, cat, amount) {
    var name = cleanName(rawName);
    if (!name || ignored(name) || !(amount > 0)) return false;
    var before = leaderOf(cat);
    var key = name.toLowerCase();
    var u = state.users[key];
    if (!u) { u = state.users[key] = { name: name, gifts: 0, bits: 0, tips: 0, seq: state.seq++ }; }
    u.name = name;
    u[cat] += amount;
    save(); render();
    sound(leaderOf(cat) !== before && leaderOf(cat).toLowerCase() === key ? "lead" : "update");
    return true;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function onSub(event) {
    event = event || {};
    // StreamElements reports a gift bomb as one announcement carrying the real number,
    // then one event per recipient whose amount is a streak or lifetime figure. Only the
    // announcement counts, credited to the gifter, so a gift of 10 is 10 and not 10 + 170s.
    if (event.isCommunityGift || event.playedAsCommunityGift) return;
    if (bool(event.bulkGifted, false)) { credit(event.sender || event.name, "gifts", Math.max(0, Math.floor(num(event.amount, 0)))); return; }
    if (bool(event.gifted, false)) credit(event.sender, "gifts", 1);
  }
  function onCheer(event) {
    event = event || {};
    credit(event.name || event.username, "bits", Math.floor(num(event.amount, 0)));
  }
  function onTip(event) {
    event = event || {};
    credit(event.name || event.username, "tips", Math.round(num(event.amount, 0) * 100) / 100);
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var args = text.slice(base.length).replace(/^\s+|\s+$/g, "").split(/\s+/);
    var verb = (args.shift() || "").toLowerCase();
    if (!verb) { popTitle(); return; }                     // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var cat = (args[0] || "").toLowerCase();
    switch (verb) {
      case "reset": resetBoards(CATS.indexOf(cat) !== -1 ? cat : null); break;
      case "show": if (CATS.indexOf(cat) !== -1) pin(cat); break;
      case "rotate": unpin(); break;
      case "remove":
        var key = args.join(" ").toLowerCase();
        if (state.users[key]) { delete state.users[key]; save(); render(); }
        break;
      case "add":
        var n = parseFloat(args[args.length - 1]);
        var name = args.slice(1, -1).join(" ");
        if (CATS.indexOf(cat) !== -1 && name && !isNaN(n)) adjust(name, cat, n);
        break;
    }
  }
  function adjust(rawName, cat, delta) {
    var name = cleanName(rawName);
    if (!name) return;
    var key = name.toLowerCase();
    var u = state.users[key] || (state.users[key] = { name: name, gifts: 0, bits: 0, tips: 0, seq: state.seq++ });
    u[cat] = Math.max(0, Math.round((u[cat] + delta) * 100) / 100);
    save(); render();
  }
  function resetBoards(cat) {
    for (var k in state.users) {
      if (!state.users.hasOwnProperty(k)) continue;
      if (cat) state.users[k][cat] = 0; else { state.users[k].gifts = 0; state.users[k].bits = 0; state.users[k].tips = 0; }
      if (!state.users[k].gifts && !state.users[k].bits && !state.users[k].tips) delete state.users[k];
    }
    shown = {}; save(); render();
  }
  function pin(cat) { state.pinned = true; state.view = cat; save(); render(); }
  function unpin() { state.pinned = false; rotAt = Date.now(); save(); render(); }
  function nextBoard() {
    var cats = enabledCats(), cur = currentView(), i = cats.indexOf(cur);
    pin(cats[(i + 1) % cats.length]);
  }
  function handleButton(field) {
    switch (field) {
      case "btnNext": nextBoard(); break;
      case "btnRotate": unpin(); break;
      case "btnReset": resetBoards(null); break;
      case "test_soundUpdate": sound("update"); break;
      case "test_soundLead": sound("lead"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      s.pinned = bool(saved.pinned, false);
      s.view = CATS.indexOf(saved.view) !== -1 ? saved.view : "gifts";
      var users = saved.users || {};
      for (var k in users) {
        if (!users.hasOwnProperty(k)) continue;
        var u = users[k];
        s.users[k] = { name: String(u.name || k), gifts: Math.max(0, num(u.gifts, 0)), bits: Math.max(0, num(u.bits, 0)), tips: Math.max(0, num(u.tips, 0)), seq: Math.max(0, Math.floor(num(u.seq, 0))) };
      }
      s.seq = Math.max(num(saved.seq, 0), 0);
      for (var j in s.users) if (s.users.hasOwnProperty(j) && s.users[j].seq >= s.seq) s.seq = s.users[j].seq + 1;
    }
    return s;
  }

  function withCommas(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function fmt(cat, n) {
    var v = cat === "tips" && n % 1 !== 0 ? n.toFixed(2) : withCommas(n);
    return cfg.formats[cat].split("{n}").join(v).split("{c}").join(cfg.currency);
  }
  function shorten(name) { return name.length > cfg.maxName ? name.slice(0, cfg.maxName - 1) + "..." : name; }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function span(cls, text) { var s = document.createElement("span"); s.className = cls; s.textContent = text; return s; }

  var lastView = "";
  function render() {
    if (!el.app) return;
    var view = currentView();
    el.heading.textContent = cfg.title ? cfg.title : cfg.titles[view];
    el.heading.hidden = !cfg.showTitle || !el.heading.textContent;
    if (view !== lastView) {
      shown = {};
      if (el.board.classList) { el.board.classList.remove("swap"); void el.board.offsetWidth; el.board.classList.add("swap"); }
      lastView = view;
    }
    clear(el.list);
    var top = topOf(view).slice(0, cfg.rows);
    if (!top.length) {
      var empty = document.createElement("li"); empty.className = "lb-empty"; empty.textContent = cfg.emptyText;
      el.list.appendChild(empty);
    }
    var next = {};
    for (var i = 0; i < top.length; i++) {
      var u = top[i], key = u.name.toLowerCase();
      var li = document.createElement("li");
      li.className = "lb-row" + (i === 0 && cfg.highlightFirst ? " first" : "") +
        (cfg.highlightChange && shown.hasOwnProperty(key) && shown[key] !== u[view] ? " bump" : "");
      if (cfg.showRank) li.appendChild(span("lb-rank", String(i + 1)));
      li.appendChild(span("lb-name", shorten(u.name)));
      li.appendChild(span("lb-val", fmt(view, u[view])));
      el.list.appendChild(li);
      next[key] = u[view];
    }
    shown = next;
    el.app.classList.toggle("no-rank", !cfg.showRank);
  }
  function popTitle() {
    if (!el.heading || !el.heading.classList) return;
    el.heading.classList.remove("pop"); void el.heading.offsetWidth; el.heading.classList.add("pop");
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "lb-font-link");
    var s = el.app.style;
    s.setProperty("--lb-size", cfg.rowSize + "cqw");
    s.setProperty("--lb-title", cfg.titleScale);
    s.setProperty("--lb-gap", cfg.rowGap + "em");
  }
  function bind() {
    var ids = { root: "lb-root", app: "lb-app", heading: "lb-heading", board: "lb-board", list: "lb-list" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  setInterval(function () {
    if (!loaded || cfg.mode !== "rotate" || state.pinned) return;
    if (Date.now() - rotAt >= cfg.rotateMs) {
      rotAt = Date.now();
      rotIndex = (rotIndex + 1) % enabledCats().length;
      render();
    }
  }, 250);

  window.addEventListener("onWidgetLoad", function (obj) {
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      state = restore(saved);
      loaded = true; rotIndex = 0; rotAt = Date.now(); lastView = ""; shown = {};
      render();
      if (!saved) save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "leaderboard", d.listener, ev);
    switch (d.listener) {
      case "message": handleChat(ev.data); break;
      case "subscriber-latest": onSub(ev); break;
      case "cheer-latest": onCheer(ev); break;
      case "tip-latest": onTip(ev); break;
      case "widget-button": handleButton(ev.field); break;
    }
  });
})();
