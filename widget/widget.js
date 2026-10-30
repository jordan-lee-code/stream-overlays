/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Rage Bar. StreamElements custom widget logic.
 *
 * A bar on the overlay that chat fills with subs, bits and channel points while
 * the streamer climbs. When it fills, the run resets. Chat can spend points to lock the
 * bar for a few minutes, which buys them a stretch of quiet and turns away every
 * contribution that lands while the lock is up. When the bar does fill there is a
 * ninety second window in which any sub, or a dedicated channel point reward, will
 * nope the reset and hand the run back with the bar cleared to zero.
 *
 * Made for a streamer playing a punishing game such as Getting Over It, though
 * nothing here knows that, so it will do for whatever comes next.
 *
 * It leans on nothing beyond the custom events and SE_API.store,
 * so dev/harness.js can drive this exact file in a plain browser.
 */
(function () {
  "use strict";

  var STORE_KEY = "rage_bar_v1";

  /* Every copy of this widget that loads gets its own id. Two of them running at
     once, which is what happens when the StreamElements overlay editor is left
     open beside OBS, both answer the same events and both write to the same saved
     state, and they will quietly tread on each other. The id is here so that at
     least the second one can say so in the console instead of everybody wondering
     later why the bar went backwards. */
  var INSTANCE = Math.random().toString(36).slice(2, 10);

  /* Style presets. The same fourteen, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. */
  var PRESETS = {
    glass: {
      bg: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", font: "BioRhyme",
      fillFrom: "#D9D9D9", fillTo: "#FFFFFF", alarm: "#D64545",
      parts: {"title": "#FFFFFF", "timer": "#FFFFFF", "readout": "#FFFFFF", "note": "#FFFFFF", "border": "#FFFFFF", "track": "rgba(255, 255, 255, 0.2)", "lock": "#FFFFFF", "lockHole": "rgba(0, 0, 0, 0.7)", "float": "#FFFFFF", "floatBg": "rgba(0, 0, 0, 0.7)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    frost: {
      bg: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", font: "BioRhyme",
      fillFrom: "#5B6478", fillTo: "#1B2130", alarm: "#C0392B",
      parts: {"title": "#1B2130", "timer": "#1B2130", "readout": "#1B2130", "note": "#1B2130", "border": "#1B2130", "track": "rgba(0, 0, 0, 0.14)", "lock": "#1B2130", "lockHole": "rgba(255, 255, 255, 0.88)", "float": "#1B2130", "floatBg": "rgba(255, 255, 255, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    midnight: {
      bg: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#7FA8FF", font: "BioRhyme",
      fillFrom: "#4F77D6", fillTo: "#A9C4FF", alarm: "#FF6B6B",
      parts: {"title": "#E8EEFF", "timer": "#E8EEFF", "readout": "#E8EEFF", "note": "#E8EEFF", "border": "#7FA8FF", "track": "rgba(127, 168, 255, 0.22)", "lock": "#7FA8FF", "lockHole": "rgba(10, 18, 46, 0.88)", "float": "#E8EEFF", "floatBg": "rgba(10, 18, 46, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    sunset: {
      bg: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", font: "BioRhyme",
      fillFrom: "#FF6B8A", fillTo: "#FFB36B", alarm: "#FF4D4D",
      parts: {"title": "#FFF1E6", "timer": "#FFF1E6", "readout": "#FFF1E6", "note": "#FFF1E6", "border": "#FF9A5A", "track": "rgba(255, 154, 90, 0.24)", "lock": "#FF9A5A", "lockHole": "rgba(48, 18, 42, 0.88)", "float": "#FFF1E6", "floatBg": "rgba(48, 18, 42, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    forest: {
      bg: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", font: "BioRhyme",
      fillFrom: "#3FAE7C", fillTo: "#9BEBC1", alarm: "#FF7A59",
      parts: {"title": "#EAF7EE", "timer": "#EAF7EE", "readout": "#EAF7EE", "note": "#EAF7EE", "border": "#6FD6A0", "track": "rgba(111, 214, 160, 0.22)", "lock": "#6FD6A0", "lockHole": "rgba(12, 36, 28, 0.88)", "float": "#EAF7EE", "floatBg": "rgba(12, 36, 28, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    ocean: {
      bg: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", font: "BioRhyme",
      fillFrom: "#2FA4B8", fillTo: "#8FEAF2", alarm: "#FF6B6B",
      parts: {"title": "#E6F8FF", "timer": "#E6F8FF", "readout": "#E6F8FF", "note": "#E6F8FF", "border": "#4CD3E0", "track": "rgba(76, 211, 224, 0.22)", "lock": "#4CD3E0", "lockHole": "rgba(6, 36, 50, 0.88)", "float": "#E6F8FF", "floatBg": "rgba(6, 36, 50, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    rose: {
      bg: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF8FB8", font: "BioRhyme",
      fillFrom: "#E0558C", fillTo: "#FFB3D1", alarm: "#FF4D6D",
      parts: {"title": "#FFE9F1", "timer": "#FFE9F1", "readout": "#FFE9F1", "note": "#FFE9F1", "border": "#FF8FB8", "track": "rgba(255, 143, 184, 0.24)", "lock": "#FF8FB8", "lockHole": "rgba(58, 14, 34, 0.88)", "float": "#FFE9F1", "floatBg": "rgba(58, 14, 34, 0.88)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    neon: {
      bg: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", font: "BioRhyme",
      fillFrom: "#FF2BD6", fillTo: "#00F0FF", alarm: "#FF3366",
      parts: {"title": "#FFFFFF", "timer": "#FFFFFF", "readout": "#FFFFFF", "note": "#FFFFFF", "border": "#00F0FF", "track": "rgba(0, 240, 255, 0.2)", "lock": "#00F0FF", "lockHole": "rgba(4, 4, 16, 0.92)", "float": "#FFFFFF", "floatBg": "rgba(4, 4, 16, 0.92)", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    cosycabin: {
      bg: "#F5ECD6", text: "#57442E", accent: "#7C6142", font: "Chicle",
      fillFrom: "#E2C79B", fillTo: "#7C6142", alarm: "#C05746",
      parts: {"title": "#57442E", "timer": "#57442E", "readout": "#57442E", "note": "#57442E", "border": "#7C6142", "track": "rgba(0, 0, 0, 0.11)", "lock": "#7C6142", "lockHole": "#F5ECD6", "float": "#57442E", "floatBg": "#F5ECD6", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    pastel: {
      bg: "#FFF6E9", text: "#6B4F3A", accent: "#FF8A65", font: "Baloo 2",
      fillFrom: "#FFD1A9", fillTo: "#FF8A65", alarm: "#F4587A",
      parts: {"title": "#6B4F3A", "timer": "#6B4F3A", "readout": "#6B4F3A", "note": "#6B4F3A", "border": "#FF8A65", "track": "rgba(0, 0, 0, 0.11)", "lock": "#FF8A65", "lockHole": "#FFF6E9", "float": "#6B4F3A", "floatBg": "#FFF6E9", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    celestial: {
      bg: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", font: "Cinzel",
      fillFrom: "#8E7CC3", fillTo: "#E8C06B", alarm: "#B5495B",
      parts: {"title": "#F3ECFF", "timer": "#F3ECFF", "readout": "#F3ECFF", "note": "#F3ECFF", "border": "#E8C06B", "track": "rgba(255, 255, 255, 0.18)", "lock": "#E8C06B", "lockHole": "#2E1A47", "float": "#F3ECFF", "floatBg": "#2E1A47", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    pastelgoth: {
      bg: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", font: "Quicksand",
      fillFrom: "#D9A7C7", fillTo: "#C8B6E2", alarm: "#C96A8E",
      parts: {"title": "#F2E9F0", "timer": "#F2E9F0", "readout": "#F2E9F0", "note": "#F2E9F0", "border": "#C8B6E2", "track": "rgba(255, 255, 255, 0.18)", "lock": "#C8B6E2", "lockHole": "#3A3340", "float": "#F2E9F0", "floatBg": "#3A3340", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    pastelpink: {
      bg: "#FFE3EC", text: "#6A2E4B", accent: "#D95C8A", font: "Fredoka",
      fillFrom: "#F7A8C6", fillTo: "#E0679A", alarm: "#D6456F",
      parts: {"title": "#6A2E4B", "timer": "#6A2E4B", "readout": "#6A2E4B", "note": "#6A2E4B", "border": "#D95C8A", "track": "rgba(106, 46, 75, 0.14)", "lock": "#D95C8A", "lockHole": "#FFE3EC", "float": "#6A2E4B", "floatBg": "#FFE3EC", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    },
    faegreen: {
      bg: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", font: "Almendra",
      fillFrom: "#8FB84E", fillTo: "#D7EE7A", alarm: "#E0805A",
      parts: {"title": "#EEF5DA", "timer": "#EEF5DA", "readout": "#EEF5DA", "note": "#EEF5DA", "border": "#C9E265", "track": "rgba(238, 245, 218, 0.2)", "lock": "#C9E265", "lockHole": "#2C4A36", "float": "#EEF5DA", "floatBg": "#2C4A36", "alert": "#FFFFFF", "alertFill": "#FFFFFF", "alertTrack": "rgba(0, 0, 0, 0.22)"}
    }
  };
  var BASE = PRESETS.glass;

  // ---- runtime state ----
  var cfg = {};
  var el = {};

  var fill = 0;              // how full the bar is, in the same units as capacity
  var phase = "filling";     // "filling" | "pending" | "reset"
  var lockUntil = 0;         // wall clock ms; only meaningful while filling
  var nopeUntil = 0;         // wall clock ms; the ninety seconds to save the run
  var resetUntil = 0;        // wall clock ms; how long the reset banner stays up
  var nopePool = 0;          // everything chipped in to save the run, in bar units
  var nopeRedeems = 0;       // Save the Run redeems this window, five of which cancel it outright
  var subGraceUntil = 0;     // wall clock ms; subs do not count towards a save until then
  var lockBreakPool = 0;     // subs piled up against the current lock
  var resetBank = 0;         // arrived while the reset banner was up, owed to the next bar
  var overkill = false;      // this reset was bought outright and cannot be noped
  var cosplay = false;       // showing the joke banner in place of an outright reset
  var cosplayResumeFill = 0; // what the bar had before the banner, restored once it clears
  var ender = "";            // whoever ended it outright, for the note under the bar
  var pausedAt = 0;          // wall clock ms when !baroff stopped time; 0 means on
  var resetCount = 0;        // successful resets so far, which is what makes each bar bigger

  var saveTimer = null;
  var floatTimer = null;
  var floatQueue = [];
  var floatBusy = false;
  var tickTimer = null;
  var loadToken = 0;

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
  function clamp(v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  }
  function title(v) {
    return str(v, "").toLowerCase().trim();
  }
  function nowMs() {
    return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0;
  }
  /* The clock the bar lives by. While the bar is switched off, time stands still
     at the moment it went off, so a lock or a nope window left running when the
     stream ended is still exactly where it was when the next one starts. Real
     time is only used for things that genuinely are about real time, like
     spotting a second copy of the widget. */
  function clockNow() {
    return pausedAt || nowMs();
  }

  function rgba(hex, alpha) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return "rgba(0, 0, 0, " + alpha + ")";
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
  }
  // Fills {who}, {n} and {total} in a wording template.
  function tpl(text, vars) {
    return String(text).replace(/\{(who|n|total)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? vars[k] : m;
    });
  }

  function readConfig(f) {
    f = f || {};
    cfg = {
      // The first bar, in points. Every bar after it grows by capacityGrowth.
      capacity: Math.max(1, num(f.capacity, 100)),
      capacityGrowth: Math.max(1, num(f.capacityGrowth, 1.5)),
      subTier1: num(f.subTier1, 5),
      subTier2: num(f.subTier2, 7),
      subTier3: num(f.subTier3, 20),
      bitsPer100: num(f.bitsPer100, 2),
      // Direct donations, in whatever currency the channel takes them in. This is
      // how much counts as one tier 1 sub's worth, so twenty of them, or fifty, fill the first bar.
      tipPerSub: Math.max(0.01, num(f.tipPerSub, 2.5)),
      currencySymbol: str(f.currencySymbol, "£"),
      fillRewardTitle: title(f.fillRewardTitle),
      pushBackRewardTitle: title(f.pushBackRewardTitle),
      // Zero switches the reward off. It grows with the bar, like the cost of a save.
      pushBackAmount: Math.max(0, num(f.pushBackAmount, 10)),
      fillRewardAmount: num(f.fillRewardAmount, 5),

      lockRewardTitle: title(f.lockRewardTitle),
      pointsPerLockedMinute: Math.max(1, num(f.pointsPerLockedMinute, 2000)),
      lockMinMinutes: Math.max(0.25, num(f.lockMinMinutes, 0.5)),
      lockMaxMinutes: Math.max(0.25, num(f.lockMaxMinutes, 15)),
      lockMaxTotalMinutes: Math.max(0.25, num(f.lockMaxTotalMinutes, 30)),
      manualLockMinutes: Math.max(0.25, num(f.manualLockMinutes, 5)),
      // In the same units as the bar, so a tier 3 counts double and a gift of
      // five breaks a lock in one go. Zero means a lock cannot be broken at all.
      lockBreakSubs: Math.max(0, num(f.lockBreakSubs, 25)),

      cmd: {
        view: title(f.viewCommand) || "!bar",
        reset: title(f.resetCommand) || "!barreset",
        lock: title(f.lockCommand) || "!barlock",
        unlock: title(f.unlockCommand) || "!barunlock",
        nope: title(f.nopeCommand) || "!barnope",
        fill: title(f.fillCommand) || "!barfill",
        sub: title(f.subCommand) || "!barsub",
        bits: title(f.bitsCommand) || "!barbits",
        on: title(f.onCommand) || "!baron",
        off: title(f.offCommand) || "!baroff"
      },
      whoCanManage: str(f.whoCanManage, "mods"),

      nopeRewardTitle: title(f.nopeRewardTitle),
      /* The save is counted in the same units as the bar, so five means five subs'
         worth of anything at all: subs at their tier, bits at the same rate they
         fill the bar, and channel points converted at the rate below. Keeping one
         unit for the whole widget is what lets the line under the bar say "3 / 5
         to save" and have that mean something to everybody watching. */
      nopeTargetSubs: Math.max(1, num(f.nopeTargetSubs, 25)),
      nopePointsPerSub: Math.max(1, num(f.nopePointsPerSub, 2000)),
      // Zero switches the flat cancel off, leaving only the pot.
      nopeRedeemsToSave: Math.max(0, Math.floor(num(f.nopeRedeemsToSave, 5))),
      // Off makes Save the Run redeems the only way to save a run.
      moneySavesRun: bool(f.moneySavesRun, true),
      /* What the Save the Run reward costs on Twitch. The widget only ever learns a
         reward's price when somebody redeems it, so this is what lets the line under
         the bar say how many channel points are left to spend. Zero hides the figure. */
      saveRewardCost: Math.max(0, num(f.saveRewardCost, 10000)),
      // Zero switches the grace period off.
      saveGraceSeconds: Math.max(0, num(f.saveGraceSeconds, 10)),
      nopeSeconds: Math.max(5, num(f.nopeSeconds, 90)),
      resetHoldSeconds: Math.max(1, num(f.resetHoldSeconds, 10)),
      // Zero switches the extra time off.
      saveExtendSeconds: Math.max(0, num(f.saveExtendSeconds, 5)),
      // Zero switches the outright reset off entirely, rather than making every
      // contribution an outright reset.
      overkillSubs: Math.max(0, num(f.overkillSubs, 500)),

      label: str(f.label, "THE BAR"),
      pendingTitle: str(f.pendingTitle, "SAVE THE RUN"),
      resetTitle: str(f.resetTitle, "Time to reset!"),
      overkillTitle: str(f.overkillTitle, "NO SAVING THIS ONE"),
      // On, a contribution big enough to end the run outright no longer does: it is
      // just an ordinary contribution with a joke acknowledging how big it was.
      overkillCosplay: bool(f.overkillCosplay, false),
      cosplayTitle: str(f.cosplayTitle, "You didn't get over it, time to cosplay"),
      manualStep: num(f.manualStep, 10),
      dreadFrom: Math.max(0, num(f.dreadFrom, 25)),

      enableSounds: bool(f.enableSounds, true),
      fullSound: str(f.fullSound, ""),
      fullVolume: clamp(num(f.fullVolume, 70), 0, 100) / 100,
      savedSound: str(f.savedSound, ""),
      savedVolume: clamp(num(f.savedVolume, 60), 0, 100) / 100,
      resetSound: str(f.resetSound, ""),
      resetVolume: clamp(num(f.resetVolume, 70), 0, 100) / 100,

      showFloat: bool(f.showFloat, true),
      showLock: bool(f.showLock, true),
      hideWhenOff: bool(f.hideWhenOff, false),
      debug: bool(f.debug, true),

      themePreset: str(f.themePreset, "glass"),
      fontFamily: str(f.fontFamily, BASE.font),
      panelOpacity: clamp(num(f.panelOpacity, 0.55), 0, 1),
      colors: {
        bg: str(f.colorBg, "#000000"),
        text: str(f.colorText, "#FFFFFF"),
        accent: str(f.colorAccent, "#FFFFFF"),
        fillFrom: str(f.colorFillFrom, "#D9D9D9"),
        fillTo: str(f.colorFillTo, "#FFFFFF"),
        alarm: str(f.colorAlarm, "#D64545")
      },
      // Colours of the individual parts, used when the preset is Custom.
      parts: {
        title: str(f.colorTitle, "#FFFFFF"), timer: str(f.colorTimer, "#FFFFFF"),
        readout: str(f.colorReadout, "#FFFFFF"), note: str(f.colorNote, "#FFFFFF"),
        border: str(f.colorBorder, "#FFFFFF"), track: str(f.colorTrack, "#FFFFFF"),
        lock: str(f.colorLock, "#FFFFFF"), lockHole: str(f.colorLockHole, "#111111"),
        float: str(f.colorFloat, "#FFFFFF"), floatBg: str(f.colorFloatBg, "#000000"),
        alert: str(f.colorAlert, "#FFFFFF"), alertFill: str(f.colorAlertFill, "#FFFFFF")
      },
      look: {
        radius: clamp(num(f.radius, 6), 0, 50), padV: clamp(num(f.paddingV, 5), 0, 40), padH: clamp(num(f.paddingH, 6), 0, 40),
        gap: clamp(num(f.gap, 2.5), 0, 20), tilt: clamp(num(f.tilt, 0), -20, 20), borderW: Math.max(0, num(f.borderWidth, 0)),
        shadow: bool(f.shadow, false), textShadow: bool(f.textShadow, false), tail: bool(f.showTail, false),
        trackHeight: clamp(num(f.trackHeight, 11), 3, 40), trackOpacity: clamp(num(f.trackOpacity, 0.2), 0, 1),
        titleScale: clamp(num(f.titleScale, 1), 0.4, 3), titleWeight: str(f.titleWeight, "800"),
        titleSpacing: clamp(num(f.titleSpacing, 0.06), 0, 0.5), titleUpper: bool(f.titleUppercase, true),
        timerScale: clamp(num(f.timerScale, 1), 0.4, 3), timerWeight: str(f.timerWeight, "700"),
        readoutScale: clamp(num(f.readoutScale, 1), 0.4, 3), readoutWeight: str(f.readoutWeight, "700"),
        readoutOpacity: clamp(num(f.readoutOpacity, 0.85), 0, 1),
        noteScale: clamp(num(f.noteScale, 1), 0.4, 3), noteWeight: str(f.noteWeight, "700"),
        noteOpacity: clamp(num(f.noteOpacity, 0.95), 0, 1),
        floatScale: clamp(num(f.floatScale, 1), 0.4, 3), floatWeight: str(f.floatWeight, "700"),
        lockedOpacity: clamp(num(f.lockedOpacity, 0.6), 0, 1), offOpacity: clamp(num(f.offOpacity, 0.55), 0, 1),
        popScale: clamp(num(f.popScale, 1.04), 1, 2),
        animations: bool(f.animations, true), fillMs: clamp(num(f.fillSeconds, 0.55), 0, 5),
        popMs: clamp(num(f.popSeconds, 0.42), 0.1, 3), floatMs: clamp(num(f.floatSeconds, 1.6), 0.3, 10),
        dreadMs: clamp(num(f.dreadSeconds, 2.2), 0.4, 10), panicMs: clamp(num(f.panicSeconds, 0.8), 0.2, 5),
        refuseMs: clamp(num(f.refuseSeconds, 0.42), 0.1, 3)
      },
      words: {
        sub: str(f.subWord, "sub"), subs: str(f.subsWord, "subs"), bits: str(f.bitsWord, "bits"),
        toGo: str(f.toGoText, "to go"), toBreak: str(f.toBreakText, "to break"), toSave: str(f.toSaveText, "to save"),
        off: str(f.offNote, "switched off"), endedBy: str(f.endedByText, "ended by {who}"),
        redeem: str(f.redeemWord, "redeem"), redeems: str(f.redeemsWord, "redeems"), points: str(f.pointsWord, "points"),
        seconds: str(f.secondsSuffix, "s"),
        readoutBar: str(f.readoutBarText, "{n} / {total}"), readoutRedeems: str(f.readoutRedeemsText, "{n} / {total} redeems"),
        readoutPoints: str(f.readoutPointsText, "{n} / {total} points"),
        banked: str(f.bankedText, "banked"),
        lockBrokenBy: str(f.lockBrokenByText, "LOCK BROKEN BY {who}"), lockBroken: str(f.lockBrokenText, "LOCK BROKEN"),
        lockedBy: str(f.lockedByText, "LOCKED BY {who}"), locked: str(f.lockedText, "LOCKED"),
        savedBy: str(f.savedByText, "SAVED BY {who}"), saved: str(f.savedText, "SAVED")
      },
      addSound: str(f.addSound, ""), addVolume: clamp(num(f.addVolume, 40), 0, 100) / 100,
      lockSound: str(f.lockSound, ""), lockVolume: clamp(num(f.lockVolume, 60), 0, 100) / 100,
      breakSound: str(f.breakSound, ""), breakVolume: clamp(num(f.breakVolume, 60), 0, 100) / 100
    };
    // A maximum lock shorter than the minimum would quietly swallow every lock
    // chat bought, so the larger of the two wins rather than the field order.
    if (cfg.lockMaxMinutes < cfg.lockMinMinutes) cfg.lockMaxMinutes = cfg.lockMinMinutes;
    if (cfg.lockMaxTotalMinutes < cfg.lockMaxMinutes) cfg.lockMaxTotalMinutes = cfg.lockMaxMinutes;
  }

  function debugLog(what, payload) {
    if (!cfg.debug || typeof console === "undefined" || !console.log) return;
    // So a surprising payload on a real stream can be read straight from the
    // browser-source console, rather than guessed at from the outside. This
    // matters most for channel points, whose shape is not documented anywhere.
    try { console.log("[rage-bar] " + what, JSON.stringify(payload)); }
    catch (e) { console.log("[rage-bar] " + what, payload); }
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  function resolvedTheme() {
    if (cfg.themePreset === "custom") {
      var q = cfg.parts;
      return {
        bg: rgba(cfg.colors.bg, cfg.panelOpacity), text: cfg.colors.text, accent: cfg.colors.accent,
        fillFrom: cfg.colors.fillFrom, fillTo: cfg.colors.fillTo,
        alarm: cfg.colors.alarm, font: cfg.fontFamily,
        parts: {
          title: q.title, timer: q.timer, readout: q.readout, note: q.note, border: q.border,
          track: rgba(q.track, cfg.look.trackOpacity), lock: q.lock, lockHole: q.lockHole,
          float: q.float, floatBg: rgba(q.floatBg, cfg.panelOpacity), alert: q.alert, alertFill: q.alertFill,
          alertTrack: "rgba(0, 0, 0, 0.22)"
        }
      };
    }
    var p = PRESETS[cfg.themePreset] || BASE;
    // A preset that does not name every part colours it from its own three tones.
    var parts = {
      title: p.text, timer: p.text, readout: p.text, note: p.text, border: p.accent,
      track: "rgba(0, 0, 0, 0.11)", lock: p.accent, lockHole: p.bg, float: p.bg, floatBg: p.accent,
      alert: p.bg, alertFill: p.bg, alertTrack: "rgba(0, 0, 0, 0.22)"
    };
    var over = p.parts || {};
    Object.keys(over).forEach(function (k) { parts[k] = over[k]; });
    return {
      bg: p.bg, text: p.text, accent: p.accent,
      fillFrom: p.fillFrom, fillTo: p.fillTo, alarm: p.alarm, font: p.font, parts: parts
    };
  }

  function applyTheme() {
    var t = resolvedTheme();
    var root = el.app;
    if (!root) return;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--fill-from", t.fillFrom);
    root.style.setProperty("--fill-to", t.fillTo);
    root.style.setProperty("--alarm", t.alarm);
    root.style.setProperty("--font", '"' + t.font + '", "Baloo 2", "Segoe UI", sans-serif');

    var P = t.parts, L = cfg.look;
    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--c-title", P.title); set("--c-timer", P.timer); set("--c-readout", P.readout); set("--c-note", P.note);
    set("--c-border", P.border); set("--c-track", P.track); set("--c-lock", P.lock); set("--c-lock-hole", P.lockHole);
    set("--c-float", P.float); set("--c-float-bg", P.floatBg);
    set("--c-alert", P.alert); set("--c-alert-fill", P.alertFill); set("--c-alert-track", P.alertTrack);
    set("--radius-pct", String(L.radius)); set("--pad-v", String(L.padV)); set("--pad-h", String(L.padH));
    set("--gap", String(L.gap)); set("--tilt", L.tilt + "deg"); set("--border-w", L.borderW + "px");
    set("--shadow", L.shadow ? "0 3cqmin 8cqmin rgba(0, 0, 0, 0.28)" : "none");
    set("--text-shadow", L.textShadow ? "0 0.06em 0.18em rgba(0, 0, 0, 0.55)" : "none");
    set("--tail-display", L.tail ? "block" : "none");
    set("--track-h", String(L.trackHeight));
    set("--title-scale", String(L.titleScale)); set("--title-w", L.titleWeight);
    set("--title-spacing", L.titleSpacing + "em"); set("--title-case", L.titleUpper ? "uppercase" : "none");
    set("--timer-scale", String(L.timerScale)); set("--timer-w", L.timerWeight);
    set("--readout-scale", String(L.readoutScale)); set("--readout-w", L.readoutWeight); set("--readout-opacity", String(L.readoutOpacity));
    set("--note-scale", String(L.noteScale)); set("--note-w", L.noteWeight); set("--note-opacity", String(L.noteOpacity));
    set("--float-scale", String(L.floatScale)); set("--float-w", L.floatWeight);
    set("--locked-opacity", String(L.lockedOpacity)); set("--off-opacity", String(L.offOpacity));
    set("--pop-scale", String(L.popScale));
    set("--fill-s", L.fillMs + "s"); set("--pop-s", L.popMs + "s"); set("--float-s", L.floatMs + "s");
    set("--dread-s", L.dreadMs + "s"); set("--panic-s", L.panicMs + "s"); set("--refuse-s", L.refuseMs + "s");
    if (L.animations) root.classList.remove("no-motion");
    else root.classList.add("no-motion");

    document.body.style.background = "transparent";
    loadFont(t.font);
  }

  // BioRhyme is a variable font, so ask for its whole weight range and every
  // boldness the settings offer is drawn for real. Other families are requested
  // plainly because single-weight ones (such as Chicle) reject a weight axis.
  var FONT_WEIGHTS = { "BioRhyme": ":wght@200..800" };

  function loadFont(name) {
    if (!name) return;
    var id = "rage-font-link";
    // Single-weight families (e.g. Chicle) reject a weight axis on the css2 API,
    // so request the family plainly and let the browser faux-bold as needed.
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
  }

  // ---------------------------------------------------------------------------
  // Sounds
  // ---------------------------------------------------------------------------
  /* The streamer is playing a game that wants both hands and all of their
     attention, so they are not watching this. The bar filling is the one thing
     they cannot afford to miss and cannot see coming, and finding out because chat
     started shouting is a second or two later than is fair. */
  function playClip(url, vol) {
    if (!cfg.enableSounds || !url) return;
    try {
      var a = new Audio(url);
      a.volume = vol;
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) { /* no audio in this runtime, or the browser refused it */ }
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
      try {
        SE_API.store.set(STORE_KEY, {
          fill: fill, phase: phase, lockUntil: lockUntil,
          nopeUntil: nopeUntil, resetUntil: resetUntil,
          nopePool: nopePool, nopeRedeems: nopeRedeems,
          lockBreakPool: lockBreakPool, resetBank: resetBank,
          pausedAt: pausedAt, resetCount: resetCount,
          overkill: overkill, cosplay: cosplay, cosplayResumeFill: cosplayResumeFill, ender: ender,
          instance: INSTANCE, writtenAt: nowMs()
        });
      } catch (e) { /* store is best-effort */ }
    }, 300);
  }

  /* Handed back rather than installed, the way the voting widget does it, so the
     caller can decide whether a save that was in flight is older than what is
     already on screen. The deadlines are absolute wall-clock times on purpose:
     that is what lets a browser source refresh in the middle of the panic pick up
     at the right second instead of restarting the countdown or losing it. */
  function restoreState(done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(null); return; }
    try {
      Promise.resolve(SE_API.store.get(STORE_KEY)).then(function (saved) {
        if (!saved || typeof saved !== "object" || typeof saved.fill !== "number") {
          done(null);
          return;
        }
        done({
          fill: Math.max(0, saved.fill),
          phase: (saved.phase === "pending" || saved.phase === "reset") ? saved.phase : "filling",
          lockUntil: typeof saved.lockUntil === "number" ? saved.lockUntil : 0,
          nopeUntil: typeof saved.nopeUntil === "number" ? saved.nopeUntil : 0,
          resetUntil: typeof saved.resetUntil === "number" ? saved.resetUntil : 0,
          // Saves written before the pool existed simply have nobody chipped in yet.
          nopePool: typeof saved.nopePool === "number" ? Math.max(0, saved.nopePool) : 0,
          nopeRedeems: typeof saved.nopeRedeems === "number" ? Math.max(0, Math.floor(saved.nopeRedeems)) : 0,
          lockBreakPool: typeof saved.lockBreakPool === "number" ? Math.max(0, saved.lockBreakPool) : 0,
          resetBank: typeof saved.resetBank === "number" ? Math.max(0, saved.resetBank) : 0,
          pausedAt: typeof saved.pausedAt === "number" ? Math.max(0, saved.pausedAt) : 0,
          // Saves from before the bars grew are simply on their first bar.
          resetCount: typeof saved.resetCount === "number" ? Math.max(0, Math.floor(saved.resetCount)) : 0,
          instance: typeof saved.instance === "string" ? saved.instance : "",
          writtenAt: typeof saved.writtenAt === "number" ? saved.writtenAt : 0,
          overkill: saved.overkill === true,
          cosplay: saved.cosplay === true,
          cosplayResumeFill: typeof saved.cosplayResumeFill === "number" ? Math.max(0, saved.cosplayResumeFill) : 0,
          ender: typeof saved.ender === "string" ? saved.ender : ""
        });
      }).catch(function () { done(null); });
    } catch (e) { done(null); }
  }

  /* Coming back from a refresh, a deadline that has already passed has to be
     resolved before anything is drawn, or the bar shows a countdown at zero.
     A nope window that lapsed while the browser source was actually open should
     still show its reset, but one that lapsed because OBS was shut for twenty
     minutes should not: nobody wants to come back to a stale alarm. */
  function settleRestoredPhase() {
    var n = clockNow();
    if (phase === "pending" && n >= nopeUntil) {
      var missedBy = n - nopeUntil;
      nopeUntil = 0;
      if (missedBy <= cfg.resetHoldSeconds * 1000) {
        // Shut and reopened inside the banner: show whatever is left of it.
        nopePool = 0;
        nopeRedeems = 0;
        phase = "reset";
        resetUntil = n + (cfg.resetHoldSeconds * 1000 - missedBy);
      } else {
        /* Shut for longer than that, so the ninety seconds went by with nobody
           watching. The bar was full and full means something, so rather than
           quietly emptying it and handing the streamer a run nobody paid for, it comes
           back full with a fresh window and whatever had already been chipped in.
           Chat gets their chance and the run gets resolved on stream, where it was
           always supposed to happen. A mod can wave it away with !barreset. */
        phase = "pending";
        nopeUntil = n + cfg.nopeSeconds * 1000;
      }
    }
    if (phase === "reset" && n >= resetUntil) {
      phase = "filling";
      resetUntil = 0;
      if (cosplay) { fill = cosplayResumeFill; cosplay = false; ender = ""; }
      else { resetCount += 1; fill = 0; }
    }
    if (phase !== "filling") lockUntil = 0;
    if (!isLocked()) lockBreakPool = 0;
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

  /* "!barlock 60" is a minute, not an hour. A bare number is seconds, which is the
     same reading the subathon timer uses, and anything else can be spelled out:
     90s, 5m, 1h, 1m30s. Nobody should have to remember which unit this particular
     widget decided on halfway through a tense climb. */
  function parseMinutes(rest, dflt) {
    var text = String(rest || "").trim().toLowerCase();
    if (!text) return dflt;
    if (/^\d+(\.\d+)?$/.test(text)) return num(text, 0) / 60;
    var parts = text.match(/\d+(?:\.\d+)?\s*[hms]/g);
    if (!parts) return dflt;
    var seconds = 0;
    for (var i = 0; i < parts.length; i++) {
      var n = num(parts[i], 0);
      var unit = parts[i].replace(/[^hms]/g, "");
      seconds += unit === "h" ? n * 3600 : (unit === "m" ? n * 60 : n);
    }
    return seconds > 0 ? seconds / 60 : dflt;
  }

  // ---------------------------------------------------------------------------
  // Counting what chat spends
  // ---------------------------------------------------------------------------
  /* How many subs a subscriber event actually represents. Reading this out of a
     StreamElements payload is fiddly, because a community gift arrives as several
     events and only one of them holds the real number. The shape is:
       - event.bulkGifted        the bomb announcement; event.amount is how many
                                 subs were gifted, which is the number we want.
       - event.isCommunityGift   one recipient inside that bomb, fired once each;
                                 its amount is a months/streak figure, NOT a count,
                                 so it must be skipped or the total balloons. This
                                 is exactly the "+170" a lifetime streak causes.
       - event.gifted (alone)    a single targeted gift, which is one sub.
       - anything else           a self-sub or a resub, which is one sub. Note it
                                 is one, not event.amount: on a resub that field
                                 is the month count, which is the same trap again
                                 wearing a different hat. */
  function subUnits(event) {
    if (bool(event.bulkGifted, false)) return Math.max(0, Math.round(num(event.amount, 0)));
    if (bool(event.isCommunityGift, false) || bool(event.playedAsCommunityGift, false)) return 0;
    return 1;
  }

  // Twitch sends the tier as "1000" / "2000" / "3000". Prime subs and anything
  // unrecognised fall through to tier one, which is the kind reading.
  function weightForTier(tier) {
    switch (parseInt(tier, 10)) {
      case 3000: return cfg.subTier3;
      case 2000: return cfg.subTier2;
      default: return cfg.subTier1;
    }
  }

  function nameOf(event) {
    // On a gift the person who spent the money is the sender, not the recipient.
    if (bool(event.gifted, false) || bool(event.bulkGifted, false)) {
      return str(event.sender, str(event.name, ""));
    }
    return str(event.name, "");
  }

  // ---------------------------------------------------------------------------
  // Channel point redemptions
  // ---------------------------------------------------------------------------
  /* Redemptions do not arrive with a listener of their own. StreamElements has
     never documented them for custom widgets (the official event reference still
     lists only follower/subscriber/cheer/tip/raid/message and friends), and the
     open request for it has no answer, so this is written against the shape a
     working community widget produces and confirmed on stream with debug on.
     The payload sits on the event as:
       event.type === "channelPoints"
       event.data  === { rewardId, title, cost, username, userInput, raw }
     with raw holding the whole Twitch redemption. Every read below falls through
     to raw, because the day SE changes the flat fields is the day this widget
     should keep working. */
  /* The first real redemption on a live channel did nothing, which is the thing
     this part of the widget was always most likely to get wrong, because
     StreamElements has never documented how a redemption reaches a custom
     widget. So recognising one is now deliberately generous: anything whose
     type or listener talks about channel points, redemptions or rewards is
     looked at, and the reward name is searched for wherever it happens to be in
     the payload. Being generous is safe here, because nothing happens unless the
     name found starts with one of the reward names in the Fields. */
  var KNOWN_LISTENERS = {
    "message": 1, "widget-button": 1, "subscriber-latest": 1, "cheer-latest": 1,
    "tip-latest": 1, "follower-latest": 1, "raid-latest": 1, "host-latest": 1,
    "kicks-latest": 1, "kvstore:update": 1, "bot:counter": 1, "delete-message": 1,
    "delete-messages": 1, "event:skip": 1, "alertService:toggleSound": 1
  };
  var LOOKS_LIKE_REDEMPTION = /channel.?points?|redemption|redeem|reward/i;
  function isRedemption(listener, event) {
    return LOOKS_LIKE_REDEMPTION.test(String((event && event.type) || "")) ||
      LOOKS_LIKE_REDEMPTION.test(String(listener || ""));
  }

  // Every string in the payload, the obvious places first, then one level into
  // anything nested, so an unfamiliar shape still has its reward name found.
  function candidateTitles(d) {
    var raw = d.raw || {};
    var red = raw.redemption || raw;
    var out = [d.title, (red.reward || {}).title, d.rewardTitle,
      typeof d.reward === "string" ? d.reward : (d.reward || {}).title,
      typeof d.redemption === "string" ? d.redemption : ((d.redemption || {}).reward || {}).title,
      d.item, d.message];
    var keys = Object.keys(d);
    for (var i = 0; i < keys.length; i++) {
      var v = d[keys[i]];
      if (typeof v === "string") out.push(v);
      else if (v && typeof v === "object") {
        var inner = Object.keys(v);
        for (var j = 0; j < inner.length; j++) {
          if (typeof v[inner[j]] === "string") out.push(v[inner[j]]);
        }
      }
    }
    return out.filter(function (t) { return typeof t === "string" && t.trim(); });
  }

  function readRedemption(event) {
    var d = (event && event.data) || {};
    var raw = d.raw || {};
    var red = raw.redemption || raw;
    var reward = red.reward || (d.reward && typeof d.reward === "object" ? d.reward : {});
    var user = red.user || {};
    var titles = candidateTitles(d);
    var wanted = [cfg.nopeRewardTitle, cfg.lockRewardTitle, cfg.fillRewardTitle, cfg.pushBackRewardTitle];
    var found = "";
    for (var i = 0; i < titles.length && !found; i++) {
      for (var j = 0; j < wanted.length; j++) {
        if (titleMatches(titles[i], wanted[j])) { found = titles[i]; break; }
      }
    }
    return {
      title: title(found || titles[0] || ""),
      cost: num(d.cost, num(reward.cost, num(d.price, num(d.points, num(d.amount, 0))))),
      user: str(d.username, str(d.displayName, str(user.display_name,
        str(user.login, str(d.name, "")))))
    };
  }

  /* Matched as a prefix so one setting of "Lock the Bar" catches "Lock the Bar
     (2 min)" and "Lock the Bar (10 min)", leaving the cost to decide the minutes.

     Leading decoration is stripped off both sides first, because streamers put
     emoji on the front of reward names and "🔒 Lock the Bar" does not start with
     "Lock the Bar" as far as indexOf is concerned. That would have been a whole
     stream of redemptions doing nothing at all, with no error anywhere to explain
     why, and plenty of real reward names have the emoji in them. */
  function bareTitle(v) {
    return String(v || "").toLowerCase().trim().replace(/^[^a-z0-9]+/, "");
  }
  function titleMatches(seen, want) {
    var w = bareTitle(want);
    return !!w && bareTitle(seen).indexOf(w) === 0;
  }

  // ---------------------------------------------------------------------------
  // The bar
  // ---------------------------------------------------------------------------
  function isLocked() {
    return phase === "filling" && lockUntil > clockNow();
  }

  /* Each successful reset makes the next bar bigger, and what it costs to save a
     run grows by the same factor, so nobody's money feels wasted on a larger bar.
     The rounding is done once, on the exact compounded value, rather than on the
     previous bar, so it never builds up: 100, 150, 225, 338, 506 and not 100, 150,
     225, 338, 507. Whole numbers all the way, because a bar that asks for 337.5
     points is not one anybody can keep count of. */
  function scaled(base) {
    return Math.max(1, Math.round(base * Math.pow(cfg.capacityGrowth, resetCount)));
  }
  function capacityNow() { return scaled(cfg.capacity); }
  function nopeTargetNow() { return scaled(cfg.nopeTargetSubs); }
  function redeemsNeeded() { return Math.max(1, cfg.nopeRedeemsToSave); }
  function redeemsLeftText() {
    var left = Math.max(0, redeemsNeeded() - nopeRedeems);
    return left + " " + (left === 1 ? cfg.words.redeem : cfg.words.redeems) +
      (cfg.saveRewardCost > 0 ? " / " + commas(left * cfg.saveRewardCost) + " " + cfg.words.points : "") + " " + cfg.words.toSave;
  }

  /* The amount that ends a run with no window to save it. It starts at a hundred
     tier 1 gifted subs and doubles every time the bar itself grows up to it, so
     the un-nopeable moment stays out of reach of an ordinary bar filling up.
     Zero means the outright reset is switched off. */
  function overkillAt() {
    if (!(cfg.overkillSubs > 0)) return 0;
    var at = cfg.overkillSubs;
    var cap = capacityNow();
    while (at <= cap) at *= 2;
    return at;
  }

  function addFill(amount, who, why) {
    if (!(amount > 0)) return;

    /* One person arriving with a hundred gifted subs' worth in a single go ends the
       run outright, with no window for anyone to save it, and it goes straight
       through a lock on the way. The lock part is deliberate: a gift of a hundred
       subs being quietly eaten by a five minute lock would be the worst thing this
       widget could do to anybody, and "unstoppable" is not much of a moment if a
       lock stops it.

       It only applies while the bar is filling, though. Somebody dropping a
       hundred subs during the ninety seconds is trying to save the run, because
       that is what subs do in that window, and ending it on them for being too
       generous would be a genuinely horrible thing to do. */
    var outright = overkillAt();
    if (phase === "filling" && outright > 0 && amount >= outright) {
      if (cfg.overkillCosplay) enterCosplay(who);
      else enterOverkill(who);
      debugLog("outright amount reached by " + why, { amount: amount, who: who, cosplay: cfg.overkillCosplay });
      return;
    }

    /* The reset banner is up for ten seconds, and for a long time anything that
       arrived during them was thrown away without a word. That is a nasty little
       hole to have in a widget people are spending money into, so it is banked
       instead and lands on the fresh bar the moment the banner clears. */
    if (phase === "reset") {
      resetBank += amount;
      if (cfg.showFloat) floatToast("+" + round1(amount) + (who ? " " + who : "") + " " + cfg.words.banked);
      saveState();
      return;
    }

    // Nothing else fills the bar except while it is filling. During the nope
    // window the only thing that matters is whether someone saves it.
    if (phase !== "filling") return;

    /* A lock is a shield, not a wall. Subs pile up against it and once enough of
       them have landed it comes off, which gives chat something to do about a lock
       other than wait it out, and means the subs spent during one are working
       towards something visible instead of only earning a shake.

       Subs, cheers and donations can all do this, so the line under the bar can say
       what is left in any of the three. Channel points still bounce off, because
       a lock that anything at all could break would not be worth buying. */
    if (isLocked()) {
      if ((why !== "sub" && why !== "bits" && why !== "tip") || !(cfg.lockBreakSubs > 0)) { refuse(); return; }
      lockBreakPool += amount;
      if (cfg.showFloat) floatToast("+" + round1(amount) + (who ? " " + who : ""));
      pop();
      if (lockBreakPool < cfg.lockBreakSubs) { saveState(); render(); return; }

      // The lock only ever absorbs what it needed. Whatever is left over carries
      // on onto the bar, so a gift of twenty is not swallowed whole by a lock
      // that five subs would have opened.
      var spill = lockBreakPool - cfg.lockBreakSubs;
      lockBreakPool = 0;
      lockUntil = 0;
      saveState();
      render();
      if (cfg.showFloat) floatToast(who ? tpl(cfg.words.lockBrokenBy, { who: who }) : cfg.words.lockBroken);
      playClip(cfg.breakSound, cfg.breakVolume);
      if (spill > 0) addFill(spill, who, why);
      return;
    }

    fill = fill + amount;
    if (cfg.showFloat) floatToast("+" + round1(amount) + (who ? " " + who : ""));
    playClip(cfg.addSound, cfg.addVolume);
    pop();

    if (fill >= capacityNow()) enterPending();
    else { saveState(); render(); }
    debugLog("filled by " + why, { amount: amount, who: who, fill: fill });
  }

  function enterPending() {
    phase = "pending";
    lockUntil = 0;
    ender = "";
    overkill = false;
    nopePool = 0;
    nopeRedeems = 0;
    nopeUntil = clockNow() + cfg.nopeSeconds * 1000;
    subGraceUntil = clockNow() + cfg.saveGraceSeconds * 1000;
    saveState();
    startTicking();
    render();
    playClip(cfg.fullSound, cfg.fullVolume);
  }

  /* The one reward that takes points back off the bar. It grows with the bar in the
     same way the cost of a save does, so it stays worth its price on a big one. It
     only works while the bar is filling, because once it is full the only thing
     that matters is whether it gets saved, and pulling it below the top from under
     the countdown would quietly cancel the whole window. A redeem it cannot use
     gives the card the same little shake a turned-away lock does. */
  function pushBack(who) {
    var amount = scaled(cfg.pushBackAmount);
    if (phase !== "filling" || !(cfg.pushBackAmount > 0) || !(fill > 0)) { refuse(); return; }
    var taken = Math.min(fill, amount);
    fill -= taken;
    if (cfg.showFloat) floatToast("-" + round1(taken) + (who ? " " + who : ""));
    saveState();
    render();
    pop();
    debugLog("pushed back", { taken: taken, who: who, fill: fill });
  }

  function nope(who) {
    if (phase !== "pending") return;
    phase = "filling";
    fill = 0;
    nopeUntil = 0;
    nopePool = 0;
    nopeRedeems = 0;
    saveState();
    render();
    pop();
    playClip(cfg.savedSound, cfg.savedVolume);
    // Whoever tipped the pot over gets the credit, which is a small unfairness
    // to the four people who did most of the work, but it is their moment too.
    if (cfg.showFloat) floatToast(who ? tpl(cfg.words.savedBy, { who: who }) : cfg.words.saved);
  }

  /* Everything chips in together rather than any one person having to carry it.
     Subs, bits and channel points all pay into the same pot, counted in the same
     units as the bar, so five subs' worth of anything at all saves the run. On a
     small channel one person with fifty thousand points to spare is rare, but ten
     people with a few thousand each is an ordinary Tuesday, and a rescue that the
     whole chat does together is a much better ninety seconds than one that waits on
     whoever happens to be richest. */
  function chipIn(units, who) {
    if (phase !== "pending") return 0;
    units = Math.max(0, num(units, 0));
    if (units <= 0) return 0;
    nopePool += units;
    if (cfg.showFloat) floatToast("+" + round1(units) + (who ? " " + who : ""));
    if (nopePool >= nopeTargetNow()) { nope(who); return nopePool; }
    saveState();
    render();
    pop();
    return nopePool;
  }

  /* The gentler version of enterOverkill. It takes over the card exactly the same
     way, for exactly as long, but the run itself is untouched underneath: the bar
     simply carries on from wherever it already was once the banner clears, as
     though the gift had only ever been a very loud joke. */
  function enterCosplay(who) {
    phase = "reset";
    cosplay = true;
    cosplayResumeFill = fill;
    fill = capacityNow();
    lockUntil = 0;
    nopeUntil = 0;
    nopePool = 0;
    nopeRedeems = 0;
    ender = str(who, "");
    resetUntil = clockNow() + cfg.resetHoldSeconds * 1000;
    saveState();
    startTicking();
    render();
    pop();
    playClip(cfg.resetSound, cfg.resetVolume);
  }

  // The run ends here and no one gets a say in it.
  function enterOverkill(who) {
    phase = "reset";
    overkill = true;
    fill = capacityNow();
    lockUntil = 0;
    nopeUntil = 0;
    nopePool = 0;
    nopeRedeems = 0;
    ender = str(who, "");
    resetUntil = clockNow() + cfg.resetHoldSeconds * 1000;
    saveState();
    startTicking();
    render();
    pop();
    playClip(cfg.resetSound, cfg.resetVolume);
  }

  function enterReset() {
    phase = "reset";
    nopeUntil = 0;
    nopePool = 0;
    nopeRedeems = 0;
    resetUntil = clockNow() + cfg.resetHoldSeconds * 1000;
    saveState();
    render();
    playClip(cfg.resetSound, cfg.resetVolume);
  }

  /* The count only moves here, once the banner has cleared, so the card keeps
     showing the bar that just filled for as long as the reset is on screen instead
     of flickering to a new denominator half way through it. */
  function finishReset() {
    phase = "filling";
    resetUntil = 0;
    resetCount += 1;
    fill = 0;
    overkill = false;
    ender = "";
    var owed = resetBank;
    resetBank = 0;
    saveState();
    render();
    // Whatever arrived during the banner lands now, through the ordinary route, so
    // a bank big enough to refill the bar does exactly what that would normally do.
    if (owed > 0) addFill(owed, "", "banked");
  }

  /* The banner clears and the bar picks up exactly where it left off, since nothing
     about the run actually happened. No reset, so the escalation does not move. */
  function finishCosplay() {
    phase = "filling";
    resetUntil = 0;
    cosplay = false;
    ender = "";
    fill = cosplayResumeFill;
    cosplayResumeFill = 0;
    var owed = resetBank;
    resetBank = 0;
    saveState();
    render();
    if (owed > 0) addFill(owed, "", "banked");
  }

  /* Clears the bar but keeps how far the escalation has got, so a mod waving away
     a stale bar with !barreset does not quietly hand chat a smaller one. */
  function clearAll() {
    phase = "filling";
    fill = 0;
    lockUntil = 0;
    nopeUntil = 0;
    resetUntil = 0;
    nopePool = 0;
    nopeRedeems = 0;
    lockBreakPool = 0;
    resetBank = 0;
    overkill = false;
    cosplay = false;
    cosplayResumeFill = 0;
    ender = "";
    clearToasts();
    stopTicking();
    saveState();
    render();
  }

  /* Locks extend rather than replace, so a second lock bought while the first is
     running adds to it instead of throwing away whatever was left. The running
     total is capped, because a bar chat can keep locked indefinitely stops being
     a bar and starts being a way to switch the whole bit off. */
  function applyLock(minutes, who, uncapped) {
    if (phase !== "filling") return 0;
    var n = clockNow();
    // The caps are there to stop chat pooling the bit into a coma. A mod typing a
    // number has already decided, so their lock is taken at face value.
    var ceiling = uncapped ? Infinity : n + cfg.lockMaxTotalMinutes * 60000;
    var from = Math.max(n, lockUntil);
    lockUntil = Math.min(ceiling, from + minutes * 60000);
    saveState();
    startTicking();
    render();
    if (cfg.showFloat) floatToast(who ? tpl(cfg.words.lockedBy, { who: who }) : cfg.words.locked);
    playClip(cfg.lockSound, cfg.lockVolume);
    return lockUntil - n;
  }

  function lockMinutesForCost(cost) {
    // A cost of zero is what an unreadable payload looks like, and the clamp
    // turns it into the shortest lock rather than a lock of no time at all.
    return clamp(cost / cfg.pointsPerLockedMinute, cfg.lockMinMinutes, cfg.lockMaxMinutes);
  }

  /* The reward's own name is the length when it says one. The first real lock on
     a live channel was called "lock the bar (2 mins)" and came out as a minute,
     because the length was being worked out from the price and the price rate
     saved in StreamElements was not the one the reward had been priced against.
     A viewer who bought two minutes should get two minutes, and the name is the
     one thing they definitely read before they spent, so it wins over the price.
     The price is only used when the name has no time in it at all.

     Understood: "2 min", "2 mins", "5 minutes", "30 sec", "90s", "1 hour",
     "1m30s". A bare number is ignored, because "lock the bar 2" could mean
     anything and guessing wrong is worse than falling back to the price. */
  function minutesInTitle(t) {
    var text = String(t || "").toLowerCase();
    var re = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?![a-z])/g;
    var seconds = 0, m;
    while ((m = re.exec(text)) !== null) {
      var n = num(m[1], 0);
      var u = m[2].charAt(0);
      seconds += u === "h" ? n * 3600 : (u === "m" ? n * 60 : n);
    }
    return seconds > 0 ? seconds / 60 : 0;
  }
  function lockMinutesFor(r) {
    var named = minutesInTitle(r.title);
    if (named > 0) return clamp(named, cfg.lockMinMinutes, cfg.lockMaxMinutes);
    return lockMinutesForCost(r.cost);
  }

  // ---------------------------------------------------------------------------
  // The clock
  // ---------------------------------------------------------------------------
  /* One interval drives all three deadlines. It runs only while something is
     actually counting down, so a bar sat quietly at 30 out of 100 is not waking
     the browser source up four times a second for no reason. */
  function needsTicking() {
    if (pausedAt) return false;
    return phase === "pending" || phase === "reset" || isLocked();
  }
  function startTicking() {
    if (tickTimer) return;
    tickTimer = setInterval(tick, 250);
  }
  function stopTicking() {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }
  function tick() {
    var n = clockNow();
    if (phase === "pending" && n >= nopeUntil) { enterReset(); return; }
    if (phase === "reset" && n >= resetUntil) { if (cosplay) finishCosplay(); else finishReset(); }
    // A lock that ran its course takes the subs piled against it with it. They
    // were spent on getting rid of a lock that has gone of its own accord.
    if (lockBreakPool > 0 && !isLocked()) { lockBreakPool = 0; saveState(); }
    if (!needsTicking()) { stopTicking(); saveState(); }
    render();
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------
  function handleSub(event) {
    event = event || {};
    debugLog("subscriber-latest", event);
    var units = subUnits(event);
    if (units <= 0) return;

    // During the window a sub is not filling anything, it is helping to buy the
    // run back, so it goes into the pot at exactly the value it would have had
    // going the other way.
    if (phase === "pending") {
      /* Subs that land in the moments after the bar fills were almost certainly meant
         for the bar, from people who hit subscribe before it was full. They are left
         to lapse rather than quietly saving a run somebody was trying to end. */
      if (clockNow() < subGraceUntil) {
        debugLog("sub ignored in the grace period after the bar filled", { who: nameOf(event) });
        return;
      }
      if (!cfg.moneySavesRun) { refuse(); return; }
      extendWindow();
      chipIn(units * weightForTier(event.tier), nameOf(event));
      return;
    }

    addFill(units * weightForTier(event.tier), nameOf(event), "sub");
  }

  /* A sub, a cheer or a donation put in while chat is saving the run buys the run a
     little more time as well as chipping into the save. It goes on before the
     chip-in on purpose: if that contribution is the one that finishes the save the
     window is gone anyway, and if it is not, the countdown and the saved deadline
     both see the new time. A gift bomb is one event, so it earns the time once.
     Channel points chip in without it. */
  function extendWindow() {
    nopeUntil += cfg.saveExtendSeconds * 1000;
  }

  function handleCheer(event) {
    event = event || {};
    debugLog("cheer-latest", event);
    var bits = num(event.amount, 0);
    if (bits <= 0) return;
    // Kept fractional on purpose, so a small cheer is worth a little rather than
    // being silently worth nothing at all.
    var units = bits / 100 * cfg.bitsPer100;
    if (phase === "pending") {
      if (!cfg.moneySavesRun) { refuse(); return; }
      extendWindow();
      chipIn(units, str(event.name, ""));
      return;
    }
    addFill(units, str(event.name, ""), "bits");
  }

  function handleTip(event) {
    event = event || {};
    debugLog("tip-latest", event);
    var amount = num(event.amount, 0);
    if (amount <= 0) return;
    var units = amount / cfg.tipPerSub * cfg.subTier1;
    var who = str(event.name, "");
    if (phase === "pending") {
      if (!cfg.moneySavesRun) { refuse(); return; }
      extendWindow();
      chipIn(units, who);
      return;
    }
    addFill(units, who, "tip");
  }

  function handleRedemption(event) {
    debugLog("redemption arrived", event);
    var r = readRedemption(event);
    debugLog("redemption read as", r);
    if (!r.title) {
      if (cfg.debug && typeof console !== "undefined" && console.warn) {
        console.warn("[rage-bar] a redemption arrived with no readable title, ignoring it");
      }
      return;
    }
    // Nope is checked first so that saving the run always wins, whatever else a
    // reward title might also happen to start with.
    if (titleMatches(r.title, cfg.nopeRewardTitle)) {
      /* Five of these save the run, however big the bar has grown. This is the one
         thing that does not scale up with each reset: the pot gets dearer every
         time, and without this the channel points would matter less and less on a
         big bar, so it is the way they stay worth spending. It only counts while the
         window is open, because a redeem outside it saves nothing and its points are
         simply gone. Each one still chips into the pot as well, so whichever comes
         first saves the run. */
      if (!cfg.moneySavesRun) {
        /* With subs, cheers and donations switched off as ways to save, the redeems
           are the only way, so it is a plain count of them and the pot is not used at
           all. The count is never lower than one, or nothing could save the run. */
        if (phase !== "pending") return;
        nopeRedeems += 1;
        if (nopeRedeems >= redeemsNeeded()) { nope(r.user); return; }
        if (cfg.showFloat) floatToast("+1" + (r.user ? " " + r.user : ""));
        saveState();
        render();
        pop();
        return;
      }
      if (phase === "pending" && cfg.nopeRedeemsToSave > 0) {
        nopeRedeems += 1;
        if (nopeRedeems >= cfg.nopeRedeemsToSave) { nope(r.user); return; }
      }
      chipIn(r.cost / cfg.nopePointsPerSub, r.user);
      return;
    }
    if (titleMatches(r.title, cfg.pushBackRewardTitle)) {
      pushBack(r.user);
      return;
    }
    if (titleMatches(r.title, cfg.lockRewardTitle)) {
      applyLock(lockMinutesFor(r), r.user);
      return;
    }
    if (titleMatches(r.title, cfg.fillRewardTitle)) {
      addFill(cfg.fillRewardAmount, r.user, "redeem");
    }
  }

  /* Mod commands, for the times a redeem misfires or the streamer needs the bar out of
     the way right now. They are a hand on the wheel rather than part of the game,
     so they skip the pooling and the caps that chat plays by. */
  function setFill(next) {
    var cap = capacityNow();
    next = clamp(next, 0, cap);

    /* Correcting the number while the clock is running is overruling the panic,
       not restarting it. Nudging a bar that is still full leaves the window and
       everything chat has chipped into it exactly where they were, because a mod
       typing "!bar +1" should not quietly hand back the ninety seconds and throw
       away four people's subs. Dropping it below the top is what actually calls
       the whole thing off. */
    if (phase !== "filling") {
      if (next >= cap) { fill = next; saveState(); render(); return; }
      phase = "filling";
      nopeUntil = 0;
      resetUntil = 0;
      nopePool = 0;
      nopeRedeems = 0;
      overkill = false;
      cosplay = false;
      cosplayResumeFill = 0;
      ender = "";
      stopTicking();
      if (needsTicking()) startTicking();
    }

    fill = next;
    if (fill >= cap) { enterPending(); return; }
    saveState();
    render();
    pop();
  }

  function applyAdjustment(rest) {
    var m = String(rest).trim().match(/^(set\s+|=\s*)?([+-]?\d+(?:\.\d+)?)$/i);
    if (!m) return;
    var n = num(m[2], NaN);
    if (isNaN(n)) return;
    if (m[1]) setFill(n);
    else setFill(fill + n);
  }

  /* !barsub 5 pretends five tier 1 subs just arrived, for testing, and it goes
     through exactly the same door a real gift of five would. That is the point
     of it: !bar +5 moves the number, but this fills the bar, chips into a save
     during the countdown, piles up against a lock, and a big enough number ends
     the run outright, so what you see is what a real gift would do. For the
     same reason it does nothing while the bar is switched off, because real
     subs do nothing then either. A tier can go on the end: !barsub 3 t3. */
  function testSubs(rest, who) {
    var parts = String(rest || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    var count = 1;
    var takingBack = false;
    if (parts.length && /^-\d+$/.test(parts[0])) {
      takingBack = true;
      count = parseInt(parts.shift().slice(1), 10);
    } else if (parts.length && /^\d+$/.test(parts[0])) count = parseInt(parts.shift(), 10);
    else if (parts.length && !/^(t(ier)?)?[123]$/.test(parts[0])) return;
    if (count <= 0) return;
    var tier = "1000";
    if (parts.length) {
      // "t3", "tier3" and "tier 3" all mean the same thing.
      var t = parts.join("").replace(/^t(ier)?/, "");
      if (t === "2") tier = "2000";
      else if (t === "3") tier = "3000";
      else if (t !== "1") return;
    }
    /* A negative count is a manual correction, for a sub that was refunded or a test
       that went one too far. It works while the bar is switched off, because
       correcting the bar is exactly what you do between streams. */
    if (takingBack) { takeBack(count * weightForTier(tier)); return; }
    if (pausedAt) {
      debugLog("!barsub while switched off, ignored the way a real sub would be", { count: count });
      return;
    }
    handleSub({ gifted: true, bulkGifted: true, amount: count, tier: tier, sender: who });
  }

  /* !barbits 500 is a cheer of 500 bits that nobody sent, for a cheer that went
     missing or a test. It goes through exactly the route a real one does, so it fills
     the bar, chips into a save and counts against a lock, and like a real cheer it is
     ignored while the bar is switched off. A minus takes them back off as a
     correction, which does work while it is off. */
  function testBits(rest, who) {
    var m = /^(-?)(\d+)$/.exec(String(rest || "").trim().replace(/,/g, ""));
    if (!m) return;
    var bits = parseInt(m[2], 10);
    if (!(bits > 0)) return;
    if (m[1]) { takeBack(bits / 100 * cfg.bitsPer100); return; }
    if (pausedAt) {
      debugLog("!barbits while switched off, ignored the way a real cheer would be", { bits: bits });
      return;
    }
    handleCheer({ amount: bits, name: who });
  }

  /* Takes points back off wherever a real sub would have landed right now: the bar
     while it is filling, the save pot while chat is saving the run, and the bank
     while the reset banner is up. Nothing goes below zero. */
  function takeBack(points) {
    if (!(points > 0)) return;
    if (phase === "pending") nopePool = Math.max(0, nopePool - points);
    else if (phase === "reset") resetBank = Math.max(0, resetBank - points);
    else fill = Math.max(0, fill - points);
    saveState();
    render();
    pop();
  }

  function handleMessage(data) {
    if (!data) return;
    var text = String(data.text || "").trim();
    if (!text) return;
    var first = text.toLowerCase().split(/\s+/)[0];
    var rest = text.replace(/^\S+\s*/, "").trim();
    var roles = rolesOf(data);
    var name = str(data.displayName, str(data.nick, ""));

    if (first === cfg.cmd.sub) { if (canManage(roles)) testSubs(rest, name); return; }
    if (first === cfg.cmd.bits) { if (canManage(roles)) testBits(rest, name); return; }
    if (first === cfg.cmd.on) { if (canManage(roles)) switchOn(); return; }
    if (first === cfg.cmd.off) { if (canManage(roles)) switchOff(); return; }
    if (first === cfg.cmd.reset) {
      if (!canManage(roles)) return;
      /* A bare !barreset clears the bar and keeps how far the escalation has got.
         With a bar number after it, !barreset 1 goes back to the first bar and
         !barreset 3 jumps to the third, which is how a miscount gets put right. */
      if (/^\d+$/.test(rest)) resetCount = clamp(parseInt(rest, 10), 1, 100) - 1;
      clearAll();
      return;
    }
    if (first === cfg.cmd.unlock) {
      if (canManage(roles)) { lockUntil = 0; lockBreakPool = 0; saveState(); render(); }
      return;
    }
    if (first === cfg.cmd.lock) {
      if (canManage(roles)) applyLock(parseMinutes(rest, cfg.manualLockMinutes), name, true);
      return;
    }
    if (first === cfg.cmd.nope) { if (canManage(roles)) nope(name); return; }
    if (first === cfg.cmd.fill) {
      if (canManage(roles) && phase === "filling") { fill = capacityNow(); enterPending(); }
      return;
    }
    if (first === cfg.cmd.view) {
      if (!rest) { pop(); return; }   // a bare !bar just draws the eye to it
      if (canManage(roles)) applyAdjustment(rest);
    }
  }

  /* !baroff for the streams that are not this game. Subs and cheers keep coming
     in on those nights, and none of them were meant as a vote on a climb the streamer is
     not doing, so while it is off nothing chat spends reaches the bar at all.
     Mod commands and the settings panel still work, because correcting the bar
     is exactly the kind of thing you do between streams. */
  function switchOff() {
    if (pausedAt) return;
    pausedAt = nowMs();
    stopTicking();
    saveState();
    render();
  }
  function switchOn() {
    if (!pausedAt) return;
    // Everything that was counting down carries on from where it stopped.
    var slept = nowMs() - pausedAt;
    if (lockUntil) lockUntil += slept;
    if (nopeUntil) nopeUntil += slept;
    if (resetUntil) resetUntil += slept;
    pausedAt = 0;
    if (needsTicking()) startTicking();
    saveState();
    render();
    pop();
  }

  function handleButton(field) {
    switch (field) {
      case "btnSoundAdd": playClip(cfg.addSound, cfg.addVolume); break;
      case "btnSoundLock": playClip(cfg.lockSound, cfg.lockVolume); break;
      case "btnSoundBreak": playClip(cfg.breakSound, cfg.breakVolume); break;
      case "btnSoundFull": playClip(cfg.fullSound, cfg.fullVolume); break;
      case "btnSoundSaved": playClip(cfg.savedSound, cfg.savedVolume); break;
      case "btnSoundReset": playClip(cfg.resetSound, cfg.resetVolume); break;
      case "btnFillStep": addFill(cfg.manualStep, "", "button"); break;
      case "btnFillBar":
        if (phase === "filling" && !isLocked()) { fill = capacityNow(); enterPending(); }
        break;
      case "btnLock": applyLock(cfg.manualLockMinutes, ""); break;
      case "btnUnlock": lockUntil = 0; lockBreakPool = 0; saveState(); render(); break;
      case "btnNope": nope(""); break;
      case "btnReset": clearAll(); break;
      case "btnRestartEscalation": resetCount = 0; clearAll(); break;
      case "btnOn": switchOn(); break;
      case "btnOff": switchOff(); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function setClass(node, name, on) {
    if (!node) return;
    if (on) node.classList.add(name);
    else node.classList.remove(name);
  }

  /* The fill warms towards the alarm colour as the bar approaches the top, which
     is done here rather than with CSS color-mix() because the browser source
     inside OBS can be several CEF versions behind and a colour that silently
     fails to parse is a bar that silently stops warning anybody.

     StreamElements hands colour Fields back in whatever format it likes, usually
     rgba rather than the hex we ship, so this reads both and gives up gracefully
     on anything it does not recognise. */
  function parseColor(v) {
    var t = String(v || "").trim();
    var m = t.match(/^#([0-9a-f]{3})$/i);
    if (m) {
      return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16),
              parseInt(m[1][2] + m[1][2], 16)];
    }
    m = t.match(/^#([0-9a-f]{6})$/i);
    if (m) {
      return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16),
              parseInt(m[1].slice(4, 6), 16)];
    }
    m = t.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
    if (m) return [num(m[1], 0), num(m[2], 0), num(m[3], 0)];
    return null;
  }
  function mixColor(from, to, t) {
    var a = parseColor(from), b = parseColor(to);
    if (!a || !b) return null;
    var out = [];
    for (var i = 0; i < 3; i++) {
      out.push(Math.round(a[i] + (b[i] - a[i]) * clamp(t, 0, 1)));
    }
    return "rgb(" + out.join(", ") + ")";
  }

  // A sub is 1 and a tier 2 is 1.5, so a bare number is right more often than not.
  function round1(n) { return Math.round(n * 10) / 10; }

  function commas(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  /* What is left, in the three things people actually give: subs, bits and money.
     Each is rounded up, because "12,000 bits to go" is only true if 12,000 bits
     really would finish it, and the small subtraction is there so a sum that lands
     exactly on a whole number in the maths is not pushed up by floating point. The
     same three are shown whether the bar is filling or being saved, and only the
     ending changes. */
  function remainingText(remaining, ending) {
    var parts = [];
    if (cfg.subTier1 > 0) {
      var subs = Math.ceil(remaining / cfg.subTier1 - 1e-9);
      parts.push(commas(subs) + " " + (subs === 1 ? cfg.words.sub : cfg.words.subs));
    }
    if (cfg.bitsPer100 > 0) {
      parts.push(commas(Math.ceil(remaining / cfg.bitsPer100 * 100 - 1e-6)) + " " + cfg.words.bits);
    }
    if (cfg.subTier1 > 0) {
      var pence = Math.ceil(remaining / cfg.subTier1 * cfg.tipPerSub * 100 - 1e-6);
      var whole = Math.floor(pence / 100);
      var rest = pence % 100;
      parts.push(cfg.currencySymbol + commas(whole) + "." + (rest < 10 ? "0" : "") + rest);
    }
    return (parts.length ? parts.join(" / ") : round1(remaining)) + " " + ending;
  }

  function clockText(msLeft) {
    var total = Math.max(0, Math.ceil(msLeft / 1000));
    var m = Math.floor(total / 60);
    var s = total % 60;
    return m + ":" + (s < 10 ? "0" + s : String(s));
  }

  function render() {
    if (!el.card) return;
    var n = clockNow();
    var locked = isLocked();

    var cap = capacityNow();
    /* While the run is up for saving, the bar is a different bar. The big one is
       full and that is why the clock is running, so what is worth watching is the
       little one filling up from empty as chat pays to buy the run back. */
    var saveTarget = nopeTargetNow();
    var redeemsOnly = phase === "pending" && !cfg.moneySavesRun;
    var pct = redeemsOnly
      ? clamp((nopeRedeems / redeemsNeeded()) * 100, 0, 100)
      : phase === "pending"
        ? clamp((nopePool / saveTarget) * 100, 0, 100)
        : clamp((fill / cap) * 100, 0, 100);
    if (el.fill) el.fill.style.width = pct + "%";

    /* How far into the last stretch the bar is, from 0 to 1. A bar at 10 of 50
       and a bar at 49 of 50 used to look the same apart from their width, which
       is a waste of the only thing on screen that anybody is watching. */
    var dread = phase === "filling" && cfg.dreadFrom > 0
      ? clamp((fill - (cap - cfg.dreadFrom)) / cfg.dreadFrom, 0, 1)
      : 0;
    if (el.app) {
      // Left exactly as the theme set it until there is actually something to
      // warn about, so the ordinary case never goes near the colour maths.
      var theme = resolvedTheme();
      var hot = dread > 0 ? mixColor(theme.fillTo, theme.alarm, dread) : null;
      el.app.style.setProperty("--fill-to", hot || theme.fillTo);
    }
    setClass(el.card, "is-close", dread > 0);
    setClass(el.card, "is-brink", dread >= 0.6);

    setClass(el.card, "is-locked", locked);
    setClass(el.card, "is-pending", phase === "pending");
    setClass(el.card, "is-reset", phase === "reset");

    if (el.lock) el.lock.hidden = !(locked && cfg.showLock);
    setClass(el.card, "is-off", !!pausedAt);
    setClass(el.app, "is-hidden", !!pausedAt && cfg.hideWhenOff);

    if (el.title) {
      el.title.textContent =
        phase === "pending" ? cfg.pendingTitle :
        phase === "reset" ? (cosplay ? cfg.cosplayTitle : (overkill ? cfg.overkillTitle : cfg.resetTitle)) : cfg.label;
    }

    if (el.timer) {
      if (phase === "pending") {
        el.timer.hidden = false;
        el.timer.textContent = Math.max(0, Math.ceil((nopeUntil - n) / 1000)) + cfg.words.seconds;
      } else if (locked) {
        el.timer.hidden = false;
        el.timer.textContent = clockText(lockUntil - n);
      } else {
        el.timer.hidden = true;
        el.timer.textContent = "";
      }
    }

    if (el.readout) {
      el.readout.textContent = redeemsOnly
        ? tpl(cfg.words.readoutRedeems, { n: Math.min(redeemsNeeded(), nopeRedeems), total: redeemsNeeded() })
        : phase === "pending"
          ? tpl(cfg.words.readoutPoints, { n: Math.min(saveTarget, Math.floor(nopePool)), total: saveTarget })
          : tpl(cfg.words.readoutBar, { n: Math.min(cap, Math.floor(fill)), total: cap });
    }

    /* The line under the bar always answers the same question, which is "what is
       the thing being counted towards right now and how far off is it". The goal
       changes with the state, so the line does too: filling towards a reset,
       piling up against a lock, or scraping together enough to buy the run back.
       Nobody arriving mid-panic should have to ask chat what is going on. */
    if (el.note) {
      var note = "";
      if (pausedAt) {
        note = cfg.words.off;
      } else if (phase === "pending") {
        note = redeemsOnly ? redeemsLeftText() : remainingText(Math.max(0, saveTarget - nopePool), cfg.words.toSave);
      } else if (phase === "reset") {
        note = overkill && ender ? tpl(cfg.words.endedBy, { who: ender }) : "";
      } else if (locked) {
        note = remainingText(Math.max(0, cfg.lockBreakSubs - lockBreakPool), cfg.words.toBreak);
      } else {
        note = remainingText(Math.max(0, cap - fill), cfg.words.toGo);
      }
      el.note.hidden = !note;
      el.note.textContent = note;
    }
  }

  function pop() {
    if (!el.card) return;
    el.card.classList.remove("pop");
    void el.card.offsetWidth; // reflow so the animation retriggers
    el.card.classList.add("pop");
  }

  function refuse() {
    if (!el.card) return;
    el.card.classList.remove("refused");
    void el.card.offsetWidth;
    el.card.classList.add("refused");
  }

  /* Queued rather than overwritten. Five people chipping in to save a run fire
     five of these inside a second, and those are exactly the moments somebody
     wants to see their own name on the overlay rather than whoever happened to
     click last. Capped at five deep so a busy minute cannot back up a queue that
     is still playing out long after the thing it described. */
  function floatToast(txt) {
    if (!el.float) return;
    floatQueue.push(txt);
    if (floatQueue.length > 5) floatQueue.shift();
    if (!floatBusy) nextToast();
  }
  function nextToast() {
    if (!el.float || !floatQueue.length) { floatBusy = false; return; }
    floatBusy = true;
    el.float.textContent = floatQueue.shift();
    el.float.hidden = false;
    el.float.style.animation = "none";
    void el.float.offsetWidth;
    el.float.style.animation = "";
    if (floatTimer) clearTimeout(floatTimer);
    floatTimer = setTimeout(function () {
      el.float.hidden = true;
      nextToast();
    }, Math.round(cfg.look.floatMs * 1000));
  }
  function clearToasts() {
    floatQueue.length = 0;
    floatBusy = false;
    if (floatTimer) { clearTimeout(floatTimer); floatTimer = null; }
    if (el.float) el.float.hidden = true;
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------
  window.addEventListener("onEventReceived", function (obj) {
    if (!obj || !obj.detail) return;
    var listener = obj.detail.listener;
    var event = obj.detail.event || {};
    // Anything this widget does not otherwise understand is logged whole while
    // debugging is on. If a redemption ever arrives in a shape nobody expected,
    // this is the line in the console that says exactly what it looked like.
    if (!KNOWN_LISTENERS[listener]) debugLog("unrecognised event, listener " + listener, obj.detail);

    // Checked before the listener, because a redemption's listener is not
    // documented and cannot be relied on.
    if (isRedemption(listener, event)) {
      if (pausedAt) { debugLog("channelPoints while switched off, ignored", event); return; }
      handleRedemption(event);
      return;
    }
    if (listener === "message") handleMessage(event.data || {});
    else if (listener === "widget-button") handleButton(event.field);
    // Everything below is chat spending, and none of it counts while switched off.
    else if (pausedAt) return;
    else if (listener === "subscriber-latest") handleSub(event);
    else if (listener === "cheer-latest") handleCheer(event);
    else if (listener === "tip-latest") handleTip(event);
  });

  window.addEventListener("onWidgetLoad", function (obj) {
    var fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
    readConfig(fieldData);

    el.app = document.getElementById("rage-app");
    el.card = document.getElementById("rage-card");
    el.title = document.getElementById("rage-title");
    el.timer = document.getElementById("rage-timer");
    el.fill = document.getElementById("rage-fill");
    el.readout = document.getElementById("rage-readout");
    el.note = document.getElementById("rage-note");
    el.lock = document.getElementById("rage-lock");
    el.float = document.getElementById("rage-float");

    applyTheme();
    // A queue left over from before the settings panel was saved is describing a
    // moment that has already passed, so it does not get to play out afterwards.
    clearToasts();

    /* StreamElements re-fires this event every time a field is saved, and the
       store write is debounced, so a second load can hand back values older than
       what is already on screen. The token drops a read that a newer load has
       overtaken, which is the guard the voting widget learned to want. */
    var token = ++loadToken;
    restoreState(function (saved) {
      if (token !== loadToken) return;
      if (saved) {
        if (saved.instance && saved.instance !== INSTANCE &&
            nowMs() - saved.writtenAt < 30000 &&
            typeof console !== "undefined" && console.warn) {
          console.warn("[rage-bar] another copy of this widget wrote to the saved " +
            "state moments ago, so two of them are probably running at once. The " +
            "StreamElements overlay editor counts as one. They will tread on each " +
            "other, so close one.");
        }
        fill = saved.fill;
        phase = saved.phase;
        lockUntil = saved.lockUntil;
        nopeUntil = saved.nopeUntil;
        resetUntil = saved.resetUntil;
        nopePool = saved.nopePool;
        nopeRedeems = saved.nopeRedeems;
        lockBreakPool = saved.lockBreakPool;
        resetBank = saved.resetBank;
        pausedAt = saved.pausedAt;
        resetCount = saved.resetCount;
        overkill = saved.overkill;
        cosplay = saved.cosplay;
        cosplayResumeFill = saved.cosplayResumeFill;
        ender = saved.ender;
        settleRestoredPhase();
      } else {
        fill = 0;
        phase = "filling";
        lockUntil = 0;
        nopeUntil = 0;
        resetUntil = 0;
        nopePool = 0;
        nopeRedeems = 0;
        lockBreakPool = 0;
        resetBank = 0;
        overkill = false;
        cosplay = false;
        cosplayResumeFill = 0;
        ender = "";
        pausedAt = 0;
        resetCount = 0;
      }
      stopTicking();
      if (needsTicking()) startTicking();
      render();
    });
  });
})();
