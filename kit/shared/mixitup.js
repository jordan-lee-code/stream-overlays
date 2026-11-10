/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Lets an overlay written for StreamElements run as a Mix It Up Custom Overlay Widget.
 *
 * The overlays listen for the events StreamElements sends a custom widget (onWidgetLoad, then onEventReceived with a listener such as
 * "cheer-latest") and keep what they remember in SE_API.store. Mix It Up calls a function in the widget for each event, with one
 * `data` object, so this file defines those functions and turns each call into the event the overlay expects. The overlay is not changed.
 *
 * It is put at the front of the widget's JavaScript by mixitup-pack.js, after a line that gives it three things:
 *   var __miu = { name: "counter", defaults: { ...every setting's starting value... }, settings: "<the Settings property>" };
 * The settings string is the widget's Settings custom property, in curly brackets, which Mix It Up replaces with the settings that differ
 * from the defaults, as base64url JSON. Opened anywhere else it stays as it is, and the defaults are used.
 *
 * What is known of Mix It Up's `data` is the chat message, which was captured from a real one. The others are read by trying the names
 * a field is likely to have, in order, so they may need a name added once a real one has been seen; turning on the overlay's debug
 * setting logs what arrived. Every translation is a plain function, so the tests can run them without a browser. */
(function (root) {
  "use strict";

  function num(v, d) { var n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : d; }
  function str(v, d) { return v === undefined || v === null ? d : String(v); }
  function lower(v) { return String(v === undefined || v === null ? "" : v).toLowerCase(); }

  // The first of these properties that the object has, followed down a dotted path ("User.Username").
  function pick(obj, paths) {
    for (var i = 0; i < paths.length; i++) {
      var v = obj, parts = paths[i].split(".");
      for (var j = 0; j < parts.length && v !== undefined && v !== null; j++) v = v[parts[j]];
      if (v !== undefined && v !== null && v !== "") return v;
    }
    return undefined;
  }
  function userOf(d) { return d && (d.User || d.user) || null; }
  function nameOf(d, extra) {
    var u = userOf(d);
    var n = (u && (u.DisplayName || u.Username || u.FullDisplayName)) || pick(d || {}, (extra || []).concat(["DisplayName", "Username", "UserName", "Name"]));
    return str(n, "");
  }
  function amountOf(d, paths) { return num(pick(d || {}, paths), 0); }

  // StreamElements says a tier as "1000", "2000", "3000" or "prime". Mix It Up's may be a number (1, 2, 3) or words ("Tier 2", "Prime").
  function tierOf(v) {
    var t = lower(v);
    if (/prime/.test(t)) return "prime";
    if (/3/.test(t)) return "3000";
    if (/2/.test(t)) return "2000";
    return "1000";
  }

  // ---- chat -------------------------------------------------------------------------------------------------------------

  // Mix It Up gives a user's roles as numbers and as words ("User, Streamer"). The words are used, since the numbers are not documented.
  function badgesOf(user) {
    var out = [], seen = {};
    function add(type, url) { if (!seen[type]) { seen[type] = true; out.push({ type: type, version: "1", url: url || "", description: type }); } }
    if (!user) return out;
    var roles = lower(user.RolesString) + "," + lower(user.DisplayRolesString) + "," + lower(user.PrimaryRoleString);
    var role = user.PlatformModel && user.PlatformModel.NewRoleBadge ? user.PlatformModel.NewRoleBadge.image_url_2x : "";
    if (/streamer|broadcaster/.test(roles)) add("broadcaster", role);
    if (/moderator|\bmod\b/.test(roles)) add("moderator", role);
    if (/\bvip\b/.test(roles)) add("vip", role);
    if (user.IsSubscriber || user.IsPlatformSubscriber || /subscriber/.test(roles)) add("subscriber", user.PlatformSubscriberBadgeLink || "");
    return out;
  }

  // A message is a list of parts. Text parts are the words. Anything else that carries a picture's address is an emote, which the chat
  // overlays find by its name in the text, so it is given a name and that name goes in the text where the emote was.
  function messageOf(parts) {
    var text = "", emotes = [], n = 0;
    (Array.isArray(parts) ? parts : []).forEach(function (p) {
      if (!p) return;
      var content = str(p.Content, "");
      if (lower(p.Type) === "text" || !/^https?:\/\//i.test(content)) { text += content; return; }
      n++;
      var name = str(p.Name || p.Code || p.Text, "") || ("Emote" + n);
      emotes.push({ type: "mixitup", name: name, urls: { "1": content, "2": content, "4": content } });
      text += name;
    });
    return { text: text, emotes: emotes };
  }

  function chat(d) {
    var user = userOf(d) || {}, m = messageOf(d.Message);
    var badges = badgesOf(user);
    var isMod = badges.some(function (b) { return b.type === "moderator" || b.type === "broadcaster"; });
    var color = str(user.Color || (user.PlatformModel && user.PlatformModel.Color), "");
    return { listener: "message", event: { data: {
      text: m.text,
      nick: lower(user.Username),
      displayName: str(user.DisplayName || user.Username, ""),
      userId: str(user.PlatformID || user.ID, ""),
      msgId: str(d.MessageID, ""),
      badges: badges,
      emotes: m.emotes,
      isAction: lower(d.MessageType) === "action",
      tags: { mod: isMod ? "1" : "0", color: color, "user-id": str(user.PlatformID || user.ID, "") }
    } } };
  }

  // ---- events -----------------------------------------------------------------------------------------------------------

  var AMOUNT = ["Amount", "TotalAmount", "BitsAmount", "Bits", "Value"];
  function follow(d) { return { listener: "follower-latest", event: { type: "follower", name: nameOf(d) } }; }
  function raid(d) {
    return { listener: "raid-latest", event: { type: "raid", name: nameOf(d), amount: Math.max(0, Math.floor(amountOf(d, ["ViewerCount", "Viewers", "RaidViewerCount", "Amount", "RaidCount"]))) } };
  }
  function sub(d) {
    return { listener: "subscriber-latest", event: { type: "subscriber", name: nameOf(d), amount: Math.max(1, Math.floor(amountOf(d, ["Months", "CumulativeMonths", "SubMonths", "Amount"]))), tier: tierOf(pick(d, ["Tier", "SubscriberTier", "SubTier", "PlanName", "SubPlan", "User.SubscriberTier"])), gifted: false, message: str(pick(d, ["Message", "Text"]), "") } };
  }
  // A lone gifted sub, and a gift to a crowd, are two events. The overlays count a crowd once and skip the per-person events inside
  // it, and Mix It Up only runs the lone one for a sub that is not part of a crowd, so each is passed on as it is.
  function subGifted(d) {
    var to = pick(d, ["Receiver.DisplayName", "Receiver.Username", "Recipient.DisplayName", "Recipient.Username", "Gifted.DisplayName", "Gifted.Username"]);
    return { listener: "subscriber-latest", event: { type: "subscriber", gifted: true, sender: nameOf(d), name: str(to, ""), amount: Math.max(1, Math.floor(amountOf(d, ["Months", "MonthsGifted", "Amount"]))), tier: tierOf(pick(d, ["Tier", "SubscriberTier", "SubTier", "PlanName", "SubPlan"])), message: "" } };
  }
  function massSubGifted(d) {
    return { listener: "subscriber-latest", event: { type: "subscriber", gifted: true, bulkGifted: true, sender: nameOf(d), amount: Math.max(0, Math.floor(amountOf(d, ["Amount", "TotalGifted", "SubsGiftedAmount", "GiftedAmount", "Total", "Count"]))), tier: tierOf(pick(d, ["Tier", "SubscriberTier", "SubTier", "PlanName", "SubPlan"])), message: "" } };
  }
  function bits(d) {
    return { listener: "cheer-latest", event: { type: "cheer", name: nameOf(d), amount: Math.max(0, Math.floor(amountOf(d, ["Amount", "BitsAmount", "Bits", "TotalAmount"]))), message: messageOrText(d) } };
  }
  function messageOrText(d) {
    var m = d && d.Message;
    return Array.isArray(m) ? messageOf(m).text : str(pick(d || {}, ["Message", "Text"]), "");
  }
  function donation(d) {
    return { listener: "tip-latest", event: { type: "tip", name: nameOf(d, ["Donator", "Donor", "DonorName"]), amount: Math.round(amountOf(d, AMOUNT.concat(["DonationAmount"])) * 100) / 100, message: messageOrText(d), currency: str(pick(d || {}, ["Currency", "CurrencyCode"]), "") } };
  }

  // The functions Mix It Up calls, and what each becomes.
  var TRANSLATE = {
    ChatMessageReceived: chat, Follow: follow, Raid: raid, Subscription: sub, SubscriptionGifted: subGifted,
    MassSubscriptionGifted: massSubGifted, TwitchBits: bits, Donation: donation
  };

  // Mix It Up has no function for a channel point redemption, so one is given to run from a Mix It Up command: its Overlay action has a
  // Run Widget Function option. The reward's title is what it needs, as a lone value or as an object, and the rest is welcome.
  function redemption(a, b, c, d) {
    var o = a && typeof a === "object" && !(Array.isArray(a)) ? a : { title: Array.isArray(a) ? a[0] : a, name: Array.isArray(a) ? a[1] : b, amount: Array.isArray(a) ? a[2] : c, message: Array.isArray(a) ? a[3] : d };
    var title = str(pick(o, ["title", "Title", "reward", "Reward", "RewardName", "Name"]), "");
    if (!title) return null;
    return { listener: "redemption-latest", event: { type: "redemption", name: str(pick(o, ["name", "Username", "User.DisplayName", "user"]), ""), title: title, item: title, amount: num(pick(o, ["amount", "Amount", "cost", "Cost"]), 0), message: str(pick(o, ["message", "Message", "input", "UserInput"]), "") } };
  }

  // Tangia's bits do not reach any overlay by themselves, and nothing documented sends them. If something does send Mix It Up a webhook
  // with the amount, a command can run this with it, through the Overlay action's Run Widget Function, and it counts as bits do. The
  // amount can be a lone value, the first of a list, or in an object, with the name of who spent them alongside.
  function tangiaBits(a, b) {
    var o = a;
    // The whole payload can arrive as text, which is what $webhookpayload is, so it is read as JSON, and failing that the amount is looked
    // for in it by name. That way the command does not need Mix It Up's JSON mapping, which fills an identifier in only when it is set up
    // just so.
    if (typeof o === "string") {
      var t = o.replace(/^\s+|\s+$/g, "");
      if (/^[\[{]/.test(t)) {
        try { o = JSON.parse(t); } catch (e) {
          var m = /["']?(?:amount|bits)["']?\s*[:=]\s*["']?([\d][\d,.]*)/i.exec(t), w = /["']?(?:name|user|username)["']?\s*[:=]\s*["']([^"']+)["']/i.exec(t);
          o = { amount: m ? m[1] : "", name: w ? w[1] : "" };
        }
      }
    }
    o = o && typeof o === "object" && !Array.isArray(o) ? o : { amount: Array.isArray(o) ? o[0] : o, name: Array.isArray(o) ? o[1] : b };
    var amount = Math.floor(num(String(pick(o, ["amount", "Amount", "bits", "Bits"])).replace(/,/g, ""), 0));
    if (!(amount > 0) && o && typeof o === "object") {
      // A pair such as payload = $webhookpayload arrives as an object whose one value is the payload as text, so each text value is tried.
      var keys = Object.keys(o);
      for (var i = 0; i < keys.length; i++) {
        if (typeof o[keys[i]] === "string" && /^\s*[\[{]/.test(o[keys[i]])) { var inner = tangiaBits(o[keys[i]], b); if (inner) return inner; }
      }
    }
    if (!(amount > 0)) return null;
    return { listener: "cheer-latest", event: { type: "cheer", name: str(pick(o, ["name", "Name", "user", "User", "Username"]), "Tangia"), amount: amount, message: "", source: "tangia" } };
  }

  /** The StreamElements event for what a Mix It Up function was called with, as { listener, event }, or null when it has no use. */
  function translate(name, data) {
    var f = TRANSLATE[name];
    if (!f || !data || typeof data !== "object") return null;
    try { return f(data); } catch (e) { return null; }
  }

  // ---- settings and the store -------------------------------------------------------------------------------------------

  function b64urlToText(s) {
    s = String(s).replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), pct = "";
    for (var i = 0; i < bin.length; i++) pct += "%" + ("00" + bin.charCodeAt(i).toString(16)).slice(-2);
    return decodeURIComponent(pct);
  }
  /** The settings in the widget's Settings property: base64url JSON. Anything else, such as the placeholder that was never replaced, is none. */
  function readSettings(text) {
    if (!/^[A-Za-z0-9_-]+$/.test(String(text || ""))) return {};
    try { var v = JSON.parse(b64urlToText(text)); return v && typeof v === "object" && !(Array.isArray(v)) ? v : {}; } catch (e) { return {}; }
  }
  function fieldData(defaults, overrides) {
    var out = {};
    Object.keys(defaults || {}).forEach(function (k) { out[k] = defaults[k]; });
    Object.keys(overrides || {}).forEach(function (k) { out[k] = overrides[k]; });
    return out;
  }
  // What an overlay remembers lives in the page's own storage, under the overlay's name so two overlays on one page keep to their own.
  function makeStore(storage, prefix) {
    return {
      get: function (key) { try { var v = storage.getItem(prefix + key); return Promise.resolve(v === null || v === undefined ? null : JSON.parse(v)); } catch (e) { return Promise.resolve(null); } },
      set: function (key, value) { try { storage.setItem(prefix + key, JSON.stringify(value)); } catch (e) { /* it still works unsaved */ } return Promise.resolve(); }
    };
  }

  // ---- running ----------------------------------------------------------------------------------------------------------

  function fire(type, detail) {
    var ev;
    if (typeof root.CustomEvent === "function") ev = new root.CustomEvent(type, { detail: detail });
    else { ev = root.document.createEvent("CustomEvent"); ev.initCustomEvent(type, false, false, detail); }
    root.dispatchEvent(ev);
  }

  var api = { tangiaBits: tangiaBits, redemption: redemption, translate: translate, readSettings: readSettings, fieldData: fieldData, makeStore: makeStore, badgesOf: badgesOf, messageOf: messageOf, tierOf: tierOf, functions: Object.keys(TRANSLATE) };
  root.MixItUpAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root.document && root.__miu) {
    var cfg = root.__miu, data = fieldData(cfg.defaults, readSettings(cfg.settings)), debug = !!data.debug, started = false;
    // With the overlay's debug setting on, what Mix It Up sends is shown on the overlay itself, newest first, since a browser source has no
    // console to read. It is the way to see what a follow, a raid or a sub looks like, so that a name this file does not know can be added.
    var lines = [];
    var show = function (name, d) {
      if (root.console) root.console.log("[mixitup]", name, d);
      var text;
      try { text = JSON.stringify(d); } catch (e) { text = String(d); }
      lines.unshift(name + ": " + (text.length > 400 ? text.slice(0, 400) + "..." : text));
      if (lines.length > 5) lines.pop();
      var box = root.document.getElementById("miu-log");
      if (!box) {
        box = root.document.createElement("pre");
        box.id = "miu-log";
        box.style.cssText = "position:fixed;left:0;bottom:0;right:0;max-height:40%;overflow:hidden;margin:0;padding:4px 6px;background:rgba(0,0,0,.8);color:#fff;font:10px/1.3 monospace;white-space:pre-wrap;word-break:break-all;z-index:2147483647;pointer-events:none";
        root.document.body.appendChild(box);
      }
      box.textContent = lines.join("\n");
    };
    root.SE_API = { store: makeStore(root.localStorage, "miu:" + str(cfg.name, "overlay") + ":") };
    // Mix It Up calls these by name, so each one has to be a function of the page itself.
    Object.keys(TRANSLATE).forEach(function (name) {
      root[name] = function (d) {
        if (debug) show(name, d);
        var out = translate(name, d);
        if (out) fire("onEventReceived", { listener: out.listener, event: out.event });
      };
    });
    // The editor buttons of StreamElements have no place in Mix It Up, so each is a function a Mix It Up command can run: the Overlay action's
    // Run Widget Function option takes a function's name. Each button is one function, named as its setting is, and PressButton takes the
    // name as a parameter, as text or in a list or an object, for a command that would rather have one function.
    var fieldOf = function (x) {
      if (Array.isArray(x)) x = x[0];
      if (x && typeof x === "object") x = x.field || x.Field || x.name || x.Name || x.value || x.Value;
      return str(x, "");
    };
    var press = function (field) {
      if (!field) return;
      if (debug) show("button", field);
      fire("onEventReceived", { listener: "widget-button", event: { field: field } });
    };
    root.PressButton = function (x) { press(fieldOf(x)); };
    (cfg.buttons || []).forEach(function (b) { root[b.field] = function () { press(b.field); }; });
    root.TangiaBits = function (a, b) {
      if (debug) show("TangiaBits", [a, b]);
      var out = tangiaBits(a, b);
      if (out) fire("onEventReceived", { listener: out.listener, event: out.event });
    };
    root.Redemption = function (a, b, c, d) {
      if (debug) show("Redemption", [a, b, c, d]);
      var out = redemption(a, b, c, d);
      if (out) fire("onEventReceived", { listener: out.listener, event: out.event });
    };
    // Mix It Up also calls functions for events nothing here uses. They are given something to call, so a call is never an error.
    ["UserBanned", "UserTimeout", "ChatMessageDeleted", "ChatCleared", "YouTubeSuperChat"].forEach(function (name) { if (typeof root[name] !== "function") root[name] = function () {}; });
    var start = function () {
      if (started) return;
      started = true;
      fire("onWidgetLoad", { fieldData: data, channel: {}, session: { data: {} }, overlay: { isEditorMode: false } });
    };
    // After the overlay's own script has run, which is after this one in the same widget.
    if (root.document.readyState === "complete") root.setTimeout(start, 0); else root.addEventListener("load", start);
  }
}(typeof window !== "undefined" ? window : this));
