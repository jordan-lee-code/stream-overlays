/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Runs a command and hands back everything it printed.
 *
 * The output goes to a file and not through a pipe. The suites end with process.exit(), and on Linux whatever a pipe has
 * not yet taken is thrown away when they do. When the machine reading it is busy, that can be most of the output,
 * the closing "passed" line included, so a suite that passed looks as though it failed with nothing to say why. A write
 * to a file is finished before the suite carries on. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

module.exports = function capture(cmd, args, options) {
  return new Promise(resolve => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "suite-")), file = path.join(dir, "output");
    const fd = fs.openSync(file, "a");       // appending, so what two processes print is never written over
    const done = (code, signal, extra) => {
      let out = "";
      try { fs.closeSync(fd); out = fs.readFileSync(file, "utf8"); } catch (e) { out = String(e); }
      fs.rmSync(dir, { recursive: true, force: true });
      resolve({ code, signal, out: out + (extra || "") });
    };
    let settled = false;
    const child = spawn(cmd, args, Object.assign({}, options, { stdio: ["ignore", fd, fd] }));
    child.on("error", e => { if (!settled) { settled = true; done(null, null, String(e)); } });
    child.on("close", (code, signal) => { if (!settled) { settled = true; done(code, signal); } });
  });
};
