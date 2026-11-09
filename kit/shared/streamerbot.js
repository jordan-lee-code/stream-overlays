/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Lets an overlay written for StreamElements run in an OBS browser source with Streamer.bot instead.
 *
 * The overlays listen for the events StreamElements sends a custom widget (onWidgetLoad, then onEventReceived with a
 * listener such as "cheer-latest") and keep what they remember in SE_API.store. This file gives them both: it turns what
 * Streamer.bot's WebSocket server says into the same events, and keeps the store in the browser source's own storage.
 * The overlays themselves are not changed.
 *
 * The settings come from the page's address, because a browser source has no settings editor:
 *   #s=...      the settings that differ from the defaults, as base64url JSON (the overlay's page on the site makes this)
 *   ?host=      where Streamer.bot is listening (127.0.0.1), ?port= (8080), ?endpoint= (/), ?password= (none)
 *   ?debug=1    shows the connection state in the corner and logs every event it passes on
 *
 * Every translation is a plain function of the event, so the tests can run them without a browser. */
(function (root) {
  "use strict";

  // The client that talks to Streamer.bot is kept beside this file, so an overlay that Streamer.bot hosts needs no internet. The copy on
  // the jsDelivr network is only the second choice, for a page that was put somewhere without it.
  var CLIENT_FILE = "../streamerbot-client.js";
  var CLIENT_URL = "https://cdn.jsdelivr.net/npm/@streamerbot/client@2.0.2/dist/streamerbot-client.js";

  function num(v, d) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : d; }
  function str(v, d) { return v === undefined || v === null ? d : String(v); }
  function lower(v) { return String(v === undefined || v === null ? "" : v).toLowerCase(); }

  function nameOf(u) { return u ? str(u.name || u.login || u.displayName || u.username, "") : ""; }
  function loginOf(u) { return u ? lower(u.login || u.name || u.username) : ""; }

  // StreamElements says a tier as "1000", "2000", "3000" or "prime".
  function tierOf(subTier, isPrime) {
    var t = lower(subTier);
    if (isPrime === true || /prime/.test(t)) return "prime";
    if (/3/.test(t)) return "3000";
    if (/2/.test(t)) return "2000";
    return "1000";
  }

  // ---- chat -------------------------------------------------------------------------------------------------------------

  // Streamer.bot's role number is 1 for a viewer up to 4 for the broadcaster, and its badges are named, so both are read.
  function badgesOf(user, broadcaster) {
    var out = [], seen = {};
    function add(type, extra) {
      if (seen[type]) return;
      seen[type] = true;
      var b = { type: type, version: "1", url: "", description: type };
      if (extra) { b.version = str(extra.version, "1"); b.url = str(extra.imageUrl, ""); }
      out.push(b);
    }
    var role = num(user && user.role, 1);
    var list = user && user.badges instanceof Array ? user.badges : [];
    var isBroadcaster = role >= 4 || (!!broadcaster && !!user && loginOf(user) !== "" && loginOf(user) === loginOf(broadcaster));
    var found = {};
    list.forEach(function (b) { if (b && b.name) found[lower(b.name)] = b; });
    if (isBroadcaster) add("broadcaster", found.broadcaster);
    if (role === 3 || found.moderator) add("moderator", found.moderator);
    if (role === 2 || found.vip) add("vip", found.vip);
    if ((user && user.subscribed) || found.subscriber || found.founder) add(found.founder ? "founder" : "subscriber", found.founder || found.subscriber);
    list.forEach(function (b) {
      if (!b || !b.name) return;
      var n = lower(b.name);
      if (n === "broadcaster" || n === "moderator" || n === "vip" || n === "subscriber" || n === "founder") return;
      add(n, b);
    });
    return out;
  }

  // The emotes come as a name and a picture, not as a place in the text. The chat overlays find an emote by its name when they
  // are given no place, so the name and the picture are what they are given.
  function emotesOf(list) {
    var out = [];
    (list instanceof Array ? list : []).forEach(function (e) {
      if (!e || !e.name || !e.imageUrl) return;
      var item = { type: str(e.type, "twitch"), name: String(e.name), urls: { "1": e.imageUrl, "2": e.imageUrl, "4": e.imageUrl } };
      if (typeof e.startIndex === "number" && typeof e.endIndex === "number" && e.endIndex >= e.startIndex) { item.start = e.startIndex; item.end = e.endIndex; }
      out.push(item);
    });
    return out;
  }

  function chat(d) {
    var user = d.user || {}, text = str(d.text, "");
    var isMod = num(user.role, 1) === 3 || num(user.role, 1) >= 4;
    return { listener: "message", event: { data: {
      text: text,
      nick: loginOf(user),
      displayName: nameOf(user),
      userId: str(user.id, ""),
      msgId: str(d.messageId, ""),
      badges: badgesOf(user, d.broadcaster),
      emotes: emotesOf(d.emotes),
      isAction: !!(d.meta && d.meta.isMe),
      tags: { mod: isMod ? "1" : "0", color: str(user.color, ""), "user-id": str(user.id, "") }
    } } };
  }

  // ---- events -----------------------------------------------------------------------------------------------------------

  function sub(d) {
    return { listener: "subscriber-latest", event: { type: "subscriber", name: nameOf(d.user), amount: Math.max(1, num(d.durationMonths, 1)), tier: tierOf(d.subTier, d.isPrime), gifted: false, message: "" } };
  }
  function resub(d) {
    var e = { type: "subscriber", name: nameOf(d.user), amount: Math.max(1, num(d.cumulativeMonths, 1)), tier: tierOf(d.subTier, d.isPrime), gifted: !!d.isGift, message: str(d.text, "") };
    if (d.isGift) e.sender = d.gifterIsAnonymous ? "Anonymous" : nameOf(d.gifter);
    return { listener: "subscriber-latest", event: e };
  }
  // A gift bomb arrives once as a whole and then once for each person who got one. The overlays count the whole and skip the
  // rest, and they know which is which by these flags, exactly as they do on StreamElements.
  function giftSub(d) {
    var e = { type: "subscriber", name: nameOf(d.recipient), sender: nameOf(d.user), tier: tierOf(d.subTier), gifted: true, message: "" };
    if (d.fromCommunitySubGift) {
      e.isCommunityGift = true;
      e.amount = Math.max(1, num(d.communitySubGiftCumulativeTotal, num(d.communitySubGiftCount, 1)));
    } else {
      e.amount = Math.max(1, num(d.durationMonths, 1));
    }
    return { listener: "subscriber-latest", event: e };
  }
  function giftBomb(d) {
    return { listener: "subscriber-latest", event: { type: "subscriber", gifted: true, bulkGifted: true, amount: Math.max(0, Math.floor(num(d.total, 0))), sender: nameOf(d.user), tier: tierOf(d.subTier), message: "" } };
  }
  function cheer(d) {
    return { listener: "cheer-latest", event: { type: "cheer", name: d.anonymous ? "Anonymous" : nameOf(d.user), amount: Math.max(0, Math.floor(num(d.bits, 0))), message: str(d.text, "") } };
  }
  function follow(d) {
    return { listener: "follower-latest", event: { type: "follower", name: nameOf(d.targetUser || d.user) } };
  }
  function raid(d) {
    return { listener: "raid-latest", event: { type: "raid", name: nameOf(d.raider), amount: Math.max(0, Math.floor(num(d.viewers, 0))) } };
  }
  function redemption(d) {
    var r = d.reward || {};
    return { listener: "redemption-latest", event: { type: "redemption", name: nameOf(d.user), title: str(r.title, ""), amount: num(r.cost, 0), message: str(d.userInput, ""), item: str(r.title, "") } };
  }
  // The tip events have no schema in Streamer.bot's documentation, so each reads the names a tip service is likely to use. Turning
  // on the overlay's debug setting (or ?debug=1) logs what arrived if a tip does not show.
  function tip(d) {
    var amount = num(d.amount, num(d.donationAmount, num(d.value, 0)));
    var who = d.username || d.name || d.from || d.donor || d.donorName || d.fromName || d.displayName || d.user;
    if (who && typeof who === "object") who = nameOf(who);
    return { listener: "tip-latest", event: { type: "tip", name: str(who, "Someone"), amount: Math.round(amount * 100) / 100, message: str(d.message || d.comment, ""), currency: str(d.currency, "") } };
  }

  var TRANSLATE = {
    "Twitch.Cheer": cheer, "Twitch.Sub": sub, "Twitch.ReSub": resub, "Twitch.GiftSub": giftSub, "Twitch.GiftBomb": giftBomb,
    "Twitch.Follow": follow, "Twitch.Raid": raid, "Twitch.ChatMessage": chat, "Twitch.RewardRedemption": redemption,
    "StreamElements.Tip": tip, "Streamlabs.Donation": tip, "Kofi.Donation": tip, "TipeeeStream.Donation": tip
  };

  /** The StreamElements event for a Streamer.bot one, as { listener, event }, or null for one the overlays have no use for.
   *  A test event, which Streamer.bot sends when you press Test, is passed on like a real one so a setup can be tried out. */
  function translate(name, data) {
    var f = TRANSLATE[name];
    if (!f || !data || typeof data !== "object") return null;
    try { return f(data); } catch (e) { return null; }
  }

  // ---- settings ---------------------------------------------------------------------------------------------------------

  function b64urlToText(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), pct = "";
    for (var i = 0; i < bin.length; i++) pct += "%" + ("00" + bin.charCodeAt(i).toString(16)).slice(-2);
    return decodeURIComponent(pct);
  }
  function textToB64url(t) {
    var bytes = unescape(encodeURIComponent(t));
    return btoa(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  /** The settings in an address's hash (`#s=...`), as an object. Anything unreadable gives no settings, not an error. */
  function readSettings(hash) {
    var m = /(?:^#|&)s=([A-Za-z0-9_-]+)/.exec(String(hash || ""));
    if (!m) return {};
    try { var v = JSON.parse(b64urlToText(m[1])); return v && typeof v === "object" && !(v instanceof Array) ? v : {}; } catch (e) { return {}; }
  }
  /** The part of an address's hash that carries the settings, for a page that builds the browser source address. */
  function writeSettings(values) { return "#s=" + textToB64url(JSON.stringify(values || {})); }
  function readQuery(search) {
    var out = {};
    String(search || "").replace(/^\?/, "").split("&").forEach(function (p) {
      if (!p) return;
      var i = p.indexOf("="), k = decodeURIComponent(i === -1 ? p : p.slice(0, i)), v = i === -1 ? "" : decodeURIComponent(p.slice(i + 1).replace(/\+/g, " "));
      out[k] = v;
    });
    return out;
  }
  /** The starting value of every setting in a fields.json, then the settings from the address on top of them. Buttons are not settings. */
  function fieldData(fields, overrides) {
    var out = {};
    Object.keys(fields || {}).forEach(function (k) {
      var f = fields[k];
      if (f && f.type !== "button" && f.type !== "section" && "value" in f) out[k] = f.value;
    });
    Object.keys(overrides || {}).forEach(function (k) { out[k] = overrides[k]; });
    return out;
  }

  // ---- the store --------------------------------------------------------------------------------------------------------

  // SE_API.store keeps what an overlay remembers between visits. In a browser source that is the page's own storage, which OBS keeps
  // for as long as the source exists. Each overlay is its own page, so its keys never meet another's.
  function makeStore(storage, prefix) {
    return {
      get: function (key) {
        try { var v = storage.getItem(prefix + key); return Promise.resolve(v === null || v === undefined ? null : JSON.parse(v)); } catch (e) { return Promise.resolve(null); }
      },
      set: function (key, value) {
        try { storage.setItem(prefix + key, JSON.stringify(value)); } catch (e) { /* it still works unsaved */ }
        return Promise.resolve();
      }
    };
  }

  // ---- running ----------------------------------------------------------------------------------------------------------

  function fire(type, detail) {
    var ev;
    if (typeof root.CustomEvent === "function") ev = new root.CustomEvent(type, { detail: detail });
    else { ev = root.document.createEvent("CustomEvent"); ev.initCustomEvent(type, false, false, detail); }
    root.dispatchEvent(ev);
  }

  function badge(text, ok) {
    var el = root.document.getElementById("sb-status");
    if (!el) {
      el = root.document.createElement("div");
      el.id = "sb-status";
      el.style.cssText = "position:fixed;right:4px;bottom:4px;z-index:2147483647;font:11px/1.3 sans-serif;padding:3px 8px;border-radius:8px;color:#fff;pointer-events:none";
      root.document.body.appendChild(el);
    }
    el.style.background = ok ? "#2e7d4f" : "#a33";
    el.textContent = text;
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var s = root.document.createElement("script");
      s.src = url; s.onload = resolve; s.onerror = function () { reject(new Error("Could not load " + url)); };
      root.document.head.appendChild(s);
    });
  }

  function start() {
    var q = readQuery(root.location.search), debug = q.debug === "1" || q.debug === "true";
    var overrides = readSettings(root.location.hash);
    var base = root.location.pathname.replace(/[^\/]*$/, "");
    var storePrefix = "sb:" + base + ":";
    root.SE_API = { store: makeStore(root.localStorage, storePrefix) };

    function say(t, ok) { if (debug) badge(t, ok); }
    say("Streamer.bot: loading", false);

    return fetch("widget/fields.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (fields) {
      var data = fieldData(fields, overrides);
      if (debug) data.debug = true;
      fire("onWidgetLoad", { fieldData: data, channel: {}, session: { data: {} }, overlay: { isEditorMode: false } });
      return loadScript(CLIENT_FILE).catch(function () { return loadScript(CLIENT_URL); }).then(function () {
        var Client = root.StreamerbotClient || (root.Streamerbot && root.Streamerbot.Client);
        if (!Client) throw new Error("The Streamer.bot client did not load.");
        var client = new Client({
          host: q.host || "127.0.0.1", port: num(q.port, 8080), endpoint: q.endpoint || "/", password: q.password || undefined,
          autoReconnect: true, retries: -1,
          onConnect: function () { say("Streamer.bot: connected", true); },
          onDisconnect: function () { say("Streamer.bot: waiting for it to start", false); },
          onError: function () { say("Streamer.bot: cannot connect", false); }
        });
        // A short wait so every overlay has read its saved state before the first event can reach it.
        root.setTimeout(function () {
          Object.keys(TRANSLATE).forEach(function (name) {
            client.on(name, function (msg) {
              var out = translate(name, msg && msg.data);
              if (debug && root.console) root.console.log("[streamerbot]", name, msg && msg.data, "->", out);
              if (out) fire("onEventReceived", { listener: out.listener, event: out.event });
            });
          });
        }, 600);
      });
    }).catch(function (e) { say(e && e.message ? e.message : "Streamer.bot: could not start", false); });
  }

  var api = { translate: translate, readSettings: readSettings, writeSettings: writeSettings, readQuery: readQuery, fieldData: fieldData, makeStore: makeStore, tierOf: tierOf, badgesOf: badgesOf, emotesOf: emotesOf, events: Object.keys(TRANSLATE), CLIENT_URL: CLIENT_URL, CLIENT_FILE: CLIENT_FILE, start: start };
  root.StreamerbotAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root.document && root.location && !root.__sbNoAutostart) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start); else start();
  }
}(typeof window !== "undefined" ? window : this));
