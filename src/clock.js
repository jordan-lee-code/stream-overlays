/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Subathon clock. StreamElements custom widget logic.
 *
 * A countdown that the stream keeps topping up. Subs, gifted subs, bits, tips, follows
 * and raids each add a set amount of time, a power-up can multiply what comes in for a
 * while, sleep mode can slow it overnight, and an optional cap holds the whole subathon
 * to the number of hours that was promised.
 *
 * Subs and bits are not read from StreamElements a second time. The Sub Incentives
 * module that sits underneath this widget has already worked out how many subs an event
 * was worth, and it announces that as "subgoals:counted", so the clock and the goals can
 * never disagree about a gift bomb. Tips, follows and raids come straight from their own
 * StreamElements events.
 *
 * Time that cannot go on the clock (because of the cap, a lock, or the clock having
 * ended) is banked rather than thrown away, so nobody's money ever vanishes quietly.
 */
(function () {
  "use strict";

  var STORE_KEY = "subathon_v1";
  var TICK_MS = 200;

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
    pastelgoth: { panel: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", track: "rgba(255, 255, 255, 0.18)", alarm: "#C96A8E", font: "Quicksand" }
  };

  var el = {};
  var cfg = {};
  var theme = null;
  var state = blankState();
  var loaded = false;
  var feedTimer = null;
  var audioMuted = false;

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------
  function now() { return Date.now(); }
  function str(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function bool(v, d) {
    if (v === undefined || v === null) return d;
    if (typeof v === "string") return v === "true";
    return !!v;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return document.getElementById(id); }

  // "2h 30s", "10m", "1:30:00", "5:00" (minutes and seconds) or a bare number of
  // minutes. Returns milliseconds, or NaN when it is not a time at all.
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
  function durationField(v, d) {
    var ms = parseDuration(v);
    return isNaN(ms) ? d : ms;
  }
  // 100:00:00 style, hours not capped at a day, counting up to the next whole second so
  // the clock reads 00:00:00 only once it is truly empty.
  function formatClock(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return pad(h) + ":" + pad(m) + ":" + pad(s % 60);
  }
  // 5:00 or 1:30:00, for the short chips and the feed line.
  function formatShort(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s % 60) : m + ":" + pad(s % 60);
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function trimMult(m) { return String(Math.round(m * 100) / 100); }

  function blankState() {
    return {
      remaining: 0, at: 0, running: false, ended: false, locked: false,
      added: 0, capBase: 0, banked: 0, sleeping: false, power: null, last: null
    };
  }

  // ---------------------------------------------------------------------------
  // The clock
  // ---------------------------------------------------------------------------
  function remainingNow() {
    if (!state.running) return state.remaining;
    return Math.max(0, state.remaining - (now() - state.at));
  }
  // Fold the time that has passed into the stored value, so a change starts from "now".
  function settle() {
    state.remaining = remainingNow();
    state.at = now();
  }
  function room() {
    if (!cfg.capEnabled || isNaN(cfg.capMs)) return Infinity;
    return Math.max(0, cfg.capMs - state.capBase - state.added);
  }
  function powerActive() {
    var p = state.power;
    if (!p) return false;
    if (p.until && now() >= p.until) { state.power = null; return false; }
    return true;
  }
  function multiplier() {
    var m = 1;
    if (powerActive()) m *= state.power.mult;
    if (state.sleeping) m *= cfg.sleepMult;
    return m;
  }

  function credit(ms) {
    state.remaining += ms;
    state.added += ms;
    if (state.ended) { state.ended = false; state.running = true; state.at = now(); }
  }

  // Time that comes from an event. Subject to the multiplier, the lock and the cap.
  function earn(baseMs, text) {
    if (!(baseMs > 0)) return;
    var power = powerActive();
    var mult = multiplier();
    var ms = Math.round(baseMs * mult);
    if (ms <= 0) return;
    settle();
    var blocked = state.locked || (state.ended && cfg.lockAtZero);
    var take = 0;
    if (!blocked) take = Math.min(ms, room());
    if (take > 0) credit(take);
    if (ms - take > 0) state.banked += ms - take;
    if (power && state.power && state.power.left > 0) {
      state.power.left--;
      if (state.power.left <= 0) state.power = null;
    }
    state.last = { ms: ms, taken: take, text: text, mult: mult, at: now() };
    save(); render(); showFeed(); playSound("add");
  }

  // Time added or taken away by hand. The streamer is the authority, so it ignores the
  // lock and the cap, but it still counts against the cap's allowance.
  function adjust(ms, text) {
    if (!ms) return;
    settle();
    if (ms > 0) credit(ms);
    else {
      var cut = Math.min(-ms, state.remaining);
      state.remaining -= cut;
      state.added -= cut;
    }
    state.last = { ms: ms, taken: ms, text: text, mult: 1, at: now() };
    checkEnd();
    save(); render(); showFeed(); playSound("add");
  }

  function checkEnd() {
    if (state.running && remainingNow() <= 0) {
      state.remaining = 0; state.running = false; state.ended = true; state.at = now();
      playSound("zero");
      save();
    } else if (!state.running && !state.ended && state.remaining <= 0 && loaded) {
      state.ended = true; save();
    }
  }

  function applyStart() {
    var start = durationField(cfg.start, 24 * 3600000);
    state.remaining = start; state.at = now(); state.running = false; state.ended = start <= 0;
    state.added = 0; state.capBase = start; state.banked = 0; state.power = null;
    state.sleeping = false; state.last = null;
    save(); render(); showFeed();
  }
  function resetCap() {
    settle();
    state.added = 0; state.capBase = state.remaining;
    save(); render();
  }
  function resume() {
    if (state.ended || state.running) return;
    settle();
    if (state.remaining <= 0) return;
    state.running = true; state.at = now();
    save(); render(); playSound("add");
  }
  function pause() {
    if (!state.running) return;
    settle(); state.running = false;
    save(); render();
  }
  function release() {
    settle();
    var give = Math.min(state.banked, room());
    if (!(give > 0)) return;
    state.banked -= give; credit(give);
    state.last = { ms: give, taken: give, text: "released from the bank", mult: 1, at: now() };
    save(); render(); showFeed(); playSound("add");
  }
  function startPower(mult, durMs, events) {
    if (!(mult > 0)) return;
    var until = durMs > 0 ? now() + durMs : 0;
    var left = events > 0 ? Math.floor(events) : 0;
    if (!until && !left) { until = now() + durationField(cfg.powerDuration, 1800000); }
    state.power = { mult: mult, until: until, left: left };
    save(); render(); playSound("power");
  }
  function stopPower() { state.power = null; save(); render(); }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function who(name, fallback) { return String(name || fallback); }

  function onCounted(detail) {
    if (!detail) return;
    if (detail.kind === "sub") {
      var n = Math.max(1, Math.floor(num(detail.count, 1)));
      var tier = detail.tier === 3 ? 3 : (detail.tier === 2 ? 2 : 1);
      var per = detail.gifted ? cfg.gift[tier - 1] : cfg.sub[tier - 1];
      var name = who(detail.who, "Someone");
      var text = detail.gifted ? name + " gifted " + plural(n, "sub", "subs") : name + " subscribed";
      earn(per * n, text);
    } else if (detail.kind === "bits") {
      var bits = num(detail.amount, 0);
      earn(cfg.bits * bits / 100, who(detail.who, "Someone") + " cheered " + bits + " bits");
    }
  }
  function onTip(event) {
    var amount = num(event && event.amount, 0);
    if (amount > 0) earn(cfg.tip * amount, who(event.name || event.username, "Someone") + " tipped");
  }
  function onFollow(event) {
    earn(cfg.follow, who(event && (event.name || event.username), "Someone") + " followed");
  }
  function onRaid(event) {
    earn(cfg.raid, who(event && (event.name || event.username), "Someone") + " raided");
  }

  // ---------------------------------------------------------------------------
  // Chat commands
  // ---------------------------------------------------------------------------
  function rolesOf(data) {
    var r = { broadcaster: false, mod: false };
    var badges = data.badges || [];
    for (var i = 0; i < badges.length; i++) {
      var t = String(badges[i].type || "").toLowerCase();
      if (t === "broadcaster") r.broadcaster = true;
      else if (t === "moderator") r.mod = true;
    }
    var tags = data.tags || {};
    if (tags.mod === "1" || tags.mod === 1) r.mod = true;
    if (typeof tags.badges === "string" && /broadcaster/.test(tags.badges)) r.broadcaster = true;
    return r;
  }
  function canManage(roles) {
    if (roles.broadcaster) return true;
    return cfg.whoCanManage === "mods" && roles.mod;
  }

  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase();
    var low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var roles = rolesOf(data);
    if (!canManage(roles)) return;
    var args = text.slice(base.length).replace(/^\s+|\s+$/g, "").split(/\s+/);
    var verb = (args.shift() || "").toLowerCase();
    if (args.length === 1 && args[0] === "") args = [];
    var rest = args.join(" ");
    var ms;
    switch (verb) {
      case "": showFeed(true); break;
      case "add": ms = parseDuration(rest); if (!isNaN(ms) && ms > 0) adjust(ms, "added by hand"); break;
      case "subtract": case "remove":
        ms = parseDuration(rest); if (!isNaN(ms) && ms > 0) adjust(-ms, "taken off by hand"); break;
      case "set":
        ms = parseDuration(rest);
        if (!isNaN(ms)) { settle(); state.remaining = ms; state.ended = ms <= 0; if (ms <= 0) state.running = false; save(); render(); }
        break;
      case "pause": pause(); break;
      case "resume": case "start": resume(); break;
      case "lock": state.locked = true; save(); render(); break;
      case "unlock": state.locked = false; save(); render(); break;
      case "release": release(); break;
      case "capreset": resetCap(); break;
      case "reset": if (roles.broadcaster) applyStart(); break;
      case "sleep": state.sleeping = true; save(); render(); break;
      case "wake": state.sleeping = false; save(); render(); break;
      case "powerup": case "power":
        if ((args[0] || "").toLowerCase() === "off" || (args[0] || "").toLowerCase() === "stop") { stopPower(); break; }
        var mult = num(args[0], NaN);
        if (isNaN(mult)) mult = cfg.powerMult;
        var dur = args[1] !== undefined ? parseDuration(args[1]) : NaN;
        var ev = args[2] !== undefined ? parseInt(args[2], 10) : 0;
        startPower(mult, isNaN(dur) ? 0 : dur, isNaN(ev) ? 0 : ev);
        break;
    }
  }

  function handleButton(field) {
    var ms;
    switch (field) {
      case "tmApply": applyStart(); break;
      case "tmResume": resume(); break;
      case "tmPause": pause(); break;
      case "tmAdd": ms = durationField(cfg.manual, NaN); if (!isNaN(ms) && ms > 0) adjust(ms, "added by hand"); break;
      case "tmSubtract": ms = durationField(cfg.manual, NaN); if (!isNaN(ms) && ms > 0) adjust(-ms, "taken off by hand"); break;
      case "tmLock": state.locked = true; save(); render(); break;
      case "tmUnlock": state.locked = false; save(); render(); break;
      case "tmCapReset": resetCap(); break;
      case "tmRelease": release(); break;
      case "tmPowerGo":
        startPower(cfg.powerMult, durationField(cfg.powerDuration, 1800000), cfg.powerEvents);
        break;
      case "tmPowerStop": stopPower(); break;
      case "tmSleep": state.sleeping = true; save(); render(); break;
      case "tmWake": state.sleeping = false; save(); render(); break;
      case "tmTestZero": playSound("zero"); break;
      case "tmTestAdd": playSound("add"); break;
      case "tmTestPower": playSound("power"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Sounds
  // ---------------------------------------------------------------------------
  function playSound(kind) {
    if (audioMuted || typeof Audio === "undefined") return;
    var url = cfg.sounds && cfg.sounds[kind];
    if (!url) return;
    try {
      var a = new Audio(url);
      a.volume = Math.max(0, Math.min(1, cfg.volumes[kind] / 100));
      var p = a.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (e) { /* a sound that will not play is never worth breaking the clock */ }
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------
  function hasStore() {
    return typeof SE_API !== "undefined" && SE_API && SE_API.store && typeof SE_API.store.set === "function";
  }
  function save() {
    if (!hasStore()) return;
    try { SE_API.store.set(STORE_KEY, state); } catch (e) { /* the clock still runs unsaved */ }
  }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      s.remaining = Math.max(0, num(saved.remaining, 0));
      s.at = num(saved.at, now());
      s.running = bool(saved.running, false);
      s.ended = bool(saved.ended, false);
      s.locked = bool(saved.locked, false);
      s.added = num(saved.added, 0);
      s.capBase = num(saved.capBase, s.remaining);
      s.banked = Math.max(0, num(saved.banked, 0));
      s.sleeping = bool(saved.sleeping, false);
      if (saved.power && num(saved.power.mult, 0) > 0) {
        s.power = { mult: num(saved.power.mult, 1), until: num(saved.power.until, 0), left: num(saved.power.left, 0) };
      }
      if (saved.last && typeof saved.last === "object") s.last = saved.last;
    } else {
      var start = durationField(cfg.start, 24 * 3600000);
      s.remaining = start; s.at = now(); s.capBase = start;
    }
    return s;
  }

  // ---------------------------------------------------------------------------
  // Look
  // ---------------------------------------------------------------------------
  function rgba(hex, opacity) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return hex || "transparent";
    var n = parseInt(m[1], 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + Math.max(0, Math.min(1, opacity)) + ")";
  }
  function themeColours() {
    var p = cfg.themePreset !== "custom" ? PRESETS[cfg.themePreset] : null;
    if (p) return p;
    return {
      panel: rgba(cfg.colorPanel, cfg.panelOpacity), text: cfg.cText, accent: cfg.cAccent,
      track: cfg.cTrack, alarm: cfg.cWarn, font: cfg.fontFamily
    };
  }
  function loadFont(name) {
    if (!name || typeof document === "undefined" || !document.head) return;
    var link = byId("subathon-font-link");
    if (!link) {
      link = document.createElement("link");
      link.id = "subathon-font-link"; link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    link.href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(name).replace(/%20/g, "+") + ":wght@400;700;800&display=swap";
  }
  function applyTheme() {
    theme = themeColours();
    var s = el.app.style;
    s.setProperty("--sa-bg", theme.panel);
    s.setProperty("--sa-text", theme.text);
    s.setProperty("--sa-accent", theme.accent);
    s.setProperty("--sa-track", theme.track);
    s.setProperty("--sa-alarm", theme.alarm);
    s.setProperty("--sa-font", '"' + theme.font + '", Georgia, serif');
    s.setProperty("--sa-radius", cfg.radius + "px");
    s.setProperty("--sa-pad", cfg.pad + "em");
    s.setProperty("--sa-clock-size", cfg.clockSize + "cqw");
    s.setProperty("--sa-title-scale", cfg.titleScale);
    s.setProperty("--sa-status-scale", cfg.statusScale);
    s.setProperty("--sa-weight", cfg.weight);
    s.setProperty("--sa-border", cfg.borderWidth + "px solid " + cfg.borderColor);
    s.setProperty("--sa-shadow", cfg.shadow ? "0 0.3em 1.2em rgba(0, 0, 0, 0.45)" : "none");
    var root = el.root.style;
    root.setProperty("--sa-gap", cfg.gap + "px");
    el.root.classList.toggle("goals-first", cfg.order === "goals");
    el.root.classList.toggle("no-motion", !cfg.animate);
    el.goals.hidden = !cfg.showGoals;
    loadFont(theme.font);
  }

  function showFeed(force) {
    if (!el.feed) return;
    var l = state.last;
    if (!l || (!force && now() - l.at > cfg.feedSeconds * 1000)) { el.feed.hidden = true; return; }
    var sign = l.ms >= 0 ? "+" : "-";
    var line = sign + formatShort(Math.abs(l.ms)) + " " + l.text;
    if (l.mult && l.mult !== 1) line += " (x" + trimMult(l.mult) + ")";
    if (l.taken !== undefined && l.ms > 0 && l.taken < l.ms) line += ", " + formatShort(l.ms - l.taken) + " banked";
    el.feed.textContent = line;
    el.feed.hidden = false;
    if (el.feed.classList) { el.feed.classList.remove("pop"); void el.feed.offsetWidth; el.feed.classList.add("pop"); }
    if (feedTimer) clearTimeout(feedTimer);
    feedTimer = setTimeout(function () { feedTimer = null; showFeed(); }, Math.max(500, cfg.feedSeconds * 1000));
  }

  function statusLine() {
    var bits = [];
    if (state.ended) bits.push(cfg.endedText);
    else if (!state.running) bits.push("paused");
    if (state.locked) bits.push("locked");
    if (powerActive()) {
      var p = state.power, extra = "";
      if (p.until) extra = " " + formatShort(Math.max(0, p.until - now()));
      else if (p.left) extra = " " + plural(p.left, "event", "events");
      bits.push("x" + trimMult(p.mult) + " power-up" + extra);
    }
    if (state.sleeping) bits.push("sleep x" + trimMult(cfg.sleepMult));
    if (state.banked > 0) bits.push("banked " + formatShort(state.banked));
    if (cfg.showCap && cfg.capEnabled && !isNaN(cfg.capMs)) bits.push("room " + formatShort(room() === Infinity ? 0 : room()));
    return bits.join(" · ");
  }

  var lastClockText = "";
  function render() {
    if (!el.app) return;
    var rem = remainingNow();
    if (state.running && rem <= 0) checkEnd();
    var text = formatClock(rem);
    if (text !== lastClockText) {
      el.clock.textContent = text;
      lastClockText = text;
    }
    el.app.classList.toggle("long", text.length > 8);
    el.app.classList.toggle("warn", !state.ended && cfg.warnMs > 0 && rem <= cfg.warnMs);
    el.app.classList.toggle("ended", state.ended);
    el.app.classList.toggle("paused", !state.running && !state.ended);
    var status = statusLine();
    el.status.textContent = status;
    el.status.hidden = !status || !cfg.showStatus;
    el.title.textContent = cfg.title;
    el.title.hidden = !cfg.title || !cfg.showTitle;
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  function readConfig(f) {
    f = f || {};
    cfg = {
      command: str(f.tmCommand, "!subathon"),
      whoCanManage: str(f.tmWho, "mods"),
      start: str(f.tmStart, "24:00:00"),
      warnMs: durationField(f.tmWarn, 3600000),
      lockAtZero: bool(f.tmLockAtZero, true),
      endedText: str(f.tmEndedText, "Time's up!"),
      capEnabled: bool(f.tmCapEnabled, false),
      capMs: durationField(f.tmCap, NaN),
      showCap: bool(f.tmShowCap, true),
      sub: [durationField(f.tmSub1, 300000), durationField(f.tmSub2, 600000), durationField(f.tmSub3, 1500000)],
      gift: [durationField(f.tmGift1, 300000), durationField(f.tmGift2, 600000), durationField(f.tmGift3, 1500000)],
      bits: durationField(f.tmBits, 60000),
      tip: durationField(f.tmTip, 60000),
      follow: durationField(f.tmFollow, 0),
      raid: durationField(f.tmRaid, 0),
      powerMult: num(f.tmPowerMult, 2),
      powerDuration: str(f.tmPowerDuration, "30m"),
      powerEvents: Math.max(0, Math.floor(num(f.tmPowerEvents, 0))),
      sleepMult: Math.max(0, num(f.tmSleepMult, 0.5)),
      manual: str(f.tmManual, "10m"),
      title: str(f.tmTitle, "Subathon"),
      showTitle: bool(f.tmShowTitle, true),
      showStatus: bool(f.tmShowStatus, true),
      showGoals: bool(f.tmShowGoals, true),
      order: str(f.tmOrder, "clock"),
      clockSize: Math.max(4, num(f.tmClockSize, 15)),
      titleScale: Math.max(0.2, num(f.tmTitleScale, 0.32)),
      statusScale: Math.max(0.1, num(f.tmStatusScale, 0.2)),
      weight: Math.max(100, Math.min(900, num(f.tmWeight, 800))),
      gap: Math.max(0, num(f.tmGap, 12)),
      pad: Math.max(0, num(f.tmPad, 0.12)),
      feedSeconds: Math.max(1, num(f.tmFeedSeconds, 6)),
      animate: bool(f.tmAnimate, true),
      themePreset: str(f.themePreset, "glass"),
      colorPanel: str(f.colorPanel, "#000000"),
      panelOpacity: num(f.panelOpacity, 0.55),
      radius: Math.max(0, num(f.radius, 24)),
      borderWidth: Math.max(0, num(f.borderWidth, 0)),
      borderColor: str(f.borderColor, "#FFFFFF"),
      shadow: bool(f.shadow, false),
      fontFamily: str(f.fontFamily, "BioRhyme"),
      cText: str(f.tmText, "#FFFFFF"),
      cAccent: str(f.tmAccent, "#FFFFFF"),
      cTrack: str(f.tmTrack, "rgba(255, 255, 255, 0.2)"),
      cWarn: str(f.tmWarnColour, "#D64545"),
      sounds: { add: str(f.tmSoundAdd, ""), zero: str(f.tmSoundZero, ""), power: str(f.tmSoundPower, "") },
      volumes: { add: num(f.tmVolAdd, 60), zero: num(f.tmVolZero, 80), power: num(f.tmVolPower, 60) },
      muted: bool(f.tmMute, false),
      debug: bool(f.tmDebug, false)
    };
    audioMuted = cfg.muted;
  }

  function bind() {
    var ids = { root: "subathon-root", app: "subathon-app", title: "subathon-title", clock: "subathon-clock",
      status: "subathon-status", feed: "subathon-feed", goals: "subathon-goals" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  function onLoad(detail) {
    readConfig((detail && detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyTheme();
    var finish = function (saved) {
      state = restore(saved);
      loaded = true;
      checkEnd();
      render(); showFeed();
      if (!saved) save();
    };
    if (hasStore() && typeof SE_API.store.get === "function") {
      var got = SE_API.store.get(STORE_KEY);
      if (got && typeof got.then === "function") got.then(finish, function () { finish(null); });
      else finish(got);
    } else finish(null);
  }

  window.addEventListener("onWidgetLoad", function (obj) { onLoad(obj && obj.detail); });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    if (cfg.debug && typeof console !== "undefined" && console.log) {
      try { console.log("[subathon]", d.listener, JSON.stringify(ev)); } catch (e) { /* unprintable payloads are skipped */ }
    }
    switch (d.listener) {
      case "message": handleChat(ev.data); break;
      case "tip-latest": onTip(ev); break;
      case "follower-latest": onFollow(ev); break;
      case "raid-latest": onRaid(ev); break;
      case "widget-button": handleButton(ev.field); break;
    }
  });
  window.addEventListener("subgoals:counted", function (obj) { if (loaded) onCounted(obj && obj.detail); });

  setInterval(function () { if (loaded) render(); }, TICK_MS);
})();
