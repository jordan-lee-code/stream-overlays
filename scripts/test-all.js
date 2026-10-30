/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Runs every check in the repo: the kit's own tests, the contrast standards, that each overlay's
 * presets match the kit, and each overlay's own tests. `node scripts/test-all.js counter reminder`
 * runs just those overlays (the kit's checks always run). */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const KIT = path.join(ROOT, "kit", "bin", "overlay-kit.js");
const wanted = process.argv.slice(2);
const overlays = fs.readdirSync(path.join(ROOT, "overlays"))
  .filter(n => fs.statSync(path.join(ROOT, "overlays", n)).isDirectory()).sort()
  .filter(n => !wanted.length || wanted.indexOf(n) !== -1);
if (wanted.length && overlays.length !== wanted.length) {
  console.error("No such overlay: " + wanted.filter(w => overlays.indexOf(w) === -1).join(", "));
  process.exit(2);
}

const rows = [];
let failed = false;
function run(label, cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: process.env });
  const out = (r.stdout || "") + (r.stderr || "");
  const counts = (out.match(/=== \d+ passed, \d+ failed ===/g) || []).map(s => s.replace(/=== | ===/g, ""));
  const ok = r.status === 0;
  if (!ok) { failed = true; console.log("\n----- " + label + " failed -----\n" + out.split("\n").slice(-40).join("\n")); }
  rows.push([label, ok ? "ok" : "FAILED", counts.join("; ") || (ok ? "" : "see above")]);
}

run("kit tests", "node", [path.join(ROOT, "kit", "test", "test.js")], ROOT);
run("kit contrast standards", "node", [KIT, "check-contrast"], ROOT);
overlays.forEach(n => {
  const dir = path.join(ROOT, "overlays", n);
  run(n + " presets match the kit", "node", [KIT, "check-presets", dir], ROOT);
  run(n + " settings follow the standard", "node", [KIT, "check-settings", dir], ROOT);
  run(n + " tests", "npm", ["test", "--silent"], dir);
});

const w = Math.max.apply(null, rows.map(r => r[0].length));
console.log("\n" + rows.map(r => "  " + r[0].padEnd(w) + "  " + r[1].padEnd(7) + r[2]).join("\n"));
console.log("\n" + (failed ? "Some checks failed." : "Everything passes."));
process.exit(failed ? 1 : 0);
