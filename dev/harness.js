/* Local stand-in for StreamElements. Loads the built widget/ files, mocks SE_API.store on
   localStorage, and lets you fire the same events StreamElements would send. It also has a
   time machine: StreamElements cannot do that, but a 200 hour subathon is not something to
   wait through to see the cap work. */
(function () {
  "use strict";
  var PREFIX = "se_subathon_";
  var offsetMs = 0;
  var realNow = Date.now.bind(Date);
  Date.now = function () { return realNow() + offsetMs; };

  window.SE_API = {
    store: {
      set: function (k, v) { localStorage.setItem(PREFIX + k, JSON.stringify(v)); return Promise.resolve(); },
      get: function (k) { var s = localStorage.getItem(PREFIX + k); return Promise.resolve(s ? JSON.parse(s) : null); }
    }
  };

  var fieldDefs = {}, fieldData = {};
  function fire(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail: detail })); }
  function se(listener, event) { fire("onEventReceived", { listener: listener, event: event }); }
  function chat(text, role) {
    var badges = role === "broadcaster" ? [{ type: "broadcaster" }] : role === "mod" ? [{ type: "moderator" }] : [];
    se("message", { data: { text: text, nick: "tester", displayName: "Tester", badges: badges, tags: { mod: role === "mod" ? "1" : "0" } } });
  }
  var names = ["Alice", "Bea", "Cass", "Dev", "Eli", "Fern", "Gus", "Hana"];
  var n = 0; function who() { return names[n++ % names.length]; }

  function load() { fire("onWidgetLoad", { fieldData: fieldData, channel: { username: "tester" } }); syncLook(); }

  // StreamElements takes each setting's starting value from `value` in fields.json, so the
  // export is fields.json with the current values filled in. A widget that already has saved
  // settings keeps them, so paste it into a new custom widget.
  function exportText() {
    var out = {};
    Object.keys(fieldDefs).forEach(function (k) {
      var d = JSON.parse(JSON.stringify(fieldDefs[k]));
      if (d.type !== "button" && d.type !== "sound-input" && fieldData.hasOwnProperty(k)) d.value = fieldData[k];
      out[k] = d;
    });
    return JSON.stringify(out, null, 2) + "\n";
  }
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

  function build() {
    var c = document.getElementById("controls");
    c.innerHTML = "";
    c.appendChild(el("h1", { text: "Subathon Overlay" }));
    c.appendChild(el("p", { "class": "hint", text: "Fire the events StreamElements would send, and watch the clock and goals respond." }));

    c.appendChild(el("h2", { text: "Look and export" }));
    if (fieldDefs.themePreset) {
      var row = el("div", { "class": "row" }, [el("label", { text: "Style preset" })]);
      var sel = el("select", { id: "look-preset" });
      Object.keys(fieldDefs.themePreset.options).forEach(function (k) { sel.appendChild(el("option", { value: k, text: fieldDefs.themePreset.options[k] })); });
      sel.addEventListener("change", function () {
        fieldData.themePreset = sel.value;
        var host = document.getElementById("all-settings");
        var open = [];
        Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) { if (d.open) open.push(d.querySelector("summary").textContent); });
        host.innerHTML = ""; renderSettings(host);
        Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) { if (open.indexOf(d.querySelector("summary").textContent) !== -1) d.open = true; });
        load();
      });
      row.appendChild(sel); c.appendChild(row);
      c.appendChild(el("p", { "class": "hint", text: "The same twelve presets are in every overlay in this set, and one choice styles the clock and the goals together. Custom uses the colour settings below." }));
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
    var ta = el("textarea", { id: "export-text", readonly: "readonly", style: "width:100%;height:110px;font-size:11px" });
    det.appendChild(ta); c.appendChild(det);
    syncLook();

    c.appendChild(el("h2", { text: "Time machine" }));
    c.appendChild(el("p", { "class": "hint", text: "Skips the clock forward so you do not have to wait. Resume the clock first." }));
    [["+1 min", 60000], ["+10 min", 600000], ["+1 hour", 3600000], ["+10 hours", 36000000]].forEach(function (x) {
      c.appendChild(btn(x[0], function () { offsetMs += x[1]; }));
    });

    c.appendChild(el("h2", { text: "Events" }));
    c.appendChild(btn("New sub", function () { se("subscriber-latest", { amount: 1, tier: "1000", name: who() }); }));
    c.appendChild(btn("Tier 2", function () { se("subscriber-latest", { amount: 1, tier: "2000", name: who() }); }));
    c.appendChild(btn("Tier 3", function () { se("subscriber-latest", { amount: 1, tier: "3000", name: who() }); }));
    c.appendChild(btn("Resub (6 months)", function () { se("subscriber-latest", { amount: 6, tier: "1000", name: who() }); }));
    c.appendChild(btn("Gifted sub", function () { se("subscriber-latest", { gifted: true, amount: 1, tier: "1000", sender: who() }); }));
    [5, 10, 30].forEach(function (k) {
      c.appendChild(btn("Gift bomb " + k, function () {
        var gifter = who();
        se("subscriber-latest", { gifted: true, bulkGifted: true, amount: k, tier: "1000", sender: gifter });
        for (var i = 0; i < k; i++) se("subscriber-latest", { gifted: true, isCommunityGift: true, amount: 170, tier: "1000", sender: gifter });
      }));
    });
    [100, 500, 1000].forEach(function (k) { c.appendChild(btn(k + " bits", function () { se("cheer-latest", { amount: k, name: who() }); })); });
    c.appendChild(btn("5 tip", function () { se("tip-latest", { amount: 5, name: who() }); }));
    c.appendChild(btn("Follow", function () { se("follower-latest", { name: who() }); }));
    c.appendChild(btn("Raid", function () { se("raid-latest", { name: who(), amount: 40 }); }));

    c.appendChild(el("h2", { text: "Chat" }));
    var box = el("input", { type: "text", id: "chat-text", value: "!subathon add 1h" });
    c.appendChild(box);
    ["broadcaster", "mod", "viewer"].forEach(function (r) { c.appendChild(btn("Send as " + r, function () { chat(box.value, r); })); });
    c.appendChild(el("p", { "class": "hint", text: "Quick commands:" }));
    ["!subathon pause", "!subathon resume", "!subathon add 30m", "!subathon subtract 10m", "!subathon powerup 2 30m", "!subathon powerup off",
      "!subathon sleep", "!subathon wake", "!subathon lock", "!subathon unlock", "!subathon release",
      "!incentive add 5 karaoke", "!incentive add 10 play a game", "!incentive add 15 chat confessions", "!incentive stop", "!incentive start"
    ].forEach(function (t) { c.appendChild(btn(t, function () { chat(t, "broadcaster"); })); });

    c.appendChild(el("h2", { text: "Saved state" }));
    var pre = el("pre", { id: "state" }); c.appendChild(pre);
    c.appendChild(btn("Reset saved state", function () {
      Object.keys(localStorage).filter(function (k) { return k.indexOf(PREFIX) === 0; }).forEach(function (k) { localStorage.removeItem(k); });
      offsetMs = 0; load();
    }));
    setInterval(function () {
      var s = localStorage.getItem(PREFIX + "subathon_v1");
      pre.textContent = s ? JSON.stringify(JSON.parse(s), null, 1) : "(nothing saved yet)";
    }, 500);

    c.appendChild(el("h2", { text: "Every setting" }));
    c.appendChild(el("p", { "class": "hint", text: "Generated from widget/fields.json, so it offers exactly what StreamElements will. Changes apply at once. Buttons act as the editor buttons." }));
    var settingsHost = el("div", { id: "all-settings" });
    c.appendChild(settingsHost);
    renderSettings(settingsHost);
  }

  function renderSettings(host) {
    var groups = {};
    Object.keys(fieldDefs).forEach(function (k) { var g = fieldDefs[k].group || "Other"; (groups[g] = groups[g] || []).push(k); });
    Object.keys(groups).forEach(function (g) {
      var d = el("details", {}, [el("summary", { text: g })]);
      groups[g].forEach(function (k) {
        var f = fieldDefs[k], row = el("div", { "class": "row" });
        if (f.type === "button") {
          row.appendChild(btn(f.label || k, function () { se("widget-button", { field: k }); }));
        } else {
          row.appendChild(el("label", { text: f.label || k }));
          var input;
          if (f.type === "dropdown") {
            input = el("select");
            Object.keys(f.options || {}).forEach(function (o) { var op = el("option", { value: o, text: f.options[o] }); if (String(fieldData[k]) === o) op.selected = true; input.appendChild(op); });
          } else if (f.type === "checkbox") {
            input = el("input", { type: "checkbox" }); input.checked = !!fieldData[k];
          } else if (f.type === "colorpicker") {
            input = el("input", { type: "text" }); input.value = fieldData[k];
          } else if (f.type === "number" || f.type === "slider") {
            input = el("input", { type: "number" }); input.value = fieldData[k];
            if (f.step !== undefined) input.step = f.step;
          } else {
            input = el("input", { type: "text" }); input.value = fieldData[k] === undefined ? "" : fieldData[k];
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

  Promise.all(["../widget/widget.html", "../widget/widget.js", "../widget/fields.json"].map(function (u) {
    return fetch(u).then(function (r) { return u.slice(-5) === ".json" ? r.json() : r.text(); });
  })).then(function (res) {
    document.getElementById("stage").innerHTML = res[0];
    fieldDefs = res[2];
    Object.keys(fieldDefs).forEach(function (k) { if (fieldDefs[k].type !== "button") fieldData[k] = fieldDefs[k].value; });
    var s = document.createElement("script"); s.textContent = res[1]; document.body.appendChild(s);
    build();
    load();
  });
}());
