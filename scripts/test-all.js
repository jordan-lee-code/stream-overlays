/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Runs every check in the repo: the kit's own tests, the contrast standards, that each overlay's
 * presets match the kit, and each overlay's own tests. `node scripts/test-all.js counter reminder`
 * runs just those overlays (the kit's checks always run).
 *
 * The checks are separate processes and most of them spend their time waiting on timers, so they
 * run side by side, up to TEST_JOBS at once (8 by default, which suits work that is mostly waiting).
 * TEST_JOBS=1 runs them one after another. Results are always printed in the same order, one row
 * for each suite, with anything that failed set out after the table. NO_COLOR turns colour off. */
"use strict";
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

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

const JOBS = Math.max(1, parseInt(process.env.TEST_JOBS, 10) || 8);

// What to run, in the order it is reported.
const jobs = [];
const add = (label, cmd, args, cwd, suite, kind) => jobs.push({ label, cmd, args, cwd, suite, kind });
add("kit tests", "node", [path.join(ROOT, "kit", "test", "test.js")], ROOT, "kit", "tests");
add("kit contrast standards", "node", [KIT, "check-contrast"], ROOT, "kit", "checks");
overlays.forEach(n => {
  const dir = path.join(ROOT, "overlays", n);
  add(n + " presets match the kit", "node", [KIT, "check-presets", dir], ROOT, n, "checks");
  add(n + " settings follow the standard", "node", [KIT, "check-settings", dir], ROOT, n, "checks");
  add(n + " tests", "npm", ["test", "--silent"], dir, n, "tests");
});

function execute(job) {
  return new Promise(resolve => {
    const began = Date.now();
    let out = "";
    const child = spawn(job.cmd, job.args, { cwd: job.cwd, env: process.env });
    child.stdout.on("data", d => { out += d; });
    child.stderr.on("data", d => { out += d; });
    child.on("error", e => { out += String(e); resolve({ ok: false, out, ms: Date.now() - began }); });
    child.on("close", code => resolve({ ok: code === 0, out, ms: Date.now() - began }));
  });
}

(async () => {
  const started = Date.now();
  const results = new Array(jobs.length);
  let next = 0;
  // The slowest suites start first, so the whole run is not left waiting on one that began last.
  const order = jobs.map((j, i) => i).sort((a, b) => (/ tests$/.test(jobs[b].label) ? 1 : 0) - (/ tests$/.test(jobs[a].label) ? 1 : 0));
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, async () => {
    while (next < order.length) {
      const at = order[next++];
      results[at] = await execute(jobs[at]);
    }
  }));

  // ---- the report: one row for each suite, then whatever failed
  const color = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR || process.env.GITHUB_ACTIONS);
  const paint = (code, text) => color ? "\x1b[" + code + "m" + text + "\x1b[0m" : text;
  const green = t => paint("32", t), red = t => paint("1;31", t), dim = t => paint("2", t), bold = t => paint("1", t);
  const countsOf = out => (out.match(/=== \d+ passed, \d+ failed ===/g) || []).map(x => /(\d+) passed, (\d+) failed/.exec(x).slice(1).map(Number));
  const suites = [], byName = {};
  jobs.forEach((job, i) => {
    const suite = byName[job.suite] || (byName[job.suite] = { name: job.suite, checks: [], tests: null, ms: 0 });
    if (suite.checks.length === 0 && !suite.tests && suites.indexOf(suite) === -1) suites.push(suite);
    const r = results[i];
    r.job = job;
    suite.ms = Math.max(suite.ms, r.ms);
    if (job.kind === "tests") suite.tests = r; else suite.checks.push(r);
  });
  let passed = 0, problems = 0;
  const failures = [];
  const rows = suites.map(suite => {
    const badChecks = suite.checks.filter(r => !r.ok);
    const t = suite.tests, c = t ? countsOf(t.out) : [];
    const p = c.reduce((a, x) => a + x[0], 0), f = c.reduce((a, x) => a + x[1], 0);
    passed += p;
    badChecks.forEach(r => failures.push(r));
    if (t && !t.ok) failures.push(t);
    if (badChecks.length || (t && !t.ok)) problems++;
    const checks = badChecks.length ? red("FAILED") : green("ok");
    const tests = !t ? dim("") : t.ok ? green(p + " passed") : red((f ? f + " failed, " : "crashed, ") + p + " passed");
    return { name: suite.name, checks, checksText: badChecks.length ? "FAILED" : "ok", tests, testsText: !t ? "" : t.ok ? p + " passed" : (f ? f + " failed, " : "crashed, ") + p + " passed", time: (suite.ms / 1000).toFixed(1) + "s" };
  });
  const w = Math.max(5, ...rows.map(r => r.name.length));
  const tw = Math.max(5, ...rows.map(r => r.testsText.length));
  const line = (a, b, c, d) => "  " + a + " ".repeat(w - a.length) + "  " + b.text + " ".repeat(8 - b.plain.length) + c.text + " ".repeat(tw - c.plain.length) + "  " + d.padStart(6);
  console.log("\n" + bold(line("Suite", { text: "Checks", plain: "Checks" }, { text: "Tests", plain: "Tests" }, "Time")));
  rows.forEach(r => console.log(line(r.name, { text: r.checks, plain: r.checksText }, { text: r.tests, plain: r.testsText }, r.time)));
  console.log("\n" + dim("  Checks are the style presets matching the kit, the settings following the standard, and for the kit the contrast standards."));

  // ---- what failed, after the table so it is the last thing in a log
  if (failures.length) {
    console.log("\n" + red("What failed"));
    failures.forEach(r => {
      const lines = r.out.split("\n");
      console.log("\n" + bold("  " + r.job.label));
      const found = [];
      let section = "";
      lines.forEach(l => {
        const sec = /^\s*\[(.+)\]\s*$/.exec(l);
        if (sec) section = sec[1];
        if (/^\s*FAIL\b/.test(l)) found.push({ section, text: l.replace(/^\s*FAIL\s*/, "") });
      });
      if (found.length) {
        let last = null;
        found.forEach(x => {
          if (x.section !== last) { console.log("    " + dim("in [" + (x.section || "start") + "]")); last = x.section; }
          console.log("      " + red("FAIL") + " " + x.text);
        });
      } else {
        console.log("    " + dim("No individual check was reported, so this is the end of its output:"));
        console.log(lines.filter(l => l.trim()).slice(-25).map(l => "      " + l).join("\n"));
      }
    });
  }

  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log("\n" + (failures.length
    ? red("FAILED") + ": " + problems + " of " + suites.length + " suites have a problem (" + failures.map(r => r.job.label).join(", ") + ")"
    : green("Everything passes") + ": " + passed.toLocaleString("en-GB") + " tests in " + suites.length + " suites") + dim("  (" + secs + "s, " + Math.min(JOBS, jobs.length) + " at a time)"));
  process.exit(failures.length ? 1 : 0);
})();
