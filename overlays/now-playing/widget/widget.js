/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Now Playing Overlay. StreamElements custom widget logic. */
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
    // The outer frame: a border round the widget in the accent colour, as thick as the Outline setting says, or, left at 0,
    // a default that grows with the box. With the frame off it is the plain outline the settings describe, if there is one.
    var bw = c.borderWidth > 0 ? c.borderWidth + "px" : (c.outerFrame ? "max(2px, 0.6cqw)" : "0px");
    s.setProperty("--w-border", bw + " solid " + (c.outerFrame ? t.accent : c.borderColor));
    s.setProperty("--w-shadow", c.shadow ? "0 0.3em 1.2em rgba(0, 0, 0, 0.45)" : "none");
    root.classList.toggle("no-motion", !c.animate);
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
  var STORE_KEY = "nowplaying_v1";
  var HOLD_MS = 3000;                  // how long to wait for the saved on or off state before carrying on
  var SOURCES = { lastfm: 1, tuna: 1, spotify: 1, pear: 1 };
  var LASTFM_URL = "https://ws.audioscrobbler.com/2.0/";
  var SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
  var SPOTIFY_NOW_URL = "https://api.spotify.com/v1/me/player/currently-playing";
  var NO_COVER = /2a96cbd8b46e442fc41c2b86b821562f/;      // the grey star Last.fm sends when it has no cover for a track
  var MAX_BACKOFF_MS = 60000;
  var el = {};
  var cfg = {};
  var ready = false;                   // the saved on or off state is known
  var hidden = false;                  // switched off from chat
  var cur = null;                      // what is playing: { id, title, artist, album, art, playing, pos, dur, at }, or null
  var gen = 0;                         // bumped on every load, so a late answer for an old load is ignored
  var pollTimer = null;
  var tickTimer = null;
  var holdTimer = null;
  var failures = 0;
  var shownId = null;
  var shownArt = null;
  var spotify = { token: "", until: 0, rotated: "" };

  function trim(s) { return String(s === undefined || s === null ? "" : s).replace(/^\s+|\s+$/g, ""); }
  function port(v, d) { var n = Math.round(num(v, d)); return n >= 1 && n <= 65535 ? n : d; }
  function ms(v) { var n = parseFloat(v); return isNaN(n) || n < 0 ? null : Math.round(n); }
  function web(u) { return /^https?:\/\//i.test(trim(u)) ? trim(u) : ""; }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!nowplaying" });
    c.source = SOURCES[str(f.source, "lastfm")] ? str(f.source, "lastfm") : "lastfm";
    c.pollMs = clamp(num(f.pollSeconds, 5), 3, 60) * 1000;
    c.lastfmUser = trim(f.lastfmUser);
    c.lastfmKey = trim(f.lastfmKey);
    c.tunaPort = port(f.tunaPort, 1608);
    c.pearPort = port(f.pearPort, 26538);
    c.pearToken = trim(f.pearToken);
    c.spotifyClientId = trim(f.spotifyClientId);
    c.spotifyRefreshToken = trim(f.spotifyRefreshToken);
    c.showArt = bool(f.showArt, true);
    c.roundArt = str(f.artShape, "square") === "round";
    c.showAlbum = bool(f.showAlbum, false);
    c.showProgress = bool(f.showProgress, true);
    c.showPaused = bool(f.showPaused, true);
    c.labelPlaying = txt(f.labelPlaying, "Now playing");
    c.labelPaused = txt(f.labelPaused, "Paused");
    c.idleText = trim(txt(f.idleText, ""));
    c.showProblems = bool(f.showProblems, false);
    c.textSize = Math.max(2, num(f.textSize, 4.2));
    c.titleScale = clamp(num(f.titleScale, 1.25), 0.5, 3);
    c.artSize = clamp(num(f.artSize, 4.4), 2, 10);
    return c;
  }

  // ---- reading what is playing: each source gives back a track, null for nothing playing, or an error ----

  function ask(url, opts) {
    if (typeof fetch !== "function") return Promise.reject(new Error("This browser cannot make requests."));
    return fetch(url, opts).then(function (r) {
      if (r.status === 204) return { empty: true };
      if (!r.ok) {
        var e = new Error("The answer was " + r.status + ".");
        e.status = r.status;
        var wait = r.headers && typeof r.headers.get === "function" ? parseFloat(r.headers.get("Retry-After")) : NaN;
        if (!isNaN(wait)) e.retryMs = clamp(wait, 1, 300) * 1000;
        throw e;
      }
      return r.json();
    });
  }
  function track(id, title, artist, album, art, playing, pos, dur) {
    title = trim(title);
    if (!title) return null;
    return { id: id + title + "|" + trim(artist), title: title, artist: trim(artist), album: trim(album), art: web(art), playing: !!playing, pos: pos, dur: dur > 0 ? dur : null, at: Date.now() };
  }

  function lastfm() {
    if (!cfg.lastfmUser || !cfg.lastfmKey) return Promise.reject(setup("Add your Last.fm username and API key."));
    var url = LASTFM_URL + "?method=user.getrecenttracks&limit=1&format=json&user=" + encodeURIComponent(cfg.lastfmUser) + "&api_key=" + encodeURIComponent(cfg.lastfmKey);
    return ask(url).then(function (j) {
      if (j && j.error) throw new Error("Last.fm said: " + str(j.message, "error " + j.error));
      var t = j && j.recenttracks && j.recenttracks.track;
      if (t && !Array.isArray(t)) t = [t];
      var first = t && t[0];
      if (!first || !first["@attr"] || String(first["@attr"].nowplaying) !== "true") return null;
      var art = "", images = first.image || [];
      for (var i = images.length - 1; i >= 0 && !art; i--) { var u = images[i] && images[i]["#text"]; if (u && !NO_COVER.test(u)) art = u; }
      var artist = first.artist && typeof first.artist === "object" ? first.artist["#text"] : first.artist;
      var album = first.album && typeof first.album === "object" ? first.album["#text"] : first.album;
      return track("lf:", first.name, artist, album, art, true, null, null);
    });
  }

  function tuna() {
    return ask("http://localhost:" + cfg.tunaPort + "/").then(function (j) {
      if (!j || (j.status !== "playing" && j.status !== "paused")) return null;
      var artists = Array.isArray(j.artists) ? j.artists.join(", ") : j.artists;
      var t = track("tu:", j.title, artists, j.album, j.cover_url, j.status === "playing", ms(j.progress), ms(j.duration));
      // Tuna serves every cover at the same address, so a new track needs a new address or the old picture is kept.
      if (t && t.art && /\/cover\.png$/i.test(t.art)) t.art += "?track=" + encodeURIComponent(t.id);
      return t;
    });
  }

  function pear() {
    var opts = cfg.pearToken ? { headers: { Authorization: "Bearer " + cfg.pearToken } } : undefined;
    return ask("http://localhost:" + cfg.pearPort + "/api/v1/song", opts).then(function (j) {
      if (!j || j.empty) return null;
      var secs = function (v) { var n = ms(v); return n === null ? null : n * 1000; };
      return track("pe:", j.title, j.artist, j.album, j.imageSrc, !j.isPaused, secs(j.elapsedSeconds), secs(j.songDuration));
    });
  }

  // Spotify: an access token lasts about an hour, and is made from the refresh token you pasted into the settings.
  function spotifyToken() {
    var refresh = spotify.rotated || cfg.spotifyRefreshToken;
    if (spotify.token && Date.now() < spotify.until) return Promise.resolve(spotify.token);
    var body = "grant_type=refresh_token&refresh_token=" + encodeURIComponent(refresh) + "&client_id=" + encodeURIComponent(cfg.spotifyClientId);
    return ask(SPOTIFY_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body }).then(function (j) {
      if (!j || !j.access_token) throw new Error("Spotify did not give an access token.");
      spotify.token = j.access_token;
      spotify.until = Date.now() + Math.max(60, num(j.expires_in, 3600) - 60) * 1000;
      // Spotify may hand back a new refresh token. The settings cannot be changed from here, so keep it for next time.
      if (j.refresh_token && j.refresh_token !== refresh) { spotify.rotated = j.refresh_token; save(); }
      return spotify.token;
    });
  }
  function spotifyNow() {
    if (!cfg.spotifyClientId || !cfg.spotifyRefreshToken) return Promise.reject(setup("Add your Spotify client ID and refresh token."));
    return spotifyToken().then(function (token) {
      return ask(SPOTIFY_NOW_URL, { headers: { Authorization: "Bearer " + token } });
    }).then(function (j) {
      var item = j && j.item;
      if (!j || j.empty || !item || j.currently_playing_type !== "track") return null;
      var images = (item.album && item.album.images) || [], art = "";
      for (var i = 0; i < images.length; i++) { if (images[i].width <= 400) { art = images[i].url; break; } }
      if (!art && images.length) art = images[images.length - 1].url;
      var artists = (item.artists || []).map(function (a) { return a.name; }).join(", ");
      return track("sp:" + (item.id || ""), item.name, artists, item.album && item.album.name, art, j.is_playing, ms(j.progress_ms), ms(item.duration_ms));
    }, function (e) {
      if (e && e.status === 401) { spotify.token = ""; spotify.until = 0; }       // the token was refused: make a new one next time
      throw e;
    });
  }

  function setup(message) { var e = new Error(message); e.setup = true; return e; }
  function read() {
    switch (cfg.source) {
      case "tuna": return tuna();
      case "pear": return pear();
      case "spotify": return spotifyNow();
      default: return lastfm();
    }
  }

  // ---- polling ----

  function schedule(myGen, delay) {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(function () { poll(myGen); }, delay);
  }
  function poll(myGen) {
    if (myGen !== gen) return;
    var request;
    try { request = read(); } catch (e) { request = Promise.reject(e); }
    request.then(function (t) {
      if (myGen !== gen) return;
      failures = 0;
      problem("");
      setTrack(t);
      schedule(myGen, cfg.pollMs);
    }, function (e) {
      if (myGen !== gen) return;
      failures++;
      problem(e && e.message ? e.message : "Could not read what is playing.");
      if (e && e.setup) { setTrack(null); return; }                // nothing to retry until the settings change
      if (failures >= 3) setTrack(null);                           // a source that has gone quiet is not playing anything
      schedule(myGen, e && e.retryMs ? e.retryMs : Math.min(MAX_BACKOFF_MS, cfg.pollMs * Math.pow(2, Math.min(failures, 6))));
    });
  }
  function problem(message) {
    if (message && cfg.debug && typeof console !== "undefined" && console.log) console.log("[nowplaying]", message);
    if (!el.note) return;
    el.note.textContent = cfg.showProblems ? message : "";
    el.note.hidden = !(cfg.showProblems && message);
  }

  // ---- showing it ----

  function show(node, text) {
    node.textContent = text;
    node.hidden = !text;
  }
  function clock(msec) {
    var s = Math.max(0, Math.floor(msec / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return h ? h + ":" + pad2(m) + ":" + pad2(s % 60) : m + ":" + pad2(s % 60);
  }
  function position() {
    if (!cur || cur.pos === null || !cur.dur) return null;
    return clamp(cur.pos + (cur.playing ? Date.now() - cur.at : 0), 0, cur.dur);
  }
  function tick() {
    var p = position();
    if (p === null || !el.fill) return;
    el.fill.style.width = (p / cur.dur * 100) + "%";
    el.pos.textContent = clock(p);
  }
  function render() {
    if (!el.app) return;
    var t = cur, idle = !t || (!t.playing && !cfg.showPaused), words = idle && cfg.idleText !== "";
    el.app.classList.toggle("gone", !ready || hidden || (idle && !words));
    el.app.classList.toggle("round-art", cfg.roundArt);
    if (idle) {
      // Nothing playing: either the card is gone, or it says so, with nothing else on it.
      show(el.label, ""); show(el.title, words ? cfg.idleText : ""); show(el.artist, ""); show(el.album, "");
      el.artWrap.hidden = true; el.progress.hidden = true;
      shownId = null; shownArt = null;
      return;
    }
    show(el.label, t.playing ? cfg.labelPlaying : cfg.labelPaused);
    show(el.title, t.title);
    show(el.artist, t.artist);
    show(el.album, cfg.showAlbum ? t.album : "");
    var art = cfg.showArt ? t.art : "";
    if (art !== shownArt) { shownArt = art; if (art) el.art.src = art; else el.art.removeAttribute("src"); }
    el.artWrap.hidden = !art;
    var bar = cfg.showProgress && position() !== null;
    el.progress.hidden = !bar;
    if (bar) { el.dur.textContent = clock(t.dur); tick(); }
    if (t.id !== shownId) {
      shownId = t.id;
      if (cfg.animate) { el.app.classList.remove("pop"); if (el.app.offsetWidth !== undefined) void el.app.offsetWidth; el.app.classList.add("pop"); }
    }
  }
  function setTrack(t) {
    cur = t;
    render();
  }

  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "np-font-link");
    var s = el.app.style;
    s.setProperty("--np-size", cfg.textSize + "cqw");
    s.setProperty("--np-title", cfg.titleScale);
    s.setProperty("--np-art", cfg.artSize);
  }

  // ---- being switched off, and kept off ----

  function save() { storeSave(STORE_KEY, { hidden: hidden, spotify: spotify.rotated ? { forToken: cfg.spotifyRefreshToken, token: spotify.rotated } : null }); }
  function setHidden(h) { hidden = h; save(); render(); }
  function pollNow() { failures = 0; spotify.token = ""; spotify.until = 0; if (ready) poll(gen); }
  function handleChat(data) {
    data = data || {};
    var text = trim(data.text), base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var verb = trim(text.slice(base.length)).split(/\s+/)[0].toLowerCase();
    if (!verb || !canManage(cfg, rolesOf(data))) return;           // the bare word does nothing, and viewers cannot use it
    if (verb === "off" || verb === "hide") setHidden(true);
    else if (verb === "on" || verb === "show") setHidden(false);
    else if (verb === "refresh" || verb === "now") pollNow();
  }
  function handleButton(field) {
    switch (field) {
      case "btnHide": setHidden(true); break;
      case "btnShow": setHidden(false); break;
      case "btnRefresh": pollNow(); break;
    }
  }

  function bind() {
    var ids = { root: "np-root", app: "np-app", artWrap: "np-art-wrap", art: "np-art", label: "np-label", title: "np-title", artist: "np-artist", album: "np-album", progress: "np-progress", pos: "np-pos", dur: "np-dur", fill: "np-fill", note: "np-note" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  window.addEventListener("onWidgetLoad", function (obj) {
    gen++;
    var myGen = gen;
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    ready = false; hidden = false; cur = null; failures = 0; shownId = null; shownArt = null;
    spotify = { token: "", until: 0, rotated: "" };
    applyLook();
    render();
    tickTimer = setInterval(tick, 1000);
    // The card waits for the saved on or off state, so a refresh while it is switched off never shows it for a moment.
    var settled = false;
    function settle(saved) {
      if (settled || myGen !== gen) return;
      settled = true;
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      hidden = !!(saved && saved.hidden);
      var kept = saved && saved.spotify;
      if (kept && kept.token && kept.forToken === cfg.spotifyRefreshToken) spotify.rotated = String(kept.token);
      ready = true;
      render();
      poll(myGen);
    }
    holdTimer = setTimeout(function () { settle(null); }, HOLD_MS);
    storeLoad(STORE_KEY, settle);
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !ready) return;
    var ev = d.event || {};
    debugLog(cfg, "nowplaying", d.listener, ev);
    try {
      switch (d.listener) {
        case "message": handleChat(ev.data); break;
        case "widget-button": handleButton(ev.field); break;
      }
    } catch (e) { if (cfg.debug && typeof console !== "undefined" && console.log) console.log("[nowplaying] could not handle", d.listener, e && e.message); }
  });
})();
