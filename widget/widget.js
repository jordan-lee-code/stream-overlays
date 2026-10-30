/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Squat Tracker. StreamElements custom widget logic.
 *
 * A tiny brown sticker that shows a running squat count in cream. Gifted-sub
 * bombs drive it: for
 * every whole block of subs (5 by default) it adds a block of squats (5 by
 * default), rounding down, so a 16-sub gift adds 15 and a 27-sub gift adds 25.
 * The streamer (or a trusted mod) can nudge the count from chat for partial corrections
 * with !squats +5 / !squats -5, or wipe it back to zero with !squatsreset. When
 * the squats are being worked off on stream, !squatslock stops new gifts adding
 * to the pile while manual corrections keep working, and !squatsunlock opens it
 * back up again.
 *
 * It leans on nothing beyond the two custom events and
 * SE_API.store, so dev/harness.js can drive the exact file in a plain browser.
 */
(function () {
  "use strict";

  var STORE_KEY = "squat_tracker_v1";

  /* Style presets. The same fourteen, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. */
  var PRESETS = {
    glass: { panel: "rgba(0, 0, 0, 0.55)", strong: "rgba(0, 0, 0, 0.7)", text: "#FFFFFF", accent: "#FFFFFF", font: "BioRhyme" },
    frost: { panel: "rgba(255, 255, 255, 0.72)", strong: "rgba(255, 255, 255, 0.88)", text: "#1B2130", accent: "#1B2130", font: "BioRhyme" },
    midnight: { panel: "rgba(10, 18, 46, 0.72)", strong: "rgba(10, 18, 46, 0.88)", text: "#E8EEFF", accent: "#7FA8FF", font: "BioRhyme" },
    sunset: { panel: "rgba(48, 18, 42, 0.72)", strong: "rgba(48, 18, 42, 0.88)", text: "#FFF1E6", accent: "#FF9A5A", font: "BioRhyme" },
    forest: { panel: "rgba(12, 36, 28, 0.72)", strong: "rgba(12, 36, 28, 0.88)", text: "#EAF7EE", accent: "#6FD6A0", font: "BioRhyme" },
    ocean: { panel: "rgba(6, 36, 50, 0.72)", strong: "rgba(6, 36, 50, 0.88)", text: "#E6F8FF", accent: "#4CD3E0", font: "BioRhyme" },
    rose: { panel: "rgba(58, 14, 34, 0.72)", strong: "rgba(58, 14, 34, 0.88)", text: "#FFE9F1", accent: "#FF8FB8", font: "BioRhyme" },
    neon: { panel: "rgba(4, 4, 16, 0.82)", strong: "rgba(4, 4, 16, 0.92)", text: "#FFFFFF", accent: "#00F0FF", font: "BioRhyme" },
    cosycabin: { panel: "#F5ECD6", strong: "#F5ECD6", text: "#57442E", accent: "#7C6142", font: "Chicle" },
    pastel: { panel: "#FFF6E9", strong: "#FFF6E9", text: "#6B4F3A", accent: "#FF8A65", font: "Baloo 2" },
    celestial: { panel: "#2E1A47", strong: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", font: "Cinzel" },
    pastelgoth: { panel: "#3A3340", strong: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", font: "Quicksand" },
    pastelpink: { panel: "#FFE3EC", strong: "#FFE3EC", text: "#6A2E4B", accent: "#D95C8A", font: "Fredoka" },
    faegreen: { panel: "#2C4A36", strong: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", font: "Almendra" }
  };
  var BASE = PRESETS.glass;

  // ---- runtime state ----
  var cfg = {};
  var squats = 0;
  var locked = false;
  var el = {};
  var saveTimer = null;
  var floatTimer = null;
  var carry = 0;            // gifted subs that have not yet filled a block

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

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
  function rgba(hex, alpha) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return "rgba(0, 0, 0, " + alpha + ")";
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + alpha + ")";
  }

  function readConfig(f) {
    f = f || {};
    cfg = {
      cmd: {
        view: str(f.viewCommand, "!squats").toLowerCase().trim(),
        reset: str(f.resetCommand, "!squatsreset").toLowerCase().trim(),
        lock: str(f.lockCommand, "!squatslock").toLowerCase().trim(),
        unlock: str(f.unlockCommand, "!squatsunlock").toLowerCase().trim()
      },
      whoCanManage: str(f.whoCanManage, "mods"),
      subsPerBlock: Math.max(1, Math.round(num(f.subsPerBlock, 5))),
      squatsPerBlock: Math.max(1, Math.round(num(f.squatsPerBlock, 5))),
      startCount: Math.max(0, Math.round(num(f.startCount, 0))),
      maxCount: Math.max(0, Math.round(num(f.maxCount, 0))),
      countSingleGifts: bool(f.countSingleGifts, true),
      countNewSubs: bool(f.countNewSubs, false),
      carryLeftover: bool(f.carryLeftover, false),
      debug: bool(f.debug, false),
      label: str(f.label, ""),
      showFloat: bool(f.showFloat, true),
      showLock: bool(f.showLock, true),
      floatPlus: str(f.floatPlus, "+"),
      floatSuffix: str(f.floatSuffix, ""),
      floatMs: Math.round(clamp(num(f.floatSeconds, 1.5), 0.3, 10) * 1000),
      themePreset: str(f.themePreset, "glass"),
      fontFamily: str(f.fontFamily, BASE.font),
      colors: {
        bg: str(f.colorBg, "#FFFFFF"),
        text: BASE.text,
        accent: str(f.colorAccent, "#000000"),
        count: str(f.colorCount, "#FFFFFF"),
        label: str(f.colorLabel, "#FFFFFF"),
        border: str(f.colorBorder, "#FFFFFF"),
        lock: str(f.colorLock, "#FFFFFF"),
        float: str(f.colorFloat, "#FFFFFF"),
        floatBg: str(f.colorFloatBg, "#000000")
      },
      boxOpacity: clamp(num(f.boxOpacity, 0.55), 0, 1),
      look: {
        radius: clamp(num(f.radius, 14), 0, 50),
        padV: clamp(num(f.paddingV, 6), 0, 40),
        padH: clamp(num(f.paddingH, 12), 0, 40),
        gap: clamp(num(f.gap, 1), 0, 20),
        tilt: clamp(num(f.tilt, 0), -20, 20),
        borderW: Math.max(0, num(f.borderWidth, 0)),
        shadow: bool(f.shadow, false),
        textShadow: bool(f.textShadow, false),
        tail: bool(f.showTail, false),
        countScale: clamp(num(f.countScale, 1), 0.3, 2),
        labelScale: clamp(num(f.labelScale, 1), 0.3, 3),
        floatScale: clamp(num(f.floatScale, 1), 0.3, 3),
        countWeight: str(f.countWeight, "800"),
        labelWeight: str(f.labelWeight, "700"),
        floatWeight: str(f.floatWeight, "700"),
        labelOpacity: clamp(num(f.labelOpacity, 1), 0, 1),
        labelSpacing: clamp(num(f.labelSpacing, 0.03), 0, 0.5),
        popScale: clamp(num(f.popScale, 1.16), 1, 2),
        popMs: clamp(num(f.popSeconds, 0.42), 0.1, 3),
        animations: bool(f.animations, true)
      },
      sounds: {
        enabled: bool(f.soundsEnabled, true),
        gift: { url: str(f.giftSound, ""), vol: clamp(num(f.giftSoundVolume, 70), 0, 100) },
        lock: { url: str(f.lockSound, ""), vol: clamp(num(f.lockSoundVolume, 70), 0, 100) },
        unlock: { url: str(f.unlockSound, ""), vol: clamp(num(f.unlockSoundVolume, 70), 0, 100) }
      }
    };
  }

  // A sound is a file uploaded into the widget settings. Each play makes a fresh
  // Audio so quick gifts can overlap, and a browser that refuses to autoplay stays
  // quiet rather than erroring.
  function playSound(kind) {
    var s = cfg.sounds;
    if (!s || !s.enabled || !s[kind] || !s[kind].url) return;
    if (typeof Audio === "undefined") return;
    try {
      var a = new Audio(s[kind].url);
      a.volume = clamp(s[kind].vol / 100, 0, 1);
      var pr = a.play();
      if (pr && typeof pr.catch === "function") pr.catch(function () { /* autoplay refused */ });
    } catch (e) { /* sound is best-effort */ }
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  function resolvedTheme() {
    if (cfg.themePreset === "custom") {
      return {
        bg: cfg.colors.bg, text: cfg.colors.text, accent: rgba(cfg.colors.accent, cfg.boxOpacity), font: cfg.fontFamily,
        count: cfg.colors.count, label: cfg.colors.label, border: cfg.colors.border,
        lock: cfg.colors.lock, float: cfg.colors.float, floatBg: rgba(cfg.colors.floatBg, cfg.boxOpacity)
      };
    }
    // A preset colours the whole sticker from its tones: the box is the panel, the
    // number, outline, padlock and floating text take the accent so each preset
    // reads as itself, and the caption takes the text colour.
    var p = PRESETS[cfg.themePreset] || BASE;
    return {
      bg: p.text, text: p.text, accent: p.panel, font: p.font,
      count: p.accent, label: p.text, border: p.accent, lock: p.accent, float: p.accent, floatBg: p.strong
    };
  }

  function applyTheme() {
    var t = resolvedTheme();
    var root = el.app;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--font", '"' + t.font + '", "Baloo 2", "Segoe UI", sans-serif');
    root.style.setProperty("--c-count", t.count);
    root.style.setProperty("--c-label", t.label);
    root.style.setProperty("--c-border", t.border);
    root.style.setProperty("--c-lock", t.lock);
    root.style.setProperty("--c-float", t.float);
    root.style.setProperty("--c-float-bg", t.floatBg);

    var L = cfg.look;
    root.style.setProperty("--radius-pct", String(L.radius));
    root.style.setProperty("--pad-v", String(L.padV));
    root.style.setProperty("--pad-h", String(L.padH));
    root.style.setProperty("--gap", String(L.gap));
    root.style.setProperty("--tilt", L.tilt + "deg");
    root.style.setProperty("--border-w", L.borderW + "px");
    root.style.setProperty("--shadow", L.shadow ? "0 8px 20px rgba(0, 0, 0, 0.28)" : "none");
    root.style.setProperty("--text-shadow", L.textShadow ? "0 0.06em 0.18em rgba(0, 0, 0, 0.55)" : "none");
    root.style.setProperty("--tail-display", L.tail ? "block" : "none");
    root.style.setProperty("--count-scale", String(L.countScale));
    root.style.setProperty("--label-scale", String(L.labelScale));
    root.style.setProperty("--float-scale", String(L.floatScale));
    root.style.setProperty("--count-w", L.countWeight);
    root.style.setProperty("--label-w", L.labelWeight);
    root.style.setProperty("--float-w", L.floatWeight);
    root.style.setProperty("--label-opacity", String(L.labelOpacity));
    root.style.setProperty("--label-spacing", L.labelSpacing + "em");
    root.style.setProperty("--pop-scale", String(L.popScale));
    root.style.setProperty("--pop-s", L.popMs + "s");
    root.style.setProperty("--float-s", cfg.floatMs / 1000 + "s");
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
    var id = "squat-font-link";
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
      try { SE_API.store.set(STORE_KEY, { squats: squats, locked: locked, carry: carry }); }
      catch (e) { /* store is best-effort */ }
    }, 300);
  }
  function restoreState(done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(false); return; }
    try {
      Promise.resolve(SE_API.store.get(STORE_KEY)).then(function (saved) {
        if (saved && typeof saved === "object" && typeof saved.squats === "number") {
          squats = Math.max(0, Math.round(saved.squats));
          // Saves from before the lock existed have no `locked` key, and an
          // unlocked counter is the kinder thing to come back to.
          locked = saved.locked === true;
          carry = Math.max(0, Math.round(num(saved.carry, 0)));
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
  // Squat maths
  // ---------------------------------------------------------------------------
  // Reading the sub count out of a StreamElements subscriber event is fiddly,
  // because a community gift arrives as several events and only one of them holds
  // the real number. The shape (per the StreamElements event reference) is:
  //   - event.bulkGifted        the bomb announcement; event.amount is how many
  //                             subs were gifted, which is the number we want.
  //   - event.isCommunityGift   one recipient inside that bomb, fired once each;
  //                             its amount is a months/streak figure, NOT a count,
  //                             so it must be skipped or the total balloons. This
  //                             is exactly the "+170" a lifetime streak caused.
  //   - event.gifted (alone)    a single targeted gift, which is one sub.
  //   - anything else           a self-sub or resub (no sender): not a gift.
  function giftCount(event) {
    if (bool(event.bulkGifted, false)) return Math.max(0, Math.round(num(event.amount, 0)));
    if (bool(event.isCommunityGift, false) || bool(event.playedAsCommunityGift, false)) return 0;
    if (bool(event.gifted, false)) return cfg.countSingleGifts ? 1 : 0;
    return cfg.countNewSubs ? 1 : 0;       // a self-sub or resub, if the setting says so
  }
  // Whole blocks only, rounded down: 16 subs over blocks of 5 is 3 blocks, so 15
  // squats; 27 is 5 blocks, so 25; anything under a full block adds nothing.
  function squatsForGift(count) {
    return Math.floor(count / cfg.subsPerBlock) * cfg.squatsPerBlock;
  }

  function setSquats(next, kind) {
    next = Math.max(0, Math.round(next));
    if (cfg.maxCount > 0) next = Math.min(next, cfg.maxCount);
    if (kind === "reset") carry = 0;
    var delta = next - squats;
    squats = next;
    saveState();
    render();
    pop();
    var quiet = kind === "load" || kind === "reset" || kind === "set";
    if (cfg.showFloat && !quiet && delta !== 0) {
      floatToast((delta > 0 ? cfg.floatPlus : "") + delta + cfg.floatSuffix);
    }
  }

  // Locking is for the part of the stream where the squats are actually being
  // done: the pile stops growing when chat gifts, but every manual control keeps
  // working so the count can come down as the squats are done.
  function setLocked(next) {
    var was = locked;
    locked = !!next;
    saveState();
    render();
    if (was !== locked) {
      pop();
      playSound(locked ? "lock" : "unlock");
    }
  }

  function handleGift(event) {
    event = event || {};
    if (cfg.debug && typeof console !== "undefined" && console.log) {
      // So a surprising payload on a real stream can be read straight from the
      // browser-source console, rather than guessed at from the outside.
      try { console.log("[squat-tracker] subscriber-latest", JSON.stringify(event)); }
      catch (e) { console.log("[squat-tracker] subscriber-latest", event); }
    }
    if (locked) return;
    var count = giftCount(event);
    if (count <= 0) return;
    var add;
    if (cfg.carryLeftover) {
      // Subs short of a block are kept, so 3 gifted and then 3 more make a block.
      var total = carry + count;
      var blocks = Math.floor(total / cfg.subsPerBlock);
      carry = total - blocks * cfg.subsPerBlock;
      add = blocks * cfg.squatsPerBlock;
      if (add <= 0) { saveState(); return; }
    } else {
      add = squatsForGift(count);
      if (add <= 0) return;
    }
    setSquats(squats + add, "gift");
    playSound("gift");
  }

  // Partial corrections from chat: "+5" / "-5" (or a bare "5") adjust relative to
  // the current count; "set 30" / "=30" put it to an exact number.
  function applyAdjustment(rest) {
    var m = String(rest).trim().match(/^(set\s+|=\s*)?([+-]?\d+)$/i);
    if (!m) return;
    var n = parseInt(m[2], 10);
    if (isNaN(n)) return;
    if (m[1]) setSquats(n, "set");
    else setSquats(squats + n, "adjust");
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

    if (first === cfg.cmd.reset) {
      if (canManage(roles)) setSquats(0, "reset");
      return;
    }
    if (first === cfg.cmd.lock) {
      if (canManage(roles)) setLocked(true);
      return;
    }
    if (first === cfg.cmd.unlock) {
      if (canManage(roles)) setLocked(false);
      return;
    }
    if (first === cfg.cmd.view) {
      if (!rest) { pop(); return; }           // a plain !squats just draws the eye to it
      if (canManage(roles)) applyAdjustment(rest);
    }
  }

  function handleButton(field) {
    switch (field) {
      case "btnGiftBomb": handleGift({ bulkGifted: true, amount: 16 }); break;
      case "btnPlus": setSquats(squats + cfg.squatsPerBlock, "adjust"); break;
      case "btnMinus": setSquats(squats - cfg.squatsPerBlock, "adjust"); break;
      case "btnReset": setSquats(0, "reset"); break;
      case "btnLock": setLocked(!locked); break;
      case "btnSoundGift": playSound("gift"); break;
      case "btnSoundLock": playSound("lock"); break;
      case "btnSoundUnlock": playSound("unlock"); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function render() {
    if (el.count) el.count.textContent = String(squats);
    if (el.label) {
      var has = !!(cfg.label && cfg.label.length);
      el.label.hidden = !has;
      el.label.textContent = has ? cfg.label : "";
    }
    if (el.lock) el.lock.hidden = !(locked && cfg.showLock);
  }
  function pop() {
    if (!el.sticker) return;
    el.sticker.classList.remove("pop");
    void el.sticker.offsetWidth; // reflow so the animation retriggers
    el.sticker.classList.add("pop");
  }
  function floatToast(txt) {
    if (!el.float) return;
    el.float.textContent = txt;
    el.float.hidden = false;
    el.float.style.animation = "none";
    void el.float.offsetWidth;
    el.float.style.animation = "";
    if (floatTimer) clearTimeout(floatTimer);
    floatTimer = setTimeout(function () { el.float.hidden = true; }, cfg.floatMs);
  }

  window.addEventListener("onEventReceived", function (obj) {
    if (!obj || !obj.detail) return;
    var listener = obj.detail.listener;
    var event = obj.detail.event || {};
    if (listener === "message") handleMessage(event.data || {});
    else if (listener === "widget-button") handleButton(event.field);
    else if (listener === "subscriber-latest") handleGift(event);
  });

  window.addEventListener("onWidgetLoad", function (obj) {
    var fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
    readConfig(fieldData);

    squats = 0;
    carry = 0;
    locked = false;
    el.app = document.getElementById("squat-app");
    el.sticker = document.getElementById("squat-sticker");
    el.count = document.getElementById("squat-count");
    el.label = document.getElementById("squat-label");
    el.lock = document.getElementById("squat-lock");
    el.float = document.getElementById("squat-float");

    applyTheme();

    // The starting count only applies the first time, when the store had nothing
    // to restore; after that a browser-source refresh keeps whatever we counted.
    restoreState(function (restored) {
      if (!restored) squats = cfg.startCount;
      render();
    });
  });
})();
