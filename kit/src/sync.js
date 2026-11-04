/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Brings an overlay repo's copy of the shared parts in line with the kit, or, in check mode,
 * says where it has drifted. Nothing is written in check mode. */
"use strict";
const fs = require("fs");
const path = require("path");
const K = require("./presets");
const { pyJson } = require("./format");

// How each overlay writes its palette table. Anything not listed here is a clock-shaped overlay
// whose widget is widget/widget.js. (An overlay's folder name is how it is recognised.)
const KINDS = {
  "sub-goals": { kind: "goals" },
  "spin-wheel": { kind: "wheel" },
  "chat-poll": { kind: "poll" },
  "squat-tracker": { kind: "squat" },
  "rage-bar": { kind: "rage" },
  "subathon": { kind: "clock", file: "src/clock.js" }
};

const read = p => fs.readFileSync(p, "utf8");

function describe(dir, opts) {
  opts = opts || {};
  const name = path.basename(path.resolve(dir));
  const known = KINDS[name] || {};
  return { name, kind: opts.kind || known.kind || "clock", file: opts.file || known.file || "widget/widget.js" };
}

/** The PRESETS block of a widget, from `  var PRESETS = {` to its closing `  };`. */
function blockRange(src) {
  const i = src.indexOf("  var PRESETS = {");
  if (i === -1) return null;
  const j = src.indexOf("\n  };", i);
  return j === -1 ? null : [i, j + "\n  };".length];
}

// fields.json files first written by a tool that escaped non-ASCII keep doing so, so a sync
// changes only what it means to change.
function escapeNonAscii(text) {
  return text.replace(/[\u0080-￿]/g, c => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4));
}

function sync(dir, opts) {
  opts = opts || {};
  const info = describe(dir, opts), changes = [], write = (rel, text, what) => {
    const p = path.join(dir, rel);
    if (fs.existsSync(p) && read(p) === text) return;
    changes.push(rel + ": " + what);
    if (!opts.check) fs.writeFileSync(p, text);
  };

  // 1. the palette table in the widget
  const widgetPath = path.join(dir, info.file);
  if (!fs.existsSync(widgetPath)) throw new Error("No " + info.file + " in " + dir + ". Is this an overlay repo?");
  const src = read(widgetPath), range = blockRange(src);
  if (!range) throw new Error("No `var PRESETS = {` table in " + info.file + ".");
  write(info.file, src.slice(0, range[0]) + K.generators[info.kind]() + src.slice(range[1]), "the preset table");

  // 2. the dropdown, where the overlay has its own
  const fieldsPath = path.join(dir, "widget/fields.json");
  if (fs.existsSync(fieldsPath)) {
    const raw = read(fieldsPath), fields = JSON.parse(raw);
    if (fields.themePreset) {
      fields.themePreset.options = K.options();
      let out = JSON.stringify(fields, null, 2) + "\n";
      if (/\\u00[0-9a-f]{2}/.test(raw)) out = escapeNonAscii(out);
      write("widget/fields.json", out, "the style preset dropdown");
    }
  }

  // 3. what the tests expect, as data or as lines in the test file
  const expectedPath = path.join(dir, "test/presets.expected.json");
  if (fs.existsSync(expectedPath)) write("test/presets.expected.json", JSON.stringify(K.expected(), null, 2), "the expected palette data");
  const testDir = path.join(dir, "test");
  if (fs.existsSync(testDir)) {
    fs.readdirSync(testDir).filter(f => f.endsWith(".js") && f !== "mock.js").forEach(f => {
      const text = read(path.join(testDir, f));
      if (text.indexOf("const EXPECT = ") === -1) return;
      const exp = {};
      K.PRESETS.forEach(x => { exp[x.key] = { text: x.text, accent: x.accent, panel: x.panel, font: x.font }; });
      const next = text
        .replace(/const EXPECT = \{.*\};/, () => "const EXPECT = " + pyJson(exp) + ";")
        .replace(/const LABELS = \{.*\};/, () => "const LABELS = " + pyJson(K.options()) + ";")
        .replace(/Object\.keys\(LABELS\)\.length === \d+/, "Object.keys(LABELS).length === " + (K.PRESETS.length + 1));
      write("test/" + f, next, "the palette the test expects");
    });
  }

  // 3b. the shared blocks, kept identical in every overlay that carries them: the small helpers every widget
  // uses, and, in the widgets that read the common settings, those settings and the theme code with them
  const jsRel = info.file;
  const jsPath = path.join(dir, jsRel);
  if (fs.existsSync(jsPath)) {
    const original = read(jsPath);
    let w = original;
    const common = read(path.join(__dirname, "..", "shared", "common.js"));
    const A = { start: "  // ---- shared by every overlay in this set ----", end: "  // ---- end of the shared primitives ----\n" };
    const B = { start: "  // The settings every overlay in this set shares.", end: "  // ---- end of the shared settings and theme ----\n" };
    // A copy that has no end marker yet is replaced up to where the old section ended.
    const swap = (blk, fallbackStop) => {
      const at = w.indexOf(blk.start);
      if (at === -1) return;
      const endAt = w.indexOf(blk.end, at);
      const stop = endAt !== -1 ? endAt + blk.end.length : fallbackStop(at);
      if (stop === -1) return;
      w = w.slice(0, at) + common.slice(common.indexOf(blk.start), common.indexOf(blk.end) + blk.end.length) + w.slice(stop);
    };
    swap(A, at => w.indexOf(B.start, at));
    swap(B, at => {
      const d = w.indexOf("  function debugLog(", at), close = d === -1 ? -1 : w.indexOf("\n  }\n", d);
      return close === -1 ? -1 : close + "\n  }\n".length;
    });
    // The decorations: one more shared block, put in where there is none yet, after the theme code or else before the widget starts
    // listening for events, and replaced where there is.
    const decor = read(path.join(__dirname, "..", "shared", "decor.js"));
    const D = { start: "  // ---- decorations, shared by every overlay in this set ----", end: "  // ---- end of the decorations ----\n" };
    const dAt = w.indexOf(D.start);
    if (dAt !== -1) {
      const dEnd = w.indexOf(D.end, dAt);
      if (dEnd !== -1) w = w.slice(0, dAt) + decor + w.slice(dEnd + D.end.length);
    } else {
      const themeEnd = w.indexOf(B.end);
      const listen = w.indexOf('  window.addEventListener("onWidgetLoad"');
      if (themeEnd !== -1) w = w.slice(0, themeEnd + B.end.length) + "\n" + decor + w.slice(themeEnd + B.end.length);
      else if (listen !== -1) w = w.slice(0, listen) + decor + "\n" + w.slice(listen);
    }
    if (w !== original) write(jsRel, w, "the shared primitives, theme and decorations");
  }

  // 3c. the decorations' stylesheet, a block kept identical in every overlay
  const cssRel = jsRel.replace(/widget\/widget\.js$/, "widget/widget.css").replace(/src\/clock\.js$/, "src/clock.css");
  const cssPath = path.join(dir, cssRel);
  if (cssRel !== jsRel && fs.existsSync(cssPath)) {
    const css = read(cssPath), block = read(path.join(__dirname, "..", "shared", "decor.css"));
    const CS = "/* ---- decorations, shared by every overlay in this set ---- */", CE = "/* ---- end of the decorations ---- */\n";
    const cAt = css.indexOf(CS);
    let next;
    if (cAt !== -1) { const cEnd = css.indexOf(CE, cAt); next = cEnd === -1 ? css : css.slice(0, cAt) + block + css.slice(cEnd + CE.length); }
    else next = css.replace(/\n*$/, "\n\n") + block;
    if (next !== css) write(cssRel, next, "the shared decorations stylesheet");
  }

  // 4. the shared test mock
  const mockPath = path.join(dir, "test/mock.js"), clockPath = path.join(dir, "test/clock.js");
  if (fs.existsSync(mockPath)) write("test/mock.js", read(path.join(__dirname, "..", "shared", "mock.js")), "the shared test mock");
  // The mock needs the clock, and a suite with its own page mock can use it too, by having the file.
  if (fs.existsSync(mockPath) || fs.existsSync(clockPath)) write("test/clock.js", read(path.join(__dirname, "..", "shared", "clock.js")), "the shared test clock");

  // 5. the copy panel every dev page loads, so people can copy an overlay's files without downloading it
  if (fs.existsSync(path.join(dir, "dev/index.html"))) write("dev/copy-panel.js", read(path.join(__dirname, "..", "shared", "copy-panel.js")), "the shared copy panel");
  if (fs.existsSync(path.join(dir, "dev/index.html"))) write("dev/design-panel.js", read(path.join(__dirname, "..", "shared", "design-panel.js")), "the shared design panel");
  if (fs.existsSync(path.join(dir, "dev/index.html"))) write("dev/snapshot-panel.js", read(path.join(__dirname, "..", "shared", "snapshot-panel.js")), "the shared troubleshooting import panel");
  // The dev page has to load it, straight after the design panel.
  if (fs.existsSync(path.join(dir, "dev/index.html"))) {
    const html = read(path.join(dir, "dev/index.html")), tag = '<script src="snapshot-panel.js"></script>', after = '<script src="design-panel.js"></script>';
    if (html.indexOf(tag) === -1 && html.indexOf(after) !== -1) {
      const indent = (/^([ \t]*)<script src="design-panel\.js">/m.exec(html) || ["", "  "])[1];
      write("dev/index.html", html.replace(after, after + "\n" + indent + tag), "the troubleshooting import panel's script tag");
    }
  }
  if (fs.existsSync(path.join(dir, "dev/index.html"))) write("dev/box-size.js", read(path.join(__dirname, "..", "shared", "box-size.js")), "the shared box-size control");
  if (fs.existsSync(path.join(dir, "dev/index.html"))) write("dev/dev.css", read(path.join(__dirname, "..", "shared", "dev.css")), "the shared dev page stylesheet");

  return { info, changes };
}

module.exports = { sync, describe, KINDS };
