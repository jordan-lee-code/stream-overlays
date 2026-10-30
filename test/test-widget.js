/* Headless integration test for widget.js.
   Mocks the slice of DOM/SE the widget needs, then drives it through the real
   onWidgetLoad / onEventReceived events and asserts on the observable DOM.

   Time is virtual. The widget leans on wall-clock deadlines for the lock, the
   nope window and the reset hold, so a suite built on real timers would either
   take minutes to run or never test the interesting seconds at all. Everything
   below drives a fake Date.now and a fake set of timers instead, which also
   means a sixty second window can be watched second by second. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));

// ---- virtual clock ----
let vnow = 1700000000000;
let timers = [], nextId = 1;
function vSetTimeout(fn, ms) { const t = { id: nextId++, fn, at: vnow + (ms || 0), every: 0 }; timers.push(t); return t.id; }
function vClearTimeout(id) { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); }
function vSetInterval(fn, ms) { const t = { id: nextId++, fn, at: vnow + (ms || 0), every: Math.max(1, ms || 1) }; timers.push(t); return t.id; }
function advance(ms) {
  const target = vnow + ms;
  let guard = 0;
  for (;;) {
    let due = null;
    for (const t of timers) if (t.at <= target && (!due || t.at < due.at)) due = t;
    if (!due) break;
    if (++guard > 200000) throw new Error("timer storm");
    vnow = due.at;
    if (due.every) due.at = vnow + due.every; else vClearTimeout(due.id);
    due.fn();
  }
  vnow = target;
}
// The store hands values back through a real promise, so microtasks have to be
// allowed to run before an assertion looks at the DOM.
const flush = () => new Promise(r => setImmediate(r));

// ---- DOM ----
function makeEl(id) {
  const e = {
    id, textContent: "", hidden: false, offsetWidth: 0,
    style: { setProperty(k, v) { this[k] = v; } },
    _cls: new Set(),
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }
    },
    addEventListener() {}, appendChild() {}
  };
  e.classList._s = e._cls; return e;
}
const ids = ["rage-app", "rage-card", "rage-title", "rage-timer", "rage-fill",
  "rage-readout", "rage-note", "rage-lock", "rage-float", "rage-font-link"];
const elements = {}; ids.forEach(id => elements[id] = makeEl(id));
const document = { getElementById: id => elements[id] || null, createElement: () => makeEl("x"), head: makeEl("head"), body: makeEl("body") };

const listeners = {};
const window = {
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => fn(e)); }
};
class CustomEvent { constructor(t, i) { this.type = t; this.detail = i && i.detail; } }

const KEY = "rage_bar_v1";
const storeData = {};
const SE_API = { store: {
  set(k, v) { storeData[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
  get(k) { return Promise.resolve(storeData[k] ? JSON.parse(JSON.stringify(storeData[k])) : null); }
} };

const audioLog = [];
class Audio {
  constructor(src) { this.src = src; this.volume = 1; audioLog.push(this); }
  play() { this.played = true; return Promise.resolve(); }
}
const sandbox = {
  window, document, CustomEvent, SE_API, Audio,
  setTimeout: vSetTimeout, clearTimeout: vClearTimeout,
  setInterval: vSetInterval, clearInterval: vClearTimeout,
  Date: { now: () => vnow },
  console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String, encodeURIComponent
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

// ---- drivers ----
/* The arithmetic below is about the maths, not about how the bit is currently
   tuned. The shipped numbers are likely to be moved
   around more than once, so every test runs against this fixed baseline instead
   of against whatever fields.json happens to say today. The shipped defaults get
   a section of their own at the end, which is the one place a retune has to be
   written down deliberately. */
const TUNING = {
  capacity: 100, capacityGrowth: 1,
  subTier1: 10, subTier2: 15, subTier3: 25,
  bitsPer100: 1,
  fillRewardAmount: 5,
  pointsPerLockedMinute: 2000,
  lockMinMinutes: 0.5, lockMaxMinutes: 15, lockMaxTotalMinutes: 30,
  manualLockMinutes: 5, manualStep: 10,
  nopeSeconds: 60, resetHoldSeconds: 10,
  nopeTargetSubs: 50, nopePointsPerSub: 10000, overkillSubs: 200,
  lockBreakSubs: 5, tipPerSub: 50, dreadFrom: 10,
  saveGraceSeconds: 0
};

function fieldData(ov) {
  const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
  return Object.assign(fd, TUNING, { debug: false }, ov || {});
}
// The shipped values, with no baseline laid over the top.
function shipped() {
  const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
  fd.debug = false; return fd;
}
async function loadShipped(ov) {
  delete storeData[KEY]; timers = [];
  // The grace period is switched off unless a test asks for it, so that the many
  // scenarios that fill the bar and chip in straight away do not each need to wait.
  lastFD = Object.assign(shipped(), { saveGraceSeconds: 0 }, ov || {});
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
  await flush();
}
let lastFD = {};
async function load(ov) {
  delete storeData[KEY];
  timers = [];
  lastFD = fieldData(ov);
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
  await flush();
}
async function reload() {
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
  await flush();
}
function sub(event) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "subscriber-latest", event } })); }
function cheer(event) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "cheer-latest", event } })); }
function chat(text, o) {
  o = o || {}; const badges = [];
  if (o.broadcaster) badges.push({ type: "broadcaster" });
  if (o.mod) badges.push({ type: "moderator" });
  const data = { text, nick: (o.nick || "viewer").toLowerCase(), displayName: o.nick || "Viewer",
    badges, tags: { mod: o.mod ? "1" : "0" } };
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}
function tip(amount, name) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "tip-latest", event: { amount, name } } })); }
function button(field) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } })); }

// The flat shape StreamElements delivers for a channel point redemption.
function redeem(title, cost, username) {
  window.dispatchEvent(new CustomEvent("onEventReceived", {
    detail: { listener: "event", event: { type: "channelPoints", data: { rewardId: "r1", title, cost, username, userInput: "" } } }
  }));
}
// The same redemption with only the raw Twitch payload to read from, which is
// the shape the fallbacks in readRedemption exist for.
function redeemRaw(title, cost, displayName, listener) {
  window.dispatchEvent(new CustomEvent("onEventReceived", {
    detail: { listener: listener || "message", event: { type: "channelPoints", data: {
      raw: { redemption: { reward: { title, cost }, user: { display_name: displayName } } } } } }
  }));
}
// A gift bomb the way it really arrives: the announcement, then one follow-up per
// recipient carrying the gifter's streak in the same `amount` field.
function bomb(count, tier) {
  sub({ gifted: true, bulkGifted: true, amount: count, tier: tier || "1000", sender: "GenerousViewer" });
  for (let i = 0; i < count; i++) {
    sub({ gifted: true, isCommunityGift: true, amount: 170, tier: tier || "1000", sender: "GenerousViewer", name: "recipient" + i });
  }
}

const readout = () => elements["rage-readout"].textContent;
const width = () => elements["rage-fill"].style.width;
const titleText = () => elements["rage-title"].textContent;
const timerText = () => elements["rage-timer"].hidden ? "" : elements["rage-timer"].textContent;
const has = c => elements["rage-card"].classList.contains(c);
const note = () => elements["rage-note"].hidden ? "" : elements["rage-note"].textContent;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  // A. what a sub is worth, by tier
  console.log("\n[sub tiers]");
  await load();
  ok(readout() === "0 / 100", "starts empty (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "10 / 100", "a tier 1 sub adds 10 (" + readout() + ")");
  sub({ tier: "2000", name: "GenerousViewer" });
  ok(readout() === "25 / 100", "a tier 2 sub adds 15 (" + readout() + ")");
  sub({ tier: "3000", name: "GenerousViewer" });
  ok(readout() === "50 / 100", "a tier 3 sub adds 25 (" + readout() + ")");
  await load();
  sub({ name: "GenerousViewer" });
  ok(readout() === "10 / 100", "a Prime sub with no tier counts as tier 1 (" + readout() + ")");
  await load();
  sub({ amount: 6, name: "GenerousViewer" });
  ok(readout() === "10 / 100", "a 6 month resub is one sub, not six (" + readout() + ")");

  // B. the gift bomb, and the +170 trap underneath it
  console.log("\n[gift bombs]");
  await load({ capacity: 1000 });
  bomb(5);
  ok(readout() === "50 / 1000", "a bomb of 5 adds 50 and its follow-ups add nothing (" + readout() + ")");
  await load({ capacity: 1000 });
  bomb(5, "3000");
  ok(readout() === "125 / 1000", "a bomb of 5 tier threes is worth 5 x 25 (" + readout() + ")");
  await load();
  sub({ gifted: true, amount: 3, sender: "GenerousViewer", name: "Target" });
  ok(readout() === "10 / 100", "a single targeted gift is one sub, its amount is a streak (" + readout() + ")");

  // C. bits
  console.log("\n[bits]");
  await load();
  cheer({ amount: 1000, name: "GenerousViewer" });
  ok(readout() === "10 / 100", "1000 bits adds 10 (" + readout() + ")");
  await load();
  cheer({ amount: 50, name: "GenerousViewer" });
  ok(width() === "0.5%", "50 bits is worth half a point rather than nothing (" + width() + ")");
  ok(readout() === "0 / 100", "and the readout floors it until it adds up (" + readout() + ")");

  // D. the fill reward
  console.log("\n[the fill reward]");
  await load();
  redeem("Fill the Bar", 500, "GenerousViewer");
  ok(readout() === "5 / 100", "the fill reward adds 5 (" + readout() + ")");
  redeem("Hydrate!", 100, "GenerousViewer");
  ok(readout() === "5 / 100", "an unrelated reward does nothing (" + readout() + ")");
  redeem("Fill the Bar please", 500, "GenerousViewer");
  ok(readout() === "10 / 100", "titles match on their start, so a suffix still counts (" + readout() + ")");

  /* Streamers put emoji on the front of reward names, and a title that does not
     start with the configured text would have matched nothing at all, silently,
     for a whole stream. Real reward lists often have emoji in them. */
  await load();
  redeem("🧗 Fill the Bar", 2000, "GenerousViewer");
  ok(readout() === "5 / 100", "an emoji on the front of the reward name is ignored (" + readout() + ")");
  redeem("✦ Fill the Bar ✦", 2000, "Rowan");
  ok(readout() === "10 / 100", "so is any other decoration (" + readout() + ")");
  await load();
  redeem("🔒 Lock the Bar (5 min)", 10000, "GenerousViewer");
  ok(timerText() === "5:00", "and a decorated lock still works out its minutes (" + timerText() + ")");
  await load();
  button("btnFillBar");
  redeem("🙅 Save the Run", 500000, "GenerousViewer");
  ok(!has("is-pending"), "and a decorated nope still saves the run");
  await load();
  redeem("🎁 Hydrate!", 2000, "GenerousViewer");
  ok(readout() === "0 / 100", "while an unrelated decorated reward is still ignored (" + readout() + ")");

  // E. reading the redemption payload
  console.log("\n[reading a redemption]");
  await load();
  redeemRaw("Fill the Bar", 500, "GenerousViewer");
  ok(readout() === "5 / 100", "the reward title is found in raw when the flat field is absent (" + readout() + ")");
  await load();
  redeemRaw("Lock the Bar", 10000, "GenerousViewer", "some-listener-we-have-never-seen");
  ok(timerText() === "5:00", "cost and title are read from raw whatever the listener says (" + timerText() + ")");

  // E2. redemption shapes nobody has seen yet. The first real one on a live
  // channel did nothing, so these are the plausible alternatives to the shape
  // this was first written against.
  console.log("\n[redemptions in other shapes]");
  const ev = (listener, event) => window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener, event } }));

  await load();
  ev("redemption-latest", { name: "JourneyingJordan", amount: 2000, data: { reward: "lock the bar (2 mins)", cost: 2000, username: "JourneyingJordan" } });
  ok(timerText() === "2:00", "a redemption-latest listener with the name in data.reward works (" + timerText() + ")");

  await load();
  ev("channelPoints-latest", { data: { redemption: "lock the bar (2 mins)", amount: 2000, displayName: "JourneyingJordan" } });
  ok(timerText() === "2:00", "a channelPoints-latest listener with it in data.redemption works (" + timerText() + ")");

  await load();
  ev("event", { type: "channelPointsRedemption", data: { reward: { title: "lock the bar (2 mins)", cost: 2000 }, user: { display_name: "JourneyingJordan" } } });
  ok(timerText() === "2:00", "a channelPointsRedemption type with a nested reward object works (" + timerText() + ")");

  await load();
  ev("event", { type: "reward-redeemed", data: { somethingElse: "lock the bar (2 mins)", points: 2000 } });
  ok(timerText() === "2:00", "and the name is found even under a key nobody expected (" + timerText() + ")");

  await load();
  ev("redemption-latest", { data: { item: "Hydrate!", amount: 500, username: "GenerousViewer" } });
  ok(readout() === "0 / 100" && !has("is-locked"), "a redemption for something else is still ignored");

  await load();
  chat("lock the bar (2 mins) please", { nick: "GenerousViewer" });
  ok(!has("is-locked"), "and somebody typing the reward name in chat does nothing");

  /* The first real lock on a live channel was "lock the bar (2 mins)" and came
     out as a minute, because the length came from the price and the saved rate
     did not match what the reward had been priced against. The name wins now. */
  console.log("\n[lock length from the reward name]");
  await load();   // baseline rate is 2000 points a minute
  redeem("lock the bar (2 mins)", 2000, "JourneyingJordan");
  ok(timerText() === "2:00", "the exact redemption that came out wrong now gives two minutes (" + timerText() + ")");
  await load();
  redeem("Lock the Bar (5 min)", 1, "GenerousViewer");
  ok(timerText() === "5:00", "the name wins whatever the price says (" + timerText() + ")");
  await load();
  redeem("Lock the Bar (30 sec)", 2000, "GenerousViewer");
  ok(timerText() === "0:30", "seconds are understood (" + timerText() + ")");
  await load();
  redeem("Lock the Bar 1m30s", 2000, "GenerousViewer");
  ok(timerText() === "1:30", "so are mixed units (" + timerText() + ")");
  await load();
  redeem("Lock the Bar (3 minutes)", 2000, "GenerousViewer");
  ok(timerText() === "3:00", "and words spelled out (" + timerText() + ")");
  await load();
  redeem("Lock the Bar (1 hour)", 2000, "GenerousViewer");
  ok(timerText() === "15:00", "a name asking for longer than one lock allows is still capped (" + timerText() + ")");
  await load();
  redeem("Lock the Bar 2", 10000, "GenerousViewer");
  ok(timerText() === "5:00", "a bare number is not trusted, so the price decides (" + timerText() + ")");
  await load();
  redeem("Lock the Bar", 10000, "GenerousViewer");
  ok(timerText() === "5:00", "and a name with no time in it still goes by price (" + timerText() + ")");

  // F. the lock
  console.log("\n[the lock]");
  await load();
  redeem("Lock the Bar", 10000, "GenerousViewer");
  ok(has("is-locked"), "a 10000 point lock at 2000 a minute locks the bar");
  ok(timerText() === "5:00", "and runs for five minutes (" + timerText() + ")");
  ok(elements["rage-lock"].hidden === false, "the padlock shows");
  redeem("Lock the Bar (5 min)", 10000, "Rowan");
  ok(timerText() === "10:00", "a second lock extends rather than replaces (" + timerText() + ")");
  await load();
  redeem("Lock the Bar", 100000, "GenerousViewer");
  ok(timerText() === "15:00", "a single lock is capped at the per-lock maximum (" + timerText() + ")");
  redeem("Lock the Bar", 100000, "Rowan");
  redeem("Lock the Bar", 100000, "Sage");
  ok(timerText() === "30:00", "and the running total is capped however many stack it (" + timerText() + ")");
  await load();
  redeem("Lock the Bar", 0, "GenerousViewer");
  ok(timerText() === "0:30", "an unreadable cost becomes the shortest lock, not a lock of no time (" + timerText() + ")");

  // G. what the lock actually does
  console.log("\n[contributions during a lock]");
  // A high break target here so the lock holds while everything is thrown at it.
  await load({ lockBreakSubs: 500 });
  sub({ tier: "1000", name: "GenerousViewer" });
  redeem("Lock the Bar", 4000, "Rowan");
  ok(timerText() === "2:00", "locked for two minutes (" + timerText() + ")");
  sub({ tier: "3000", name: "Sage" });
  ok(readout() === "10 / 100", "a sub during the lock does not reach the bar (" + readout() + ")");
  ok(note() === "48 subs / 47,500 bits / £2,375.00 to break", "it goes against the lock instead (" + note() + ")");
  cheer({ amount: 5000, name: "Sage" });
  ok(readout() === "10 / 100", "bits do not reach the bar either (" + readout() + ")");
  ok(note() === "43 subs / 42,500 bits / £2,125.00 to break", "they go against the lock too (" + note() + ")");
  elements["rage-card"].classList.remove("refused");
  redeem("Fill the Bar", 500, "Sage");
  ok(readout() === "10 / 100", "but the fill reward is turned away (" + readout() + ")");
  ok(has("refused"), "and the card shakes so nobody thinks it went missing");
  advance(120 * 1000);
  ok(!has("is-locked"), "the lock lapses on its own");
  ok(timerText() === "", "and the countdown goes away (" + timerText() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "20 / 100", "the next sub lands normally (" + readout() + ")");

  // H. filling it
  console.log("\n[filling the bar]");
  await load();
  sub({ tier: "3000", name: "GenerousViewer" });
  sub({ tier: "3000", name: "GenerousViewer" });
  sub({ tier: "3000", name: "GenerousViewer" });
  ok(readout() === "75 / 100", "three tier threes get it to 75 (" + readout() + ")");
  sub({ tier: "3000", name: "Rowan" });
  ok(has("is-pending"), "the fourth tips it over and starts the clock");
  ok(readout() === "0 / 50 points", "the bar becomes a save bar, empty, with the price of saving the run (" + readout() + ")");
  ok(width() === "0%", "and it starts from nothing (" + width() + ")");
  ok(titleText() === "SAVE THE RUN", "the headline changes (" + titleText() + ")");
  ok(timerText() === "60s", "with sixty seconds on it (" + timerText() + ")");
  advance(20 * 1000);
  ok(timerText() === "40s", "which counts down (" + timerText() + ")");

  // I. saving it
  console.log("\n[saving the run]");
  await load();
  button("btnFillBar");
  ok(has("is-pending"), "the fill button starts the clock, for rehearsing this before going live");
  advance(10 * 1000);
  redeem("Lock the Bar", 10000, "Sage");
  ok(has("is-pending"), "a lock is not a thing worth buying now, so it is ignored");
  ok(readout() === "0 / 50 points", "and it did not move the save bar (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-pending"), "one sub chips in rather than saving outright");
  ok(readout() === "10 / 50 points" && width() === "20%", "and the save bar fills by the same share (" + readout() + ", " + width() + ")");
  ok(note() === "4 subs / 4,000 bits / £200.00 to save", "and the line under the bar says what is left in subs, bits and money (" + note() + ")");
  sub({ tier: "3000", name: "Rowan" });
  ok(readout() === "35 / 50 points" && note() === "2 subs / 1,500 bits / £75.00 to save", "a tier 3 is worth more, here as anywhere else (" + note() + ")");
  cheer({ amount: 1000, name: "Sage" });
  ok(note() === "1 sub / 500 bits / £25.00 to save", "and bits count too (" + note() + ")");
  redeem("Save the Run", 50000, "Juniper");
  ok(!has("is-pending") && readout() === "0 / 100", "points finish it off (" + readout() + ")");

  await load();
  button("btnFillBar");
  bomb(5);
  ok(!has("is-pending") && readout() === "0 / 100", "a gift bomb can do it alone, and its follow-ups do not refill it (" + readout() + ")");

  // J. nobody saved it
  // If nobody saves a bar that was overfilled, the banner shows the big bar clamped
  // at its capacity rather than 125 of 100.
  await load();
  for (let i = 0; i < 4; i++) sub({ tier: "3000", name: "GenerousViewer" });
  advance(61 * 1000);
  ok(has("is-reset") && readout() === "100 / 100" && width() === "100%",
     "the banner shows the big bar clamped at the capacity rather than 125 (" + readout() + ", " + width() + ")");

  console.log("\n[nobody saved it]");
  await load();
  button("btnFillBar");
  advance(60 * 1000);
  ok(has("is-reset"), "the window runs out and the reset banner comes up");
  ok(titleText() === "Time to reset!", "saying so plainly (" + titleText() + ")");
  ok(readout() === "100 / 100", "with the bar still full while it is up (" + readout() + ")");
  advance(5 * 1000);
  ok(has("is-reset"), "it holds for a moment rather than blinking past");
  advance(6 * 1000);
  ok(!has("is-reset"), "then clears itself");
  ok(readout() === "0 / 100", "back to an empty bar (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "10 / 100", "and it takes contributions again (" + readout() + ")");

  // K. surviving a browser source refresh
  console.log("\n[surviving a refresh]");
  await load();
  redeem("Lock the Bar", 20000, "GenerousViewer");
  advance(3 * 60 * 1000 + 400);
  await reload();
  ok(has("is-locked"), "a refresh mid-lock comes back locked");
  ok(timerText() === "7:00", "with the right time left, not a fresh ten minutes (" + timerText() + ")");

  await load();
  sub({ tier: "3000", name: "GenerousViewer" });
  advance(400);
  await reload();
  ok(readout() === "25 / 100", "a refresh mid-fill keeps the bar where it was (" + readout() + ")");

  await load();
  button("btnFillBar");
  advance(20 * 1000);
  await reload();
  ok(has("is-pending"), "a refresh during the nope window comes back in the window");
  ok(timerText() === "40s", "with the clock resumed rather than restarted (" + timerText() + ")");
  redeem("Save the Run", 500000, "GenerousViewer");
  ok(!has("is-pending") && readout() === "0 / 100", "and it can still be saved (" + readout() + ")");

  console.log("\n[coming back to a stale window]");
  await load();
  storeData[KEY] = { fill: 100, phase: "pending", lockUntil: 0, nopeUntil: vnow - 4000, resetUntil: 0, saviour: "" };
  await reload();
  ok(has("is-reset"), "a window that lapsed four seconds ago still shows its reset");
  await load();
  storeData[KEY] = { fill: 100, phase: "pending", lockUntil: 0, nopeUntil: vnow - 20 * 60 * 1000, resetUntil: 0 };
  await reload();
  ok(!has("is-reset") && has("is-pending"),
     "one that lapsed twenty minutes ago comes back as a fresh window instead");
  ok(readout() === "0 / 50 points", "with a fresh save bar, so the run gets resolved on stream (" + readout() + ")");

  // L. the settings panel on its own
  console.log("\n[the manual controls]");
  await load();
  button("btnFillStep");
  button("btnFillStep");
  ok(readout() === "20 / 100", "the fill button adds its step (" + readout() + ")");
  button("btnLock");
  ok(has("is-locked") && timerText() === "5:00", "the lock button locks for five minutes (" + timerText() + ")");
  button("btnUnlock");
  ok(!has("is-locked"), "the unlock button takes it off again");
  button("btnFillBar");
  button("btnNope");
  ok(!has("is-pending") && readout() === "0 / 100", "the nope button saves a full bar by hand (" + readout() + ")");
  sub({ tier: "3000", name: "GenerousViewer" });
  button("btnLock");
  button("btnReset");
  ok(!has("is-locked") && readout() === "0 / 100", "and reset clears everything, lock included (" + readout() + ")");

  // M. theme presets
  console.log("\n[theme presets]");
  await load({ themePreset: "cosycabin" });
  ok(elements["rage-app"].style["--fill-to"] === "#7C6142", "cosy cabin fills in the cosy cabin brown (" + elements["rage-app"].style["--fill-to"] + ")");
  await load({ themePreset: "pastelgoth" });
  ok(elements["rage-app"].style["--fill-to"] === "#C8B6E2", "pastel goth changes the gradient");
  await load({ themePreset: "custom", colorFillTo: "#123456", colorAlarm: "#654321" });
  ok(elements["rage-app"].style["--fill-to"] === "#123456", "custom uses the colour pickers");
  ok(elements["rage-app"].style["--alarm"] === "#654321", "including the alarm colour");

  // N. the settings that change the shape of the bit
  console.log("\n[reconfiguring the bit]");
  await load({ capacity: 50 });
  sub({ tier: "3000", name: "GenerousViewer" });
  sub({ tier: "3000", name: "GenerousViewer" });
  ok(has("is-pending") && readout() === "0 / 50 points", "a smaller capacity fills faster (" + readout() + ")");
  ok(has("is-pending"), "and still starts the clock");
  await load({ nopeSeconds: 30, subTier1: 100 });
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(timerText() === "30s", "a shorter window is honoured (" + timerText() + ")");
  await load({ pointsPerLockedMinute: 1000 });
  redeem("Lock the Bar", 4000, "GenerousViewer");
  ok(timerText() === "4:00", "cheaper minutes make longer locks (" + timerText() + ")");

  // R. subs piling up against a lock until it gives
  console.log("\n[breaking a lock]");
  await load();   // baseline: a tier 1 sub is 10, so the 5-unit target is half a sub
  await load({ lockBreakSubs: 50 });   // five tier ones
  redeem("Lock the Bar", 10000, "Sage");
  ok(has("is-locked") && timerText() === "5:00", "locked for five minutes (" + timerText() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-locked"), "one sub does not break it");
  ok(note() === "4 subs / 4,000 bits / £200.00 to break", "but it counts, and the note says so (" + note() + ")");
  ok(readout() === "0 / 100", "and it does not touch the bar (" + readout() + ")");
  sub({ tier: "1000", name: "Rowan" });
  sub({ tier: "1000", name: "Sage" });
  sub({ tier: "1000", name: "Juniper" });
  ok(has("is-locked") && note() === "1 sub / 1,000 bits / £50.00 to break", "four is not enough either (" + note() + ")");
  sub({ tier: "1000", name: "Ash" });
  ok(!has("is-locked"), "the fifth breaks it");
  ok(readout() === "0 / 100", "the lock absorbed all five, so the bar is untouched (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "10 / 100", "and the next sub lands on the bar as normal (" + readout() + ")");

  // Subs, bits and donations all count against a lock. Channel points do not.
  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  cheer({ amount: 2000, name: "Rowan" });   // 20 points
  ok(has("is-locked") && note() === "3 subs / 3,000 bits / £150.00 to break", "bits count against a lock (" + note() + ")");
  tip(100, "Ash");                            // 20 points
  ok(has("is-locked") && note() === "1 sub / 1,000 bits / £50.00 to break", "and so do donations (" + note() + ")");
  elements["rage-card"].classList.remove("refused");
  redeem("Fill the Bar", 2000, "Rowan");
  ok(has("is-locked") && note() === "1 sub / 1,000 bits / £50.00 to break", "but fill redeems do not (" + note() + ")");
  ok(has("refused"), "and are turned away with a shake");
  cheer({ amount: 1000, name: "Sage" });   // the last 10
  ok(!has("is-locked") && readout() === "0 / 100", "enough of them together break it, and the lock absorbs them (" + readout() + ")");

  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  tip(250, "Ash");                            // 50 points on its own
  ok(!has("is-locked"), "a big enough donation breaks a lock by itself");
  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  cheer({ amount: 5000, name: "Rowan" });   // 50 points on its own
  ok(!has("is-locked"), "and so does a big enough cheer");

  // The lock takes what it needs and the rest carries on.
  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  bomb(8);   // 80 units: 50 breaks the lock, 30 should land
  ok(!has("is-locked"), "a bomb of eight breaks a five sub lock");
  ok(readout() === "30 / 100", "and the three subs it did not need carry on to the bar (" + readout() + ")");

  // A lock that lapses on its own takes the pile-up with it.
  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 4000, "Sage");
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  ok(note() === "3 subs / 3,000 bits / £150.00 to break", "two subs banked against the lock (" + note() + ")");
  advance(2 * 60 * 1000 + 500);
  ok(!has("is-locked"), "the lock lapses on its own");
  redeem("Lock the Bar", 4000, "Sage");
  ok(note() === "5 subs / 5,000 bits / £250.00 to break", "and the next lock starts from nothing (" + note() + ")");

  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 4000, "Sage");
  sub({ tier: "1000", name: "GenerousViewer" });
  advance(400);
  await reload();
  ok(has("is-locked") && note() === "4 subs / 4,000 bits / £200.00 to break", "the pile-up survives a refresh (" + note() + ")");

  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  sub({ tier: "1000", name: "GenerousViewer" });
  button("btnUnlock");
  redeem("Lock the Bar", 10000, "Sage");
  ok(note() === "5 subs / 5,000 bits / £250.00 to break", "unlocking by hand clears the pile-up too (" + note() + ")");

  await load({ lockBreakSubs: 0 });
  redeem("Lock the Bar", 10000, "Sage");
  sub({ tier: "3000", name: "GenerousViewer" });
  sub({ tier: "3000", name: "Rowan" });
  ok(has("is-locked") && readout() === "0 / 100", "setting it to zero makes a lock unbreakable again (" + readout() + ")");

  // V. the last stretch
  console.log("\n[dread as it fills]");
  const fillTo = () => elements["rage-app"].style["--fill-to"];
  await load();
  chat("!bar set 50", { mod: true });
  ok(!has("is-close"), "halfway up, nothing is happening yet");
  ok(fillTo() === "#FFFFFF", "and the fill is the theme's own white (" + fillTo() + ")");
  chat("!bar set 92", { mod: true });
  ok(has("is-close") && !has("is-brink"), "inside the last ten it starts breathing");
  ok(/^rgb\(/.test(fillTo()), "and the fill has started warming (" + fillTo() + ")");
  chat("!bar set 97", { mod: true });
  ok(has("is-brink"), "and breathes faster at the very top");
  chat("!bar set 50", { mod: true });
  ok(!has("is-close") && fillTo() === "#FFFFFF", "coming back down puts it all away again (" + fillTo() + ")");

  await load({ dreadFrom: 0 });
  chat("!bar set 99", { mod: true });
  ok(!has("is-close") && fillTo() === "#FFFFFF", "and zero turns the whole thing off (" + fillTo() + ")");

  // A lock is not the moment to be staring at the bar.
  await load();
  chat("!bar set 95", { mod: true });
  redeem("Lock the Bar", 10000, "Sage");
  ok(has("is-locked"), "locked near the top");

  console.log("\n[float toasts queue rather than clobber]");
  await load();
  button("btnFillBar");
  ["GenerousViewer", "Rowan", "Sage", "Juniper"].forEach(who => sub({ tier: "1000", name: who }));
  ok(elements["rage-float"].textContent === "+10 GenerousViewer",
     "the first of four rapid chip-ins is the one on screen (" + elements["rage-float"].textContent + ")");
  advance(1700);
  ok(elements["rage-float"].textContent === "+10 Rowan",
     "then the second gets its turn (" + elements["rage-float"].textContent + ")");
  advance(1700);
  ok(elements["rage-float"].textContent === "+10 Sage", "then the third (" + elements["rage-float"].textContent + ")");
  advance(1700);
  ok(elements["rage-float"].textContent === "+10 Juniper", "then the fourth (" + elements["rage-float"].textContent + ")");
  advance(1700);
  ok(elements["rage-float"].hidden === true, "and then it goes away");

  await load();
  for (let i = 0; i < 12; i++) sub({ tier: "1000", name: "GenerousViewer" });
  advance(20 * 1000);
  ok(elements["rage-float"].hidden === true, "a busy minute does not leave a queue still playing out later");

  // U. tips, banking, and the two things a closed browser source can do
  console.log("\n[tips]");
  await load();
  tip(5, "GenerousViewer");
  ok(readout() === "1 / 100", "a fiver is worth a sub (" + readout() + ")");
  tip(20, "Rowan");
  ok(readout() === "5 / 100", "and a twenty is worth four (" + readout() + ")");
  tip(2.5, "Sage");
  ok(width() === "5.5%", "small tips keep their fraction (" + width() + ")");
  await load();
  button("btnFillBar");
  tip(250, "GenerousViewer");
  ok(!has("is-pending") && readout() === "0 / 100", "a tip during the window chips in like everything else (" + readout() + ")");
  await load();
  redeem("Lock the Bar", 10000, "Sage");
  tip(20, "GenerousViewer");
  ok(has("is-locked") && readout() === "0 / 100", "and a tip cannot break a lock, only subs can (" + readout() + ")");

  // A donation while chat is saving the run buys five more seconds. Nothing else does.
  console.log("\n[subs, cheers and donations add time to the save]");
  await load();
  button("btnFillBar");
  advance(20 * 1000);
  ok(timerText() === "40s", "twenty seconds gone (" + timerText() + ")");
  tip(5, "GenerousViewer");
  ok(timerText() === "45s" && readout() === "1 / 50 points", "a donation adds five seconds and chips in (" + timerText() + ", " + readout() + ")");
  tip(5, "Rowan");
  ok(timerText() === "50s", "and each one does it again (" + timerText() + ")");
  cheer({ amount: 100, name: "Sage" });
  ok(timerText() === "55s" && readout() === "3 / 50 points", "a cheer chips in and adds five seconds too (" + timerText() + ", " + readout() + ")");
  sub({ tier: "1000", name: "Sage" });
  ok(timerText() === "60s", "a sub adds five seconds as well (" + timerText() + ")");
  redeem("Save the Run", 10000, "Sage");
  ok(timerText() === "60s", "channel points chip in without adding time (" + timerText() + ")");
  bomb(2);
  ok(timerText() === "65s", "a gift bomb is one event, so it adds five seconds once and not once per recipient (" + timerText() + ")");
  chat("!barsub 1", { mod: true });
  ok(timerText() === "70s", "and the mod test command behaves like a real sub (" + timerText() + ")");
  advance(70 * 1000);
  ok(has("is-reset"), "and the extra time really is on the clock, not just the label");

  await load();
  button("btnFillBar");
  advance(58 * 1000);
  tip(5, "GenerousViewer");
  advance(6 * 1000);
  ok(has("is-pending"), "a donation in the last seconds is what keeps the window open (" + timerText() + ")");
  tip(500, "Rowan");
  ok(!has("is-pending") && readout() === "0 / 100", "and one big enough still saves the run outright");

  await load();
  tip(5, "GenerousViewer");
  ok(readout() === "1 / 100" && timerText() === "", "a donation while the bar is filling fills it and starts no clock (" + readout() + ")");

  await load({ saveExtendSeconds: 0 });
  button("btnFillBar");
  advance(20 * 1000);
  tip(5, "GenerousViewer");
  ok(timerText() === "40s" && readout() === "1 / 50 points", "at zero seconds it is switched off (" + timerText() + ")");

  await load();
  button("btnFillBar");
  advance(20 * 1000);
  tip(5, "GenerousViewer");
  advance(400);
  await reload();
  ok(timerText() === "45s" || timerText() === "44s", "and the extra time survives a refresh (" + timerText() + ")");

  console.log("\n[money during the reset banner]");
  await load();
  button("btnFillBar");
  advance(61 * 1000);
  ok(has("is-reset"), "the banner is up");
  sub({ tier: "3000", name: "GenerousViewer" });
  cheer({ amount: 5000, name: "Rowan" });
  tip(10, "Sage");
  ok(readout() === "100 / 100", "the bar stays where it is while the banner is showing (" + readout() + ")");
  advance(11 * 1000);
  ok(!has("is-reset"), "the banner clears");
  ok(readout() === "77 / 100", "and everything that arrived during it lands on the fresh bar (" + readout() + ")");

  await load();
  button("btnFillBar");
  advance(61 * 1000);
  bomb(11);   // 110 units banked, more than the whole bar
  advance(11 * 1000);
  ok(has("is-pending"), "a bank big enough to refill the bar does exactly that");

  console.log("\n[OBS shut at the worst moment]");
  await load();
  storeData[KEY] = { fill: 100, phase: "pending", lockUntil: 0, nopeUntil: vnow - 30 * 60 * 1000,
                     resetUntil: 0, nopePool: 20, lockBreakPool: 0, resetBank: 0, overkill: false, ender: "" };
  await reload();
  ok(has("is-pending"), "a window missed entirely comes back rather than vanishing");
  ok(readout() === "20 / 50 points", "with what chat had already chipped in still on the save bar (" + readout() + ")");
  ok(note() === "3 subs / 3,000 bits / £150.00 to save", "and still counted (" + note() + ")");
  ok(timerText() === "60s", "on a fresh clock, so they get their chance (" + timerText() + ")");
  chat("!barreset", { mod: true });
  ok(!has("is-pending") && readout() === "0 / 100", "and a mod can wave it away if it is stale (" + readout() + ")");

  // W. switched off between Getting Over It streams
  console.log("\n[!baroff and !baron]");
  await load();
  sub({ tier: "1000", name: "GenerousViewer" });
  chat("!baroff", { mod: true });
  ok(has("is-off") && note() === "switched off", "switching off says so under the bar (" + note() + ")");
  sub({ tier: "3000", name: "Rowan" });
  bomb(5);
  cheer({ amount: 5000, name: "Sage" });
  tip(50, "Juniper");
  redeem("Fill the Bar", 2000, "Ash");
  ok(readout() === "10 / 100", "subs, gifts, bits, tips and redeems all leave it alone (" + readout() + ")");
  bomb(50);
  ok(!has("is-reset") && readout() === "10 / 100", "even a gift big enough to end a run outright (" + readout() + ")");
  redeem("Lock the Bar", 10000, "Sage");
  ok(!has("is-locked"), "and chat cannot lock it either");
  chat("!baron", { mod: true });
  ok(!has("is-off") && note() === "9 subs / 9,000 bits / £450.00 to go", "switching back on picks up where it was (" + note() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "20 / 100", "and it counts again (" + readout() + ")");

  // The clock stands still while it is off, which is the point of pausing rather
  // than just ignoring: a stream that ends mid-lock resumes mid-lock.
  await load();
  redeem("Lock the Bar", 10000, "Sage");
  advance(2 * 60 * 1000);
  ok(timerText() === "3:00", "three minutes left on a lock (" + timerText() + ")");
  chat("!baroff", { mod: true });
  advance(3 * 24 * 60 * 60 * 1000);   // three days between streams
  ok(timerText() === "3:00", "three days later the lock has not moved (" + timerText() + ")");
  await reload();
  ok(has("is-off") && timerText() === "3:00", "not even across a browser source refresh (" + timerText() + ")");
  chat("!baron", { mod: true });
  ok(has("is-locked") && timerText() === "3:00", "and switching on resumes it at three minutes (" + timerText() + ")");
  advance(3 * 60 * 1000 + 300);
  ok(!has("is-locked"), "then it runs out on schedule");

  await load();
  button("btnFillBar");
  advance(20 * 1000);
  sub({ tier: "1000", name: "GenerousViewer" });
  chat("!baroff", { mod: true });
  advance(60 * 60 * 1000);
  ok(has("is-pending") && timerText() === "45s", "a nope window survives an hour off, with the sub's five seconds (" + timerText() + ")");
  ok(note() === "switched off", "while saying it is off (" + note() + ")");
  sub({ tier: "1000", name: "Rowan" });
  chat("!baron", { mod: true });
  ok(readout() === "10 / 50 points", "chipping in while off did not count, and the pot kept what it had (" + readout() + ")");
  ok(timerText() === "45s", "and the clock resumes from where it was, the sub sent while off adding no time (" + timerText() + ")");

  console.log("\n[switching off: the edges]");
  await load();
  chat("!baroff", { nick: "Randomer" });
  ok(!has("is-off"), "a viewer cannot switch it off");
  chat("!baroff", { mod: true });
  chat("!baron", { nick: "Randomer" });
  ok(has("is-off"), "or back on");
  chat("!bar set 40", { mod: true });
  ok(readout() === "40 / 100" && has("is-off"), "mods can still correct it while it is off (" + readout() + ")");
  chat("!barreset", { mod: true });
  ok(readout() === "0 / 100" && has("is-off"), "and a reset clears it without switching it back on (" + readout() + ")");
  button("btnOn");
  ok(!has("is-off"), "the settings panel has an on button");
  button("btnOff");
  ok(has("is-off"), "and an off button");
  chat("!baroff", { mod: true });
  chat("!baron", { mod: true });
  chat("!baron", { mod: true });
  ok(!has("is-off"), "saying it twice does nothing strange");

  await load({ hideWhenOff: true });
  ok(!elements["rage-app"].classList.contains("is-hidden"), "shown while on");
  chat("!baroff", { mod: true });
  ok(elements["rage-app"].classList.contains("is-hidden"), "and hidden while off when that is what is wanted");

  // T. mod commands
  console.log("\n[chat commands]");
  await load();
  chat("!bar +30", { mod: true });
  ok(readout() === "30 / 100", "a mod can push the bar up (" + readout() + ")");
  chat("!bar -10", { broadcaster: true });
  ok(readout() === "20 / 100", "and pull it back down (" + readout() + ")");
  chat("!bar set 45", { mod: true });
  ok(readout() === "45 / 100", "or set it outright (" + readout() + ")");
  chat("!bar =7.5", { mod: true });
  ok(readout() === "7 / 100", "decimals work, because a tier 2 sub is one and a half (" + readout() + ")");
  chat("!bar -500", { mod: true });
  ok(readout() === "0 / 100", "and it floors at nothing (" + readout() + ")");

  console.log("\n[!barsub for testing]");
  await load();   // baseline: a tier 1 sub is 10 on a bar of 100
  chat("!barsub", { mod: true });
  ok(readout() === "10 / 100", "!barsub on its own is one sub (" + readout() + ")");
  chat("!barsub 3", { mod: true });
  ok(readout() === "40 / 100", "!barsub 3 is three (" + readout() + ")");
  chat("!barsub 2 t3", { mod: true });
  ok(readout() === "90 / 100", "and a tier can go on the end (" + readout() + ")");
  chat("!barsub 1 tier 2", { mod: true });
  ok(has("is-pending"), "written out in full too, and it fills the bar like the real thing");
  chat("!barsub 2", { mod: true });
  ok(readout() === "20 / 50 points", "during the countdown it chips into the save (" + readout() + ")");

  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  chat("!barsub", { mod: true });
  ok(has("is-locked") && note() === "4 subs / 4,000 bits / £200.00 to break", "against a lock it piles up rather than filling (" + note() + ")");
  chat("!barsub 4", { mod: true });
  ok(!has("is-locked"), "and enough of them break it");

  await load();
  chat("!barsub 20", { mod: true });
  ok(has("is-reset") && titleText() === "NO SAVING THIS ONE", "and a big enough one ends the run outright, like a real gift would");

  await load();
  chat("!barsub 5", { nick: "Randomer" });
  ok(readout() === "0 / 100", "a viewer cannot use it (" + readout() + ")");
  chat("!barsub lots", { mod: true });
  chat("!barsub 0", { mod: true });
  chat("!barsub 3 t9", { mod: true });
  ok(readout() === "0 / 100", "and nonsense does nothing rather than guessing (" + readout() + ")");
  chat("!baroff", { mod: true });
  chat("!barsub 5", { mod: true });
  ok(readout() === "0 / 100", "while switched off it is ignored, the same as real subs (" + readout() + ")");

  console.log("\n[!barlock and its units]");
  await load();
  chat("!barlock 60", { mod: true });
  ok(timerText() === "1:00", "a bare 60 is a minute, not an hour (" + timerText() + ")");
  await load();
  chat("!barlock 90s", { mod: true });
  ok(timerText() === "1:30", "90s is ninety seconds (" + timerText() + ")");
  await load();
  chat("!barlock 5m", { mod: true });
  ok(timerText() === "5:00", "5m is five minutes (" + timerText() + ")");
  await load();
  chat("!barlock 1m30s", { mod: true });
  ok(timerText() === "1:30", "and the parts add up (" + timerText() + ")");
  await load();
  chat("!barlock", { mod: true });
  ok(timerText() === "5:00", "no number falls back to the Field default (" + timerText() + ")");
  await load();
  chat("!barlock 1h", { mod: true });
  ok(timerText() === "60:00", "a mod's lock ignores the caps chat plays by (" + timerText() + ")");
  chat("!barunlock", { mod: true });
  ok(!has("is-locked"), "and unlock takes it straight off");

  console.log("\n[the rest of the commands]");
  await load();
  chat("!barfill", { mod: true });
  ok(has("is-pending"), "!barfill starts the clock");
  chat("!barnope", { mod: true });
  ok(!has("is-pending") && readout() === "0 / 100", "!barnope saves it outright (" + readout() + ")");
  chat("!bar set 60", { mod: true });
  chat("!barlock 5m", { mod: true });
  chat("!barreset", { mod: true });
  ok(!has("is-locked") && readout() === "0 / 100", "!barreset clears everything, lock included (" + readout() + ")");

  console.log("\n[command permissions]");
  await load();
  chat("!bar set 40", { mod: true });
  chat("!bar +10", { nick: "Randomer" });
  ok(readout() === "40 / 100", "a viewer cannot move the bar (" + readout() + ")");
  chat("!barreset", { nick: "Randomer" });
  ok(readout() === "40 / 100", "nor reset it (" + readout() + ")");
  chat("!barlock 5m", { nick: "Randomer" });
  ok(!has("is-locked"), "nor lock it");
  chat("!bar", { nick: "Randomer" });
  ok(readout() === "40 / 100", "and a bare !bar just draws the eye to it (" + readout() + ")");

  await load({ whoCanManage: "broadcaster" });
  chat("!bar set 40", { mod: true });
  ok(readout() === "0 / 100", "in broadcaster-only mode a mod cannot either (" + readout() + ")");
  chat("!bar set 40", { broadcaster: true });
  ok(readout() === "40 / 100", "but the broadcaster still can (" + readout() + ")");

  await load();
  chat("!bar set 95", { mod: true });
  chat("!bar +10", { mod: true });
  ok(has("is-pending") && readout() === "0 / 50 points", "pushing it past the top starts the clock like anything else (" + readout() + ")");

  /* A mod nudging the number mid-panic used to hand chat back a fresh sixty
     seconds and bin everything they had chipped in, which is the worst possible
     moment for an off-by-one command to be destructive. */
  console.log("\n[adjusting the bar mid-panic]");
  await load();
  button("btnFillBar");
  advance(20 * 1000);
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  ok(timerText() === "50s" && readout() === "20 / 50 points", "twenty seconds gone, two subs in, ten seconds added (" + timerText() + ", " + readout() + ")");
  chat("!bar +1", { mod: true });
  ok(timerText() === "50s", "a nudge does not hand back the clock (" + timerText() + ")");
  ok(readout() === "20 / 50 points", "nor bin what chat has already chipped in (" + readout() + ")");
  ok(has("is-pending"), "and the window is still running");

  chat("!bar set 30", { mod: true });
  ok(!has("is-pending"), "but dropping it below the top calls the whole thing off");
  ok(readout() === "30 / 100", "and leaves the bar where the mod put it (" + readout() + ")");
  ok(note() === "7 subs / 7,000 bits / £350.00 to go", "with the line back to counting down (" + note() + ")");

  await load();
  button("btnFillBar");
  advance(61 * 1000);
  ok(has("is-reset"), "a reset banner is up");
  chat("!bar set 20", { mod: true });
  ok(!has("is-reset") && readout() === "20 / 100", "a mod can wave it away mid-banner (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "30 / 100", "and the bar takes contributions again straight away (" + readout() + ")");

  // S. the line under the bar, which always has something to say
  console.log("\n[the line under the bar]");
  await load();
  ok(note() === "10 subs / 10,000 bits / £500.00 to go", "an empty bar says how far there is to go (" + note() + ")");
  sub({ tier: "3000", name: "GenerousViewer" });
  ok(note() === "8 subs / 7,500 bits / £375.00 to go", "and counts down as it fills (" + note() + ")");
  redeem("Lock the Bar", 4000, "Rowan");
  ok(note() === "1 sub / 500 bits / £25.00 to break", "a lock changes the goal to breaking the lock (" + note() + ")");
  sub({ tier: "1000", name: "Sage" });
  ok(!has("is-locked"), "which a tier 1 sub does on its own at this baseline");
  ok(note() === "7 subs / 7,000 bits / £350.00 to go", "and then it is back to counting down the bar (" + note() + ")");
  button("btnFillBar");
  ok(note() === "5 subs / 5,000 bits / £250.00 to save", "a full bar changes it to what would save the run (" + note() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(note() === "4 subs / 4,000 bits / £200.00 to save", "counting down as people chip in (" + note() + ")");

  // P. channel points chipping in together
  console.log("\n[the nope pot]");
  await load();
  button("btnFillBar");
  redeem("Save the Run", 100000, "GenerousViewer");   // 10 subs' worth of the 50 needed
  ok(has("is-pending"), "one redeem on its own does not save it");
  ok(readout() === "10 / 50 points", "the save bar counts it in the same points as everything else (" + readout() + ")");
  redeem("Save the Run", 100000, "Rowan");
  redeem("Save the Run", 200000, "Sage");
  ok(has("is-pending") && readout() === "40 / 50 points" && note() === "1 sub / 1,000 bits / £50.00 to save", "three people get most of the way (" + note() + ")");
  redeem("Save the Run", 100000, "Juniper");
  ok(!has("is-pending") && readout() === "0 / 100", "the fourth gets them over the line (" + readout() + ")");

  // The three currencies mix freely, because they are all counted the same way.
  await load();
  button("btnFillBar");
  sub({ tier: "3000", name: "GenerousViewer" });
  cheer({ amount: 1500, name: "Rowan" });
  redeem("Save the Run", 100000, "Sage");
  ok(note() === "50 / 50 to save" || !has("is-pending"), "subs, bits and points add up together (" + note() + ")");
  ok(!has("is-pending") && readout() === "0 / 100", "and between them they bought the run back (" + readout() + ")");

  await load();
  button("btnFillBar");
  redeem("Save the Run (chip in)", 10000, "GenerousViewer");
  ok(readout() === "1 / 50 points", "a differently priced reward pays into the same pot (" + readout() + ")");

  await load();
  button("btnFillBar");
  redeem("Save the Run", 300000, "GenerousViewer");
  advance(20 * 1000);
  await reload();
  ok(has("is-pending") && readout() === "30 / 50 points" && note() === "2 subs / 2,000 bits / £100.00 to save", "the pot survives a refresh (" + note() + ")");
  cheer({ amount: 2000, name: "Rowan" });
  ok(!has("is-pending"), "and can still be topped up afterwards");

  await load();
  button("btnFillBar");
  redeem("Save the Run", 300000, "GenerousViewer");
  advance(60 * 1000);
  ok(has("is-reset"), "a pot that never filled up does not save anything");
  advance(11 * 1000);
  button("btnFillBar");
  ok(readout() === "0 / 50 points", "and the next window starts from an empty pot (" + readout() + ")");

  await load();
  redeem("Save the Run", 300000, "GenerousViewer");
  ok(readout() === "0 / 100" && !has("is-pending"), "chipping in outside the window does nothing (" + readout() + ")");

  // Q. one person ending it outright
  console.log("\n[no saving this one]");
  await load();
  sub({ tier: "1000", name: "GenerousViewer" });
  bomb(20);   // 20 subs x 10 = 200, which is twice the baseline bar of 100
  ok(has("is-reset"), "a bomb worth twice the bar ends the run on the spot");
  ok(titleText() === "NO SAVING THIS ONE", "with a headline of its own (" + titleText() + ")");
  ok(note() === "ended by GenerousViewer", "naming whoever did it (" + note() + ")");
  ok(!has("is-pending"), "and no window at all, so it cannot be noped");
  redeem("Save the Run", 50000, "Rowan");
  ok(has("is-reset"), "even the whole nope target will not touch it");
  advance(11 * 1000);
  ok(!has("is-reset") && readout() === "0 / 100", "it clears itself like any other reset (" + readout() + ")");

  await load();
  bomb(19);   // 190, over the bar but under twice it
  ok(has("is-pending") && !has("is-reset"), "a contribution just under the line still gives chat their window");

  await load();
  redeem("Lock the Bar", 10000, "Sage");
  ok(has("is-locked"), "locked");
  bomb(20);
  ok(has("is-reset"), "an outright reset goes straight through a lock rather than being eaten by it");

  /* The one place it deliberately does not apply. A hundred subs arriving during
     the sixty seconds is somebody saving the run in the most emphatic way available,
     and ending it on them for being too generous would be perverse. */
  await load();
  button("btnFillBar");
  bomb(20);
  ok(!has("is-reset") && !has("is-pending") && readout() === "0 / 100",
     "a huge gift during the window saves the run rather than ending it (" + readout() + ")");

  await load({ overkillSubs: 0 });
  bomb(20);
  ok(has("is-pending") && !has("is-reset"), "setting the multiplier to zero turns the whole thing off");

  // !barsub with a minus is a manual correction.
  console.log("\n[!barsub as a correction]");
  await load();
  chat("!barsub 3", { mod: true });
  ok(readout() === "30 / 100", "three subs in (" + readout() + ")");
  chat("!barsub -1", { mod: true });
  ok(readout() === "20 / 100", "!barsub -1 takes one back off (" + readout() + ")");
  chat("!barsub -1", { nick: "viewer" });
  ok(readout() === "20 / 100", "and a viewer cannot do it (" + readout() + ")");
  chat("!barsub -1 t3", { mod: true });
  ok(readout() === "0 / 100", "a tier can be named, and it never goes below empty (" + readout() + ")");
  chat("!barsub -0", { mod: true });
  chat("!barsub -banana", { mod: true });
  ok(readout() === "0 / 100", "nonsense is ignored");
  chat("!barsub 5", { mod: true });
  chat("!barsub -2", { mod: true });
  ok(readout() === "30 / 100", "and it takes the count you give it (" + readout() + ")");
  chat("!barsub -1 tier 2", { mod: true });
  ok(readout() === "15 / 100", "written out in full too (" + readout() + ")");

  await load();
  button("btnFillBar");
  advance(10 * 1000);
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  ok(readout() === "20 / 50 points" && timerText() === "60s", "two subs in the save pot, each adding five seconds (" + readout() + ")");
  chat("!barsub -1", { mod: true });
  ok(has("is-pending") && readout() === "10 / 50 points", "during the window it comes off the pot and the window carries on (" + readout() + ")");
  ok(timerText() === "60s", "with the clock untouched (" + timerText() + ")");
  advance(65 * 1000);
  ok(has("is-reset"), "the window runs out");
  sub({ tier: "1000", name: "Sage" });
  sub({ tier: "1000", name: "Sage" });
  chat("!barsub -1", { mod: true });
  advance(10 * 1000);
  ok(readout() === "10 / 100", "during the banner it comes off what is banked for the next bar (" + readout() + ")");

  await load();
  chat("!barsub 4", { mod: true });
  chat("!baroff", { mod: true });
  chat("!barsub -1", { mod: true });
  chat("!baron", { mod: true });
  ok(readout() === "30 / 100", "a correction works while the bar is switched off (" + readout() + ")");
  await load();
  chat("!barsub 4", { mod: true });
  advance(400);
  chat("!barsub -1", { mod: true });
  advance(400);
  await reload();
  ok(readout() === "30 / 100", "and it survives a refresh (" + readout() + ")");

  // !barbits adds bits by hand.
  console.log("\n[!barbits]");
  await load();
  chat("!barbits 500", { mod: true });
  ok(readout() === "5 / 100", "!barbits 500 is 500 bits, which is 5 points at this baseline (" + readout() + ")");
  chat("!barbits 1,000", { mod: true });
  ok(readout() === "15 / 100", "a comma in the number is fine (" + readout() + ")");
  chat("!barbits 500", { nick: "viewer" });
  ok(readout() === "15 / 100", "and a viewer cannot use it (" + readout() + ")");
  chat("!barbits -500", { mod: true });
  ok(readout() === "10 / 100", "a minus takes them back off as a correction (" + readout() + ")");
  chat("!barbits -99999", { mod: true });
  ok(readout() === "0 / 100", "and it never goes below empty (" + readout() + ")");
  chat("!barbits", { mod: true });
  chat("!barbits banana", { mod: true });
  chat("!barbits 0", { mod: true });
  chat("!barbits 5.5", { mod: true });
  ok(readout() === "0 / 100", "nothing, nonsense, zero and decimals are all ignored");
  chat("!barbits 5000", { mod: true });
  ok(readout() === "50 / 100" && !has("is-pending"), "a bigger one is just a bigger cheer (" + readout() + ")");
  chat("!barbits 5000", { mod: true });
  ok(has("is-pending"), "and it can fill the bar and start the clock");

  await load();
  button("btnFillBar");
  advance(10 * 1000);
  chat("!barbits 500", { mod: true });
  ok(readout() === "5 / 50 points" && timerText() === "55s", "in a save window it chips in and adds five seconds like a cheer (" + readout() + ", " + timerText() + ")");
  chat("!barbits -300", { mod: true });
  ok(readout() === "2 / 50 points", "and a minus comes off the pot (" + readout() + ")");

  await load({ lockBreakSubs: 50 });
  redeem("Lock the Bar", 10000, "Sage");
  chat("!barbits 2000", { mod: true });
  ok(has("is-locked") && readout() === "0 / 100" && note() === "3 subs / 3,000 bits / £150.00 to break", "against a lock it counts towards breaking it (" + note() + ")");

  await load();
  chat("!barbits 1000", { mod: true });
  chat("!baroff", { mod: true });
  chat("!barbits 1000", { mod: true });
  chat("!barbits -300", { mod: true });
  chat("!baron", { mod: true });
  ok(readout() === "7 / 100", "switched off, adding is ignored like a real cheer and a correction still works (" + readout() + ")");

  // Subs do not count towards a save in the first ten seconds after the bar fills.
  console.log("\n[the grace period after the bar fills]");
  ok(shipped().saveGraceSeconds === 10, "the shipped grace period is ten seconds (" + shipped().saveGraceSeconds + ")");
  await load({ saveGraceSeconds: 10 });
  button("btnFillBar");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-pending") && readout() === "0 / 50 points" && timerText() === "60s", "a sub right after the bar fills does nothing at all (" + readout() + ", " + timerText() + ")");
  chat("!barsub 3", { mod: true });
  ok(readout() === "0 / 50 points", "including a gift, so a bomb's overflow cannot save the run (" + readout() + ")");
  cheer({ amount: 1000, name: "Rowan" });
  ok(readout() === "10 / 50 points", "but a cheer counts straight away (" + readout() + ")");
  tip(50, "Sage");
  ok(readout() === "20 / 50 points", "and so does a donation (" + readout() + ")");
  redeem("Save the Run", 10000, "Ash");
  ok(readout() === "21 / 50 points", "and a redeem (" + readout() + ")");
  advance(9 * 1000);
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "21 / 50 points", "still ignored at nine seconds (" + readout() + ")");
  advance(2 * 1000);
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "31 / 50 points", "and counts once the ten seconds are up (" + readout() + ")");

  await load({ saveGraceSeconds: 0 });
  button("btnFillBar");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "10 / 50 points", "set to zero the grace period is off (" + readout() + ")");

  // The window it applies to is the one the bar just opened, not the next one.
  await load({ saveGraceSeconds: 10 });
  button("btnFillBar");
  advance(70 * 1000);
  button("btnFillBar");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "0 / 50 points", "every new window starts with its own grace period (" + readout() + ")");

  // The other way round: subs are ignored when the bar fills by a sub itself.
  await load({ saveGraceSeconds: 10 });
  for (let i = 0; i < 10; i++) sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-pending"), "ten subs fill the bar");
  sub({ tier: "1000", name: "Rowan" });
  sub({ tier: "1000", name: "Sage" });
  ok(readout() === "0 / 50 points", "and the two that landed in the same moment do not save it (" + readout() + ")");

  // Switching subs, cheers and donations off as ways to save.
  console.log("\n[only redeems can save the run]");
  await load({ moneySavesRun: false });
  button("btnFillBar");
  ok(readout() === "0 / 5 redeems" && note() === "5 redeems / 50,000 points to save", "the save bar counts redeems (" + readout() + ", " + note() + ")");
  elements["rage-card"].classList.remove("refused");
  sub({ tier: "3000", name: "GenerousViewer" });
  ok(readout() === "0 / 5 redeems" && has("refused") && timerText() === "60s", "a sub is turned away and adds no time (" + readout() + ", " + timerText() + ")");
  cheer({ amount: 100000, name: "Rowan" });
  tip(5000, "Sage");
  ok(has("is-pending") && readout() === "0 / 5 redeems", "so is any amount of bits or donations (" + readout() + ")");
  redeem("Save the Run", 1000000, "Ash");
  ok(readout() === "1 / 5 redeems" && note() === "4 redeems / 40,000 points to save" && width() === "20%", "a redeem counts as one, whatever it cost (" + readout() + ", " + note() + ", " + width() + ")");
  redeem("Save the Run", 10000, "Juniper");
  redeem("Save the Run", 10000, "Juniper");
  redeem("Save the Run", 10000, "Juniper");
  ok(note() === "1 redeem / 10,000 points to save", "down to the last one (" + note() + ")");
  advance(400);
  await reload();
  ok(has("is-pending") && readout() === "4 / 5 redeems", "the count survives a refresh (" + readout() + ")");
  redeem("Save the Run", 10000, "Wren");
  ok(!has("is-pending") && readout() === "0 / 100", "and the fifth saves the run (" + readout() + ")");

  await load({ moneySavesRun: false, nopeRedeemsToSave: 10, saveRewardCost: 25000 });
  button("btnFillBar");
  ok(readout() === "0 / 10 redeems" && note() === "10 redeems / 250,000 points to save", "ten redeems at 25,000 is a quarter of a million points (" + readout() + ", " + note() + ")");
  redeem("Save the Run", 25000, "Ash");
  redeem("Save the Run", 25000, "Rowan");
  ok(note() === "8 redeems / 200,000 points to save", "and it counts down as they come in (" + note() + ")");
  await load({ moneySavesRun: false, saveRewardCost: 0 });
  button("btnFillBar");
  ok(note() === "5 redeems to save", "a price of zero hides the points figure (" + note() + ")");
  await load({ moneySavesRun: false, nopeRedeemsToSave: 0 });
  button("btnFillBar");
  redeem("Save the Run", 10000, "Ash");
  ok(!has("is-pending"), "with the flat count at zero one redeem still saves it, so it can always be saved");

  await load({ moneySavesRun: false });
  button("btnFillBar");
  chat("!barnope", { mod: true });
  ok(!has("is-pending"), "a mod can still save it by hand");

  await load({ moneySavesRun: false });
  sub({ tier: "1000", name: "GenerousViewer" });
  cheer({ amount: 100, name: "Rowan" });
  ok(readout() === "11 / 100", "while the bar is filling nothing changes (" + readout() + ")");
  redeem("Save the Run", 10000, "Ash");
  ok(readout() === "11 / 100", "and a redeem outside the window does nothing (" + readout() + ")");

  // The outright amount, shown as the same full-card banner but as a joke, with the
  // bar picking up afterwards exactly where it had been.
  console.log("\n[cosplay mode replaces the banner rather than the ending]");
  await load({ overkillCosplay: true });
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "10 / 100", "one sub in before the big gift arrives (" + readout() + ")");
  bomb(20);   // twice the whole bar at this baseline, normally the outright amount
  ok(has("is-reset") && titleText() === "You didn't get over it, time to cosplay",
     "the same full-card banner takes over, with the joke line instead (" + titleText() + ")");
  ok(readout() === "100 / 100" && width() === "100%",
     "and it shows full underneath, exactly as the real ending does (" + readout() + ")");
  ok(note() === "", "with no note, since nothing actually ended (" + note() + ")");
  advance(9 * 1000);
  ok(has("is-reset"), "it holds for the same ten seconds as a real ending");
  advance(2 * 1000);
  ok(!has("is-reset") && readout() === "10 / 100",
     "then the bar picks up exactly where it had been before the gift (" + readout() + ")");

  // The escalation does not move: nothing about this was a real reset.
  await load({ overkillCosplay: true });
  bomb(20);
  advance(11 * 1000);
  button("btnFillBar");
  advance(101 * 1000);
  ok(readout() === "0 / 100", "the bar after a real reset is still the first size (" + readout() + ")");

  // It bypasses a lock exactly the same way an outright ending does.
  await load({ overkillCosplay: true });
  redeem("Lock the Bar", 10000, "Sage");
  bomb(20);
  ok(has("is-reset"), "the banner takes over regardless of the lock");
  advance(11 * 1000);
  ok(!has("is-locked"), "and the lock is gone once it clears, the same as a real ending clears it");

  // Anything that arrives during the banner is banked, exactly as it is for a real
  // ending, and lands once the bar resumes.
  await load({ overkillCosplay: true });
  sub({ tier: "1000", name: "GenerousViewer" });
  bomb(20);
  sub({ tier: "1000", name: "Rowan" });
  advance(11 * 1000);
  ok(readout() === "20 / 100", "the sub sent during the banner is added on once it resumes (" + readout() + ")");

  // Unticked, nothing about the ending changes.
  await load({ overkillCosplay: false });
  bomb(20);
  ok(has("is-reset") && titleText() === "NO SAVING THIS ONE",
     "unticked, the run still ends outright as before");
  advance(11 * 1000);
  ok(readout() === "0 / 100", "and a real ending grows the next bar (unchanged here since this baseline does not grow)");

  await load({ overkillCosplay: false, capacityGrowth: 1.5 });
  bomb(20);
  advance(11 * 1000);
  ok(readout() === "0 / 150", "with growth on, a real ending does grow the next bar");

  // Q. the reward that pushes the bar back
  console.log("\n[push back the bar]");
  await load({ pushBackAmount: 25 });
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  sub({ tier: "1000", name: "Sage" });
  ok(readout() === "30 / 100", "three subs in (" + readout() + ")");
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(readout() === "5 / 100", "the reward takes 25 points back off (" + readout() + ")");
  ok(width() === "5%", "and the bar moves with it (" + width() + ")");
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(readout() === "0 / 100", "it never takes it below empty (" + readout() + ")");
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(readout() === "0 / 100" && !has("is-pending"), "and on an empty bar it does nothing at all");
  sub({ tier: "1000", name: "GenerousViewer" });
  redeem("🔁 push back the bar (big one)", 25000, "Ash");
  ok(readout() === "0 / 100", "it is matched on the start of the title, with the emoji and the case ignored (" + readout() + ")");

  await load({ pushBackAmount: 25 });
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  redeem("Lock the Bar", 10000, "Sage");
  ok(has("is-locked"), "locked");
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(has("is-locked") && readout() === "0 / 100", "it works through a lock, which only stops the bar rising (" + readout() + ")");

  // Not while it is full: pulling the bar down would cancel the countdown.
  await load({ pushBackAmount: 25 });
  button("btnFillBar");
  advance(10 * 1000);
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(has("is-pending") && timerText() === "50s", "while the save window is open it is turned away (" + timerText() + ")");
  advance(55 * 1000);
  ok(has("is-reset"), "the window runs out");
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(has("is-reset") && readout() === "100 / 100", "and it is turned away during the reset banner too (" + readout() + ")");

  await load({ pushBackAmount: 0 });
  sub({ tier: "1000", name: "GenerousViewer" });
  redeem("Push Back the Bar", 10000, "Juniper");
  ok(readout() === "10 / 100", "set to zero the reward is switched off (" + readout() + ")");

  await load({ pushBackAmount: 25 });
  sub({ tier: "1000", name: "GenerousViewer" });
  chat("!baroff", { mod: true });
  redeem("Push Back the Bar", 10000, "Juniper");
  chat("!baron", { mod: true });
  ok(readout() === "10 / 100", "and it does nothing while the bar is switched off (" + readout() + ")");

  await load({ pushBackAmount: 25 });
  sub({ tier: "1000", name: "GenerousViewer" });
  advance(400);
  redeem("Push Back the Bar", 10000, "Juniper");
  advance(400);
  await reload();
  ok(readout() === "0 / 100", "the pushed back bar survives a refresh (" + readout() + ")");

  /* O. the tuning this actually ships with. The bar counts points: a tier 1 sub is
     5, so the first bar of 100 is twenty of them, and it is also 5,000 bits or 50 in
     donations, each of which fills it on their own. Every bar after the first is
     bigger, and saving a run costs proportionally more with it. These assertions are here so
     that retuning stays a deliberate edit rather than something that drifts. */
  console.log("\n[the tuning it ships with]");
  const F = shipped();
  ok(F.capacity === 100, "the first bar holds a hundred points (" + F.capacity + ")");
  ok(F.capacityGrowth === 1.5, "and each bar after it is half as big again (" + F.capacityGrowth + ")");
  ok(F.subTier1 === 5 && F.subTier2 === 7 && F.subTier3 === 20, "subs are worth 5, 7 and 20 points");
  ok(F.tipPerSub === 2.5 && F.bitsPer100 === 2, "1 in donations is 2 points and 100 bits is 2 points (" + F.tipPerSub + ", " + F.bitsPer100 + ")");
  ok(F.nopeSeconds === 90, "chat gets ninety seconds to save a run (" + F.nopeSeconds + ")");
  ok(F.overkillSubs === 500, "and a hundred gifted subs' worth ends a run outright (" + F.overkillSubs + ")");

  await loadShipped();
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "5 / 100", "a tier 1 sub is 5 points (" + readout() + ")");
  sub({ tier: "3000", name: "Rowan" });
  ok(readout() === "25 / 100", "a tier 3 sub is 20, four times a tier 1 (" + readout() + ")");
  sub({ tier: "2000", name: "Sage" });
  ok(readout() === "32 / 100", "and a tier 2 is 7 (" + readout() + ")");

  // The headline number: twenty tier 1 subs, cumulatively, and the run is gone.
  await loadShipped();
  for (let i = 0; i < 19; i++) sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "95 / 100" && !has("is-pending"), "nineteen subs is not enough (" + readout() + ")");
  sub({ tier: "1000", name: "Rowan" });
  ok(has("is-pending"), "the twentieth is the one that does it");

  await loadShipped();
  bomb(15);
  ok(readout() === "75 / 100" && !has("is-pending"), "a bomb of fifteen gets three quarters of the way (" + readout() + ")");
  ok(note() === "5 subs / 1,250 bits / £12.50 to go", "and the line under it says what is left in subs, bits and money (" + note() + ")");

  // The three ways of filling a first bar all come to the same thing.
  await loadShipped();
  ok(note() === "20 subs / 5,000 bits / £50.00 to go", "an empty first bar is twenty subs, 5,000 bits or 50 in donations (" + note() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(note() === "19 subs / 4,750 bits / £47.50 to go", "and it counts down as they arrive (" + note() + ")");
  sub({ tier: "3000", name: "Rowan" });
  ok(note() === "15 subs / 3,750 bits / £37.50 to go", "with the exact bit total, not one over from floating point (" + note() + ")");
  await loadShipped({ currencySymbol: "$" });
  ok(note() === "20 subs / 5,000 bits / $50.00 to go", "the currency symbol is a setting (" + note() + ")");
  await loadShipped();
  cheer({ amount: 5000, name: "Rowan" });
  ok(has("is-pending"), "5,000 bits fills the first bar on its own");
  await loadShipped();
  cheer({ amount: 4900, name: "Rowan" });
  ok(!has("is-pending"), "and 4,900 does not");
  await loadShipped();
  tip(50, "Sage");
  ok(has("is-pending"), "50 in donations fills it on its own");
  await loadShipped();
  tip(49, "Sage");
  ok(!has("is-pending"), "and 49 does not");

  // Bits are two points a hundred, so 250 of them is a tier 1 sub.
  await loadShipped();
  cheer({ amount: 100, name: "Rowan" });
  ok(readout() === "2 / 100", "a 100 bit cheer is 2 points (" + readout() + ")");
  ok(width() === "2%", "which is 2% of the bar (" + width() + ")");
  cheer({ amount: 400, name: "Rowan" });
  ok(readout() === "10 / 100", "and 500 bits altogether is 10 points, two tier 1 subs' worth (" + readout() + ")");

  await loadShipped();
  tip(2.5, "GenerousViewer");
  ok(readout() === "5 / 100", "a donation of 2.50 is worth a tier 1 sub (" + readout() + ")");
  tip(5, "Rowan");
  ok(readout() === "15 / 100", "and twice that is worth two (" + readout() + ")");

  await loadShipped();
  redeem("Fill the Bar", 2000, "GenerousViewer");
  ok(readout() === "5 / 100", "a fill redeem is worth a tier 1 sub (" + readout() + ")");
  ok(titleText() === "POINTS TO RESET THE RUN", "and the headline says what the number means (" + titleText() + ")");
  for (let i = 0; i < 19; i++) redeem("Fill the Bar", 2000, "Sage");
  ok(has("is-pending"), "so twenty redeems fill it, the same as twenty subs");

  await loadShipped();
  redeem("Lock the Bar (5 min)", 5000, "Sage");
  for (let i = 0; i < 4; i++) sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-locked") && note() === "1 sub / 250 bits / £2.50 to break", "four subs is not enough to break a lock (" + note() + ")");
  sub({ tier: "1000", name: "Rowan" });
  ok(!has("is-locked") && readout() === "0 / 100", "five subs breaks it, and they are spent doing it (" + readout() + ")");
  await loadShipped();
  redeem("Lock the Bar (5 min)", 5000, "Sage");
  cheer({ amount: 1250, name: "Rowan" });
  ok(!has("is-locked"), "so does 1,250 bits, which is five subs' worth");
  await loadShipped();
  redeem("Lock the Bar (5 min)", 5000, "Sage");
  tip(12.5, "Ash");
  ok(!has("is-locked"), "and so does 12.50 in donations");

  await loadShipped();
  redeem("Lock the Bar (5 min)", 5000, "GenerousViewer");
  ok(timerText() === "5:00", "5000 points still buys five minutes of quiet (" + timerText() + ")");
  redeem("Lock the Bar (10 min)", 10000, "Rowan");
  redeem("Lock the Bar (10 min)", 10000, "Sage");
  ok(timerText() === "20:00", "up to twenty minutes in total (" + timerText() + ")");

  await loadShipped();
  button("btnFillBar");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(has("is-pending") && readout() === "5 / 25 points" && note() === "4 subs / 1,000 bits / £10.00 to save",
     "one sub does not undo the whole bar on its own (" + note() + ")");
  /* The nope reward is matched by title, not by price, so the price it costs lives
     on Twitch rather than here. This asserts the title still works at the price the
     rewards list tells the streamer to set, which is the thing that would silently break if
     somebody renamed the reward while editing its cost. */
  await loadShipped();
  button("btnFillBar");
  ["GenerousViewer", "Rowan", "Sage", "Juniper"].forEach(who => redeem("Save the Run", 10000, who));
  ok(has("is-pending") && readout() === "20 / 25 points" && note() === "1 sub / 250 bits / £2.50 to save",
     "four people at 10000 points each are not quite enough (" + note() + ")");
  redeem("Save the Run", 10000, "Ash");
  ok(!has("is-pending") && readout() === "0 / 100", "it takes five of them (" + readout() + ")");

  await loadShipped();
  button("btnFillBar");
  for (let i = 0; i < 5; i++) sub({ tier: "1000", name: "GenerousViewer" });
  ok(!has("is-pending"), "or five subs, which is the same five subs that break a lock");

  await loadShipped();
  button("btnFillBar");
  sub({ tier: "3000", name: "GenerousViewer" });
  cheer({ amount: 1000, name: "Rowan" });
  redeem("Save the Run", 10000, "Sage");
  ok(!has("is-pending") && readout() === "0 / 100", "or a mix of all three, which is the point of counting them the same way");

  /* The un-nopeable reset: a hundred tier 1 gifted subs' worth in one go, which is
     500 points. One point short of it is just a very big night, and the bar is only
     full, so chat still gets its sixty seconds. */
  await loadShipped();
  bomb(99);
  ok(has("is-pending") && !has("is-reset"), "ninety nine gifted subs fills the bar but can still be saved");
  await loadShipped();
  bomb(100);
  ok(has("is-reset") && titleText() === "NO SAVING THIS ONE",
     "and a hundred gifted subs at once ends it outright (" + titleText() + ")");

  await loadShipped();
  button("btnFillBar");
  ok(timerText() === "90s", "the save clock starts at ninety seconds (" + timerText() + ")");
  advance(89 * 1000);
  ok(has("is-pending"), "and is still running a second before the end");
  advance(2 * 1000);
  ok(has("is-reset"), "and then it runs out");

  // P. the bars grow. Reaching the end of a bar for real means letting the nope
  // window run out and the banner clear, which is what a successful reset is.
  console.log("\n[the bars grow]");
  function playBar(cap) {
    button("btnFillBar");
    advance(101 * 1000);
    ok(!has("is-reset") && !has("is-pending"), "bar of " + cap + " ran out and cleared");
  }
  const sizes = [100, 150, 225, 338, 506, 759];
  await loadShipped();
  for (let i = 0; i < sizes.length; i++) {
    ok(readout() === "0 / " + sizes[i], "bar " + (i + 1) + " holds " + sizes[i] + " (" + readout() + ")");
    playBar(sizes[i]);
  }

  const targets = [25, 38, 56, 84, 127];
  const targetNotes = [
    "5 subs / 1,250 bits / £12.50 to save", "8 subs / 1,900 bits / £19.00 to save",
    "12 subs / 2,800 bits / £28.00 to save", "17 subs / 4,200 bits / £42.00 to save",
    "26 subs / 6,350 bits / £63.50 to save"];
  await loadShipped();
  for (let i = 0; i < targets.length; i++) {
    button("btnFillBar");
    ok(readout() === "0 / " + targets[i] + " points" && note() === targetNotes[i],
       "bar " + (i + 1) + " costs " + targets[i] + " to save (" + readout() + ", " + note() + ")");
    advance(101 * 1000);
  }

  // A save is not a reset, so it does not make the next bar bigger.
  await loadShipped();
  button("btnFillBar");
  button("btnNope");
  ok(readout() === "0 / 100", "a saved run keeps the same size bar (" + readout() + ")");
  button("btnFillBar");
  for (let i = 0; i < 5; i++) redeem("Save the Run", 10000, "GenerousViewer");
  ok(readout() === "0 / 100", "and so does one chat paid to save (" + readout() + ")");

  // !barreset with a bar number goes to that bar, and 1 is the way back to the start.
  await loadShipped();
  for (let i = 0; i < 3; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 338", "three resets in, the fourth bar is 270 (" + readout() + ")");
  chat("!barreset 1", { nick: "viewer" });
  ok(readout() === "0 / 338", "a viewer cannot send the bar back to the start (" + readout() + ")");
  chat("!barreset 1", { mod: true });
  ok(readout() === "0 / 100", "!barreset 1 goes back to the first bar (" + readout() + ")");
  chat("!barreset 3", { mod: true });
  ok(readout() === "0 / 225", "!barreset 3 jumps to the third (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  chat("!barreset", { mod: true });
  ok(readout() === "0 / 225", "and a bare !barreset still only clears the bar (" + readout() + ")");
  chat("!barreset 0", { mod: true });
  ok(readout() === "0 / 100", "zero is treated as the first bar (" + readout() + ")");
  chat("!barreset banana", { mod: true });
  ok(readout() === "0 / 100", "and something that is not a number just clears it (" + readout() + ")");
  chat("!barreset 3", { mod: true });
  advance(400);
  await reload();
  ok(readout() === "0 / 225", "the bar it was sent to survives a refresh (" + readout() + ")");

  // Neither is a mod clearing the bar away.
  await loadShipped();
  button("btnFillBar");
  advance(101 * 1000);
  ok(readout() === "0 / 150", "the second bar is bigger (" + readout() + ")");
  chat("!barreset", { mod: true });
  ok(readout() === "0 / 150", "!barreset clears the bar but keeps the size it has grown to (" + readout() + ")");
  button("btnReset");
  ok(readout() === "0 / 150", "and so does the Reset button (" + readout() + ")");
  button("btnRestartEscalation");
  ok(readout() === "0 / 100", "while the other button goes back to the first bar (" + readout() + ")");

  // An un-nopeable reset is a reset too.
  await loadShipped();
  bomb(100);
  advance(11 * 1000);
  ok(readout() === "0 / 150", "an outright reset makes the next bar bigger as well (" + readout() + ")");

  // The bar that just filled stays on screen while its banner is up.
  await loadShipped();
  button("btnFillBar");
  advance(91 * 1000);
  ok(has("is-reset") && readout() === "100 / 100", "the banner shows the bar that filled, not the next one (" + readout() + ")");

  // Nothing about the growth is lost to a refresh.
  await loadShipped();
  button("btnFillBar");
  advance(101 * 1000);
  advance(400);
  await reload();
  ok(readout() === "0 / 150", "a refresh keeps how far the bars have grown (" + readout() + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(readout() === "5 / 150", "and it is a working bar afterwards (" + readout() + ")");

  // A save from before the bars grew has no count, so it is simply the first bar.
  await loadShipped();
  storeData[KEY] = { fill: 40, phase: "filling", lockUntil: 0, nopeUntil: 0, resetUntil: 0 };
  await reload();
  ok(readout() === "40 / 100", "an old save comes back on the first bar (" + readout() + ")");

  // Growth is a setting: at 2x the bars double, and the outright amount follows.
  await loadShipped({ capacityGrowth: 2 });
  const doubled = [100, 200, 400, 800];
  for (let i = 0; i < doubled.length; i++) {
    ok(readout() === "0 / " + doubled[i], "at 2x, bar " + (i + 1) + " holds " + doubled[i] + " (" + readout() + ")");
    button("btnFillBar");
    advance(101 * 1000);
  }

  // Whatever the growth, a bar is a whole number of points.
  await loadShipped({ capacityGrowth: 1.3 });
  let whole = true, shown = [];
  for (let i = 0; i < 10; i++) {
    const m = readout().match(/\/ (\d+)$/);
    if (!m) whole = false; else shown.push(+m[1]);
    button("btnFillBar");
    advance(101 * 1000);
  }
  ok(whole, "every bar at 1.3x is a whole number (" + shown.join(", ") + ")");

  // Growth of one means the bars never change.
  await loadShipped({ capacityGrowth: 1 });
  for (let i = 0; i < 3; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 100", "at 1x they stay put (" + readout() + ")");

  // Saving a run costs exactly what the note says, on a bigger bar too. The flat
  // five-redeem cancel is switched off here so the pot arithmetic can be seen alone.
  await loadShipped({ nopeRedeemsToSave: 0 });
  button("btnFillBar");
  advance(101 * 1000);
  button("btnFillBar");
  ok(readout() === "0 / 38 points" && note() === "8 subs / 1,900 bits / £19.00 to save", "the second bar costs 38 to save (" + note() + ")");
  for (let i = 0; i < 7; i++) redeem("Save the Run", 10000, "GenerousViewer");   // 35 points
  ok(has("is-pending") && readout() === "35 / 38 points" && note() === "1 sub / 150 bits / £1.50 to save", "thirty five is not enough (" + note() + ")");
  redeem("Save the Run", 10000, "Rowan");
  ok(!has("is-pending") && readout() === "0 / 150", "forty is (" + readout() + ")");

  /* Five Save the Run redeems save the run on every bar. The pot gets dearer with
     each reset, and this is the one thing that does not, so channel points always
     count for the same amount however far the run has got. */
  console.log("\n[five redeems always save the run]");
  await loadShipped();
  ok(F.nopeRedeemsToSave === 5, "the shipped number is five (" + F.nopeRedeemsToSave + ")");
  for (let bar = 1; bar <= 6; bar++) {
    button("btnFillBar");
    for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "GenerousViewer");
    ok(has("is-pending"), "on bar " + bar + " four redeems are not enough");
    redeem("Save the Run", 10000, "Rowan");
    ok(!has("is-pending") && !has("is-reset"), "and the fifth saves it (" + readout() + ")");
    // A save is not a reset, so to move up a bar let one window run out.
    button("btnFillBar");
    advance(101 * 1000);
  }

  await loadShipped();
  for (let i = 0; i < 2; i++) { button("btnFillBar"); advance(101 * 1000); }
  button("btnFillBar");
  ok(readout() === "0 / 56 points", "the third bar wants 56 points in the pot (" + readout() + ")");
  for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "GenerousViewer");
  ok(readout() === "20 / 56 points", "each redeem still chips into the pot (" + readout() + ")");
  redeem("Save the Run", 10000, "Rowan");
  ok(!has("is-pending") && readout() === "0 / 225",
     "and the fifth saves it with the pot nowhere near full (" + readout() + ")");

  await loadShipped();
  button("btnFillBar");
  for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "GenerousViewer");
  advance(101 * 1000);
  button("btnFillBar");
  for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "GenerousViewer");
  ok(has("is-pending"), "the count starts again with each window, so four and four is not five");

  await loadShipped();
  for (let i = 0; i < 3; i++) redeem("Save the Run", 10000, "GenerousViewer");
  button("btnFillBar");
  for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "Rowan");
  ok(has("is-pending"), "redeems made before the window opens do not count towards the five");

  await loadShipped();
  button("btnFillBar");
  for (let i = 0; i < 4; i++) redeem("Save the Run", 10000, "GenerousViewer");
  advance(400);
  await reload();
  redeem("Save the Run", 10000, "Rowan");
  ok(!has("is-pending"), "the count survives a refresh");

  await loadShipped();
  button("btnFillBar");
  for (let i = 0; i < 3; i++) redeem("Save the Run", 10000, "GenerousViewer");
  sub({ tier: "1000", name: "Rowan" });
  cheer({ amount: 500, name: "Sage" });
  redeem("Save the Run", 10000, "Ash");
  redeem("Save the Run", 10000, "Juniper");
  ok(!has("is-pending"), "a mix of redeems and other money still saves it once the fifth redeem lands");

  await loadShipped({ nopeRedeemsToSave: 0 });
  for (let i = 0; i < 2; i++) { button("btnFillBar"); advance(101 * 1000); }
  button("btnFillBar");
  for (let i = 0; i < 5; i++) redeem("Save the Run", 10000, "GenerousViewer");
  ok(has("is-pending"), "set to zero the flat cancel is off and only the pot counts (" + readout() + ")");

  await loadShipped({ nopeRedeemsToSave: 3 });
  button("btnFillBar");
  for (let i = 0; i < 3; i++) redeem("Save the Run", 10000, "GenerousViewer");
  ok(!has("is-pending"), "and the number is a setting (three here)");

  // The push back is two subs' worth on the first bar, and grows with the bar the
  // same way the cost of a save does.
  await loadShipped();
  ok(F.pushBackAmount === 10, "the shipped push back is ten points (" + F.pushBackAmount + ")");
  sub({ tier: "1000", name: "GenerousViewer" });
  sub({ tier: "1000", name: "Rowan" });
  sub({ tier: "1000", name: "Sage" });
  redeem("Push Back the Bar", 5000, "Juniper");
  ok(readout() === "5 / 100", "a redeem takes two tier 1 subs' worth off the first bar (" + readout() + ")");
  await loadShipped();
  cheer({ amount: 5000, name: "Rowan" });
  ok(has("is-pending"), "first bar full");
  advance(101 * 1000);
  sub({ tier: "3000", name: "GenerousViewer" });
  sub({ tier: "3000", name: "Rowan" });
  ok(readout() === "40 / 150", "second bar, two tier 3 subs in (" + readout() + ")");
  redeem("Push Back the Bar", 5000, "Juniper");
  ok(readout() === "25 / 150", "it takes 15 points off the second bar, a tenth of it (" + readout() + ")");

  // The outright amount is 400 until the bar grows up to it, then it doubles.
  await loadShipped();
  for (let i = 0; i < 4; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 506", "the fifth bar is 405 (" + readout() + ")");
  bomb(100);
  ok(!has("is-pending") && !has("is-reset") && readout() === "500 / 506",
     "a hundred gifted subs is now just a big night, since the bar has grown past it (" + readout() + ")");
  await loadShipped();
  for (let i = 0; i < 4; i++) { button("btnFillBar"); advance(101 * 1000); }
  bomb(200);
  ok(has("is-reset") && titleText() === "NO SAVING THIS ONE", "and two hundred is the new un-nopeable amount (" + titleText() + ")");
  await loadShipped();
  for (let i = 0; i < 3; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 338", "the fourth bar is 270 (" + readout() + ")");
  bomb(100);
  ok(has("is-reset"), "and a hundred gifted subs is still un-nopeable on it");

  // At 2x it follows the bar up: 400, 400, 400, 800 as the bars grow 80, 160, 320, 640.
  await loadShipped({ capacityGrowth: 2 });
  for (let i = 0; i < 2; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 400", "at 2x the third bar is 320 (" + readout() + ")");
  bomb(100);
  ok(has("is-reset"), "and a hundred gifted subs still ends it");
  await loadShipped({ capacityGrowth: 2 });
  for (let i = 0; i < 3; i++) { button("btnFillBar"); advance(101 * 1000); }
  ok(readout() === "0 / 800", "the fourth bar is 640 (" + readout() + ")");
  bomb(199);
  ok(has("is-pending") && !has("is-reset"), "and 199 gifted subs only fills it now (" + readout() + ")");
  await loadShipped({ capacityGrowth: 2 });
  for (let i = 0; i < 3; i++) { button("btnFillBar"); advance(101 * 1000); }
  bomb(200);
  ok(has("is-reset"), "200 gifted subs, which is 800 points, ends it");


  // ---- the default look matches the rest of the set
  console.log("\n[default look]");
  await load();
  const R = elements["rage-app"].style;
  ok(R["--bg"] === "rgba(0, 0, 0, 0.55)" && R["--text"] === "#FFFFFF" && R["--accent"] === "#FFFFFF", "a soft see-through black card with white text (" + R["--bg"] + ")");
  ok(R["--font"].indexOf("BioRhyme") !== -1 && /family=BioRhyme:wght@200\.\.800/.test(elements["rage-font-link"].href || ""), "in BioRhyme, with its whole weight range requested");
  ok(R["--fill-from"] === "#D9D9D9" && R["--fill-to"] === "#FFFFFF" && R["--alarm"] === "#D64545", "a light fill and a clear red alarm");
  ok(R["--tilt"] === "0deg" && R["--shadow"] === "none" && R["--tail-display"] === "none" && R["--border-w"] === "0px", "flat: no tilt, shadow, tail or outline");
  ok(R["--title-w"] === "800" && R["--c-track"] === "rgba(255, 255, 255, 0.2)" && R["--c-alert"] === "#FFFFFF", "an extra bold heading and a white-tinted track");
  await load({ themePreset: "cosycabin" });
  ok(R["--accent"] === "#7C6142" && R["--c-float"] === "#57442E" && R["--c-float-bg"] === "#F5ECD6" && R["--c-track"] === "rgba(0, 0, 0, 0.11)", "a coloured preset colours each part from its own tones");

  // ---- wording
  console.log("\n[wording]");
  await load({ subWord: "gift", subsWord: "gifts", bitsWord: "cheers", toGoText: "left" });
  ok(/ left$/.test(note()) && note().indexOf("gifts") !== -1 && note().indexOf("cheers") !== -1, "the line under the bar uses the chosen words (" + note() + ")");
  await load({ readoutBarText: "{n} of {total}" });
  ok(readout() === "0 of 100", "the readout template (" + readout() + ")");
  await load({ offNote: "napping" });
  chat("!baroff", { mod: true });
  ok(note() === "napping", "the switched-off line (" + note() + ")");
  await load({ secondsSuffix: " secs" });
  button("btnFillBar");
  ok(/^\d+ secs$/.test(timerText()), "the save countdown suffix (" + timerText() + ")");
  await load({ moneySavesRun: false, readoutRedeemsText: "{n} of {total} redeems!" });
  button("btnFillBar");
  ok(/^0 of \d+ redeems!$/.test(readout()), "the redeem readout template (" + readout() + ")");
  await load({ lockedText: "SHUT" });
  button("btnLock");
  ok(elements["rage-float"].textContent === "SHUT", "the floating text when locked (" + elements["rage-float"].textContent + ")");
  await load({ lockBrokenText: "UNLOCKED", lockBrokenByText: "UNLOCKED BY {who}", lockBreakSubs: 5 });
  button("btnLock"); advance(2000); sub({ tier: "1000", name: "GenerousViewer" });
  // Floating texts show one at a time, so step the clock until this one comes up.
  for (let i = 0; i < 8 && !/UNLOCKED/.test(elements["rage-float"].textContent); i++) advance(1700);
  ok(elements["rage-float"].textContent === "UNLOCKED BY GenerousViewer", "the floating text when a lock is broken, with the name filled in (" + elements["rage-float"].textContent + ")");
  await load({ savedText: "PHEW" });
  button("btnFillBar"); button("btnNope");
  ok(/PHEW/.test(elements["rage-float"].textContent), "the floating text when the run is saved (" + elements["rage-float"].textContent + ")");

  // ---- look settings
  console.log("\n[look settings]");
  await load({ radius: 12, paddingV: 8, paddingH: 9, gap: 4, tilt: 3, borderWidth: 2, shadow: true, textShadow: true, showTail: true, trackHeight: 15 });
  ok(R["--radius-pct"] === "12" && R["--pad-v"] === "8" && R["--pad-h"] === "9" && R["--gap"] === "4", "shape and spacing");
  ok(R["--tilt"] === "3deg" && R["--border-w"] === "2px" && R["--track-h"] === "15", "tilt, outline and bar thickness");
  ok(R["--shadow"] !== "none" && R["--text-shadow"] !== "none" && R["--tail-display"] === "block", "shadows and tail can be switched on");
  await load({ titleScale: 1.5, titleWeight: "400", titleSpacing: 0.2, titleUppercase: false, timerScale: 0.8, timerWeight: "600",
    readoutScale: 1.2, readoutWeight: "500", readoutOpacity: 0.5, noteScale: 0.9, noteWeight: "400", noteOpacity: 0.4, floatScale: 2, floatWeight: "800" });
  ok(R["--title-scale"] === "1.5" && R["--title-w"] === "400" && R["--title-spacing"] === "0.2em" && R["--title-case"] === "none", "heading text");
  ok(R["--timer-scale"] === "0.8" && R["--timer-w"] === "600" && R["--readout-scale"] === "1.2" && R["--readout-w"] === "500" && R["--readout-opacity"] === "0.5", "countdown and readout text");
  ok(R["--note-scale"] === "0.9" && R["--note-w"] === "400" && R["--note-opacity"] === "0.4" && R["--float-scale"] === "2" && R["--float-w"] === "800", "note and floating text");
  await load({ lockedOpacity: 0.3, offOpacity: 0.2, popScale: 1.3 });
  ok(R["--locked-opacity"] === "0.3" && R["--off-opacity"] === "0.2" && R["--pop-scale"] === "1.3", "locked and off looks, and the swell");
  await load({ themePreset: "custom", colorBg: "#102030", panelOpacity: 0.8, colorText: "#EEEEEE", colorAccent: "#FF00AA", colorFillFrom: "#010101", colorFillTo: "#020202", colorAlarm: "#030303",
    colorTitle: "#040404", colorTimer: "#050505", colorReadout: "#060606", colorNote: "#070707", colorBorder: "#080808", colorTrack: "#FFFFFF", trackOpacity: 0.4,
    colorLock: "#090909", colorLockHole: "#0A0A0A", colorFloat: "#0B0B0B", colorFloatBg: "#000000", colorAlert: "#0C0C0C", colorAlertFill: "#0D0D0D" });
  ok(R["--bg"] === "rgba(16, 32, 48, 0.8)" && R["--text"] === "#EEEEEE" && R["--accent"] === "#FF00AA", "Custom card, text and accent (" + R["--bg"] + ")");
  ok(R["--fill-from"] === "#010101" && R["--fill-to"] === "#020202" && R["--alarm"] === "#030303", "Custom fill and alarm");
  ok(R["--c-title"] === "#040404" && R["--c-timer"] === "#050505" && R["--c-readout"] === "#060606" && R["--c-note"] === "#070707", "Custom heading, countdown, readout and note colours");
  ok(R["--c-border"] === "#080808" && R["--c-track"] === "rgba(255, 255, 255, 0.4)" && R["--c-lock"] === "#090909" && R["--c-lock-hole"] === "#0A0A0A", "Custom outline, track and padlock colours (" + R["--c-track"] + ")");
  ok(R["--c-float"] === "#0B0B0B" && R["--c-float-bg"] === "rgba(0, 0, 0, 0.8)" && R["--c-alert"] === "#0C0C0C" && R["--c-alert-fill"] === "#0D0D0D", "Custom floating text and alarm colours");
  await load({ themePreset: "celestial", colorTitle: "#123123" });
  ok(R["--c-title"] !== "#123123", "a preset ignores the custom colours");
  await load({ radius: 999, titleScale: 99, tilt: 99, popScale: 0, trackOpacity: 9 });
  ok(R["--radius-pct"] === "50" && R["--title-scale"] === "3" && R["--tilt"] === "20deg" && R["--pop-scale"] === "1", "silly values are held to sensible limits");

  // ---- animation
  console.log("\n[animation]");
  await load();
  ok(!elements["rage-app"].classList.contains("no-motion") && R["--fill-s"] === "0.55s" && R["--pop-s"] === "0.42s" && R["--float-s"] === "1.6s" && R["--dread-s"] === "2.2s" && R["--panic-s"] === "0.8s" && R["--refuse-s"] === "0.42s", "on by default, at the original speeds");
  await load({ animations: false, fillSeconds: 2, popSeconds: 1, floatSeconds: 3, dreadSeconds: 4, panicSeconds: 0.5, refuseSeconds: 1 });
  ok(elements["rage-app"].classList.contains("no-motion"), "unticking Animate adds the no-motion class");
  ok(R["--fill-s"] === "2s" && R["--pop-s"] === "1s" && R["--float-s"] === "3s" && R["--dread-s"] === "4s" && R["--panic-s"] === "0.5s" && R["--refuse-s"] === "1s", "and the timings are configurable");
  await load({ floatSeconds: 3 });
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(elements["rage-float"].hidden === false, "a floating text appears");
  advance(2500);
  ok(elements["rage-float"].hidden === false, "and stays for the chosen time");
  advance(1000);
  ok(elements["rage-float"].hidden === true, "then leaves");

  // ---- sounds
  console.log("\n[sounds]");
  const played = () => audioLog.filter(a => a.played).map(a => a.src.replace("data:", ""));
  const clearLog = () => { audioLog.length = 0; };
  const withSounds = (o) => Object.assign({ addSound: "data:add", lockSound: "data:lock", breakSound: "data:break", fullSound: "data:full", savedSound: "data:saved", resetSound: "data:reset" }, o || {});
  await load(); clearLog();
  sub({ tier: "1000", name: "GenerousViewer" }); button("btnLock");
  ok(played().length === 0, "no sound plays when none are chosen");
  await load(withSounds()); clearLog();
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(played().join() === "add", "a contribution plays the contribution sound (" + played() + ")");
  clearLog(); button("btnLock");
  ok(played().join() === "lock", "locking plays the lock sound (" + played() + ")");
  clearLog(); advance(1000); sub({ tier: "1000", name: "GenerousViewer" });
  ok(played().indexOf("break") !== -1, "breaking the lock plays its sound (" + played() + ")");
  await load(withSounds()); clearLog();
  button("btnFillBar");
  ok(played().indexOf("full") !== -1, "a full bar plays the full sound (" + played() + ")");
  clearLog(); button("btnNope");
  ok(played().indexOf("saved") !== -1, "a save plays the saved sound (" + played() + ")");
  await load(withSounds({ addVolume: 25 })); clearLog();
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(audioLog[0].volume === 0.25, "each sound has its own volume (" + audioLog[0].volume + ")");
  await load(withSounds({ addVolume: 900 })); clearLog();
  sub({ tier: "1000", name: "GenerousViewer" });
  ok(audioLog[0].volume === 1, "held to the 0 to 1 range");
  await load(withSounds({ enableSounds: false })); clearLog();
  sub({ tier: "1000", name: "GenerousViewer" }); button("btnLock");
  ok(played().length === 0, "unticking Play sounds mutes everything");
  await load(withSounds()); clearLog();
  button("btnSoundAdd"); button("btnSoundLock"); button("btnSoundBreak"); button("btnSoundFull"); button("btnSoundSaved"); button("btnSoundReset");
  ok(played().join() === "add,lock,break,full,saved,reset", "the test buttons play each sound (" + played() + ")");

  // ---- every field is read
  console.log("\n[every field is read]");
  const keys = Object.keys(fields).filter(k => fields[k].type !== "button");
  const unread = keys.filter(k => src.indexOf("f." + k) === -1);
  ok(unread.length === 0, "every field in fields.json is read by widget.js (unread: " + unread.join(", ") + ")");
  const unhandled = Object.keys(fields).filter(k => fields[k].type === "button" && src.indexOf('"' + k + '"') === -1);
  ok(unhandled.length === 0, "every button is handled (unhandled: " + unhandled.join(", ") + ")");


  // ---- style presets: the same fourteen, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#7FA8FF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF8FB8", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#FF8A65", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}, "pastelpink": {"text": "#6A2E4B", "accent": "#D95C8A", "panel": "#FFE3EC", "font": "Fredoka"}, "faegreen": {"text": "#EEF5DA", "accent": "#C9E265", "panel": "#2C4A36", "font": "Almendra"}};
  const LABELS = {"glass": "Soft black (default)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "pastelpink": "Pastel pink", "faegreen": "Fae green", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 15, "the dropdown offers the fourteen shared presets and Custom, in the shared order");
  ok(Object.keys(LABELS).every(k => fields.themePreset.options[k] === LABELS[k]), "with the shared labels");
  ok(fields.themePreset.value === "glass", "and Soft black is the default");
  for (const key of Object.keys(EXPECT)) {
    await load({ themePreset: key });
    const S2 = elements["rage-app"].style;
    ok(S2["--text"] === EXPECT[key].text && S2["--accent"] === EXPECT[key].accent && S2["--bg"] === EXPECT[key].panel && S2["--font"].indexOf('"' + EXPECT[key].font + '"') !== -1,
      key + ": panel, text, accent and font match the shared table (" + S2["--text"] + ", " + S2["--accent"] + ")");
  }
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
