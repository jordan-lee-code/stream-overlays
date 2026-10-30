/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Stream Goals Overlay. StreamElements custom widget logic. */
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
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var args = text.slice(base.length).replace(/^\s+|\s+$/g, "").split(/\s+/);
    var verb = (args.shift() || "").toLowerCase();
    if (!verb) { popTitle(); return; }                     // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var kind = (args[0] || "").toLowerCase(), n = parseFloat(args[1]);
    if (KINDS.indexOf(kind) === -1) kind = "";
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
  function shown(kind, n) {
    if (kind === "tips") return cfg.currency + (n % 1 !== 0 ? n.toFixed(2) : withCommas(n));
    return withCommas(n);
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
