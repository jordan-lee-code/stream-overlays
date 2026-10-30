#!/usr/bin/env node
/* Builds a StreamElements overlay export JSON that embeds the Squat Tracker
 * custom widget, generated straight from the files in ../widget so the overlay
 * never drifts from the source. Run: `node build/build-overlay.js`.
 *
 * Output: dist/squat-tracker.overlay.json
 *
 * Note: the StreamElements overlay-export envelope is not publicly documented, so
 * this mirrors the well-established structure (a top-level overlay with a
 * `widgets` array; each custom widget carries html/css/js, its field definitions
 * in `fields`, and the saved values in `data`). If a future SE import rejects it,
 * the paste-in method in the README is the proven fallback.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const W = path.join(ROOT, "widget");
const read = (f) => fs.readFileSync(path.join(W, f), "utf8");

const html = read("widget.html");
const css = read("widget.css");
const js = read("widget.js");
const fields = JSON.parse(read("fields.json"));

// Saved field values: every non-button field mapped to its default value.
const data = {};
Object.keys(fields).forEach((k) => {
  if (fields[k] && fields[k].type !== "button") data[k] = fields[k].value;
});

// A stable id so re-importing replaces rather than duplicates where SE allows.
const WIDGET_ID = "squat-tracker-overlay-0001";

// A small sticker box, sat up near the top of a 1920x1080 canvas by default. It
// is easy to drag anywhere once it is on the overlay.
const CANVAS = { width: 1920, height: 1080 };
const SIZE = { width: 340, height: 220 };
const x = Math.round((CANVAS.width - SIZE.width) / 2);
const y = 120;

const widget = {
  id: WIDGET_ID,
  type: "custom",
  name: "Squat Tracker",
  x: x,
  y: y,
  width: SIZE.width,
  height: SIZE.height,
  position: { x: x, y: y },
  size: { width: SIZE.width, height: SIZE.height },
  rotation: 0,
  locked: false,
  hidden: false,
  html: html,
  css: css,
  js: js,
  fields: fields,
  data: data
};

const overlay = {
  name: "Squat Tracker",
  widgets: [widget],
  width: CANVAS.width,
  height: CANVAS.height
};

const outDir = path.join(ROOT, "dist");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "squat-tracker.overlay.json");
fs.writeFileSync(outFile, JSON.stringify(overlay, null, 2));

const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log("Wrote " + path.relative(ROOT, outFile) + " (" + kb + " KB)");
console.log("Embedded fields: " + Object.keys(fields).length + ", saved values: " + Object.keys(data).length);
