/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Recent Activity Overlay. StreamElements custom widget logic. */
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
    faegreen: { panel: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", track: "rgba(238, 245, 218, 0.2)", alarm: "#E0805A", font: "Almendra" },
    pride: { panel: "rgba(20, 16, 34, 0.8)", text: "#FFFFFF", accent: "#FFEE00", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"] },
    progress: { panel: "rgba(22, 16, 30, 0.8)", text: "#FFFFFF", accent: "#5BCEFA", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"] },
    trans: { panel: "rgba(18, 28, 44, 0.82)", text: "#FFFFFF", accent: "#F5A9B8", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"] },
    bi: { panel: "rgba(30, 14, 36, 0.82)", text: "#FFFFFF", accent: "#E0559F", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"] },
    pan: { panel: "rgba(24, 20, 40, 0.82)", text: "#FFFFFF", accent: "#FFD800", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#FF218C", "#FFD800", "#21B1FF"] },
    enby: { panel: "rgba(24, 24, 28, 0.86)", text: "#FFFFFF", accent: "#FFF433", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"] },
    lesbian: { panel: "rgba(40, 16, 20, 0.82)", text: "#FFFFFF", accent: "#FF9A56", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"] },
    ace: { panel: "rgba(16, 16, 22, 0.86)", text: "#F1F1F1", accent: "#B075C9", track: "rgba(255, 255, 255, 0.2)", alarm: "#FF5C5C", font: "Fredoka", flag: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"] }
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


  var STORE_KEY = "activity_v1";
  var KEEP = 50;
  var el = {};
  var cfg = {};
  var state = blankState();
  var loaded = false;
  var freshId = -1;

  function blankState() { return { feed: [], seq: 0, totals: { subs: 0, gifts: 0, bits: 0, tips: 0, follows: 0, raids: 0 } }; }
  function now() { return Date.now(); }

  function readConfig(f) {
    f = f || {};
    var c = readCommon(f, { command: "!activity", title: "Recent activity" });
    c.layout = str(f.layout, "list");
    c.rows = clamp(Math.floor(num(f.rows, 5)), 1, 15);
    c.newestFirst = str(f.order, "newest-first") !== "newest-last";
    c.fadeMs = Math.max(0, num(f.fadeAfter, 0)) * 1000;
    c.types = { sub: bool(f.showSubs, true), gift: bool(f.showGifts, true), bits: bool(f.showBits, true), tip: bool(f.showTips, true), follow: bool(f.showFollows, true), raid: bool(f.showRaids, true) };
    c.minBits = Math.max(0, num(f.minBits, 0));
    c.minTip = Math.max(0, num(f.minTip, 0));
    c.ignore = String(str(f.ignoreNames, "")).toLowerCase().split(",").map(function (s) { return s.replace(/^\s+|\s+$/g, ""); }).filter(Boolean);
    c.text = { sub: str(f.textSub, "{name} subscribed"), resub: str(f.textResub, "{name} resubscribed for {months} months"), gift: str(f.textGift, "{name} gifted {count} {subs}"),
      bits: str(f.textBits, "{name} cheered {amount} bits"), tip: str(f.textTip, "{name} tipped {currency}{amount}"), follow: str(f.textFollow, "{name} followed"),
      raid: str(f.textRaid, "{name} raided with {amount} viewers") };
    c.currency = txt(f.currency, "£");
    c.anonName = str(f.anonymousName, "Anonymous");
    c.showTags = bool(f.showTags, true);
    c.tags = { sub: txt(f.tagSub, "Sub"), gift: txt(f.tagGift, "Gift"), bits: txt(f.tagBits, "Bits"), tip: txt(f.tagTip, "Tip"), follow: txt(f.tagFollow, "Follow"), raid: txt(f.tagRaid, "Raid") };
    c.showTotals = bool(f.showTotals, true);
    c.totalsLabel = f.totalsLabel === undefined || f.totalsLabel === null ? "This stream" : String(f.totalsLabel);   // empty means no label
    c.totalOn = { subs: bool(f.totalSubs, true), gifts: bool(f.totalGifts, true), bits: bool(f.totalBits, true), tips: bool(f.totalTips, true), follows: bool(f.totalFollows, false), raids: bool(f.totalRaids, false) };
    c.textSize = Math.max(2, num(f.textSize, 5));
    c.titleScale = Math.max(0.5, num(f.titleScale, 1.2));
    c.latestScale = Math.max(0.5, num(f.latestScale, 1.6));
    c.rowGap = Math.max(0, num(f.rowGap, 0.3));
    c.sound = str(f.soundEvent, "");
    c.volume = num(f.soundEventVol, 60);
    return c;
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function isAnon(name) { return !name || /^(anonymous|an?anonymous\s?gifter|anon)$/i.test(String(name).replace(/\s+/g, "")); }
  function nameOf(raw) {
    var n = String(raw === undefined || raw === null ? "" : raw).replace(/^\s+|\s+$/g, "");
    return isAnon(n) ? cfg.anonName : n;
  }
  function ignored(raw) { return cfg.ignore.indexOf(String(raw || "").toLowerCase()) !== -1; }

  function record(entry, totalKey, totalAmount) {
    if (!cfg.types[entry.type]) return;
    if (ignored(entry.name)) return;
    state.totals[totalKey] = Math.round((state.totals[totalKey] + totalAmount) * 100) / 100;
    entry.id = state.seq++; entry.at = now();
    state.feed.push(entry);
    while (state.feed.length > KEEP) state.feed.shift();
    freshId = entry.id;
    save(); render();
    playUrl(cfg, cfg.sound, cfg.volume);
  }
  function onSub(event) {
    event = event || {};
    // A gift bomb is one announcement with the real size, then one follow-up per recipient
    // carrying a streak figure such as 170. Only the announcement is shown.
    if (event.isCommunityGift || event.playedAsCommunityGift) return;
    if (bool(event.bulkGifted, false)) {
      var n = Math.max(0, Math.floor(num(event.amount, 0)));
      if (n > 0) record({ type: "gift", name: nameOf(event.sender || event.name), count: n }, "gifts", n);
      return;
    }
    if (bool(event.gifted, false)) { record({ type: "gift", name: nameOf(event.sender), count: 1 }, "gifts", 1); return; }
    var months = Math.max(1, Math.floor(num(event.amount, 1)));
    record({ type: "sub", name: nameOf(event.name || event.username), months: months, tier: String(event.tier || "") }, "subs", 1);
  }
  function onCheer(event) {
    event = event || {};
    var bits = Math.floor(num(event.amount, 0));
    if (bits > 0 && bits >= cfg.minBits) record({ type: "bits", name: nameOf(event.name || event.username), amount: bits }, "bits", bits);
  }
  function onTip(event) {
    event = event || {};
    var amount = Math.round(num(event.amount, 0) * 100) / 100;
    if (amount > 0 && amount >= cfg.minTip) record({ type: "tip", name: nameOf(event.name || event.username), amount: amount }, "tips", amount);
  }
  function onFollow(event) { record({ type: "follow", name: nameOf(event && (event.name || event.username)) }, "follows", 1); }
  function onRaid(event) {
    event = event || {};
    record({ type: "raid", name: nameOf(event.name || event.username), amount: Math.max(0, Math.floor(num(event.amount, 0))) }, "raids", 1);
  }

  // ---------------------------------------------------------------------------
  // Chat and buttons
  // ---------------------------------------------------------------------------
  function handleChat(data) {
    data = data || {};
    var text = String(data.text || "").replace(/^\s+|\s+$/g, "");
    var base = cfg.command.toLowerCase(), low = text.toLowerCase();
    if (low !== base && low.indexOf(base + " ") !== 0) return;
    var verb = text.slice(base.length).replace(/^\s+|\s+$/g, "").toLowerCase();
    if (!verb) { popTitle(); return; }                     // anyone can ask to see it
    if (!canManage(cfg, rolesOf(data))) return;
    if (verb === "clear") clearFeed(false);
    else if (verb === "reset") clearFeed(true);
  }
  function clearFeed(withTotals) {
    state.feed = [];
    if (withTotals) state.totals = blankState().totals;
    save(); render();
  }
  function handleButton(field) {
    switch (field) {
      case "btnClear": clearFeed(false); break;
      case "btnReset": clearFeed(true); break;
      case "test_soundEvent": playUrl(cfg, cfg.sound, cfg.volume); break;
    }
  }

  // ---------------------------------------------------------------------------
  // Storage and drawing
  // ---------------------------------------------------------------------------
  function save() { storeSave(STORE_KEY, state); }
  function restore(saved) {
    var s = blankState();
    if (saved && typeof saved === "object") {
      var t = saved.totals || {};
      for (var k in s.totals) if (s.totals.hasOwnProperty(k)) s.totals[k] = Math.max(0, num(t[k], 0));
      var feed = saved.feed || [];
      for (var i = Math.max(0, feed.length - KEEP); i < feed.length; i++) {
        var e = feed[i];
        if (e && typeof e === "object" && e.type) s.feed.push(e);
      }
      s.seq = Math.max(0, Math.floor(num(saved.seq, 0)));
      for (var j = 0; j < s.feed.length; j++) if (s.feed[j].id >= s.seq) s.seq = s.feed[j].id + 1;
    }
    return s;
  }

  function withCommas(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function money(n) { return n % 1 !== 0 ? n.toFixed(2) : withCommas(n); }
  function describe(e) {
    var tpl = e.type === "sub" ? (e.months > 1 ? cfg.text.resub : cfg.text.sub) : cfg.text[e.type];
    var amount = e.type === "tip" ? money(e.amount || 0) : withCommas(e.amount || 0);
    return tpl.split("{name}").join(e.name).split("{count}").join(withCommas(e.count || 0)).split("{subs}").join(e.count === 1 ? "sub" : "subs")
      .split("{months}").join(String(e.months || 1)).split("{amount}").join(amount).split("{currency}").join(cfg.currency)
      .split("{tier}").join(e.tier || "");
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function span(cls, text) { var s = document.createElement("span"); s.className = cls; s.textContent = text; return s; }

  function totalsText() {
    var t = state.totals, parts = [];
    if (cfg.totalOn.subs) parts.push(withCommas(t.subs) + " subs");
    if (cfg.totalOn.gifts) parts.push(withCommas(t.gifts) + " gifted");
    if (cfg.totalOn.bits) parts.push(withCommas(t.bits) + " bits");
    if (cfg.totalOn.tips) parts.push(cfg.currency + money(t.tips));
    if (cfg.totalOn.follows) parts.push(withCommas(t.follows) + " follows");
    if (cfg.totalOn.raids) parts.push(withCommas(t.raids) + " raids");
    return parts.join(" · ");
  }
  function visibleEntries() {
    var t = now(), out = [];
    for (var i = state.feed.length - 1; i >= 0 && out.length < (cfg.layout === "latest" ? 1 : cfg.rows); i--) {
      var e = state.feed[i];
      if (!cfg.types[e.type]) continue;
      if (cfg.fadeMs > 0 && t - e.at > cfg.fadeMs) break;
      out.push(e);
    }
    return cfg.newestFirst || cfg.layout === "latest" ? out : out.reverse();
  }
  var lastKey = "";
  function render() {
    if (!el.app) return;
    el.title.textContent = cfg.title; el.title.hidden = !cfg.showTitle || !cfg.title;
    var list = visibleEntries();
    var key = list.map(function (e) { return e.id; }).join(",") + "|" + freshId;
    if (key !== lastKey) {
      lastKey = key;
      clear(el.list);
      for (var i = 0; i < list.length; i++) {
        var e = list[i], li = document.createElement("li");
        li.className = "ac-row type-" + e.type + (e.id === freshId ? " new" : "");
        if (cfg.showTags && cfg.tags[e.type]) li.appendChild(span("ac-tag", cfg.tags[e.type]));
        li.appendChild(span("ac-text", describe(e)));
        el.list.appendChild(li);
      }
    }
    el.totals.textContent = (cfg.totalsLabel ? cfg.totalsLabel + ": " : "") + totalsText();
    el.totals.hidden = !cfg.showTotals || !totalsText();
    el.app.classList.toggle("latest", cfg.layout === "latest");
  }
  function popTitle() {
    if (!el.title || !el.title.classList) return;
    el.title.classList.remove("pop"); void el.title.offsetWidth; el.title.classList.add("pop");
  }
  function applyLook() {
    applyCommonTheme(cfg, el.root, el.app, "ac-font-link");
    var s = el.app.style;
    s.setProperty("--ac-size", cfg.textSize + "cqw");
    s.setProperty("--ac-title", cfg.titleScale);
    s.setProperty("--ac-latest", cfg.latestScale);
    s.setProperty("--ac-gap", cfg.rowGap + "em");
  }
  function bind() {
    var ids = { root: "ac-root", app: "ac-app", title: "ac-title", list: "ac-list", totals: "ac-totals" };
    for (var k in ids) { if (ids.hasOwnProperty(k)) el[k] = byId(ids[k]); }
  }

  setInterval(function () { if (loaded && cfg.fadeMs > 0) render(); }, 500);

  window.addEventListener("onWidgetLoad", function (obj) {
    cfg = readConfig((obj && obj.detail && obj.detail.fieldData) || {});
    bind();
    if (!el.app) return;
    applyLook();
    storeLoad(STORE_KEY, function (saved) {
      state = restore(saved);
      loaded = true; lastKey = ""; freshId = -1;
      render();
      if (!saved) save();
    });
  });
  window.addEventListener("onEventReceived", function (obj) {
    var d = obj && obj.detail;
    if (!d || !loaded) return;
    var ev = d.event || {};
    debugLog(cfg, "activity", d.listener, ev);
    switch (d.listener) {
      case "message": handleChat(ev.data); break;
      case "subscriber-latest": onSub(ev); break;
      case "cheer-latest": onCheer(ev); break;
      case "tip-latest": onTip(ev); break;
      case "follower-latest": onFollow(ev); break;
      case "raid-latest": onRaid(ev); break;
      case "widget-button": handleButton(ev.field); break;
    }
  });
})();
