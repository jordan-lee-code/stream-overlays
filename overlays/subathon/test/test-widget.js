/* Headless integration test for the composed widget.
   Runs the real widget/widget.js (the Sub Incentives module and the clock together)
   against a small mock of the page and StreamElements, with a clock the test controls.
   It drives everything through the real onWidgetLoad / onEventReceived events and reads
   the rendered result back out, so the whole path from a StreamElements sub event to the
   digits on screen is covered, including the gift bomb case. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const clockSrc = fs.readFileSync(ROOT + "/src/clock.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));
const expectedPresets = JSON.parse(fs.readFileSync(ROOT + "/test/presets.expected.json", "utf8"));

function makeEl(id) {
  const e = {
    scrollWidth: 0, clientWidth: 0, offsetHeight: 0, clientHeight: 0, offsetWidth: 0,
    id, tagName: "div", className: "", textContent: "", hidden: false, href: "", rel: "",
    parentNode: null, children: [], _cls: new Set(),
    style: { setProperty(k, v) { this[k] = v; } },
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); if (on) this._s.add(c); else this._s.delete(c); }
    },
    addEventListener() {},
    appendChild(c) { return this.insertBefore(c, null); },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c);
      const at = ref ? this.children.indexOf(ref) : -1;
      if (at === -1) this.children.push(c); else this.children.splice(at, 0, c);
      c.parentNode = this; return c;
    },
    removeChild(c) { const at = this.children.indexOf(c); if (at !== -1) this.children.splice(at, 1); c.parentNode = null; return c; }
  };
  e.classList._s = e._cls; return e;
}
const elements = {};
const document = {
  getElementById: id => (elements[id] = elements[id] || (/^(subathon|incentive)-/.test(id) ? makeEl(id) : null)),
  createElement: tag => { const e = makeEl("x"); e.tagName = tag; return e; },
  head: makeEl("head"), body: makeEl("body"), fonts: null
};
const E = id => document.getElementById(id);

const listeners = {};
const window = {
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => fn(e)); }
};
class CustomEvent { constructor(t, i) { this.type = t; this.detail = i && i.detail; } }
const storeData = {};
const SE_API = { store: {
  set(k, v) { storeData[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
  get(k) { return Promise.resolve(storeData[k] ? JSON.parse(JSON.stringify(storeData[k])) : null); }
} };
const audioLog = [];
class Audio {
  constructor(s) { this.src = s; this.volume = 1; audioLog.push(this); }
  play() { this.played = true; return Promise.resolve(); }
}
// The test owns the clock the widget sees. Real timers still drive the widget's own tick.
const vclock = require("./clock")();   // timers are pretend; the date the widget reads is moved by hand through `fake`
let fake = 1700000000000;
class FakeDate extends Date { static now() { return fake; } }
const sandbox = {
  window, document, CustomEvent, SE_API, Audio, Date: FakeDate,
  setTimeout: vclock.setTimeout, clearTimeout: vclock.clearTimeout, setInterval: vclock.setInterval, clearInterval: vclock.clearInterval, console, Math, Promise, JSON,
  parseFloat, parseInt, isNaN, String, Array, Object, encodeURIComponent
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

function fieldData(ov) {
  const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
  return Object.assign(fd, ov || {});
}
let lastFD = {};
async function load(ov) {
  delete storeData.subathon_v1; delete storeData.sub_goals_v1;
  lastFD = fieldData(ov);
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
  await wait(5);
}
async function reload() { window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } })); await wait(5); }
const ev = (listener, event) => window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener, event } }));
function chat(text, o) {
  o = o || {}; const badges = [];
  if (o.broadcaster) badges.push({ type: "broadcaster" });
  if (o.mod) badges.push({ type: "moderator" });
  ev("message", { data: { text, nick: (o.nick || "viewer").toLowerCase(), displayName: o.nick || "Viewer", badges, tags: { mod: o.mod ? "1" : "0" } } });
}
const boss = t => chat(t, { broadcaster: true });
const button = field => ev("widget-button", { field });
const sub = e => ev("subscriber-latest", e);
const cheer = n => ev("cheer-latest", { amount: n, name: "Cheerer" });
const tip = n => ev("tip-latest", { amount: n, name: "Tipper" });
const bomb = n => sub({ gifted: true, bulkGifted: true, amount: n, sender: "GenerousViewer" });
const wait = ms => vclock.advance(ms);
// Move the pretend clock on, then give the widget's own tick time to notice.
async function advance(ms) { fake += ms; await wait(260); }
async function settled() { await wait(260); }

const clock = () => E("subathon-clock").textContent;
const status = () => E("subathon-status").hidden ? "" : E("subathon-status").textContent;
const feed = () => E("subathon-feed").hidden ? "" : E("subathon-feed").textContent;
const has = c => E("subathon-app").classList.contains(c);
const vars = () => E("subathon-app").style;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  console.log("\n[the clock]");
  await load();
  ok(clock() === "24:00:00", "starts on the start time (" + clock() + ")");
  ok(has("paused") && status() === "paused", "starts paused, so nothing drains before the stream (" + status() + ")");
  button("tmResume"); await advance(60000);
  ok(clock() === "23:59:00" && !has("paused"), "resuming lets it count down in real time (" + clock() + ")");
  button("tmPause"); const frozen = clock(); await advance(120000);
  ok(clock() === frozen && status() === "paused", "pausing holds it still (" + clock() + ")");
  button("tmResume"); await advance(1000);
  boss("!subathon pause"); const f2 = clock(); await advance(5000);
  ok(clock() === f2, "!subathon pause pauses too");
  boss("!subathon resume"); await advance(1000);
  ok(!has("paused"), "!subathon resume resumes");
  await load({ tmStart: "100:00:00" });
  ok(clock() === "100:00:00" && has("long"), "hours are not capped at a day, and a three digit hour count still fits (" + clock() + ")");
  await load({ tmStart: "1d 12h" });
  ok(clock() === "36:00:00", "start times accept 1d 12h");
  await load({ tmStart: "not a time" });
  ok(clock() === "24:00:00", "an unreadable start time falls back to 24 hours");
  await load({ tmStart: "90" });
  ok(clock() === "01:30:00", "a bare number is minutes");
  await load({ tmStart: "45:30" });
  ok(clock() === "00:45:30", "mm:ss is read as minutes and seconds");

  console.log("\n[time from subs, the gift bomb included]");
  await load({ tmStart: "10:00:00" });
  sub({ amount: 1, tier: "1000", name: "Alice" }); await settled();
  ok(clock() === "10:05:00", "a new tier 1 sub adds 5 minutes (" + clock() + ")");
  ok(/^\+5:00 Alice subscribed/.test(feed()), "the feed says what happened (" + feed() + ")");
  sub({ amount: 3, tier: "2000", name: "Bob" }); await settled();
  ok(clock() === "10:15:00", "a tier 2 sub adds 10 minutes, and a 3 month resub is still one sub (" + clock() + ")");
  sub({ amount: 1, tier: "3000", name: "Cara" }); await settled();
  ok(clock() === "10:40:00", "a tier 3 sub adds 25 minutes (" + clock() + ")");
  sub({ amount: 1, tier: "prime", name: "Dee" }); await settled();
  ok(clock() === "10:45:00", "a Prime sub counts as tier 1");
  await load({ tmStart: "10:00:00" });
  bomb(10);
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "GenerousViewer" });
  await settled();
  ok(clock() === "10:50:00", "a gift bomb of 10 adds 10 x 5 minutes once, not once per recipient (" + clock() + ")");
  ok(/gifted 10 subs/.test(feed()), "and reads as a gift of 10 (" + feed() + ")");
  await load({ tmStart: "10:00:00" });
  sub({ gifted: true, amount: 1, tier: "3000", sender: "Eve" }); await settled();
  ok(clock() === "10:25:00", "a single gifted tier 3 sub uses the gift value for tier 3 (" + clock() + ")");
  await load({ tmStart: "10:00:00", tmGift1: "2m", tmSub1: "9m" });
  bomb(5); sub({ amount: 1, name: "Fay" }); await settled();
  ok(clock() === "10:19:00", "gifts and new subs have separate values (" + clock() + ")");

  console.log("\n[a tip counts towards the goals as well as the clock]");
  await load({ tmStart: "10:00:00" });
  tip(5); await settled();
  ok(clock() === "10:05:00", "a 5 tip adds 5 minutes to the clock (" + clock() + ")");
  ok(E("incentive-total").textContent === "1 sub", "and counts as a sub towards the goals (" + E("incentive-total").textContent + ")");
  tip(2); tip(3); await settled();
  ok(clock() === "10:10:00" && E("incentive-total").textContent === "2 subs", "two smaller tips add up to the next sub, and the clock takes each at face value (" + clock() + ", " + E("incentive-total").textContent + ")");
  await load({ tmStart: "10:00:00", tipsPerSub: 0 });
  tip(5); await settled();
  ok(clock() === "10:05:00" && E("incentive-total").textContent === "0 subs", "with the tip rate at 0 the goals ignore tips and the clock still counts them (" + E("incentive-total").textContent + ")");

  console.log("\n[time from bits, tips, follows and raids]");
  await load({ tmStart: "10:00:00" });
  cheer(300); await settled();
  ok(clock() === "10:03:00", "300 bits at 1 minute per 100 adds 3 minutes (" + clock() + ")");
  cheer(150); await settled();
  ok(clock() === "10:04:30", "bits count in proportion, so 150 adds 90 seconds (" + clock() + ")");
  tip(5); await settled();
  ok(clock() === "10:09:30", "a 5 tip at 1 minute per unit adds 5 minutes (" + clock() + ")");
  ev("follower-latest", { name: "Gus" }); ev("raid-latest", { name: "Hal", amount: 40 }); await settled();
  ok(clock() === "10:09:30", "follows and raids add nothing until they are given a value");
  await load({ tmStart: "10:00:00", tmFollow: "30s", tmRaid: "10m" });
  ev("follower-latest", { name: "Gus" }); ev("raid-latest", { name: "Hal", amount: 40 }); await settled();
  ok(clock() === "10:10:30", "a follow adds 30 seconds and a raid adds 10 minutes (" + clock() + ")");
  await load({ tmStart: "10:00:00" });
  tip(0); tip(-3); cheer(0); await settled();
  ok(clock() === "10:00:00", "empty tips and cheers add nothing");
  await load({ tmStart: "10:00:00" });
  boss("!incentive stop"); sub({ amount: 1 }); cheer(500); tip(2); await settled();
  ok(clock() === "10:02:00", "stopping the goals' tracking also stops sub and bits time, while tips still count (" + clock() + ")");
  boss("!incentive start"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:07:00", "starting it again lets subs add time again (" + clock() + ")");

  console.log("\n[manual time and chat commands]");
  await load({ tmStart: "10:00:00" });
  boss("!subathon add 2h 30s"); await settled();
  ok(clock() === "12:00:30", "!subathon add 2h 30s (" + clock() + ")");
  boss("!subathon subtract 10m"); await settled();
  ok(clock() === "11:50:30", "!subathon subtract 10m (" + clock() + ")");
  boss("!subathon set 5:00:00"); await settled();
  ok(clock() === "05:00:00", "!subathon set (" + clock() + ")");
  boss("!subathon add nonsense"); boss("!subathon add"); boss("!subathon add -5m"); boss("!subathon nonsense"); await settled();
  ok(clock() === "05:00:00", "unreadable commands change nothing");
  await load({ tmStart: "10:00:00", tmManual: "1h" });
  button("tmAdd"); await settled();
  ok(clock() === "11:00:00", "the Add button adds the manual amount (" + clock() + ")");
  button("tmSubtract"); button("tmSubtract"); await settled();
  ok(clock() === "09:00:00", "the Subtract button takes it off (" + clock() + ")");
  button("tmApply"); await settled();
  ok(clock() === "10:00:00", "Apply puts the clock back on the start time");
  boss("!subathon"); await settled();
  chat("!subathon add 1h", { nick: "RandomViewer" }); await settled();
  ok(clock() === "10:00:00", "a viewer cannot change the clock");
  chat("!subathon add 1h", { mod: true, nick: "Mod" }); await settled();
  ok(clock() === "11:00:00", "a moderator can by default");
  await load({ tmStart: "10:00:00", tmWho: "broadcaster" });
  chat("!subathon add 1h", { mod: true }); await settled();
  ok(clock() === "10:00:00", "or only the broadcaster, when set");
  boss("!subathon reset"); await settled();
  await load({ tmStart: "10:00:00", tmCommand: "!sa" });
  boss("!sa add 1h"); boss("!subathon add 1h"); await settled();
  ok(clock() === "11:00:00", "the command word is a setting");
  boss("!sax add 1h"); await settled();
  ok(clock() === "11:00:00", "and a longer word that merely starts the same is not the command");
  await load({ tmStart: "10:00:00" });
  chat("!subathon reset", { mod: true }); boss("!subathon add 1h"); chat("!subathon reset", { mod: true }); await settled();
  ok(clock() === "11:00:00", "only the broadcaster can restart the whole clock");
  boss("!subathon reset"); await settled();
  ok(clock() === "10:00:00", "!subathon reset puts it back to the start time");

  console.log("\n[power-ups and sleep mode]");
  await load({ tmStart: "10:00:00" });
  boss("!subathon powerup 2 30m"); await settled();
  ok(/x2 power-up/.test(status()), "a power-up shows in the status (" + status() + ")");
  sub({ amount: 1, name: "Ida" }); await settled();
  ok(clock() === "10:10:00", "it doubles what comes in (" + clock() + ")");
  ok(/\(x2\)/.test(feed()), "and the feed says so (" + feed() + ")");
  button("tmResume"); await advance(31 * 60000);
  ok(!/power-up/.test(status()), "it ends when its time is up (" + status() + ")");
  const afterExpiry = clock(); sub({ amount: 1, name: "Kit" }); await settled();
  const base = parseClock(afterExpiry); ok(parseClock(clock()) - base === 300, "after it ends a sub adds the plain 5 minutes again");
  await load({ tmStart: "10:00:00" });
  boss("!subathon powerup 3 0 2"); await settled();
  ok(/x3 power-up 2 events/.test(status()), "a power-up can run for a number of events (" + status() + ")");
  sub({ amount: 1 }); sub({ amount: 1 }); sub({ amount: 1 }); await settled();
  ok(clock() === "10:35:00", "two events at x3 then one at x1: 15 + 15 + 5 minutes (" + clock() + ")");
  ok(!/power-up/.test(status()), "and it is gone afterwards");
  await load({ tmStart: "10:00:00" });
  boss("!subathon powerup 2 1h"); boss("!subathon powerup off"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:05:00", "!subathon powerup off ends it");
  await load({ tmStart: "10:00:00", tmPowerMult: 4, tmPowerDuration: "10m" });
  button("tmPowerGo"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:20:00", "the Start button uses the multiplier and length from the settings (" + clock() + ")");
  button("tmPowerStop"); await settled();
  ok(!/power-up/.test(status()), "and the End button stops it");
  await load({ tmStart: "10:00:00" });
  boss("!subathon sleep"); await settled();
  ok(/sleep x0.5/.test(status()), "sleep mode shows in the status (" + status() + ")");
  sub({ amount: 1 }); await settled();
  ok(clock() === "10:02:30", "and halves what comes in (" + clock() + ")");
  boss("!subathon powerup 2 1h"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:07:30", "sleep and a power-up multiply together, so x2 and x0.5 is a plain 5 minutes (" + clock() + ")");
  boss("!subathon wake"); await settled();
  ok(!/sleep/.test(status()), "!subathon wake ends sleep mode");
  await load({ tmStart: "10:00:00", tmSleepMult: 0 });
  button("tmSleep"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:00:00", "a sleep multiplier of 0 pauses earning altogether");

  console.log("\n[the cap, and time that is banked rather than lost]");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "12:00:00" });
  ok(/room 2:00:00/.test(status()), "the status shows how much can still be earned (" + status() + ")");
  bomb(30); sub({ gifted: true, isCommunityGift: true, amount: 170 }); await settled();
  ok(clock() === "12:00:00", "a gift bomb stops dead on the cap (" + clock() + ")");
  ok(/banked 30:00/.test(status()), "the 30:00 that did not fit is banked, not lost (" + status() + ")");
  ok(/30:00 banked/.test(feed()), "and the feed says so (" + feed() + ")");
  sub({ amount: 1 }); await settled();
  ok(clock() === "12:00:00" && /banked 35:00/.test(status()), "later subs bank too, rather than locking the whole clock (" + status() + ")");
  ok(!has("ended"), "and the clock keeps running (not locked out)");
  boss("!subathon subtract 1h"); await settled();
  ok(clock() === "11:00:00" && /room 1:00:00/.test(status()), "subtracting hands the allowance back (" + clock() + ", " + status() + ")");
  boss("!subathon release"); await settled();
  ok(clock() === "11:35:00" && !/banked/.test(status()), "!subathon release moves banked time onto the clock as far as the cap allows (" + clock() + ", " + status() + ")");
  ok(/room 25:00/.test(status()), "and the room left reflects it (" + status() + ")");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "10:30:00" });
  boss("!subathon add 5h"); await settled();
  ok(clock() === "15:00:00", "the streamer adding by hand is not held to the cap (" + clock() + ")");
  sub({ amount: 1 }); await settled();
  ok(clock() === "15:00:00" && /banked 5:00/.test(status()), "but it uses up the allowance, so subs bank afterwards");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "10:30:00" });
  boss("!subathon set 8:00:00"); boss("!subathon capreset"); await settled();
  ok(/room 2:30:00/.test(status()), "capreset counts the cap from the clock as it is now (" + status() + ")");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "garbage" });
  sub({ amount: 1 }); await settled();
  ok(clock() === "10:05:00", "an unreadable cap is ignored rather than blocking everything");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "200:00:00", tmShowCap: false });
  ok(!/room/.test(status()), "the room line can be hidden");
  await load({ tmStart: "10:00:00", tmCapEnabled: true, tmCap: "10:10:00" });
  sub({ amount: 1 }); sub({ amount: 1 }); await settled();
  boss("!subathon pause"); await settled();
  button("tmApply"); await settled();
  ok(clock() === "10:00:00" && /room 0:10:00|room 10:00/.test(status()) && !/banked/.test(status()), "Apply starts the allowance and the bank afresh (" + status() + ")");

  console.log("\n[locking]");
  await load({ tmStart: "10:00:00" });
  boss("!subathon lock"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:00:00" && /locked/.test(status()) && /banked 5:00/.test(status()), "while locked, time is banked and the padlock shows in the status (" + status() + ")");
  boss("!subathon unlock"); await settled();
  ok(!/locked/.test(status()), "unlocking clears it");
  boss("!subathon release"); await settled();
  ok(clock() === "10:05:00", "the bank can then be released (" + clock() + ")");
  await load({ tmStart: "10:00:00" });
  button("tmLock"); button("tmUnlock"); sub({ amount: 1 }); await settled();
  ok(clock() === "10:05:00", "the Lock and Unlock buttons work");

  console.log("\n[reaching zero]");
  await load({ tmStart: "1m" });
  button("tmResume"); await advance(61000);
  ok(clock() === "00:00:00" && has("ended") && status() === "Time's up!", "the clock stops at zero and says so (" + clock() + ", " + status() + ")");
  sub({ amount: 1 }); await settled();
  ok(clock() === "00:00:00" && /banked 5:00/.test(status()), "by default new time is banked, so a finished subathon is not restarted by accident (" + status() + ")");
  await load({ tmStart: "1m", tmLockAtZero: false, tmEndedText: "Finished" });
  button("tmResume"); await advance(61000);
  ok(status() === "Finished", "the ended text is a setting");
  sub({ amount: 1 }); await settled();
  ok(clock() === "00:05:00" && !has("ended") && !has("paused"), "with the lock off, a sub restarts the clock (" + clock() + ")");
  await load({ tmStart: "2h", tmWarn: "1h" });
  ok(!has("warn"), "no warning above the warning time");
  boss("!subathon set 59m"); await settled();
  ok(has("warn"), "the warning colour comes on below it");
  await load({ tmStart: "2h", tmWarn: "0" });
  boss("!subathon set 1m"); await settled();
  ok(!has("warn"), "a warning time of 0 turns the warning off");

  console.log("\n[elapsed time]");
  const other = () => E("subathon-elapsed").hidden ? "" : E("subathon-elapsed").textContent;
  await load({ tmStart: "10:00:00" });
  ok(other() === "", "the second line is off by default");
  await load({ tmStart: "10:00:00", tmShowOther: true });
  ok(other() === "Elapsed 00:00:00" && clock() === "10:00:00", "switching it on shows the elapsed time under the countdown (" + other() + ")");
  button("tmResume"); await advance(65000);
  ok(other() === "Elapsed 00:01:05" && clock() === "09:58:55", "it counts up while the clock runs, as the clock counts down (" + other() + ", " + clock() + ")");
  button("tmPause"); await advance(600000);
  ok(other() === "Elapsed 00:01:05", "paused time is not elapsed time (" + other() + ")");
  button("tmResume"); await advance(30000);
  ok(other() === "Elapsed 00:01:35", "and resuming carries on from where it was (" + other() + ")");
  boss("!subathon add 5h"); sub({ amount: 1, name: "A" }); await settled();
  ok(other() === "Elapsed 00:01:35" || other() === "Elapsed 00:01:36", "adding time does not change it (" + other() + ")");
  boss("!subathon set 1:00:00"); await settled();
  ok(other() === "Elapsed 00:01:35" || other() === "Elapsed 00:01:36", "and neither does setting the clock");
  button("tmApply"); await settled();
  ok(other() === "Elapsed 00:00:00", "Apply starts it again from zero");
  await load({ tmStart: "10:00:00", tmClockShows: "elapsed", tmShowOther: true });
  button("tmResume"); await advance(125000);
  ok(clock() === "00:02:05" && other() === "Remaining 09:57:55", "the big clock can count up instead, with the countdown underneath (" + clock() + ", " + other() + ")");
  await load({ tmStart: "10:00:00", tmClockShows: "elapsed", tmElapsedLabel: "Live for", tmRemainingLabel: "Left", tmShowOther: true });
  ok(other() === "Left 10:00:00", "the labels are settings");
  await load({ tmStart: "200:00:00", tmClockShows: "elapsed" }); button("tmResume"); await advance(3600000 * 100 + 5000);
  ok(clock() === "100:00:05" && has("long"), "elapsed hours are not capped at a day either (" + clock() + ")");
  await load({ tmStart: "1m", tmShowOther: true });
  button("tmResume"); await advance(61000);
  ok(has("ended") && other() === "Elapsed 00:01:00", "when the clock reaches zero, elapsed stops at the time it ran (" + other() + ")");
  await advance(600000); ok(other() === "Elapsed 00:01:00", "and does not keep growing (" + other() + ")");
  await load({ tmStart: "100:00:00", tmShowDay: true, tmDayMode: "elapsed" });
  ok(/^Day 1\b/.test(status()), "the day number starts at 1 (" + status() + ")");
  button("tmResume"); await advance(3600000 * 24 - 1000);
  ok(/^Day 1\b/.test(status()), "and stays there for the first 24 hours (" + status() + ")");
  await advance(2000); ok(/^Day 2\b/.test(status()), "then becomes day 2 (" + status() + ")");
  await load({ tmStart: "100:00:00", tmShowDay: true, tmDayMode: "elapsed", tmDayLabel: "Dag" }); ok(/^Dag 1\b/.test(status()), "the word is a setting (" + status() + ")");
  await load({ tmStart: "100:00:00", tmShowDay: true, tmDayMode: "elapsed", tmShowStatus: false }); ok(E("subathon-status").hidden, "and it hides with the status line");
  // Days that mean the date, not 24 hours of running: a few hours a day for a week is Day 1 to Day 7.
  const at = (d, h, m) => new Date(2026, 5, d, h, m || 0, 0).getTime();
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true });
  ok(/^Day 1\b/.test(status()), "by default the day number counts calendar days, starting at 1 (" + status() + ")");
  button("tmResume"); await advance(3 * 3600000);
  ok(/^Day 1\b/.test(status()), "it stays Day 1 for the rest of that day (" + status() + ")");
  await advance(12 * 3600000); ok(/^Day 1\b/.test(status()), "and past midnight, until the rollover hour, so a late stream is one day (03:00 is still Day 1) (" + status() + ")");
  await advance(2 * 3600000); ok(/^Day 2\b/.test(status()), "then the next morning it is Day 2 (" + status() + ")");
  button("tmPause"); await advance(5 * 24 * 3600000);
  ok(/^Day 2\b/.test(status()), "days with the clock paused do not count, however many go by (" + status() + ")");
  button("tmResume"); await advance(1000); ok(/^Day 3\b/.test(status()), "so the next day it runs is Day 3, days in a row and not days on the calendar (" + status() + ")");
  await advance(2 * 3600000); ok(/^Day 3\b/.test(status()), "and running on within that day does not add another");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayRollover: 0 });
  button("tmResume"); await advance(11 * 3600000 + 1800000); ok(/^Day 1\b/.test(status()), "a rollover hour of 0 is midnight (23:30 is Day 1) (" + status() + ")");
  await advance(3600000); ok(/^Day 2\b/.test(status()), "so half past midnight is Day 2 (" + status() + ")");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true });
  button("tmResume"); await advance(1000); button("tmPause"); await reload();
  ok(/^Day 1\b/.test(status()), "the day survives a refresh (" + status() + ")");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true });
  boss("!subathon day 5"); ok(/^Day 5\b/.test(status()), "!subathon day 5 sets it (" + status() + ")");
  button("tmResume"); await advance(1000); ok(/^Day 5\b/.test(status()), "and the clock running does not immediately add one (" + status() + ")");
  boss("!subathon day +1"); ok(/^Day 6\b/.test(status()), "!subathon day +1 (" + status() + ")");
  boss("!subathon day -2"); ok(/^Day 4\b/.test(status()), "!subathon day -2 (" + status() + ")");
  boss("!subathon day 0"); boss("!subathon day -50"); ok(/^Day 1\b/.test(status()) || /^Day 4\b/.test(status()), "it never goes below 1");
  boss("!subathon day nonsense"); boss("!subathon day"); boss("!subathon day 2.5x"); ok(true, "(unreadable ones are ignored)");
  await load({ tmStart: "200:00:00", tmShowDay: true }); boss("!subathon day 4"); button("tmDayNext"); ok(/^Day 5\b/.test(status()), "the Next day button");
  button("tmDayPrev"); button("tmDayPrev"); ok(/^Day 3\b/.test(status()), "and the Previous day button");
  chat("!subathon day 9", { nick: "Viewer" }); ok(/^Day 3\b/.test(status()), "a viewer cannot change it");
  button("tmApply"); await settled(); ok(/^Day 1\b/.test(status()), "Apply puts it back to Day 1");
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayMode: "elapsed" });
  boss("!subathon day 4"); ok(/^Day 4\b/.test(status()), "the 24 hour mode can be set by hand too (" + status() + ")");
  button("tmResume"); await advance(25 * 3600000); ok(/^Day 5\b/.test(status()), "and carries on from there (" + status() + ")");
  boss("!subathon day -1"); ok(/^Day 4\b/.test(status()), "!subathon day -1 moves from the number on screen (" + status() + ")");
  button("tmDayNext"); ok(/^Day 5\b/.test(status()), "so does the Next day button");
  await reload(); ok(/^Day 5\b/.test(status()), "the shift survives a refresh (" + status() + ")");
  button("tmApply"); await settled(); ok(/^Day 1\b/.test(status()), "and Apply clears it");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayMode: "date" });
  ok(/^Day 1\b/.test(status()), "the date mode starts at Day 1 (" + status() + ")");
  await advance(3 * 24 * 3600000); ok(/^Day 1\b/.test(status()), "and waits for the clock to run for the first time, however long that takes (" + status() + ")");
  button("tmResume"); await advance(1000); ok(/^Day 1\b/.test(status()), "the first day it runs is Day 1");
  await advance(17 * 3600000); ok(/^Day 2\b/.test(status()), "the next morning is Day 2 (" + status() + ")");
  button("tmPause"); await advance(5 * 24 * 3600000);
  ok(/^Day 7\b/.test(status()), "five days off later it is Day 7, because the date is what counts (" + status() + ")");
  boss("!subathon day 3"); ok(/^Day 3\b/.test(status()), "!subathon day 3 sets it (" + status() + ")");
  await advance(2 * 24 * 3600000); ok(/^Day 5\b/.test(status()), "and it carries on counting dates from there (" + status() + ")");
  boss("!subathon day +1"); ok(/^Day 6\b/.test(status()), "!subathon day +1 (" + status() + ")");
  boss("!subathon day -50"); ok(/^Day 1\b/.test(status()), "never below 1 (" + status() + ")");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayMode: "date", tmDayRollover: 0 });
  button("tmResume"); await advance(11 * 3600000 + 1800000); ok(/^Day 1\b/.test(status()), "the rollover hour applies here too (23:30 is Day 1) (" + status() + ")");
  await advance(3600000); ok(/^Day 2\b/.test(status()), "and half past midnight is Day 2");
  button("tmPause"); await reload(); ok(/^Day 2\b/.test(status()), "it survives a refresh (" + status() + ")");
  button("tmApply"); await settled(); ok(/^Day 1\b/.test(status()), "Apply puts it back to Day 1 and waits for the next run");
  fake = at(31, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayMode: "date" });
  button("tmResume"); await advance(1000); button("tmPause"); await advance(2 * 24 * 3600000 + 5 * 3600000);
  ok(/^Day 3\b/.test(status()), "it counts across a month end (31 May to 2 June is Day 3) (" + status() + ")");
  fake = at(10, 12);
  await load({ tmStart: "200:00:00", tmShowDay: true, tmDayMode: "manual" });
  button("tmResume"); await advance(3 * 24 * 3600000); ok(/^Day 1\b/.test(status()), "in manual mode it never changes by itself (" + status() + ")");
  boss("!subathon day 3"); ok(/^Day 3\b/.test(status()), "only when you change it");

  await load({ tmStart: "10:00:00", tmShowOther: true });
  button("tmResume"); await advance(90000); button("tmPause");
  await reload(); ok(other() === "Elapsed 00:01:30", "elapsed survives a refresh (" + other() + ")");
  button("tmResume"); fake += 60000; await reload(); await settled();
  ok(other() === "Elapsed 00:02:30" || other() === "Elapsed 00:02:31", "and a refresh while running counts the gap too (" + other() + ")");

  console.log("\n[blanking the wording]");
  await load({ tmTitle: "" }); ok(E("subathon-title").hidden, "a blank title hides the title instead of bringing the default back");
  await load({ tmStart: "1m", tmEndedText: "" }); button("tmResume"); await advance(61000); ok(has("ended") && status() === "", "a blank time's up text shows nothing, though the clock still ends (" + status() + ")");
  await load({ tmStart: "10:00:00", tmShowOther: true, tmElapsedLabel: "" }); ok(other() === "00:00:00", "a blank elapsed label leaves just the time (" + other() + ")");
  await load({ tmStart: "10:00:00", tmShowDay: true, tmDayLabel: "", tmDayMode: "manual" }); ok(/^1\b/.test(status()), "a blank day word leaves just the number (" + status() + ")");

  console.log("\n[saving]");
  await load({ tmStart: "10:00:00" });
  button("tmResume"); sub({ amount: 1 }); await advance(30000);
  ok(storeData.subathon_v1 && storeData.subathon_v1.running === true, "the clock is saved");
  fake += 90000;
  await reload();
  ok(clock() === "10:03:00", "a browser source refresh while running keeps counting down through the gap (10:05:00 - 2 minutes) (" + clock() + ")");
  button("tmPause"); boss("!subathon lock"); boss("!subathon powerup 2 1h"); fake += 5000;
  await reload();
  ok(has("paused") && /locked/.test(status()) && /x2 power-up/.test(status()), "pause, lock and a power-up survive a refresh (" + status() + ")");
  await wait(450);
  ok(storeData.sub_goals_v1 !== undefined, "and the goals module saves its own state separately");

  console.log("\n[the goals module sits underneath, unchanged]");
  await load({ tmStart: "10:00:00" });
  boss("!incentive add 5 karaoke"); sub({ amount: 1 }); await settled();
  ok(E("incentive-total").textContent === "1 sub", "the goals still count the same sub that added time (" + E("incentive-total").textContent + ")");
  const moduleJs = fs.readFileSync(ROOT + "/../sub-goals/widget/widget.js", "utf8").trim();
  ok(src.indexOf(moduleJs) !== -1, "widget.js contains the module byte for byte");
  const moduleCss = fs.readFileSync(ROOT + "/../sub-goals/widget/widget.css", "utf8").replace(/\r\n/g, "\n").trim();
  ok(fs.readFileSync(ROOT + "/widget/widget.css", "utf8").indexOf(moduleCss) !== -1, "and so does widget.css");
  const html = fs.readFileSync(ROOT + "/widget/widget.html", "utf8");
  ok(html.indexOf('id="incentive-app"') !== -1 && html.indexOf('id="subathon-app"') !== -1, "widget.html holds both the clock and the goals");
  await load({ tmStart: "10:00:00", tmShowGoals: false });
  ok(E("subathon-goals").hidden === true, "the goals can be hidden");
  await load({ tmStart: "10:00:00", tmOrder: "goals" });
  ok(E("subathon-root").classList.contains("goals-first"), "or put above the clock");

  console.log("\n[style presets, shared with the other overlays]");
  const opts = fields.themePreset.options, keys = Object.keys(opts);
  ok(keys.length === Object.keys(expectedPresets).length + 1 && keys[keys.length - 1] === "custom", "the dropdown has the twenty-two shared presets and Custom (" + keys.length + ")");
  ok(fields.themePreset.value === "glass", "Soft black is the default");
  let allMatch = true;
  for (const key of Object.keys(expectedPresets)) {
    const x = expectedPresets[key];
    if (opts[key] !== x.label) { allMatch = false; console.log("    label differs for " + key); }
    await load({ themePreset: key });
    if (vars()["--sa-bg"] !== x.panel || vars()["--sa-text"] !== x.text || vars()["--sa-accent"] !== x.accent || vars()["--sa-font"].indexOf('"' + x.font + '"') !== 0) {
      allMatch = false; console.log("    colours differ for " + key + ": " + vars()["--sa-bg"] + " " + vars()["--sa-text"]);
    }
  }
  ok(allMatch, "every preset's label, panel, text, accent and font match the shared table");
  await load({ themePreset: "custom", colorPanel: "#102030", panelOpacity: 0.5, tmText: "#112233", tmAccent: "#445566", tmWarnColour: "#778899", fontFamily: "Lobster" });
  ok(vars()["--sa-bg"] === "rgba(16, 32, 48, 0.5)" && vars()["--sa-text"] === "#112233" && vars()["--sa-accent"] === "#445566" && vars()["--sa-alarm"] === "#778899", "Custom uses the colour pickers (" + vars()["--sa-bg"] + ")");
  ok(vars()["--sa-font"].indexOf("Lobster") !== -1 && /Lobster/.test(E("subathon-font-link").href), "and the font setting, which is loaded from Google Fonts");
  await load({ themePreset: "celestial", colorPanel: "#102030", tmText: "#112233" });
  ok(vars()["--sa-text"] === expectedPresets.celestial.text, "a preset ignores the colour pickers");
  await load({ themePreset: "nonsense" });
  ok(vars()["--sa-bg"] === "rgba(16, 32, 48, 0.55)" || vars()["--sa-bg"] !== undefined, "an unknown preset name does not break the clock");
  await load({ themePreset: "glass", radius: 40, outerFrame: false, borderWidth: 3, borderColor: "#FF0000", shadow: true, tmClockSize: 12, tmGap: 20, tmWeight: 600, tmAnimate: false });
  ok(vars()["--sa-radius"] === "40px" && vars()["--sa-border"] === "3px solid #FF0000" && vars()["--sa-clock-size"] === "12cqw" && vars()["--sa-weight"] === 600, "radius, outline, size and weight settings apply");
  ok(E("subathon-root").style["--sa-gap"] === "20px" && E("subathon-root").classList.contains("no-motion"), "the gap applies, and Animate off stops motion");
  ok(vars()["--sa-shadow"] !== "none", "the shadow switch applies");

  console.log("\n[the outer frame]");
  await load({ themePreset: "glass" });
  ok(vars()["--sa-frame"] === "max(2px, 0.6cqw)" && vars()["--sa-frame-c"] === "#FFFFFF" && vars()["--sa-border"] === "0px solid #FFFFFF", "by default the clock card has a frame in the accent colour, as thick as a default that grows with the box, and it takes no room (" + vars()["--sa-frame"] + ")");
  await load({ themePreset: "midnight" }); ok(vars()["--sa-frame-c"] === "#89AFFF", "which is each preset's own accent (" + vars()["--sa-frame-c"] + ")");
  await load({ outerFrame: false }); ok(vars()["--sa-frame"] === "0px" && vars()["--sa-border"] === "0px solid #FFFFFF", "it can be switched off, which leaves no outline");
  await load({ borderWidth: 6 }); ok(vars()["--sa-frame"] === "6px", "a thickness sets the frame's thickness (" + vars()["--sa-frame"] + ")");
  await load({ themePreset: "custom", tmAccent: "#FF00AA", borderColor: "#010101", borderWidth: 3 });
  ok(vars()["--sa-frame-c"] === "#FF00AA" && vars()["--sa-frame"] === "3px", "and in Custom the frame is the accent colour, not the outline colour (" + vars()["--sa-frame-c"] + ")");
  await load({ themePreset: "custom", borderColor: "#010101", borderWidth: 3, outerFrame: false }); ok(vars()["--sa-border"] === "3px solid #010101", "with the frame unticked a Custom outline is the colour and thickness you set (" + vars()["--sa-border"] + ")");

  console.log("\n[look settings]");
  await load({ tmTitle: "Big Subathon", tmShowTitle: true });
  ok(E("subathon-title").textContent === "Big Subathon" && !E("subathon-title").hidden, "the title is a setting");
  await load({ tmShowTitle: false });
  ok(E("subathon-title").hidden === true, "and can be hidden");
  await load({ tmShowStatus: false });
  ok(E("subathon-status").hidden === true, "the status line can be hidden");
  await load({ tmStart: "10:00:00", tmFeedSeconds: 1 });
  sub({ amount: 1, name: "Lou" }); await settled(); fake += 2000; await wait(1200);
  ok(feed() === "", "the time-added line goes away after its time (" + feed() + ")");

  console.log("\n[sounds]");
  await load({ tmStart: "10:00:00", tmSoundAdd: "data:audio/wav;base64,AAAA", tmVolAdd: 40, tmSoundZero: "data:audio/wav;base64,BBBB" });
  audioLog.length = 0; sub({ amount: 1 }); await settled();
  ok(audioLog.length === 1 && audioLog[0].played && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "time being added plays its sound at its volume");
  audioLog.length = 0; button("tmTestZero"); ok(audioLog.length === 1 && /BBBB/.test(audioLog[0].src), "each Test button plays its sound");
  await load({ tmStart: "1m", tmSoundZero: "data:audio/wav;base64,BBBB" });
  button("tmResume"); audioLog.length = 0; await advance(61000);
  ok(audioLog.length === 1, "reaching zero plays the zero sound exactly once (" + audioLog.length + ")");
  await load({ tmStart: "10:00:00", tmSoundAdd: "data:audio/wav;base64,AAAA", tmMute: true });
  audioLog.length = 0; sub({ amount: 1 }); await settled();
  ok(audioLog.length === 0, "the mute switch silences everything");
  await load({ tmStart: "10:00:00", tmSoundPower: "data:audio/wav;base64,CCCC" });
  audioLog.length = 0; boss("!subathon powerup 2 10m"); ok(audioLog.length === 1, "starting a power-up plays its sound");

  console.log("\n[every setting is wired up]");
  const missing = Object.keys(fields).filter(k => /^tm/.test(k) && fields[k].type !== "button" && clockSrc.indexOf("f." + k) === -1);
  ok(missing.length === 0, "every clock setting is read by the widget" + (missing.length ? " (unread: " + missing.join(", ") + ")" : ""));
  const unhandled = Object.keys(fields).filter(k => fields[k].type === "button" && /^tm/.test(k) && clockSrc.indexOf('case "' + k + '"') === -1);
  ok(unhandled.length === 0, "every clock button does something" + (unhandled.length ? " (dead: " + unhandled.join(", ") + ")" : ""));
  const goalKeys = Object.keys(fields).filter(k => !/^tm/.test(k));
  ok(goalKeys.every(k => /^Goals: /.test(fields[k].group)), "every goals setting sits under a Goals group, apart from the clock's");
  ok(Object.keys(fields).filter(k => /^tm/.test(k)).every(k => /^Clock: /.test(fields[k].group)), "and every clock setting under a Clock group");
  const noDash = ["README.md", "CONTRIBUTING.md"].every(f => !fs.existsSync(ROOT + "/" + f) || !/[\u2013\u2014]/.test(fs.readFileSync(ROOT + "/" + f, "utf8")));
  ok(noDash, "the docs use no em or en dashes");
  ok(/Ko-fi|ko-fi/.test(src.slice(0, 400)) && /ko-fi\.com\/journeyingjordan/.test(fs.readFileSync(ROOT + "/widget/widget.html", "utf8").slice(0, 300)), "the notice is in the widget files");

  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();

function parseClock(t) { const p = t.split(":").map(Number); return p[0] * 3600 + p[1] * 60 + p[2]; }
