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

  // ---------------------------------------------------------------------------
  // Config helpers
  // ---------------------------------------------------------------------------
  function bool(v, dflt) {
    if (v === undefined || v === null || v === "") return dflt;
    return v === true || v === "true" || v === 1 || v === "1" || v === "on";
  }
  function num(v, dflt) {
    var n = parseFloat(v);
    return isNaN(n) ? dflt : n;
  }
  function str(v, dflt) {
    return (v === undefined || v === null || v === "") ? dflt : String(v);
  }

  // For wording where an empty field is a real choice. StreamElements sends "" for a cleared
  // field, which str() would turn back into the default.
  function txt(v, dflt) {
    return (v === undefined || v === null) ? dflt : String(v);
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
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
        text: str(f.colorText, "#FFFFFF"),
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
        accent: str(f.colorAccent, "#FFFFFF"),
        track: str(f.colorTrack, "#FFFFFF"),
        trackOpacity: clamp(num(f.trackOpacity, 0.2), 0, 1),
        glow: str(f.colorGlow, "#FFFFFF"),
        pausedScale: clamp(num(f.pausedScale, 0.6), 0.3, 1.5),
        thanksScale: clamp(num(f.thanksScale, 0.85), 0.4, 3),
        thanksWeight: str(f.thanksWeight, "700"),
        thanksColor: str(f.colorThanks, "#FFFFFF"),
        barH: clamp(num(f.barHeight, 0.7), 0.2, 2),
        rowGap: Math.max(0, num(f.rowGap, 0.9)),
        animations: bool(f.animations, true),
        fillSeconds: clamp(num(f.fillSeconds, 0.9), 0, 10)
      },
      showThanks: bool(f.showThanks, true),
      thanksText: txt(f.thanksText, "Thank you for your generosity! <3"),
      thanksBar: bool(f.thanksBar, false),
      sounds: {
        enabled: bool(f.soundsEnabled, true),
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

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  function rgba(hex, alpha) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return "rgba(0, 0, 0, " + alpha + ")";
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
  }

  var ALIGN = { top: "flex-start", middle: "center", bottom: "flex-end" };

  /* Style presets. The same twenty-two, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. Custom uses the colour pickers instead. */
  var PRESETS = {
    glass: { panel: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", track: "rgba(255, 255, 255, 0.2)", glow: "#FFFFFF", font: "BioRhyme" },
    frost: { panel: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", track: "rgba(0, 0, 0, 0.14)", glow: "#1B2130", font: "BioRhyme" },
    midnight: { panel: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#7FA8FF", track: "rgba(127, 168, 255, 0.22)", glow: "#7FA8FF", font: "BioRhyme" },
    sunset: { panel: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", track: "rgba(255, 154, 90, 0.24)", glow: "#FF9A5A", font: "BioRhyme" },
    forest: { panel: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", track: "rgba(111, 214, 160, 0.22)", glow: "#6FD6A0", font: "BioRhyme" },
    ocean: { panel: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", track: "rgba(76, 211, 224, 0.22)", glow: "#4CD3E0", font: "BioRhyme" },
    rose: { panel: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF8FB8", track: "rgba(255, 143, 184, 0.24)", glow: "#FF8FB8", font: "BioRhyme" },
    neon: { panel: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", track: "rgba(0, 240, 255, 0.2)", glow: "#00F0FF", font: "BioRhyme" },
    cosycabin: { panel: "#F5ECD6", text: "#57442E", accent: "#7C6142", track: "rgba(0, 0, 0, 0.11)", glow: "#7C6142", font: "Chicle" },
    pastel: { panel: "#FFF6E9", text: "#6B4F3A", accent: "#FF8A65", track: "rgba(0, 0, 0, 0.11)", glow: "#FF8A65", font: "Baloo 2" },
    celestial: { panel: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", track: "rgba(255, 255, 255, 0.18)", glow: "#E8C06B", font: "Cinzel" },
    pastelgoth: { panel: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", track: "rgba(255, 255, 255, 0.18)", glow: "#C8B6E2", font: "Quicksand" },
    pastelpink: { panel: "#FFE3EC", text: "#6A2E4B", accent: "#D95C8A", track: "rgba(106, 46, 75, 0.14)", glow: "#D95C8A", font: "Fredoka" },
    faegreen: { panel: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", track: "rgba(238, 245, 218, 0.2)", glow: "#C9E265", font: "Almendra" },
    pride: { panel: "rgba(20, 16, 34, 0.8)", text: "#FFFFFF", accent: "#FFED00", track: "rgba(255, 255, 255, 0.2)", glow: "#FFED00", font: "Fredoka", flag: ["#E40303", "#FF8C00", "#FFED00", "#008026", "#004DFF", "#750787"] },
    progress: { panel: "rgba(22, 16, 30, 0.8)", text: "#FFFFFF", accent: "#5BCEFA", track: "rgba(255, 255, 255, 0.2)", glow: "#5BCEFA", font: "Fredoka", flag: ["#F5A9B8", "#5BCEFA", "#FFFFFF", "#613915", "#E40303", "#FF8C00", "#FFED00", "#008026", "#004DFF", "#750787"] },
    trans: { panel: "rgba(18, 28, 44, 0.82)", text: "#FFFFFF", accent: "#F5A9B8", track: "rgba(255, 255, 255, 0.2)", glow: "#F5A9B8", font: "Fredoka", flag: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"] },
    bi: { panel: "rgba(30, 14, 36, 0.82)", text: "#FFFFFF", accent: "#E0559F", track: "rgba(255, 255, 255, 0.2)", glow: "#E0559F", font: "Fredoka", flag: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"] },
    pan: { panel: "rgba(24, 20, 40, 0.82)", text: "#FFFFFF", accent: "#FFD800", track: "rgba(255, 255, 255, 0.2)", glow: "#FFD800", font: "Fredoka", flag: ["#FF218C", "#FFD800", "#21B1FF"] },
    enby: { panel: "rgba(24, 24, 28, 0.86)", text: "#FFFFFF", accent: "#FCF434", track: "rgba(255, 255, 255, 0.2)", glow: "#FCF434", font: "Fredoka", flag: ["#FCF434", "#FFFFFF", "#9C59D1", "#2C2C2C"] },
    lesbian: { panel: "rgba(40, 16, 20, 0.82)", text: "#FFFFFF", accent: "#FF9A56", track: "rgba(255, 255, 255, 0.2)", glow: "#FF9A56", font: "Fredoka", flag: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"] },
    ace: { panel: "rgba(16, 16, 22, 0.86)", text: "#F1F1F1", accent: "#B075C9", track: "rgba(255, 255, 255, 0.2)", glow: "#B075C9", font: "Fredoka", flag: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"] }
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
      flag: P.flag ? flagGradient(P.flag) : ""
    };
  }

  function applyTheme() {
    var root = el.app;
    var L = cfg.look;
    var T = themeColours();
    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--panel", T.panel);
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
    set("--track", T.track);
    set("--glow", T.glow);
    set("--thanks-scale", String(L.thanksScale));
    set("--thanks-w", L.thanksWeight);
    set("--c-thanks", T.thanks);
    set("--bar-h", L.barH + "em");
    set("--row-gap", L.rowGap + "em");
    set("--fill-s", L.fillSeconds + "s");

    if (L.animations) root.classList.remove("no-motion");
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
    var k = Math.max(0.3, Math.floor(boxHeight / height * 1000) / 1000 * 0.99);
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
      try { SE_API.store.set(STORE_KEY, { subs: subs, bitsLeft: bitsLeft, tracking: tracking, incentives: keep, nextId: nextId }); }
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

  // ---------------------------------------------------------------------------
  // Roles & permissions
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
    if (kind === "reset") { rearm(); bitsLeft = 0; }
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
    showBitsAnimation(amount, before, whole, bitsLeft);
    if (!goalSoundTakesOver(unlocked)) playSound("bits");
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
    return Math.min(100, Math.round(n / cfg.bitsPerSub * 1000) / 10) + "%";
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
    var label = " " + cfg.bitsLabel;
    var show = function (n) { el.bitsStatus.textContent = n + "/" + cfg.bitsPerSub + label; };
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

  function showBitsAnimation(amount, before, whole, after) {
    if (!cfg.showBits || !el.bits) return;
    var per = cfg.bitsPerSub;
    var calc = cfg.bitsCalcMs;
    clearBitsTimers();

    el.bits.hidden = false;
    el.bits.classList.remove("converted");
    el.bits.classList.remove("enter");
    void el.bits.offsetWidth;
    el.bits.classList.add("enter");

    el.bitsGain.textContent = "+" + amount + " " + cfg.bitsLabel;
    bump(el.bitsGain);
    el.bitsStatus.textContent = before + "/" + per + " " + cfg.bitsLabel;
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
        el.bitsStatus.textContent = "0/" + per + " " + cfg.bitsLabel;
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
