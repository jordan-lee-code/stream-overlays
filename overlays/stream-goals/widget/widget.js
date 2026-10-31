/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Stream Goals Overlay. StreamElements custom widget logic. */
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


  var STORE_KEY = "stream_goals_v1";
  var KINDS = ["subs", "bits", "tips", "follows"];
  var BEAT_MS = 30000;
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var raiseTimers = {};
  var lastBeat = 0;

  function now() { return Date.now(); }
  function zeros() { return { subs: 0, bits: 0, tips: 0, follows: 0 }; }
  function blankState() {
    return { counts: zeros(), stage: zeros(), reached: { subs: false, bits: false, tips: false, follows: false }, paused: false, lastSeen: 0, lastEvent: 0 };
  }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!goals", title: "Stream goals" });
    c.resetMode = str(f.resetMode, "gap");
    c.gapMs = Math.max(1, num(f.gapHours, 6)) * 3600000;
    c.show = { subs: bool(f.showSubs, true), bits: bool(f.showBits, true), tips: bool(f.showTips, false), follows: bool(f.showFollows, false) };
    c.label = { subs: txt(f.labelSubs, "Sub goal"), bits: txt(f.labelBits, "Bits goal"), tips: txt(f.labelTips, "Tip goal"), follows: txt(f.labelFollows, "Follow goal") };
    c.base = { subs: Math.max(1, num(f.targetSubs, 50)), bits: Math.max(1, num(f.targetBits, 5000)), tips: Math.max(1, num(f.targetTips, 50)), follows: Math.max(1, num(f.targetFollows, 100)) };
    c.raise = { subs: Math.max(0, num(f.raiseSubs, 25)), bits: Math.max(0, num(f.raiseBits, 2500)), tips: Math.max(0, num(f.raiseTips, 0)), follows: Math.max(0, num(f.raiseFollows, 50)) };
    c.subPoints = bool(f.subPoints, false);
    c.format = str(f.format, "{n} / {target}");
    c.currency = txt(f.currency, "£");
    c.currencyAfter = bool(f.currencyAfter, false);
    c.decimalComma = bool(f.decimalComma, false);
    c.decimals = str(f.decimals, "auto");
    c.reachedText = txt(f.reachedText, "Goal reached!");
    c.raiseDelayMs = Math.max(1, num(f.raiseDelay, 6)) * 1000;
    c.textSize = Math.max(2, num(f.textSize, 5.5));
    c.titleScale = Math.max(0.5, num(f.titleScale, 1.2));
    c.barHeight = Math.max(0.2, num(f.barHeight, 0.55));
    c.rowGap = Math.max(0, num(f.rowGap, 0.7));
    c.sounds = { progress: str(f.soundProgress, ""), reached: str(f.soundReached, "") };
    c.volumes = { progress: num(f.soundProgressVol, 50), reached: num(f.soundReachedVol, 80) };
    return c;
  }

  function sound(kind) { playUrl(cfg, cfg.sounds[kind], cfg.volumes[kind]); }
  function targetOf(k) { return cfg.base[k] + state.stage[k] * cfg.raise[k]; }

  // ---------------------------------------------------------------------------
  // Counting
  // ---------------------------------------------------------------------------
  function newStream() {
    for (var k in raiseTimers) if (raiseTimers.hasOwnProperty(k)) { clearTimeout(raiseTimers[k]); }
    raiseTimers = {};
    state = blankState();
    state.lastSeen = now();
  }
  function count(kind, amount) {
    if (state.paused || !(amount > 0)) return;
    // The overlay may have been left open between streams, so a long quiet gap before an
    // event means this is a new stream, and it starts the goals afresh first.
    if (cfg.resetMode === "gap" && state.lastEvent && now() - state.lastEvent > cfg.gapMs) newStream();
    var wasReached = state.reached[kind];
    state.counts[kind] = Math.round((state.counts[kind] + amount) * 100) / 100;
    state.lastEvent = state.lastSeen = now();
    checkReached(kind);
    save(); render(); bump(kind);
    sound(!wasReached && state.reached[kind] ? "reached" : "progress");
  }
  function checkReached(kind) {
    if (state.reached[kind] || state.counts[kind] < targetOf(kind)) return;
    state.reached[kind] = true;
    if (cfg.raise[kind] > 0) {
      raiseTimers[kind] = setTimeout(function () { delete raiseTimers[kind]; raise(kind); }, cfg.raiseDelayMs);
    }
  }
  function raise(kind) {
    if (cfg.raise[kind] <= 0) return;
    while (state.counts[kind] >= targetOf(kind)) state.stage[kind]++;
    state.reached[kind] = false;
    save(); render();
  }
  function setCount(kind, n) {
    state.counts[kind] = Math.max(0, Math.round(n * 100) / 100);
    state.reached[kind] = false;
    if (raiseTimers[kind] !== undefined) { clearTimeout(raiseTimers[kind]); delete raiseTimers[kind]; }
    // A correction by hand picks the stage the new number belongs to, without a celebration.
    var base = cfg.base[kind], by = cfg.raise[kind], c = state.counts[kind];
    state.stage[kind] = by > 0 && c >= base ? Math.floor((c - base) / by) + 1 : 0;
    checkReached(kind);
    save(); render();
  }

  function onSub(event) {
    event = event || {};
    // A gift bomb is one announcement with the real size, then one follow-up per recipient
    // carrying a streak figure such as 170. Only the announcement counts.
    if (event.isCommunityGift || event.playedAsCommunityGift) return;
    var t = String(event.tier || "").toLowerCase();
    var each = cfg.subPoints ? (t === "3000" || t === "3" ? 6 : (t === "2000" || t === "2" ? 2 : 1)) : 1;
    if (bool(event.bulkGifted, false)) { count("subs", each * Math.max(0, Math.floor(num(event.amount, 0)))); return; }
    count("subs", each);
  }
  function onCheer(event) { count("bits", Math.floor(num(event && event.amount, 0))); }
  function onTip(event) { count("tips", Math.round(num(event && event.amount, 0) * 100) / 100); }

  // ---------------------------------------------------------------------------
  // Chat and buttons
  // ---------------------------------------------------------------------------
  // An amount typed in chat is a number. For tips it can also have a currency sign in front or behind: a sign
  // that is not a letter or digit ($, an euro or pound sign), or exactly the symbol set for tips (5 kr). So 5,
  // 5.50, 5,50, $5, 5 kr, +3 and -3 are amounts. Anything else is refused and not guessed at, including 1,250 (a
  // comma could mean a separator or a decimal), 1e3 and 1k, because a wrong guess adds the wrong number.
  // Returns NaN for something that is not an amount.
  function parseAmount(text, money) {
    var sym = "";
    if (money) {
      var own = String(cfg.currency || "").replace(/^\s+|\s+$/g, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      sym = "(?:[^\\w\\s+\\-.,]{1,3}" + (own ? "|" + own : "") + ")?";
    }
    var m = new RegExp("^\\s*([+-]?)\\s*" + sym + "\\s*(\\d+(?:[.,]\\d{1,2})?)\\s*" + sym + "\\s*$", "i").exec(String(text === undefined || text === null ? "" : text));
    if (!m) return NaN;
    var n = parseFloat(m[2].replace(",", "."));
    return m[1] === "-" ? -n : n;
  }
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var args = text.slice(base.length).replace(/^\s+|\s+$/g, "").split(/\s+/);
    var verb = (args.shift() || "").toLowerCase();
    if (!verb) { popTitle(); return; }                     // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var kind = (args[0] || "").toLowerCase();
    if (KINDS.indexOf(kind) === -1) kind = "";
    var n = parseAmount(args.slice(1).join(" "), kind === "tips");
    switch (verb) {
      case "reset": newStream(); save(); render(); break;
      case "set": if (kind && !isNaN(n)) setCount(kind, n); break;
      case "add": if (kind && !isNaN(n)) setCount(kind, state.counts[kind] + n); break;
      case "pause": state.paused = true; save(); render(); break;
      case "resume": state.paused = false; save(); render(); break;
    }
  }
  function handleButton(field) {
    switch (field) {
      case "btnReset": newStream(); save(); render(); break;
      case "btnPause": state.paused = true; save(); render(); break;
      case "btnResume": state.paused = false; save(); render(); break;
      case "test_soundProgress": sound("progress"); break;
      case "test_soundReached": sound("reached"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      for (var i = 0; i < KINDS.length; i++) {
        var k = KINDS[i];
        s.counts[k] = Math.max(0, num(saved.counts && saved.counts[k], 0));
        s.stage[k] = Math.max(0, Math.floor(num(saved.stage && saved.stage[k], 0)));
        s.reached[k] = bool(saved.reached && saved.reached[k], false);
      }
      s.paused = bool(saved.paused, false);
      s.lastSeen = num(saved.lastSeen, 0);
      s.lastEvent = num(saved.lastEvent, 0);
    }
    return s;
  }
  function withCommas(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  // A tip is money. The symbol goes before the amount (£5) or after it (5 kr, 5\u20ac): a lone sign sits
  // tight against the number and a word gets a space that does not break the line. The decimal can
  // be a comma (5,50), and the thousands then use a point. Cents show when there are some, always,
  // or never.
  function money(n) {
    var neg = n < 0, c = Math.round(Math.abs(n) * 100);
    var whole = cfg.decimals === "none" ? Math.round(c / 100) : Math.floor(c / 100), frac = cfg.decimals === "none" ? 0 : c % 100;
    var body = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, cfg.decimalComma ? "." : ",");
    if (cfg.decimals === "always" || (cfg.decimals !== "none" && frac !== 0)) body += (cfg.decimalComma ? "," : ".") + (frac < 10 ? "0" : "") + frac;
    if (neg) body = "-" + body;
    var sym = cfg.currency;
    if (!sym) return body;
    if (!cfg.currencyAfter) return sym + body;
    return body + (/^[A-Za-z\u00c0-\u024f]/.test(sym) ? "\u00a0" : "") + sym;
  }
  function shown(kind, n) {
    return kind === "tips" ? money(n) : withCommas(n);
  }
  function bump(kind) {
    var row = el.rows[kind];
    if (row && row.classList) { row.classList.remove("bump"); void row.offsetWidth; row.classList.add("bump"); }
  }
  function popTitle() {
    if (!el.title || !el.title.classList) return;
    el.title.classList.remove("pop"); void el.title.offsetWidth; el.title.classList.add("pop");
  }
  function render() {
    if (!el.app) return;
    el.title.textContent = cfg.title; el.title.hidden = !cfg.showTitle || !cfg.title;
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i], row = el.rows[k], target = targetOf(k), n = state.counts[k];
      row.hidden = !cfg.show[k];
      el.labels[k].textContent = cfg.label[k];
      var done = state.reached[k];
      el.counts[k].textContent = done && cfg.reachedText ? cfg.reachedText : cfg.format.split("{n}").join(shown(k, n)).split("{target}").join(shown(k, target));
      el.fills[k].style.width = clamp(n / target * 100, 0, 100) + "%";
      row.classList.toggle("reached", done);
    }
    el.app.classList.toggle("paused", state.paused);
    el.status.textContent = state.paused ? "paused" : ""; el.status.hidden = !state.paused;
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "sg-font-link");
    var s = el.app.style;
    s.setProperty("--sg-size", cfg.textSize + "cqw");
    s.setProperty("--sg-title", cfg.titleScale);
    s.setProperty("--sg-bar", cfg.barHeight + "em");
    s.setProperty("--sg-gap", cfg.rowGap + "em");
  }
  function bind() {
    el.root = byId("sg-root"); el.app = byId("sg-app"); el.title = byId("sg-title"); el.status = byId("sg-status");
    el.rows = {}; el.labels = {}; el.counts = {}; el.fills = {};
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i];
      el.rows[k] = byId("sg-row-" + k); el.labels[k] = byId("sg-label-" + k);
      el.counts[k] = byId("sg-count-" + k); el.fills[k] = byId("sg-fill-" + k);
    }
  }

  setInterval(function () {
    if (!loaded) return;
    var t = now();
    if (t - lastBeat >= BEAT_MS) { lastBeat = t; state.lastSeen = t; save(); }
  }, 1000);

  window.addEventListener("onWidgetLoad", function (obj) {
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      for (var k in raiseTimers) if (raiseTimers.hasOwnProperty(k)) clearTimeout(raiseTimers[k]);
      raiseTimers = {};
      state = restore(saved);
      // A widget last seen long ago, or one set to start fresh every load, means a new stream.
      var stale = saved && state.lastSeen && now() - state.lastSeen > cfg.gapMs;
      if (cfg.resetMode === "load" || (cfg.resetMode === "gap" && stale)) newStream();
      state.lastSeen = lastBeat = now();
      loaded = true;
      for (var i = 0; i < KINDS.length; i++) checkReached(KINDS[i]);
      render();
      save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "stream-goals", d.listener, ev);
    switch (d.listener) {
      case "message": handleChat(ev.data); break;
      case "subscriber-latest": onSub(ev); break;
      case "cheer-latest": onCheer(ev); break;
      case "tip-latest": onTip(ev); break;
      case "follower-latest": count("follows", 1); break;
      case "widget-button": handleButton(ev.field); break;
    }
  });
})();
