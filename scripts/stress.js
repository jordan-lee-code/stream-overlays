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
 * and lists each failing check with how many runs it failed in.
 *
 * An overlay's `npm test` can be several steps joined with &&. A step that builds files is run once,
 * before the copies start, because copies that each rebuilt the same files would trample one
 * another and fail for a reason that has nothing to do with the tests. Each other step is its own
 * suite. A step that drives a real browser (a layout test) is repeated only STRESS_BROWSER_COPIES
 * times (3 by default), because every run opens several browser windows and what it measures does
 * not depend on timing. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const copies = /^\d+$/.test(args[0] || "") ? parseInt(args.shift(), 10) : 20;
const JOBS = Math.max(1, parseInt(process.env.STRESS_JOBS, 10) || 12);
const BROWSER_COPIES = Math.max(1, parseInt(process.env.STRESS_BROWSER_COPIES, 10) || 3);

const all = fs.readdirSync(path.join(ROOT, "overlays")).filter(n => fs.statSync(path.join(ROOT, "overlays", n)).isDirectory()).sort();
const wanted = args.length ? args : ["kit"].concat(all);
const unknown = wanted.filter(n => n !== "kit" && all.indexOf(n) === -1);
if (unknown.length) { console.error("No such suite: " + unknown.join(", ")); process.exit(2); }

// What to run for one name: steps to do once first, and the suites to repeat.
function plan(name) {
  if (name === "kit") return { setup: [], suites: [{ label: "kit", cmd: "node kit/test/test.js", cwd: ROOT, copies }] };
  const cwd = path.join(ROOT, "overlays", name);
  const test = (JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")).scripts || {}).test || "";
  const steps = test.split("&&").map(s => s.trim()).filter(Boolean);
  const setup = steps.filter(s => /\bbuild\//.test(s)).map(cmd => ({ cmd, cwd }));
  const runs = steps.filter(s => setup.every(x => x.cmd !== s));
  return {
    setup,
    suites: runs.map(cmd => {
      const stem = (/test[\\/]+test-([\w-]+)\.js/.exec(cmd) || [])[1];
      const browser = /layout/.test(cmd);
      return { label: runs.length > 1 && stem ? name + " (" + stem + ")" : name, cmd, cwd, copies: browser ? Math.min(copies, BROWSER_COPIES) : copies };
    })
  };
}

function run(suite) {
  return new Promise(resolve => {
    const began = Date.now();
    let out = "";
    const child = spawn("sh", ["-c", suite.cmd], { cwd: suite.cwd, env: process.env });
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { out += d; });
    child.on("error", e => resolve({ ok: false, out: String(e), ms: Date.now() - began }));
    child.on("close", code => resolve({ ok: code === 0 && /=== \d+ passed, 0 failed ===/.test(out), out, ms: Date.now() - began }));
  });
}

(async () => {
  const started = Date.now();
  const suites = [];
  for (const name of wanted) {
    const p = plan(name);
    for (const step of p.setup) {
      const r = spawnSync("sh", ["-c", step.cmd], { cwd: step.cwd, encoding: "utf8" });
      if (r.status !== 0) { console.error(name + ": the build step failed\n" + (r.stdout || "") + (r.stderr || "")); process.exit(1); }
    }
    p.suites.forEach(s => suites.push(s));
  }
  const queue = [];
  suites.forEach(s => { for (let i = 0; i < s.copies; i++) queue.push(s); });
  const results = new Map();
  suites.forEach(s => results.set(s, []));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    while (next < queue.length) { const s = queue[next++]; results.get(s).push(await run(s)); }
  }));

  let flaky = 0;
  const w = Math.max.apply(null, suites.map(s => s.label.length));
  console.log("\n" + "Suite".padEnd(w) + "  Runs  Failed  Slowest");
  suites.forEach(s => {
    const rs = results.get(s), bad = rs.filter(r => !r.ok);
    const slowest = Math.max.apply(null, rs.map(r => r.ms));
    console.log(s.label.padEnd(w) + "  " + String(rs.length).padStart(4) + "  " + String(bad.length).padStart(6) + "  " + (slowest / 1000).toFixed(1) + "s");
    if (!bad.length) return;
    flaky++;
    const counts = {};
    bad.forEach(r => {
      const fails = r.out.split("\n").filter(l => /^\s*FAIL\b/.test(l)).map(l => l.replace(/^\s*FAIL\s*/, ""));
      (fails.length ? fails : ["(no failing check reported; " + r.out.split("\n").filter(Boolean).slice(-1)[0] + ")"]).forEach(f => { counts[f] = (counts[f] || 0) + 1; });
    });
    Object.keys(counts).sort((a, b) => counts[b] - counts[a]).forEach(f => console.log("    failed in " + counts[f] + " of " + rs.length + " runs: " + f));
  });
  console.log("\n" + (flaky ? flaky + " of " + suites.length + " suites failed in some runs, so they are not reliable." : "No suite failed in any of " + (queue.length).toLocaleString("en-GB") + " runs.") + "  (" + ((Date.now() - started) / 1000).toFixed(1) + "s, " + Math.min(JOBS, queue.length) + " at a time)");
  process.exit(flaky ? 1 : 0);
})();
