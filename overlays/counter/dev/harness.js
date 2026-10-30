/* Local stand-in for StreamElements. Loads the widget files, mocks SE_API.store on
   localStorage, and lets you fire the same events StreamElements would send. */
(function () {
  "use strict";
  var CFG = {
  "title": "Chat Counter Overlay",
  "hint": "Change the counter with chat commands, and try the settings below.",
  "store": "counter",
  "storeKey": "counter_v1",
  "timeMachine": false,
  "sections": [
    {
      "title": "Quick commands",
      "hint": "Sent as the broadcaster.",
      "buttons": [
        {
          "label": "!count +1",
          "kind": "chat",
          "text": "!count +1"
        },
        {
          "label": "!count -1",
          "kind": "chat",
          "text": "!count -1"
        },
        {
          "label": "!count +5",
          "kind": "chat",
          "text": "!count +5"
        },
        {
          "label": "!count -5",
          "kind": "chat",
          "text": "!count -5"
        },
        {
          "label": "!count set 50",
          "kind": "chat",
          "text": "!count set 50"
        },
        {
          "label": "!count undo",
          "kind": "chat",
          "text": "!count undo"
        },
        {
          "label": "!count reset",
          "kind": "chat",
          "text": "!count reset"
        },
        {
          "label": "!count lock",
          "kind": "chat",
          "text": "!count lock"
        },
        {
          "label": "!count unlock",
          "kind": "chat",
          "text": "!count unlock"
        },
        {
          "label": "!count",
          "kind": "chat",
          "text": "!count"
        }
      ]
    }
  ],
  "chatDefault": "!count +1"
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

  var fieldDefs = {}, fieldData = {};
  function fire(type, detail) { window.dispatchEvent(new CustomEvent(type, { detail: detail })); }
  function se(listener, event) { fire("onEventReceived", { listener: listener, event: event }); }
  function chat(text, role) {
    var badges = role === "broadcaster" ? [{ type: "broadcaster" }] : role === "mod" ? [{ type: "moderator" }] : [];
    se("message", { data: { text: text, nick: "tester", displayName: "Tester", badges: badges, tags: { mod: role === "mod" ? "1" : "0" } } });
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
      c.appendChild(el("p", { "class": "hint", text: "The same twenty-one presets are in every overlay in this set. Custom uses the colour settings below." }));
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
          if (b.kind === "chat") chat(b.text, b.role || "broadcaster");
          else if (b.kind === "bomb") {
            var gifter = who();
            se("subscriber-latest", { gifted: true, bulkGifted: true, amount: b.n, tier: "1000", sender: gifter, name: gifter });
            for (var i = 0; i < b.n; i++) se("subscriber-latest", { gifted: true, isCommunityGift: true, amount: 170, tier: "1000", sender: gifter, name: "Recipient" + i });
          } else se(b.listener, fill(b.event, who()));
        }));
      });
    });

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
    var s = document.createElement("script"); s.textContent = res[1]; document.body.appendChild(s);
    build();
    load();
  });
}());
