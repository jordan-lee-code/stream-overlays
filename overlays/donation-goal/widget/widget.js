/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Donation Goal Overlay. StreamElements custom widget logic. */
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

  var STORE_KEY = "donations_v1";
  var BANNER_MS = 10000;        // how long the "goal reached" banner shows when the goal stretches
  var STRETCH_LIMIT = 1000;     // more raises than this in one go means something is wrong
  var MAX_CENTS = 1e11;         // a single gift bigger than this is not a donation
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var bumped = false;

  // Money is kept in whole cents, so adding 0.1 and 0.2 can never come to 0.30000000000000004.
  function blankState() { return { raised: 0, goal: 0, goalSetting: 0, latest: null, bannerUntil: 0 }; }
  function cents(v) { var n = parseFloat(v); return isFinite(n) ? Math.round(n * 100) : NaN; }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!donation", title: "Donation goal" });
    var goal = num(f.goal, 100);
    c.goal = Math.round((goal > 0 ? goal : 100) * 100);      // a goal of nothing, or less, is the usual one
    c.start = Math.max(0, Math.round(num(f.startAmount, 0) * 100));
    c.stretch = str(f.whenReached, "stay") === "stretch";
    c.stretchBy = Math.max(1, Math.round(num(f.stretchBy, 50) * 100));
    c.minGift = Math.max(0, Math.round(num(f.minTip, 0) * 100));
    c.symbol = txt(f.symbol, "$");
    c.symbolAfter = bool(f.symbolAfter, false);
    c.decimalComma = bool(f.decimalComma, false);
    c.decimals = str(f.decimals, "auto");
    c.showAmounts = bool(f.showAmounts, true);
    c.showPercent = bool(f.showPercent, true);
    c.showLatest = bool(f.showLatest, true);
    c.amountText = txt(f.amountText, "{raised} of {goal}");
    c.percentText = txt(f.percentText, "{percent}%");
    c.reachedText = txt(f.reachedText, "Goal reached! Thank you");
    c.latestText = txt(f.latestText, "Latest: {name} gave {amount}");
    c.anonName = str(f.anonymousName, "Anonymous");
    c.textSize = Math.max(2, num(f.textSize, 6));
    c.barHeight = Math.max(0.2, num(f.barHeight, 0.9));
    c.titleScale = Math.max(0.5, num(f.titleScale, 1.2));
    c.soundTip = str(f.soundTip, "");
    c.volTip = num(f.soundTipVol, 60);
    c.soundReached = str(f.soundReached, "");
    c.volReached = num(f.soundReachedVol, 70);
    return c;
  }

  // ---------------------------------------------------------------------------
  // Money: reading it and writing it
  // ---------------------------------------------------------------------------
  function group(whole) { return whole.replace(/\B(?=(\d{3})+(?!\d))/g, cfg.decimalComma ? "." : ","); }
  // The symbol goes before the amount ($5) or after it (5 kr, 5\u20ac): a lone sign sits tight
  // against the number and a word gets a space. The decimal can be a comma (5,50), and the
  // thousands then use a point.
  function money(c) {
    var neg = c < 0; c = Math.abs(c);
    var whole = cfg.decimals === "none" ? Math.round(c / 100) : Math.floor(c / 100), frac = cfg.decimals === "none" ? 0 : c % 100;
    var body = group(String(whole));
    if (cfg.decimals === "always" || (cfg.decimals !== "none" && frac !== 0)) body += (cfg.decimalComma ? "," : ".") + (frac < 10 ? "0" : "") + frac;
    if (neg) body = "-" + body;
    var sym = cfg.symbol;
    if (!sym) return body;
    if (!cfg.symbolAfter) return sym + body;
    return body + (/^[A-Za-z\u00c0-\u024f]/.test(sym) ? "\u00a0" : "") + sym;
  }
  // "5", "$5", "5.50", "5,50", "5 kr", "+3" and "-3" are amounts: a number with a currency sign of up to three
  // characters in front or behind it, and nothing else. "1,250" is not, because a comma could mean either a
  // thousands separator or a decimal, and a wrong guess would add the wrong money, and neither is "1e3".
  function parseMoney(s) {
    var m = /^\s*([+-]?)\s*[^\d\s+\-.,]{0,3}\s*(\d+(?:[.,]\d{1,2})?)\s*[^\d\s+\-.,]{0,3}\s*$/.exec(String(s === undefined || s === null ? "" : s));
    if (!m) return null;
    var n = Math.round(parseFloat(m[2].replace(",", ".")) * 100);
    if (m[1] === "-") n = -n;
    return isFinite(n) && Math.abs(n) <= MAX_CENTS ? n : null;
  }
  function percent() { return state.goal > 0 ? Math.floor(state.raised * 100 / state.goal) : 0; }
  function tpl(text, vars) {
    return String(text).replace(/\{(raised|goal|percent|name|amount)\}/g, function (m, k) { return vars[k] === undefined ? m : vars[k]; });
  }
  function vars() {
    var l = state.latest;
    return { raised: money(state.raised), goal: money(state.goal), percent: String(percent()), name: l ? l.name : "", amount: l ? money(l.cents) : "" };
  }

  // ---------------------------------------------------------------------------
  // The goal
  // ---------------------------------------------------------------------------
  function isReached() {
    if (cfg.stretch) return state.bannerUntil > Date.now();
    return state.goal > 0 && state.raised >= state.goal;
  }
  // After the total changes: when the goal is set to stretch it is raised until it is ahead of the
  // total again, and the banner shows for a while. Otherwise the bar stays full, with its message.
  // Returns true when this change is what reached the goal.
  function settle(wasReached) {
    if (cfg.stretch) {
      var raised = 0;
      while (state.raised >= state.goal && raised++ < STRETCH_LIMIT) state.goal += cfg.stretchBy;
      if (raised > 0) state.bannerUntil = Date.now() + BANNER_MS;
      return raised > 0;
    }
    return !wasReached && state.raised >= state.goal;
  }
  function wasReached() { return cfg.stretch ? false : state.raised >= state.goal; }

  function nameOf(raw) {
    var n = String(raw === undefined || raw === null ? "" : raw).replace(/^\s+|\s+$/g, "");
    return !n || /^(anonymous|an?anonymous\s?gifter|anon)$/i.test(n.replace(/\s+/g, "")) ? cfg.anonName : n;
  }
  // A gift from someone: it counts, it is remembered as the latest, and it can be what reaches the goal.
  function credit(amount, who) {
    var was = wasReached();
    state.raised += amount;
    state.latest = { name: who, cents: amount };
    var reached = settle(was);
    bumped = true;
    save(); render();
    if (reached) playUrl(cfg, cfg.soundReached, cfg.volReached);
    else playUrl(cfg, cfg.soundTip, cfg.volTip);
  }
  // A correction by hand: the total moves, but nobody is credited.
  function setRaised(total) {
    var was = wasReached();
    var before = state.raised;
    state.raised = Math.max(0, Math.min(MAX_CENTS, total));
    var reached = settle(was);
    bumped = state.raised > before;
    save(); render();
    if (reached) playUrl(cfg, cfg.soundReached, cfg.volReached);
  }
  function setGoal(goal) {
    state.goal = Math.max(1, Math.min(MAX_CENTS, goal));
    state.bannerUntil = 0;
    save(); render();
  }
  function reset() {
    state = blankState();
    state.raised = cfg.start; state.goal = cfg.goal; state.goalSetting = cfg.goal;
    save(); render();
  }

  // ---------------------------------------------------------------------------
  // Events, chat and buttons
  // ---------------------------------------------------------------------------
  function onTip(event) {
    event = event || {};
    var amount = cents(event.amount);
    if (!(amount > 0) || amount > MAX_CENTS || amount < cfg.minGift) return;
    credit(amount, nameOf(event.name || event.username));
  }
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var m = /^(\S+)\s*(.*)$/.exec(text.slice(base.length).replace(/^\s+|\s+$/g, ""));
    if (!m) { pop(); return; }                             // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var verb = m[1].toLowerCase(), amount = parseMoney(m[2]);
    if (verb === "reset") reset();
    else if (verb === "add" && amount !== null) setRaised(state.raised + amount);
    else if (verb === "set" && amount !== null && amount >= 0) setRaised(amount);
    else if (verb === "goal" && amount !== null && amount > 0) setGoal(amount);
  }
  function handleButton(field) {
    switch (field) {
      case "btnDemo": credit(500, "Test donor"); break;
      case "btnReset": reset(); break;
      case "test_soundTip": playUrl(cfg, cfg.soundTip, cfg.volTip); break;
      case "test_soundReached": playUrl(cfg, cfg.soundReached, cfg.volReached); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  // Reads a save back, however damaged: a field that is missing or the wrong type is left at its start.
  function restore(saved) {
    if (!saved || typeof saved !== "object") return null;
    var s = blankState();
    s.raised = Math.max(0, Math.min(MAX_CENTS, Math.floor(num(saved.raised, 0))));
    var g = Math.floor(num(saved.goal, 0));
    s.goal = g >= 1 ? Math.min(MAX_CENTS, g) : 0;          // a goal that is missing or damaged is left for the setting to fill
    s.goalSetting = Math.max(0, Math.floor(num(saved.goalSetting, 0)));
    s.bannerUntil = Math.max(0, num(saved.bannerUntil, 0));
    var l = saved.latest;
    if (l && typeof l === "object" && typeof l.name === "string" && num(l.cents, 0) > 0) s.latest = { name: l.name, cents: Math.floor(num(l.cents, 0)) };
    return s;
  }
  function pop() {
    if (!el.title || !el.title.classList) return;
    el.title.classList.remove("pop"); void el.title.offsetWidth; el.title.classList.add("pop");
  }
  function render() {
    if (!el.app) return;
    var v = vars();
    el.title.textContent = cfg.title; el.title.hidden = !cfg.showTitle || !cfg.title;
    var amountText = tpl(cfg.amountText, v), percentText = tpl(cfg.percentText, v);
    el.amount.textContent = amountText; el.amount.hidden = !cfg.showAmounts || !amountText;
    el.percent.textContent = percentText; el.percent.hidden = !cfg.showPercent || !percentText;
    var ratio = state.goal > 0 ? Math.max(0, Math.min(1, state.raised / state.goal)) : 0;
    el.fill.style.width = Math.round(ratio * 10000) / 100 + "%";
    var reached = isReached(), statusText = reached ? tpl(cfg.reachedText, v) : "";
    el.app.classList.toggle("reached", reached);
    el.status.textContent = statusText; el.status.hidden = !statusText;
    var latestText = cfg.showLatest && state.latest ? tpl(cfg.latestText, v) : "";
    el.latest.textContent = latestText; el.latest.hidden = !latestText;
    if (bumped && cfg.animate && el.app.classList) { el.app.classList.remove("bump"); void el.app.offsetWidth; el.app.classList.add("bump"); }
    bumped = false;
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "dg-font-link");
    var s = el.app.style;
    s.setProperty("--dg-size", cfg.textSize + "cqw");
    s.setProperty("--dg-title", cfg.titleScale);
    s.setProperty("--dg-bar", cfg.barHeight + "em");
  }
  function bind() {
    var ids = { root: "dg-root", app: "dg-app", title: "dg-title", amount: "dg-amount", percent: "dg-percent", fill: "dg-fill", status: "dg-status", latest: "dg-latest" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  // The banner for a stretched goal is a point in time, so it ends on its own and survives a refresh.
  setInterval(function () {
    if (loaded && state.bannerUntil && state.bannerUntil <= Date.now()) { state.bannerUntil = 0; save(); render(); }
  }, 500);

  window.addEventListener("onWidgetLoad", function (obj) {
    loaded = false;
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      var s = restore(saved);
      if (!s) {
        // Nothing saved yet: start from the settings.
        s = blankState(); s.raised = cfg.start; s.goal = cfg.goal; s.goalSetting = cfg.goal;
      } else if (!s.goal || s.goalSetting !== cfg.goal) {
        // The goal setting was changed since the last load, or the saved goal is no use, so the setting wins.
        s.goal = cfg.goal; s.goalSetting = cfg.goal;
      }
      state = s; loaded = true; bumped = false;
      render();
      save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "donations", d.listener, ev);
    try {
      switch (d.listener) {
        case "message": handleChat(ev.data); break;
        case "tip-latest": onTip(ev); break;
        case "widget-button": handleButton(ev.field); break;
      }
    } catch (e) { if (cfg.debug && typeof console !== "undefined" && console.log) console.log("[donations] could not handle", d.listener, e && e.message); }
  });
})();
