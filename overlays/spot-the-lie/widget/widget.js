/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Two Truths and a Lie. StreamElements widget logic.
   The card is only ever drawn from what has already been read out. Given the secret key, the widget also
   sends the server's commands from chat. */
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

  var STORE_KEY = "spot_the_lie_v1";

  /* Style presets. The same twenty-two, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. */
  var PRESETS = {
    glass: {
      bg: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", onAccent: "#111111",
      row: "rgba(255, 255, 255, 0.12)", track: "rgba(255, 255, 255, 0.2)",
      segs: ["#FFFFFF", "#D9D9D9", "#BFBFBF", "#EDEDED", "#A6A6A6", "#CCCCCC", "#F5F5F5", "#B3B3B3"],
      font: "BioRhyme"
    },
    textonly: {
      bg: "rgba(0, 0, 0, 0)", text: "#FFFFFF", accent: "#FFFFFF", onAccent: "#111111",
      row: "rgba(255, 255, 255, 0.12)", track: "rgba(255, 255, 255, 0.28)",
      segs: ["#FFFFFF", "#D9D9D9", "#BFBFBF", "#EDEDED", "#A6A6A6", "#CCCCCC", "#F5F5F5", "#B3B3B3"],
      font: "BioRhyme"
    },
    frost: {
      bg: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.07)", track: "rgba(0, 0, 0, 0.14)",
      segs: ["#1B2130", "#3A4256", "#5B6478", "#2A3248", "#7A839A", "#454E64", "#1F2840", "#69728A"],
      font: "BioRhyme"
    },
    midnight: {
      bg: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#89AFFF", onAccent: "#0A122E",
      row: "rgba(127, 168, 255, 0.12)", track: "rgba(127, 168, 255, 0.22)",
      segs: ["#7FA8FF", "#4F77D6", "#A9C4FF", "#3A5BB0", "#C9DAFF", "#6A90E8", "#8FB0FF", "#2B4690"],
      font: "BioRhyme"
    },
    sunset: {
      bg: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", onAccent: "#30122A",
      row: "rgba(255, 154, 90, 0.12)", track: "rgba(255, 154, 90, 0.24)",
      segs: ["#FF9A5A", "#FF6B8A", "#FFC27A", "#E0508F", "#FFD9A0", "#FF7F6B", "#F4A261", "#C44581"],
      font: "BioRhyme"
    },
    forest: {
      bg: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", onAccent: "#0C241C",
      row: "rgba(111, 214, 160, 0.12)", track: "rgba(111, 214, 160, 0.22)",
      segs: ["#6FD6A0", "#3FAE7C", "#9BEBC1", "#2E8C62", "#C4F5DA", "#59C48C", "#7FE0AE", "#237052"],
      font: "BioRhyme"
    },
    ocean: {
      bg: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", onAccent: "#06242F",
      row: "rgba(76, 211, 224, 0.12)", track: "rgba(76, 211, 224, 0.22)",
      segs: ["#4CD3E0", "#2FA4B8", "#8FEAF2", "#1F7F96", "#B8F3F8", "#3DBBCB", "#6BDDE8", "#16647A"],
      font: "BioRhyme"
    },
    rose: {
      bg: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF98BE", onAccent: "#3A0E22",
      row: "rgba(255, 143, 184, 0.12)", track: "rgba(255, 143, 184, 0.24)",
      segs: ["#FF8FB8", "#E0558C", "#FFB3D1", "#C23C74", "#FFD3E3", "#F06FA2", "#FF9DC3", "#A82B62"],
      font: "BioRhyme"
    },
    neon: {
      bg: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", onAccent: "#040410",
      row: "rgba(0, 240, 255, 0.10)", track: "rgba(0, 240, 255, 0.2)",
      segs: ["#00F0FF", "#FF2BD6", "#B6FF00", "#FFB300", "#7A5CFF", "#00FF9C", "#FF4D4D", "#4DA3FF"],
      font: "BioRhyme"
    },
    cosycabin: {
      bg: "#F5ECD6", text: "#57442E", accent: "#7C6142", onAccent: "#F5ECD6",
      row: "rgba(255, 255, 255, 0.42)", track: "rgba(0, 0, 0, 0.11)",
      segs: ["#CB9265", "#9A7A4E", "#DFBD7B", "#6E5636", "#E2C79B", "#8B6F47", "#B8834F", "#7A5C3A"],
      font: "Chicle"
    },
    pastel: {
      bg: "#FFF6E9", text: "#6B4F3A", accent: "#BF684C", onAccent: "#FFF6E9",
      row: "rgba(255, 255, 255, 0.42)", track: "rgba(0, 0, 0, 0.11)",
      segs: ["#FF8A65", "#F7B5CA", "#A8E6CF", "#9BD3E3", "#FFD1A9", "#C7B9E8", "#FFE08A", "#F49BA5"],
      font: "Baloo 2"
    },
    celestial: {
      bg: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", onAccent: "#2E1A47",
      row: "rgba(255, 255, 255, 0.12)", track: "rgba(255, 255, 255, 0.18)",
      segs: ["#8E7CC3", "#E8C06B", "#5B4A8A", "#C9B6E4", "#6D5BA6", "#3B2A5E", "#B39DDB", "#D4AF37"],
      font: "Cinzel"
    },
    pastelgoth: {
      bg: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", onAccent: "#3A3340",
      row: "rgba(255, 255, 255, 0.12)", track: "rgba(255, 255, 255, 0.18)",
      segs: ["#C8B6E2", "#D9A7C7", "#A88FC0", "#8E7B9E", "#6E6080", "#B695C8", "#E0BBD4", "#4F4658"],
      font: "Quicksand"
    },
    pastelpink: {
      bg: "#FFE3EC", text: "#6A2E4B", accent: "#BF5179", onAccent: "#FFF5F9",
      row: "rgba(255, 255, 255, 0.5)", track: "rgba(106, 46, 75, 0.14)",
      segs: ["#F7A8C6", "#FFC8DD", "#E0679A", "#FBB1BD", "#D98BB0", "#FFD6E6", "#F28DB2", "#C95F8B"],
      font: "Fredoka"
    },
    pastelsage: {
      bg: "#DEEBD8", text: "#2B4636", accent: "#4A7A5A", onAccent: "#F5FAF2",
      row: "rgba(255, 255, 255, 0.5)", track: "rgba(43, 70, 54, 0.14)",
      segs: ["#A8CBB0", "#CFE4C9", "#6FA283", "#BCD8B3", "#8DB89B", "#DCEBD3", "#7DAE8C", "#5B8F6D"],
      font: "Fredoka"
    },
    faegreen: {
      bg: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", onAccent: "#2C4A36",
      row: "rgba(238, 245, 218, 0.12)", track: "rgba(238, 245, 218, 0.2)",
      segs: ["#C9E265", "#8FB84E", "#E6F29A", "#6E9A45", "#F2F7C0", "#A8CB62", "#B7D96D", "#4F7A3A"],
      font: "Almendra"
    },
    pride: {
      bg: "rgba(194, 168, 154, 0.9)", text: "#1A1426", accent: "#1A1426", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088", "#E50000", "#FF8D00"],
      font: "Fredoka",
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #E50000, #FF8D00, #FFEE00, #028121, #004CFF, #770088)"
    },
    trans: {
      bg: "rgba(185, 201, 225, 0.9)", text: "#1A1426", accent: "#1A1426", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#5BCEFA", "#F5A9B8", "#FFFFFF", "#5BCEFA", "#F5A9B8"],
      font: "Fredoka",
      bgimg: "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)"
    },
    bi: {
      bg: "rgba(117, 39, 142, 0.9)", text: "#FFFFFF", accent: "#FFFFFF", onAccent: "#1A1426",
      row: "rgba(255, 255, 255, 0.14)", track: "rgba(255, 255, 255, 0.24)",
      segs: ["#D60270", "#9B4F96", "#0038A8", "#D60270", "#9B4F96", "#0038A8", "#D60270", "#9B4F96"],
      font: "Fredoka",
      bgimg: "linear-gradient(135deg, #D60270, #D60270, #9B4F96, #0038A8, #0038A8)"
    },
    pan: {
      bg: "rgba(181, 142, 132, 0.9)", text: "#1A1426", accent: "#1A1426", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#FF218C", "#FFD800", "#21B1FF", "#FF218C", "#FFD800", "#21B1FF", "#FF218C", "#FFD800"],
      font: "Fredoka",
      bgimg: "linear-gradient(135deg, #FF218C, #FFD800, #21B1FF)"
    },
    enby: {
      bg: "rgba(212, 202, 192, 0.9)", text: "#1A1426", accent: "#2D2D2D", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D", "#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"],
      font: "Fredoka",
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #FFF433, #FFFFFF, #9B59D0, #2D2D2D)"
    },
    lesbian: {
      bg: "rgba(232, 167, 169, 0.9)", text: "#1A1426", accent: "#1A1426", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262", "#EF7627"],
      font: "Fredoka",
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.40), rgba(255, 255, 255, 0.40)), linear-gradient(135deg, #D52D00, #EF7627, #FF9A56, #FFFFFF, #D162A4, #B55690, #A30262)"
    },
    ace: {
      bg: "rgba(202, 187, 202, 0.9)", text: "#1A1426", accent: "#000000", onAccent: "#FFFFFF",
      row: "rgba(0, 0, 0, 0.08)", track: "rgba(26, 20, 38, 0.34)",
      segs: ["#A3A3A3", "#FFFFFF", "#800080", "#000000", "#A3A3A3", "#FFFFFF", "#800080", "#000000"],
      font: "Fredoka",
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), linear-gradient(135deg, #000000, #A3A3A3, #FFFFFF, #800080)"
    }
  };
  var BASE = PRESETS.glass;

  var LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
  var MAX_OPTIONS = 8;
  var MIN_OPTIONS = 2;
  var UNDO_DEPTH = 6;

  // ---- runtime state ----
  var cfg = {};
  var el = {};
  var poll = null;        // the current or most recent poll (see newPoll)
  var undoStack = [];     // snapshots, most recent last
  var saveTimer = null;
  var tickTimer = null;
  var hideTimer = null;
  var loadToken = 0;      // guards against a stale store read landing after a newer load
  var lastFitKey = null;  // what the card was last measured against, so refits are rare
  var fontsWatched = false;
  var resizeWatched = false;
  var resizeTimer = null;
  var lastFit = null;    // what the last measurement saw, for the troubleshooting readout
  var lastTickLeft = null; // the last second a tick sound played for
  var followTimer = null; // asks the answer server what has been revealed
  var followRev = null;   // the server's last change that has been seen; null until it first answers
  var followBusy = 0;     // when the request still waiting for an answer was sent, or 0
  var waitingWho = null;  // who is up, heard before their poll was opened
  var followSeq = 0;      // only the newest answer from the server is used
  var noticeTimer = null;
  var NOTICE_MS = 8000;
  var PRAISE_NAMES = 100;                 // more than this are counted instead of listed
  var PRAISE_MARGIN = 0.4;                // seconds the roll finishes ahead of the card leaving
  var praiseShown = "";                   // the list on screen, so drawing again does not restart its scroll
  var rounds = [];                        // who spotted each revealed lie, which is what the leaderboard adds up
  var ROUNDS_KEPT = 500;
  var SERVER_COMMANDS = { "!lie": "step", "!lieprev": "prev", "!lienext": "next", "!liereset": "reset", "!lierefresh": "refresh" };

  function cmd(v, dflt) {
    return str(v, dflt).toLowerCase().trim();
  }

  function readConfig(f) {
    f = f || {};
    cfg = {
      decor: readDecor(f),
      cmd: cmd(f.command, "!vote"),
      whoCanManage: str(f.whoCanManage, "mods"),
      duration: clamp(Math.round(num(f.duration, 45)), 5, 600),
      allowChangeVote: bool(f.allowChangeVote, true),
      matchMode: str(f.matchMode, "exact"),
      liveResults: bool(f.liveResults, true),
      tieBreak: str(f.tieBreak, "show"),
      reopenSeconds: clamp(Math.round(num(f.reopenSeconds, 15)), 5, 300),
      resultSeconds: clamp(Math.round(num(f.resultSeconds, 10)), 0, 600),
      title: str(f.title, "Which one is the lie?"),
      serverUrl: str(f.serverUrl, "").trim().replace(/\/+$/, "").replace(/\/state$/, ""),
      followSeconds: clamp(num(f.followSeconds, 2), 1, 30),
      serverKey: str(f.serverKey, "").trim(),
      lieLabel: str(f.lieLabel, "The lie was"),
      praise: bool(f.praise, true),
      leaderboard: bool(f.leaderboard, true),
      leaderboardTitle: str(f.leaderboardTitle, "Leaderboard"),
      leaderboardSize: clamp(Math.round(num(f.leaderboardSize, 5)), 3, 10),
      praiseTitle: str(f.praiseTitle, "Well Done"),
      praiseAfter: clamp(Math.round(num(f.praiseAfter, 5)), 1, 60),
      praiseSeconds: clamp(Math.round(num(f.praiseSeconds, 10)), 3, 60),
      answersTitle: str(f.answersTitle, "{name}'s Answers"),
      spotLabel: str(f.spotLabel, "Spot the lie.."),
      resultLabel: str(f.resultLabel, "Chat says"),
      tieLabel: str(f.tieLabel, "It's a tie"),
      emptyLabel: str(f.emptyLabel, "Nobody voted"),
      showHint: bool(f.showHint, true),
      debug: bool(f.debug, false),
      scale: clamp(Math.round(num(f.scale, 100)), 25, 400) / 100,
      themePreset: str(f.themePreset, "glass"),
      panelOpacity: clamp(num(f.panelOpacity, 0.55), 0, 1),
      usePanelOpacity: bool(f.usePanelOpacity, false),
      fontFamily: str(f.fontFamily, BASE.font),
      colors: {
        bg: str(f.colorPanel, "#000000"),
        text: str(f.cText, "#FFFFFF"),
        accent: str(f.cAccent, "#FFFFFF")
      },
      urgentSeconds: clamp(Math.round(num(f.urgentSeconds, 5)), 0, 60),
      words: {
        vote: str(f.voteWord, "vote"),
        votes: str(f.votesWord, "votes"),
        blindSuffix: txt(f.blindSuffix, " in"),
        hintVerb: str(f.hintVerb, "type"),
        hintTo: str(f.hintTo, "to"),
        hintOr: str(f.hintOr, "or"),
        hintSuffix: txt(f.hintSuffix, "in chat"),
        timerSuffix: str(f.timerSuffix, ""),
        spottedLabel: str(f.spottedLabel, "spotted it"),
        who: str(f.whoLabel, "was")
      },
      // Colours used when the preset is Custom; a preset colours every part itself.
      custom: {
        border: str(f.colorBorder, "#FFFFFF"), title: str(f.colorTitle, "#FFFFFF"),
        pillBg: str(f.colorPillBg, "#FFFFFF"), pill: str(f.colorPill, "#111111"),
        eyebrowBg: str(f.colorEyebrowBg, "#FFFFFF"), eyebrow: str(f.colorEyebrow, "#111111"),
        onAccent: str(f.colorOnAccent, "#111111"),
        row: str(f.colorRow, "#FFFFFF"), key: str(f.colorKey, "#111111"), label: str(f.colorLabel, "#FFFFFF"),
        track: str(f.cTrack, "#FFFFFF"), count: str(f.colorCount, "#FFFFFF"),
        winBg: str(f.colorWinBg, "#FFFFFF"), win: str(f.colorWin, "#111111"), foot: str(f.colorFoot, "#FFFFFF"),
        segs: ["A", "B", "C", "D", "E", "F", "G", "H"].map(function (k, i) { return str(f["colorSeg" + k], BASE.segs[i]); })
      },
      look: {
        gap: clamp(num(f.cardGap, 0.45), 0, 3), padV: clamp(num(f.paddingV, 0.75), 0, 4), padH: clamp(num(f.paddingH, 0.9), 0, 4),
        borderW: clamp(num(f.borderWidth, 0.22), 0, 1.5), frame: bool(f.outerFrame, true), radius: clamp(num(f.radius, 1.1), 0, 4),
        rowGap: clamp(num(f.rowGap, 0.28), 0, 2), shadow: bool(f.shadow, true), textShadow: bool(f.textShadow, false),
        tail: bool(f.showTail, true), pillTilt: clamp(num(f.timerTilt, -2), -20, 20), eyebrowTilt: clamp(num(f.eyebrowTilt, -1.5), -20, 20),
        pillRadius: clamp(num(f.timerRadius, 0.6), 0, 3), eyebrowUpper: bool(f.eyebrowUppercase, true),
        titleScale: clamp(num(f.titleScale, 1.08), 0.5, 3), titleWeight: str(f.titleWeight, "700"),
        titleFont: bool(f.titleOwnFont, false) ? str(f.titleFont, "Chicle") : "",
        timerScale: clamp(num(f.timerScale, 0.95), 0.5, 3), timerWeight: str(f.timerWeight, "700"),
        eyebrowScale: clamp(num(f.eyebrowScale, 0.8), 0.4, 3), eyebrowWeight: str(f.eyebrowWeight, "700"),
        eyebrowSpacing: clamp(num(f.eyebrowSpacing, 0.12), 0, 0.6),
        labelScale: clamp(num(f.labelScale, 0.98), 0.5, 3), labelWeight: str(f.labelWeight, "700"),
        keyScale: clamp(num(f.keyScale, 0.92), 0.5, 3), keyWeight: str(f.keyWeight, "700"),
        countScale: clamp(num(f.countScale, 0.84), 0.4, 3), countWeight: str(f.countWeight, "700"), countOpacity: clamp(num(f.countOpacity, 0.9), 0, 1),
        footScale: clamp(num(f.footScale, 0.72), 0.4, 3), footWeight: str(f.footWeight, "700"), footOpacity: clamp(num(f.footOpacity, 0.72), 0, 1),
        barWidth: clamp(num(f.barWidth, 4.5), 1, 20), barHeight: clamp(num(f.barHeight, 0.42), 0.1, 2),
        rowOpacity: clamp(num(f.rowOpacity, 0.12), 0, 1), trackOpacity: clamp(num(f.trackOpacity, 0.2), 0, 1),
        lostOpacity: clamp(num(f.lostOpacity, 0.5), 0, 1),
        animate: bool(f.animate, true), fillMs: clamp(num(f.fillSeconds, 0.45), 0, 5),
        enterMs: clamp(num(f.enterSeconds, 0.42), 0, 5), pulseMs: clamp(num(f.pulseSeconds, 0.8), 0.2, 5)
      },
      sounds: {
        enabled: !bool(f.mute, false),
        open: { url: str(f.openSound, ""), vol: clamp(num(f.openSoundVolume, 70), 0, 100) },
        vote: { url: str(f.voteSound, ""), vol: clamp(num(f.voteSoundVolume, 40), 0, 100) },
        tick: { url: str(f.tickSound, ""), vol: clamp(num(f.tickSoundVolume, 60), 0, 100) },
        result: { url: str(f.resultSound, ""), vol: clamp(num(f.resultSoundVolume, 80), 0, 100) }
      }
    };
  }

  // Each play makes a fresh Audio, so quick votes can overlap.
  function playSound(kind) {
    var snd = cfg.sounds;
    if (!snd || !snd.enabled || !snd[kind] || !snd[kind].url) return;
    if (typeof Audio === "undefined") return;
    try {
      var a = new Audio(snd[kind].url);
      a.volume = clamp(snd[kind].vol / 100, 0, 1);
      var pr = a.play();
      if (pr && typeof pr.catch === "function") pr.catch(function () { /* autoplay refused */ });
    } catch (e) { /* sound is best-effort */ }
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  // A preset's panel made as solid as the Panel opacity setting says, when the checkbox asks for it: a colour takes the opacity outright,
  // and a picture (a flag) has each of its colours made that much more see-through.
  function colorAt(css, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(css), n;
    if (m) { n = parseInt(m[1], 16); return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + a + ")"; }
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(css);
    return m ? "rgba(" + m[1] + ", " + m[2] + ", " + m[3] + ", " + a + ")" : css;
  }
  function fadeImage(css, a) {
    return String(css).replace(/#([0-9a-f]{6})\b|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/gi, function (all, hex, r, g, b, al) {
      if (hex) return colorAt("#" + hex, a);
      return "rgba(" + r + ", " + g + ", " + b + ", " + Math.round((al === undefined ? 1 : parseFloat(al)) * a * 1000) / 1000 + ")";
    });
  }
  function resolvedTheme() {
    var p = PRESETS[cfg.themePreset] || BASE;
    if (cfg.themePreset === "custom") {
      return {
        bg: rgba(cfg.colors.bg, cfg.panelOpacity), text: cfg.colors.text, accent: cfg.colors.accent,
        onAccent: cfg.custom.onAccent, row: rgba(cfg.custom.row, cfg.look.rowOpacity),
        track: rgba(cfg.custom.track, cfg.look.trackOpacity), segs: cfg.custom.segs, font: cfg.fontFamily
      };
    }
    var solid = cfg.usePanelOpacity ? cfg.panelOpacity : null;
    return {
      bg: solid === null ? p.bg : colorAt(p.bg, solid), text: p.text, accent: p.accent, onAccent: p.onAccent || p.bg,
      row: p.row || "rgba(255, 255, 255, 0.42)", track: p.track || "rgba(0, 0, 0, 0.11)",
      segs: p.segs, font: p.font, bgimg: solid === null || !p.bgimg ? (p.bgimg || "") : fadeImage(p.bgimg, solid), flagSrc: p.bgimg || ""
    };
  }

  // A pride preset's frame is its flag's stripes, top to bottom, in a ring over the panel's edge.
  function stripeGradient(stripes) {
    var n = stripes.length, parts = [];
    for (var i = 0; i < n; i++) parts.push(stripes[i] + " " + (i * 100 / n) + "% " + ((i + 1) * 100 / n) + "%");
    return "linear-gradient(180deg, " + parts.join(", ") + ")";
  }
  function stripesOf(bgimg) { return String(bgimg || "").match(/#[0-9A-Fa-f]{6}/g) || []; }

  function applyTheme() {
    var t = resolvedTheme();
    var root = el.app;
    if (!root) return;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--bg-img", t.bgimg || "none");
    // A pale stripe, such as the white of a flag, keeps its edge on a pale card.
    root.style.setProperty("--edge", t.bgimg ? "inset 0 0 0 1px rgba(20, 16, 38, 0.38)" : "none");
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--font", '"' + t.font + '", "Baloo 2", "Segoe UI", sans-serif');
    root.style.setProperty("--scale", String(cfg.scale));

    // A preset colours every part from its own tones; Custom takes each part's picker.
    var custom = cfg.themePreset === "custom";
    var C = cfg.custom, L = cfg.look;
    var pick = function (own, fallback) { return custom ? own : fallback; };
    // The outer frame is a border in the accent colour. With it off, the outline is what the settings describe, if anything.
    var stripes = L.frame && !custom ? stripesOf(t.flagSrc || t.bgimg) : [];
    root.style.setProperty("--frame-img", stripes.length ? stripeGradient(stripes) : "none");
    root.style.setProperty("--c-border", L.frame ? (stripes.length ? "transparent" : t.accent) : pick(C.border, t.accent));
    root.style.setProperty("--c-title", pick(C.title, t.text));
    root.style.setProperty("--c-pill-bg", pick(C.pillBg, t.accent));
    root.style.setProperty("--c-pill", pick(C.pill, t.onAccent));
    root.style.setProperty("--c-eyebrow-bg", pick(C.eyebrowBg, t.accent));
    root.style.setProperty("--c-eyebrow", pick(C.eyebrow, t.onAccent));
    root.style.setProperty("--c-row", t.row);
    root.style.setProperty("--c-key", pick(C.key, t.onAccent));
    root.style.setProperty("--c-label", pick(C.label, t.text));
    root.style.setProperty("--c-track", t.track);
    root.style.setProperty("--c-count", pick(C.count, t.text));
    root.style.setProperty("--c-win-bg", pick(C.winBg, t.accent));
    root.style.setProperty("--c-win", pick(C.win, t.onAccent));
    root.style.setProperty("--c-foot", pick(C.foot, t.text));

    root.style.setProperty("--gap", String(L.gap));
    root.style.setProperty("--pad-v", String(L.padV));
    root.style.setProperty("--pad-h", String(L.padH));
    // The frame is an inset ring, which takes no room. Unticked, an outline is a border, as it always was.
    root.style.setProperty("--frame-w", String(L.frame ? (L.borderW > 0 ? L.borderW : 0.14) : 0));
    root.style.setProperty("--border-w", String(L.frame ? 0 : L.borderW));
    root.style.setProperty("--radius", String(L.radius));
    root.style.setProperty("--row-gap", String(L.rowGap));
    root.style.setProperty("--shadow", L.shadow ? "0 0.5em 1.4em rgba(0, 0, 0, 0.28)" : "none");
    root.style.setProperty("--text-shadow", L.textShadow ? "0 0.06em 0.18em rgba(0, 0, 0, 0.5)" : "none");
    root.style.setProperty("--tail-display", L.tail ? "block" : "none");
    root.style.setProperty("--pill-tilt", L.pillTilt + "deg");
    root.style.setProperty("--eyebrow-tilt", L.eyebrowTilt + "deg");
    root.style.setProperty("--pill-radius", String(L.pillRadius));
    root.style.setProperty("--eyebrow-case", L.eyebrowUpper ? "uppercase" : "none");
    root.style.setProperty("--title-scale", String(L.titleScale));
    root.style.setProperty("--title-w", L.titleWeight);
    root.style.setProperty("--title-font", L.titleFont ? '"' + L.titleFont + '", "Baloo 2", "Segoe UI", sans-serif' : "inherit");
    root.style.setProperty("--timer-scale", String(L.timerScale));
    root.style.setProperty("--timer-w", L.timerWeight);
    root.style.setProperty("--eyebrow-scale", String(L.eyebrowScale));
    root.style.setProperty("--eyebrow-w", L.eyebrowWeight);
    root.style.setProperty("--eyebrow-spacing", L.eyebrowSpacing + "em");
    root.style.setProperty("--label-scale", String(L.labelScale));
    root.style.setProperty("--label-weight", L.labelWeight);
    root.style.setProperty("--key-scale", String(L.keyScale));
    root.style.setProperty("--key-w", L.keyWeight);
    root.style.setProperty("--count-scale", String(L.countScale));
    root.style.setProperty("--count-weight", L.countWeight);
    root.style.setProperty("--count-opacity", String(L.countOpacity));
    root.style.setProperty("--foot-scale", String(L.footScale));
    root.style.setProperty("--foot-w", L.footWeight);
    root.style.setProperty("--foot-opacity", String(L.footOpacity));
    root.style.setProperty("--bar-w", L.barWidth + "em");
    root.style.setProperty("--bar-h", L.barHeight + "em");
    root.style.setProperty("--lost-opacity", String(L.lostOpacity));
    root.style.setProperty("--fill-s", L.fillMs + "s");
    root.style.setProperty("--in-s", L.enterMs + "s");
    root.style.setProperty("--pulse-s", L.pulseMs + "s");
    if (L.animate) root.classList.remove("no-motion");
    else root.classList.add("no-motion");
    // In StreamElements the frame's viewport is the box. The page itself is only as tall as the card.
    var framed = false;
    try { framed = window.self !== window.top; } catch (e) { framed = true; }
    if (framed) {
      root.style.height = "100vh";
      root.style.minHeight = "100vh";
      if (document.body && document.body.style) { document.body.style.margin = "0"; document.body.style.overflow = "hidden"; }
      if (document.documentElement && document.documentElement.style) document.documentElement.style.overflow = "hidden";
    }

    applyDecor(cfg.decor, el.card, !custom && stripesOf(t.flagSrc || t.bgimg).length ? stripesOf(t.flagSrc || t.bgimg) : [t.accent], L.animate, t.text);
    document.body.style.background = "transparent";
    loadFont(t.font);
    if (L.titleFont) loadFont(L.titleFont, "vote-font-link-title");
  }

  // BioRhyme is variable, so ask for its whole weight range.
  var FONT_WEIGHTS = { "BioRhyme": ":wght@200..800" };

  function loadFont(name, id) {
    if (!name) return;
    id = id || "vote-font-link";
    // Single-weight families reject a weight axis.
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
    watchFonts();
  }

  /* Fonts arrive late and change the card's width, so it is measured again once they land. */
  function watchFonts() {
    if (fontsWatched) return;
    if (typeof document === "undefined" || !document.fonts) return;
    fontsWatched = true;

    try {
      if (document.fonts.ready && typeof document.fonts.ready.then === "function") {
        document.fonts.ready.then(refit).catch(function () { /* nothing to do */ });
      }
      if (typeof document.fonts.addEventListener === "function") {
        document.fonts.addEventListener("loadingdone", refit);
      }
    } catch (e) { /* font timing is an optimisation, never a hard requirement */ }
  }

  /* Resizing the box in the StreamElements editor fires no load event. */
  function watchResize() {
    if (resizeWatched || typeof ResizeObserver !== "function" || !el.app) return;
    resizeWatched = true;
    try {
      new ResizeObserver(function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(refit, 120);
      }).observe(el.app);
    } catch (e) { /* older runtimes simply keep the size they were given */ }
  }

  function refit() {
    lastFitKey = null;
    render();
  }

  function segColor(i) {
    var segs = resolvedTheme().segs || BASE.segs;
    return segs[i % segs.length];
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
      try { SE_API.store.set(STORE_KEY, { poll: poll, undoStack: undoStack, rounds: rounds }); }
      catch (e) { /* store is best-effort */ }
    }, 300);
  }
  /* Returns the saved data without installing it, since a poll may open before the store answers. */
  function restoreState(done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(null); return; }
    try {
      Promise.resolve(SE_API.store.get(STORE_KEY)).then(function (saved) {
        done(saved && typeof saved === "object" && (saved.poll || saved.rounds) ? saved : null);
      }).catch(function () { done(null); });
    } catch (e) { done(null); }
  }

  function canManage(roles) {
    if (roles.broadcaster) return true;
    return cfg.whoCanManage === "mods" && roles.mod;
  }

  // ---------------------------------------------------------------------------
  // Poll lifecycle
  // ---------------------------------------------------------------------------
  function newPoll(labels, duration) {
    return {
      id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      status: "running",
      title: cfg.title,
      options: labels.map(function (label) { return { label: label, votes: 0 }; }),
      voters: {},
      duration: duration,
      startedAt: Date.now(),
      endsAt: Date.now() + duration * 1000,
      result: null
    };
  }

  function snapshot() {
    if (!poll) return;
    try { undoStack.push(JSON.parse(JSON.stringify(poll))); }
    catch (e) { return; }
    while (undoStack.length > UNDO_DEPTH) undoStack.shift();
  }

  /* A leading "60s" sets the length of this poll only. */
  function parseStart(rest) {
    var duration = cfg.duration;
    var text = String(rest || "").trim();

    var lead = text.match(/^(\d{1,3})s\b\s*/i);
    if (lead) {
      duration = clamp(parseInt(lead[1], 10), 5, 600);
      text = text.slice(lead[0].length).trim();
    }

    // The usual round is three statements read out loud, so nothing needs typing.
    if (!text) return { labels: LETTERS.slice(0, 3), duration: duration };

    var seen = {};
    var labels = [];
    text.split(",").forEach(function (part) {
      var label = part.trim().replace(/\s+/g, " ");
      if (!label) return;
      var key = label.toLowerCase();
      if (seen[key]) return;          // a duplicate option can never win cleanly
      seen[key] = true;
      if (labels.length < MAX_OPTIONS) labels.push(label);
    });

    if (labels.length < MIN_OPTIONS) return null;
    return { labels: labels, duration: duration };
  }

  function startPoll(labels, duration) {
    snapshot();
    poll = newPoll(labels, duration);
    if (waitingWho) { poll.who = waitingWho.text; poll.whoNumber = waitingWho.number; }
    lastTickLeft = null;
    startTicking();
    saveState();
    render();
    playSound("open");
  }

  function endPoll(reason) {
    if (!poll || poll.status !== "running") return;
    snapshot();
    poll.status = "ended";
    poll.endsAt = Date.now();
    poll.result = computeResult();
    poll.endedBecause = reason || "timer";
    stopTicking();
    saveState();
    render();
    scheduleHide();
    playSound("result");
  }

  function computeResult() {
    var total = 0;
    var best = 0;
    poll.options.forEach(function (o) {
      total += o.votes;
      if (o.votes > best) best = o.votes;
    });

    if (total === 0 || best === 0) {
      return { winners: [], total: 0, tiebroken: false };
    }

    var winners = [];
    poll.options.forEach(function (o, i) { if (o.votes === best) winners.push(i); });

    var tiebroken = false;
    if (winners.length > 1 && cfg.tieBreak === "random") {
      winners = [winners[Math.floor(Math.random() * winners.length)]];
      tiebroken = true;
    }

    return { winners: winners, total: total, tiebroken: tiebroken };
  }

  // ---------------------------------------------------------------------------
  // Reveals
  // ---------------------------------------------------------------------------
  // "B", "b" and "2" all mean the second statement.
  function letterIndex(value) {
    var t = String(value || "").trim().toUpperCase();
    var at = /^\d+$/.test(t) ? parseInt(t, 10) - 1 : LETTERS.indexOf(t);
    return poll && at >= 0 && at < poll.options.length ? at : -1;
  }

  // A reveal belongs to the latest poll that has not had one, even if its result has already left the screen.
  function canReveal() {
    return !!poll && !poll.lie && poll.status !== "cancelled";
  }

  function revealLie(letter, text, who, number) {
    if (!canReveal()) return false;
    var index = letterIndex(letter);
    if (index < 0) return false;
    snapshot();
    if (poll.status === "running") { poll.endsAt = Date.now(); stopTicking(); }
    poll.status = "ended";
    poll.result = computeResult();
    poll.lie = { index: index, text: String(text || ""), number: number || 0 };
    if (who) { poll.who = who; poll.whoNumber = number; }
    waitingWho = null;
    recordRound();
    saveState();
    render();
    scheduleHide();
    playSound("result");
    return true;
  }

  function showWho(who, number) {
    if (poll && poll.status !== "cancelled" && !poll.lie && poll.status !== "hidden" && poll.status !== "board") {
      poll.who = who;
      poll.whoNumber = number;
      saveState();
      render();
    }
    waitingWho = { text: who, number: number };
  }

  // True while the card on screen is that person's three answers, waiting for the lie.
  function showingAnswers(number) {
    return !!poll && !!poll.answers && !poll.lie && poll.status !== "cancelled" && poll.whoNumber === number;
  }

  /* Puts the three answers up for chat to vote on. A vote already opened with bare letters keeps its votes. */
  function showAnswers(answers, heading, number) {
    waitingWho = null;
    if (showingAnswers(number)) return;
    var open = !!poll && poll.status === "running" && !poll.answers && !poll.lie && poll.options.length === 3 && keysOnlyPoll();
    if (!open) startPoll(answers.slice(), cfg.duration);
    else snapshot();
    answers.forEach(function (text, i) { poll.options[i].label = text; });
    poll.answers = true;
    poll.who = heading;
    poll.whoNumber = number;
    saveState();
    render();
  }

  // A card for a poll that has not had its reveal goes back to the plain question.
  function forgetWho() {
    waitingWho = null;
    // Answers that have been taken back, or skipped, come off the screen altogether.
    if (poll && poll.answers && !poll.lie && poll.status !== "cancelled") { cancelPoll(); return; }
    if (poll && !poll.lie && poll.who) {
      delete poll.who;
      delete poll.whoNumber;
      saveState();
      render();
    }
  }

  /* Takes off whatever the undone step put on the card. Voting stays closed, and a reveal typed by hand is never taken back. */
  function takeBack(undone) {
    if (!poll || !undone) return;
    if (undone.part === "lie") { forgetNumber(undone.number); saveState(); }
    if (poll.lie && poll.lie.number === undone.number) {
      delete poll.lie;
      delete poll.praising;
      // If the card had already moved on, a vote that is back in play returns to it.
      if (poll.status === "board" || (poll.answers && poll.status === "hidden")) poll.status = "ended";
      if (undone.part === "who") { delete poll.who; delete poll.whoNumber; }
      saveState();
      render();
      if (poll.status === "ended") scheduleHide();
    } else if (!poll.lie && undone.part === "who" && poll.whoNumber === undone.number) {
      forgetWho();
    }
  }

  /* The first answer after a load only sets the starting point, so a refresh never replays an old reveal. */
  function applyState(state) {
    if (!state || typeof state.rev !== "number") return;
    var first = followRev === null;
    if (!first && state.rev === followRev) return;
    followRev = state.rev;

    var answers = Array.isArray(state.answers) && state.answers.length === 3 ? state.answers.map(String) : null;
    var who = state.who ? "#" + state.number + " " + cfg.words.who + " " + state.who : "";
    if (who && answers) who = cfg.answersTitle.replace("{name}", function () { return state.who; });
    if (state.back) takeBack(state.undone);
    if (!who) { forgetWho(); return; }   // a reset, a skip, or back to before any name
    if (!state.letter) {
      if (answers && !first) showAnswers(answers, who, state.number);
      else if (!answers) showWho(who, state.number);
      return;
    }
    waitingWho = null;
    // Going back never reveals: that lie was read out before this step.
    if (first || state.back) return;
    if (answers && !showingAnswers(state.number) && !(poll && poll.lie && poll.lie.number === state.number)) showAnswers(answers, who, state.number);
    revealLie(state.letter, state.lie, who, state.number);
  }

  // `done` runs once the answer has been applied, or has failed to arrive.
  function askServer(done) {
    if (!cfg.serverUrl || typeof fetch !== "function") return;
    // One question at a time, and one that never answers is given up on after ten seconds.
    if (followBusy && Date.now() - followBusy < 10000) return;
    followBusy = Date.now();
    var seq = ++followSeq;
    var token = loadToken;
    var finish = function (state, problem) {
      if (seq !== followSeq || token !== loadToken) return;
      followBusy = 0;
      if (state) applyState(state);
      if (problem && cfg.debug && typeof console !== "undefined") console.log("[spot the lie] " + problem);
      if (done) done();
    };
    fetch(cfg.serverUrl + "/state", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("the answer server replied " + r.status);
      return r.json();
    }).then(function (state) {
      finish(state);
    }).catch(function (e) {
      finish(null, e.message);
    });
  }

  function hideNotice() {
    if (noticeTimer) { clearTimeout(noticeTimer); noticeTimer = null; }
    if (el.notice) { el.notice.hidden = true; el.notice.textContent = ""; }
  }

  function notice(message) {
    if (!el.notice) return;
    hideNotice();
    el.notice.textContent = String(message).slice(0, 200);
    el.notice.hidden = false;
    noticeTimer = setTimeout(hideNotice, NOTICE_MS);
  }

  // True when the card on screen already shows what a !lie reply read out.
  function onCard(reply) {
    var read = /^#(\d+) (- the lie was|was )/.exec(reply);
    if (!read || !poll || el.card.hidden) return false;
    var number = Number(read[1]);
    if (read[2] === "was ") return poll.whoNumber === number;
    return !!poll.lie && poll.lie.number === number;
  }

  /* Runs one of the server's commands. The id is the chat message's own, so a second copy of this widget
     hearing the same message cannot run it twice. The address holds the key, so it is never logged. */
  function sendCommand(what, id) {
    if (typeof fetch !== "function") return;
    var token = loadToken;
    var url = cfg.serverUrl + "/?q=" + what + "&key=" + encodeURIComponent(cfg.serverKey) + (id ? "&id=" + encodeURIComponent(id) : "");
    fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).then(function (reply) {
      if (token !== loadToken) return;
      reply = String(reply).trim();
      if (/missing its key/.test(reply)) return notice("The answer server refused the key. Check Secret key in the settings.");
      if (!reply || reply.charAt(0) === "<") return notice("That address did not reply like the answer server.");
      followBusy = 0;   // an answer already on its way may be from before this command
      if (what !== "step") { notice(reply); askServer(); return; }
      askServer(function () { if (!onCard(reply)) notice(reply); });
    }).catch(function () {
      // It may have run even so, and sending it again could reveal one step too many.
      if (token === loadToken) notice("No reply from the answer server. Check the card before trying again.");
    });
  }

  function follow() {
    if (followTimer) { clearInterval(followTimer); followTimer = null; }
    followRev = null;
    followBusy = 0;
    waitingWho = null;
    if (!cfg.serverUrl) return;
    followTimer = setInterval(function () { askServer(); }, cfg.followSeconds * 1000);
    askServer();
  }

  function cancelPoll() {
    if (!poll) return;
    snapshot();
    poll.status = "cancelled";
    stopTicking();
    saveState();
    render();
  }

  /* Same options, votes wiped, clock back to full. */
  function restartPoll() {
    if (!poll || !poll.options.length) return;
    snapshot();
    var labels = poll.options.map(function (o) { return o.label; });
    poll = newPoll(labels, poll.duration || cfg.duration);
    startTicking();
    saveState();
    render();
  }

  function extendPoll(seconds) {
    if (!poll || poll.status !== "running") return;
    var add = clamp(Math.round(seconds), 1, 600);
    poll.endsAt += add * 1000;
    poll.duration += add;
    saveState();
    render();
  }

  /* Undo. A poll that comes back past its clock reopens for a short grace window. */
  function undo() {
    if (!undoStack.length) return;
    // The points follow the reveal: undoing one takes them away, and undoing back to one returns them.
    if (poll && poll.lie) forgetRound(poll.id);
    poll = undoStack.pop();
    recordRound();
    if (poll.status === "running" && poll.endsAt <= Date.now()) {
      poll.endsAt = Date.now() + cfg.reopenSeconds * 1000;
    }
    if (poll.status === "running") startTicking(); else stopTicking();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    saveState();
    render();
  }

  // ---------------------------------------------------------------------------
  // Voting
  // ---------------------------------------------------------------------------
  function normalise(s) {
    return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
  }
  function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /* A vote can be the option's text, its number or its letter. */
  function matchVote(text) {
    var t = normalise(text);
    if (!t) return -1;

    /* In a letters-only poll chat reads the chips, so position counts and the label text does not. */
    var byPositionOnly = !poll.answers && keysOnlyPoll();

    for (var i = 0; i < poll.options.length; i++) {
      if (!byPositionOnly && t === normalise(poll.options[i].label)) return i;
      if (t === String(i + 1) || t === "#" + (i + 1)) return i;
      if (t === LETTERS[i].toLowerCase()) return i;
    }

    if (cfg.matchMode === "contains" && !byPositionOnly) {
      for (var j = 0; j < poll.options.length; j++) {
        var label = normalise(poll.options[j].label);
        if (!label) continue;
        if (new RegExp("(^|\\s)" + escapeRe(label) + "($|\\s|[.,!?])").test(t)) return j;
      }
    }

    return -1;
  }

  function castVote(nick, text, shownAs) {
    if (!poll || poll.status !== "running") return;
    if (Date.now() >= poll.endsAt) return;

    var index = matchVote(text);
    if (index < 0) return;

    var voter = String(nick || "").toLowerCase();
    if (!voter) return;

    var had = poll.voters[voter];
    if (had !== undefined) {
      if (!cfg.allowChangeVote) return;   // first answer stands
      if (had === index) return;          // same vote again, nothing to move
      poll.options[had].votes = Math.max(0, poll.options[had].votes - 1);
    }

    poll.voters[voter] = index;
    if (!poll.names) poll.names = {};
    poll.names[voter] = String(shownAs || nick);
    poll.options[index].votes += 1;
    saveState();
    render();
    playSound("vote");
  }

  // ---------------------------------------------------------------------------
  // Clock
  // ---------------------------------------------------------------------------
  function startTicking() {
    stopTicking();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    tickTimer = setInterval(function () {
      if (!poll || poll.status !== "running") { stopTicking(); return; }
      if (Date.now() >= poll.endsAt) endPoll("timer");
      else render();
    }, 250);
  }
  function stopTicking() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function scheduleHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (poll && poll.answers && !poll.lie) return;   // the answers stay up until the lie is revealed
    // First the lie on its own, then the people who spotted it, and only then does the card leave.
    if (cfg.praise && poll && poll.lie && !poll.praising && spotters().length) {
      hideTimer = setTimeout(startPraise, cfg.praiseAfter * 1000);
      return;
    }
    var seconds = poll && poll.praising ? cfg.praiseSeconds : cfg.resultSeconds;
    if (!cfg.resultSeconds) return;   // 0 means leave the result up until told otherwise
    hideTimer = setTimeout(function () {
      if (poll && poll.status === "ended") { poll.status = restingStatus(); saveState(); render(); }
    }, seconds * 1000);
  }

  // The display names of everyone whose vote is on the lie.
  function spotters() {
    if (!poll || !poll.lie) return [];
    var names = poll.names || {};
    return Object.keys(poll.voters).filter(function (voter) { return poll.voters[voter] === poll.lie.index; })
      .map(function (voter) { return Object.prototype.hasOwnProperty.call(names, voter) ? names[voter] : voter; });
  }

  // ---------------------------------------------------------------------------
  // Leaderboard
  // ---------------------------------------------------------------------------
  function forgetRound(id) {
    rounds = rounds.filter(function (r) { return r.id !== id; });
  }

  // Notes who spotted the lie in this poll. Noting the same poll again replaces it, so nothing counts twice.
  function recordRound() {
    if (!poll || !poll.lie) return;
    forgetRound(poll.id);
    var names = poll.names || {};
    var right = Object.keys(poll.voters).filter(function (voter) { return poll.voters[voter] === poll.lie.index; })
      .map(function (voter) { return [voter, Object.prototype.hasOwnProperty.call(names, voter) ? names[voter] : voter]; });
    rounds.push({ id: poll.id, number: poll.lie.number, right: right });
    while (rounds.length > ROUNDS_KEPT) rounds.shift();
  }

  // The server taking a lie back takes the points from the latest round of that number.
  function forgetNumber(number) {
    for (var i = rounds.length - 1; i >= 0; i--) {
      if (rounds[i].number === number) { rounds.splice(i, 1); return; }
    }
  }

  // A point for each correct answer, most first. Level scores share a place, in the order they were reached.
  function standings() {
    var totals = Object.create(null);
    rounds.forEach(function (r, at) {
      r.right.forEach(function (pair) {
        var t = totals[pair[0]] || (totals[pair[0]] = { points: 0 });
        t.points++;
        t.name = pair[1];
        t.at = at;
      });
    });
    var list = Object.keys(totals).map(function (k) { return totals[k]; })
      .sort(function (a, b) { return b.points - a.points || a.at - b.at; });
    list.forEach(function (t, i) { t.place = i && list[i - 1].points === t.points ? list[i - 1].place : i + 1; });
    return list;
  }

  // Between rounds a revealed card rests on the leaderboard. Anything else just leaves.
  function restingStatus() {
    return cfg.leaderboard && poll.lie && standings().length ? "board" : "hidden";
  }

  function showScores() {
    if (!poll || poll.status === "running" || (poll.answers && !poll.lie) || !standings().length) return;
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    poll.status = "board";
    saveState();
    render();
  }

  function clearScores() {
    rounds = [];
    if (poll && poll.status === "board") poll.status = "hidden";
    saveState();
    render();
  }

  function renderBoard() {
    var on = poll.status === "board";
    setClass(el.card, "ranking", on);
    if (!el.board) return;
    el.board.hidden = !on;
    if (!on) return;
    el.boardTitle.textContent = cfg.leaderboardTitle;
    while (el.boardList.firstChild) el.boardList.removeChild(el.boardList.firstChild);
    standings().slice(0, cfg.leaderboardSize).forEach(function (t) {
      var row = document.createElement("li");
      row.className = "vote-board-row";
      [["vote-board-place", t.place + "."], ["vote-board-name", t.name], ["vote-board-points", String(t.points)]].forEach(function (part) {
        var cell = document.createElement("span");
        cell.className = part[0];
        cell.textContent = part[1];
        row.appendChild(cell);
      });
      el.boardList.appendChild(row);
    });
    fitText("--board-fit", [el.boardList], spills);
  }

  function startPraise() {
    if (!poll || poll.status !== "ended" || !poll.lie) return;
    poll.praising = true;
    poll.praisedAt = Date.now();
    saveState();
    render();
    scheduleHide();
  }

  function renderPraise() {
    var on = cfg.praise && !!poll.praising && !!poll.lie && poll.status !== "board";
    setClass(el.card, "praising", on);
    if (!el.praise) return;
    el.praise.hidden = !on;
    if (!on) { praiseShown = ""; return; }

    var all = spotters();
    var lines = all.slice(0, PRAISE_NAMES);
    if (all.length > PRAISE_NAMES) lines.push("and " + (all.length - PRAISE_NAMES) + " more");
    el.praiseTitle.textContent = cfg.praiseTitle;
    var key = JSON.stringify(lines) + (el.praiseWindow.clientWidth || 0) + "x" + (el.praiseWindow.clientHeight || 0) + (el.praiseNames.offsetHeight || 0);
    if (praiseShown === key) return;

    setClass(el.praiseNames, "scroll", false);
    while (el.praiseNames.firstChild) el.praiseNames.removeChild(el.praiseNames.firstChild);
    lines.forEach(function (name) {
      var line = document.createElement("div");
      line.className = "vote-praise-name";
      line.textContent = name;
      el.praiseNames.appendChild(line);
    });

    // Like end credits: up from below the window until the last name has left the top of it.
    var from = el.praiseWindow.clientHeight || 0;
    var to = el.praiseNames.offsetHeight || 0;
    el.praiseNames.style.setProperty("--praise-from", from + "px");
    el.praiseNames.style.setProperty("--praise-to", "-" + to + "px");
    // However long the list, the roll takes the time the card has, so the speed is what changes. Drawn again part
    // way through, it carries on from where it had got to.
    el.praiseNames.style.setProperty("--praise-for", (cfg.praiseSeconds - PRAISE_MARGIN) + "s");
    var gone = Math.max(0, (Date.now() - (poll.praisedAt || Date.now())) / 1000);
    el.praiseNames.style.setProperty("--praise-from-time", "-" + gone.toFixed(2) + "s");
    // A card that is set to stay rolls the names round again, so it is never left empty.
    setClass(el.praiseNames, "again", !cfg.resultSeconds);
    void el.praiseNames.offsetWidth;
    setClass(el.praiseNames, "scroll", true);
    praiseShown = JSON.stringify(lines) + (el.praiseWindow.clientWidth || 0) + "x" + from + to;
  }
  function secondsLeft() {
    if (!poll || poll.status !== "running") return 0;
    return Math.max(0, Math.ceil((poll.endsAt - Date.now()) / 1000));
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function visible() {
    return !!poll && (poll.status === "running" || poll.status === "ended" || (poll.status === "board" && cfg.leaderboard && rounds.length > 0));
  }

  function render() {
    if (!el.card) return;

    if (!visible()) {
      el.card.hidden = true;
      return;
    }
    el.card.hidden = false;

    var running = poll.status === "running";
    var result = poll.result;
    var total = 0;
    var best = 0;
    poll.options.forEach(function (o) {
      total += o.votes;
      if (o.votes > best) best = o.votes;
    });

    // Counts stay hidden while a blind poll is running, then open up at the end.
    var blind = running && !cfg.liveResults;
    setClass(el.card, "blind", blind);

    // Bare letters need no labels, since the chips already show them.
    var keysOnly = !poll.answers && keysOnlyPoll();
    setClass(el.card, "keys-only", keysOnly);
    setClass(el.card, "answers", !!poll.answers);

    el.title.textContent = poll.who || poll.title || cfg.title;

    el.timer.hidden = !running;
    if (running) {
      var left = secondsLeft();
      el.timer.textContent = String(left) + cfg.words.timerSuffix;
      setClass(el.timer, "urgent", left <= cfg.urgentSeconds);
      // One tick a second through the last few seconds, never twice for the same one.
      if (left > 0 && left <= cfg.urgentSeconds && left !== lastTickLeft) {
        lastTickLeft = left;
        playSound("tick");
      }
    }

    renderEyebrow(running, result);
    renderOptions(running, result, total, best, blind, keysOnly);

    // With the answers on the card, the lit row already says what the lie was.
    var lieText = !running && poll.lie && !poll.answers ? poll.lie.text : "";
    if (el.lie) {
      el.lie.hidden = !lieText;
      el.lie.textContent = lieText;
    }

    var W = cfg.words;
    el.total.textContent = (total + " " + (total === 1 ? W.vote : W.votes)) + (blind ? W.blindSuffix : "");

    if (!running && poll.lie) {
      el.total.textContent = poll.options[poll.lie.index].votes + " / " + total + " " + W.spottedLabel;
    }

    el.hint.hidden = !cfg.showHint || !running;
    if (running && cfg.showHint) el.hint.textContent = hintText();

    renderDebug();

    /* Refitting is costly, so it only happens when some text has changed. */
    var fitKey = (poll.answers ? "answers|" : "") + poll.options.map(function (o) { return o.label; }).join("|") +
      "|" + poll.status + "|" + cfg.scale + "|" + (poll.who || poll.title || "") +
      "|" + lieText + "|" + el.eyebrow.textContent + "|" + el.hint.textContent +
      "|" + el.total.textContent.length + "|" + widestCountLength(total, best, blind);
    if (fitKey !== lastFitKey) {
      lastFitKey = fitKey;
      setClass(el.card, "praising", false);
      setClass(el.card, "ranking", false);
      fitToBox();
    }
    renderPraise();
    renderBoard();
  }

  /* Kept short, because this line can set the card's width. */
  function hintText() {
    var keys = poll.options.map(function (o, i) { return LETTERS[i]; });
    var W = cfg.words;
    var tail = W.hintSuffix ? " " + W.hintSuffix : "";
    if (keys.length >= 5) return W.hintVerb + " " + keys[0] + " " + W.hintTo + " " + keys[keys.length - 1] + tail;
    if (keys.length === 1) return W.hintVerb + " " + keys[0] + tail;
    return W.hintVerb + " " + keys.slice(0, -1).join(", ") + " " + W.hintOr + " " + keys[keys.length - 1] + tail;
  }

  /* True when the options are just the poll's own keys, in any order, so their labels can be hidden. */
  function keysOnlyPoll() {
    if (!poll || !poll.options.length) return false;

    var labels = poll.options.map(function (o) { return normalise(o.label); });
    var letters = true;
    var numbers = true;

    for (var i = 0; i < poll.options.length; i++) {
      if (labels.indexOf(LETTERS[i].toLowerCase()) === -1) letters = false;
      if (labels.indexOf(String(i + 1)) === -1) numbers = false;
    }

    return letters || numbers;
  }

  /* Sizing details on one line, for troubleshooting from a screenshot. */
  function renderDebug() {
    if (!el.debug) return;
    el.debug.hidden = !cfg.debug;
    if (!cfg.debug) return;

    var f = lastFit || {};
    var font = resolvedTheme().font;
    var loaded = "?";
    try {
      if (document.fonts && typeof document.fonts.check === "function") {
        loaded = document.fonts.check('16px "' + font + '"') ? "yes" : "NO";
      }
    } catch (e) { /* the readout is best-effort */ }

    var widest = 0;
    var space = el.options ? el.options.clientWidth : 0;
    if (el.options && el.options.children) {
      for (var i = 0; i < el.options.children.length; i++) {
        widest = Math.max(widest, el.options.children[i].scrollWidth || 0);
      }
    }

    el.debug.textContent =
      "box " + (f.hasW || 0) + "x" + (f.hasH || 0) +
      " | wanted " + (f.wantsW || 0) + "x" + (f.wantsH || 0) +
      " | scale " + Math.round(cfg.scale * 100) + "% fit " + (f.fit ? f.fit.toFixed(3) : "1") +
      (f.passes ? "+" + f.passes : "") +
      " | card " + (el.card.offsetWidth || 0) + "x" + (el.card.offsetHeight || 0) +
      " | row " + widest + "/" + space + (widest > space + 1 ? " OVERFLOW" : "") +
      " | font " + font + " loaded:" + loaded;
  }

  /* Length of the widest count, built the way renderOptions builds it. */
  function widestCountLength(total, best, blind) {
    if (blind) return 0;
    var widest = 0;
    poll.options.forEach(function (o) {
      var pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
      widest = Math.max(widest, (o.votes + " · " + pct + "%").length);
    });
    return widest;
  }

  function renderEyebrow(running, result) {
    if (poll.answers && !poll.lie) { el.eyebrow.hidden = false; el.eyebrow.textContent = cfg.spotLabel; return; }
    if (running || !result) { el.eyebrow.hidden = true; return; }
    el.eyebrow.hidden = false;
    if (poll.lie) { el.eyebrow.textContent = cfg.lieLabel + " " + LETTERS[poll.lie.index]; return; }
    if (!result.winners.length) el.eyebrow.textContent = cfg.emptyLabel;
    else if (result.winners.length > 1) el.eyebrow.textContent = cfg.tieLabel;
    else el.eyebrow.textContent = cfg.resultLabel;
  }

  function renderOptions(running, result, total, best, blind, keysOnly) {
    var isWinner = {};
    if (!running && result) result.winners.forEach(function (i) { isWinner[i] = true; });
    var decided = !running && result && result.winners.length > 0;
    // Until the lie is out, lighting chat's favourite would look like the answer.
    if (poll.answers && !poll.lie) { isWinner = {}; decided = false; }
    // Once the lie is known it is the row that lights up, whatever chat thought.
    if (!running && poll.lie) { isWinner = {}; isWinner[poll.lie.index] = true; decided = true; }

    var html = poll.options.map(function (o, i) {
      var pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
      var width = best > 0 ? Math.round((o.votes / best) * 100) : 0;
      var cls = "vote-option";
      if (decided) cls += isWinner[i] ? " win" : " lost";

      return '<li class="' + cls + '" style="--seg:' + segColor(i) + '"' +
        ' data-index="' + i + '" data-votes="' + o.votes + '" data-pct="' + pct + '">' +
        '<span class="vote-key">' + LETTERS[i] + '</span>' +
        (keysOnly ? "" : '<span class="vote-label">' + escapeHtml(o.label) + '</span>') +
        '<span class="vote-bar"><span class="vote-fill" style="width:' + width + '%"></span></span>' +
        '<span class="vote-count">' + (blind ? "" : o.votes + " · " + pct + "%") + '</span>' +
        '</li>';
    }).join("");

    el.options.innerHTML = html;
  }

  function setClass(node, name, on) {
    if (!node || !node.classList) return;
    if (on) node.classList.add(name); else node.classList.remove(name);
  }

  /* The widest the layout is designed to be, in the card's own text size. A narrower box gets smaller text. */
  var DESIGN_EM = 17;
  var SMALLEST_TEXT = 0.35;

  function paddingOf(node) {
    if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
      return { x: 0, y: 0 };
    }
    try {
      var cs = window.getComputedStyle(node);
      return {
        x: (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0),
        y: (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
      };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }

  function fontPxOf(node) {
    if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") return 0;
    return parseFloat(window.getComputedStyle(node).fontSize) || 0;
  }

  // Exact, because text a fraction of a pixel too wide still gets cut off with dots.
  function tooWide(node) {
    if (node.scrollWidth > node.clientWidth) return true;
    if (typeof document.createRange !== "function") return false;
    var range = document.createRange();
    range.selectNodeContents(node);
    return range.getBoundingClientRect().width > node.getBoundingClientRect().width + 0.05;
  }

  // For text that may wrap. Tall letters can poke a little past their line, so only part of a further line counts.
  function spills(node) {
    return node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + Math.max(1, fontPxOf(node) * 0.4);
  }

  // Shrinks one kind of text, through a property on the card, until every piece of it fits its own space.
  function fitText(property, nodes, over) {
    var size = 1;
    el.card.style.setProperty(property, "1");
    while (size > SMALLEST_TEXT && nodes.some(over)) {
      size = Math.max(SMALLEST_TEXT, size * 0.94);
      el.card.style.setProperty(property, size.toFixed(3));
    }
  }

  function found(selector) {
    if (!el.options || typeof el.options.querySelectorAll !== "function") return [];
    return Array.prototype.slice.call(el.options.querySelectorAll(selector));
  }

  /* The card is always the size of the box. Its text size comes from the box and the number of rows, never from
     the words, and then any words too long for their space are shrunk on their own. */
  function fitToBox() {
    if (!el.card || !el.app || !el.card.classList) return;

    setClass(el.card, "answers", !!(poll && poll.answers));
    el.card.style.removeProperty("--em");
    el.card.style.setProperty("--fit", "1");

    var pad = paddingOf(el.app);
    var hasW = el.app.clientWidth - pad.x;
    var hasH = el.app.clientHeight - pad.y;

    el.card.classList.add("measuring");
    var basePx = fontPxOf(el.card);
    if (basePx) el.card.style.setProperty("--em", basePx + "px");
    var needsH = el.card.offsetHeight;
    el.card.classList.remove("measuring");

    // The headless tests have no layout and report zeroes.
    if (!hasW || !hasH || !needsH) return;

    var wantsW = basePx ? basePx * DESIGN_EM : el.card.offsetWidth;
    // The Text size setting can only make text smaller than the largest that fits.
    var fit = Math.min(hasW / wantsW, hasH / needsH) * 0.98 * Math.min(1, cfg.scale);
    var passes = 0;
    var apply = function () {
      el.card.style.setProperty("--fit", String(Math.floor(fit * 1000) / 1000));
      var px = fontPxOf(el.card);
      if (px) el.card.style.setProperty("--em", px + "px");
    };
    apply();

    // Line boxes round to whole pixels, so nudge down until the fixed parts are all inside.
    while (passes < 10 && el.card.scrollHeight > el.card.clientHeight + 1) {
      fit *= 0.96;
      passes++;
      apply();
    }
    lastFit = { wantsW: Math.round(wantsW), wantsH: needsH, hasW: hasW, hasH: hasH, fit: fit, passes: passes };

    fitText("--title-fit", el.title ? [el.title] : [], tooWide);
    fitText("--lie-fit", el.lie && !el.lie.hidden ? [el.lie] : [], spills);
    fitText("--label-fit", found(".vote-label"), spills);
    fitText("--count-fit", found(".vote-count"), tooWide);
    fitText("--foot-fit", el.hint && !el.hint.hidden ? [el.hint] : [], tooWide);
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------
  function handleMessage(data) {
    if (!data) return;
    var text = String(data.text || "").trim();
    if (!text) return;
    var first = text.toLowerCase().split(/\s+/)[0];
    var rest = text.replace(/^\S+\s*/, "").trim();
    var roles = rolesOf(data);
    var manage = canManage(roles);
    // Without a key these are left for a chatbot to handle.
    if (cfg.serverKey && cfg.serverUrl && Object.prototype.hasOwnProperty.call(SERVER_COMMANDS, first)) {
      if (manage && !rest) sendCommand(SERVER_COMMANDS[first], data.msgId);
      return;
    }
    // Commands come first, so they are never counted as votes. A verb only counts when it is the whole line.
    if (first === cfg.cmd) {
      if (!manage) return;
      var verb = rest.toLowerCase();
      var ext = /^extend(?:\s+(\d+))?$/.exec(verb);
      var rev = /^reveal\s+([a-h]|[1-8])$/.exec(verb);
      if (rev) revealLie(rev[1], "", "");
      else if (verb === "end") endPoll("manual");
      else if (verb === "cancel") cancelPoll();
      else if (verb === "restart") restartPoll();
      else if (verb === "undo") undo();
      else if (ext) extendPoll(ext[1] ? num(ext[1], 15) : 15);
      else if (verb === "results") {
        if (poll && poll.result) {
          if (poll.status === "board") delete poll.praising;   // from the leaderboard, the reveal plays again
          poll.status = "ended"; render(); scheduleHide();
        }
      } else if (verb === "scores") {
        showScores();
      } else if (verb === "scores clear") {
        clearScores();
      } else if (verb === "hide") {
        if (poll) { poll.status = "hidden"; stopTicking(); saveState(); render(); }
      } else {
        var parsed = parseStart(rest);
        if (parsed) startPoll(parsed.labels, parsed.duration);
      }
      return;
    }

    castVote(data.nick || data.displayName, text, data.displayName);
  }

  function handleButton(field) {
    switch (field) {
      case "btnDemo":
        startPoll(LETTERS.slice(0, 3), cfg.duration);
        break;
      case "btnEnd": endPoll("manual"); break;
      case "btnRestart": restartPoll(); break;
      case "btnCancel": cancelPoll(); break;
      case "btnUndo": undo(); break;
      case "btnClearScores": clearScores(); break;
      case "btnExtend": extendPoll(15); break;
      case "btnSoundOpen": playSound("open"); break;
      case "btnSoundVote": playSound("vote"); break;
      case "btnSoundTick": playSound("tick"); break;
      case "btnSoundResult": playSound("result"); break;
    }
  }

  window.addEventListener("onEventReceived", function (obj) {
    if (!obj || !obj.detail) return;
    var listener = obj.detail.listener;
    var event = obj.detail.event || {};
    if (listener === "message") handleMessage(event.data || {});
    else if (listener === "widget-button") handleButton(event.field);
  });

  // ---- decorations, shared by every overlay in this set ----
  // Small shapes (sparkles, hearts, stars and so on) drawn behind a panel's words, in the accent colour, or in a pride preset's
  // flag colours. They are placed by a fixed recipe and not at random, so they sit in the same places every time the widget loads.
  var DECOR_KINDS = { sparkles: 1, hearts: 1, stars: 1, flowers: 1, moons: 1, snowflakes: 1, bubbles: 1, butterflies: 1, clouds: 1, leaves: 1, paws: 1, notes: 1, bows: 1, mixed: 1 };
  var DECOR_MOTION = { twinkle: 1, drift: 1, still: 1 };
  var DECOR_PLACE = { scatter: 1, edges: 1, corners: 1, offset: 1, border: 1 };
  var DECOR_COLOR = { accent: 1, text: 1, mixed: 1, custom: 1 };
  function readDecor(f) {
    f = f || {};
    var kind = str(f.decoration, "none"), motion = str(f.decorationMotion, "twinkle"), place = str(f.decorationPlacement, "scatter"), color = str(f.decorationColor, "accent");
    return {
      kind: DECOR_KINDS[kind] === 1 ? kind : "none",
      count: clamp(Math.floor(num(f.decorationCount, 8)), 1, 24),
      size: clamp(num(f.decorationSize, 1), 0.3, 4),
      motion: DECOR_MOTION[motion] === 1 ? motion : "twinkle",
      place: DECOR_PLACE[place] === 1 ? place : "scatter",
      color: DECOR_COLOR[color] === 1 ? color : "accent",
      tint: str(f.decorationTint, "#FFB6D9"),
      opacity: clamp(num(f.decorationOpacity, 0.5), 0.1, 1)
    };
  }
  // `host` is the panel the shapes sit behind, `colors` the list of colours they take in turn (the accent, or a flag), `animate` whether they
  // move, and `text` the panel's text colour, for a setting that asks for it.
  function applyDecor(d, host, colors, animate, text) {
    if (!host || !host.children || typeof document === "undefined") return;
    for (var i = host.children.length - 1; i >= 0; i--) {
      if (host.children[i].className && String(host.children[i].className).indexOf("w-deco") === 0) host.removeChild(host.children[i]);
    }
    if (!d || d.kind === "none") { if (host.style) host.style.isolation = ""; return; }
    // Behind the words but above the panel's own background: the panel becomes its own stacking context.
    if (host.style) host.style.isolation = "isolate";
    var layer = document.createElement("div");
    layer.className = "w-deco " + d.motion + (animate ? "" : " still") + (d.place === "border" ? " outside" : "");
    layer.setAttribute("aria-hidden", "true");
    if (layer.style) { layer.style.setProperty("--w-deco-size", d.size); layer.style.setProperty("--w-deco-opacity", d.opacity); }
    var mix = ["sparkles", "hearts", "stars"], pal = colors && colors.length ? colors : ["currentColor"];
    // Which colours the shapes take, in turn: the accent (or the flag), the text colour, both together, or one you pick.
    if (d.color === "text" && text) pal = [text];
    else if (d.color === "custom") pal = [d.tint];
    else if (d.color === "mixed" && text) pal = pal.concat([text]);
    for (var n = 0; n < d.count; n++) {
      var item = document.createElement("span");
      var frac = function (v) { return v - Math.floor(v); };
      var dur = d.motion === "drift" ? 7 + (n % 4) * 2 : 2.4 + (n % 5) * 0.7;
      item.className = "w-di " + (d.kind === "mixed" ? mix[n % 3] : d.kind);
      var x = frac(0.12 + n * 0.618034) * 92 + 2, y = frac(0.31 + n * 0.754878) * 88 + 4, s = 0.7 + frac(n * 0.37 + 0.2) * 0.6;
      if (d.place === "edges") {
        // Round the border of the panel, by the same kind of recipe: a point a fraction of the way round, on one of its four sides.
        var around = frac(0.07 + n * 0.618034) * 4, along = frac(around) * 88;
        if (around < 1) { x = along + 2; y = 3; } else if (around < 2) { x = 90; y = along + 4; } else if (around < 3) { x = 90 - along; y = 86; } else { x = 3; y = 86 - along; }
        s = 0.8 + frac(n * 0.37 + 0.2) * 0.4;
      } else if (d.place === "border") {
        // On the border itself, so that half of each shape is outside the panel. The stylesheet centres a shape on its point.
        var rim = frac(0.07 + n * 0.618034) * 4, run = frac(rim) * 100;
        if (rim < 1) { x = run; y = 0; } else if (rim < 2) { x = 100; y = run; } else if (rim < 3) { x = 100 - run; y = 100; } else { x = 0; y = 100 - run; }
        s = 0.8 + frac(n * 0.37 + 0.2) * 0.4;
      } else if (d.place === "offset") {
        // A little way in from the corners and not on them, as in a few small sparkles dotted round a card: top right and bottom right
        // first, then top left and bottom left, and a second ring further in once there are more than four.
        var step = Math.floor(n / 4), right = n % 4 < 2, top = n % 4 === 0 || n % 4 === 2;
        x = right ? 84 - step * 8 : 7 + step * 8;
        y = top ? 6 + step * 8 : 84 - step * 8;
        s = (n % 2 === 0 ? 0.9 : 1.1) - Math.min(step, 2) * 0.15;
      } else if (d.place === "corners") {
        // The four corners in turn, and a second ring a little further in once there are more than four.
        var ring = Math.floor(n / 4), cx = n % 4 < 2 ? 3 + ring * 9 : 88 - ring * 9, cy = n % 4 === 0 || n % 4 === 3 ? 4 + ring * 9 : 84 - ring * 9;
        x = cx; y = cy; s = 1.25 - Math.min(ring, 3) * 0.2;
      }
      item.style.setProperty("--x", x.toFixed(1) + "%");
      item.style.setProperty("--y", y.toFixed(1) + "%");
      item.style.setProperty("--s", s.toFixed(2));
      item.style.setProperty("--d", dur.toFixed(1) + "s");
      item.style.setProperty("--dl", "-" + ((n * 1.37) % dur).toFixed(2) + "s");
      item.style.setProperty("--c", pal[n % pal.length]);
      layer.appendChild(item);
    }
    host.insertBefore(layer, host.firstChild);
  }
  // ---- end of the decorations ----

  window.addEventListener("onWidgetLoad", function (obj) {
    var fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
    readConfig(fieldData);

    el.app = document.getElementById("vote-app");
    el.card = document.getElementById("vote-card");
    el.title = document.getElementById("vote-title");
    el.timer = document.getElementById("vote-timer");
    el.eyebrow = document.getElementById("vote-eyebrow");
    el.lie = document.getElementById("vote-lie");
    el.notice = document.getElementById("vote-notice");
    el.praise = document.getElementById("vote-praise");
    el.praiseTitle = document.getElementById("vote-praise-title");
    el.praiseWindow = document.getElementById("vote-praise-window");
    el.praiseNames = document.getElementById("vote-praise-names");
    el.board = document.getElementById("vote-board");
    el.boardTitle = document.getElementById("vote-board-title");
    el.boardList = document.getElementById("vote-board-list");
    praiseShown = "";
    el.options = document.getElementById("vote-options");
    el.total = document.getElementById("vote-total");
    el.hint = document.getElementById("vote-hint");
    el.debug = document.getElementById("vote-debug");

    applyTheme();
    watchResize();
    stopTicking();
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    hideNotice();
    poll = null;
    undoStack = [];
    rounds = [];
    lastFitKey = null;   // the box or the settings may have changed, so measure afresh

    /* The clock is stored as wall-clock time, so a refresh picks the poll up where it was.
       A stale store read, or one older than a newly opened poll, is ignored. */
    var token = ++loadToken;
    follow();

    restoreState(function (saved) {
      if (token !== loadToken) return;

      // The scores are kept even when a newer poll has opened while the store was being read.
      if (saved && Array.isArray(saved.rounds)) {
        rounds = saved.rounds.filter(function (r) { return r && Array.isArray(r.right) && !rounds.some(function (mine) { return mine.id === r.id; }); }).concat(rounds);
      }

      if (saved && !poll) {
        poll = saved.poll || null;
        undoStack = Array.isArray(saved.undoStack) ? saved.undoStack : [];
      }

      if (poll && poll.status === "running") {
        if (Date.now() >= poll.endsAt) endPoll("timer");
        else startTicking();
      }

      // After a refresh the names get their whole time again, so the roll starts over with it.
      if (poll && poll.praising) poll.praisedAt = Date.now();
      render();
      // A result restored after a refresh still has to leave.
      if (poll && poll.status === "ended") scheduleHide();
    });
  });
})();
