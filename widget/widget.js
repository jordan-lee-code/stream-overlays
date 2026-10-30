/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Hype Meter Overlay. StreamElements custom widget logic. */
(function () {
  "use strict";

  var PRESETS = {
    glass: { panel: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.2)", alarm: "#D64545", font: "BioRhyme" },
    frost: { panel: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", track: "rgba(0, 0, 0, 0.14)", alarm: "#C0392B", font: "BioRhyme" },
    midnight: { panel: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#7FA8FF", track: "rgba(127, 168, 255, 0.22)", alarm: "#FF6B6B", font: "BioRhyme" },
    sunset: { panel: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", track: "rgba(255, 154, 90, 0.24)", alarm: "#FF4D4D", font: "BioRhyme" },
    forest: { panel: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", track: "rgba(111, 214, 160, 0.22)", alarm: "#FF7A59", font: "BioRhyme" },
    ocean: { panel: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", track: "rgba(76, 211, 224, 0.22)", alarm: "#FF6B6B", font: "BioRhyme" },
    rose: { panel: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF8FB8", track: "rgba(255, 143, 184, 0.24)", alarm: "#FF4D6D", font: "BioRhyme" },
    neon: { panel: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", track: "rgba(0, 240, 255, 0.2)", alarm: "#FF3366", font: "BioRhyme" },
    cosycabin: { panel: "#F5ECD6", text: "#57442E", accent: "#7C6142", track: "rgba(0, 0, 0, 0.11)", alarm: "#C05746", font: "Chicle" },
    pastel: { panel: "#FFF6E9", text: "#6B4F3A", accent: "#FF8A65", track: "rgba(0, 0, 0, 0.11)", alarm: "#F4587A", font: "Baloo 2" },
    celestial: { panel: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", track: "rgba(255, 255, 255, 0.18)", alarm: "#B5495B", font: "Cinzel" },
    pastelgoth: { panel: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", track: "rgba(255, 255, 255, 0.18)", alarm: "#C96A8E", font: "Quicksand" },
    pastelpink: { panel: "#FFE3EC", text: "#6A2E4B", accent: "#D95C8A", track: "rgba(106, 46, 75, 0.14)", alarm: "#D6456F", font: "Fredoka" },
    faegreen: { panel: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", track: "rgba(238, 245, 218, 0.2)", alarm: "#E0805A", font: "Almendra" }
  };

  // ---- shared by every overlay in this set ----
  function str(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  // For wording where an empty field is a real choice (no tag, no currency symbol, no title).
  // StreamElements sends "" for a cleared field, which str() would turn back into the default.
  function txt(v, d) { return (v === undefined || v === null) ? d : String(v); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function bool(v, d) {
    if (v === undefined || v === null) return d;
    if (typeof v === "string") return v === "true";
    return !!v;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return document.getElementById(id); }
  function rgba(hex, opacity) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex || "transparent";
    var n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + clamp(opacity, 0, 1) + ")";
  }
  function rolesOf(data) {
    var r = { broadcaster: false, mod: false };
    var badges = (data && data.badges) || [];
    for (var i = 0; i < badges.length; i++) {
      var t = String(badges[i].type || "").toLowerCase();
      if (t === "broadcaster") r.broadcaster = true;
      else if (t === "moderator") r.mod = true;
    }
    var tags = (data && data.tags) || {};
    if (tags.mod === "1" || tags.mod === 1) r.mod = true;
    if (typeof tags.badges === "string" && /broadcaster/.test(tags.badges)) r.broadcaster = true;
    return r;
  }
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
  function applyCommonTheme(c, root, app, fontLinkId) {
    var t = themeOf(c), s = app.style;
    s.setProperty("--w-bg", t.panel);
    s.setProperty("--w-text", t.text);
    s.setProperty("--w-accent", t.accent);
    s.setProperty("--w-track", t.track);
    s.setProperty("--w-alarm", t.alarm);
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


  var STORE_KEY = "hype_v1";
  var TICK_MS = 250;
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var lastTick = 0;
  var lastMsg = {};
  var bannerTimer = null;
  var pipCount = -1;

  function blankState() { return { level: 1, points: 0, lastGain: 0, paused: false }; }
  function now() { return Date.now(); }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!hype", title: "Hype" });
    c.levels = clamp(Math.floor(num(f.levels, 5)), 1, 12);
    c.base = Math.max(1, num(f.basePoints, 100));
    c.growth = Math.max(1, num(f.growth, 1.5));
    c.names = String(txt(f.levelNames, "Warming up, Heating up, Hyped, On fire, Legendary")).split(",").map(function (s) { return s.replace(/^\s+|\s+$/g, ""); });
    c.levelWord = str(f.levelWord, "Level");
    c.maxText = txt(f.maxText, "MAX");
    c.canDrop = bool(f.canDropLevel, false);
    c.pMessage = Math.max(0, num(f.pointsMessage, 1));
    c.cooldownMs = Math.max(0, num(f.userCooldown, 10)) * 1000;
    c.ignoreCommands = bool(f.ignoreCommands, true);
    c.ignoreNames = String(str(f.ignoreNames, "")).toLowerCase().split(",").map(function (s) { return s.replace(/^\s+|\s+$/g, ""); }).filter(Boolean);
    c.pSub = [Math.max(0, num(f.pointsSub1, 20)), Math.max(0, num(f.pointsSub2, 40)), Math.max(0, num(f.pointsSub3, 100))];
    c.pGift = Math.max(0, num(f.pointsGift, 20));
    c.pBits = Math.max(0, num(f.pointsBits, 5));
    c.pTip = Math.max(0, num(f.pointsTip, 5));
    c.pFollow = Math.max(0, num(f.pointsFollow, 5));
    c.pRaid = Math.max(0, num(f.pointsRaid, 25));
    c.decay = Math.max(0, num(f.decayPerMinute, 10));
    c.decayDelayMs = Math.max(0, num(f.decayDelay, 30)) * 1000;
    c.showPoints = bool(f.showPoints, true);
    c.showPips = bool(f.showPips, true);
    c.showLevelNumber = bool(f.showLevelNumber, true);
    c.bannerText = txt(f.bannerText, "Level up: {name}");
    c.bannerMs = Math.max(1, num(f.bannerSeconds, 5)) * 1000;
    c.textSize = Math.max(2, num(f.textSize, 7));
    c.titleScale = Math.max(0.5, num(f.titleScale, 1));
    c.barHeight = Math.max(0.2, num(f.barHeight, 0.7));
    c.addAmount = Math.max(1, num(f.addAmount, 25));
    c.sounds = { level: str(f.soundLevel, ""), max: str(f.soundMax, ""), drop: str(f.soundDrop, "") };
    c.volumes = { level: num(f.soundLevelVol, 70), max: num(f.soundMaxVol, 90), drop: num(f.soundDropVol, 60) };
    return c;
  }

  function sound(kind) { playUrl(cfg, cfg.sounds[kind], cfg.volumes[kind]); }
  function threshold(level) { return Math.max(1, Math.round(cfg.base * Math.pow(cfg.growth, level - 1))); }
  function nameOf(level) { return cfg.names[level - 1] || (cfg.levelWord + " " + level); }
  function isFull() { return state.level >= cfg.levels && state.points >= threshold(state.level); }

  // ---------------------------------------------------------------------------
  // The meter
  // ---------------------------------------------------------------------------
  function gain(points) {
    if (state.paused || !(points > 0)) return;
    var before = state.level;
    state.lastGain = now();
    state.points += points;
    while (state.level < cfg.levels && state.points >= threshold(state.level)) {
      state.points -= threshold(state.level);
      state.level++;
    }
    if (state.level >= cfg.levels) state.points = Math.min(state.points, threshold(state.level));
    save(); render();
    if (state.level > before) {
      showBanner();
      sound(state.level >= cfg.levels ? "max" : "level");
    }
  }
  function setLevel(level) {
    level = clamp(Math.floor(level), 1, cfg.levels);
    var before = state.level;
    state.level = level; state.points = 0; state.lastGain = now();
    save(); render();
    if (level > before) { showBanner(); sound(level >= cfg.levels ? "max" : "level"); }
    else if (level < before) sound("drop");
  }
  function reset() { state.level = 1; state.points = 0; state.lastGain = 0; save(); render(); hideBanner(); }

  function decayTick(t) {
    if (!lastTick) { lastTick = t; return; }
    var dt = t - lastTick; lastTick = t;
    if (state.paused || cfg.decay <= 0 || dt <= 0) return;
    if (t - state.lastGain < cfg.decayDelayMs) return;
    if (state.level === 1 && state.points <= 0) return;
    var loss = cfg.decay * dt / 60000;
    var before = state.level;
    state.points -= loss;
    while (state.points < 0) {
      if (cfg.canDrop && state.level > 1) { state.level--; state.points += threshold(state.level); }
      else { state.points = 0; break; }
    }
    if (state.level < before) sound("drop");
    save(); render();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function onMessage(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var low = text.toLowerCase(), base = cfg.command.toLowerCase();
    if (low === base || low.indexOf(base + " ") === 0) { handleCommand(data, text.slice(base.length).replace(/^\s+|\s+$/g, "")); return; }
    if (!(cfg.pMessage > 0) || !text) return;
    if (cfg.ignoreCommands && text.charAt(0) === "!") return;
    var who = String(data.nick || data.displayName || "").toLowerCase();
    if (who && cfg.ignoreNames.indexOf(who) !== -1) return;
    var t = now();
    if (who) {
      if (lastMsg[who] !== undefined && t - lastMsg[who] < cfg.cooldownMs) return;
      lastMsg[who] = t;
    }
    gain(cfg.pMessage);
  }
  function onSub(event) {
    event = event || {};
    // A gift bomb is one announcement with the real size, then one follow-up per recipient
    // carrying a streak figure such as 170. Only the announcement counts.
    if (event.isCommunityGift || event.playedAsCommunityGift) return;
    if (bool(event.bulkGifted, false)) { gain(cfg.pGift * Math.max(0, Math.floor(num(event.amount, 0)))); return; }
    if (bool(event.gifted, false)) { gain(cfg.pGift); return; }
    var t = String(event.tier || "").toLowerCase();
    gain(cfg.pSub[t === "3000" || t === "3" ? 2 : (t === "2000" || t === "2" ? 1 : 0)]);
  }
  function onCheer(event) { gain(cfg.pBits * Math.max(0, num(event && event.amount, 0)) / 100); }
  function onTip(event) { gain(cfg.pTip * Math.max(0, num(event && event.amount, 0))); }

  function handleCommand(data, rest) {
    if (!rest) { popTitle(); return; }                      // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var args = rest.split(/\s+/), verb = args.shift().toLowerCase(), n = parseFloat(args[0]);
    switch (verb) {
      case "add": if (!isNaN(n) && n > 0) gain(n); break;
      case "level": if (!isNaN(n)) setLevel(n); break;
      case "reset": reset(); break;
      case "pause": state.paused = true; save(); render(); break;
      case "resume": state.paused = false; state.lastGain = now(); save(); render(); break;
    }
  }
  function handleButton(field) {
    switch (field) {
      case "btnAdd": gain(cfg.addAmount); break;
      case "btnLevelUp": setLevel(state.level + 1); break;
      case "btnLevelDown": setLevel(state.level - 1); break;
      case "btnReset": reset(); break;
      case "btnPause": state.paused = true; save(); render(); break;
      case "btnResume": state.paused = false; state.lastGain = now(); save(); render(); break;
      case "test_soundLevel": sound("level"); break;
      case "test_soundMax": sound("max"); break;
      case "test_soundDrop": sound("drop"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      s.level = clamp(Math.floor(num(saved.level, 1)), 1, cfg.levels);
      s.points = clamp(num(saved.points, 0), 0, threshold(s.level));
      s.lastGain = num(saved.lastGain, 0);
      s.paused = bool(saved.paused, false);
    }
    return s;
  }
  function showBanner() {
    if (!cfg.bannerText) return;
    el.banner.textContent = cfg.bannerText.split("{name}").join(nameOf(state.level));
    el.banner.hidden = false;
    if (el.app.classList) { el.app.classList.remove("levelup"); void el.app.offsetWidth; el.app.classList.add("levelup"); }
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideBanner, cfg.bannerMs);
  }
  function hideBanner() {
    if (bannerTimer) { clearTimeout(bannerTimer); bannerTimer = null; }
    el.banner.hidden = true;
    if (el.app.classList) el.app.classList.remove("levelup");
  }
  function popTitle() {
    if (!el.title || !el.title.classList) return;
    el.title.classList.remove("pop"); void el.title.offsetWidth; el.title.classList.add("pop");
  }
  function buildPips() {
    if (pipCount === cfg.levels) return;
    while (el.pips.firstChild) el.pips.removeChild(el.pips.firstChild);
    for (var i = 0; i < cfg.levels; i++) {
      var p = document.createElement("span"); p.className = "hy-pip"; el.pips.appendChild(p);
    }
    pipCount = cfg.levels;
  }
  function render() {
    if (!el.app) return;
    var need = threshold(state.level), full = isFull();
    el.title.textContent = cfg.title; el.title.hidden = !cfg.showTitle || !cfg.title;
    el.name.textContent = nameOf(state.level);
    el.num.textContent = cfg.levelWord + " " + state.level;
    el.num.hidden = !cfg.showLevelNumber;
    el.fill.style.width = clamp(state.points / need * 100, 0, 100) + "%";
    el.points.textContent = full ? cfg.maxText : Math.floor(state.points) + " / " + need;
    el.points.hidden = !cfg.showPoints;
    el.pips.hidden = !cfg.showPips;
    buildPips();
    for (var i = 0; i < el.pips.children.length; i++) {
      el.pips.children[i].className = "hy-pip" + (i < state.level ? " on" : "") + (i === state.level - 1 && !full ? " current" : "");
    }
    el.app.classList.toggle("full", full);
    el.app.classList.toggle("paused", state.paused);
    el.status.textContent = state.paused ? "paused" : "";
    el.status.hidden = !state.paused;
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "hy-font-link");
    var s = el.app.style;
    s.setProperty("--hy-size", cfg.textSize + "cqw");
    s.setProperty("--hy-title", cfg.titleScale);
    s.setProperty("--hy-bar", cfg.barHeight + "em");
  }
  function bind() {
    var ids = { root: "hy-root", app: "hy-app", title: "hy-title", name: "hy-name", num: "hy-num", fill: "hy-fill",
      points: "hy-points", pips: "hy-pips", banner: "hy-banner", status: "hy-status" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  setInterval(function () { if (loaded) decayTick(now()); }, TICK_MS);

  window.addEventListener("onWidgetLoad", function (obj) {
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    pipCount = -1; lastMsg = {};
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      state = restore(saved);
      loaded = true; lastTick = now();
      hideBanner();
      render();
      if (!saved) save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "hype", d.listener, ev);
    switch (d.listener) {
      case "message": onMessage(ev.data); break;
      case "subscriber-latest": onSub(ev); break;
      case "cheer-latest": onCheer(ev); break;
      case "tip-latest": onTip(ev); break;
      case "follower-latest": gain(cfg.pFollow); break;
      case "raid-latest": gain(cfg.pRaid); break;
      case "widget-button": handleButton(ev.field); break;
    }
  });
})();
