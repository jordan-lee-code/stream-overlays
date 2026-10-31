/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Looks for tests that fail only sometimes. Each suite is run many times at once, which makes the
 * machine slow and busy, the way a shared CI runner is, and a test that depended on timing or on
 * order shows up as a run that fails when the others pass.
 *
 *   node scripts/stress.js [copies] [suite ...]
 *
 * `copies` is how many runs of each suite (20 by default). STRESS_JOBS is how many run at once
 * (12 by default). It makes a computer very busy, so it is meant for CI, where the workflow in
 * .github/workflows/stress.yml runs it, and not for a laptop. It exits non-zero if any run failed,
 * and lists each failing check with how many runs it failed in. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const copies = /^\d+$/.test(args[0] || "") ? parseInt(args.shift(), 10) : 20;
const JOBS = Math.max(1, parseInt(process.env.STRESS_JOBS, 10) || 12);

const all = fs.readdirSync(path.join(ROOT, "overlays")).filter(n => fs.statSync(path.join(ROOT, "overlays", n)).isDirectory()).sort();
const wanted = args.length ? args : ["kit"].concat(all);
const unknown = wanted.filter(n => n !== "kit" && all.indexOf(n) === -1);
if (unknown.length) { console.error("No such suite: " + unknown.join(", ")); process.exit(2); }

function command(name) {
  if (name === "kit") return { cmd: "node", args: [path.join(ROOT, "kit", "test", "test.js")], cwd: ROOT };
  return { cmd: "npm", args: ["test", "--silent"], cwd: path.join(ROOT, "overlays", name) };
}

function run(name) {
  return new Promise(resolve => {
    const c = command(name), began = Date.now();
    let out = "";
    const child = spawn(c.cmd, c.args, { cwd: c.cwd, env: process.env });
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { out += d; });
    child.on("error", e => resolve({ ok: false, out: String(e), ms: Date.now() - began }));
    child.on("close", code => resolve({ ok: code === 0 && /=== \d+ passed, 0 failed ===/.test(out), out, ms: Date.now() - began }));
  });
}

(async () => {
  const started = Date.now();
  const queue = [];
  wanted.forEach(name => { for (let i = 0; i < copies; i++) queue.push(name); });
  const results = {};
  wanted.forEach(n => { results[n] = []; });
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (next < queue.length) { const name = queue[next++]; results[name].push(await run(name)); }
  }));

  let flaky = 0;
  const w = Math.max.apply(null, wanted.map(n => n.length));
  console.log("\n" + "Suite".padEnd(w) + "  Runs  Failed  Slowest");
  wanted.forEach(name => {
    const rs = results[name], bad = rs.filter(r => !r.ok);
    const slowest = Math.max.apply(null, rs.map(r => r.ms));
    console.log(name.padEnd(w) + "  " + String(rs.length).padStart(4) + "  " + String(bad.length).padStart(6) + "  " + (slowest / 1000).toFixed(1) + "s");
    if (!bad.length) return;
    flaky++;
    const counts = {};
    bad.forEach(r => {
      const fails = r.out.split("\n").filter(l => /^\s*FAIL\b/.test(l)).map(l => l.replace(/^\s*FAIL\s*/, ""));
      (fails.length ? fails : ["(no failing check reported; " + r.out.split("\n").filter(Boolean).slice(-1)[0] + ")"]).forEach(f => { counts[f] = (counts[f] || 0) + 1; });
    });
    Object.keys(counts).sort((a, b) => counts[b] - counts[a]).forEach(f => console.log("    failed in " + counts[f] + " of " + rs.length + " runs: " + f));
  });
  console.log("\n" + (flaky ? flaky + " of " + wanted.length + " suites failed in some runs, so they are not reliable." : "No suite failed in any of " + (queue.length).toLocaleString("en-GB") + " runs.") + "  (" + ((Date.now() - started) / 1000).toFixed(1) + "s, " + Math.min(JOBS, queue.length) + " at a time)");
  process.exit(flaky ? 1 : 0);
})();
