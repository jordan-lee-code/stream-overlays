/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Chat Feed Overlay. StreamElements custom widget logic. */
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

  var STORE_KEY = "chatfeed_v1";
  var CACHE_KEY = "chatfeed_cache_v1";
  // Both lookups send a chatter's login to a third party, so each has its own switch.
  var AVATAR_API = "https://decapi.me/twitch/avatar/";
  var PRONOUN_API = "https://pronouns.alejo.io/api/";
  var AVATAR_OK_MS = 6 * 3600 * 1000;     // a profile picture rarely changes
  var AVATAR_MISS_MS = 10 * 60 * 1000;    // a miss is not asked again straight away
  var PRONOUN_MS = 5 * 60 * 1000;         // the pronoun service asks for a five minute cache
  var LIST_MS = 3600 * 1000;
  var CACHE_MAX = 300;
  var TIMEOUT_MS = 8000;
  // Only a picture on Twitch's own image host is ever shown, whatever the lookup answers.
  var AVATAR_URL = /^https:\/\/static-cdn\.jtvnw\.net\/[A-Za-z0-9_\-.\/]+$/;
  // The pronoun service's own list, kept here so a name still reads right if the list cannot be fetched.
  var BUILTIN = { hehim: "He/Him", sheher: "She/Her", theythem: "They/Them", any: "Any/Any", other: "Other/Other", xexem: "Xe/Xem",
    faefaer: "Fae/Faer", vever: "Ve/Ver", aeaer: "Ae/Aer", ziehir: "Zie/Hir", perper: "Per/Per", eem: "E/Em", itits: "It/Its" };

  var el = {};
  var cfg = {};
  var theme = null;
  var msgs = [];             // on screen, oldest first
  var seq = 0;
  var hidden = {};           // logins hidden with the hide command
  var avatars = {};          // login -> { url, at }
  var pronouns = {};         // login -> { text, at }
  var list = null;           // pronoun id -> display text
  var listAt = 0;
  var waiting = {};          // lookups in flight, with whoever is waiting on each
  var loaded = false;
  var cacheTimer = null;
  var epoch = 0;             // counts widget loads, so a lookup left over from an earlier one is ignored

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!chatfeed", title: "Chat" });
    c.showTitle = bool(f.showTitle, false);
    c.max = clamp(Math.floor(num(f.maxMessages, 30)), 1, 30);
    c.fadeMs = Math.max(0, num(f.fadeAfter, 45)) * 1000;
    c.newestTop = str(f.order, "bottom") === "top";
    c.hideCommands = bool(f.hideCommands, true);
    c.ignore = csv(str(f.ignoreNames, "nightbot, streamelements, streamlabs, moobot, fossabot, wizebot"));
    c.showBadges = bool(f.showBadges, true);
    c.showEmotes = bool(f.showEmotes, true);
    c.showGifs = bool(f.showGifs, true);
    c.gifSize = clamp(num(f.gifSize, 6), 2, 20);
    c.nameColor = str(f.nameColor, "chat");
    c.inline = str(f.nameLine, "above") === "inline";
    c.bubbles = str(f.cardStyle, "panel") === "bubbles";
    c.showAvatars = bool(f.showAvatars, true);
    c.avatarShape = str(f.avatarShape, "circle");
    c.avatarSize = clamp(num(f.avatarSize, 2.2), 1, 5);
    c.showPronouns = bool(f.showPronouns, true);
    c.pronounStyle = str(f.pronounStyle, "tag");
    c.overrides = pairs(str(f.pronounOverrides, ""));
    c.textSize = Math.max(2, num(f.textSize, 4.2));
    c.rowGap = Math.max(0, num(f.rowGap, 0.45));
    c.sound = str(f.soundMessage, "");
    c.volume = num(f.soundMessageVol, 50);
    return c;
  }
  function csv(s) {
    return String(s).toLowerCase().split(",").map(function (x) { return x.replace(/^\s+|\s+$/g, "").replace(/^@/, ""); }).filter(Boolean);
  }
  // "alice=She/Her, bob=He/Him" becomes { alice: "She/Her", bob: "He/Him" }.
  function pairs(s) {
    var out = {};
    String(s).split(",").forEach(function (part) {
      var at = part.indexOf("=");
      if (at < 1) return;
      var login = part.slice(0, at).replace(/^\s+|\s+$/g, "").replace(/^@/, "").toLowerCase();
      var text = part.slice(at + 1).replace(/^\s+|\s+$/g, "");
      if (login && text) out[login] = text;
    });
    return out;
  }
  function validLogin(s) { return /^[a-z0-9_]{1,25}$/.test(s); }

  // ---------------------------------------------------------------------------
  // Lookups: avatars and pronouns
  // ---------------------------------------------------------------------------
  function request(url, asJson) {
    return new Promise(function (resolve, reject) {
      if (typeof fetch !== "function") { reject(new Error("no fetch")); return; }
      var timer = setTimeout(function () { reject(new Error("timeout")); }, TIMEOUT_MS);
      fetch(url).then(function (r) {
        if (!r || r.ok === false) throw new Error("status");
        return asJson ? r.json() : r.text();
      }).then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }
  // One request per key at a time: everyone who asks while it is out waits for the same answer.
  function once(key, done, start, record) {
    if (waiting[key]) { waiting[key].push(done); return; }
    waiting[key] = [done];
    var gen = epoch;
    start(function (value) {
      if (gen !== epoch) return;
      var who = waiting[key] || [];
      delete waiting[key];
      record(value);
      for (var i = 0; i < who.length; i++) { try { who[i](value); } catch (e) { /* one listener never stops the rest */ } }
    });
  }
  function avatarFor(login, done) {
    var hit = avatars[login];
    if (hit && Date.now() - hit.at < (hit.url ? AVATAR_OK_MS : AVATAR_MISS_MS)) { done(hit.url); return; }
    once("a:" + login, done, function (finish) {
      request(AVATAR_API + login, false).then(function (text) {
        var url = String(text).replace(/^\s+|\s+$/g, "");
        finish(AVATAR_URL.test(url) ? url : "");
      }, function () { finish(""); });
    }, function (url) { avatars[login] = { url: url, at: Date.now() }; saveCacheSoon(); });
  }
  function listFor(done) {
    if (list && Date.now() - listAt < LIST_MS) { done(list); return; }
    once("list", done, function (finish) {
      request(PRONOUN_API + "pronouns", true).then(function (data) {
        var map = {};
        if (Array.isArray(data)) data.forEach(function (p) { if (p && p.name && p.display) map[String(p.name)] = String(p.display); });
        finish(Object.keys(map).length ? map : BUILTIN);
      }, function () { finish(BUILTIN); });
    }, function (map) { list = map; listAt = Date.now(); saveCacheSoon(); });
  }
  function pronounsFor(login, done) {
    if (cfg.overrides[login]) { done(cfg.overrides[login]); return; }
    var hit = pronouns[login];
    if (hit && Date.now() - hit.at < PRONOUN_MS) { done(hit.text); return; }
    once("p:" + login, done, function (finish) {
      request(PRONOUN_API + "users/" + login, true).then(function (data) {
        // A user is a list holding their one record, or nothing when they have not set any.
        var rec = Array.isArray(data) ? data[0] : data;
        var id = rec && typeof rec === "object" && rec.pronoun_id ? String(rec.pronoun_id) : "";
        if (!id) { finish(""); return; }
        listFor(function (map) { finish(map[id] || BUILTIN[id] || ""); });
      }, function () { finish(""); });
    }, function (text) { pronouns[login] = { text: text, at: Date.now() }; });
  }

  // Avatars and the pronoun list are kept between refreshes, so a reloaded browser source
  // does not ask again for everyone who has already spoken.
  function saveCacheSoon() {
    if (cacheTimer) return;
    cacheTimer = setTimeout(function () {
      cacheTimer = null;
      var keep = {};
      Object.keys(avatars).sort(function (a, b) { return avatars[b].at - avatars[a].at; }).slice(0, CACHE_MAX).forEach(function (k) { keep[k] = avatars[k]; });
      storeSave(CACHE_KEY, { avatars: keep, list: list, listAt: listAt });
    }, 1000);
  }
  function restoreCache(saved) {
    avatars = {}; list = null; listAt = 0;
    if (!saved || typeof saved !== "object") return;
    var a = saved.avatars && typeof saved.avatars === "object" ? saved.avatars : {};
    Object.keys(a).forEach(function (k) {
      var e = a[k];
      if (!validLogin(k) || !e || typeof e !== "object") return;
      var url = typeof e.url === "string" && AVATAR_URL.test(e.url) ? e.url : "";
      var at = num(e.at, 0);
      if (at > 0) avatars[k] = { url: url, at: at };
    });
    if (saved.list && typeof saved.list === "object" && !Array.isArray(saved.list)) {
      var map = {};
      Object.keys(saved.list).forEach(function (k) { if (typeof saved.list[k] === "string") map[k] = saved.list[k]; });
      if (Object.keys(map).length) { list = map; listAt = num(saved.listAt, 0); }
    }
  }

  // ---------------------------------------------------------------------------
  // Colour: a chatter's own colour is used only while it can be read on the panel
  // ---------------------------------------------------------------------------
  function rgbOf(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  function panelRgb(css) {
    var m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(String(css || ""));
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : clamp(parseFloat(m[4]), 0, 1) };
    return rgbOf(css);
  }
  function luminance(c) {
    function ch(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function ratio(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  // A see-through panel sits over whatever is on stream, so a name is tried over a black and a
  // mid-grey backdrop and the worse result counts. White is left out on purpose: judged over
  // white, nearly every bright chat colour would fail on a dark panel, and a stream is rarely white.
  function readable(color, panel) {
    var c = rgbOf(color), p = panelRgb(panel);
    if (!c || !p) return false;
    var worst = 21;
    [0, 128].forEach(function (back) {
      var over = { r: p.r * p.a + back * (1 - p.a), g: p.g * p.a + back * (1 - p.a), b: p.b * p.a + back * (1 - p.a) };
      worst = Math.min(worst, ratio(c, over));
    });
    return worst >= 3;
  }
  function nameColorFor(m) {
    if (cfg.nameColor === "text") return theme.text;
    if (cfg.nameColor === "accent") return theme.accent;
    return m.color && readable(m.color, theme.panel) ? m.color : theme.accent;
  }

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------
  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function initialOf(name) {
    var m = /[A-Za-z0-9À-ɏ]/.exec(String(name || ""));
    return m ? m[0].toUpperCase() : "?";
  }
  // Twitch sends a GIF as a `gifs` tag on the message: entries of start-end|id|address, with
  // positions counted like an emote's, and the message text holding a placeholder such as
  // "[Yes GIF by someone]". The address has to be used exactly as given, so it is never changed,
  // and only a secure address on Giphy's own domain is shown, whatever a message says.
  var GIF_URL = /^https:\/\/(?:[a-z0-9-]+\.)*giphy\.com\/[^\s"'<>]+$/i;
  function gifsOf(data) {
    var out = [], raw = data && (data.gifs || (data.tags && data.tags.gifs));
    function take(start, end, id, url) {
      start = Math.floor(num(start, -1)); end = Math.floor(num(end, -1));
      if (start >= 0 && end >= start && typeof url === "string" && GIF_URL.test(url)) out.push({ start: start, end: end, url: url, id: String(id || "") });
    }
    if (Array.isArray(raw)) raw.forEach(function (g) { if (g && typeof g === "object") take(g.start, g.end, g.id, g.url); });
    else if (typeof raw === "string") {
      // An address can hold a comma, so an entry ends only where the next one begins.
      var re = /(?:^|,)(\d+)-(\d+)\|([^|]*)\|(.*?)(?=,\d+-\d+\||$)/g, m;
      while ((m = re.exec(raw)) !== null) take(m[1], m[2], m[3], m[4]);
    }
    return out;
  }
  // The picture for an emote: its middle size, or any other, and only on a secure address.
  function emoteUrl(e) {
    var u = e && e.urls && (e.urls["2"] || e.urls["1"] || e.urls["4"]);
    return typeof u === "string" && u.indexOf("https://") === 0 ? u : "";
  }
  // Splits a message around its emotes. StreamElements gives a Twitch emote's first and last
  // character, counted from the start of the text, and that is used first. An emote with no
  // usable position, which is what other emote services may send, is found by name instead:
  // any word in the message that is exactly the emote's name. An emote that does not fit stays text.
  function segments(text, emotes, gifs) {
    var list = Array.isArray(emotes) ? emotes : [];
    var good = [], byName = {};
    (Array.isArray(gifs) ? gifs : []).forEach(function (g) {
      if (g.end < text.length) good.push({ start: g.start, end: g.end, url: g.url, name: text.slice(g.start, g.end + 1), gif: true });
    });
    list.forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var url = emoteUrl(e);
      if (!url) return;
      if (e.name && !byName[e.name]) byName[e.name] = { url: url, name: String(e.name) };
      var s = Math.floor(num(e.start, -1)), n = Math.floor(num(e.end, -1));
      if (s < 0 || n < s || n >= text.length) return;
      good.push({ start: s, end: n, url: url, name: String(e.name || text.slice(s, n + 1)) });
    });
    good.sort(function (a, b) { return a.start - b.start; });
    var out = [], pos = 0;
    good.forEach(function (e) {
      if (e.start < pos) return;
      if (e.start > pos) out.push({ text: text.slice(pos, e.start) });
      out.push({ emote: e });
      pos = e.end + 1;
    });
    if (pos < text.length) out.push({ text: text.slice(pos) });
    if (!out.length) out.push({ text: text });
    // Then any word in the plain stretches that is an emote's name.
    var named = [];
    out.forEach(function (seg) {
      if (seg.emote) { named.push(seg); return; }
      var run = "";
      seg.text.split(/(\s+)/).forEach(function (tok) {
        if (tok && byName.hasOwnProperty(tok)) {
          if (run) { named.push({ text: run }); run = ""; }
          named.push({ emote: byName[tok] });
        } else run += tok;
      });
      if (run) named.push({ text: run });
    });
    return named;
  }
  function badgesOf(data) {
    var out = [], b = data && Array.isArray(data.badges) ? data.badges : [];
    for (var i = 0; i < b.length && out.length < 4; i++) {
      var u = b[i] && b[i].url;
      if (typeof u === "string" && u.indexOf("https://") === 0) out.push({ url: u, label: String(b[i].description || b[i].type || "") });
    }
    return out;
  }

  function buildRow(m) {
    var li = node("li", "cf-msg" + (m.action ? " action" : "") + (cfg.animate ? " new" : ""));
    li.setAttribute("data-id", String(m.id));
    m.parts = {};
    if (cfg.showAvatars) {
      m.parts.avatar = node("span", "cf-avatar");
      m.parts.avatar.appendChild(node("span", "cf-initial", initialOf(m.name)));
      li.appendChild(m.parts.avatar);
    }
    var body = node("div", "cf-body"), head = node("div", "cf-head");
    if (cfg.showBadges && m.badges.length) {
      var wrap = node("span", "cf-badges");
      m.badges.forEach(function (b) { var img = node("img"); img.src = b.url; img.alt = b.label; wrap.appendChild(img); });
      head.appendChild(wrap);
    }
    var name = node("span", "cf-name", m.name);
    name.style.color = nameColorFor(m);
    head.appendChild(name);
    if (cfg.showPronouns) { m.parts.pron = node("span", "cf-pron style-" + cfg.pronounStyle); m.parts.pron.hidden = true; head.appendChild(m.parts.pron); }
    head.appendChild(node("span", "cf-sep", ":"));
    body.appendChild(head);
    var text = node("div", "cf-text");
    segments(m.text, cfg.showEmotes ? m.emotes : [], cfg.showGifs ? m.gifs : []).forEach(function (s) {
      if (s.emote) { var img = node("img", s.emote.gif ? "cf-gif" : "cf-emote"); img.src = s.emote.url; img.alt = s.emote.name; text.appendChild(img); }
      else text.appendChild(node("span", "", s.text));
    });
    body.appendChild(text);
    li.appendChild(body);
    return li;
  }
  function setAvatar(m, url) {
    var box = m.parts && m.parts.avatar;
    if (!box || !url) return;
    var img = node("img");
    img.src = url; img.alt = "";
    img.onerror = function () { if (img.parentNode) img.parentNode.removeChild(img); };
    box.appendChild(img);
  }
  function setPronoun(m, text) {
    var p = m.parts && m.parts.pron;
    if (!p || !text) return;
    p.textContent = cfg.pronounStyle === "brackets" ? "(" + text + ")" : text;
    p.hidden = false;
  }

  function nickOf(data) { return String(data.nick || data.username || "").toLowerCase().replace(/^@/, ""); }
  function addMessage(data, demo) {
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    if (!text) return;
    var nick = nickOf(data);
    var tags = data.tags || {};
    var color = data.displayColor || tags.color || "";
    var m = {
      id: seq++, msgId: String(data.msgId || tags.id || ""), userId: String(data.userId || tags["user-id"] || ""), nick: nick,
      name: String(data.displayName || data.nick || "Someone"), text: text, emotes: data.emotes || [], gifs: gifsOf(data), badges: badgesOf(data),
      action: !!data.isAction, color: /^#[0-9a-f]{6}$/i.test(color) ? color : "", at: Date.now(), fading: false
    };
    m.li = buildRow(m);
    var before = snapshot();
    if (cfg.newestTop) el.list.insertBefore(m.li, el.list.firstChild);
    else el.list.appendChild(m.li);
    msgs.push(m);
    while (msgs.length > cfg.max) drop(msgs[0]);
    fit();
    glide(before);
    playUrl(cfg, cfg.sound, cfg.volume);
    if (demo) { if (demo.pronouns) setPronoun(m, demo.pronouns); return; }
    if (!validLogin(nick)) return;
    if (cfg.showAvatars) avatarFor(nick, function (url) { setAvatar(m, url); });
    if (cfg.showPronouns) pronounsFor(nick, function (p) { setPronoun(m, p); });
  }
  // Chat scrolls: a new message arrives at one end and the older ones move away from it, so a
  // message is removed only once it has gone completely out of view, which is above the box
  // when the newest is at the bottom and below it when the newest is at the top. How many are
  // on screen is whatever the box's height holds. Where the page cannot measure (a test, or
  // before the first paint) nothing is removed this way.
  function fit() {
    if (!el.list || typeof el.list.getBoundingClientRect !== "function") return;
    for (var guard = 0; guard < 60 && msgs.length > 1; guard++) {
      var box = el.list.getBoundingClientRect(), kids = el.list.children;
      var edge = cfg.newestTop ? kids[kids.length - 1] : kids[0];
      if (!edge || typeof edge.getBoundingClientRect !== "function") return;
      var r = edge.getBoundingClientRect();
      if (!(cfg.newestTop ? r.top >= box.bottom - 1 : r.bottom <= box.top + 1)) return;
      drop(msgs[0]);
    }
  }
  // Where each message is now, so that after a new one is added the older ones can glide from
  // where they were to where they are, instead of jumping.
  function snapshot() {
    var out = [];
    if (!cfg.animate) return out;
    msgs.forEach(function (m) {
      if (m.li && typeof m.li.getBoundingClientRect === "function") out.push({ m: m, top: m.li.getBoundingClientRect().top });
    });
    return out;
  }
  function glide(before) {
    var moved = [];
    before.forEach(function (b) {
      if (msgs.indexOf(b.m) === -1) return;
      var d = b.top - b.m.li.getBoundingClientRect().top;
      if (Math.abs(d) < 1) return;
      b.m.li.style.transition = "none";
      b.m.li.style.transform = "translateY(" + d + "px)";
      moved.push(b.m.li);
    });
    if (!moved.length) return;
    void el.list.offsetWidth;                  // settle the starting point before easing away from it
    moved.forEach(function (li) { li.style.transition = "transform 0.35s ease, opacity 0.5s ease"; li.style.transform = "none"; });
  }
  function drop(m) {
    var at = msgs.indexOf(m);
    if (at !== -1) msgs.splice(at, 1);
    if (m.li && m.li.parentNode) m.li.parentNode.removeChild(m.li);
  }
  function dropWhere(test) { msgs.slice().forEach(function (m) { if (test(m)) drop(m); }); }

  function tick() {
    if (!loaded) return;
    fit();                       // a picture or emote that has loaded can move things along
    if (!cfg.fadeMs) return;
    var t = Date.now();
    msgs.slice().forEach(function (m) {
      if (m.fading || t - m.at < cfg.fadeMs) return;
      m.fading = true;
      if (!cfg.animate) { drop(m); return; }
      m.li.classList.add("fading");
      setTimeout(function () { drop(m); }, 500);
    });
  }

  // ---------------------------------------------------------------------------
  // Chat, buttons and the other events
  // ---------------------------------------------------------------------------
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    if (!text) return;
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low === base || low.indexOf(base + " ") === 0) { handleCommand(text.slice(base.length).replace(/^\s+|\s+$/g, ""), data); return; }
    var nick = nickOf(data);
    if (cfg.hideCommands && text.charAt(0) === "!") return;
    if (cfg.ignore.indexOf(nick) !== -1 || hidden[nick]) return;
    addMessage(data);
  }
  function handleCommand(rest, data) {
    var m = /^(\S+)\s*(.*)$/.exec(rest);
    if (!m) { pop(); return; }                           // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    var verb = m[1].toLowerCase(), who = m[2].replace(/^\s+|\s+$/g, "").replace(/^@/, "").toLowerCase();
    if (verb === "clear") clearAll();
    else if (verb === "hide" && validLogin(who)) { hidden[who] = true; dropWhere(function (x) { return x.nick === who; }); saveHidden(); }
    else if (verb === "unhide" && validLogin(who)) { delete hidden[who]; saveHidden(); }
  }
  function clearAll() { dropWhere(function () { return true; }); }
  function saveHidden() { storeSave(STORE_KEY, { hidden: Object.keys(hidden) }); }
  function pop() {
    if (!el.app || !el.app.classList) return;
    el.app.classList.remove("pop"); void el.app.offsetWidth; el.app.classList.add("pop");
  }
  var DEMO = [
    { nick: "demo_one", displayName: "Alice", text: "Hello everyone, so glad to be here", color: "#FF7BAC", pronouns: "She/Her" },
    { nick: "demo_two", displayName: "Bram", text: "That was brilliant", color: "#5BC0FF", pronouns: "He/Him" },
    { nick: "demo_three", displayName: "Cass", text: "Sending you all the good thoughts today", color: "#8FE388", pronouns: "They/Them" },
    { nick: "demo_four", displayName: "Dev", text: "waves", color: "#FFD36B", isAction: true }
  ];
  function handleButton(field) {
    switch (field) {
      case "btnClear": clearAll(); break;
      case "btnDemo":
        DEMO.forEach(function (d) { addMessage(d, { pronouns: d.pronouns }); });
        break;
      case "test_soundMessage": playUrl(cfg, cfg.sound, cfg.volume); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Look and load
  // ---------------------------------------------------------------------------
  function applyLook() {
    theme = applyCommonTheme(cfg, el.root, el.app, "cf-font-link");
    var s = el.app.style;
    s.setProperty("--cf-size", cfg.textSize + "cqw");
    s.setProperty("--cf-gap", cfg.rowGap + "em");
    s.setProperty("--cf-gif", cfg.gifSize);
    s.setProperty("--cf-avatar", cfg.avatarSize + "em");
    s.setProperty("--cf-avatar-r", cfg.avatarShape === "square" ? "0" : cfg.avatarShape === "rounded" ? "22%" : "50%");
    el.app.classList.toggle("inline", cfg.inline);
    el.app.classList.toggle("bubbles", cfg.bubbles);
    el.app.classList.toggle("newest-top", cfg.newestTop);
    el.title.textContent = cfg.title;
    el.title.hidden = !cfg.showTitle || !cfg.title;
  }
  function bind() {
    var ids = { root: "cf-root", app: "cf-app", title: "cf-title", list: "cf-list" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }
  function restoreHidden(saved) {
    hidden = {};
    var h = saved && typeof saved === "object" && Array.isArray(saved.hidden) ? saved.hidden : [];
    h.forEach(function (x) { if (typeof x === "string" && validLogin(x)) hidden[x] = true; });
  }

  setInterval(tick, 500);

  window.addEventListener("onWidgetLoad", function (obj) {
    loaded = false;
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    epoch++;
    msgs = []; seq = 0; pronouns = {}; waiting = {};
    while (el.list.firstChild) el.list.removeChild(el.list.firstChild);
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      restoreHidden(saved);
      storeLoad(CACHE_KEY, function (cached) { restoreCache(cached); loaded = true; });
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "chatfeed", d.listener, ev);
    try { dispatch(d.listener, ev); }
    catch (e) { if (cfg.debug && typeof console !== "undefined" && console.log) console.log("[chatfeed] could not handle", d.listener, e && e.message); }
  });
  function dispatch(listener, ev) {
    switch (listener) {
      case "message": handleChat(ev.data); break;
      case "delete-message": if (ev.msgId) dropWhere(function (m) { return m.msgId === String(ev.msgId); }); break;
      case "delete-messages": if (ev.userId) dropWhere(function (m) { return m.userId === String(ev.userId); }); break;
      case "widget-button": handleButton(ev.field); break;
    }
  }
})();
