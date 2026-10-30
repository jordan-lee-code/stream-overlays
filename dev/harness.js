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

  function load() { fire("onWidgetLoad", { fieldData: fieldData, channel: { username: "tester" } }); }

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
      c.appendChild(d);
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
