/* Local dev harness for the Rage Bar widget.
 *
 * It mocks the small slice of the StreamElements runtime the widget depends on
 * (SE_API.store and the onWidgetLoad / onEventReceived custom events) so the exact
 * widget files in ../widget can be driven in a plain browser. Serve the project
 * root over http (e.g. `python3 -m http.server`) and open /dev/.
 *
 * The channel point buttons are the reason this harness earns its keep. A
 * redemption is the one event here that nobody outside StreamElements has
 * documented, so the shapes below are written to match what a real one looks
 * like, and the "raw only" toggle strips the flat fields away so the fallbacks
 * in readRedemption get exercised by hand as well as by the test suite. */
(function () {
  "use strict";

  var STORE_KEY = "rage_bar_v1";

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


  function subEvent(event) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "subscriber-latest", event: event }
    }));
  }

  function cheerEvent(amount, name) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "cheer-latest", event: { amount: amount, name: name || "GenerousViewer" } }
    }));
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

  function sendTip(amount) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "tip-latest", event: { amount: amount, name: "GenerousViewer" } }
    }));
  }

  function sendButton(field) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "widget-button", event: { field: field } }
    }));
  }

  /* A channel point redemption. StreamElements carries these on the event itself
     rather than through a listener of their own, so the type is what marks it.
     With "raw only" ticked the flat title/cost/username are dropped and only the
     Twitch payload is left, which is the shape the widget's fallbacks are for. */
  function sendRedeem(title, cost, user) {
    var rawOnly = document.getElementById("cp-raw") && document.getElementById("cp-raw").checked;
    var raw = { redemption: { reward: { title: title, cost: cost }, user: { display_name: user } } };
    var data = rawOnly
      ? { raw: raw }
      : { rewardId: "reward-" + title, title: title, cost: cost, username: user, userInput: "", raw: raw };
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "event", event: { type: "channelPoints", data: data } }
    }));
  }

  // Reproduce a real community gift the way StreamElements delivers it: the bomb
  // announcement (amount = subs gifted), then one follow-up per recipient carrying
  // the gifter's streak in the same field. A correct bar moves only for the bomb;
  // the follow-ups are the ones that would inflate a counter by 170.
  function sendGift(count, tier) {
    count = Math.max(0, Math.round(count) || 0);
    subEvent({ gifted: true, bulkGifted: true, amount: count, tier: tier || "1000", sender: "GenerousViewer" });
    for (var i = 0; i < count; i++) {
      subEvent({ gifted: true, isCommunityGift: true, amount: 170, tier: tier || "1000", sender: "GenerousViewer", name: "recipient" + i });
    }
  }

  // A short sine beep as a data: URL, so a sound field can be filled in locally
  // without any audio file. Each sound gets its own pitch to tell them apart.
  var BEEP_HZ = { addSound: 880, lockSound: 392, breakSound: 659, fullSound: 1047, savedSound: 784, resetSound: 262 };
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
      '<h2>Where the bar is</h2>' +
      '<pre id="state">reading...</pre>' +

      '<h2>Subs</h2>' +
      '<div class="row">' +
        '<button class="alt" data-sub="1000">Sub T1</button>' +
        '<button class="alt" data-sub="2000">Sub T2</button>' +
        '<button class="alt" data-sub="3000">Sub T3</button>' +
        '<button class="alt" id="sub-resub">Resub, 6 months</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-gift="1">Gift 1</button>' +
        '<button class="alt" data-gift="5">Gift 5</button>' +
        '<button class="alt" data-gift="20">Gift 20</button>' +
        '<button class="alt" data-gift="100">Gift 100</button>' +
      '</div>' +
      '<p class="hint">Gift 100 is the outright reset: a hundred gifted tier 1 subs in one go (500 points, ' +
      'which doubles as the bars grow up to it) ends the run with no window to save it, and it goes straight through a lock. ' +
      'Each gift button fires the real thing: the bomb plus one follow-up per ' +
      'recipient carrying a streak of 170 in the same field. If a follow-up ever sneaks through ' +
      'you would see the bar leap by hundreds of points, so this is the case worth clicking twice.</p>' +

      '<h2>Bits</h2>' +
      '<div class="row">' +
        '<button class="alt" data-bits="50">50 bits</button>' +
        '<button class="alt" data-bits="100">100 bits</button>' +
        '<button class="alt" data-bits="1000">1000 bits</button>' +
        '<button class="alt" data-bits="10000">10000 bits</button>' +
      '</div>' +

      '<h2>Tips</h2>' +
      '<div class="row">' +
        '<button class="alt" data-tip="2.5">Tip 2.50</button>' +
        '<button class="alt" data-tip="20">Tip 20</button>' +
        '<button class="alt" data-tip="50">Tip 50</button>' +
      '</div>' +
      '<p class="hint">2.50 in whatever currency the channel takes counts as one tier 1 sub, and 50 fills the first bar. ' +
      'Tips fill the bar, chip into a save, and count against a lock like subs and bits do.</p>' +

      '<h2>Channel points</h2>' +
      '<div class="row">' +
        '<label><input type="checkbox" id="cp-raw"> raw payload only</label>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" id="cp-fill">Fill the Bar (2000)</button>' +
        '<button class="alt" id="cp-pushback">Push Back the Bar (5000)</button>' +
      '</div>' +
      '<div class="row">' +
        '<label>Nope chip-in <input id="cp-nope-cost" type="number" min="0" step="1000" value="10000" style="width:88px"></label>' +
        '<button id="cp-nope" class="go">Chip in</button>' +
        '<button id="cp-nope-crowd" class="alt">Five people chip in</button>' +
      '</div>' +
      '<div class="row">' +
        '<label>Lock cost <input id="cp-lock-cost" type="number" min="0" step="500" value="5000" style="width:96px"></label>' +
        '<button id="cp-lock" class="alt">Lock the Bar</button>' +
      '</div>' +
      '<p class="hint">Saving a run takes five subs worth of anything: subs, bits and nope redeems all ' +
      'pay into the same pot, at 10000 points to the sub. Five redeems at 10000 will do it, and so ' +
      'will a tier 3 plus a couple of thousand bits. Five subs worth of subs, bits or donations against a lock breaks it early. ' +
      'The lock reward is matched on the start of its title, so "Lock the Bar (5 min)" ' +
      'counts too. The time in the name decides the length, and only a name with no time in it ' +
      'falls back to the price, at 1000 points a minute. ' +
      'Tick "raw payload only" to drop the flat fields and make the widget read the Twitch payload instead.</p>' +

      '<h2>Chat commands</h2>' +
      '<div class="row">' +
        '<input id="chat-text" type="text" value="!bar lock 60" placeholder="command" style="flex:1;min-width:150px">' +
        '<button id="send-chat" class="go">Send</button>' +
      '</div>' +
      '<div class="row">' +
        '<label><input type="checkbox" id="r-broadcaster" checked> broadcaster</label>' +
        '<label><input type="checkbox" id="r-mod"> mod</label>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!bar">!bar</button>' +
        '<button class="alt" data-cmd="!bar +10">!bar +10</button>' +
        '<button class="alt" data-cmd="!bar set 45">!bar set 45</button>' +
        '<button class="alt" data-cmd="!bar reset">!bar reset</button>' +
        '<button class="alt" data-cmd="!bar reset 1">!bar reset 1</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!bar lock 60">!bar lock 60</button>' +
        '<button class="alt" data-cmd="!bar lock 5m">!bar lock 5m</button>' +
        '<button class="alt" data-cmd="!bar unlock">!bar unlock</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!bar sub 5">!bar sub 5</button>' +
        '<button class="alt" data-cmd="!bar bits 500">!bar bits 500</button>' +
        '<button class="alt" data-cmd="!bar fill">!bar fill</button>' +
        '<button class="alt" data-cmd="!bar nope">!bar nope</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!bar off">!bar off</button>' +
        '<button class="alt" data-cmd="!bar on">!bar on</button>' +
      '</div>' +
      '<p class="hint">A bare number is seconds, so !bar lock 60 is one minute. 90s, 5m and 1h ' +
      'all work too, and a mod\'s lock ignores the caps chat plays by. The quick buttons send as ' +
      'the broadcaster; untick it and tick mod, or neither, to feel the permissions.</p>' +

      '<h2>Look and export</h2>' +
      '<div id="look-panel"></div>' +

      '<h2>Every setting (re-applies on change)</h2>' +
      '<p class="hint">Generated from <code>fields.json</code>, so it is exactly what StreamElements will offer. The Manual controls group holds the settings panel buttons: they are the whole safety net on a live stream, so they are worth trusting, and Fill the bar is how to rehearse the save window before anyone is watching.</p>' +
      '<div id="all-settings"></div>' +

      '<div class="divider"></div>' +
      '<div class="row"><button id="reset-store" class="alt">Reset saved state</button></div>' +
      '<p class="hint">Clears the persisted bar, then reloads so you start clean.</p>';

    c.querySelectorAll("[data-sub]").forEach(function (b) {
      b.onclick = function () { subEvent({ tier: b.getAttribute("data-sub"), name: "GenerousViewer" }); };
    });
    c.querySelectorAll("[data-gift]").forEach(function (b) {
      b.onclick = function () { sendGift(parseInt(b.getAttribute("data-gift"), 10), "1000"); };
    });
    c.querySelectorAll("[data-tip]").forEach(function (b) {
      b.onclick = function () { sendTip(parseFloat(b.getAttribute("data-tip"))); };
    });
    c.querySelectorAll("[data-bits]").forEach(function (b) {
      b.onclick = function () { cheerEvent(parseInt(b.getAttribute("data-bits"), 10), "Rowan"); };
    });
    c.querySelectorAll("[data-btn]").forEach(function (b) {
      b.onclick = function () { sendButton(b.getAttribute("data-btn")); };
    });
    function chatOpts() {
      return {
        nick: document.getElementById("r-broadcaster").checked ? "Streamer" : "Viewer",
        broadcaster: document.getElementById("r-broadcaster").checked,
        mod: document.getElementById("r-mod").checked
      };
    }
    document.getElementById("send-chat").onclick = function () {
      sendChat(document.getElementById("chat-text").value, chatOpts());
    };
    document.getElementById("chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat(this.value, chatOpts());
    });
    c.querySelectorAll("[data-cmd]").forEach(function (b) {
      b.onclick = function () { sendChat(b.getAttribute("data-cmd"), chatOpts()); };
    });
    document.getElementById("sub-resub").onclick = function () { subEvent({ amount: 6, tier: "1000", name: "Sage" }); };
    document.getElementById("cp-fill").onclick = function () { sendRedeem("Fill the Bar", 2000, "Rowan"); };
    document.getElementById("cp-pushback").onclick = function () { sendRedeem("Push Back the Bar", 5000, "Juniper"); };
    document.getElementById("cp-nope").onclick = function () {
      sendRedeem("Save the Run", parseInt(document.getElementById("cp-nope-cost").value, 10) || 0, "Sage");
    };
    document.getElementById("cp-nope-crowd").onclick = function () {
      var cost = parseInt(document.getElementById("cp-nope-cost").value, 10) || 0;
      ["GenerousViewer", "Rowan", "Sage", "Juniper", "Ash"].forEach(function (who, i) {
        setTimeout(function () { sendRedeem("Save the Run", cost, who); }, i * 450);
      });
    };
    document.getElementById("cp-lock").onclick = function () {
      sendRedeem("Lock the Bar", parseInt(document.getElementById("cp-lock-cost").value, 10) || 0, "GenerousViewer");
    };

    buildSettings(document.getElementById("all-settings"));
    buildLook(document.getElementById("look-panel"));

    document.getElementById("reset-store").onclick = function () {
      try { localStorage.removeItem("se_" + STORE_KEY); } catch (e) {}
      location.reload();
    };
  }

  /* The readout comes back out of the store rather than out of the widget, so
     what you are looking at is what would actually survive a refresh. A bar that
     looks right on screen and wrong here is a bar that will lose its place the
     moment OBS reloads the browser source, which is the failure worth catching. */
  function startStateReadout() {
    var node = document.getElementById("state");
    if (!node) return;
    setInterval(function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem("se_" + STORE_KEY)); } catch (e) {}
      if (!raw) { node.textContent = "nothing saved yet"; return; }
      var now = Date.now();
      var left = function (at) { return at > now ? Math.ceil((at - now) / 1000) + "s" : "-"; };
      node.textContent = [
        "fill       " + (Math.round(raw.fill * 10) / 10),
        "phase      " + raw.phase,
        "resets     " + (raw.resetCount || 0),
        "locked     " + (raw.lockUntil > now ? left(raw.lockUntil) + " left" : "no"),
        "nope in    " + left(raw.nopeUntil),
        "nope pot   " + (raw.nopePool || 0),
        "banked     " + (raw.resetBank || 0),
        "overkill   " + (raw.overkill ? "yes, no saving it" : "no"),
        "switched   " + (raw.pausedAt ? "OFF, clocks frozen" : "on"),
        "reset in   " + left(raw.resetUntil),
        "saved by   " + (raw.saviour || "-")
      ].join("\n");
    }, 300);
  }

  /* A scripted run, so a whole panic can be replayed without clicking through it:
     /dev/?drive=sub:3000,sub:3000,lock:10000,sub:3000,unlock,fill,wait,nope
     Steps are sub:<tier>, gift:<count>, bits:<amount>, redeem:<title>:<cost>,
     lock:<cost>, unlock, fill, nope, reset, btn:<field>. */
  function autoDrive() {
    var m = /[?&]drive=([^&]*)/.exec(location.search);
    if (!m) return;
    var steps = decodeURIComponent(m[1]).split(",");
    steps.forEach(function (step, i) {
      setTimeout(function () {
        var bits = step.split(":");
        var kind = bits[0];
        if (kind === "sub") subEvent({ tier: bits[1] || "1000", name: "GenerousViewer" });
        else if (kind === "gift") sendGift(parseInt(bits[1], 10) || 1, "1000");
        else if (kind === "bits") cheerEvent(parseInt(bits[1], 10) || 100, "Rowan");
        else if (kind === "tip") sendTip(parseFloat(bits[1]) || 5);
        else if (kind === "redeem") sendRedeem(bits[1], parseInt(bits[2], 10) || 0, "GenerousViewer");
        else if (kind === "lock") sendRedeem("Lock the Bar", parseInt(bits[1], 10) || 0, "GenerousViewer");
        else if (kind === "unlock") sendButton("btnUnlock");
        else if (kind === "fill") sendButton("btnFillBar");
        else if (kind === "nope") sendRedeem("Save the Run", parseInt(bits[1], 10) || 50000, "Sage");
        else if (kind === "reset") sendButton("btnReset");
        else if (kind === "btn") sendButton(bits[1]);
        else if (kind === "chat") sendChat(step.slice(5), { nick: "Streamer", broadcaster: true });
      }, 800 + i * 900);
    });
  }

  // The stage is the real 1920 by 960 widget box, scaled down to fit the pane.
  function fitStage() {
    var wrap = document.getElementById("stage-wrap");
    var box = document.getElementById("stage-box");
    var stage = document.getElementById("stage");
    if (!wrap || !box || !stage) return;
    var s = Math.min((wrap.clientWidth - 40) / 1920, (wrap.clientHeight - 40) / 960, 1);
    if (!(s > 0)) s = 0.1;
    box.style.width = Math.round(1920 * s) + "px";
    box.style.height = Math.round(960 * s) + "px";
    stage.style.transform = "scale(" + s + ")";
  }

  // ---- boot ----
  Promise.all([
    fetch("../widget/widget.html").then(function (r) { return r.text(); }),
    fetch("../widget/fields.json").then(function (r) { return r.json(); })
  ]).then(function (res) {
    document.getElementById("stage").innerHTML = res[0];
    fieldDefs = res[1];
    fieldData = buildFieldData(res[1]);
    fieldData.debug = false;   // the console is for the real stream, not for here
    return loadScript("../widget/widget.js");
  }).then(function () {
    fitStage();
    window.addEventListener("resize", fitStage);
    buildControls();
    dispatchLoad();
    startStateReadout();
    autoDrive();
  }).catch(function (err) {
    document.getElementById("controls").innerHTML =
      '<p style="color:#b00">Failed to load widget files. Serve the project root over http ' +
      'and open /dev/ (not file://). ' + String(err) + '</p>';
  });
})();
