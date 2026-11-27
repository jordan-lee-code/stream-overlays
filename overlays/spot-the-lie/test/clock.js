/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* A pretend clock for the tests. A widget runs on timers, and a suite that waits for them on the
 * real clock spends minutes asleep and can fail on a slow machine when a wait turns out to be a
 * little too short. This clock never sleeps: `advance(ms)` runs every timer that falls due in that
 * time, in order, and returns straight away.
 *
 *   const clock = require("./clock")();
 *   // give the widget's sandbox clock.setTimeout, clock.clearTimeout, clock.setInterval and
 *   // clock.clearInterval, and use `await clock.advance(ms)` wherever a test would have waited.
 *
 * Between timers it lets promises settle (the store and the pretend network answer through them),
 * so what a test reads after `advance` is what it would have read after really waiting.
 *
 * `clock.Date` is a Date whose "now" is this clock's time, for widgets that measure elapsed time
 * with Date.now(). A suite that sets the date by hand and keeps it still while time passes can
 * ignore it and give the widget its own Date. */
"use strict";

module.exports = function createClock(start) {
  let now = start === undefined ? 1700000000000 : start;
  let timers = [];
  let nextId = 1;
  const flush = () => new Promise(resolve => setImmediate(resolve));

  function add(fn, ms, every, args) {
    const t = { id: nextId++, fn, at: now + Math.max(0, Number(ms) || 0), every, args };
    timers.push(t);
    return t.id;
  }
  function clear(id) {
    const at = timers.findIndex(t => t.id === id);
    if (at !== -1) timers.splice(at, 1);
  }

  async function advance(ms) {
    const target = now + Math.max(0, Number(ms) || 0);
    await flush();
    for (let guard = 0; ; guard++) {
      let due = null;
      for (const t of timers) if (t.at <= target && (!due || t.at < due.at || (t.at === due.at && t.id < due.id))) due = t;
      if (!due) break;
      if (guard > 100000) throw new Error("Something keeps scheduling timers, so time never gets to " + target);
      if (due.at > now) now = due.at;
      if (due.every) due.at = now + due.every; else clear(due.id);
      due.fn.apply(null, due.args);
      await flush();
    }
    now = target;
    await flush();
  }

  class ClockDate extends Date {
    constructor(...args) { if (args.length === 0) super(now); else super(...args); }
    static now() { return now; }
  }

  return {
    setTimeout(fn, ms, ...args) { return add(fn, ms, 0, args); },
    setInterval(fn, ms, ...args) { return add(fn, ms, Math.max(1, Number(ms) || 1), args); },
    clearTimeout: clear,
    clearInterval: clear,
    advance,
    flush,
    now: () => now,
    pending: () => timers.length,
    Date: ClockDate
  };
};
