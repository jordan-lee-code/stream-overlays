/* Local dev harness for the Sub Incentives widget.
 *
 * It mocks the small slice of the StreamElements runtime the widget depends on
 * (SE_API.store and the onWidgetLoad / onEventReceived custom events) so the exact
 * widget files in ../widget can be driven in a plain browser. Serve the project
 * root over http (e.g. `python3 -m http.server`) and open /dev/. */
(function () {
  "use strict";

  var STORE_KEY = "se_sub_goals_v1";

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
      s.src = src; s.onload = resolve; s.onerror = reject;
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
  // The copy panel (copy-panel.js) reads the settings as they are configured here through this.
  window.__exportFields = exportText;
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
        '<p class="hint">The same twenty-two presets are in every overlay in this set. Custom uses the colour settings below.</p>' : '') +
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
    var data = {
      text: text,
      nick: (opts.nick || "viewer").toLowerCase(),
      displayName: opts.nick || "Viewer",
      badges: badges,
      tags: { mod: opts.mod ? "1" : "0" }
    };
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "message", event: { data: data } }
    }));
  }

  function subEvent(event) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "subscriber-latest", event: event }
    }));
  }

  // Reproduce a real community gift the way StreamElements delivers it: the bomb
  // announcement (amount = subs gifted), then one follow-up per recipient carrying
  // the gifter's streak/total in `amount`. A correct counter moves only for the
  // bomb; the follow-ups are the ones that would otherwise inflate it by 170 each.
  function sendGift(count) {
    count = Math.max(0, Math.round(count) || 0);
    subEvent({ gifted: true, bulkGifted: true, amount: count, sender: "GenerousViewer" });
    for (var i = 0; i < count; i++) {
      subEvent({ gifted: true, isCommunityGift: true, amount: 170, sender: "GenerousViewer", name: "recipient" + i });
    }
  }

  function sendSingleGift() {
    subEvent({ gifted: true, amount: 3, sender: "GenerousViewer", name: "Target" });
  }
  function sendCheer(bits) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "cheer-latest", event: { amount: bits, name: "Cheerer", message: "cheer" + bits } }
    }));
  }
  function sendTip(amount) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "tip-latest", event: { amount: amount, name: "Tipper", currency: "USD" } }
    }));
  }
  function sendNewSub() {
    subEvent({ amount: 1, tier: "1000", name: "NewViewer" });
  }
  function sendResub() {
    subEvent({ amount: 6, tier: "1000", name: "LoyalViewer" });
  }

  function sendButton(field) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "widget-button", event: { field: field } }
    }));
  }

  // A short sine beep as a data: URL, so a sound field can be filled in locally
  // without any audio file. Each sound gets its own pitch to tell them apart.
  var BEEP_HZ = { subSound: 784, bitsSound: 587, goalSound: 1047 };
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
      '<h2>Subs arriving</h2>' +
      '<div class="row">' +
        '<button id="sub-new" class="go">New sub</button>' +
        '<button id="sub-resub" class="alt">Resub (6 months)</button>' +
        '<button id="sub-single" class="alt">Gift 1 (targeted)</button>' +
      '</div>' +
      '<div class="row">' +
        '<label>Gift a bomb of <input id="gift-amount" type="number" min="1" value="5" style="width:70px"></label>' +
        '<button id="gift-send" class="go">Gift subs</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-gift="3">Gift 3</button>' +
        '<button class="alt" data-gift="5">Gift 5</button>' +
        '<button class="alt" data-gift="10">Gift 10</button>' +
        '<button class="alt" data-gift="20">Gift 20</button>' +
      '</div>' +
      '<p class="hint">A bomb fires the real StreamElements shape: the announcement, then one ' +
      'follow-up per recipient with a streak of 170 in the same field. The total should move by ' +
      'exactly the bomb size. If it ever jumps by 170, a follow-up has sneaked in.</p>' +

      '<h2>Bits</h2>' +
      '<div class="row">' +
        '<label>Cheer <input id="bits-amount" type="number" min="1" value="500" style="width:80px"> bits</label>' +
        '<button id="bits-send" class="go">Cheer</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-bits="100">100</button>' +
        '<button class="alt" data-bits="300">300</button>' +
        '<button class="alt" data-bits="500">500</button>' +
        '<button class="alt" data-bits="1000">1000</button>' +
      '</div>' +
      '<p class="hint">500 bits is one sub by default. Smaller cheers are remembered and add up, ' +
      'so two cheers of 300 make one sub with 100 left over.</p>' +

      '<h2>Tips</h2>' +
      '<div class="row">' +
        '<label>Tip <input id="tip-amount" type="number" min="0.01" step="0.01" value="5" style="width:80px"></label>' +
        '<button id="tip-send" class="go">Tip</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-tip="2">2</button>' +
        '<button class="alt" data-tip="3">3</button>' +
        '<button class="alt" data-tip="5">5</button>' +
        '<button class="alt" data-tip="10">10</button>' +
      '</div>' +
      '<p class="hint">5 is one sub by default. Smaller tips are remembered and add up, ' +
      'so a 3 and then another 3 make one sub with 1 left over.</p>' +

      '<h2>Chat commands</h2>' +
      '<div class="row">' +
        '<input id="chat-user" type="text" value="Streamer" placeholder="username">' +
        '<input id="chat-text" type="text" value="!incentive add 15 chat confessions" placeholder="command">' +
      '</div>' +
      '<div class="row">' +
        '<label><input type="checkbox" id="r-broadcaster" checked> broadcaster</label>' +
        '<label><input type="checkbox" id="r-mod"> mod</label>' +
      '</div>' +
      '<div class="row"><button id="send-chat" class="go">Send message</button></div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!incentive add 5 karaoke">add 5 karaoke</button>' +
        '<button class="alt" data-cmd="!incentive add 10 playing a game">add 10 game</button>' +
        '<button class="alt" data-cmd="!incentive add 15 chat confessions">add 15 confessions</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!incentive remove 1">remove 1</button>' +
        '<button class="alt" data-cmd="!incentive remove game">remove game</button>' +
        '<button class="alt" data-cmd="!incentive list">list</button>' +
        '<button class="alt" data-cmd="!incentive clear">clear</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!incentive subs +1">subs +1</button>' +
        '<button class="alt" data-cmd="!incentive subs -1">subs -1</button>' +
        '<button class="alt" data-cmd="!incentive subs set 4">subs set 4</button>' +
        '<button class="alt" data-cmd="!incentive bits +300">bits +300</button>' +
        '<button class="alt" data-cmd="!incentive tip 5">tip 5</button>' +
        '<button class="alt" data-cmd="!incentive reset">reset</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!incentive start">start</button>' +
        '<button class="alt" data-cmd="!incentive stop">stop</button>' +
      '</div>'+
      '<p class="hint">The quick buttons send as the broadcaster. Untick broadcaster and tick mod (or neither) to feel the permissions.</p>' +

      '<h2>Look and export</h2>' +
      '<div id="look-panel"></div>' +

      '<h2>Every setting (re-applies on change)</h2>' +
      '<p class="hint">Generated from <code>fields.json</code>, so it is exactly what StreamElements will offer. Buttons here are the Manual controls.</p>' +
      '<div id="all-settings"></div>' +

      '<h2>What the widget is holding</h2>' +
      '<pre id="state">(loading)</pre>' +
      '<div class="divider"></div>' +
      '<div class="row"><button id="reset-store" class="alt">Reset saved state</button></div>' +
      '<p class="hint">Reset clears the persisted goals and count, then reloads so you start clean.</p>';

    function opts() {
      return {
        nick: document.getElementById("chat-user").value || "Viewer",
        broadcaster: document.getElementById("r-broadcaster").checked,
        mod: document.getElementById("r-mod").checked
      };
    }

    document.getElementById("sub-new").onclick = sendNewSub;
    document.getElementById("sub-resub").onclick = sendResub;
    document.getElementById("sub-single").onclick = sendSingleGift;
    document.getElementById("gift-send").onclick = function () {
      sendGift(parseInt(document.getElementById("gift-amount").value, 10) || 0);
    };
    document.getElementById("send-chat").onclick = function () {
      sendChat(document.getElementById("chat-text").value, opts());
    };
    document.getElementById("chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat(this.value, opts());
    });

    document.getElementById("tip-send").onclick = function () {
      sendTip(parseFloat(document.getElementById("tip-amount").value) || 0);
    };
    c.querySelectorAll("[data-tip]").forEach(function (b) {
      b.onclick = function () { sendTip(parseFloat(b.getAttribute("data-tip"))); };
    });
    document.getElementById("bits-send").onclick = function () {
      sendCheer(parseInt(document.getElementById("bits-amount").value, 10) || 0);
    };
    c.querySelectorAll("[data-bits]").forEach(function (b) {
      b.onclick = function () { sendCheer(parseInt(b.getAttribute("data-bits"), 10)); };
    });
    c.querySelectorAll("[data-gift]").forEach(function (b) {
      b.onclick = function () { sendGift(parseInt(b.getAttribute("data-gift"), 10)); };
    });
    c.querySelectorAll("[data-cmd]").forEach(function (b) {
      b.onclick = function () { sendChat(b.getAttribute("data-cmd"), { nick: "Streamer", broadcaster: true }); };
    });

    buildSettings(document.getElementById("all-settings"));
    buildLook(document.getElementById("look-panel"));

    document.getElementById("reset-store").onclick = function () {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      location.reload();
    };

    // A live readout of what the store holds, refreshed twice a second, so you can
    // see exactly what would survive a browser-source refresh.
    var pre = document.getElementById("state");
    setInterval(function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
      pre.textContent = raw ? JSON.stringify(raw, null, 2) : "(nothing saved yet)";
    }, 500);
  }

  // ---- boot ----
  Promise.all([
    fetch("../widget/widget.html").then(function (r) { return r.text(); }),
    fetch("../widget/fields.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    document.getElementById("stage").innerHTML = res[0];
    fieldDefs = res[1];
    fieldData = buildFieldData(res[1]);
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
