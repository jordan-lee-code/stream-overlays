/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The box-size control at the bottom-left of every overlay's dev page. A StreamElements widget fills whatever box
 * you draw for it, so the best way to see how an overlay behaves is to draw it in different boxes. This sets the
 * size of the page's stage, in pixels, from two number boxes or a list of common sizes, and remembers it for the next
 * visit. Its look, the dashed outline round the stage and the scrolling of a box bigger than the pane are in dev.css.
 *
 * Nothing in the widget knows about this: it only changes the size of the box the widget is drawn in, as dragging a
 * widget's handles in StreamElements would. A page that scales its stage to fit the pane (Rage Bar does) listens for
 * the window's resize event, which is sent after every change. */
(function () {
  "use strict";

  var PRESETS = [[200, 400], [400, 200], [420, 130], [640, 360], [800, 400], [1200, 300], [1920, 1080]];
  var MIN = 40, MAX = 4000;

  var stage = document.getElementById("stage");
  if (!stage || !document.body) return;
  var wrap = document.getElementById("stage-wrap");
  var KEY = "boxsize:" + location.pathname.replace(/[^\/]*$/, "");
  var own = null;                    // the size this page starts with, found once the page has laid out
  var inputW, inputH, preset, note;

  function clamp(n) { return Math.max(MIN, Math.min(MAX, Math.round(n))); }
  function saved() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); return s && s.w && s.h ? { w: clamp(s.w), h: clamp(s.h) } : null; } catch (e) { return null; }
  }
  function remember(box) {
    try { if (box) localStorage.setItem(KEY, JSON.stringify(box)); else localStorage.removeItem(KEY); } catch (e) { /* it still works, just forgotten */ }
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }

  // Sets the box, tells the page, and shows it. `box` is null for the page's own size.
  function apply(box, keep) {
    var w = box ? box.w : own.w, h = box ? box.h : own.h;
    stage.style.width = w + "px";
    stage.style.height = h + "px";
    stage.style.maxWidth = "none";
    inputW.value = w; inputH.value = h;
    var match = "";
    PRESETS.forEach(function (p) { if (p[0] === w && p[1] === h) match = p[0] + "x" + p[1]; });
    preset.value = !box || (own && w === own.w && h === own.h && !match) ? "own" : (match || "custom");
    note.textContent = box ? "" : "the page's own size";
    if (keep !== false) remember(box);
    window.dispatchEvent(new Event("resize"));
  }
  function fromInputs() {
    var w = parseFloat(inputW.value), h = parseFloat(inputH.value);
    if (isNaN(w) || isNaN(h)) { apply(saved()); return; }
    apply({ w: clamp(w), h: clamp(h) });
  }

  function build() {
    var bar = el("div", { id: "box-size" });
    bar.appendChild(el("label", { "for": "box-w" }, "Box"));
    inputW = el("input", { id: "box-w", type: "number", min: MIN, max: MAX, step: 10, "aria-label": "Box width in pixels" });
    inputH = el("input", { id: "box-h", type: "number", min: MIN, max: MAX, step: 10, "aria-label": "Box height in pixels" });
    bar.appendChild(inputW);
    bar.appendChild(el("span", {}, "×"));
    bar.appendChild(inputH);
    bar.appendChild(el("span", {}, "px"));
    preset = el("select", { id: "box-preset", "aria-label": "Common box sizes" });
    preset.appendChild(el("option", { value: "own" }, "This page's own size"));
    PRESETS.forEach(function (p) { preset.appendChild(el("option", { value: p[0] + "x" + p[1] }, p[0] + " × " + p[1])); });
    preset.appendChild(el("option", { value: "custom" }, "Custom"));
    bar.appendChild(preset);
    var reset = el("button", { id: "box-reset", type: "button" }, "Reset");
    bar.appendChild(reset);
    note = el("span", { "class": "note" });
    bar.appendChild(note);
    document.body.appendChild(bar);

    inputW.addEventListener("change", fromInputs);
    inputH.addEventListener("change", fromInputs);
    preset.addEventListener("change", function () {
      if (preset.value === "own") apply(null);
      else if (preset.value !== "custom") { var p = preset.value.split("x"); apply({ w: +p[0], h: +p[1] }); }
    });
    reset.addEventListener("click", function () { apply(null); });
  }

  function start() {
    // Measured before anything is changed: this is the size the page's own stylesheet gives the stage.
    own = { w: stage.offsetWidth, h: stage.offsetHeight };
    build();
    var s = saved();
    apply(s, false);
    if (!s) remember(null);
  }
  if (document.readyState === "complete") start(); else window.addEventListener("load", start);
}());
