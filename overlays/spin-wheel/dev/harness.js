/* Local dev harness for the Spinning Wheel widget.
 *
 * It mocks the small slice of the StreamElements runtime the widget depends on
 * (the SE_API.store and the onWidgetLoad / onEventReceived custom events) so the
 * exact widget files in ../widget can be driven in a plain browser. Serve the
 * project root over http (e.g. `python3 -m http.server`) and open /dev/. */
(function () {
  "use strict";

  // ---- mock SE_API: store backed by localStorage ----
  window.SE_API = {
    store: {
      set: function (k, v) {
        try { localStorage.setItem("se_" + k, JSON.stringify(v)); } catch (e) {}
        return Promise.resolve();
      },
      get: function (k) {
        try { return Promise.resolve(JSON.parse(localStorage.getItem("se_" + k))); }
        catch (e) { return Promise.resolve(null); }
      }
    }
  };

  var fieldData = {};
  var fieldDefs = {};

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.body.appendChild(s);
    });
  }

  function buildFieldData(defs) {
    var out = {};
    Object.keys(defs).forEach(function (k) {
      if (defs[k] && defs[k].type !== "button") out[k] = defs[k].value;
    });
    return out;
  }

  function dispatchLoad() {
    window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: fieldData } }));
    syncLook();
  }

  // ---- Look and export: switch style presets quickly, and carry the settings to StreamElements ----
  // StreamElements takes each setting's starting value from `value` in fields.json, so the
  // export is fields.json with the current values filled in. Pasted into the Fields tab of a
  // new widget, it starts out looking the way it does here. (A widget that already has saved
  // settings keeps them, so use a new copy of the widget, or set the values by hand.)
  function exportText() {
    var out = {};
    Object.keys(fieldDefs).forEach(function (k) {
      var d = JSON.parse(JSON.stringify(fieldDefs[k]));
      // Test beeps are made up by this page, so a sound keeps its own default.
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
  function rebuildSettings() {
    var host = document.getElementById("all-settings");
    var open = [];
    Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) {
      if (d.open) open.push(d.querySelector("summary").textContent);
    });
    host.innerHTML = "";
    buildSettings(host);
    Array.prototype.forEach.call(host.querySelectorAll("details"), function (d) {
      if (open.indexOf(d.querySelector("summary").textContent) !== -1) d.open = true;
    });
  }
  function buildLook(host) {
    var def = fieldDefs.themePreset;
    host.innerHTML =
      (def ? '<div class="row"><label for="look-preset">Style preset</label> <select id="look-preset"></select></div>' +
        '<p class="hint">The same twenty-one presets are in every overlay in this set. Custom uses the colour settings below.</p>' : '') +
      '<div class="row"><button id="export-download" class="go">Download fields.json</button>' +
      '<button id="export-copy" class="alt">Copy fields.json</button></div>' +
      '<p class="hint">Your current settings as a fields.json for StreamElements. Paste it into the Fields tab of a new custom widget and it starts out as you see it here.</p>' +
      '<p id="export-msg" class="hint"></p>' +
      '<details><summary>Show the JSON</summary><textarea id="export-text" readonly style="width:100%;height:110px;font-size:11px"></textarea></details>';
    var sel = document.getElementById("look-preset");
    if (sel) {
      Object.keys(def.options || {}).forEach(function (k) {
        var o = document.createElement("option"); o.value = k; o.textContent = def.options[k]; sel.appendChild(o);
      });
      sel.onchange = function () { fieldData.themePreset = sel.value; rebuildSettings(); dispatchLoad(); };
    }
    function say(t) { document.getElementById("export-msg").textContent = t; }
    document.getElementById("export-download").onclick = function () {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([exportText()], { type: "application/json" }));
      a.download = "fields.json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      say("Downloaded fields.json.");
    };
    document.getElementById("export-copy").onclick = function () {
      var text = exportText();
      var fallback = function () {
        var box = document.getElementById("export-text");
        box.value = text; box.select();
        try { document.execCommand("copy"); say("Copied fields.json."); } catch (e) { say("Select the JSON below and copy it."); }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { say("Copied fields.json."); }, fallback);
      } else fallback();
    };
    syncLook();
  }


  function sendChat(text, opts) {
    opts = opts || {};
    var badges = [];
    if (opts.broadcaster) badges.push({ type: "broadcaster", version: "1" });
    if (opts.mod) badges.push({ type: "moderator", version: "1" });
    if (opts.sub) badges.push({ type: "subscriber", version: "1" });
    if (opts.vip) badges.push({ type: "vip", version: "1" });
    var nick = (opts.nick || "viewer").toLowerCase();
    var data = {
      text: text,
      nick: nick,
      displayName: opts.nick || "Viewer",
      badges: badges,
      color: opts.color || "",
      tags: {
        mod: opts.mod ? "1" : "0",
        subscriber: opts.sub ? "1" : "0",
        vip: opts.vip ? "1" : "0",
        color: opts.color || ""
      }
    };
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "message", event: { data: data } }
    }));
  }

  function sendEvent(listener, event) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: listener, event: event || {} }
    }));
  }

  function sendButton(field) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "widget-button", event: { field: field } }
    }));
  }

  var NAMES = ["GenerousViewer", "Marigold", "Sunny", "Pebble", "Clover", "Hazel", "Cosmo",
    "Juniper", "Saffron", "Bramble", "Poppy", "Indigo", "Fern", "Maple", "Wren",
    "Otter", "Dewdrop", "Basil", "Coral", "Sage", "Briar", "Tansy"];

  var CHAT_COLORS = ["#FF4500", "#1E90FF", "#2E8B57", "#9146FF", "#FF69B4", "#DAA520", "#00CED1", "#B22222"];
  var QUESTIONS = [
    "What is your most controversial food opinion?",
    "Who in chat would you trust with your phone unlocked?",
    "Confess a small crime you got away with.",
    "What is a hill you will absolutely die on?",
    "What is the last thing you searched that you would not want read aloud?",
    "Which streamer would you most want to collab with, and why?",
    "What is the pettiest reason you have unfollowed someone?"
  ];
  function askRandom() {
    var name = NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(Math.random() * 900 + 10);
    var q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    sendChat((fieldData.askCommand || "!spin ask") + " " + q, {
      nick: name,
      color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)]
    });
  }
  function addRandomEntrants(n) {
    for (var i = 0; i < n; i++) {
      var name = NAMES[Math.floor(Math.random() * NAMES.length)] + Math.floor(Math.random() * 900 + 10);
      var roll = Math.random();
      sendChat(fieldData.enterCommand || "!spin", {
        nick: name,
        sub: roll > 0.6,
        vip: roll > 0.9,
        color: CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)]
      });
    }
  }

  // A short sine beep as a data: URL, so a sound field can be filled in locally
  // without any audio file. Each sound gets its own pitch to tell them apart.
  var BEEP_HZ = { enterSound: 784, tickSound: 1319, winSound: 1047 };
  function makeBeep(hz) {
    var rate = 22050, ms = 260, n = Math.round(rate * ms / 1000);
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var w = function (o, str) { for (var i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
    v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (var i = 0; i < n; i++) {
      var fade = Math.min(1, i / 400, (n - i) / 2500);
      v.setInt16(44 + i * 2, Math.round(Math.sin(2 * Math.PI * hz * i / rate) * 12000 * fade), true);
    }
    var bin = "", bytes = new Uint8Array(buf);
    for (var j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
    return "data:audio/wav;base64," + btoa(bin);
  }

  // One control per field in fields.json, grouped as StreamElements groups them, so
  // every customisation can be tried here before it is relied on. Changing a value
  // re-applies the widget; a button sends the same widget-button event StreamElements does.
  function buildSettings(host) {
    var groups = {};
    var order = [];
    Object.keys(fieldDefs).forEach(function (key) {
      var def = fieldDefs[key];
      var g = def.group || "Other";
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(key);
    });

    order.forEach(function (g) {
      var box = document.createElement("details");
      var sum = document.createElement("summary");
      sum.textContent = g;
      box.appendChild(sum);

      groups[g].forEach(function (key) {
        var def = fieldDefs[key];
        var row = document.createElement("div");
        row.className = "field";
        var label = document.createElement("label");
        label.textContent = def.label || key;
        var input;
        // The current value, not the default, so the panel can be rebuilt after a preset switch.
        var cur = fieldData.hasOwnProperty(key) ? fieldData[key] : def.value;

        if (def.type === "button") {
          input = document.createElement("button");
          input.className = "alt";
          input.textContent = def.value || key;
          input.onclick = function () { sendButton(key); };
          row.appendChild(label);
          row.appendChild(input);
          box.appendChild(row);
          return;
        }

        if (def.type === "dropdown") {
          input = document.createElement("select");
          Object.keys(def.options || {}).forEach(function (k) {
            var o = document.createElement("option");
            o.value = k; o.textContent = def.options[k];
            input.appendChild(o);
          });
          input.value = cur;
        } else if (def.type === "checkbox") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!cur;
        } else if (def.type === "sound-input") {
          // No file upload here: paste a URL, or use a generated test beep so the
          // sounds can be tried with nothing to hand.
          input = document.createElement("input");
          input.type = "text";
          input.value = cur || "";
          input.placeholder = "paste a sound URL";
          var beep = document.createElement("button");
          beep.className = "alt";
          beep.textContent = "Use a test beep";
          beep.onclick = function () {
            input.value = makeBeep(BEEP_HZ[key] || 800);
            fieldData[key] = input.value;
            dispatchLoad();
          };
          row.appendChild(label);
          row.appendChild(input);
          row.appendChild(beep);
          input.onchange = function () { fieldData[key] = input.value; dispatchLoad(); };
          box.appendChild(row);
          return;
        } else if (def.type === "colorpicker") {
          input = document.createElement("input");
          input.type = "color";
          input.value = String(cur).toLowerCase();
        } else if (def.type === "number") {
          input = document.createElement("input");
          input.type = "number";
          ["min", "max", "step"].forEach(function (a) { if (def[a] !== undefined) input[a] = def[a]; });
          input.value = cur;
        } else {
          input = document.createElement("input");
          input.type = "text";
          input.value = cur;
        }

        input.onchange = function () {
          if (def.type === "checkbox") fieldData[key] = input.checked;
          else if (def.type === "number") fieldData[key] = input.value === "" ? cur : parseFloat(input.value);
          else fieldData[key] = input.value;
          dispatchLoad();
        };

        if (def.type === "checkbox") { row.className += " check"; row.appendChild(input); row.appendChild(label); }
        else { row.appendChild(label); row.appendChild(input); }
        box.appendChild(row);
      });

      host.appendChild(box);
    });
  }

  // ---- controls UI ----
  function buildControls() {
    var c = document.getElementById("controls");
    c.innerHTML =
      '<h2>Send chat</h2>' +
      '<div class="row">' +
        '<input id="chat-user" type="text" value="Viewer" placeholder="username">' +
        '<input id="chat-color" type="color" value="#9146ff" title="chat colour">' +
        '<input id="chat-text" type="text" value="!spin" placeholder="message / command">' +
      '</div>' +
      '<div class="row">' +
        '<label><input type="checkbox" id="r-broadcaster"> broadcaster</label>' +
        '<label><input type="checkbox" id="r-mod"> mod</label>' +
        '<label><input type="checkbox" id="r-sub"> sub</label>' +
        '<label><input type="checkbox" id="r-vip"> vip</label>' +
      '</div>' +
      '<div class="row"><button id="send-chat" class="go">Send message</button></div>' +
      '<p class="hint">Try !spin, then !spin go as broadcaster. Mod commands: !spin open, !spin close, !spin clear, !spin remove name, !spin mode forfeits.</p>' +

      '<h2>Quick entrants</h2>' +
      '<div class="row">' +
        '<button class="alt" data-add="1">+1</button>' +
        '<button class="alt" data-add="5">+5</button>' +
        '<button class="alt" data-add="20">+20</button>' +
      '</div>' +

      '<h2>Streamer actions</h2>' +
      '<div class="row">' +
        '<button data-btn="btnSpin" class="go">Spin</button>' +
        '<button id="spin3" class="go">Spin 3</button>' +
        '<button data-btn="btnReroll" class="alt">Re-roll</button>' +
        '<button data-btn="btnLastWinner" class="alt">Last winner</button>' +
      '</div>' +
      '<div class="row">' +
        '<button data-btn="btnOpen" class="alt">Open</button>' +
        '<button data-btn="btnClose" class="alt">Close</button>' +
        '<button data-btn="btnClear" class="alt">Clear</button>' +
        '<button data-btn="btnMode" class="alt">Switch mode</button>' +
      '</div>' +

      '<h2>Goal events</h2>' +
      '<div class="row">' +
        '<button data-ev="subscriber-latest" data-amt="1" class="alt">+1 sub</button>' +
        '<button data-ev="follower-latest" data-amt="1" class="alt">+1 follow</button>' +
        '<button data-ev="cheer-latest" data-amt="100" class="alt">+100 bits</button>' +
        '<button data-ev="tip-latest" data-amt="5" class="alt">+5 tip</button>' +
      '</div>' +

      '<h2>Truth or...</h2>' +
      '<div class="row">' +
        '<button id="ask-random" class="alt">Ask (random)</button>' +
        '<button data-btn="btnVeto" class="go">Veto</button>' +
        '<button data-btn="btnStrike" class="alt">Strike</button>' +
        '<button data-btn="btnResetLives" class="alt">Reset lives</button>' +
      '</div>' +
      '<p class="hint">Switch the wheel to Truth or... first (Switch mode, or the mode setting below). Chatters use !spin ask your question.</p>' +

      '<h2>Forfeits</h2>' +
      '<div class="row">' +
        '<input id="forfeit-text" type="text" value="Karaoke hour" placeholder="forfeit name">' +
        '<button id="forfeit-add" class="alt">Add</button>' +
        '<button id="forfeit-remove" class="alt">Remove</button>' +
        '<button data-btn="btnForfeitClear" class="alt">Clear</button>' +
      '</div>' +
      '<p class="hint">Switch to Forfeits mode first. The bits/sub/donation trigger below auto-spins whatever mode is active.</p>' +

      '<div class="divider"></div>' +
      '<h2>Look and export</h2>' +
      '<div id="look-panel"></div>' +

      '<h2>Every setting (re-applies on change)</h2>' +
      '<p class="hint">Generated from <code>fields.json</code>, so it is exactly what StreamElements will offer. Buttons here are the Manual controls.</p>' +
      '<div id="all-settings"></div>' +

      '<div class="divider"></div>' +
      '<div class="row"><button id="reset-store" class="alt">Reset saved state</button></div>' +
      '<p class="hint">Reset clears persisted entries, then reloads so you start clean.</p>';

    function opts() {
      return {
        nick: document.getElementById("chat-user").value || "Viewer",
        color: document.getElementById("chat-color").value,
        broadcaster: document.getElementById("r-broadcaster").checked,
        mod: document.getElementById("r-mod").checked,
        sub: document.getElementById("r-sub").checked,
        vip: document.getElementById("r-vip").checked
      };
    }

    document.getElementById("send-chat").onclick = function () {
      sendChat(document.getElementById("chat-text").value, opts());
    };
    document.getElementById("spin3").onclick = function () {
      sendChat((fieldData.spinCommand || "!spin go") + " 3", { nick: "Streamer", broadcaster: true });
    };
    document.getElementById("ask-random").onclick = askRandom;
    document.getElementById("forfeit-add").onclick = function () {
      sendChat((fieldData.forfeitAddCommand || "!spin forfeit add") + " " + document.getElementById("forfeit-text").value, { nick: "Streamer", broadcaster: true });
    };
    document.getElementById("forfeit-remove").onclick = function () {
      sendChat((fieldData.forfeitRemoveCommand || "!spin forfeit remove") + " " + document.getElementById("forfeit-text").value, { nick: "Streamer", broadcaster: true });
    };
    document.getElementById("chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat(this.value, opts());
    });

    c.querySelectorAll("[data-add]").forEach(function (b) {
      b.onclick = function () { addRandomEntrants(parseInt(b.getAttribute("data-add"), 10)); };
    });
    c.querySelectorAll("[data-btn]").forEach(function (b) {
      b.onclick = function () { sendButton(b.getAttribute("data-btn")); };
    });
    c.querySelectorAll("[data-ev]").forEach(function (b) {
      b.onclick = function () {
        sendEvent(b.getAttribute("data-ev"), { amount: parseFloat(b.getAttribute("data-amt")) });
      };
    });

    buildSettings(document.getElementById("all-settings"));
    buildLook(document.getElementById("look-panel"));

    document.getElementById("reset-store").onclick = function () {
      try { localStorage.removeItem("se_spin_wheel_v1"); } catch (e) {}
      location.reload();
    };
  }


  // ---- boot ----
  Promise.all([
    fetch("../widget/widget.html").then(function (r) { return r.text(); }),
    fetch("../widget/fields.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    document.getElementById("stage").innerHTML = res[0];
    fieldDefs = res[1];
    fieldData = buildFieldData(fieldDefs);
    return loadScript("../widget/widget.js");
  }).then(function () {
    buildControls();
    dispatchLoad();
  }).catch(function (err) {
    document.getElementById("controls").innerHTML =
      '<p style="color:#b00">Failed to load widget files. Serve the project root over http ' +
      'and open /dev/ (not file://). ' + String(err) + '</p>';
  });
})();
