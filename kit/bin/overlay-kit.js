#!/usr/bin/env node
/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* overlay-kit: the standards shared by the overlays in this set. */
"use strict";
const path = require("path");
const { sync } = require("../src/sync");
const K = require("../src/presets");
const { checkContrast } = require("../src/contrast");
const { gallery } = require("../src/gallery");
const { checkSettings } = require("../src/settings");

const args = process.argv.slice(2);
const cmd = args.shift();
const flag = n => { const i = args.indexOf(n); if (i === -1) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const has = n => { const i = args.indexOf(n); if (i === -1) return false; args.splice(i, 1); return true; };

function usage() {
  console.log([
    "overlay-kit sync-presets [dir]         bring an overlay's palette table, dropdown and tests in line with the kit",
    "overlay-kit check-presets [dir]        the same, but only report drift (exit 1 if there is any)",
    "overlay-kit check-settings [dir]      check an overlay's settings use the standard names, types and defaults",
    "overlay-kit check-contrast             check every preset against the contrast standards",
    "overlay-kit gallery <dir>             render the overlay in every preset into docs/presets.png (needs Chromium)",
    "overlay-kit list                       list the presets",
    "",
    "options: --kind <goals|wheel|poll|squat|rage|clock>   --file <widget file>"
  ].join("\n"));
}

if (cmd === "sync-presets" || cmd === "check-presets") {
  const check = cmd === "check-presets", kind = flag("--kind"), file = flag("--file");
  const dir = path.resolve(args[0] || ".");
  let result;
  try { result = sync(dir, { check, kind, file }); } catch (e) { console.error(e.message); process.exit(2); }
  const label = result.info.name + " (" + result.info.kind + ")";
  if (!result.changes.length) { console.log(label + ": up to date with overlay-kit"); process.exit(0); }
  console.log(label + (check ? ": out of date" : ": updated"));
  result.changes.forEach(c => console.log("  " + c));
  process.exit(check ? 1 : 0);
} else if (cmd === "check-settings") {
  const dir = path.resolve(args[0] || ".");
  let problems;
  try { problems = checkSettings(dir); } catch (e) { console.error(e.message); process.exit(2); }
  const name = path.basename(dir);
  if (!problems.length) { console.log(name + ": settings follow the standard"); process.exit(0); }
  console.log(name + ": " + problems.length + " setting problem" + (problems.length === 1 ? "" : "s"));
  problems.forEach(x => console.log("  " + x));
  process.exit(1);
} else if (cmd === "check-contrast") {
  const r = checkContrast();
  r.lines.forEach(l => console.log(l));
  process.exit(r.failures.length ? 1 : 0);
} else if (cmd === "gallery") {
  const out = flag("--out"), only = flag("--only"), chromium = flag("--chromium");
  try {
    const r = gallery(path.resolve(args[0] || "."), { out, only: only ? only.split(",") : null, chromium, log: l => console.log(l) });
    console.log("Wrote " + r.target + " (" + r.tiles + " presets)");
  } catch (e) { console.error(e.message); process.exit(2); }
} else if (cmd === "list") {
  K.PRESETS.forEach(x => console.log(x.key.padEnd(11) + x.label + "  (" + x.font + ")" + (x.flag ? "  [flag]" : "")));
} else { usage(); process.exit(cmd ? 2 : 0); }
