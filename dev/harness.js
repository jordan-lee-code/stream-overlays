/* Local dev harness for the Chat Voting widget.
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

  // A little crowd to vote with, so a simulated chat looks like people rather
  // than viewer1 through viewer40.
  var CROWD = ("alder ember sable juniper marlow bramble wren fennel hazel " +
    "otter peregrine sorrel thistle rowan clover magpie birch heather linnet " +
    "quill saffron tansy vesper yarrow bracken").split(" ");

  var LETTERS = "ABCDEFGH";

  /* Once the named crowd runs out, keep going with alder2, ember2 and so on.
     Every voter still needs a distinct name, because the widget counts one vote
     per person and a repeated name would quietly overwrite an earlier vote
     rather than adding to the total. */
  function voterName(i) {
    var base = CROWD[i % CROWD.length];
    var round = Math.floor(i / CROWD.length);
    return round === 0 ? base : base + (round + 1);
  }

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

  function asBoss() { return { nick: "Streamer", broadcaster: true }; }

  /* Fake a rush of chat voting. Votes trickle in over a couple of seconds rather
     than landing all at once, because watching the bars move is the whole point
     of looking at this locally.

     They go out in small batches on one repeating timer rather than one timer
     per voter, so a rush of a few thousand stays smooth instead of asking the
     browser to hold thousands of pending timeouts. */
  var simTimer = null;
  var simSent = 0;

  function stopSim() {
    if (simTimer) { clearInterval(simTimer); simTimer = null; }
  }

  function simulateVotes(count, options, spreadMs) {
    stopSim();
    count = Math.max(1, count || 1);
    options = Math.min(8, Math.max(2, options || 3));
    spreadMs = spreadMs || 2500;

    // Give one option a gentle lead, so the bars tell a story rather than
    // landing in a dead heat every single time.
    var favourite = Math.floor(Math.random() * options);
    var step = 40;
    var perTick = Math.ceil(count / Math.max(1, Math.round(spreadMs / step)));

    simSent = 0;
    reportSim(count);

    simTimer = setInterval(function () {
      for (var i = 0; i < perTick && simSent < count; i++) {
        var pick = Math.random() < 0.45 ? favourite : Math.floor(Math.random() * options);
        // Vote a mix of ways, the way a real chat would.
        var forms = [String(pick + 1), LETTERS[pick], LETTERS[pick].toLowerCase()];
        sendChat(forms[Math.floor(Math.random() * forms.length)], { nick: voterName(simSent) });
        simSent++;
      }
      reportSim(count);
      if (simSent >= count) stopSim();
    }, step);
  }

  /* Shows how many the harness has actually sent, so it can be read against the
     card's own total. If those two ever disagree, the discrepancy is the thing
     worth looking at rather than a guess about whether it "felt right". */
  function reportSim(count) {
    var out = document.getElementById("sim-status");
    if (out) out.textContent = "sent " + simSent + " of " + count;
  }

  // A short sine beep as a data: URL, so a sound field can be filled in locally
  // without any audio file. Each sound gets its own pitch to tell them apart.
  var BEEP_HZ = { openSound: 659, voteSound: 880, tickSound: 1047, resultSound: 523 };
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
      '<h2>Start a poll</h2>' +
      '<div class="row">' +
        '<input id="poll-text" class="wide" type="text" value="!vote Truth A, Truth B, The lie">' +
      '</div>' +
      '<div class="row">' +
        '<button id="poll-start" class="go">Send as broadcaster</button>' +
        '<button class="alt" data-poll="!vote 10s Quick A, Quick B">10s poll</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-poll="!vote Truth A, Truth B, The lie">3 options</button>' +
        '<button class="alt" data-poll="!vote A, B, C, D, E, F">6 options</button>' +
      '</div>' +
      '<p class="hint">A leading <code>60s</code> sets the length for that poll. Options are ' +
      'comma-separated, two to eight of them, duplicates dropped.</p>' +

      '<h2>Chat votes</h2>' +
      '<div class="row">' +
        '<label>Voters <input id="sim-count" type="number" min="1" max="20000" value="14" style="width:80px"></label>' +
        '<label>Options <input id="sim-options" type="number" min="2" max="8" value="3" style="width:70px"></label>' +
      '</div>' +
      '<div class="row">' +
        '<label>Over <input id="sim-spread" type="number" min="100" max="60000" step="500" value="2500" style="width:80px">ms</label>' +
        '<button id="sim-go" class="go">Simulate a rush</button>' +
        '<button id="sim-stop" class="alt">Stop</button>' +
      '</div>' +
      '<div class="row"><span id="sim-status" class="hint" style="margin:0">sent 0 of 0</span></div>' +
      '<p class="hint">Every simulated voter gets a distinct name, so the card\'s total should ' +
      'match "sent" exactly once the rush finishes. Note the poll has to be long enough to ' +
      'hold them: a 45 second poll and a 60 second spread means the clock stops partway.</p>' +

      '<div class="row">' +
        '<input id="chat-user" type="text" value="GenerousViewer" style="width:110px">' +
        '<input id="chat-text" class="wide" type="text" value="3">' +
      '</div>' +
      '<div class="row"><button id="send-chat" class="alt">Send one message</button></div>' +
      '<p class="hint">Chat can vote with the option text, its number, or its letter. Send the ' +
      'same name twice to watch a vote move rather than double.</p>' +

      '<h2>Running the poll</h2>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!voteextend 20">+20 seconds</button>' +
        '<button class="alt" data-cmd="!voteend">End now</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!voterestart">Restart</button>' +
        '<button class="alt" data-cmd="!votecancel">Cancel</button>' +
        '<button class="alt" data-cmd="!voteundo">Undo</button>' +
      '</div>' +
      '<div class="row">' +
        '<button class="alt" data-cmd="!voteresults">Re-show result</button>' +
        '<button class="alt" data-cmd="!votehide">Hide</button>' +
      '</div>' +
      '<p class="hint">Undo walks backwards through everything: ending, cancelling, restarting, ' +
      'and a poll being replaced by a newer one. Press it a few times in a row and watch it ' +
      'climb back up the history.</p>' +

      '<h2>Permissions</h2>' +
      '<div class="row">' +
        '<button class="alt" id="try-viewer">Try !vote as a viewer</button>' +
        '<button class="alt" id="try-mod">Try !vote as a mod</button>' +
      '</div>' +
      '<p class="hint">A viewer should be ignored. A mod should work, unless you set the widget ' +
      'to broadcaster-only below.</p>' +

      '<h2>Stage</h2>' +
      '<div class="row"><label>Widget box width <input id="s-stage" type="number" min="200" max="1920" step="20" value="960" style="width:90px"></label></div>' +
      '<p class="hint">The StreamElements widget box, kept at 16:9. It starts at 960, exactly half the real ' +
      '1920x1080 box, so what you see here lands on stream at double the size. Shrink it to watch long ' +
      'options start wrapping sooner. The card sizes itself to this box.</p>' +

      '<h2>Every setting (re-applies on change)</h2>' +
      '<p class="hint">Generated from <code>fields.json</code>, so it is exactly what StreamElements will offer. Buttons here are the Manual controls.</p>' +
      '<div id="all-settings"></div>' +

      '<div class="divider"></div>' +
      '<div class="row"><button id="reset-store" class="alt">Reset saved state</button></div>' +
      '<p class="hint">Reset clears the persisted poll, then reloads so you start clean. Try ' +
      'refreshing the page mid-poll first, though, since surviving that is the point.</p>';

    document.getElementById("poll-start").onclick = function () {
      stopSim();
      sendChat(document.getElementById("poll-text").value, asBoss());
    };
    document.getElementById("send-chat").onclick = function () {
      sendChat(document.getElementById("chat-text").value, {
        nick: document.getElementById("chat-user").value || "Viewer"
      });
    };
    document.getElementById("chat-text").addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("send-chat").click();
    });
    document.getElementById("sim-go").onclick = function () {
      simulateVotes(
        parseInt(document.getElementById("sim-count").value, 10) || 10,
        parseInt(document.getElementById("sim-options").value, 10) || 3,
        parseInt(document.getElementById("sim-spread").value, 10) || 2500
      );
    };
    document.getElementById("sim-stop").onclick = stopSim;
    document.getElementById("try-viewer").onclick = function () {
      sendChat("!vote Sneaky A, Sneaky B", { nick: "Randomer" });
    };
    document.getElementById("try-mod").onclick = function () {
      sendChat("!vote Mod A, Mod B", { nick: "Marlow", mod: true });
    };

    // A rush that is still running would bleed its votes into whatever comes
    // next, so opening or resetting a poll stops it first.
    c.querySelectorAll("[data-poll]").forEach(function (b) {
      b.onclick = function () { stopSim(); sendChat(b.getAttribute("data-poll"), asBoss()); };
    });
    c.querySelectorAll("[data-cmd]").forEach(function (b) {
      b.onclick = function () {
        var command = b.getAttribute("data-cmd");
        if (/restart|cancel/.test(command)) stopSim();
        sendChat(command, asBoss());
      };
    });

    buildSettings(document.getElementById("all-settings"));
    document.getElementById("s-stage").onchange = function () {
      var w = Math.max(200, parseInt(this.value, 10) || 960);
      var stage = document.getElementById("stage");
      stage.style.width = w + "px";
      stage.style.height = Math.round(w * 9 / 16) + "px";
    };

    document.getElementById("reset-store").onclick = function () {
      try { localStorage.removeItem("se_chat_poll_v1"); } catch (e) {}
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
