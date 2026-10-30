/* Headless integration test for widget.js.
   Mocks the slice of DOM/SE the widget needs, then drives it through the real
   onWidgetLoad / onEventReceived events and asserts on the observable DOM.
   Covers sub counting (including the gift-bomb trap), adding, removing and
   clearing goals, chat adjustments, permissions, unlocking, the visible cap,
   ordering, persistence and theming. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));

let mockBoxH = 0, mockPanelH = 0;          // what the fake layout reports for the box and the panel
let mockScroll = 600, mockClient = 450;   // what the fake layout reports for a name
function makeEl(id) {
  const e = {
    get scrollWidth() { return mockScroll; }, get clientWidth() { return mockClient; },
    get offsetHeight() { return id === "incentive-panel" ? mockPanelH : 0; },
    get clientHeight() { return id === "incentive-app" ? mockBoxH : 0; },
    id, tagName: "div", className: "", textContent: "", hidden: false, offsetWidth: 0,
    parentNode: null, children: [],
    style: { setProperty(k, v) { this[k] = v; } },
    _cls: new Set(),
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }
    },
    addEventListener() {},
    appendChild(c) { this.insertBefore(c, null); return c; },
    insertBefore(c, ref) {
      if (c.parentNode) c.parentNode.removeChild(c);
      const at = ref ? this.children.indexOf(ref) : -1;
      if (at === -1) this.children.push(c); else this.children.splice(at, 0, c);
      c.parentNode = this; return c;
    },
    removeChild(c) {
      const at = this.children.indexOf(c);
      if (at !== -1) this.children.splice(at, 1);
      c.parentNode = null; return c;
    }
  };
  e.classList._s = e._cls; return e;
}
const ids = ["incentive-app", "incentive-panel", "incentive-header", "incentive-title",
  "incentive-total", "incentive-paused", "incentive-header-right", "incentive-list", "incentive-font-link", "incentive-bits",
  "incentive-bits-gain", "incentive-bits-status", "incentive-bits-fill",
  "incentive-thanks", "incentive-thanks-text", "incentive-thanks-track", "incentive-thanks-fill"];
const elements = {}; ids.forEach(id => elements[id] = makeEl(id));
const document = {
  getElementById: id => elements[id] || null,
  createElement: tag => { const e = makeEl("x"); e.tagName = tag; return e; },
  head: makeEl("head"), body: makeEl("body")
};

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
  constructor(src) { this.src = src; this.volume = 1; audioLog.push(this); }
  play() { this.played = true; return Promise.resolve(); }
}
const sandbox = {
  window, document, CustomEvent, SE_API, Audio,
  setTimeout, clearTimeout, setInterval, clearInterval, Date, console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String, Array, Object
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

const KEY = "sub_goals_v1";
function fieldData(ov) {
  const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
  return Object.assign(fd, ov || {});
}
let lastFD = {};
function load(ov) {
  delete storeData[KEY];
  lastFD = fieldData(ov);
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
}
function reload() { window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } })); }
function chat(text, o) {
  o = o || {}; const badges = [];
  if (o.broadcaster) badges.push({ type: "broadcaster" });
  if (o.mod) badges.push({ type: "moderator" });
  const data = { text, nick: (o.nick || "viewer").toLowerCase(), displayName: o.nick || "Viewer",
    badges, tags: { mod: o.mod ? "1" : "0" } };
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}
const boss = text => chat(text, { broadcaster: true });
function button(field) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } })); }
function sub(event) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "subscriber-latest", event } })); }
const tip = n => window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "tip-latest", event: { amount: n, name: "Tipper", currency: "USD" } } }));
const cheer = n => window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "cheer-latest", event: { amount: n, name: "Cheerer" } } }));
const bomb = n => sub({ gifted: true, bulkGifted: true, amount: n, sender: "GenerousViewer" });
const wait = ms => new Promise(r => setTimeout(r, ms));

// Reads the rendered rows back out of the mock DOM: name, "n/target" text, bar
// width, and whether the row is celebrating or on its way out.
function find(node, cls) {
  if (node.className === cls) return node;
  for (const c of node.children) { const f = find(c, cls); if (f) return f; }
  return null;
}
function rendered() {
  return elements["incentive-list"].children.map(li => ({
    name: find(li, "incentive-name").textContent,
    count: find(li, "incentive-count").textContent,
    width: find(li, "incentive-fill").style.width,
    unlocked: li.classList.contains("unlocked"),
    condensed: li.classList.contains("condensed"),
    done: li.classList.contains("done"),
    struck: li.classList.contains("done"),
    leaving: li.classList.contains("leaving")
  }));
}
const live = () => rendered().filter(r => !r.leaving);
const names = () => live().map(r => r.name).join("|");
// The count, plus the paused note when there is one, so a check reads the way it looks.
const total = () => elements["incentive-total"].textContent +
  (elements["incentive-paused"].hidden ? "" : " " + elements["incentive-paused"].textContent);
const countOnly = () => elements["incentive-total"].textContent;
const panelHidden = () => elements["incentive-panel"].hidden;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  // A. sub counting
  console.log("\n[sub counting]");
  load(); await wait(5);
  ok(total() === "0 subs", "starts at zero (" + total() + ")");
  sub({ amount: 1, tier: "1000", name: "NewViewer" });
  ok(total() === "1 sub", "a new sub counts as one, singular (" + total() + ")");
  sub({ amount: 6, tier: "1000", name: "LoyalViewer" });
  ok(total() === "2 subs", "a 6 month resub is one sub, not six (" + total() + ")");
  sub({ gifted: true, amount: 3, sender: "GenerousViewer", name: "Target" });
  ok(total() === "3 subs", "a lone targeted gift is one sub (" + total() + ")");
  bomb(5);
  ok(total() === "8 subs", "a bomb of 5 adds 5 (" + total() + ")");

  console.log("\n[no double counting on a bomb]");
  load(); await wait(5);
  bomb(10);
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "GenerousViewer", name: "r" + i });
  sub({ gifted: true, playedAsCommunityGift: true, amount: 170, sender: "GenerousViewer" });
  ok(total() === "10 subs", "only the bomb counted, follow-ups ignored (" + total() + ")");

  console.log("\n[bits]");
  load(); await wait(5);
  cheer(500);
  ok(total() === "1 sub", "500 bits is one sub (" + total() + ")");
  cheer(1000);
  ok(total() === "3 subs", "1000 bits is two more (" + total() + ")");
  cheer(100);
  ok(total() === "3 subs", "100 bits alone is not enough for a sub (" + total() + ")");
  cheer(400);
  ok(total() === "4 subs", "but it is remembered, so 100 + 400 makes one (" + total() + ")");
  cheer(1250);
  ok(total() === "6 subs", "1250 bits is two subs, 250 left over (" + total() + ")");
  cheer(250);
  ok(total() === "7 subs", "and the 250 left over joins the next 250 (" + total() + ")");
  cheer(0); cheer(-50); sub({ gifted: true, isCommunityGift: true, amount: 500 });
  ok(total() === "7 subs", "empty or odd cheers change nothing (" + total() + ")");
  load({ bitsPerSub: 100 }); await wait(5);
  cheer(300);
  ok(total() === "3 subs", "the rate is configurable (" + total() + ")");
  load({ bitsPerSub: 0 }); await wait(5);
  cheer(5000);
  ok(total() === "0 subs", "a rate of 0 switches bits off (" + total() + ")");
  load(); await wait(5);
  cheer(300); await wait(350);
  reload(); await wait(10);
  cheer(200);
  ok(total() === "1 sub", "leftover bits survive a refresh (" + total() + ")");
  cheer(300); boss("!incentive reset"); cheer(200);
  ok(total() === "0 subs", "reset forgets leftover bits (" + total() + ")");
  load({ unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 2 karaoke"); cheer(1000);
  ok(live()[0].unlocked === true, "bits can unlock a goal");

  console.log("\n[tips]");
  load(); await wait(5);
  tip(5);
  ok(total() === "1 sub", "a 5 tip is one sub (" + total() + ")");
  tip(12.5);
  ok(total() === "3 subs", "12.50 is two more, with 2.50 left over (" + total() + ")");
  tip(2.5);
  ok(total() === "4 subs", "and the 2.50 left over joins the next 2.50 (" + total() + ")");
  tip(3); tip(3);
  ok(total() === "5 subs", "two 3 tips make one sub between them (" + total() + ")");
  tip(0.1); tip(0.2); tip(4.7);
  ok(total() === "6 subs", "small amounts add up exactly, with no rounding drift (" + total() + ")");
  tip(0); tip(-5); tip("lots");
  ok(total() === "6 subs", "empty or odd tips change nothing (" + total() + ")");
  load({ tipsPerSub: 2 }); await wait(5);
  tip(6);
  ok(total() === "3 subs", "the rate is configurable (" + total() + ")");
  load({ tipsPerSub: 0 }); await wait(5);
  tip(500);
  ok(total() === "0 subs", "a rate of 0 switches tips off (" + total() + ")");
  load(); await wait(5);
  tip(3); await wait(350);
  reload(); await wait(10);
  tip(2);
  ok(total() === "1 sub", "a leftover tip survives a refresh (" + total() + ")");
  tip(3); boss("!incentive reset"); tip(2);
  ok(total() === "0 subs", "reset forgets a leftover tip (" + total() + ")");
  load(); await wait(5);
  boss("!incentive tip 10");
  ok(total() === "2 subs", "!incentive tip adds one from somewhere else (" + total() + ")");
  boss("!incentive tip $2.50"); boss("!incentive tip 2.5");
  ok(total() === "3 subs", "with or without a currency sign, and with cents (" + total() + ")");
  boss("!incentive tip lots"); chat("!incentive tip 50", { nick: "viewer" });
  ok(total() === "3 subs", "unreadable, or from a viewer, changes nothing (" + total() + ")");
  load(); await wait(5);
  boss("!incentive stop"); tip(50);
  ok(/^0 subs/.test(total()), "tips are ignored while tracking is stopped (" + total() + ")");
  load({ unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 2 karaoke"); tip(10);
  ok(live()[0].unlocked === true, "tips can unlock a goal");
  load({ bitsPerSub: 500, tipsPerSub: 5 }); await wait(5);
  cheer(300); tip(3);
  cheer(200); tip(2);
  ok(total() === "2 subs", "bits and tips keep separate leftovers (" + total() + ")");
  load({ tipSymbol: "\u00a3", tipsPerSub: 5, bitsCalcSeconds: 0.3 }); await wait(5);
  tip(3);
  ok(elements["incentive-bits"].hidden === false && elements["incentive-bits-gain"].textContent === "+\u00a33", "a tip shows its amount in the strip (" + elements["incentive-bits-gain"].textContent + ")");
  await wait(600);
  ok(elements["incentive-bits-status"].textContent === "\u00a33/\u00a35", "and fills towards the next sub (" + elements["incentive-bits-status"].textContent + ")");

  console.log("\n[bits animation]");
  const B = id => elements["incentive-bits-" + id] || elements["incentive-bits"];
  const statusN = () => parseInt(B("status").textContent, 10);
  // A short calculation time keeps the test quick; the beats are the same shape as
  // the real ones, which scale with it. Lead-in 300ms, then the bar fills over 300ms.
  load({ bitsCalcSeconds: 0.3, bitsStripSeconds: 0.5 }); await wait(5);
  ok(elements["incentive-bits"].hidden === true, "the strip is out of sight until bits arrive");
  cheer(300); await wait(100);
  ok(elements["incentive-bits"].hidden === false && B("gain").textContent === "+300 bits", "a cheer shows its +bits chip straight away (" + B("gain").textContent + ")");
  ok(B("status").textContent === "0/500 bits" && B("fill").style.width === "0%", "with the bar waiting at the start for a moment (" + B("status").textContent + ", " + B("fill").style.width + ")");
  await wait(350);
  ok(B("fill").style.width === "60%" && /300ms linear/.test(B("fill").style.transition), "then it fills at an even pace over the calculation time (" + B("fill").style.width + ", " + B("fill").style.transition + ")");
  ok(statusN() > 0 && statusN() < 300, "while the number counts up in step, part way now (" + B("status").textContent + ")");
  await wait(300);
  ok(B("status").textContent === "300/500 bits", "and lands exactly on the total (" + B("status").textContent + ")");

  cheer(200); await wait(100);
  ok(B("gain").textContent === "+200 bits" && B("status").textContent === "300/500 bits", "a second cheer starts from where the bar is (" + B("status").textContent + ")");
  await wait(350);
  ok(B("fill").style.width === "100%" && statusN() > 300 && statusN() < 500, "and fills up to the top, counting 300 to 500 (" + B("status").textContent + ")");
  await wait(250);
  ok(B("status").textContent === "500/500 bits", "reaching it exactly (" + B("status").textContent + ")");
  await wait(250);
  ok(B("status").textContent === "= +1 sub" && elements["incentive-bits"].classList.contains("converted"), "then converts to a sub (" + B("status").textContent + ")");
  await wait(700);
  ok(!elements["incentive-bits"].classList.contains("converted") && B("fill").style.width === "0%", "the flash ends after a hold and the bar drops back (" + B("fill").style.width + ")");
  ok(B("status").textContent === "0/500 bits", "showing nothing left over (" + B("status").textContent + ")");
  await wait(1500);
  ok(elements["incentive-bits"].hidden === true, "and the strip tucks itself away");

  load({ bitsCalcSeconds: 0.3 }); await wait(5);
  cheer(1750); await wait(1200);
  ok(B("status").textContent === "= +3 subs", "plural when several subs are made (" + B("status").textContent + ")");
  await wait(1100);
  ok(B("status").textContent === "250/500 bits" && B("fill").style.width === "50%", "and the leftover counts up afterwards (" + B("status").textContent + ", " + B("fill").style.width + ")");

  load({ showBits: false }); await wait(5);
  cheer(500);
  ok(elements["incentive-bits"].hidden === true && total() === "1 sub", "it can be switched off while bits still count");

  load(); await wait(5);
  cheer(100); await wait(500);
  ok(statusN() < 100, "by default the number is still counting up, well short of its 100 half a second in (" + B("status").textContent + ")");
  ok(/3000ms linear/.test(B("fill").style.transition), "taking three seconds (" + B("fill").style.transition + ")");
  load({ bitsCalcSeconds: 99 }); await wait(5);
  cheer(100); await wait(450);
  ok(/15000ms linear/.test(B("fill").style.transition), "and held to a sensible limit of fifteen (" + B("fill").style.transition + ")");
  load({ bitsCalcSeconds: 0.5 }); await wait(5);
  cheer(100); await wait(450);
  ok(/500ms linear/.test(B("fill").style.transition), "any length in between works (" + B("fill").style.transition + ")");

  console.log("\n[start and stop]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke");
  boss("!incentive stop");
  ok(total() === "0 subs (paused)", "stopping says so on the panel (" + total() + ")");
  sub({ amount: 1 }); bomb(5); cheer(1000); sub({ gifted: true, isCommunityGift: true, amount: 170 });
  ok(total() === "0 subs (paused)" && live()[0].count === "0/5", "subs and bits are ignored while stopped (" + total() + ")");
  ok(elements["incentive-bits"].hidden === true, "and bits show no animation");
  boss("!incentive subs +2");
  ok(total() === "2 subs (paused)", "manual fixes still work while stopped (" + total() + ")");
  boss("!incentive add 8 game");
  ok(live().length === 2, "so does adding goals");
  boss("!incentive start");
  ok(total() === "2 subs", "starting clears the note (" + total() + ")");
  sub({ amount: 1 }); cheer(500);
  ok(total() === "4 subs", "and tracking resumes, with nothing from the stopped time counted (" + total() + ")");
  boss("!incentives stop");
  sub({ amount: 1 });
  ok(total() === "5 subs", "only !incentive is recognised, so !incentives does nothing (" + total() + ")");
  boss("!incentive stop");
  sub({ amount: 1 });
  ok(total() === "5 subs (paused)", "while !incentive stop does (" + total() + ")");
  chat("!incentive start", { nick: "Randomer" });
  ok(total() === "5 subs (paused)", "a viewer cannot start it");
  chat("!incentive start", { mod: true });
  ok(total() === "5 subs", "a mod can");
  boss("!incentive stop"); await wait(350);
  reload(); await wait(10);
  ok(total() === "5 subs (paused)", "stopped survives a browser-source refresh (" + total() + ")");
  sub({ amount: 1 });
  ok(total() === "5 subs (paused)", "and still holds subs off after the refresh");
  button("btnTracking");
  sub({ amount: 1 });
  ok(total() === "6 subs", "the settings button starts it again (" + total() + ")");
  button("btnTracking");
  ok(total() === "6 subs (paused)", "and stops it again");
  load({ startTracking: false }); await wait(5);
  sub({ amount: 1 });
  ok(total() === "0 subs (paused)", "it can be set to start stopped on the first load (" + total() + ")");
  boss("!incentive start"); sub({ amount: 1 }); await wait(350);
  reload(); await wait(10);
  ok(total() === "1 sub", "and a saved started state wins over that setting on later loads (" + total() + ")");
  load({ showTotal: false }); await wait(5);
  ok(elements["incentive-total"].hidden === true, "with the total hidden and tracking on, nothing shows");
  boss("!incentive stop");
  ok(elements["incentive-paused"].hidden === false && elements["incentive-paused"].textContent === "(paused)", "the paused note still appears");
  ok(elements["incentive-total"].hidden === true, "without bringing the hidden count back");
  ok(elements["incentive-header"].hidden === false, "and the heading row stays so the note has somewhere to be");
  boss("!incentive start");
  load({ showTotal: false, title: "" }); await wait(5);
  ok(elements["incentive-header"].hidden === true, "with the title and count both off, there is no heading row");
  boss("!incentive stop");
  ok(elements["incentive-header"].hidden === false && elements["incentive-paused"].hidden === false, "until tracking is stopped, when the note brings it back");

  console.log("\n[paused note beside the count, on the title's line]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke");
  ok(elements["incentive-paused"].hidden === true, "no note while tracking");
  boss("!incentive stop");
  ok(countOnly() === "0 subs", "the count itself stays just the count (" + countOnly() + ")");
  ok(elements["incentive-paused"].hidden === false && elements["incentive-paused"].textContent === "(paused)", "the note is its own small piece, shown beside it");
  ok(total() === "0 subs (paused)", "so the row reads: Sub goals, 0 subs (paused) (" + total() + ")");
  ok(elements["incentive-header"].hidden === false, "all within the one heading row");
  ok(elements["incentive-title"].hidden === false && elements["incentive-title"].textContent === "Sub goals", "and the title is still there");
  load({ pausedText: "on hold", title: "Event goals" }); await wait(5);
  boss("!incentive stop");
  ok(elements["incentive-paused"].textContent === "on hold" && elements["incentive-title"].textContent === "Event goals", "wording is configurable");
  boss("!incentive start");
  ok(elements["incentive-paused"].hidden === true, "and it goes when tracking starts again");

  console.log("\n[manual bits]");
  load({ bitsCalcSeconds: 0.2 }); await wait(5);
  boss("!incentive bits +1000");
  ok(total() === "2 subs", "!incentive bits +1000 is two subs (" + total() + ")");
  boss("!incentive bits 300");
  ok(total() === "2 subs", "a bare number works, and 300 alone is not a sub (" + total() + ")");
  await wait(650);
  ok(elements["incentive-bits"].hidden === false && B("gain").textContent === "+300 bits" && B("status").textContent === "300/500 bits",
    "it plays the bits animation (" + B("gain").textContent + ", " + B("status").textContent + ")");
  boss("!incentive bits +200");
  ok(total() === "3 subs", "leftover carries over, 300 + 200 makes one (" + total() + ")");
  cheer(250); boss("!incentive bits 250");
  ok(total() === "4 subs", "and joins real cheers (" + total() + ")");
  boss("!incentive bits banana"); boss("!incentive bits"); boss("!incentive bits -500"); boss("!incentive bits 0");
  ok(total() === "4 subs", "nonsense, zero and negatives are ignored (" + total() + ")");
  chat("!incentive bits +5000", { nick: "Randomer" });
  ok(total() === "4 subs", "a viewer cannot add bits");
  chat("!incentive bits +500", { mod: true });
  ok(total() === "5 subs", "a mod can");
  boss("!incentive stop");
  cheer(5000);
  ok(total() === "5 subs (paused)", "real cheers are ignored while stopped (" + total() + ")");
  boss("!incentive bits +500");
  ok(total() === "6 subs (paused)", "but manual bits still work while stopped (" + total() + ")");
  load({ bitsPerSub: 0 }); await wait(5);
  boss("!incentive bits +500");
  ok(total() === "0 subs", "and bits stay off when the rate is 0 (" + total() + ")");

  console.log("\n[fixed width, names shrink to fit]");
  load(); await wait(5);
  boss("!incentive add 5 a name too long for its row");
  ok(live().length === 1 && elements["incentive-list"].children[0] && find(elements["incentive-list"].children[0], "incentive-name").style.fontSize === "75%",
    "a name wider than its room shrinks to fit (" + find(elements["incentive-list"].children[0], "incentive-name").style.fontSize + ")");
  const fitVar = () => elements["incentive-header"].style["--heading-fit"];
  ok(fitVar() === "0.75", "so does a long heading, scaled rather than replaced (" + fitVar() + ")");
  ok(!elements["incentive-title"].style.fontSize && !elements["incentive-total"].style.fontSize, "through one shared multiplier, so the title and the sub count stay the same size");
  await wait(350);
  mockScroll = 300; reload(); await wait(10);
  ok(fitVar() === "1", "both go back to full size when the title fits (" + fitVar() + ")");
  mockScroll = 600;
  await wait(350);
  mockScroll = 2000; mockClient = 400; reload(); await wait(10);
  ok(find(elements["incentive-list"].children[0], "incentive-name").style.fontSize === "55%", "but never below 55%, after which it is trimmed (" + find(elements["incentive-list"].children[0], "incentive-name").style.fontSize + ")");
  mockScroll = 600; mockClient = 0; reload(); await wait(10);
  ok(fitVar() === "0.55", "a title with no room at all still shrinks, as far as it is allowed to (" + fitVar() + ")");
  ok(find(elements["incentive-list"].children[0], "incentive-name").style.fontSize === "55%", "and so does a goal name with no room");
  mockScroll = 300; mockClient = 450; reload(); await wait(10);
  ok(find(elements["incentive-list"].children[0], "incentive-name").style.fontSize === "", "a name that fits is left at full size");
  mockScroll = 600; mockClient = 450;

  console.log("\n[customising commands]");
  load({ command: "!goal", verbAdd: "new", verbRemove: "drop", verbClear: "wipe", verbSubs: "count", verbBits: "cheers", verbReset: "fresh", verbStart: "go", verbStop: "halt", verbList: "show" }); await wait(5);
  boss("!goal new 5 karaoke");
  ok(names() === "karaoke", "a renamed add word works (" + names() + ")");
  boss("!goal add 9 old word");
  ok(names() === "karaoke", "and the old word no longer does");
  boss("!goal count +3");
  ok(total() === "3 subs", "renamed subs word (" + total() + ")");
  boss("!goal cheers 1000");
  ok(total() === "5 subs", "renamed bits word (" + total() + ")");
  boss("!goal halt");
  ok(total() === "5 subs (paused)", "renamed stop word (" + total() + ")");
  boss("!goal go");
  ok(total() === "5 subs", "renamed start word");
  boss("!goal drop 1"); await wait(450);
  ok(live().length === 0, "renamed remove word");
  boss("!goal new 7 again"); boss("!goal wipe");
  ok(live().length === 0, "renamed clear word");
  boss("!goal new 7 again"); boss("!goal fresh");
  ok(total() === "0 subs", "renamed reset word");
  chat("!goal show", { nick: "Randomer" });
  ok(elements["incentive-panel"].classList.contains("pop"), "renamed list word shows the panel to anyone");
  load({ verbAdd: "  Plus  " }); await wait(5);
  boss("!incentive plus 5 tidy");
  ok(names() === "tidy", "words are trimmed and case-insensitive (" + names() + ")");

  console.log("\n[customising counting]");
  load({ countGifts: false }); await wait(5);
  bomb(5); sub({ gifted: true, amount: 1 }); sub({ amount: 1 });
  ok(total() === "1 sub", "with gifts off only own subs count (" + total() + ")");
  load({ countNewSubs: false }); await wait(5);
  sub({ amount: 1 }); sub({ amount: 6 }); bomb(5); sub({ gifted: true, amount: 1 });
  ok(total() === "6 subs", "with own subs off only gifts count (" + total() + ")");
  load({ countGifts: false, countNewSubs: false }); await wait(5);
  sub({ amount: 1 }); bomb(5); cheer(500);
  ok(total() === "1 sub", "both off leaves bits still counting (" + total() + ")");

  console.log("\n[customising goals]");
  load({ goalOrder: "added" }); await wait(5);
  boss("!incentive add 20 second"); boss("!incentive add 5 first added last");
  ok(names() === "second|first added last", "goals can follow the order they were added (" + names() + ")");
  load({ keepUnlocked: false, unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 2 temp"); boss("!incentive add 9 later"); bomb(2);
  ok(live()[0].unlocked === true, "it still celebrates");
  await wait(600);
  ok(names() === "later", "then leaves when reached goals are not kept (" + names() + ")");
  load({ showWaitingCounts: false }); await wait(5);
  boss("!incentive add 5 now"); boss("!incentive add 9 waiting");
  ok(live()[1].count === "", "waiting goals can hide their target (" + JSON.stringify(live()[1].count) + ")");
  load({ maxNameLength: 8 }); await wait(5);
  boss("!incentive add 5 a very long goal name");
  ok(names() === "a very l", "names are cut at the chosen length (" + names() + ")");

  console.log("\n[customising wording]");
  load({ unitSingular: "gift", unitPlural: "gifts", pausedText: "[on hold]", doneText: "done!", unlockedText: "YAY", title: "Event goals", bitsLabel: "cheers", unlockSeconds: 0.05, bitsCalcSeconds: 0.2 }); await wait(5);
  boss("!incentive add 2 cake"); boss("!incentive add 9 party");
  ok(total() === "0 gifts", "plural unit word (" + total() + ")");
  sub({ amount: 1 });
  ok(total() === "1 gift", "singular unit word (" + total() + ")");
  ok(live()[1].count === "9 gifts", "units on waiting goals (" + live()[1].count + ")");
  ok(elements["incentive-title"].textContent === "Event goals", "heading text");
  bomb(1);
  ok(live()[0].count === "YAY", "celebration text (" + live()[0].count + ")");
  await wait(150);
  ok(live()[0].count === "done!", "done text is used as written (" + live()[0].count + ")");
  boss("!incentive stop");
  ok(total() === "2 gifts [on hold]", "paused note (" + total() + ")");
  cheer(300); boss("!incentive bits 300"); await wait(650);
  ok(B("gain").textContent === "+300 cheers" && B("status").textContent === "300/500 cheers", "bits word in the strip (" + B("gain").textContent + ", " + B("status").textContent + ")");

  console.log("\n[customising the bits strip timing]");
  load({ bitsStripSeconds: 0.5, bitsCalcSeconds: 0.2 }); await wait(5);
  cheer(100); await wait(100);
  ok(elements["incentive-bits"].hidden === false, "the strip appears");
  await wait(600);
  ok(elements["incentive-bits"].hidden === false, "and is still there just after the bar has finished (0.3 + 0.2s in)");
  await wait(550);
  ok(elements["incentive-bits"].hidden === true, "then leaves the chosen 0.5s after the bar finishes");

  console.log("\n[customising the look]");
  load({ themePreset: "custom", paddingV: 1, paddingH: 1.5, borderWidth: 3, borderColor: "#FF0000", shadow: true, vAlign: "bottom",
    lineSpacing: 1.5, nameWeight: "800", waitingWeight: "500", waitingScale: 70, colorWaiting: "#CCCCCC", colorDone: "#999999",
    strikeDone: false, textShadow: true, headingScale: 1.6, titleWeight: "600", colorTitle: "#FFEEAA", totalWeight: "400", colorTotal: "#AAEEFF",
    cTrack: "#000000", trackOpacity: 0.5, colorGlow: "#00FF00", barHeight: 1.1, rowGap: 0.4, fillSeconds: 2
  }); await wait(5);
  const A = elements["incentive-app"].style;
  ok(A["--pad-v"] === "1em" && A["--pad-h"] === "1.5em", "padding (" + A["--pad-v"] + ", " + A["--pad-h"] + ")");
  ok(A["--border-w"] === "3px" && A["--border-c"] === "#FF0000", "outline");
  ok(A["--shadow"] !== "none" && A["--text-shadow"] !== "none", "both shadows can be switched on");
  ok(A["align-items"] === "flex-end", "vertical position (" + A["align-items"] + ")");
  ok(A["--paused-scale"] === "0.6", "the paused note is 0.6 times the count by default (" + A["--paused-scale"] + ")");
  ok(A["--lh"] === "1.5" && A["--name-w"] === "800" && A["--wait-w"] === "500", "line spacing and weights");
  ok(A["--wait-scale"] === "0.7" && A["--c-wait"] === "#CCCCCC" && A["--c-done"] === "#999999", "waiting size and colours (" + A["--wait-scale"] + ")");
  ok(A["--active-scale"] === "1.3", "the current goal is 1.3 times the text size by default (" + A["--active-scale"] + ")");
  ok(A["--done-deco"] === "none", "strike-through can be switched off");
  ok(A["--heading-scale"] === "1.6", "one size is shared by the title and the sub count (" + A["--heading-scale"] + ")");
  ok(A["--title-w"] === "600" && A["--c-title"] === "#FFEEAA", "title weight and colour");
  ok(A["--total-w"] === "400" && A["--c-total"] === "#AAEEFF", "sub count weight and colour are separate");
  ok(A["--title-font"] === "inherit" && A["--total-font"] === "inherit", "both use the main font unless given their own");
  ok(A["--track"] === "rgba(0, 0, 0, 0.5)" && A["--glow"] === "rgba(0, 255, 0, 0.7)", "empty bar and glow colours (" + A["--track"] + ")");
  ok(A["--bar-h"] === "1.1em" && A["--row-gap"] === "0.4em" && A["--fill-s"] === "2s", "bar thickness, row gap and fill time");
  load({ vAlign: "middle" }); await wait(5);
  ok(A["align-items"] === "center", "middle");
  load({ vAlign: "nonsense" }); await wait(5);
  ok(A["align-items"] === "flex-start", "a bad position falls back to top");
  load({ activeScale: 2 }); await wait(5);
  ok(A["--active-scale"] === "2", "the current goal size is configurable");
  load({ waitingScale: 5, headingScale: 99, lineSpacing: 0, barHeight: 0, textSize: 500, activeScale: 50 }); await wait(5);
  ok(A["--active-scale"] === "3", "and held to a sensible limit");
  ok(A["--wait-scale"] === "0.3" && A["--heading-scale"] === "4" && A["--lh"] === "0.9" && A["--bar-h"] === "0.2em" && A["--size"] === "19.355cqw",
    "silly numbers are held to sensible limits");

  console.log("\n[title and total defaults, and their own fonts]");
  load(); await wait(5);
  ok(A["--heading-scale"] === "1.5" && A["--title-w"] === "800" && A["--total-w"] === "800",
    "title and total default to larger and extra bold (" + A["--heading-scale"] + ", " + A["--title-w"] + "/" + A["--total-w"] + ")");
  const linkIds = () => document.head.children.map(c => c.id);
  load({ titleOwnFont: true, titleFont: "Pacifico", totalOwnFont: true, totalFont: "Oswald" }); await wait(5);
  ok(A["--title-font"].indexOf("Pacifico") !== -1 && A["--total-font"].indexOf("Oswald") !== -1, "each can have its own font (" + A["--title-font"] + " / " + A["--total-font"] + ")");
  const hrefOf = id => (document.head.children.find(c => c.id === id) || {}).href || "";
  ok(/family=Pacifico/.test(hrefOf("incentive-font-link-title")) && /family=Oswald/.test(hrefOf("incentive-font-link-total")), "and its stylesheet is loaded");
  load({ titleOwnFont: false, titleFont: "Pacifico" }); await wait(5);
  ok(A["--title-font"] === "inherit", "an own font that is not ticked is ignored (" + A["--title-font"] + ")");

  console.log("\n[thank-you when every goal is reached]");
  const T = id => elements["incentive-thanks" + (id ? "-" + id : "")];
  load({ unlockSeconds: 0.05 }); await wait(5);
  ok(T().hidden === true, "no message with no goals");
  boss("!incentive add 2 first"); boss("!incentive add 4 second");
  ok(T().hidden === true, "none while goals are still to come");
  bomb(2); await wait(150);
  ok(T().hidden === true, "one goal reached is not enough (" + T().hidden + ")");
  bomb(2);
  ok(T().hidden === true, "and not while the last one is still celebrating");
  await wait(150);
  ok(T().hidden === false && T("text").textContent === "Thank you for your generosity! <3", "it appears once the last celebration ends (" + T("text").textContent + ")");
  await wait(120);
  ok(T("track").hidden === true && T().classList.contains("no-bar"), "with no bar under it by default");
  boss("!incentive add 50 one more");
  ok(T().hidden === true, "a new goal tucks it away");
  boss("!incentive remove one more");
  await wait(450);
  ok(T().hidden === false, "and removing it brings the message back");
  boss("!incentive reset");
  ok(T().hidden === true, "a reset re-opens the goals, so it goes");
  boss("!incentive subs +10");
  ok(T().hidden === true, "it waits while the two goals celebrate in turn");
  await wait(450);
  ok(T().hidden === false, "and returns when they are all reached again");
  await wait(350);
  reload(); await wait(10);
  ok(T().hidden === false, "it survives a browser-source refresh");
  boss("!incentive clear"); await wait(450);
  ok(T().hidden === true, "no goals, no message");

  load({ showThanks: false, unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 1 only"); bomb(1); await wait(150);
  ok(T().hidden === true, "it can be switched off");
  load({ keepUnlocked: false, unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 1 only"); bomb(1); await wait(600);
  ok(T().hidden === true, "and needs reached goals to stay on screen");
  load({ thanksText: "You are wonderful!", thanksBar: true, unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 1 only"); bomb(1); await wait(150);
  ok(T().hidden === false && T("text").textContent === "You are wonderful!" && T("track").hidden === false && !T().classList.contains("no-bar"), "custom text, with the optional bar switched on (" + T("text").textContent + ")");
  await wait(120);
  ok(T("fill").style.width === "100%", "and it fills");
  load({ themePreset: "custom",thanksScale: 1.4, thanksWeight: "800", colorThanks: "#FFD6F0" }); await wait(5);
  ok(A["--thanks-scale"] === "1.4" && A["--thanks-w"] === "800" && A["--c-thanks"] === "#FFD6F0", "size, boldness and colour are configurable");
  load({ thanksScale: 99 }); await wait(5);
  ok(A["--thanks-scale"] === "3", "and held to a sensible limit");

  console.log("\n[text scales to the box's height too]");
  const fitH = () => elements["incentive-app"].style["--fit-h"];
  load(); await wait(5);
  boss("!incentive add 5 something");
  ok(fitH() === "1", "with the box's size unknown, nothing is scaled (" + fitH() + ")");
  await wait(350);
  mockBoxH = 400; mockPanelH = 300; reload(); await wait(10);
  ok(fitH() === "1", "content that fits the box is left at full size (" + fitH() + ")");
  mockBoxH = 400; mockPanelH = 500; reload(); await wait(10);
  ok(fitH() === "0.792", "content too tall for the box is scaled down to fit it (" + fitH() + ")");
  mockBoxH = 100; mockPanelH = 900; reload(); await wait(10);
  ok(fitH() === "0.3", "but never to nothing (" + fitH() + ")");
  mockBoxH = 400; mockPanelH = 300; reload(); await wait(10);
  ok(fitH() === "1", "and it returns to full size when there is room again (" + fitH() + ")");
  mockBoxH = 0; mockPanelH = 0;

  console.log("\n[animations switch]");
  load(); await wait(5);
  ok(!elements["incentive-app"].classList.contains("no-motion"), "animations are on by default");
  load({ animate: false }); await wait(5);
  ok(elements["incentive-app"].classList.contains("no-motion"), "unticking Animate adds the no-motion class");
  load(); await wait(5);
  ok(!elements["incentive-app"].classList.contains("no-motion"), "and ticking it again removes it");

  console.log("\n[every field is read]");
  const defs = fields;
  const textKeys = Object.keys(defs).filter(k => defs[k].type !== "button");
  const src2 = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
  const unread = textKeys.filter(k => src2.indexOf("f." + k) === -1);
  ok(unread.length === 0, "every field in fields.json is read by widget.js (unread: " + unread.join(", ") + ")");
  const btnKeys = Object.keys(defs).filter(k => defs[k].type === "button");
  const unhandled = btnKeys.filter(k => src2.indexOf('"' + k + '"') === -1);
  ok(unhandled.length === 0, "every button is handled (unhandled: " + unhandled.join(", ") + ")");

  console.log("\n[sounds]");
  const SUB = "data:sub", BITS = "data:bits", GOAL = "data:goal";
  const played = () => audioLog.filter(a => a.played).map(a => a.src.replace("data:", ""));
  const clearLog = () => { audioLog.length = 0; };
  const withSounds = (o) => Object.assign({ subSound: SUB, bitsSound: BITS, goalSound: GOAL }, o || {});

  load(); await wait(5); clearLog();
  sub({ amount: 1 }); cheer(500); bomb(3);
  ok(played().length === 0, "no sounds play when none are chosen");

  load(withSounds()); await wait(5); clearLog();
  sub({ amount: 1 });
  ok(played().join() === "sub", "a sub plays the sub sound (" + played() + ")");
  clearLog(); bomb(10);
  ok(played().join() === "sub", "a gift bomb plays it once, not ten times (" + played() + ")");
  clearLog();
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170 });
  ok(played().length === 0, "the per-recipient follow-ups are silent (" + played() + ")");
  clearLog(); sub({ amount: 6 });
  ok(played().join() === "sub", "a resub plays it too");
  clearLog(); load(withSounds({ countNewSubs: false })); await wait(5); clearLog();
  sub({ amount: 1 });
  ok(played().length === 0, "a sub that does not count is silent");
  load(withSounds()); await wait(5); clearLog();
  cheer(100);
  ok(played().join() === "bits", "a cheer plays the bits sound, even a small one (" + played() + ")");
  clearLog(); boss("!incentive bits +300");
  ok(played().join() === "bits", "so do bits added by hand (" + played() + ")");
  clearLog(); cheer(0); cheer(-5);
  ok(played().length === 0, "an empty cheer is silent");
  clearLog(); boss("!incentive subs +3"); boss("!incentive subs set 1");
  ok(played().length === 0, "manual sub corrections are silent");

  console.log("\n[goal sound]");
  load(withSounds()); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 8 game"); boss("!incentive add 20 later"); clearLog();
  sub({ amount: 1 }); sub({ amount: 1 });
  ok(played().join() === "sub,sub", "ordinary subs play the sub sound (" + played() + ")");
  clearLog(); bomb(3);
  ok(played().join() === "goal", "a sub that reaches a goal plays only the goal sound (" + played() + ")");
  clearLog(); bomb(10);
  ok(played().join() === "goal", "a bomb that reaches two goals plays it once (" + played() + ")");
  clearLog(); boss("!incentive add 2 already met");
  ok(played().join() === "goal", "adding a goal that is already met plays it (" + played() + ")");
  clearLog(); boss("!incentive subs +100");
  ok(played().join() === "goal", "a manual correction can reach a goal (" + played() + ")");
  load(withSounds()); await wait(5);
  boss("!incentive add 2 cheer goal"); clearLog(); cheer(1000);
  ok(played().join() === "goal", "bits that reach a goal play only the goal sound (" + played() + ")");
  load(withSounds({ goalReplacesSound: false })); await wait(5);
  boss("!incentive add 2 both"); clearLog(); bomb(2);
  ok(played().join() === "goal,sub" || played().join() === "sub,goal", "with the replace option off, both play (" + played() + ")");
  load(withSounds({ goalSound: "" })); await wait(5);
  boss("!incentive add 2 quiet goal"); clearLog(); bomb(2);
  ok(played().join() === "sub", "with no goal sound set, the sub sound still plays when a goal is reached (" + played() + ")");
  load(withSounds({ goalSound: "" })); await wait(5);
  boss("!incentive add 2 quiet bits goal"); clearLog(); cheer(1000);
  ok(played().join() === "bits", "and so does the bits sound (" + played() + ")");

  console.log("\n[sound volume, mute and tracking]");
  load(withSounds({ subSoundVolume: 25, bitsSoundVolume: 100, goalSoundVolume: 0 })); await wait(5); clearLog();
  sub({ amount: 1 }); cheer(100);
  ok(audioLog[0].volume === 0.25 && audioLog[1].volume === 1, "each sound has its own volume (" + audioLog.map(a => a.volume) + ")");
  load(withSounds({ subSoundVolume: 900 })); await wait(5); clearLog(); sub({ amount: 1 });
  ok(audioLog[0].volume === 1, "volume is held to the 0 to 1 range");
  load(withSounds({ mute: true })); await wait(5); clearLog();
  sub({ amount: 1 }); cheer(500); boss("!incentive add 1 x"); boss("!incentive bits 500");
  ok(played().length === 0, "unticking Play sounds mutes everything");
  load(withSounds()); await wait(5); boss("!incentive stop"); clearLog();
  sub({ amount: 1 }); bomb(5); cheer(500);
  ok(played().length === 0, "nothing plays while tracking is stopped (events are ignored)");
  boss("!incentive bits +500");
  ok(played().join() === "bits", "but bits added by hand still do, as they still count");
  load(withSounds()); await wait(5); clearLog();
  button("btnSoundSub"); button("btnSoundBits"); button("btnSoundGoal");
  ok(played().join() === "sub,bits,goal", "the test buttons play each sound (" + played() + ")");

  // B. adding goals
  console.log("\n[adding goals]");
  load(); await wait(5);
  ok(panelHidden() === true, "the panel stays out of sight with no goals");
  boss("!incentive add 5 karaoke");
  ok(panelHidden() === false, "the panel appears with the first goal");
  boss("!incentive add 15 chat confessions");
  boss("!incentive add 10 playing a game");
  ok(names() === "karaoke|playing a game|chat confessions", "goals show in target order (" + names() + ")");
  ok(live()[0].count === "0/5" && live()[0].condensed === false, "the nearest goal shows subs over target (" + live()[0].count + ")");
  ok(live()[1].condensed && live()[2].condensed && live()[1].count === "10 subs" && live()[2].count === "15 subs",
    "the rest are condensed to just their target (" + live().map(r => r.count) + ")");
  ok(live()[0].width === "0%", "bars start empty (" + live()[0].width + ")");
  boss("!incentive add 0 nothing");
  boss("!incentive add banana split");
  boss("!incentive add 7");
  boss("!incentive add");
  boss("!incentive add 100001 too far away");
  ok(live().length === 3, "bad adds are ignored (" + live().length + ")");
  boss("!INCENTIVE   add   20    movie   night  ");
  ok(names().endsWith("movie night"), "case and spacing are tidied (" + names() + ")");

  // C. progress
  console.log("\n[progress]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game"); boss("!incentive add 15 chat confessions");
  sub({ amount: 1 }); sub({ amount: 1 });
  ok(live()[0].count === "2/5" && live()[0].width === "40%", "2 subs is 40% of 5 (" + live()[0].count + ", " + live()[0].width + ")");
  ok(live().filter(r => !r.condensed).length === 1, "only one goal carries a live bar (" + live().map(r => r.condensed) + ")");

  // D. unlocking
  console.log("\n[unlocking]");
  load({ unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game");
  bomb(5);
  ok(live()[0].unlocked === true && live()[0].count === "Unlocked!" && live()[0].width === "100%",
    "reaching 5 celebrates karaoke (" + live()[0].count + ", " + live()[0].width + ")");
  ok(live()[1].unlocked === false && live()[1].condensed === false && live()[1].count === "5/10", "the game goal takes the live bar while karaoke celebrates (" + live()[1].count + ")");
  await wait(150);
  ok(names() === "karaoke|playing a game" && rendered().length === 2, "karaoke stays on screen once the celebration ends (" + names() + ")");
  ok(live()[0].unlocked === false && live()[0].done === true && live()[0].condensed === true, "settled and condensed");
  ok(live()[0].count === "- unlocked", "reads 'goal - unlocked' (" + live()[0].name + " " + live()[0].count + ")");
  ok(live()[0].struck === true && live()[1].struck === false, "only the finished goal is struck through");
  ok(live()[1].condensed === false && live()[1].count === "5/10", "the game keeps the live bar (" + live()[1].count + ")");
  sub({ amount: 1 });
  ok(live()[1].count === "6/10" && live()[0].count === "- unlocked", "later subs keep counting towards what is left (" + live()[1].count + ")");

  console.log("\n[gift bomb unlocks several, in turn]");
  load({ unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game"); boss("!incentive add 15 chat confessions");
  bomb(20);
  ok(live().every(r => r.unlocked), "all three celebrate together");
  ok(Number(elements["incentive-list"].children[0].style.animationDelay.replace("s", "")) === 0 &&
     Number(elements["incentive-list"].children[2].style.animationDelay.replace("s", "")) > 0.5,
    "and take turns via staggered delays");
  await wait(1300);
  ok(live().length === 3 && live().every(r => r.done && r.count === "- unlocked"), "all three settle as struck-through lines");
  ok(panelHidden() === false, "and the panel stays up showing them");

  console.log("\n[adding a goal that is already met]");
  load({ unlockSeconds: 0.05 }); await wait(5);
  bomb(7);
  boss("!incentive add 5 karaoke");
  ok(live()[0].unlocked === true, "unlocks straight away");
  await wait(500);
  ok(live().length === 1 && live()[0].done === true, "and settles as usual");

  console.log("\n[reset re-arms settled goals]");
  boss("!incentive reset");
  ok(live()[0].done === false && live()[0].count === "0/5", "a reset makes the goal live again for the next stream (" + live()[0].count + ")");

  console.log("\n[a settled goal can be removed]");
  load({ unlockSeconds: 0.05 }); await wait(5);
  boss("!incentive add 5 karaoke"); bomb(5); await wait(150);
  boss("!incentive remove karaoke");
  ok(live().length === 0, "remove works on a finished goal");

  // E. removing, clearing
  console.log("\n[remove and clear]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game"); boss("!incentive add 15 chat confessions");
  boss("!incentive remove 2");
  ok(names() === "karaoke|chat confessions", "remove by position (" + names() + ")");
  boss("!incentive remove CONFESS");
  ok(names() === "karaoke", "remove by part of the name, any case (" + names() + ")");
  boss("!incentive remove 9"); boss("!incentive remove nope"); boss("!incentive remove");
  ok(names() === "karaoke", "a miss removes nothing (" + names() + ")");
  boss("!incentive add 10 playing a game");
  boss("!incentive clear");
  ok(live().length === 0, "clear removes everything (" + live().length + ")");
  await wait(450);
  ok(panelHidden() === true, "and the panel goes away once they have left");

  // F. adjusting the count
  console.log("\n[adjusting subs]");
  load(); await wait(5);
  boss("!incentive subs +3");
  ok(total() === "3 subs", "!incentive subs +3 (" + total() + ")");
  boss("!incentive subs 2");
  ok(total() === "5 subs", "a bare number adds (" + total() + ")");
  boss("!incentive subs -2");
  ok(total() === "3 subs", "minus subtracts (" + total() + ")");
  boss("!incentive subs set 12");
  ok(total() === "12 subs", "set is exact (" + total() + ")");
  boss("!incentive subs =7");
  ok(total() === "7 subs", "=7 is exact too (" + total() + ")");
  boss("!incentive subs -100");
  ok(total() === "0 subs", "never below zero (" + total() + ")");
  boss("!incentive subs banana");
  ok(total() === "0 subs", "nonsense is ignored (" + total() + ")");

  console.log("\n[reset keeps the goals]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke"); bomb(3);
  boss("!incentive reset");
  ok(total() === "0 subs" && names() === "karaoke" && live()[0].count === "0/5", "subs zeroed, goal kept (" + total() + ", " + names() + ")");

  // G. permissions
  console.log("\n[permissions]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke");
  chat("!incentive add 10 sneaky", { nick: "Randomer" });
  chat("!incentive remove 1", { nick: "Randomer" });
  chat("!incentive subs +9", { nick: "Randomer" });
  chat("!incentive clear", { nick: "Randomer" });
  chat("!incentive reset", { nick: "Randomer" });
  ok(names() === "karaoke" && total() === "0 subs", "a viewer cannot change anything (" + names() + ", " + total() + ")");
  chat("!incentive add 10 playing a game", { mod: true });
  ok(names() === "karaoke|playing a game", "a mod can add (" + names() + ")");
  chat("!incentive list", { nick: "Randomer" });
  chat("!incentive", { nick: "Randomer" });
  ok(elements["incentive-panel"].classList.contains("pop") && names() === "karaoke|playing a game",
    "anyone can ask to see the panel, without changing it");
  load({ whoCanManage: "broadcaster" }); await wait(5);
  chat("!incentive add 5 karaoke", { mod: true });
  ok(live().length === 0, "a mod cannot add in broadcaster-only mode");
  boss("!incentive add 5 karaoke");
  ok(names() === "karaoke", "the broadcaster still can");
  load({ command: "!goal" }); await wait(5);
  boss("!incentive add 5 karaoke");
  ok(live().length === 0, "the old command is ignored when renamed");
  boss("!goal add 5 karaoke");
  ok(names() === "karaoke", "the renamed command works");

  // H. visible cap
  console.log("\n[visible cap]");
  load({ maxVisible: 2, unlockSeconds: 0.05 }); await wait(5);
  ["add 5 one", "add 10 two", "add 15 three", "add 20 four"].forEach(c => boss("!incentive " + c));
  ok(names() === "one|two", "only the nearest two show (" + names() + ")");
  boss("!incentive add 2 nearest");
  ok(names() === "nearest|one", "a nearer goal takes a slot (" + names() + ")");
  bomb(2);
  ok(live().length === 2 && live()[0].unlocked === true, "a celebrating goal keeps its place (" + names() + ")");
  await wait(150);
  ok(names() === "nearest|one|two", "once settled it no longer counts against the cap (" + names() + ")");
  ok(live()[0].done === true, "and stays on screen");

  // I. persistence
  console.log("\n[persistence]");
  load(); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game");
  sub({ amount: 1 }); sub({ amount: 1 });
  await wait(350);
  reload(); await wait(10);
  ok(total() === "2 subs" && names() === "karaoke|playing a game", "goals and count survive a refresh (" + total() + ", " + names() + ")");
  boss("!incentive add 15 chat confessions");
  await wait(350);
  ok(storeData[KEY].incentives.length === 3 && new Set(storeData[KEY].incentives.map(i => i.id)).size === 3,
    "new goals get fresh ids after a refresh");
  load({ startSubs: 42 }); await wait(5);
  ok(total() === "42 subs", "starting count seeds a fresh store (" + total() + ")");
  sub({ amount: 1 }); await wait(350);
  reload(); await wait(10);
  ok(total() === "43 subs", "and is ignored once something is saved (" + total() + ")");

  console.log("\n[a reached goal is saved as unlocked]");
  load({ unlockSeconds: 5 }); await wait(5);
  boss("!incentive add 5 karaoke"); boss("!incentive add 10 playing a game");
  bomb(5);
  await wait(350);
  ok(storeData[KEY].incentives.length === 2 && storeData[KEY].incentives[0].unlocked === true && storeData[KEY].incentives[1].unlocked === false,
    "the reached goal is stored as unlocked, the other is not");
  reload(); await wait(10);
  ok(live()[0].done === true && live()[0].unlocked === false && live()[0].count === "- unlocked",
    "after a refresh it comes back settled, not celebrating again");

  // J. buttons
  console.log("\n[manual buttons]");
  load(); await wait(5);
  button("btnDemo");
  ok(names() === "karaoke|playing a game|chat confessions", "examples button adds the three goals (" + names() + ")");
  button("btnPlus"); button("btnPlus"); button("btnMinus");
  ok(total() === "1 sub", "plus and minus move by one (" + total() + ")");
  button("btnReset");
  ok(total() === "0 subs" && live().length === 3, "reset zeroes subs, keeps goals");
  button("btnClear");
  ok(live().length === 0, "clear removes the goals");

  // K. look
  console.log("\n[look]");
  load(); await wait(5);
  const app = elements["incentive-app"].style;
  ok(app["--panel"] === "rgba(0, 0, 0, 0.55)", "default is soft black (" + app["--panel"] + ")");
  ok(app["--text"] === "#FFFFFF" && app["--accent"] === "#FFFFFF", "white text and bars");
  ok(app["--radius"] === "24px", "rounded corners (" + app["--radius"] + ")");
  ok(app["--size"] === "6.452cqw", "text size 40 is 6.452% of the box width, so it scales with the box (" + app["--size"] + ")");
  load({ textSize: 56 }); await wait(5);
  ok(app["--size"] === "9.032cqw", "text size is configurable (" + app["--size"] + ")");
  load({ textSize: 5 }); await wait(5);
  ok(app["--size"] === "1.935cqw", "and is kept readable (" + app["--size"] + ")");
  load(); await wait(5);
  ok(app["--font"].indexOf("BioRhyme") !== -1, "BioRhyme is the font (" + app["--font"] + ")");
  ok(/family=BioRhyme:wght@200\.\.800/.test(elements["incentive-font-link"].href || ""), "its whole weight range is requested, so any boldness is real");
  load({ themePreset: "custom",colorPanel: "#336699", panelOpacity: 0.3, radius: 10 }); await wait(5);
  ok(app["--panel"] === "rgba(51, 102, 153, 0.3)" && app["--radius"] === "10px", "panel colour, opacity and radius are configurable (" + app["--panel"] + ")");
  load({ themePreset: "custom",colorPanel: "nonsense" }); await wait(5);
  ok(app["--panel"] === "rgba(0, 0, 0, 0.55)", "a bad colour falls back to black");
  load({ title: "" }); await wait(5);
  ok(elements["incentive-title"].hidden === true && elements["incentive-header"].hidden === false, "heading can be blanked while the total stays");
  load({ title: "", showTotal: false }); await wait(5);
  ok(elements["incentive-header"].hidden === true, "the heading row disappears when both are off");


  console.log("\n[blank wording stays blank]");
  load({ unlockedText: "", pausedText: "", doneText: "" }); await wait(5);
  boss("!incentive add 1 karaoke"); sub({ amount: 1 });
  ok(live()[0].count === "", "a blank unlocked text shows nothing instead of the default (" + live()[0].count + ")");
  boss("!incentive stop"); ok(elements["incentive-paused"].textContent === "", "a blank paused note shows nothing");

  console.log("\n[pride flags on the bar]");
  load({ themePreset: "trans" }); await wait(5);
  const FLAG = elements["incentive-app"].style["--flag"];
  ok(/^linear-gradient\(180deg, #5BCEFA 0% 20%, #F5A9B8 20% 40%, #FFFFFF 40% 60%, #F5A9B8 60% 80%, #5BCEFA 80% 100%\)$/.test(FLAG), "the trans preset stripes the bar like its flag, five bands (" + FLAG + ")");
  load({ themePreset: "glass" }); await wait(5);
  ok(elements["incentive-app"].style["--flag"] === "#FFFFFF", "any other preset leaves the bar its accent colour");
  load({ themePreset: "custom", cAccent: "#123456" }); await wait(5);
  ok(elements["incentive-app"].style["--flag"] === elements["incentive-app"].style["--accent"], "and so does Custom");

  // ---- style presets: the same twenty-one, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#89AFFF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF98BE", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#BF684C", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}, "pastelpink": {"text": "#6A2E4B", "accent": "#BF5179", "panel": "#FFE3EC", "font": "Fredoka"}, "faegreen": {"text": "#EEF5DA", "accent": "#C9E265", "panel": "#2C4A36", "font": "Almendra"}, "pride": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(194, 168, 154, 0.9)", "font": "Fredoka"}, "trans": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(185, 201, 225, 0.9)", "font": "Fredoka"}, "bi": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(117, 39, 142, 0.9)", "font": "Fredoka"}, "pan": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(181, 142, 132, 0.9)", "font": "Fredoka"}, "enby": {"text": "#1A1426", "accent": "#2D2D2D", "panel": "rgba(212, 202, 192, 0.9)", "font": "Fredoka"}, "lesbian": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(232, 167, 169, 0.9)", "font": "Fredoka"}, "ace": {"text": "#1A1426", "accent": "#000000", "panel": "rgba(202, 187, 202, 0.9)", "font": "Fredoka"}};
  const LABELS = {"glass": "Soft black (default)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "pastelpink": "Pastel pink", "faegreen": "Fae green", "pride": "Rainbow pride", "trans": "Trans pride", "bi": "Bi pride", "pan": "Pan pride", "enby": "Non-binary pride", "lesbian": "Lesbian pride", "ace": "Ace pride", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 22, "the dropdown offers the twenty-one shared presets and Custom, in the shared order");
  ok(Object.keys(LABELS).every(k => fields.themePreset.options[k] === LABELS[k]), "with the shared labels");
  ok(fields.themePreset.value === "glass", "and Soft black is the default");
  for (const key of Object.keys(EXPECT)) {
    load({ themePreset: key }); await wait(5);
    const S2 = elements["incentive-app"].style;
    ok(S2["--text"] === EXPECT[key].text && S2["--accent"] === EXPECT[key].accent && S2["--panel"] === EXPECT[key].panel && S2["--font"].indexOf('"' + EXPECT[key].font + '"') !== -1,
      key + ": panel, text, accent and font match the shared table (" + S2["--panel"] + ", " + S2["--text"] + ")");
  }
  console.log("\n[pride flags behind the card]");
  load({ themePreset: "trans" }); await wait(5);
  ok(elements["incentive-app"].style["--panel-img"] === "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)", "the trans preset puts its flag behind the card (" + elements["incentive-app"].style["--panel-img"] + ")");
  ok(elements["incentive-app"].style["--flag-edge"] === "inset 0 0 0 1px rgba(20, 16, 38, 0.38)", "and gives the striped bar a thin outline, so a white stripe keeps its edge");
  load({ themePreset: "ace" }); await wait(5);
  ok(/^linear-gradient\(rgba\(255, 255, 255, 0\.\d+\), rgba\(255, 255, 255, 0\.\d+\)\), linear-gradient\(135deg, #000000, #A3A3A3, #FFFFFF, #800080\)$/.test(elements["incentive-app"].style["--panel-img"]), "a flag with a black stripe gets a light wash over it, so the dark text stays readable");
  load({ themePreset: "glass" }); await wait(5);
  ok(elements["incentive-app"].style["--panel-img"] === "none", "and every other preset leaves the card plain");
  ok(elements["incentive-app"].style["--flag-edge"] === "none", "with no outline either");
  load({ themePreset: "frost", cText: "#123456", colorPanel: "#654321" }); await wait(5);
  ok(elements["incentive-app"].style["--text"] === EXPECT.frost.text, "a preset ignores the colour pickers");
  load({ themePreset: "custom", cText: "#123456" }); await wait(5);
  ok(elements["incentive-app"].style["--text"] === "#123456", "and Custom uses them");

  // ---- other widgets can build on the module through its announcements
  console.log("\n[announcing counted events]");
  const heard = [];
  window.addEventListener("subgoals:counted", e => heard.push(e.detail));
  load(); await wait(5);
  heard.length = 0;
  sub({ amount: 1, tier: "2000", name: "Alice" });
  ok(heard.length === 1 && heard[0].kind === "sub" && heard[0].count === 1 && heard[0].tier === 2 && heard[0].gifted === false && heard[0].who === "Alice", "a new tier 2 sub is announced once with its tier and name (" + JSON.stringify(heard[0]) + ")");
  heard.length = 0; bomb(10);
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "GenerousViewer" });
  ok(heard.length === 1 && heard[0].count === 10 && heard[0].bulk === true && heard[0].gifted === true && heard[0].subs === 11, "a gift bomb is announced once at its real size, not once per recipient (" + JSON.stringify(heard) + ")");
  heard.length = 0; sub({ gifted: true, amount: 3, tier: "3000", sender: "Bob" });
  ok(heard.length === 1 && heard[0].count === 1 && heard[0].tier === 3 && heard[0].gifted === true && heard[0].who === "Bob", "a single gifted sub carries its tier and gifter");
  heard.length = 0; sub({ tier: "prime", name: "Cara" });
  ok(heard[0].tier === 1, "a Prime sub counts as tier 1");
  heard.length = 0; cheer(300);
  ok(heard.length === 1 && heard[0].kind === "bits" && heard[0].amount === 300, "a cheer is announced with its bits (" + JSON.stringify(heard[0]) + ")");
  heard.length = 0; cheer(0); cheer(-5);
  ok(heard.length === 0, "an empty cheer is not announced");
  heard.length = 0; load({ bitsPerSub: 0 }); await wait(5); cheer(500);
  ok(heard.length === 1 && heard[0].amount === 500, "bits are still announced when they do not count towards goals");
  heard.length = 0; boss("!incentive stop"); sub({ amount: 1 }); cheer(500);
  ok(heard.length === 0, "nothing is announced while tracking is stopped, so a listener never counts what the goals did not");
  boss("!incentive start"); heard.length = 0; boss("!incentive subs +5"); boss("!incentive bits +500");
  ok(heard.length === 0, "manual corrections are not announced");
  heard.length = 0; load({ countGifts: false }); await wait(5); bomb(5); sub({ amount: 1 });
  ok(heard.length === 1 && heard[0].count === 1, "what the goal settings do not count is not announced (" + heard.length + ")");
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
