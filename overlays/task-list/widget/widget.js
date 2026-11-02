/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Task List and Schedule Overlay. StreamElements custom widget logic. */
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
      outerFrame: bool(f.outerFrame, true),
      shadow: bool(f.shadow, false),
      pad: Math.max(0, num(f.pad, 0.5)),
      weight: clamp(num(f.weight, 800), 100, 900),
      animate: bool(f.animate, true),
      fit: bool(f.fit, true),
      mute: bool(f.mute, false),
      debug: bool(f.debug, false),
      decor: readDecor(f)
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
    // The outer frame: a border round the widget in the accent colour, as thick as the Outline setting says, or, left at 0,
    // a default that grows with the box. With the frame off it is the plain outline the settings describe, if there is one.
    var bw = c.borderWidth > 0 ? c.borderWidth + "px" : (c.outerFrame ? "max(2px, 0.6cqw)" : "0px");
    // A pride preset draws the frame in its flag's stripes, as a ring on the panel (see the stylesheet), and the border is then
    // only the room it takes.
    var stripes = c.outerFrame && t.flag;
    s.setProperty("--w-border", bw + " solid " + (c.outerFrame ? (stripes ? "transparent" : t.accent) : c.borderColor));
    s.setProperty("--w-frame-w", bw);
    s.setProperty("--w-frame-img", stripes ? flagGradient(t.flag) : "none");
    s.setProperty("--w-shadow", c.shadow ? "0 0.3em 1.2em rgba(0, 0, 0, 0.45)" : "none");
    root.classList.toggle("no-motion", !c.animate);
    applyDecor(c.decor, app, t.flag || [t.accent], c.animate, t.text);
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

  var STORE_KEY = "task_list_v1";
  var DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;

  function blankState() { return { tasks: [], seq: 0 }; }
  function now() { return Date.now(); }
  function trim(s) { return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, ""); }

  // "Monday | 7pm | Chill games" is a day, a time and what is on. The words may hold more bars.
  function parseSlot(text) {
    var parts = String(text === undefined || text === null ? "" : text).split("|").map(trim);
    if (!parts.join("")) return null;
    if (parts.length === 1) return parts[0] ? { day: "", when: "", what: parts[0] } : null;
    if (parts.length === 2) return { day: parts[0], when: "", what: parts[1] };
    return { day: parts[0], when: parts[1], what: parts.slice(2).join(" | ") };
  }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!task", title: "Today's tasks" });
    c.mode = str(f.mode, "tasks") === "schedule" ? "schedule" : "tasks";
    c.maxShown = clamp(Math.floor(num(f.maxShown, 8)), 1, 30);
    c.maxTasks = clamp(Math.floor(num(f.maxTasks, 30)), 1, 100);
    c.hideDone = bool(f.hideDone, false);
    c.showNumbers = bool(f.showNumbers, true);
    c.showCount = bool(f.showCount, true);
    c.showBar = bool(f.showBar, true);
    c.allDoneText = txt(f.allDoneText, "All done, well done!");
    c.hideWhenEmpty = bool(f.hideWhenEmpty, true);
    c.scheduleTitle = txt(f.scheduleTitle, "This week");
    c.slots = [];
    var written = [f.slot1, f.slot2, f.slot3, f.slot4, f.slot5, f.slot6, f.slot7, f.slot8, f.slot9, f.slot10];
    for (var i = 0; i < written.length; i++) { var s = parseSlot(written[i]); if (s) c.slots.push(s); }
    c.note = txt(f.note, "");
    c.highlightToday = bool(f.highlightToday, true);
    c.textSize = Math.max(2, num(f.textSize, 5));
    c.titleScale = Math.max(0.2, num(f.titleScale, 0.6));
    c.itemGap = Math.max(0, num(f.itemGap, 0.4));
    return c;
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  function find(ref, wantDone) {
    var list = state.tasks, i;
    if (/^\d+$/.test(ref)) return list[parseInt(ref, 10) - 1] || null;
    var low = ref.toLowerCase();
    if (!low) return null;
    var any = null;
    for (i = 0; i < list.length; i++) {
      if (list[i].text.toLowerCase().indexOf(low) === -1) continue;
      if (list[i].done === wantDone) return list[i];
      if (!any) any = list[i];
    }
    return any;
  }
  function addTask(text) {
    text = trim(text);
    if (!text || state.tasks.length >= cfg.maxTasks) return;
    state.tasks.push({ id: state.seq++, text: text, done: false });
    save(); render();
  }
  function setDone(ref, done) {
    var t = find(ref, !done);
    if (!t) return;
    t.done = done;
    save(); render();
    if (done) popTitle();
  }
  function removeTask(ref) {
    var t = find(ref, false);
    if (!t) return;
    state.tasks = state.tasks.filter(function (x) { return x !== t; });
    save(); render();
  }
  function editTask(rest) {
    var m = /^(\d+)\s+(.+)$/.exec(rest);
    if (!m || !state.tasks[parseInt(m[1], 10) - 1]) return;
    state.tasks[parseInt(m[1], 10) - 1].text = trim(m[2]);
    save(); render();
  }
  function clearDone() { state.tasks = state.tasks.filter(function (t) { return !t.done; }); save(); render(); }
  function clearAll() { state.tasks = []; save(); render(); }

  // ---------------------------------------------------------------------------
  // Chat and buttons
  // ---------------------------------------------------------------------------
  function handleChat(data) {
    data = data || {};
    var text = trim(data.text);
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var rest = trim(text.slice(base.length));
    if (!rest) { popTitle(); return; }                     // anyone can ask to see it
    if (cfg.mode !== "tasks" || !canManage(cfg, rolesOf(data))) return;
    var m = /^(\S+)\s*(.*)$/.exec(rest), first = m[1].toLowerCase(), more = m[2];
    switch (first) {
      case "add": addTask(more); return;
      case "done": case "tick": setDone(more, true); return;
      case "undo": case "untick": setDone(more, false); return;
      case "remove": case "rm": case "delete": removeTask(more); return;
      case "edit": editTask(more); return;
      case "clear": if (more.toLowerCase() === "all") clearAll(); else clearDone(); return;
    }
  }
  function handleButton(field) {
    switch (field) {
      case "btnAdd": addTask("A test task"); break;
      case "btnNext":
        for (var i = 0; i < state.tasks.length; i++) if (!state.tasks[i].done) { state.tasks[i].done = true; save(); render(); popTitle(); break; }
        break;
      case "btnClearDone": clearDone(); break;
      case "btnClearAll": clearAll(); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      var list = saved.tasks || [];
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (t && typeof t === "object" && trim(t.text)) s.tasks.push({ id: Math.floor(num(t.id, i)), text: trim(t.text), done: bool(t.done, false) });
      }
      s.seq = Math.max(0, Math.floor(num(saved.seq, 0)));
      for (var j = 0; j < s.tasks.length; j++) if (s.tasks[j].id >= s.seq) s.seq = s.tasks[j].id + 1;
    }
    return s;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function span(cls, text) { var s = document.createElement("span"); s.className = cls; if (text !== undefined) s.textContent = text; return s; }
  function row(cls) { var li = document.createElement("li"); li.className = cls; return li; }

  function renderTasks() {
    var all = state.tasks, doneCount = all.filter(function (t) { return t.done; }).length;
    var allDone = all.length > 0 && doneCount === all.length;
    el.root.hidden = !all.length && cfg.hideWhenEmpty;
    var title = allDone && cfg.allDoneText ? cfg.allDoneText : cfg.title;
    el.title.textContent = title; el.title.hidden = !cfg.showTitle || !title;
    el.count.textContent = doneCount + " / " + all.length; el.count.hidden = !cfg.showCount || !all.length;
    el.bar.hidden = !cfg.showBar || !all.length;
    el.fill.style.width = (all.length ? Math.round(doneCount / all.length * 1000) / 10 : 0) + "%";
    el.note.hidden = true;
    clear(el.list);
    var shown = 0, hidden = 0;
    all.forEach(function (t, n) {
      if (cfg.hideDone && t.done) return;
      if (shown >= cfg.maxShown) { hidden++; return; }
      shown++;
      var li = row("tl-row" + (t.done ? " done" : ""));
      if (cfg.showNumbers) li.appendChild(span("tl-num", (n + 1) + "."));
      li.appendChild(span("tl-box"));
      li.appendChild(span("tl-text", t.text));
      el.list.appendChild(li);
    });
    if (hidden) { var more = row("tl-more"); more.textContent = "+" + hidden + " more"; el.list.appendChild(more); }
  }
  function renderSchedule() {
    el.root.hidden = !cfg.slots.length;
    el.title.textContent = cfg.scheduleTitle; el.title.hidden = !cfg.showTitle || !cfg.scheduleTitle;
    el.count.hidden = true; el.bar.hidden = true;
    el.note.textContent = cfg.note; el.note.hidden = !cfg.note;
    clear(el.list);
    var today = DAYS[new Date(now()).getDay()].slice(0, 3);
    cfg.slots.forEach(function (s) {
      var isToday = cfg.highlightToday && s.day && s.day.toLowerCase().slice(0, 3) === today;
      var li = row("tl-slot" + (isToday ? " today" : ""));
      if (s.day) li.appendChild(span("tl-day", s.day));
      if (s.when) li.appendChild(span("tl-when", s.when));
      li.appendChild(span("tl-what", s.what));
      el.list.appendChild(li);
    });
  }
  function render() {
    if (!el.app) return;
    el.app.classList.toggle("schedule", cfg.mode === "schedule");
    if (cfg.mode === "schedule") renderSchedule(); else renderTasks();
  }
  function popTitle() {
    if (!el.title || !el.title.classList) return;
    el.title.classList.remove("pop"); void el.title.offsetWidth; el.title.classList.add("pop");
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "tl-font-link");
    var s = el.app.style;
    s.setProperty("--tl-size", cfg.textSize + "cqw");
    s.setProperty("--tl-title", cfg.titleScale);
    s.setProperty("--tl-gap", cfg.itemGap + "em");
    s.setProperty("--tl-tick", solid(themeOf(cfg).panel));
  }
  function bind() {
    var ids = { root: "tl-root", app: "tl-app", title: "tl-title", count: "tl-count", bar: "tl-bar", fill: "tl-fill", list: "tl-list", note: "tl-note" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  // The schedule marks today, so it moves on at midnight without anyone touching it.
  setInterval(function () { if (loaded && cfg.mode === "schedule") render(); }, 60000);

  window.addEventListener("onWidgetLoad", function (obj) {
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      state = restore(saved);
      loaded = true;
      render();
      if (!saved) save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "tasks", d.listener, ev);
    if (d.listener === "message") handleChat(ev.data);
    else if (d.listener === "widget-button") handleButton(ev.field);
  });
})();
