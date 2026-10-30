/* Local dev harness for the Squat Tracker widget.
 *
 * It mocks the small slice of the StreamElements runtime the widget depends on
 * (SE_API.store and the onWidgetLoad / onEventReceived custom events) so the exact
 * widget files in ../widget can be driven in a plain browser. Serve the project
 * root over http (e.g. `python3 -m http.server`) and open /dev/. */
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
  // bomb; the follow-ups are the ones that used to inflate it to +170.
  function sendGift(count) {
    count = Math.max(0, Math.round(count) || 0);
    subEvent({ gifted: true, bulkGifted: true, amount: count, sender: "GenerousViewer" });
    for (var i = 0; i < count; i++) {
      subEvent({ gifted: true, isCommunityGift: true, amount: 170, sender: "GenerousViewer", name: "recipient" + i });
    }
  }

  // A single targeted gift (one sub), for completeness.
  function sendSingleGift() {
    subEvent({ gifted: true, amount: 3, sender: "GenerousViewer", name: "Target" });
  }

  function sendButton(field) {
    window.dispatchEvent(new CustomEvent("onEventReceived", {
      detail: { listener: "widget-button", event: { field: field } }
    }));
  }

  // A short sine beep as a data: URL, so a sound field can be filled in locally
  // without any audio file. Each sound gets its own pitch to tell them apart.
  var BEEP_HZ = { giftSound: 784, lockSound: 523, unlockSound: 1047 };
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
          input.value = def.value;
        } else if (def.type === "checkbox") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!def.value;
        } else if (def.type === "sound-input") {
          // No file upload here: paste a URL, or use a generated test beep so the
          // sounds can be tried with nothing to hand.
          input = document.createElement("input");
          input.type = "text";
          input.value = def.value || "";
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
          input.value = String(def.value).toLowerCase();
        } else if (def.type === "number") {
          input = document.createElement("input");
          input.type = "number";
          ["min", "max", "step"].forEach(function (a) { if (def[a] !== undefined) input[a] = def[a]; });
          input.value = def.value;
        } else {
          input = document.createElement("input");
          input.type = "text";
          input.value = def.value;
        }

        input.onchange = function () {
          if (def.type === "checkbox") fieldData[key] = input.checked;
          else if (def.type === "number") fieldData[key] = input.value === "" ? def.value : parseFloat(input.value);
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
      '<h2>Gift a bomb of subs</h2>' +
      '<div class="row">' +
        '<label>Subs <input id="gift-amount" type="number" min="1" value="16" style="width:80px"></label>' +
        '<button id="gift-send" class="go">Gift subs</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-gift="5">Gift 5</button>' +
        '<button class="alt" data-gift="16">Gift 16</button>' +
        '<button class="alt" data-gift="27">Gift 27</button>' +
        '<button id="gift-single" class="alt">Gift 1 (targeted)</button>' +
      '</div>' +
      '<p class="hint">Each button fires a real community gift: the bomb plus one follow-up per ' +
      'recipient carrying a streak of 170 in the same field. A bomb of N adds floor(N / block) ' +
      'blocks. 16 adds 15, 27 adds 25, 4 or a single gift adds nothing. If a follow-up ever ' +
      'sneaks in, you would see the count jump by 170, so this is exactly the case that broke before.</p>' +

      '<h2>Chat commands</h2>' +
      '<div class="row">' +
        '<input id="chat-user" type="text" value="Streamer" placeholder="username">' +
        '<input id="chat-text" type="text" value="!squats -5" placeholder="command">' +
      '</div>' +
      '<div class="row">' +
        '<label><input type="checkbox" id="r-broadcaster" checked> broadcaster</label>' +
        '<label><input type="checkbox" id="r-mod"> mod</label>' +
      '</div>' +
      '<div class="row"><button id="send-chat" class="go">Send message</button></div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!squats -5">!squats -5</button>' +
        '<button class="alt" data-cmd="!squats +5">!squats +5</button>' +
        '<button class="alt" data-cmd="!squats">!squats</button>' +
        '<button class="alt" data-cmd="!squatsreset">!squatsreset</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!squatslock">!squatslock</button>' +
        '<button class="alt" data-cmd="!squatsunlock">!squatsunlock</button>' +
      '</div>' +
      '<p class="hint">The quick buttons send as the broadcaster. Untick broadcaster and tick mod (or neither) to feel the permissions.</p>' +
      '<p class="hint">While the count is locked a padlock sits on the sticker and gift bombs ' +
      'add nothing, but !squats -5 and the reset still work, which is the shape of a stream ' +
      'where the squats are being worked off rather than piling up.</p>' +

      '<h2>Every setting (re-applies on change)</h2>' +
      '<p class="hint">Generated from <code>fields.json</code>, so it is exactly what StreamElements will offer. Buttons here are the Manual controls.</p>' +
      '<div id="all-settings"></div>' +

      '<div class="divider"></div>' +
      '<div class="row"><button id="reset-store" class="alt">Reset saved state</button></div>' +
      '<p class="hint">Reset clears the persisted count, then reloads so you start clean.</p>';

    function opts() {
      return {
        nick: document.getElementById("chat-user").value || "Viewer",
        broadcaster: document.getElementById("r-broadcaster").checked,
        mod: document.getElementById("r-mod").checked
      };
    }

    document.getElementById("gift-send").onclick = function () {
      sendGift(parseInt(document.getElementById("gift-amount").value, 10) || 0);
    };
    document.getElementById("gift-single").onclick = sendSingleGift;
    document.getElementById("send-chat").onclick = function () {
      sendChat(document.getElementById("chat-text").value, opts());
    };
    document.getElementById("chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat(this.value, opts());
    });

    c.querySelectorAll("[data-gift]").forEach(function (b) {
      b.onclick = function () { sendGift(parseInt(b.getAttribute("data-gift"), 10)); };
    });
    c.querySelectorAll("[data-cmd]").forEach(function (b) {
      b.onclick = function () { sendChat(b.getAttribute("data-cmd"), { nick: "Streamer", broadcaster: true }); };
    });

    buildSettings(document.getElementById("all-settings"));

    document.getElementById("reset-store").onclick = function () {
      try { localStorage.removeItem("se_squat_tracker_v1"); } catch (e) {}
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
