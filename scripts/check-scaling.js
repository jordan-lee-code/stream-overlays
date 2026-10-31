/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Checks that every overlay fits the box it is given, whatever its size. Each overlay is drawn in headless
 * Chromium, with the scene from its docs/gallery.json, in boxes of several shapes, and what is visible of it
 * (after anything clipped by an ancestor is left out) has to stay inside the box.
 *
 *   node scripts/check-scaling.js [overlay ...]
 *
 * It needs Chromium or Chrome and skips, with a note, where there is none. A box of 400 by 90 is left out on
 * purpose: it cannot hold a clock and a list of goals together, whatever the widget does.
 * CHROMIUM names the browser to use, and SCALING_JOBS how many windows are open at once (4 by default). */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync, execFile } = require("child_process");
const { page } = require("../kit/src/gallery");

const ROOT = path.join(__dirname, "..");
const SIZES = [[400, 200], [800, 400], [1200, 300], [200, 400]];
const JOBS = Math.max(1, parseInt(process.env.SCALING_JOBS, 10) || 4);
const SLACK = 2;           // pixels of rounding that are not an overflow

function findChromium() {
  for (const c of [process.env.CHROMIUM, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].filter(Boolean)) {
    if (spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0) return c;
  }
  return null;
}

// Runs in the page: how far the visible content goes past the stage, at the bottom and the right.
const MEASURE = `setTimeout(function () {
  var st = document.getElementById("stage"), sr = st.getBoundingClientRect(), root = st.firstElementChild, bottom = 0, right = 0;
  function visible(e) {
    var r = e.getBoundingClientRect(), L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (var p = e.parentElement; p && p !== document.body; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
      var pr = p.getBoundingClientRect();
      if (cs.overflowX !== "visible") { L = Math.max(L, pr.left); R = Math.min(R, pr.right); }
      if (cs.overflowY !== "visible") { T = Math.max(T, pr.top); B = Math.min(B, pr.bottom); }
    }
    return R > L && B > T ? { right: R, bottom: B } : null;
  }
  [].forEach.call(root.querySelectorAll("*"), function (e) {
    var cs = getComputedStyle(e);
    if (cs.visibility === "hidden" || cs.display === "none" || cs.opacity === "0") return;
    var v = visible(e);
    if (!v) return;
    bottom = Math.max(bottom, v.bottom); right = Math.max(right, v.right);
  });
  document.title = JSON.stringify({ y: Math.round(bottom - sr.bottom), x: Math.round(right - sr.right) });
}, 1800);`;

function measure(chromium, tmp, name, w, h, index) {
  return new Promise((resolve, reject) => {
    const dir = path.join(ROOT, "overlays", name), cfg = JSON.parse(fs.readFileSync(path.join(dir, "docs", "gallery.json"), "utf8"));
    const file = path.join(tmp, "page-" + index + ".html");
    fs.writeFileSync(file, page(dir, { key: "glass" }, Object.assign({}, cfg.fields || {}, { themePreset: "glass" }), (cfg.script || "") + ";" + MEASURE, w, h));
    execFile(chromium, ["--headless", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=6000", "--user-data-dir=" + path.join(tmp, "profile-" + index), "--dump-dom", "file://" + file],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 90000 }, (err, dom) => {
        const m = !err && /<title>([^<]*)<\/title>/.exec(dom || "");
        if (!m) { reject(new Error(name + " at " + w + " by " + h + ": the page did not report its size")); return; }
        try { resolve(JSON.parse(m[1].replace(/&quot;/g, '"'))); } catch (e) { reject(e); }
      });
  });
}

(async () => {
  const chromium = findChromium();
  if (!chromium) { console.log("No Chromium or Chrome found, so the scaling check is skipped. Set CHROMIUM to its path to run it."); process.exit(0); }
  const all = fs.readdirSync(path.join(ROOT, "overlays")).filter(n => fs.existsSync(path.join(ROOT, "overlays", n, "docs", "gallery.json"))).sort();
  const names = process.argv.length > 2 ? process.argv.slice(2) : all;
  const unknown = names.filter(n => all.indexOf(n) === -1);
  if (unknown.length) { console.error("No such overlay, or it has no docs/gallery.json: " + unknown.join(", ")); process.exit(2); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scaling-"));
  const jobs = [];
  names.forEach(n => SIZES.forEach(([w, h]) => jobs.push({ name: n, w, h, index: jobs.length })));
  const results = new Array(jobs.length);
  let next = 0, failed = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, async () => {
      while (next < jobs.length) { const j = jobs[next++]; results[j.index] = await measure(chromium, tmp, j.name, j.w, j.h, j.index).catch(e => ({ error: e.message })); }
    }));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }

  const w = Math.max.apply(null, names.map(n => n.length));
  console.log("Overlay".padEnd(w) + "  " + SIZES.map(s => (s[0] + "x" + s[1]).padEnd(12)).join(""));
  names.forEach(n => {
    const cells = SIZES.map(([sw, sh]) => {
      const r = results[jobs.findIndex(j => j.name === n && j.w === sw && j.h === sh)];
      if (r.error) { failed++; return "ERROR".padEnd(12); }
      if (r.y > SLACK || r.x > SLACK) { failed++; return ("over " + (r.x > SLACK ? "x" + r.x : "") + (r.y > SLACK ? "y" + r.y : "")).padEnd(12); }
      return "fits".padEnd(12);
    });
    console.log(n.padEnd(w) + "  " + cells.join(""));
  });
  results.filter(r => r.error).forEach(r => console.log("  " + r.error));
  console.log("\n" + (failed ? failed + " of " + jobs.length + " boxes had content running outside them." : "Every overlay fits all " + jobs.length + " boxes."));
  process.exit(failed ? 1 : 0);
})();
