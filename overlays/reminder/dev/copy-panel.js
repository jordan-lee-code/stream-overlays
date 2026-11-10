/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The panel at the top of every overlay's dev page that copies the overlay's files, one button for
 * each tab of StreamElements' custom widget editor, so nobody has to download the repository.
 * With Mix It Up chosen at the top of the site, it instead packs the overlay into a widget for Mix It Up.
 *
 * The page's own script makes the current settings available as `window.__exportFields()`, which
 * returns fields.json with the starting value of every setting filled in as it is configured here.
 * The other three files are fetched from the widget folder, exactly as the page itself loads them.
 * The panel adds itself once the page has built its controls. */
(function () {
  "use strict";

  var FILES = [
    { name: "widget.html", tab: "HTML", note: "the HTML tab", get: function () { return fetchText("../widget/widget.html"); } },
    { name: "widget.css", tab: "CSS", note: "the CSS tab", get: function () { return fetchText("../widget/widget.css"); } },
    { name: "widget.js", tab: "JS", note: "the JS tab", get: function () { return fetchText("../widget/widget.js"); } },
    { name: "fields.json", tab: "Fields", note: "the Fields tab, with your settings", get: function () {
      if (typeof window.__exportFields !== "function") return Promise.reject(new Error("The page's settings are not ready yet."));
      return Promise.resolve(window.__exportFields());
    } }
  ];

  var STYLE = "#copy-panel { margin: 0 0 14px; padding: 12px; border: 2px solid #c9a7ff; border-radius: 12px; background: #faf6ff; }" +
    "#copy-panel h2 { margin-top: 0; }" +
    "#copy-panel ol { margin: 6px 0 10px; padding-left: 20px; font-size: 12px; color: #4b4560; }" +
    "#copy-panel li { margin: 2px 0; }" +
    "#copy-panel .copy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }" +
    "#copy-panel .copy-btn { display: block; width: 100%; margin: 0; padding: 8px 6px; text-align: center; font-weight: 700; line-height: 1.25; }" +
    "#copy-panel .copy-btn small { display: block; font-weight: 400; font-size: 11px; color: #667; }" +
    "#copy-panel .copy-btn.done { background: #dff5e1; border-color: #7bc58a; }" +
    "#copy-panel .copy-btn.failed { background: #fde3e3; border-color: #e08a8a; }" +
    "#copy-panel #copy-msg { min-height: 1.3em; margin: 8px 0 0; font-size: 12px; }" +
    "#copy-panel textarea { display: block; width: 100%; box-sizing: border-box; height: 90px; margin-top: 8px; font-size: 11px; }" +
    "#copy-panel textarea[hidden] { display: none; }" +
    /* Dark by default, as the landing page is. The choice is kept under one name for the whole site, so the two agree. */
    "html:not([data-theme=\"light\"]) #copy-panel { border-color: #6a4cb8; background: #271f3b; }" +
    "html:not([data-theme=\"light\"]) #copy-panel ol { color: #cfc7e3; }" +
    "html:not([data-theme=\"light\"]) #copy-panel .copy-btn small { color: #b3abc6; }" +
    "html:not([data-theme=\"light\"]) #copy-panel .copy-btn.done { background: #1d3a27; border-color: #3f8a57; }" +
    "html:not([data-theme=\"light\"]) #copy-panel .copy-btn.failed { background: #432326; border-color: #a55a5a; }" +
    "html:not([data-theme=\"light\"]) #copy-panel textarea { background: #15121d; color: inherit; border: 1px solid #443a63; }" +
    "#theme-toggle { float: right; margin: 0 0 6px 8px; padding: 2px 9px; font-size: 11px; }" +
    "#platform-toggle { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; }" +
    "#platform-toggle button { margin: 0; padding: 2px 9px; font-size: 11px; }" +
    "#platform-toggle button[aria-pressed=\"true\"] { background: #6a4cb8; border-color: #6a4cb8; color: #fff; }";

  var THEME_KEY = "stream-overlays-theme";
  function storedTheme() { try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark"; } catch (e) { return "dark"; } }
  function setTheme(t) {
    if (t === "light") document.documentElement.setAttribute("data-theme", "light"); else document.documentElement.removeAttribute("data-theme");
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }
  setTheme(storedTheme());

  // The dev page's own stylesheet link is cached just as long, so it is pointed at the file again with a changing address.
  Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"][href$="widget.css"]'), function (l) { l.href = "../widget/widget.css?v=" + Date.now(); });

  var PLATFORM_KEY = "stream-overlays-platform";
  function platform() {
    try {
      var q = /[?&]platform=(streamelements|mixitup)/.exec(location.search);
      if (q) { localStorage.setItem(PLATFORM_KEY, q[1]); return q[1]; }
      return localStorage.getItem(PLATFORM_KEY) === "mixitup" ? "mixitup" : "streamelements";
    } catch (e) { return "streamelements"; }
  }
  function setPlatform(p) { try { localStorage.setItem(PLATFORM_KEY, p); } catch (e) {} }
  // Only the settings that differ from the overlay's defaults are packed, so what travels stays as short as it can.
  function changedSettings(current, defaults) {
    var out = {};
    Object.keys(current || {}).forEach(function (k) {
      var c = current[k], d = defaults && defaults[k];
      if (!c || c.type === "button" || c.type === "section" || !("value" in c)) return;
      if (!d || JSON.stringify(c.value) !== JSON.stringify(d.value)) out[k] = c.value;
    });
    return out;
  }
  window.__changedSettings = changedSettings;

  function fetchText(url) {
    // Asked afresh each time, since a browser may otherwise hand back a widget.js from hours ago, and the copy that goes into StreamElements
    // would then be the old one next to a new fields.json.
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("Could not load " + url.replace("../widget/", "") + " (" + r.status + ").");
      return r.text();
    });
  }

  // The clipboard API where the page is allowed to use it, and the old way where it is not.
  function copyText(text, fallbackBox) {
    function old() {
      fallbackBox.hidden = false;
      fallbackBox.value = text;
      fallbackBox.focus();
      fallbackBox.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      if (ok) fallbackBox.hidden = true;
      return ok;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return old(); });
    }
    return Promise.resolve(old());
  }

  function kb(text) { return Math.max(1, Math.round(text.length / 1024)) + " KB"; }

  function buildStreamElements() {
    var panel = document.createElement("div");
    panel.id = "copy-panel";
    var style = document.createElement("style");
    style.textContent = STYLE;
    panel.appendChild(style);

    var h = document.createElement("h2");
    h.textContent = "Copy into StreamElements";
    panel.appendChild(h);

    var steps = document.createElement("ol");
    ["Set the overlay up below. Everything on this page, including the style preset, goes into the copy of fields.json.",
     "In StreamElements, add a Custom Widget to your overlay (+ Add Widget, Static/Custom, Custom Widget), then open Settings and Open Editor.",
     "Press each button and paste into the tab it names, replacing what is there, then click Done."].forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      steps.appendChild(li);
    });
    panel.appendChild(steps);

    var grid = document.createElement("div");
    grid.className = "copy-grid";
    var msg = document.createElement("p");
    msg.id = "copy-msg";
    msg.className = "hint";
    var box = document.createElement("textarea");
    box.hidden = true;
    box.readOnly = true;

    FILES.forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "copy-btn";
      var label = document.createElement("span");
      label.textContent = "Copy " + f.name;
      var small = document.createElement("small");
      small.textContent = "paste into " + f.note;
      b.appendChild(label);
      b.appendChild(small);
      b.addEventListener("click", function () {
        b.classList.remove("done", "failed");
        f.get().then(function (text) {
          return copyText(text, box).then(function (ok) {
            if (ok) {
              b.classList.add("done");
              label.textContent = "Copied " + f.name;
              msg.textContent = "Copied " + f.name + " (" + kb(text) + "). Paste it into " + f.note + ".";
              setTimeout(function () { b.classList.remove("done"); label.textContent = "Copy " + f.name; }, 2500);
            } else {
              b.classList.add("failed");
              msg.textContent = "The browser would not copy it. It is in the box below: press Ctrl+C (or Cmd+C) to copy it.";
            }
          });
        }).catch(function (e) {
          b.classList.add("failed");
          msg.textContent = e && e.message ? e.message : "Could not copy " + f.name + ".";
        });
      });
      grid.appendChild(b);
    });
    var theme = document.createElement("button");
    theme.id = "theme-toggle";
    theme.type = "button";
    var label = function () { theme.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "Dark mode" : "Light mode"; };
    theme.addEventListener("click", function () { setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"); label(); });
    label();
    panel.insertBefore(platformSwitch(), panel.firstChild);
    panel.insertBefore(theme, panel.firstChild);
    panel.appendChild(grid);
    panel.appendChild(msg);
    panel.appendChild(box);
    return panel;
  }


  // The same choice as at the top of the landing page, so a visitor can change their mind here.
  var PLATFORMS = [["streamelements", "StreamElements"], ["mixitup", "Mix It Up"]];
  function platformSwitch() {
    var wrap = document.createElement("div");
    wrap.id = "platform-toggle";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Which tool do you stream with?");
    PLATFORMS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = p[1];
      b.setAttribute("aria-pressed", String(platform() === p[0]));
      b.addEventListener("click", function () {
        setPlatform(p[0]);
        var old = document.getElementById("copy-panel");
        if (old && old.parentNode) old.parentNode.removeChild(old);
        place();
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ---- Mix It Up ---------------------------------------------------------------------------------------------------------

  // The widget is packed here, in the page, from the overlay's own files and the settings as they are set up below, and never leaves the
  // computer until it is pasted into Mix It Up.
  function mixItUpWidget() {
    if (!window.MixItUpPack) return Promise.reject(new Error("The packer did not load."));
    var name = (/([^\/]+)\/dev\/[^\/]*$/.exec(location.pathname) || [])[1] || "overlay";
    var h = document.querySelector("#controls h1");
    return Promise.all([fetchText("../widget/widget.html"), fetchText("../widget/widget.css"), fetchText("../widget/widget.js"), fetchText("../../mixitup.js"),
      fetch("../widget/fields.json", { cache: "no-cache" }).then(function (r) { return r.json(); })]).then(function (p) {
      var current = JSON.parse(window.__exportFields());
      return window.MixItUpPack.pack({ name: name, title: h ? h.textContent.replace(/\s+Overlay$/, "") : name, html: p[0], css: p[1], js: p[2], adapter: p[3], fields: p[4], settings: changedSettings(current, p[4]) });
    });
  }

  function buildMixItUp() {
    var panel = document.createElement("div");
    panel.id = "copy-panel";
    var style = document.createElement("style");
    style.textContent = STYLE;
    panel.appendChild(style);
    var h = document.createElement("h2");
    h.textContent = "Use with Mix It Up";
    panel.appendChild(h);
    var steps = document.createElement("ol");
    ["Set the overlay up below. Everything on this page, including the style preset, goes into the widget.",
     "Press Copy the widget. In Mix It Up, open Overlay Widgets and bring it in with the same paste or import you would use for a widget you had copied out of Mix It Up. Or make a new Custom widget and paste the three code boxes below into its HTML, CSS and JavaScript.",
     "Edit the widget and set Display Option to Single Widget URL, save it, then click the link icon on the widget to get its address. Use one address for each overlay.",
     "In OBS, add a Browser source, paste that address into URL, and give it the width and height of the box you want."].forEach(function (t) {
      var li = document.createElement("li");
      li.textContent = t;
      steps.appendChild(li);
    });
    panel.appendChild(steps);

    // Someone moving over from StreamElements already has their settings there: the Data tab of the widget editor holds them as plain
    // values. They are loaded by the troubleshooting panel's own code, so there is one way of reading what was pasted.
    var bring = document.createElement("div");
    bring.id = "bring-over";
    bring.style.cssText = "margin:0 0 10px";
    var bringTitle = document.createElement("strong");
    bringTitle.textContent = "Already set up in StreamElements?";
    var bringHint = document.createElement("p");
    bringHint.className = "hint";
    bringHint.textContent = "In the widget's editor there, open the Data tab, copy everything in it and paste it here. Its settings come across as they are on stream. The Fields tab works too.";
    var bringBox = document.createElement("textarea");
    bringBox.id = "bring-text";
    bringBox.placeholder = "Paste the Data tab here";
    bringBox.style.cssText = "height:60px";
    var bringGo = document.createElement("button");
    bringGo.type = "button";
    bringGo.textContent = "Bring my settings across";
    var bringMsg = document.createElement("p");
    bringMsg.id = "bring-msg";
    bringMsg.className = "hint";
    bringGo.addEventListener("click", function () {
      if (typeof window.__importFromStreamElements !== "function") { bringMsg.textContent = "This page is not ready to load settings yet."; return; }
      bringMsg.textContent = window.__importFromStreamElements(bringBox.value);
    });
    [bringTitle, bringHint, bringBox, bringGo, bringMsg].forEach(function (e) { bring.appendChild(e); });
    panel.appendChild(bring);

    // StreamElements has buttons in a widget's editor, and Mix It Up has none, so each is a function a Mix It Up command can run: an
    // Overlay action with Run Widget Function set to the function's name. They are listed here, with what each does.
    var buttons = document.createElement("details");
    buttons.id = "miu-buttons";
    buttons.style.cssText = "margin:0 0 10px;font-size:12px";
    var sum = document.createElement("summary");
    sum.textContent = "Buttons and channel point rewards: run them from a Mix It Up command";
    buttons.appendChild(sum);
    var how = document.createElement("p");
    how.className = "hint";
    how.textContent = "In a Mix It Up command add an Overlay action, choose Run Widget Function, pick this widget, and give it one of these function names. PressButton also takes the name as a parameter.";
    buttons.appendChild(how);
    var list = document.createElement("ul");
    list.style.cssText = "margin:4px 0;padding-left:18px";
    buttons.appendChild(list);
    fetch("../widget/fields.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (fields) {
      Object.keys(fields).forEach(function (k) {
        if (!fields[k] || fields[k].type !== "button") return;
        var li = document.createElement("li"), code = document.createElement("code");
        code.textContent = k + "()";
        li.appendChild(code);
        li.appendChild(document.createTextNode(" " + String(fields[k].label || "")));
        list.appendChild(li);
      });
      if (!list.children.length) { how.textContent = "This overlay has no buttons."; list.hidden = true; }
    }).catch(function () { how.textContent = "The list of buttons could not be loaded."; });
    var red = document.createElement("p");
    red.className = "hint";
    red.textContent = "A channel point reward, for an overlay that reacts to them: run the function Redemption with the reward's title as its parameter.";
    buttons.appendChild(red);
    panel.appendChild(buttons);

    var grid = document.createElement("div");
    grid.className = "copy-grid";
    var msg = document.createElement("p");
    msg.id = "copy-msg";
    msg.className = "hint";
    var box = document.createElement("textarea");
    box.hidden = true;
    box.readOnly = true;
    function button(label, note, get) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "copy-btn";
      var l = document.createElement("span"), sm = document.createElement("small");
      l.textContent = label; sm.textContent = note;
      b.appendChild(l); b.appendChild(sm);
      b.addEventListener("click", function () {
        b.classList.remove("done", "failed");
        mixItUpWidget().then(function (w) {
          var text = get(w);
          return copyText(text, box).then(function (ok) {
            if (ok) { b.classList.add("done"); msg.textContent = "Copied " + label.replace(/^Copy /, "") + " (" + kb(text) + ")."; setTimeout(function () { b.classList.remove("done"); }, 2500); }
            else { b.classList.add("failed"); msg.textContent = "The browser would not copy it. It is in the box below: press Ctrl+C (or Cmd+C) to copy it."; }
          });
        }).catch(function (e) { b.classList.add("failed"); msg.textContent = e && e.message ? e.message : "Could not make the widget."; });
      });
      return b;
    }
    grid.appendChild(button("Copy the widget", "the whole widget, to paste or import", function (w) { return JSON.stringify(w); }));
    grid.appendChild(button("Copy the HTML", "the HTML box", function (w) { return w.Item.HTML; }));
    grid.appendChild(button("Copy the CSS", "the CSS box", function (w) { return w.Item.CSS; }));
    grid.appendChild(button("Copy the JavaScript", "the JavaScript box", function (w) { return w.Item.Javascript; }));
    var theme = document.createElement("button");
    theme.id = "theme-toggle";
    theme.type = "button";
    var labelTheme = function () { theme.textContent = document.documentElement.getAttribute("data-theme") === "light" ? "Dark mode" : "Light mode"; };
    theme.addEventListener("click", function () { setTheme(document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light"); labelTheme(); });
    labelTheme();
    panel.insertBefore(platformSwitch(), panel.firstChild);
    panel.insertBefore(theme, panel.firstChild);
    panel.appendChild(grid);
    panel.appendChild(msg);
    panel.appendChild(box);
    return panel;
  }

  function build() { return platform() === "mixitup" ? buildMixItUp() : buildStreamElements(); }

  // The page builds its controls after it has fetched the widget, so wait for them, and put the
  // panel back if the page ever rebuilds them.
  function place() {
    var c = document.getElementById("controls");
    // The controls hold only a loading note until the page has built its sections, which have headings.
    if (!c || !c.querySelector("h2") || document.getElementById("copy-panel")) return;
    // After the page's title and its introduction, or at the very top when the page has no title.
    var first = c.firstChild, ref = first;
    if (first.tagName === "H1") {
      ref = first.nextSibling;
      if (ref && ref.className && /hint/.test(ref.className)) ref = ref.nextSibling;
    }
    c.insertBefore(build(), ref);
  }

  function start() {
    var c = document.getElementById("controls");
    if (!c) return;
    place();
    if (typeof MutationObserver === "function") new MutationObserver(place).observe(c, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
}());
