/* Local stand-in for StreamElements. Loads the widget files, mocks SE_API.store on
   localStorage, and lets you fire the same events StreamElements would send. */
(function () {
  "use strict";
  var CFG = {
  "title": "Now Playing Overlay",
  "hint": "A pretend music player stands in for Last.fm, Tuna, Pear Desktop and Spotify, so you can try every source here with none of them running. Pick a source under Source in Every setting, then use the player below. Nothing here talks to a real service.",
  "store": "nowplaying",
  "storeKey": "nowplaying_v1",
  "timeMachine": true,
  "sections": [{ "title": "Pretend player", "hint": "What the player is doing. The card follows it within a few seconds, as it would on stream.", "buttons": [
    { "label": "Next track", "kind": "player", "action": "next" },
    { "label": "Previous track", "kind": "player", "action": "prev" },
    { "label": "Play / pause", "kind": "player", "action": "toggle" },
    { "label": "Stop (nothing playing)", "kind": "player", "action": "stop" },
    { "label": "Skip 30 seconds", "kind": "player", "action": "skip" },
    { "label": "Player goes offline", "kind": "player", "action": "offline" },
    { "label": "Player comes back", "kind": "player", "action": "online" }
  ] }],
  "chatDefault": "!nowplaying off",
  "demo": { "lastfmUser": "demo", "lastfmKey": "demo", "spotifyClientId": "demo", "spotifyRefreshToken": "demo" }
};
  var PREFIX = "se_" + CFG.store + "_";
  var offsetMs = 0;
  var realNow = Date.now.bind(Date);
  Date.now = function () { return realNow() + offsetMs; };

  window.SE_API = {
    store: {
      set: function (k, v) { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return Promise.resolve(); },
      get: function (k) { var s = localStorage.getItem(PREFIX + k); return Promise.resolve(s ? JSON.parse(s) : null); }
    }
  };

  // ---- the pretend player, and the pretend network that reports it ----
  var TRACKS = [
    { title: "Golden Hour", artist: "Mina and the Lanterns", album: "Soft Light", dur: 214000, art: "art/cover1.svg" },
    { title: "Kettle Song", artist: "The Quiet Hours", album: "Rainy Window", dur: 187000, art: "art/cover2.svg" },
    { title: "A Very Long Track Name That Goes On And On, Part Two (Extended Mix)", artist: "Someone With A Long Name, Another Artist", album: "Greatest Hits Volume Twelve", dur: 301000, art: "art/cover3.svg" }
  ];
  var player = { i: 0, playing: true, stopped: false, offline: false, pos: 45000, at: Date.now() };
  function here() { return player.playing ? player.pos + (Date.now() - player.at) : player.pos; }
  function now() { var p = Math.min(here(), TRACKS[player.i].dur); player.pos = p; player.at = Date.now(); return p; }
  function art() { return new URL(TRACKS[player.i].art, location.href).href; }
  function act(a) {
    now();
    if (a === "next" || a === "prev") { player.i = (player.i + (a === "next" ? 1 : TRACKS.length - 1)) % TRACKS.length; player.pos = 0; player.stopped = false; player.playing = true; }
    else if (a === "toggle") { player.stopped = false; player.playing = !player.playing; }
    else if (a === "stop") player.stopped = true;
    else if (a === "skip") player.pos = Math.min(player.pos + 30000, TRACKS[player.i].dur - 1000);
    else if (a === "offline") player.offline = true;
    else if (a === "online") player.offline = false;
    player.at = Date.now();
  }
  function reply(body, status) { return Promise.resolve(status === 204 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json" } })); }
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    url = String(url);
    var t = TRACKS[player.i], playing = !player.stopped && player.playing, p = now();
    if (url.indexOf("http://localhost:1608/") === 0 || url.indexOf("http://localhost:26538/") === 0 || url.indexOf("https://ws.audioscrobbler.com/") === 0 || url.indexOf("https://accounts.spotify.com/") === 0 || url.indexOf("https://api.spotify.com/") === 0) {
      if (player.offline) return Promise.reject(new TypeError("Failed to fetch"));
      if (url.indexOf("http://localhost:1608/") === 0) return reply({ status: player.stopped ? "stopped" : playing ? "playing" : "paused", title: t.title, artists: t.artist.split(", "), album: t.album, cover_url: art(), progress: p, duration: t.dur });
      if (url.indexOf("http://localhost:26538/") === 0) return player.stopped ? reply(null, 204) : reply({ title: t.title, artist: t.artist, album: t.album, imageSrc: art(), isPaused: !playing, songDuration: Math.round(t.dur / 1000), elapsedSeconds: Math.round(p / 1000), videoId: "demo" + player.i });
      if (url.indexOf("https://ws.audioscrobbler.com/") === 0) {
        var last = { name: t.title, artist: { "#text": t.artist }, album: { "#text": t.album }, image: [{ size: "extralarge", "#text": art() }] };
        if (playing) last["@attr"] = { nowplaying: "true" };
        return reply({ recenttracks: { track: [last] } });
      }
      if (url.indexOf("https://accounts.spotify.com/") === 0) return reply({ access_token: "demo-token", expires_in: 3600 });
      if (player.stopped) return reply(null, 204);
      return reply({ is_playing: playing, progress_ms: p, currently_playing_type: "track", item: { id: "demo" + player.i, name: t.title, artists: t.artist.split(", ").map(function (n) { return { name: n }; }), album: { name: t.album, images: [{ url: art(), width: 300 }] }, duration_ms: t.dur } });
    }
    return realFetch(url, opts);
  };

  var fieldDefs = {}, fieldData = {};
  function fire(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail: detail })); }
  function se(listener, event) { fire("onEventReceived", { listener: listener, event: event }); }
  function chat(text, role) {
    var badges = role === "broadcaster" ? [{ type: "broadcaster" }] : role === "mod" ? [{ type: "moderator" }] : [];
    se("message", { data: { text: text, nick: "tester", displayName: "Tester", badges: badges, tags: { mod: role === "mod" ? "1" : "0" } } });
  }
  // A chat message with the extras a real one carries: colour, badges and emotes.
  var sent = 0;
  function message(o) {
    var nick = String(o.nick || "tester");
    se("message", { data: { text: o.text, nick: nick.toLowerCase(), displayName: o.name || nick, userId: "u-" + nick.toLowerCase(), msgId: "m" + (++sent),
      badges: o.badges || [], emotes: o.emotes || [], displayColor: o.color || "", tags: { color: o.color || "", mod: "0", gifs: o.gifs || "" }, isAction: !!o.action } });
  }
  var names = ["Alice", "Bea", "Cass", "Dev", "Eli", "Fern", "Gus", "Hana"];
  var n = 0; function who() { return names[n++ % names.length]; }
  function fill(obj, name) { return JSON.parse(JSON.stringify(obj).split("{who}").join(name)); }

  function load() { fire("onWidgetLoad", { fieldData: fieldData, channel: { username: "tester" } }); syncLook(); }

  // StreamElements takes each setting's starting value from `value` in fields.json, so the
  // export is fields.json with the current values filled in. A widget that already has saved
  // settings keeps them, so paste it into a new custom widget.
  function exportText() {
    var out = {};
    Object.keys(fieldDefs).forEach(function (k) {
      var d = JSON.parse(JSON.stringify(fieldDefs[k]));
      // The stand-in details used to try the sources here are not exported as if they were yours.
      if (d.type !== "button" && d.type !== "sound-input" && fieldData.hasOwnProperty(k) && !(CFG.demo && CFG.demo.hasOwnProperty(k))) d.value = fieldData[k];
      out[k] = d;
    });
    return JSON.stringify(out, null, 2) + "\n";
  }
  // The copy panel (copy-panel.js) reads the settings as they are configured here through this.
  window.__exportFields = exportText;
  function syncLook() {
    var sel = document.getElementById("look-preset");
    if (sel && fieldData.themePreset !== undefined) sel.value = fieldData.themePreset;
    var box = document.getElementById("export-text");
    if (box) box.value = exportText();
  }

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }
  function btn(label, fn) { var b = el("button", { text: label }); b.addEventListener("click", fn); return b; }

  function renderSettings(host) {
    var groups = {};
    Object.keys(fieldDefs).forEach(function (k) { var g = fieldDefs[k].group || "Other"; (groups[g] = groups[g] || []).push(k); });
    Object.keys(groups).forEach(function (g) {
      var d = el("details", {}, [el("summary", { text: g })]);
      groups[g].forEach(function (k) {
        var f = fieldDefs[k], row = el("div", { "class": "row" });
        var cur = fieldData.hasOwnProperty(k) ? fieldData[k] : f.value;
        if (f.type === "button") {
          row.appendChild(btn(f.label || k, function () { se("widget-button", { field: k }); }));
        } else {
          row.appendChild(el("label", { text: f.label || k }));
          var input;
          if (f.type === "dropdown") {
            input = el("select");
            Object.keys(f.options || {}).forEach(function (o) { var op = el("option", { value: o, text: f.options[o] }); if (String(cur) === o) op.selected = true; input.appendChild(op); });
          } else if (f.type === "checkbox") {
            input = el("input", { type: "checkbox" }); input.checked = !!cur;
          } else if (f.type === "number" || f.type === "slider") {
            input = el("input", { type: "number" }); input.value = cur;
            if (f.step !== undefined) input.step = f.step;
          } else {
            input = el("input", { type: "text" }); input.value = cur === undefined ? "" : cur;
          }
          input.addEventListener("change", function () {
            fieldData[k] = f.type === "checkbox" ? input.checked : (f.type === "number" || f.type === "slider") ? parseFloat(input.value) : input.value;
            load();
          });
          row.appendChild(input);
        }
        d.appendChild(row);
      });
      host.appendChild(d);
    });
  }
  function rebuildSettings() {
    var host = document.getElementById("all-settings"), open = [];
    Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) { if (d.open) open.push(d.querySelector("summary").textContent); });
    host.innerHTML = ""; renderSettings(host);
    Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) { if (open.indexOf(d.querySelector("summary").textContent) !== -1) d.open = true; });
  }

  function build() {
    var c = document.getElementById("controls");
    c.innerHTML = "";
    c.appendChild(el("h1", { text: CFG.title }));
    c.appendChild(el("p", { "class": "hint", text: CFG.hint }));

    c.appendChild(el("h2", { text: "Look and export" }));
    if (fieldDefs.themePreset) {
      var row = el("div", { "class": "row" }, [el("label", { text: "Style preset" })]);
      var sel = el("select", { id: "look-preset" });
      Object.keys(fieldDefs.themePreset.options).forEach(function (k) { sel.appendChild(el("option", { value: k, text: fieldDefs.themePreset.options[k] })); });
      sel.addEventListener("change", function () { fieldData.themePreset = sel.value; rebuildSettings(); load(); });
      row.appendChild(sel); c.appendChild(row);
      c.appendChild(el("p", { "class": "hint", text: "The same twenty-two presets are in every overlay in this set. Custom uses the colour settings below." }));
    }
    var msg = el("p", { "class": "hint", id: "export-msg" });
    c.appendChild(btn("Download fields.json", function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([exportText()], { type: "application/json" }));
      a.download = "fields.json"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      msg.textContent = "Downloaded fields.json.";
    }));
    c.appendChild(btn("Copy fields.json", function () {
      var text = exportText(), box = document.getElementById("export-text");
      var fallback = function () { box.value = text; box.select(); try { document.execCommand("copy"); msg.textContent = "Copied fields.json."; } catch (e) { msg.textContent = "Select the JSON below and copy it."; } };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { msg.textContent = "Copied fields.json."; }, fallback); else fallback();
    }));
    c.appendChild(el("p", { "class": "hint", text: "Your current settings as a fields.json for StreamElements. Paste it into the Fields tab of a new custom widget and it starts out as you see it here." }));
    c.appendChild(msg);
    var det = el("details", {}, [el("summary", { text: "Show the JSON" })]);
    det.appendChild(el("textarea", { id: "export-text", readonly: "readonly", style: "width:100%;height:110px;font-size:11px" }));
    c.appendChild(det);

    if (CFG.timeMachine) {
      c.appendChild(el("h2", { text: "Time machine" }));
      c.appendChild(el("p", { "class": "hint", text: "Skips time forward so you do not have to wait." }));
      [["+10 sec", 10000], ["+1 min", 60000], ["+10 min", 600000], ["+1 hour", 3600000]].forEach(function (x) {
        c.appendChild(btn(x[0], function () { offsetMs += x[1]; }));
      });
    }

    CFG.sections.forEach(function (sec) {
      c.appendChild(el("h2", { text: sec.title }));
      if (sec.hint) c.appendChild(el("p", { "class": "hint", text: sec.hint }));
      sec.buttons.forEach(function (b) {
        c.appendChild(btn(b.label, function () {
          if (b.kind === "player") act(b.action);
          else if (b.kind === "chat") chat(b.text, b.role || "broadcaster");
          else if (b.kind === "message") message(JSON.parse(JSON.stringify(b.message).split("{who}").join(who())));
          else if (b.kind === "bomb") {
            var gifter = who();
            se("subscriber-latest", { gifted: true, bulkGifted: true, amount: b.n, tier: "1000", sender: gifter, name: gifter });
            for (var i = 0; i < b.n; i++) se("subscriber-latest", { gifted: true, isCommunityGift: true, amount: 170, tier: "1000", sender: gifter, name: "Recipient" + i });
          } else se(b.listener, fill(b.event, who()));
        }));
      });
    });

    if (CFG.chatter) {
      c.appendChild(el("h2", { text: "Say something as a chatter" }));
      c.appendChild(el("p", { "class": "hint", text: CFG.chatter.hint }));
      var login = el("input", { type: "text", id: "chatter-login", value: CFG.chatter.login });
      var line = el("input", { type: "text", id: "chatter-text", value: CFG.chatter.text });
      c.appendChild(login); c.appendChild(line);
      // Who they are on stream: a name colour and the badges they would wear.
      var colour = el("input", { type: "color", id: "chatter-colour", value: "#FF7BAC" });
      var BADGES = { broadcaster: "5527c58c-fb7d-422d-b71b-f309dcb85cc1", moderator: "3267646d-33f0-4b17-b3df-f923a41db1d0", vip: "b817aba4-fad8-49e2-b88a-7cc744dfa6ec", subscriber: "5d9f2208-5dd8-11e7-8513-2ff4adfae661" };
      var roles = el("div", { "class": "row" }, [el("label", { text: "Name colour" }), colour]);
      c.appendChild(roles);
      var ticks = el("div", { "class": "row" }), picked = {};
      Object.keys(BADGES).forEach(function (r) {
        var box = el("input", { type: "checkbox" });
        box.addEventListener("change", function () { picked[r] = box.checked; });
        ticks.appendChild(el("label", {}, [box, document.createTextNode(" " + r)]));
      });
      c.appendChild(ticks);
      var sendAs = function (action) {
        var badges = Object.keys(picked).filter(function (r) { return picked[r]; }).map(function (r) {
          return { type: r, version: "1", description: r.charAt(0).toUpperCase() + r.slice(1), url: "https://static-cdn.jtvnw.net/badges/v1/" + BADGES[r] + "/1" };
        });
        message({ nick: login.value.replace(/^\s+|\s+$/g, ""), text: line.value, color: colour.value.toUpperCase(), badges: badges, action: action });
      };
      c.appendChild(btn("Send", function () { sendAs(false); }));
      c.appendChild(btn("Send as /me", function () { sendAs(true); }));
    }

    c.appendChild(el("h2", { text: "Chat" }));
    var box = el("input", { type: "text", id: "chat-text", value: CFG.chatDefault });
    c.appendChild(box);
    ["broadcaster", "mod", "viewer"].forEach(function (r) { c.appendChild(btn("Send as " + r, function () { chat(box.value, r); })); });

    c.appendChild(el("h2", { text: "Saved state" }));
    var pre = el("pre", { id: "state" }); c.appendChild(pre);
    c.appendChild(btn("Reset saved state", function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(PREFIX) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      offsetMs = 0; load();
    }));
    setInterval(function () {
      var s = localStorage.getItem(PREFIX + CFG.storeKey);
      pre.textContent = s ? JSON.stringify(JSON.parse(s), null, 1) : "(nothing saved yet)";
    }, 500);

    c.appendChild(el("h2", { text: "Every setting" }));
    c.appendChild(el("p", { "class": "hint", text: "Generated from widget/fields.json, so it offers exactly what StreamElements will. Changes apply at once. Buttons act as the editor buttons." }));
    var host = el("div", { id: "all-settings" }); c.appendChild(host);
    renderSettings(host);
    syncLook();
  }

  Promise.all(["../widget/widget.html", "../widget/widget.js", "../widget/fields.json"].map(function (u) {
    return fetch(u).then(function (r) { return u.slice(-5) === ".json" ? r.json() : r.text(); });
  })).then(function (res) {
    document.getElementById("stage").innerHTML = res[0];
    fieldDefs = res[2];
    Object.keys(fieldDefs).forEach(function (k) { if (fieldDefs[k].type !== "button") fieldData[k] = fieldDefs[k].value; });
    Object.keys(CFG.demo || {}).forEach(function (k) { fieldData[k] = CFG.demo[k]; });
    var s = document.createElement("script"); s.textContent = res[1]; document.body.appendChild(s);
    build();
    load();
  });
}());
