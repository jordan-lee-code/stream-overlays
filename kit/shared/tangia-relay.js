/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* A page for Tangia's Better Alerts to show in its custom iFrame action. Tangia passes the properties of the thing that triggered the alert
 * to that page as query parameters. This page takes them and posts them as JSON to a Mix It Up webhook, so a command there can count them,
 * with the Stream Goals widget's TangiaBits function, as bits.
 *
 * The page is given the webhook's address as `hook`, in the part after the # so that the secret in it is never sent to the server that serves
 * this page, or in the query, which is the form Tangia is more likely to leave alone. Everything else Tangia adds is sent on. It shows
 * nothing, unless `debug=1`, because it sits on stream. Only a Mix It Up webhook address is accepted, so a link cannot make this page post
 * somewhere else.
 *
 * The parts that decide things are plain functions, so the tests can run them without a browser. */
(function (root) {
  "use strict";

  var HOOK = /^https:\/\/desktop\.api\.mixitup\.bot\/api\/webhook\/[A-Za-z0-9-]+\?secret=[A-Za-z0-9]+$/;
  // The names a bits or price amount is likely to have, tried in this order.
  var AMOUNT = ["amount", "bits", "bit", "price", "cost", "credits", "credit", "value", "total"];

  function decode(s) { try { return decodeURIComponent(String(s).replace(/\+/g, " ")); } catch (e) { return String(s); } }

  // A webhook address has a ? in it, which would split it in two, so it is found first, as it is and in its encoded form, and taken out
  // before the rest is read as parameters. That way it works pasted straight in after hook=, which is how people will paste it.
  var HOOK_IN = /hook=(https:\/\/desktop\.api\.mixitup\.bot\/api\/webhook\/[A-Za-z0-9-]+\?secret=[A-Za-z0-9]+)/;
  function withoutHook(text, out) {
    var plain = String(text || ""), m = HOOK_IN.exec(plain), seen = plain;
    if (!m) { seen = decode(plain); m = HOOK_IN.exec(seen); }
    if (!m) return plain;
    out.hook = m[1];
    return seen.replace(m[0], "");
  }

  /** Every name=value pair in a query and a hash, as an object. A hash may hold them too, with a ? or & between, since a page that is
   *  given an address ending in #hook=... may have more added after it. */
  function paramsOf(search, hash) {
    var out = {};
    function take(text) {
      String(text || "").replace(/^[?#]/, "").split(/[&?]/).forEach(function (p) {
        if (!p) return;
        var i = p.indexOf("=");
        var k = decode(i === -1 ? p : p.slice(0, i));
        if (k && !(k === "hook" && out.hook)) out[k] = i === -1 ? "" : decode(p.slice(i + 1));
      });
    }
    take(withoutHook(search, out)); take(withoutHook(hash, out));
    return out;
  }

  /** The webhook address in the parameters, or "" when it is missing or is not a Mix It Up webhook. */
  function hookOf(params) { var h = params && params.hook; return typeof h === "string" && HOOK.test(h) ? h : ""; }

  function num(v) { var n = parseFloat(String(v).replace(/,/g, "")); return isFinite(n) ? n : NaN; }

  /** What is posted: every parameter except the address, as it came, with `amount` added from the likeliest bits or price field when
   *  there is not one already, and `user` from the likeliest name. */
  function bodyOf(params) {
    var out = {};
    Object.keys(params || {}).forEach(function (k) { if (k !== "hook" && k !== "debug") out[k] = params[k]; });
    var lower = {};
    Object.keys(out).forEach(function (k) { lower[k.toLowerCase().split(".").pop()] = out[k]; });
    if (!(num(out.amount) > 0)) {
      for (var i = 0; i < AMOUNT.length; i++) { if (num(lower[AMOUNT[i]]) > 0) { out.amount = String(num(lower[AMOUNT[i]])); break; } }
    }
    if (!out.user) {
      var who = lower.user || lower.username || lower.name || lower.displayname || lower.viewer || lower.sender;
      if (who) out.user = who;
    }
    return out;
  }

  var api = { paramsOf: paramsOf, hookOf: hookOf, bodyOf: bodyOf, HOOK: HOOK };
  root.TangiaRelay = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (root.document && root.location && !root.__relayNoAutostart) {
    var params = paramsOf(root.location.search, root.location.hash), debug = params.debug === "1", box = null;
    var say = function (t) {
      if (!debug) return;
      if (!box) { box = root.document.createElement("pre"); box.style.cssText = "font:12px/1.4 monospace;white-space:pre-wrap;word-break:break-all;margin:8px;color:#fff;background:rgba(0,0,0,.8);padding:6px"; root.document.body.appendChild(box); }
      box.textContent += t + "\n";
    };
    var hook = hookOf(params), body = bodyOf(params);
    say("received: " + JSON.stringify(params).replace(/secret=[^"&]*/g, "secret=***"));
    if (!hook) say("No Mix It Up webhook address, so nothing was sent. It is given as #hook=... and has to look like https://desktop.api.mixitup.bot/api/webhook/ID?secret=SECRET.");
    else if (!(num(body.amount) > 0)) say("No bits or price amount was found in what Tangia sent, so nothing was sent. Look at the names above.");
    else {
      say("sending: " + JSON.stringify(body));
      root.fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { say("Mix It Up answered " + r.status + (r.status >= 200 && r.status < 300 ? " (accepted)" : "")); })
        .catch(function (e) { say("Could not send: " + (e && e.message ? e.message : e)); });
    }
  }
}(typeof window !== "undefined" ? window : this));
