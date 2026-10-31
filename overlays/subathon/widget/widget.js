/* ---- Sub Incentives module (sub-goals-overlay), unchanged ---- */
/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Sub Incentives. StreamElements custom widget logic.
 *
 * A rounded, softly transparent black panel that lists the sub goals chat is
 * working towards ("5 subs unlocks karaoke") with a progress bar under each one.
 * Goals are added live by the streamer or a trusted mod with
 * `!incentive add 15 chat confessions`, and every sub that lands (new, resub or
 * gifted) nudges all the bars forward at once. When a goal is reached it glows for
 * a few moments, then fades away and makes room for the next one.
 *
 * It leans on nothing beyond the two custom events and SE_API.store, so
 * dev/harness.js can drive the exact file in a plain browser.
 */
(function () {
  "use strict";

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

  var STORE_KEY = "sub_goals_v1";
  var LEAVE_MS = 400;        // matches incentive-leave in widget.css
  var STAGGER_MS = 300;      // gap between goals that unlock from one gift bomb
  // The beats of the bits animation, in milliseconds. A short lead-in lets the
  // "+300 bits" chip land before the bar starts moving; the rest scales with the
  // Bits calculation field, so a longer calculation is a calmer one all through.
  var BITS_START_MS = 300;
  var BITS_CONVERT_GAP_MS = 250;
  // The Text size field is the size in a box this wide; the real size is the same
  // share of whatever width the box actually has, so the panel scales with it.
  var REF_WIDTH = 620;
  var MIN_FIT = 55;                 // smallest a long name will shrink to, in percent
  var MAX_TARGET = 100000;

  // ---- runtime state ----
  var cfg = {};
  var subs = 0;
  var tracking = true;       // while false, incoming subs and bits are ignored
  var bitsLeft = 0;          // bits cheered that have not yet added up to a whole sub
  var tipLeft = 0;           // tipped cents that have not yet added up to a whole sub
  var meter = null;          // what the strip below is counting, bits or tips
  var incentives = [];       // { id, target, name, unlocking, done, delay, timer }
  var nextId = 1;
  var rows = {};             // id -> { li, name, count, fill, countText }
  var leavingCount = 0;
  var el = {};
  var saveTimer = null;
  var popTimer = null;
  var bitsTimers = [];
  var bitsIntervals = [];
  var fitTimer = null;
  var fitSoon = null;
  var transitionBound = false;
  var thanksTimer = null;

  // A command word is a single lower-case token, so "Add" and " add " both work.
  function word(v, dflt) { return str(v, dflt).toLowerCase().trim().split(/\s+/)[0]; }

  function readConfig(f) {
    f = f || {};
    cfg = {
      themePreset: str(f.themePreset, "glass"),
      cmd: str(f.command, "!incentive").toLowerCase().trim(),
      whoCanManage: str(f.whoCanManage, "mods"),
      verbs: {
        add: word(f.verbAdd, "add"),
        remove: word(f.verbRemove, "remove"),
        clear: word(f.verbClear, "clear"),
        subs: word(f.verbSubs, "subs"),
        bits: word(f.verbBits, "bits"),
        tip: word(f.verbTip, "tip"),
        reset: word(f.verbReset, "reset"),
        start: word(f.verbStart, "start"),
        stop: word(f.verbStop, "stop"),
        list: word(f.verbList, "list")
      },

      countNewSubs: bool(f.countNewSubs, true),
      countGifts: bool(f.countGifts, true),
      startTracking: bool(f.startTracking, true),
      startSubs: Math.max(0, Math.round(num(f.startSubs, 0))),
      bitsPerSub: Math.max(0, Math.round(num(f.bitsPerSub, 500))),
      showBits: bool(f.showBits, true),
      bitsCalcMs: Math.round(clamp(num(f.bitsCalcSeconds, 3), 0.2, 15) * 1000),
      bitsStripMs: Math.round(clamp(num(f.bitsStripSeconds, 2), 0.5, 30) * 1000),
      bitsLabel: str(f.bitsLabel, "bits"),
      // Tips are worked in whole cents so two tips never add up wrongly. A rate of 0 switches them off.
      tipCentsPerSub: Math.max(0, Math.round(num(f.tipsPerSub, 5) * 100)),
      tipSymbol: txt(f.tipSymbol, "$"),
      tipSymbolAfter: bool(f.tipSymbolAfter, false),
      tipDecimalComma: bool(f.tipDecimalComma, false),

      maxVisible: Math.max(1, Math.round(num(f.maxVisible, 4))),
      goalOrder: str(f.goalOrder, "target"),
      keepUnlocked: bool(f.keepUnlocked, true),
      unlockSeconds: Math.max(0, num(f.unlockSeconds, 8)),
      showWaitingCounts: bool(f.showWaitingCounts, true),
      maxNameLength: Math.round(clamp(num(f.maxNameLength, 60), 5, 200)),

      title: str(f.title, ""),
      showTotal: bool(f.showTotal, true),
      unitSingular: str(f.unitSingular, "sub"),
      unitPlural: str(f.unitPlural, "subs"),
      unlockedText: txt(f.unlockedText, "Unlocked!"),
      doneText: txt(f.doneText, "- unlocked"),
      pausedText: txt(f.pausedText, "(paused)"),

      look: {
        panel: str(f.colorPanel, "#000000"),
        opacity: clamp(num(f.panelOpacity, 0.55), 0, 1),
        radius: Math.max(0, num(f.radius, 24)),
        padV: Math.max(0, num(f.paddingV, 0.55)),
        padH: Math.max(0, num(f.paddingH, 0.7)),
        borderW: Math.max(0, num(f.borderWidth, 0)),
        borderC: str(f.borderColor, "#FFFFFF"),
        shadow: bool(f.shadow, false),
        vAlign: str(f.vAlign, "top"),
        font: str(f.fontFamily, "BioRhyme"),
        size: clamp(num(f.textSize, 40), 12, 120),
        lineSpacing: clamp(num(f.lineSpacing, 1.25), 0.9, 2.5),
        text: str(f.cText, "#FFFFFF"),
        nameWeight: str(f.nameWeight, "700"),
        waiting: str(f.colorWaiting, "#FFFFFF"),
        waitingWeight: str(f.waitingWeight, "400"),
        activeScale: clamp(num(f.activeScale, 1.3), 0.5, 3),
        waitingScale: clamp(num(f.waitingScale, 75), 30, 120) / 100,
        done: str(f.colorDone, "#FFFFFF"),
        strikeDone: bool(f.strikeDone, true),
        textShadow: bool(f.textShadow, false),
        headingScale: clamp(num(f.headingScale, 1.5), 0.6, 4),
        titleWeight: str(f.titleWeight, "800"),
        titleColor: str(f.colorTitle, "#FFFFFF"),
        titleFont: bool(f.titleOwnFont, false) ? str(f.titleFont, "BioRhyme") : "",
        totalWeight: str(f.totalWeight, "800"),
        totalColor: str(f.colorTotal, "#FFFFFF"),
        totalFont: bool(f.totalOwnFont, false) ? str(f.totalFont, "BioRhyme") : "",
        accent: str(f.cAccent, "#FFFFFF"),
        track: str(f.cTrack, "#FFFFFF"),
        trackOpacity: clamp(num(f.trackOpacity, 0.2), 0, 1),
        glow: str(f.colorGlow, "#FFFFFF"),
        pausedScale: clamp(num(f.pausedScale, 0.6), 0.3, 1.5),
        thanksScale: clamp(num(f.thanksScale, 0.85), 0.4, 3),
        thanksWeight: str(f.thanksWeight, "700"),
        thanksColor: str(f.colorThanks, "#FFFFFF"),
        barH: clamp(num(f.barHeight, 0.7), 0.2, 2),
        rowGap: Math.max(0, num(f.rowGap, 0.9)),
        animate: bool(f.animate, true),
        fillSeconds: clamp(num(f.fillSeconds, 0.9), 0, 10)
      },
      showThanks: bool(f.showThanks, true),
      thanksText: txt(f.thanksText, "Thank you for your generosity! <3"),
      thanksBar: bool(f.thanksBar, false),
      sounds: {
        enabled: !bool(f.mute, false),
        replace: bool(f.goalReplacesSound, true),
        sub: { url: str(f.subSound, ""), vol: clamp(num(f.subSoundVolume, 70), 0, 100) },
        bits: { url: str(f.bitsSound, ""), vol: clamp(num(f.bitsSoundVolume, 70), 0, 100) },
        goal: { url: str(f.goalSound, ""), vol: clamp(num(f.goalSoundVolume, 80), 0, 100) }
      },
      debug: bool(f.debug, false)
    };
  }

  // The sub or bits sound steps aside for the goal sound, but only when there is a
  // goal sound to play, so choosing none never leaves a goal-reaching sub silent.
  function goalSoundTakesOver(unlocked) {
    return unlocked > 0 && cfg.sounds.replace && cfg.sounds.enabled && !!cfg.sounds.goal.url;
  }

  // A sound is just a file the streamer uploaded into the widget settings. Each
  // play makes a fresh Audio, so quick-fire subs can overlap rather than cut each
  // other off, and a browser that refuses to autoplay simply stays quiet.
  function playSound(kind) {
    var s = cfg.sounds;
    if (!s || !s.enabled || !s[kind] || !s[kind].url) return;
    if (typeof Audio === "undefined") return;
    try {
      var a = new Audio(s[kind].url);
      a.volume = clamp(s[kind].vol / 100, 0, 1);
      var p = a.play();
      if (p && typeof p.catch === "function") p.catch(function () { /* autoplay refused */ });
    } catch (e) { /* sound is best-effort */ }
  }

  function unit(n) { return n === 1 ? cfg.unitSingular : cfg.unitPlural; }

  var ALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" };

  /* Style presets. The same twenty-two, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. Custom uses the colour pickers instead. */
  var PRESETS = {
    glass: { panel: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.2)", glow: "#FFFFFF", font: "BioRhyme" },
    frost: { panel: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", track: "rgba(0, 0, 0, 0.14)", glow: "#1B2130", font: "BioRhyme" },
    midnight: { panel: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#89AFFF", track: "rgba(127, 168, 255, 0.22)", glow: "#89AFFF", font: "BioRhyme" },
    sunset: { panel: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", track: "rgba(255, 154, 90, 0.24)", glow: "#FF9A5A", font: "BioRhyme" },
    forest: { panel: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", track: "rgba(111, 214, 160, 0.22)", glow: "#6FD6A0", font: "BioRhyme" },
    ocean: { panel: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", track: "rgba(76, 211, 224, 0.22)", glow: "#4CD3E0", font: "BioRhyme" },
    rose: { panel: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF98BE", track: "rgba(255, 143, 184, 0.24)", glow: "#FF98BE", font: "BioRhyme" },
    neon: { panel: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", track: "rgba(0, 240, 255, 0.2)", glow: "#00F0FF", font: "BioRhyme" },
    cosycabin: { panel: "#F5ECD6", text: "#57442E", accent: "#7C6142", track: "rgba(0, 0, 0, 0.11)", glow: "#7C6142", font: "Chicle" },
    pastel: { panel: "#FFF6E9", text: "#6B4F3A", accent: "#BF684C", track: "rgba(0, 0, 0, 0.11)", glow: "#BF684C", font: "Baloo 2" },
    celestial: { panel: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", track: "rgba(255, 255, 255, 0.18)", glow: "#E8C06B", font: "Cinzel" },
    pastelgoth: { panel: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", track: "rgba(255, 255, 255, 0.18)", glow: "#C8B6E2", font: "Quicksand" },
    pastelpink: { panel: "#FFE3EC", text: "#6A2E4B", accent: "#BF5179", track: "rgba(106, 46, 75, 0.14)", glow: "#BF5179", font: "Fredoka" },
    pastelsage: { panel: "#DEEBD8", text: "#2B4636", accent: "#4A7A5A", track: "rgba(43, 70, 54, 0.14)", glow: "#4A7A5A", font: "Fredoka" },
    faegreen: { panel: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", track: "rgba(238, 245, 218, 0.2)", glow: "#C9E265", font: "Almendra" },
    pride: { panel: "rgba(194, 168, 154, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", glow: "#1A1426", font: "Fredoka", flag: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #E50000, #FF8D00, #FFEE00, #028121, #004CFF, #770088)" },
    trans: { panel: "rgba(185, 201, 225, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", glow: "#1A1426", font: "Fredoka", flag: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"], bgimg: "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)" },
    bi: { panel: "rgba(117, 39, 142, 0.9)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.24)", glow: "#FFFFFF", font: "Fredoka", flag: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"], bgimg: "linear-gradient(135deg, #D60270, #D60270, #9B4F96, #0038A8, #0038A8)" },
    pan: { panel: "rgba(181, 142, 132, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", glow: "#1A1426", font: "Fredoka", flag: ["#FF218C", "#FFD800", "#21B1FF"], bgimg: "linear-gradient(135deg, #FF218C, #FFD800, #21B1FF)" },
    enby: { panel: "rgba(212, 202, 192, 0.9)", text: "#1A1426", accent: "#2D2D2D", track: "rgba(26, 20, 38, 0.34)", glow: "#2D2D2D", font: "Fredoka", flag: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #FFF433, #FFFFFF, #9B59D0, #2D2D2D)" },
    lesbian: { panel: "rgba(232, 167, 169, 0.9)", text: "#1A1426", accent: "#1A1426", track: "rgba(26, 20, 38, 0.34)", glow: "#1A1426", font: "Fredoka", flag: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.40), rgba(255, 255, 255, 0.40)), linear-gradient(135deg, #D52D00, #EF7627, #FF9A56, #FFFFFF, #D162A4, #B55690, #A30262)" },
    ace: { panel: "rgba(202, 187, 202, 0.9)", text: "#1A1426", accent: "#000000", track: "rgba(26, 20, 38, 0.34)", glow: "#000000", font: "Fredoka", flag: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"], bgimg: "linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), linear-gradient(135deg, #000000, #A3A3A3, #FFFFFF, #800080)" }
  };

  // The colours the panel is actually drawn with: a preset's own, or the pickers'
  // when the preset is Custom.
  // A flag is a list of stripes, top to bottom. A bar can wear it as horizontal bands.
  function flagGradient(stripes) {
    var n = stripes.length, parts = [];
    for (var i = 0; i < n; i++) parts.push(stripes[i] + " " + (i * 100 / n) + "% " + ((i + 1) * 100 / n) + "%");
    return "linear-gradient(180deg, " + parts.join(", ") + ")";
  }

  function themeColours() {
    var L = cfg.look;
    if (cfg.themePreset === "custom") {
      return {
        panel: rgba(L.panel, L.opacity), text: L.text, waiting: L.waiting, done: L.done,
        title: L.titleColor, total: L.totalColor, thanks: L.thanksColor, accent: L.accent,
        track: rgba(L.track, L.trackOpacity), glow: rgba(L.glow, 0.7), borderC: L.borderC, font: L.font, flag: ""
      };
    }
    var P = PRESETS[cfg.themePreset] || PRESETS.glass;
    return {
      panel: P.panel, text: P.text, waiting: P.text, done: P.text, title: P.text, total: P.text,
      thanks: P.text, accent: P.accent, track: P.track, glow: rgba(P.glow, 0.7), borderC: P.accent, font: P.font,
      flag: P.flag ? flagGradient(P.flag) : "", bgimg: P.bgimg || ""
    };
  }

  function applyTheme() {
    var root = el.app;
    var L = cfg.look;
    var T = themeColours();
    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--panel", T.panel);
    set("--panel-img", T.bgimg || "none");
    set("--radius", L.radius + "px");
    set("--pad-v", L.padV + "em");
    set("--pad-h", L.padH + "em");
    set("--border-w", L.borderW + "px");
    set("--border-c", T.borderC);
    set("--shadow", L.shadow ? "0 0.25em 0.9em rgba(0, 0, 0, 0.45)" : "none");
    set("align-items", ALIGN[L.vAlign] || ALIGN.top);

    set("--font", '"' + T.font + '", "Georgia", serif');
    set("--size", (L.size / REF_WIDTH * 100).toFixed(3) + "cqw");
    set("--lh", String(L.lineSpacing));
    set("--text", T.text);
    set("--name-w", L.nameWeight);
    set("--c-wait", T.waiting);
    set("--wait-w", L.waitingWeight);
    set("--active-scale", String(L.activeScale));
    set("--wait-scale", String(L.waitingScale));
    set("--c-done", T.done);
    set("--done-deco", L.strikeDone ? "line-through" : "none");
    set("--text-shadow", L.textShadow ? "0 0.06em 0.18em rgba(0, 0, 0, 0.65)" : "none");

    var stack = function (name) { return name ? '"' + name + '", "Georgia", serif' : "inherit"; };
    set("--heading-scale", String(L.headingScale));
    set("--paused-scale", String(L.pausedScale));
    set("--title-w", L.titleWeight);
    set("--c-title", T.title);
    set("--title-font", stack(L.titleFont));
    set("--total-w", L.totalWeight);
    set("--c-total", T.total);
    set("--total-font", stack(L.totalFont));

    set("--accent", T.accent);
    set("--flag", T.flag || T.accent);
    set("--flag-edge", T.flag ? "inset 0 0 0 1px rgba(20, 16, 38, 0.38)" : "none");
    set("--track", T.track);
    set("--glow", T.glow);
    set("--thanks-scale", String(L.thanksScale));
    set("--thanks-w", L.thanksWeight);
    set("--c-thanks", T.thanks);
    set("--bar-h", L.barH + "em");
    set("--row-gap", L.rowGap + "em");
    set("--fill-s", L.fillSeconds + "s");

    if (L.animate) root.classList.remove("no-motion");
    else root.classList.add("no-motion");

    document.body.style.background = "transparent";
    loadFont(T.font, "incentive-font-link");
    if (L.titleFont) loadFont(L.titleFont, "incentive-font-link-title");
    if (L.totalFont) loadFont(L.totalFont, "incentive-font-link-total");
  }

  // BioRhyme is a variable font, so ask for its whole weight range: every
  // boldness the settings offer is then drawn for real rather than faked by the
  // browser. Other families are requested plainly because single-weight ones
  // reject a weight axis.
  var FONT_WEIGHTS = { "BioRhyme": ":wght@200..800" };

  // One stylesheet link per font in use: the main font, and the title and the
  // total when they have been given fonts of their own.
  function loadFont(name, id) {
    if (!name) return;
    var href = "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(name).replace(/%20/g, "+") + (FONT_WEIGHTS[name] || "") + "&display=swap";
    var link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
    // The font changes how wide every name is, so measure again once it arrives.
    link.onload = fitAll;
  }

  // The panel is exactly as wide as its box, so a name that is too long for its
  // row shrinks until it fits, down to MIN_FIT percent, and only then is trimmed
  // with an ellipsis. It is measured at full size each time, because shrinking
  // changes what the row has room for.
  function fitText(node) {
    if (!node || node.hidden) return;
    node.style.fontSize = "";
    var natural = node.scrollWidth;
    var room = node.clientWidth;
    if (!(natural > 0) || natural <= room) return;
    // With no room at all the name still shrinks as far as it is allowed to.
    node.style.fontSize = Math.max(MIN_FIT, room > 0 ? Math.floor(room / natural * 100) : 0) + "%";
  }
  // The title and the sub count are always the same size, and they share one row,
  // so they shrink together by the most the title needs. The count cannot shrink
  // on its own, so both are scaled: with the title at width t, the count at width c
  // and the title given room r, a scale of (r + c) / (t + c) fits the pair exactly.
  function fitHeading() {
    if (!el.title || !el.header) return;
    // Shrinking goes through a multiplier on the heading's own size, not a font-size
    // of its own, which would replace that size rather than scale it.
    el.header.style.setProperty("--heading-fit", "1");
    if (el.title.hidden) return;
    var natural = el.title.scrollWidth;
    var room = el.title.clientWidth;
    // A title with no room at all (squeezed to nothing by a wide count) still has to
    // be shrunk, so only a title that already fits is left alone.
    if (!(natural > 0) || natural <= room) return;
    // Everything on the right of the title (the count and the paused note) shrinks
    // with it, so the whole row stays on one line. When the row's width is known the
    // pair is scaled to fill it exactly; otherwise the room the title was given
    // stands in for it.
    var count = el.headerRight ? (el.headerRight.offsetWidth || 0) : 0;
    var rowWidth = el.header.clientWidth;
    var gap = 0;
    if (typeof getComputedStyle === "function") {
      try { gap = parseFloat(getComputedStyle(el.header).columnGap) || 0; } catch (e) { gap = 0; }
    }
    var scale = rowWidth > 0 ? (rowWidth - gap) / (natural + count) : (room + count) / (natural + count);
    var pct = Math.min(100, Math.max(MIN_FIT, Math.floor(scale * 100)));
    el.header.style.setProperty("--heading-fit", String(pct / 100));
  }

  // The text already scales with the box's width. If the content is still too tall
  // for the box's height, everything is scaled down by the amount that makes it fit,
  // so the panel uses exactly the space it was given and never spills out of it.
  // The bits strip is left out of the measurement because it comes and goes, and
  // the text should not jump each time someone cheers.
  function fitBox() {
    if (!el.app || !el.panel) return;
    el.app.style.setProperty("--fit-h", "1");
    if (el.panel.hidden) return;
    var boxHeight = el.app.clientHeight;
    var height = el.panel.offsetHeight;
    if (!(boxHeight > 0) || !(height > 0)) return;
    if (el.bits && !el.bits.hidden) {
      var margin = 0;
      if (typeof getComputedStyle === "function") {
        try { margin = parseFloat(getComputedStyle(el.bits).marginTop) || 0; } catch (e) { margin = 0; }
      }
      height -= (el.bits.offsetHeight || 0) + margin;
    }
    if (height <= boxHeight) return;
    // A touch under the exact ratio, so rounding never leaves the last line clipped.
    var k = Math.max(0.1, Math.floor(boxHeight / height * 1000) / 1000 * 0.99);
    el.app.style.setProperty("--fit-h", String(Math.round(k * 1000) / 1000));
  }

  // Rows ease between their condensed and full sizes, and the height is only right
  // once that has finished, so measure again a moment after each transition ends.
  function fitSoonAfter() {
    if (fitSoon) clearTimeout(fitSoon);
    fitSoon = setTimeout(fitAll, 80);
  }

  function fitAll() {
    if (!el.list) return;
    fitBox();
    fitHeading();
    fitText(el.thanksText);
    for (var id in rows) if (rows.hasOwnProperty(id)) fitText(rows[id].name);
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function hasStore() {
    return typeof SE_API !== "undefined" && SE_API && SE_API.store &&
      typeof SE_API.store.set === "function";
  }
  function saveState() {
    if (!hasStore()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      // A goal that is mid-celebration is already earned, so it is saved as
      // unlocked and comes back settled rather than celebrating a second time.
      var keep = [];
      for (var i = 0; i < incentives.length; i++) {
        var inc = incentives[i];
        keep.push({ id: inc.id, target: inc.target, name: inc.name, unlocked: !!(inc.unlocking || inc.done) });
      }
      try { SE_API.store.set(STORE_KEY, { subs: subs, bitsLeft: bitsLeft, tipLeft: tipLeft, tracking: tracking, incentives: keep, nextId: nextId }); }
      catch (e) { /* store is best-effort */ }
    }, 300);
  }
  function restoreState(done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(false); return; }
    try {
      Promise.resolve(SE_API.store.get(STORE_KEY)).then(function (saved) {
        if (saved && typeof saved === "object" && typeof saved.subs === "number") {
          subs = Math.max(0, Math.round(saved.subs));
          bitsLeft = Math.max(0, Math.round(num(saved.bitsLeft, 0)));
          tipLeft = Math.max(0, Math.round(num(saved.tipLeft, 0)));
          // Saves from before tracking could be paused have no flag, and a counter
          // that is counting is the kinder thing to come back to.
          tracking = saved.tracking !== false;
          incentives = [];
          var list = Array.isArray(saved.incentives) ? saved.incentives : [];
          for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (!s || !(s.target >= 1) || !s.name) continue;
            incentives.push({ id: s.id, target: Math.round(s.target), name: String(s.name), unlocking: false, done: s.unlocked === true });
          }
          nextId = Math.max(1, Math.round(num(saved.nextId, 1)));
          for (var j = 0; j < incentives.length; j++) {
            if (incentives[j].id >= nextId) nextId = incentives[j].id + 1;
          }
          done(true);
        } else {
          done(false);
        }
      }).catch(function () { done(false); });
    } catch (e) { done(false); }
  }

  function canManage(roles) {
    if (roles.broadcaster) return true;
    return cfg.whoCanManage === "mods" && roles.mod;
  }

  // ---------------------------------------------------------------------------
  // Sub maths
  // ---------------------------------------------------------------------------
  // Reading the sub count out of a StreamElements subscriber event is fiddly,
  // because a community gift arrives as several events and only one of them holds
  // the real number. The shape (per the StreamElements event reference) is:
  //   - event.bulkGifted        the bomb announcement; event.amount is how many
  //                             subs were gifted, which is the number we want.
  //   - event.isCommunityGift   one recipient inside that bomb, fired once each;
  //                             its amount is a months/streak figure, NOT a count,
  //                             so it must be skipped or the total balloons.
  //   - event.gifted (alone)    a single targeted gift, which is one sub.
  //   - anything else           a new sub, a resub or a prime sub, one sub each for
  //                             the purposes of a goal (a resub's amount is months,
  //                             so it is not read).
  // The Counting fields can switch gifts, or own subs, off.
  function subUnits(event) {
    if (bool(event.bulkGifted, false)) {
      return cfg.countGifts ? Math.max(0, Math.round(num(event.amount, 0))) : 0;
    }
    if (bool(event.isCommunityGift, false) || bool(event.playedAsCommunityGift, false)) return 0;
    if (bool(event.gifted, false)) return cfg.countGifts ? 1 : 0;
    return cfg.countNewSubs ? 1 : 0;
  }

  function sorted() {
    return incentives.slice().sort(function (a, b) {
      if (cfg.goalOrder === "added") return a.id - b.id;
      return a.target - b.target || a.id - b.id;
    });
  }

  function setSubs(next, kind) {
    next = Math.max(0, Math.round(next));
    var changed = next !== subs;
    subs = next;
    // A reset is a fresh start for a new stream, so every goal is up for grabs again.
    if (kind === "reset") { rearm(); bitsLeft = 0; tipLeft = 0; }
    saveState();
    var unlocked = checkUnlocks();
    render();
    if (changed && kind === "reset") pop();
    return unlocked;
  }

  // Stopped is for the time before the stream that matters: goals can be set up
  // and the panel shown, but no sub or cheer moves anything until it is started.
  // Manual adjustments keep working so a mistake can still be put right.
  function setTracking(next) {
    var was = tracking;
    tracking = !!next;
    saveState();
    render();
    if (was !== tracking) pop();
  }

  // Other widgets can build on this one without parsing StreamElements events a
  // second time. Each sub or cheer that is counted is announced on the page as a
  // "subgoals:counted" event, so whatever listens gets the same answer to "how many
  // subs was that?", including the gift bomb case where only the announcement
  // counts, and the two can never disagree. Nothing listens in the standalone
  // widget, and an announcement that fails is never allowed to break counting.
  function announce(detail) {
    try { window.dispatchEvent(new CustomEvent("subgoals:counted", { detail: detail })); }
    catch (e) { /* announcing is best-effort */ }
  }
  // "1000", "2000", "3000" and "prime" become 1, 2, 3 and 1.
  function tierOf(event) {
    var t = String(event.tier || "").toLowerCase();
    if (t === "2000" || t === "2") return 2;
    if (t === "3000" || t === "3") return 3;
    return 1;
  }

  function handleSub(event) {
    event = event || {};
    if (cfg.debug && typeof console !== "undefined" && console.log) {
      // So a surprising payload on a real stream can be read straight from the
      // browser-source console, rather than guessed at from the outside.
      try { console.log("[incentives] subscriber-latest", JSON.stringify(event)); }
      catch (e) { console.log("[incentives] subscriber-latest", event); }
    }
    if (!tracking) return;
    var n = subUnits(event);
    if (n <= 0) return;
    var unlocked = setSubs(subs + n, "sub");
    if (!goalSoundTakesOver(unlocked)) playSound("sub");
    var bulk = bool(event.bulkGifted, false);
    announce({
      kind: "sub", count: n, tier: tierOf(event), bulk: bulk,
      gifted: bulk || bool(event.gifted, false),
      who: String(event.sender || event.name || event.username || ""), subs: subs
    });
  }

  // Bits count towards the goals at a rate the streamer chooses (500 bits to a sub
  // by default). A cheer too small to make a whole sub is not thrown away: the
  // remainder is kept, so 300 bits and then another 300 bits add up to one sub.
  // A rate of 0 switches bits off.
  function handleCheer(event) {
    event = event || {};
    if (cfg.debug && typeof console !== "undefined" && console.log) {
      try { console.log("[incentives] cheer-latest", JSON.stringify(event)); }
      catch (e) { console.log("[incentives] cheer-latest", event); }
    }
    if (!tracking) return;
    addBits(num(event.amount, 0));
    var bits = Math.max(0, Math.round(num(event.amount, 0)));
    if (bits > 0) announce({ kind: "bits", amount: bits, who: String(event.name || event.username || ""), subs: subs });
  }

  // The part shared by a real cheer and `!incentive bits`: the manual one skips the
  // tracking check above, so bits from somewhere else can be added while stopped.
  function addBits(amount) {
    amount = Math.max(0, Math.round(amount));
    if (cfg.bitsPerSub <= 0 || amount <= 0) return;
    var before = bitsLeft;
    var total = bitsLeft + amount;
    var whole = Math.floor(total / cfg.bitsPerSub);
    bitsLeft = total - whole * cfg.bitsPerSub;
    var unlocked = 0;
    if (whole > 0) unlocked = setSubs(subs + whole, "bits");
    else saveState();
    showBitsAnimation(amount, before, whole, bitsLeft, {
      per: cfg.bitsPerSub,
      gain: function (a) { return "+" + a + " " + cfg.bitsLabel; },
      status: function (n) { return n + "/" + cfg.bitsPerSub + " " + cfg.bitsLabel; }
    });
    if (!goalSoundTakesOver(unlocked)) playSound("bits");
  }

  // Tips count the same way, at a rate in the channel's own currency (5 to a sub by
  // default), so a direct donation is worth more than its time on the clock alone.
  // Like bits, a tip too small for a whole sub is kept and added to the next one.
  function handleTip(event) {
    event = event || {};
    if (cfg.debug && typeof console !== "undefined" && console.log) {
      try { console.log("[incentives] tip-latest", JSON.stringify(event)); }
      catch (e) { console.log("[incentives] tip-latest", event); }
    }
    if (!tracking) return;
    var cents = Math.max(0, Math.round(num(event.amount, 0) * 100));
    addTips(cents);
    if (cents > 0 && cfg.tipCentsPerSub > 0) announce({ kind: "tip", amount: cents / 100, who: String(event.name || event.username || ""), subs: subs });
  }
  function addTips(cents) {
    cents = Math.max(0, Math.round(cents));
    if (cfg.tipCentsPerSub <= 0 || cents <= 0) return;
    var before = tipLeft;
    var total = tipLeft + cents;
    var whole = Math.floor(total / cfg.tipCentsPerSub);
    tipLeft = total - whole * cfg.tipCentsPerSub;
    var unlocked = 0;
    if (whole > 0) unlocked = setSubs(subs + whole, "tip");
    else saveState();
    showBitsAnimation(cents, before, whole, tipLeft, {
      per: cfg.tipCentsPerSub,
      gain: function (a) { return "+" + money(a); },
      status: function (n) { return money(n) + "/" + money(cfg.tipCentsPerSub); }
    });
    if (!goalSoundTakesOver(unlocked)) playSound("bits");
  }
  // The symbol goes before the amount ($5) or after it (5 kr, 5\u20ac). A lone sign sits tight
  // against the number and a word gets a space, and the decimal can be a comma (5,50).
  function money(cents) {
    var n = (cents / 100).toFixed(2).replace(/\.00$/, "");
    if (cfg.tipDecimalComma) n = n.replace(".", ",");
    var sym = cfg.tipSymbol;
    if (!sym) return n;
    if (!cfg.tipSymbolAfter) return sym + n;
    return n + (/^[A-Za-z\u00c0-\u024f]/.test(sym) ? " " : "") + sym;
  }

  // The cheer lands as a "+300 bits" chip over a small bar. After a moment the bar
  // fills towards the next sub, slowly and evenly, while the number beside it counts
  // up in step, so the calculation can be watched. If it fills, the bar flashes
  // "= +1 sub", holds, then drops back and counts up to the bits left over. Finally
  // the whole strip tucks itself away.
  function bitsAfter(ms, fn) { bitsTimers.push(setTimeout(fn, ms)); }
  function clearBitsTimers() {
    while (bitsTimers.length) clearTimeout(bitsTimers.pop());
    while (bitsIntervals.length) clearInterval(bitsIntervals.pop());
  }
  function bitsPct(n) {
    return Math.min(100, Math.round(n / meter.per * 1000) / 10) + "%";
  }
  // A move of the bar over `ms` at an even pace, or straight there when ms is 0.
  function bitsFill(pct, ms) {
    if (!ms) {
      el.bitsFill.style.transition = "none";
      el.bitsFill.style.width = pct;
      void el.bitsFill.offsetWidth;
      el.bitsFill.style.transition = "";
      return;
    }
    el.bitsFill.style.transition = "width " + ms + "ms linear";
    el.bitsFill.style.width = pct;
  }
  // The number beside the bar counting from one value to another in the same time
  // the bar takes, so the two always agree.
  function bitsCount(from, to, ms) {
    var show = function (n) { el.bitsStatus.textContent = meter.status(n); };
    show(from);
    if (to === from) return;
    var began = Date.now();
    var id = setInterval(function () {
      var p = Math.min(1, (Date.now() - began) / ms);
      show(Math.round(from + (to - from) * p));
      // Done: stop ticking, or it would go on rewriting the text after the count.
      if (p >= 1) clearInterval(id);
    }, 50);
    bitsIntervals.push(id);
    bitsAfter(ms, function () { clearInterval(id); show(to); });
  }

  function showBitsAnimation(amount, before, whole, after, m) {
    if (!cfg.showBits || !el.bits) return;
    meter = m;
    var per = meter.per;
    var calc = cfg.bitsCalcMs;
    clearBitsTimers();

    el.bits.hidden = false;
    el.bits.classList.remove("converted");
    el.bits.classList.remove("enter");
    void el.bits.offsetWidth;
    el.bits.classList.add("enter");

    el.bitsGain.textContent = meter.gain(amount);
    bump(el.bitsGain);
    el.bitsStatus.textContent = meter.status(before);
    bitsFill(bitsPct(before), 0);

    // 1. Fill towards the next sub (right to the top if this cheer makes one).
    var reach = whole > 0 ? per : before + amount;
    bitsAfter(BITS_START_MS, function () {
      bitsFill(bitsPct(reach), calc);
      bitsCount(before, reach, calc);
    });
    var done = BITS_START_MS + calc;

    // 2. If it made subs: flash, hold, then drop back and count up the leftovers.
    if (whole > 0) {
      var convertAt = done + BITS_CONVERT_GAP_MS;
      var hold = Math.max(600, Math.round(calc * 0.6));
      var resetAt = convertAt + hold;
      var leftoverMs = Math.max(400, Math.round(calc * 0.4));
      bitsAfter(convertAt, function () {
        el.bits.classList.add("converted");
        el.bitsStatus.textContent = "= +" + whole + " " + unit(whole);
        bump(el.bitsStatus);
      });
      bitsAfter(resetAt, function () {
        el.bits.classList.remove("converted");
        bitsFill("0%", 0);
        el.bitsStatus.textContent = meter.status(0);
      });
      // A moment later so the empty bar is painted before it starts to fill.
      bitsAfter(resetAt + 60, function () {
        bitsFill(bitsPct(after), after > 0 ? leftoverMs : 0);
        bitsCount(0, after, leftoverMs);
      });
      done = resetAt + 60 + (after > 0 ? leftoverMs : 0);
    }

    // 3. Stay a little while once it has finished, then leave.
    bitsAfter(done + cfg.bitsStripMs, function () {
      el.bits.hidden = true;
    });
  }

  // ---------------------------------------------------------------------------
  // Goals
  // ---------------------------------------------------------------------------
  function addIncentive(rest) {
    var m = /^(\d+)\s+(\S[\s\S]*)$/.exec(String(rest).trim());
    if (!m) return;
    var target = parseInt(m[1], 10);
    var name = m[2].replace(/\s+/g, " ").trim().slice(0, cfg.maxNameLength);
    if (!(target >= 1) || target > MAX_TARGET || !name) return;
    incentives.push({ id: nextId++, target: target, name: name, unlocking: false, done: false });
    saveState();
    checkUnlocks();      // a goal that is already met celebrates straight away
    render();
  }

  // "2" means the second goal in the order it is shown, anything else is matched
  // against the names, case-insensitively, taking the nearest goal that fits.
  function findIncentive(arg) {
    var list = sorted();
    arg = String(arg).trim().toLowerCase();
    if (!arg) return null;
    if (/^\d+$/.test(arg)) return list[parseInt(arg, 10) - 1] || null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name.toLowerCase().indexOf(arg) !== -1) return list[i];
    }
    return null;
  }

  function removeIncentive(inc) {
    if (inc.timer) clearTimeout(inc.timer);
    var at = incentives.indexOf(inc);
    if (at !== -1) incentives.splice(at, 1);
    saveState();
    render();
  }

  function clearIncentives() {
    for (var i = 0; i < incentives.length; i++) {
      if (incentives[i].timer) clearTimeout(incentives[i].timer);
    }
    incentives = [];
    saveState();
    render();
  }

  function rearm() {
    for (var i = 0; i < incentives.length; i++) {
      var inc = incentives[i];
      if (inc.timer) { clearTimeout(inc.timer); inc.timer = null; }
      inc.unlocking = false;
      inc.done = false;
    }
  }

  // A goal that has been reached glows for a few moments so chat can enjoy it,
  // then settles into a struck-through line that stays on screen. Several reached
  // together (a gift bomb) take turns.
  function checkUnlocks() {
    var batch = 0;
    var list = sorted();
    for (var i = 0; i < list.length; i++) {
      var inc = list[i];
      if (inc.unlocking || inc.done || inc.target > subs) continue;
      inc.unlocking = true;
      inc.delay = batch * STAGGER_MS;
      batch++;
      inc.timer = setTimeout(finishUnlock.bind(null, inc), Math.round(cfg.unlockSeconds * 1000) + inc.delay);
    }
    // One sound for the whole batch, so a gift bomb that clears three goals is a
    // single moment rather than three on top of each other.
    if (batch > 0) playSound("goal");
    return batch;
  }
  function finishUnlock(inc) {
    inc.timer = null;
    // With Keep reached goals off, a goal simply leaves once it has celebrated.
    if (!cfg.keepUnlocked) { removeIncentive(inc); return; }
    inc.unlocking = false;
    inc.done = true;
    saveState();
    render();
  }

  // Partial corrections from chat: "+5" / "-5" (or a bare "5") adjust relative to
  // the current count; "set 30" / "=30" put it to an exact number.
  function applyAdjustment(rest) {
    var m = String(rest).trim().match(/^(set\s+|=\s*)?([+-]?\d+)$/i);
    if (!m) return;
    var n = parseInt(m[2], 10);
    if (isNaN(n)) return;
    if (m[1]) setSubs(n, "set");
    else setSubs(subs + n, "adjust");
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------
  function handleMessage(data) {
    if (!data) return;
    var text = String(data.text || "").trim();
    if (!text) return;
    var first = text.toLowerCase().split(/\s+/)[0];
    if (first !== cfg.cmd) return;

    var rest = text.replace(/^\S+\s*/, "").trim();
    var verb = rest.toLowerCase().split(/\s+/)[0];
    var arg = rest.replace(/^\S+\s*/, "").trim();

    // Showing the panel is harmless, so anyone can ask for it.
    var V = cfg.verbs;
    if (!rest || verb === V.list) { pop(); return; }
    if (!canManage(rolesOf(data))) return;

    if (verb === V.add) addIncentive(arg);
    else if (verb === V.remove) {
      var inc = findIncentive(arg);
      if (inc) removeIncentive(inc);
    }
    else if (verb === V.clear) clearIncentives();
    else if (verb === V.subs) applyAdjustment(arg);
    else if (verb === V.reset) setSubs(0, "reset");
    else if (verb === V.bits) {
      var bm = /^\+?(\d+)$/.exec(arg);
      if (bm) addBits(parseInt(bm[1], 10));
    }
    else if (verb === V.tip) {
      var tm = /^[^\d]*(\d+(?:\.\d+)?)$/.exec(arg);
      if (tm) addTips(Math.round(parseFloat(tm[1]) * 100));
    }
    else if (verb === V.start) setTracking(true);
    else if (verb === V.stop) setTracking(false);
  }

  function handleButton(field) {
    switch (field) {
      case "btnDemo":
        addIncentive("5 karaoke");
        addIncentive("10 playing a game");
        addIncentive("15 chat confessions");
        break;
      case "btnPlus": setSubs(subs + 1, "adjust"); break;
      case "btnMinus": setSubs(subs - 1, "adjust"); break;
      case "btnReset": setSubs(0, "reset"); break;
      case "btnClear": clearIncentives(); break;
      case "btnTracking": setTracking(!tracking); break;
      case "btnSoundSub": playSound("sub"); break;
      case "btnSoundBits": playSound("bits"); break;
      case "btnSoundGoal": playSound("goal"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function make(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Every goal already reached stays on screen, and the streamer's cap applies to
  // the goals still to come: the nearest ones win the slots, and a goal that is
  // celebrating right now keeps its place.
  function visibleList() {
    var all = sorted();
    var celebrating = 0;
    for (var i = 0; i < all.length; i++) if (all[i].unlocking) celebrating++;
    var slots = Math.max(0, cfg.maxVisible - celebrating);
    var out = [];
    for (var j = 0; j < all.length; j++) {
      if (all[j].done && !cfg.keepUnlocked) continue;
      if (all[j].unlocking || all[j].done) out.push(all[j]);
      else if (slots > 0) { out.push(all[j]); slots--; }
    }
    return out;
  }

  function makeRow(inc) {
    var li = make("li", "incentive-row");
    var top = make("div", "incentive-row-top");
    var name = make("span", "incentive-name");
    var count = make("span", "incentive-count");
    var track = make("div", "incentive-track");
    var fill = make("div", "incentive-fill");
    fill.style.width = "0%";
    top.appendChild(name);
    top.appendChild(count);
    track.appendChild(fill);
    li.appendChild(top);
    li.appendChild(track);
    return { li: li, name: name, count: count, fill: fill, countText: "" };
  }

  // Only the goal chat is actually working towards gets a bar and a running
  // count. The ones waiting behind it shrink to a single quiet line, and swell
  // back out into a full row when it is their turn.
  function updateRow(row, inc, fresh, condensed) {
    row.name.textContent = inc.name;
    if (condensed) row.li.classList.add("condensed");
    else row.li.classList.remove("condensed");

    if (inc.done) { row.li.classList.add("done"); row.li.style.animationDelay = ""; }
    else row.li.classList.remove("done");
    if (!inc.unlocking) row.li.classList.remove("unlocked");

    var countText, pct;
    if (inc.done) {
      countText = cfg.doneText;
      pct = 100;
    } else if (inc.unlocking) {
      countText = cfg.unlockedText;
      pct = 100;
      if (!row.li.classList.contains("unlocked")) {
        row.li.style.animationDelay = (inc.delay || 0) / 1000 + "s";
        row.li.classList.add("unlocked");
      }
    } else {
      if (!condensed) countText = subs + "/" + inc.target;
      else countText = cfg.showWaitingCounts ? inc.target + " " + unit(inc.target) : "";
      pct = Math.min(100, Math.round(subs / inc.target * 1000) / 10);
    }

    if (row.countText !== countText) {
      row.count.textContent = countText;
      if (!fresh) bump(row.count);
      row.countText = countText;
    }
    // Reading offsetWidth first means a brand new bar is painted empty before it
    // is told its real width, so it fills in rather than appearing already full.
    if (fresh) void row.fill.offsetWidth;
    row.fill.style.width = pct + "%";
  }

  function dropRow(id) {
    var row = rows[id];
    if (!row) return;
    delete rows[id];
    leavingCount++;
    row.li.classList.add("leaving");
    setTimeout(function () {
      if (row.li.parentNode) row.li.parentNode.removeChild(row.li);
      leavingCount--;
      refreshVisibility();
    }, LEAVE_MS);
  }

  function refreshVisibility() {
    if (!el.panel) return;
    var any = false;
    for (var id in rows) if (rows.hasOwnProperty(id)) { any = true; break; }
    el.panel.hidden = !(any || leavingCount > 0);
  }

  function render() {
    if (!el.list) return;
    var vis = visibleList();
    var keep = {};
    var i;
    for (i = 0; i < vis.length; i++) keep[vis[i].id] = true;
    for (var id in rows) if (rows.hasOwnProperty(id) && !keep[id]) dropRow(id);

    var activeId = null;
    for (i = 0; i < vis.length; i++) {
      if (!vis[i].unlocking && !vis[i].done) { activeId = vis[i].id; break; }
    }

    for (i = 0; i < vis.length; i++) {
      var inc = vis[i];
      var row = rows[inc.id];
      var fresh = !row;
      if (fresh) {
        row = makeRow(inc);
        rows[inc.id] = row;
        var before = null;
        for (var j = i + 1; j < vis.length; j++) {
          if (rows[vis[j].id]) { before = rows[vis[j].id].li; break; }
        }
        el.list.insertBefore(row.li, before);
      }
      updateRow(row, inc, fresh, inc.done || (!inc.unlocking && inc.id !== activeId));
    }

    var hasTitle = !!cfg.title;
    el.title.hidden = !hasTitle;
    el.title.textContent = cfg.title;
    el.total.hidden = !cfg.showTotal;
    el.total.textContent = subs + " " + unit(subs);
    // While paused a note says so, beside the count on the heading's own line, so
    // nobody wonders why the bars are not moving. It shows even when the title and
    // count are switched off, so the heading row stays while paused.
    el.paused.hidden = tracking;
    el.header.hidden = !hasTitle && !cfg.showTotal && tracking;
    el.paused.textContent = cfg.pausedText;
    updateThanks();
    refreshVisibility();
    fitAll();
    // Rows ease between their condensed and full sizes, so measure again once
    // that has settled.
    if (fitTimer) clearTimeout(fitTimer);
    fitTimer = setTimeout(fitAll, 650);
  }

  // Once every goal has been reached, and its celebration is over, a thank-you
  // appears at the foot of the panel. Anything still to be reached, or any goal
  // added or re-opened afterwards, tucks it away again.
  function updateThanks() {
    if (!el.thanks) return;
    var all = incentives.length > 0;
    for (var i = 0; i < incentives.length; i++) if (!incentives[i].done) { all = false; break; }
    var show = all && cfg.showThanks && cfg.keepUnlocked;

    if (!show) {
      if (thanksTimer) { clearTimeout(thanksTimer); thanksTimer = null; }
      el.thanks.hidden = true;
      return;
    }
    el.thanksText.textContent = cfg.thanksText;
    el.thanksTrack.hidden = !cfg.thanksBar;
    // With no bar under it the message needs no gap below it either.
    if (cfg.thanksBar) el.thanks.classList.remove("no-bar");
    else el.thanks.classList.add("no-bar");
    if (!el.thanks.hidden) return;

    el.thanks.hidden = false;
    el.thanks.classList.remove("enter");
    void el.thanks.offsetWidth;
    el.thanks.classList.add("enter");
    // Reading the width first paints the bar empty, so it fills in rather than
    // appearing already full.
    el.thanksFill.style.transition = "none";
    el.thanksFill.style.width = "0%";
    void el.thanksFill.offsetWidth;
    el.thanksFill.style.transition = "";
    if (thanksTimer) clearTimeout(thanksTimer);
    thanksTimer = setTimeout(function () { el.thanksFill.style.width = "100%"; }, 60);
  }

  // Retrigger a CSS animation by taking the class off, forcing a reflow, and
  // putting it back.
  function bump(node) {
    node.classList.remove("bump");
    void node.offsetWidth;
    node.classList.add("bump");
  }
  function pop() {
    if (!el.panel) return;
    el.panel.classList.remove("pop");
    void el.panel.offsetWidth;
    el.panel.classList.add("pop");
    if (popTimer) clearTimeout(popTimer);
    popTimer = setTimeout(function () { el.panel.classList.remove("pop"); }, 600);
  }

  window.addEventListener("resize", fitAll);
  // Measuring too early would use a narrower stand-in font, so measure again each
  // time a font actually finishes loading, not only when the stylesheet arrives.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);
  if (document.fonts && typeof document.fonts.addEventListener === "function") {
    document.fonts.addEventListener("loadingdone", fitAll);
  }

  window.addEventListener("onEventReceived", function (obj) {
    if (!obj || !obj.detail) return;
    var listener = obj.detail.listener;
    var event = obj.detail.event || {};
    if (listener === "message") handleMessage(event.data || {});
    else if (listener === "widget-button") handleButton(event.field);
    else if (listener === "subscriber-latest") handleSub(event);
    else if (listener === "cheer-latest") handleCheer(event);
    else if (listener === "tip-latest") handleTip(event);
  });

  window.addEventListener("onWidgetLoad", function (obj) {
    var fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
    readConfig(fieldData);

    // A reload starts from a clean slate: stop any celebration timers and empty
    // the list before the saved goals come back in.
    for (var i = 0; i < incentives.length; i++) {
      if (incentives[i].timer) clearTimeout(incentives[i].timer);
    }
    for (var id in rows) {
      if (rows.hasOwnProperty(id) && rows[id].li.parentNode) {
        rows[id].li.parentNode.removeChild(rows[id].li);
      }
    }
    rows = {};
    subs = 0;
    bitsLeft = 0;
    tipLeft = 0;
    tracking = true;
    incentives = [];
    nextId = 1;

    el.app = document.getElementById("incentive-app");
    el.panel = document.getElementById("incentive-panel");
    el.header = document.getElementById("incentive-header");
    el.title = document.getElementById("incentive-title");
    el.total = document.getElementById("incentive-total");
    el.paused = document.getElementById("incentive-paused");
    el.headerRight = document.getElementById("incentive-header-right");
    el.list = document.getElementById("incentive-list");
    if (el.list && !transitionBound && typeof el.list.addEventListener === "function") {
      el.list.addEventListener("transitionend", fitSoonAfter);
      transitionBound = true;
    }
    el.bits = document.getElementById("incentive-bits");
    el.bitsGain = document.getElementById("incentive-bits-gain");
    el.bitsStatus = document.getElementById("incentive-bits-status");
    el.bitsFill = document.getElementById("incentive-bits-fill");
    el.thanks = document.getElementById("incentive-thanks");
    el.thanksText = document.getElementById("incentive-thanks-text");
    el.thanksTrack = document.getElementById("incentive-thanks-track");
    el.thanksFill = document.getElementById("incentive-thanks-fill");
    clearBitsTimers();
    if (thanksTimer) { clearTimeout(thanksTimer); thanksTimer = null; }
    if (el.bits) el.bits.hidden = true;
    if (el.thanks) el.thanks.hidden = true;

    applyTheme();

    // The starting count only applies the first time, when the store had nothing
    // to restore; after that a browser-source refresh keeps whatever we counted.
    restoreState(function (restored) {
      if (!restored) { subs = cfg.startSubs; tracking = cfg.startTracking; }
      render();
    });
  });
})();

/* ---- Subathon clock ---- */
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

  var STORE_KEY = "subathon_v1";
  var TICK_MS = 200;

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
  function pad(n) { return (n < 10 ? "0" : "") + n; }

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
  // The same layout for time that has gone by, rounding down so it never runs ahead.
  function formatElapsed(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
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
      added: 0, capBase: 0, banked: 0, sleeping: false, power: null, last: null, elapsed: 0, day: 1, dayStamp: "", dayShift: 0
    };
  }

  // ---------------------------------------------------------------------------
  // The clock
  // ---------------------------------------------------------------------------
  function remainingNow() {
    if (!state.running) return state.remaining;
    return Math.max(0, state.remaining - (now() - state.at));
  }
  // How long the clock has actually been running, which is what a subathon's "hour 61"
  // means. Paused time does not count, and neither does anything after it reached zero.
  function elapsedNow() {
    if (!state.running) return state.elapsed;
    return state.elapsed + Math.max(0, Math.min(now() - state.at, state.remaining));
  }
  // Fold the time that has passed into the stored value, so a change starts from "now".
  function settle() {
    state.elapsed = elapsedNow();
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

  // The day number. By default each calendar day the clock runs is a new day, so a
  // subathon streamed a few hours at a time over a week reads Day 1 to Day 7, and a day with
  // no streaming does not count. The new day starts at the rollover hour rather than at
  // midnight, so a stream that runs past midnight is still the same day.
  function dayStamp(t) {
    var d = new Date(t - cfg.dayRollover * 3600000);
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  // Whole calendar days from one stamp to another. Built from UTC dates, so a clock change
  // in between cannot make a day 23 or 25 hours long.
  function daysBetween(from, to) {
    var a = from.split("-").map(Number), b = to.split("-").map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
  }
  function updateDay() {
    if (!state.running || (cfg.dayMode !== "calendar" && cfg.dayMode !== "date")) return;
    var stamp = dayStamp(now());
    if (!state.dayStamp) { state.dayStamp = stamp; save(); }
    else if (cfg.dayMode === "calendar" && stamp !== state.dayStamp) { state.day++; state.dayStamp = stamp; save(); }
  }
  function dayNumber() {
    if (cfg.dayMode === "elapsed") return Math.max(1, Math.floor(elapsedNow() / 86400000) + 1 + state.dayShift);
    // "date" counts calendar days from the day it was anchored, running or not.
    if (cfg.dayMode === "date" && state.dayStamp) return Math.max(1, state.day + daysBetween(state.dayStamp, dayStamp(now())));
    return state.day;
  }
  function setDay(n) {
    n = Math.max(1, Math.floor(n));
    // Counting by running time has no date to hold on to, so a day set by hand is kept as a shift.
    if (cfg.dayMode === "elapsed") state.dayShift = n - (Math.floor(elapsedNow() / 86400000) + 1);
    else { state.day = n; state.dayStamp = dayStamp(now()); }
    save(); render();
  }
  // "+1" and "-1" move from the number on screen, whichever way the day is being counted.
  function parseDay(text) {
    var m = /^([+-])(\d+)$/.exec(text);
    if (m) return dayNumber() + (m[1] === "-" ? -1 : 1) * parseInt(m[2], 10);
    return /^\d+$/.test(text) ? parseInt(text, 10) : NaN;
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
      state.elapsed += state.remaining;
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
    state.sleeping = false; state.last = null; state.elapsed = 0; state.day = 1; state.dayStamp = ""; state.dayShift = 0;
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
      case "day": var dn = parseDay(args[0] || ""); if (!isNaN(dn)) setDay(dn); break;
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
      case "tmDayNext": setDay(dayNumber() + 1); break;
      case "tmDayPrev": setDay(dayNumber() - 1); break;
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
      s.elapsed = Math.max(0, num(saved.elapsed, 0));
      s.day = Math.max(1, Math.floor(num(saved.day, 1)));
      s.dayStamp = str(saved.dayStamp, "");
      s.dayShift = Math.floor(num(saved.dayShift, 0));
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
    s.setProperty("--sa-bgimg", theme.bgimg || "none");
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
    // The clock card shrinks to fit the box, but leaves some of it for the goals while they are showing.
    watchFit(el.root, el.app, cfg.fit, {
      share: function () { var panel = byId("incentive-panel"); return panel && !panel.hidden ? 0.6 : 1; },
      also: byId("subathon-goals"),
      // The goals module fits itself to the room it has, and only looks again when the window is resized.
      after: function () { window.dispatchEvent(new CustomEvent("resize")); }
    });
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
    if (cfg.showDay) bits.push((cfg.dayLabel ? cfg.dayLabel + " " : "") + dayNumber());
    if (state.ended) { if (cfg.endedText) bits.push(cfg.endedText); }
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
    updateDay();
    var elapsedText = formatElapsed(elapsedNow());
    var remainingText = formatClock(rem);
    var showsElapsed = cfg.clockShows === "elapsed";
    var text = showsElapsed ? elapsedText : remainingText;
    if (text !== lastClockText) {
      el.clock.textContent = text;
      lastClockText = text;
    }
    el.elapsed.textContent = showsElapsed ? (cfg.remainingLabel ? cfg.remainingLabel + " " : "") + remainingText : (cfg.elapsedLabel ? cfg.elapsedLabel + " " : "") + elapsedText;
    el.elapsed.hidden = !cfg.showOther;
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
      endedText: txt(f.tmEndedText, "Time's up!"),
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
      title: txt(f.tmTitle, "Subathon"),
      showTitle: bool(f.tmShowTitle, true),
      showStatus: bool(f.tmShowStatus, true),
      clockShows: str(f.tmClockShows, "remaining"),
      showOther: bool(f.tmShowOther, false),
      elapsedLabel: txt(f.tmElapsedLabel, "Elapsed"),
      remainingLabel: txt(f.tmRemainingLabel, "Remaining"),
      showDay: bool(f.tmShowDay, false),
      dayLabel: txt(f.tmDayLabel, "Day"),
      dayMode: str(f.tmDayMode, "calendar"),
      dayRollover: Math.max(0, Math.min(23, Math.floor(num(f.tmDayRollover, 4)))),
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
      fit: bool(f.tmFit, true),
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
      status: "subathon-status", elapsed: "subathon-elapsed", feed: "subathon-feed", goals: "subathon-goals" };
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
