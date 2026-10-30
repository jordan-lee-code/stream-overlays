/* Headless integration test for widget.js.
   Mocks the slice of DOM/SE the widget needs, then drives it through the real
   onWidgetLoad / onEventReceived events and asserts on the observable DOM.
   Covers the gift-bomb squat maths, single-gift handling, chat adjustments,
   permissions, the lock, reset, the zero floor, theming and persistence. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));

function makeEl(id) {
  const e = {
    id, textContent: "", hidden: false, offsetWidth: 0, _theme: null,
    style: { setProperty(k, v) { this[k] = v; } },
    _cls: new Set(),
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }
    },
    addEventListener() {}, appendChild() {}
  };
  e.classList._s = e._cls; return e;
}
const ids = ["squat-app", "squat-sticker", "squat-count", "squat-label", "squat-lock", "squat-float", "squat-font-link"];
const elements = {}; ids.forEach(id => elements[id] = makeEl(id));
const document = { getElementById: id => elements[id] || null, createElement: () => makeEl("x"), head: makeEl("head"), body: makeEl("body") };

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
  setTimeout, clearTimeout, console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

const KEY = "squat_tracker_v1";
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
function button(field) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } })); }
function gift(event) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "subscriber-latest", event } })); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const count = () => elements["squat-count"].textContent;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  // A. gift-bomb maths: whole blocks of 5, rounded down
  console.log("\n[gift-bomb squat maths]");
  load(); await wait(5);
  ok(count() === "0", "starts at zero (" + count() + ")");
  gift({ bulkGifted: true, amount: 5 });
  ok(count() === "5", "5 gifted subs add 5 squats (" + count() + ")");
  gift({ bulkGifted: true, amount: 16 });
  ok(count() === "20", "16 more gifted subs add 15 (now " + count() + ")");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 27 });
  ok(count() === "25", "27 gifted subs add 25 (" + count() + ")");
  gift({ bulkGifted: true, amount: 4 });
  ok(count() === "25", "a 4-sub gift adds nothing, under a full block (" + count() + ")");

  // B. single gifts and self-subs never move the counter
  console.log("\n[single gifts and self-subs ignored]");
  load(); await wait(5);
  gift({ gifted: true, amount: 1, sender: "GenerousViewer", name: "Target" }); // targeted single gift
  ok(count() === "0", "one targeted gifted sub adds nothing (" + count() + ")");
  gift({ amount: 1 });                              // brand-new self-sub (no sender)
  ok(count() === "0", "a new self-sub is not a gift (" + count() + ")");
  gift({ amount: 6 });                              // resub of 6 months (no sender)
  ok(count() === "0", "a resub of 6 months is not a gift of 6 subs (" + count() + ")");

  // C. the individual community-gift events must be skipped (this was the +170 bug:
  // each follow-up carries a months/streak/total in `amount`, not a sub count)
  console.log("\n[no double counting on a bomb]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 10, sender: "GenerousViewer" }); // the bomb: 10 subs -> 10 squats
  gift({ gifted: true, isCommunityGift: true, amount: 34, sender: "GenerousViewer", name: "a" });
  gift({ gifted: true, isCommunityGift: true, amount: 34, sender: "GenerousViewer", name: "b" });
  gift({ gifted: true, isCommunityGift: true, amount: 34, sender: "GenerousViewer", name: "c" });
  ok(count() === "10", "only the bomb counted, follow-ups ignored (" + count() + ")");

  // D. chat adjustments for partial amounts
  console.log("\n[chat adjustments]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 20 });          // 20 squats
  chat("!squats -5", { mod: true });
  ok(count() === "15", "mod !squats -5 subtracts (" + count() + ")");
  chat("!squats +2", { broadcaster: true });
  ok(count() === "17", "broadcaster !squats +2 adds (" + count() + ")");
  chat("!squats 3", { mod: true });
  ok(count() === "20", "bare !squats 3 adds relative (" + count() + ")");
  chat("!squats set 8", { mod: true });
  ok(count() === "8", "!squats set 8 sets an exact value (" + count() + ")");
  chat("!squats =40", { broadcaster: true });
  ok(count() === "40", "!squats =40 also sets exactly (" + count() + ")");

  // E. the count can never fall below zero
  console.log("\n[zero floor]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 5 });           // 5
  chat("!squats -100", { mod: true });
  ok(count() === "0", "subtracting past zero floors at zero (" + count() + ")");

  // F. permissions: a plain viewer cannot move the count
  console.log("\n[permissions]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 10 });          // 10
  chat("!squats -5", { nick: "Randomer" });
  ok(count() === "10", "a viewer's adjust is ignored (" + count() + ")");
  chat("!squatsreset", { nick: "Randomer" });
  ok(count() === "10", "a viewer's reset is ignored (" + count() + ")");
  chat("!squats", { nick: "Randomer" });
  ok(count() === "10", "a plain !squats does not change the count (" + count() + ")");

  // G. broadcaster-only mode keeps mods out
  console.log("\n[broadcaster-only mode]");
  load({ whoCanManage: "broadcaster" }); await wait(5);
  gift({ bulkGifted: true, amount: 10 });          // 10
  chat("!squats -5", { mod: true });
  ok(count() === "10", "a mod cannot adjust in broadcaster-only mode (" + count() + ")");
  chat("!squats -5", { broadcaster: true });
  ok(count() === "5", "the broadcaster still can (" + count() + ")");

  // H. reset
  console.log("\n[reset]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 25 });
  chat("!squatsreset", { mod: true });
  ok(count() === "0", "mod reset zeroes the count (" + count() + ")");

  // I. the lock: gifts stop counting, hands still do
  console.log("\n[lock]");
  load(); await wait(5);
  gift({ bulkGifted: true, amount: 20 });           // 20
  chat("!squatslock", { mod: true });
  ok(elements["squat-lock"].hidden === false, "the padlock shows while locked");
  gift({ bulkGifted: true, amount: 20 });
  ok(count() === "20", "a gift bomb adds nothing while locked (" + count() + ")");
  chat("!squats -5", { mod: true });
  ok(count() === "15", "manual deductions still work while locked (" + count() + ")");
  chat("!squats +5", { broadcaster: true });
  ok(count() === "20", "so do manual additions (" + count() + ")");
  chat("!squatsreset", { mod: true });
  ok(count() === "0", "and the reset (" + count() + ")");
  chat("!squatsunlock", { mod: true });
  ok(elements["squat-lock"].hidden === true, "the padlock goes away on unlock");
  gift({ bulkGifted: true, amount: 20 });
  ok(count() === "20", "gifts count again once unlocked (" + count() + ")");

  console.log("\n[lock permissions, button and persistence]");
  load(); await wait(5);
  chat("!squatslock", { nick: "Randomer" });
  gift({ bulkGifted: true, amount: 10 });
  ok(count() === "10", "a viewer cannot lock the count (" + count() + ")");
  button("btnLock");
  gift({ bulkGifted: true, amount: 10 });
  ok(count() === "10", "the settings-panel button locks it (" + count() + ")");
  await wait(350);
  reload(); await wait(10);
  ok(elements["squat-lock"].hidden === false, "the lock survives a browser-source refresh");
  gift({ bulkGifted: true, amount: 10 });
  ok(count() === "10", "and still holds gifts off after the refresh (" + count() + ")");
  button("btnLock");
  gift({ bulkGifted: true, amount: 10 });
  ok(count() === "20", "the same button unlocks it again (" + count() + ")");

  console.log("\n[hiding the padlock]");
  load({ showLock: false }); await wait(5);
  chat("!squatslock", { mod: true });
  ok(elements["squat-lock"].hidden === true, "the padlock stays hidden when turned off");
  gift({ bulkGifted: true, amount: 10 });
  ok(count() === "0", "but the lock itself is still in force (" + count() + ")");

  // J. custom block sizes
  console.log("\n[custom block sizes]");
  load({ subsPerBlock: 10, squatsPerBlock: 3 }); await wait(5);
  gift({ bulkGifted: true, amount: 25 });          // 2 blocks of 10 -> 6 squats
  ok(count() === "6", "25 subs over blocks of 10 give 2x3 = 6 (" + count() + ")");

  // K. starting count seeds an empty store, then persists
  console.log("\n[starting count + persistence]");
  load({ startCount: 42 }); await wait(5);
  ok(count() === "42", "starting count seeds a fresh store (" + count() + ")");
  gift({ bulkGifted: true, amount: 5 });           // 47
  await wait(350);
  elements["squat-count"].textContent = "";
  reload(); await wait(10);
  ok(count() === "47", "the count survived a reload, ignoring startCount (" + count() + ")");

  // L. theme presets
  console.log("\n[theme presets]");
  load({ themePreset: "cosycabin" }); await wait(5);
  ok(elements["squat-app"].style["--accent"] === "#F5ECD6", "cosy cabin box colour (" + elements["squat-app"].style["--accent"] + ")");
  load({ themePreset: "pastelgoth" }); await wait(5);
  ok(elements["squat-app"].style["--accent"] === "#3A3340", "pastel goth changes the box colour");
  load({ themePreset: "custom", colorAccent: "#123456" }); await wait(5);
  ok(elements["squat-app"].style["--accent"] === "rgba(18, 52, 86, 0.55)", "custom uses the colour picker, at the box opacity (" + elements["squat-app"].style["--accent"] + ")");

  // M. caption
  console.log("\n[caption]");
  load(); await wait(5);
  ok(elements["squat-label"].hidden === true, "no caption by default, just the number");
  load({ label: "squats" }); await wait(5);
  ok(elements["squat-label"].hidden === false && elements["squat-label"].textContent === "squats", "caption shows when set");


  // N. counting options
  console.log("\n[counting options]");
  load({ carryLeftover: true }); await wait(5);
  gift({ bulkGifted: true, amount: 3 });
  ok(count() === "0", "3 subs short of a block add nothing yet (" + count() + ")");
  gift({ bulkGifted: true, amount: 3 });
  ok(count() === "5", "but are kept, so another 3 completes a block (" + count() + ")");
  gift({ bulkGifted: true, amount: 4 });
  ok(count() === "10", "and the leftover 1 plus 4 makes the next (" + count() + ")");
  await wait(350);
  reload(); await wait(10);
  gift({ bulkGifted: true, amount: 4 });
  ok(count() === "10", "the carried amount survives a refresh (" + count() + ")");
  chat("!squatsreset", { mod: true }); gift({ bulkGifted: true, amount: 4 });
  ok(count() === "0", "and a reset forgets it (" + count() + ")");
  load({ carryLeftover: true, subsPerBlock: 1, squatsPerBlock: 2 }); await wait(5);
  gift({ gifted: true, amount: 1 }); gift({ gifted: true, amount: 1 });
  ok(count() === "4", "single gifts add up when a block is one sub (" + count() + ")");
  load({ countSingleGifts: false, subsPerBlock: 1 }); await wait(5);
  gift({ gifted: true, amount: 1 });
  ok(count() === "0", "single gifts can be switched off (" + count() + ")");
  load({ subsPerBlock: 1, squatsPerBlock: 3 }); await wait(5);
  gift({ amount: 1 }); gift({ amount: 6 });
  ok(count() === "0", "by default self-subs and resubs do not count (" + count() + ")");
  load({ countNewSubs: true, subsPerBlock: 1, squatsPerBlock: 3 }); await wait(5);
  gift({ amount: 1 }); gift({ amount: 6 });
  ok(count() === "6", "but can, one each regardless of months (" + count() + ")");
  load({ maxCount: 12 }); await wait(5);
  gift({ bulkGifted: true, amount: 50 });
  ok(count() === "12", "the count stops at the highest allowed (" + count() + ")");
  chat("!squats +50", { mod: true });
  ok(count() === "12", "including by hand (" + count() + ")");

  // O. the floating text
  console.log("\n[floating text]");
  load({ floatPlus: "plus ", floatSuffix: " squats", floatSeconds: 0.3 }); await wait(5);
  gift({ bulkGifted: true, amount: 5 });
  ok(elements["squat-float"].textContent === "plus 5 squats", "prefix and suffix are configurable (" + elements["squat-float"].textContent + ")");
  chat("!squats -2", { mod: true });
  ok(elements["squat-float"].textContent === "-2 squats", "and a subtraction shows its minus (" + elements["squat-float"].textContent + ")");
  await wait(400);
  ok(elements["squat-float"].hidden === true, "it leaves after the chosen time");
  load({ showFloat: false }); await wait(5);
  gift({ bulkGifted: true, amount: 5 });
  ok(elements["squat-float"].hidden === true || elements["squat-float"].textContent === "", "and can be switched off");

  // P. look settings
  console.log("\n[look settings]");
  load(); await wait(5);
  const A = elements["squat-app"].style;
  ok(A["--accent"] === "rgba(0, 0, 0, 0.55)" && A["--c-count"] === "#FFFFFF" && A["--c-label"] === "#FFFFFF", "the default is a soft see-through black box with white text (" + A["--accent"] + ")");
  ok(A["--font"].indexOf("BioRhyme") !== -1 && /family=BioRhyme:wght@200\.\.800/.test(elements["squat-font-link"].href || ""), "in BioRhyme, with its whole weight range requested");
  ok(A["--radius-pct"] === "14" && A["--pad-v"] === "6" && A["--pad-h"] === "12" && A["--tilt"] === "0deg" && A["--count-w"] === "800", "rounded, upright and extra bold (" + A["--radius-pct"] + ", " + A["--tilt"] + ", " + A["--count-w"] + ")");
  ok(A["--shadow"] === "none" && A["--text-shadow"] === "none" && A["--tail-display"] === "none", "flat: no shadow, text shadow or tail");
  ok(A["--c-float"] === "#FFFFFF" && A["--c-float-bg"] === "rgba(0, 0, 0, 0.7)", "the floating chip is white on soft black");
  load({ themePreset: "cosycabin" }); await wait(5);
  ok(A["--c-count"] === "#7C6142" && A["--c-label"] === "#57442E" && A["--c-float"] === "#7C6142" && A["--c-float-bg"] === "#F5ECD6", "a coloured preset colours every part from its tones");
  load(); await wait(5);
  load({ radius: 20, paddingV: 8, paddingH: 12, gap: 3, tilt: 6, borderWidth: 4, shadow: false, textShadow: true, showTail: false,
    countScale: 1.5, labelScale: 2, floatScale: 0.5, countWeight: "400", labelWeight: "800", floatWeight: "600", labelOpacity: 1, labelSpacing: 0.2,
    popScale: 1.5, popSeconds: 0.9, floatSeconds: 3 }); await wait(5);
  ok(A["--radius-pct"] === "20" && A["--pad-v"] === "8" && A["--pad-h"] === "12" && A["--gap"] === "3", "shape and spacing");
  ok(A["--tilt"] === "6deg" && A["--border-w"] === "4px", "tilt and outline width");
  ok(A["--shadow"] === "none" && A["--text-shadow"] !== "none" && A["--tail-display"] === "none", "shadows and tail");
  ok(A["--count-scale"] === "1.5" && A["--label-scale"] === "2" && A["--float-scale"] === "0.5", "sizes");
  ok(A["--count-w"] === "400" && A["--label-w"] === "800" && A["--float-w"] === "600", "weights");
  ok(A["--label-opacity"] === "1" && A["--label-spacing"] === "0.2em", "caption opacity and spacing");
  ok(A["--pop-scale"] === "1.5" && A["--pop-s"] === "0.9s" && A["--float-s"] === "3s", "animation size and timing");
  load({ themePreset: "custom", colorCount: "#111111", colorLabel: "#222222", colorBorder: "#333333", colorLock: "#444444", colorFloat: "#555555", colorFloatBg: "#666666" }); await wait(5);
  ok(A["--c-count"] === "#111111" && A["--c-label"] === "#222222" && A["--c-border"] === "#333333", "Custom colours for the number, caption and outline");
  ok(A["--c-lock"] === "#444444" && A["--c-float"] === "#555555" && A["--c-float-bg"] === "rgba(102, 102, 102, 0.55)", "and for the padlock and the floating chip (" + A["--c-float-bg"] + ")");
  load({ themePreset: "custom", colorAccent: "#112233", boxOpacity: 0.9 }); await wait(5);
  ok(A["--accent"] === "rgba(17, 34, 51, 0.9)", "a Custom box has its own opacity (" + A["--accent"] + ")");
  load({ themePreset: "celestial", colorCount: "#111111" }); await wait(5);
  ok(A["--c-count"] !== "#111111", "a preset ignores the custom colours");
  load({ radius: 999, countScale: 99, tilt: 99, popScale: 0, labelOpacity: 5 }); await wait(5);
  ok(A["--radius-pct"] === "50" && A["--count-scale"] === "2" && A["--tilt"] === "20deg" && A["--pop-scale"] === "1" && A["--label-opacity"] === "1", "silly values are held to sensible limits");

  // Q. animation switch
  console.log("\n[animations switch]");
  load(); await wait(5);
  ok(!elements["squat-app"].classList.contains("no-motion"), "animation is on by default");
  load({ animations: false }); await wait(5);
  ok(elements["squat-app"].classList.contains("no-motion"), "unticking Animate adds the no-motion class");

  // R. sounds
  console.log("\n[sounds]");
  const played = () => audioLog.filter(a => a.played).map(a => a.src.replace("data:", ""));
  const clearLog = () => { audioLog.length = 0; };
  const withSounds = (o) => Object.assign({ giftSound: "data:gift", lockSound: "data:lock", unlockSound: "data:unlock" }, o || {});
  load(); await wait(5); clearLog();
  gift({ bulkGifted: true, amount: 5 }); chat("!squatslock", { mod: true });
  ok(played().length === 0, "no sound plays when none are chosen");
  load(withSounds()); await wait(5); clearLog();
  gift({ bulkGifted: true, amount: 5 });
  ok(played().join() === "gift", "a gift that adds squats plays the gift sound (" + played() + ")");
  clearLog(); gift({ bulkGifted: true, amount: 2 });
  ok(played().length === 0, "a gift that adds nothing is silent (" + played() + ")");
  clearLog(); chat("!squatslock", { mod: true });
  ok(played().join() === "lock", "locking plays the lock sound (" + played() + ")");
  clearLog(); chat("!squatslock", { mod: true });
  ok(played().length === 0, "locking twice is silent (" + played() + ")");
  clearLog(); gift({ bulkGifted: true, amount: 5 });
  ok(played().length === 0, "and a gift while locked is silent (" + played() + ")");
  clearLog(); chat("!squatsunlock", { mod: true });
  ok(played().join() === "unlock", "unlocking plays the unlock sound (" + played() + ")");
  clearLog(); chat("!squats +5", { mod: true });
  ok(played().length === 0, "manual changes are silent (" + played() + ")");
  load(withSounds({ giftSoundVolume: 25 })); await wait(5); clearLog(); gift({ bulkGifted: true, amount: 5 });
  ok(audioLog[0].volume === 0.25, "each sound has its own volume (" + audioLog[0].volume + ")");
  load(withSounds({ giftSoundVolume: 900 })); await wait(5); clearLog(); gift({ bulkGifted: true, amount: 5 });
  ok(audioLog[0].volume === 1, "held to the 0 to 1 range");
  load(withSounds({ soundsEnabled: false })); await wait(5); clearLog();
  gift({ bulkGifted: true, amount: 5 }); chat("!squatslock", { mod: true });
  ok(played().length === 0, "unticking Play sounds mutes everything");
  load(withSounds()); await wait(5); clearLog();
  button("btnSoundGift"); button("btnSoundLock"); button("btnSoundUnlock");
  ok(played().join() === "gift,lock,unlock", "the test buttons play each sound (" + played() + ")");

  // S. every field is read
  console.log("\n[every field is read]");
  const keys = Object.keys(fields).filter(k => fields[k].type !== "button");
  const unread = keys.filter(k => src.indexOf("f." + k) === -1);
  ok(unread.length === 0, "every field in fields.json is read by widget.js (unread: " + unread.join(", ") + ")");
  const unhandled = Object.keys(fields).filter(k => fields[k].type === "button" && src.indexOf('"' + k + '"') === -1);
  ok(unhandled.length === 0, "every button is handled (unhandled: " + unhandled.join(", ") + ")");


  // ---- style presets: the same twelve, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#7FA8FF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF8FB8", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#FF8A65", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}};
  const LABELS = {"glass": "Soft black (default)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 13, "the dropdown offers the twelve shared presets and Custom, in the shared order");
  ok(Object.keys(LABELS).every(k => fields.themePreset.options[k] === LABELS[k]), "with the shared labels");
  ok(fields.themePreset.value === "glass", "and Soft black is the default");
  for (const key of Object.keys(EXPECT)) {
    load({ themePreset: key }); await wait(5);
    const S2 = elements["squat-app"].style;
    ok(S2["--c-count"] === EXPECT[key].accent && S2["--c-label"] === EXPECT[key].text && S2["--accent"] === EXPECT[key].panel && S2["--font"].indexOf('"' + EXPECT[key].font + '"') !== -1,
      key + ": panel, text, accent and font match the shared table (" + S2["--c-count"] + ", " + S2["--accent"] + ")");
  }
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
