/* Full headless integration test for widget.js.
   Mocks the slice of DOM/canvas/SE the widget needs, then drives it through the
   real onWidgetLoad / onEventReceived events and asserts on observable DOM.
   Covers all three modes (giveaway / forfeits / Truth or...), draws, mod controls,
   goals, theming, persistence, entry toast, and forfeit cross-off. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));

// ---- fake clock so spins resolve in one animation frame ----
let clock = 0;
const performance = { now() { const v = clock; clock += 1000; return v; } };

// Every property the widget sets on the canvas context, and every label it draws,
// is recorded so the tests can check the wheel's rim, dividers and names.
const ctxLog = [];
function ctxStub() {
  const noop = () => {};
  return new Proxy({}, {
    get: (_, p) => p === "measureText" ? (t) => ({ width: String(t).length * 8 })
      : p === "fillText" ? (t) => { ctxLog.push(["fillText", t]); } : noop,
    set: (_, p, v) => { ctxLog.push([p, v]); return true; }
  });
}
function makeEl(id) {
  const e = {
    id, textContent: "", hidden: false, width: 0, height: 0, offsetWidth: 0, _theme: null,
    style: { setProperty(k, v) { this[k] = v; } },
    _cls: new Set(),
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); },
      toggle(c, f) { if (f === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); } else if (f) this._s.add(c); else this._s.delete(c); return this._s.has(c); }
    },
    getContext() { return ctxStub(); }, addEventListener() {}, appendChild() {}
  };
  e.classList._s = e._cls; return e;
}
const ids = ["wheel-app", "wheel-canvas", "confetti-canvas", "idle-message", "mode-badge",
  "entry-count", "open-badge", "goal-wrap", "goal-text", "goal-fill", "winner-overlay",
  "winner-eyebrow", "winner-name", "winner-sub", "entry-timer", "lifelines", "entry-toast",
  "wheel-font-link"];
const elements = {}; ids.forEach(id => elements[id] = makeEl(id));
const document = { getElementById: id => elements[id] || null, createElement: () => makeEl("x"), head: makeEl("head"), body: makeEl("body") };

const listeners = {};
const window = {
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  dispatchEvent(e) { (listeners[e.type] || []).forEach(fn => fn(e)); },
  performance, devicePixelRatio: 1
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
  window, document, CustomEvent, SE_API, Audio, performance,
  requestAnimationFrame: cb => setTimeout(() => cb(performance.now()), 0),
  setTimeout, clearTimeout, setInterval, clearInterval, Date,
  console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

const KEY = "spin_wheel_v1";
function fieldData(ov) {
  const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
  return Object.assign(fd, { spinDuration: 100, winnerDisplayDuration: 30, idleSpin: false }, ov || {});
}
let lastFD = {};
function load(ov) {
  ov = ov || {};
  storeData[KEY] = { entries: [], forfeits: [], questions: [], mode: ov.defaultMode || "giveaway", open: true };
  lastFD = fieldData(ov);
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
}
function reload() { window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } })); }
function chat(text, o) {
  o = o || {}; const badges = [];
  if (o.broadcaster) badges.push({ type: "broadcaster" });
  if (o.mod) badges.push({ type: "moderator" });
  if (o.sub) badges.push({ type: "subscriber" });
  if (o.vip) badges.push({ type: "vip" });
  const data = { text, nick: (o.nick || "viewer").toLowerCase(), displayName: o.nick || "Viewer",
    badges, tags: { mod: o.mod ? "1" : "0", subscriber: o.sub ? "1" : "0" } };
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}
function button(field) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } })); }
function event(listener, amount) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener, event: { amount } } })); }
const wait = ms => new Promise(r => setTimeout(r, ms));
const app = elements["wheel-app"];
const entryCount = () => elements["entry-count"].textContent;
const winnerName = () => elements["winner-name"].textContent;
const hasCls = c => app.classList.contains(c);

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  // A. giveaway entries + dedupe
  console.log("\n[giveaway entries + dedupe]");
  load(); await wait(5);
  chat("!spintowin", { nick: "Alice" });
  chat("!spintowin", { nick: "Bob", sub: true });
  chat("!spintowin", { nick: "Carol" });
  chat("!spintowin", { nick: "Alice" });
  ok(entryCount() === "3 entries", "three unique entrants, duplicate ignored (" + entryCount() + ")");
  ok(hasCls("state-open") && hasCls("mode-giveaway"), "giveaway mode, entries open");

  // B. permissions
  console.log("\n[permissions]");
  elements["winner-name"].textContent = "\u2014";
  chat("!spin", { nick: "Nobody" });
  await wait(20);
  ok(winnerName() === "\u2014", "non-mod !spin ignored");

  // C. spin + removeWinner
  console.log("\n[spin + removeWinner]");
  chat("!spin", { broadcaster: true });
  await wait(40); ok(winnerName() && winnerName() !== "\u2014", "winner revealed: " + winnerName());
  await wait(850); ok(entryCount() === "2 entries", "winner removed after reveal (" + entryCount() + ")");

  // D. mod controls
  console.log("\n[mod controls]");
  chat("!spinclose", { mod: true }); ok(hasCls("state-closed"), "mod closed entries");
  chat("!spintowin", { nick: "Dave" }); ok(entryCount() === "2 entries", "entries ignored while closed");
  chat("!spinopen", { mod: true }); chat("!spintowin", { nick: "Dave" }); ok(entryCount() === "3 entries", "entry after reopen");
  chat("!spinremove Dave", { mod: true }); ok(entryCount() === "2 entries", "mod removed one");
  chat("!spinclear", { mod: true }); ok(entryCount() === "0 entries", "mod cleared");

  // E. mod adds entrants
  console.log("\n[mod adds entrants]");
  chat("!spinadd Alice, Bob, Carol", { mod: true }); ok(entryCount() === "3 entries", "mod added three (" + entryCount() + ")");
  chat("!spinadd Alice", { mod: true }); ok(entryCount() === "3 entries", "duplicate manual add ignored");

  // F. forfeits mode add + spin + cross-off (default)
  console.log("\n[forfeits: add, spin, cross-off]");
  load({ defaultMode: "forfeits" }); await wait(5);
  chat("!spinforfeitadd Alpha, Beta, Gamma", { broadcaster: true });
  ok(entryCount() === "3 forfeits" && hasCls("mode-forfeits"), "three forfeits added (" + entryCount() + ")");
  chat("!spin", { broadcaster: true });
  await wait(40); ok(["Alpha", "Beta", "Gamma"].indexOf(winnerName()) >= 0, "forfeit drawn: " + winnerName());
  await wait(850); ok(entryCount() === "2 forfeits", "landed forfeit crossed off by default (" + entryCount() + ")");

  // G. subscriber weighting
  console.log("\n[weighting]");
  load({ subscriberWeight: 5 }); await wait(5);
  chat("!spintowin", { nick: "Plainviewer" });
  chat("!spintowin", { nick: "Subby", sub: true });
  await wait(450);
  const saved = storeData[KEY];
  ok(saved.entries.find(e => e.nick === "subby").weight === 5, "subscriber got 5 slots");
  ok(saved.entries.find(e => e.nick === "plainviewer").weight === 1, "non-sub got 1 slot");

  // H. goal auto-spin on each sub
  console.log("\n[goal auto-spin: sub]");
  load({ enableAutoSpin: true, triggerType: "sub" }); await wait(5);
  chat("!spintowin", { nick: "Ada" }); chat("!spintowin", { nick: "Bea" });
  elements["winner-name"].textContent = "\u2014";
  event("subscriber-latest", 1);
  await wait(40); ok(winnerName() && winnerName() !== "\u2014", "new sub auto-spun: " + winnerName());
  await wait(850);

  // I. bits goal threshold
  console.log("\n[goal auto-spin: bits threshold]");
  load({ enableAutoSpin: true, triggerType: "bits", threshold: 500 }); await wait(5);
  chat("!spintowin", { nick: "Cleo" });
  elements["winner-name"].textContent = "\u2014";
  event("cheer-latest", 200); await wait(20); ok(winnerName() === "\u2014", "200 bits below 500, no spin");
  event("cheer-latest", 400); await wait(40); ok(winnerName() !== "\u2014", "crossing bits threshold spun: " + winnerName());
  await wait(850);

  // J. persistence across reload
  console.log("\n[persistence]");
  load(); await wait(5);
  chat("!spintowin", { nick: "Remembered" });
  await wait(450);
  elements["entry-count"].textContent = "";
  reload(); await wait(10);
  ok(entryCount() === "1 entry", "entrant survived a reload (" + entryCount() + ")");

  // K. multi-winner draw
  console.log("\n[multi-winner draw]");
  load(); await wait(5);
  chat("!spinadd GenerousViewer, Marigold, Sunny, Pebble, Clover", { broadcaster: true });
  chat("!spin 3", { broadcaster: true });
  await wait(40); ok(winnerName() && winnerName() !== "\u2014", "draw 1: " + winnerName());
  await wait(2700); ok(entryCount() === "2 entries", "three distinct winners removed (" + entryCount() + ")");

  // L. recent-winner cooldown
  console.log("\n[winner cooldown]");
  load({ removeWinner: false, winnerCooldown: 1 }); await wait(5);
  chat("!spinadd Ruby, Opal", { broadcaster: true });
  chat("!spin", { broadcaster: true }); await wait(40); const first = winnerName(); await wait(850);
  chat("!spin", { broadcaster: true }); await wait(40); const second = winnerName(); await wait(850);
  ok(first && second && first !== second, "cooldown forced a different winner (" + first + " then " + second + ")");

  // M. reroll
  console.log("\n[reroll]");
  load(); await wait(5);
  chat("!spinadd Ash, Birch, Cedar", { broadcaster: true });
  chat("!spin", { broadcaster: true }); await wait(40); await wait(850);
  ok(entryCount() === "2 entries", "one winner removed before reroll");
  chat("!spinreroll", { broadcaster: true });
  await wait(40); ok(winnerName() && winnerName() !== "\u2014", "reroll drew again: " + winnerName());
  await wait(850); ok(entryCount() === "2 entries", "reroll restored then removed (" + entryCount() + ")");

  // N. lastwinner re-show
  console.log("\n[last winner re-show]");
  load(); await wait(5);
  chat("!spinadd Fern, Gorse", { broadcaster: true });
  chat("!spin", { broadcaster: true }); await wait(40); const champ = winnerName(); await wait(850);
  elements["winner-name"].textContent = "\u2014";
  chat("!spinlastwinner", { mod: true });
  ok(winnerName() === champ, "last winner re-shown: " + winnerName());
  await wait(850);

  // O. entry countdown auto-close
  console.log("\n[entry countdown]");
  load({ entrySeconds: 1 }); await wait(5);
  chat("!spinclose", { mod: true }); chat("!spinopen", { mod: true });
  ok(hasCls("state-open"), "opened with a 1s timer");
  await wait(1300); ok(hasCls("state-closed"), "auto-closed after the countdown");

  // P. Truth or...
  console.log("\n[truth or...]");
  load({ lifelineCount: 1 }); await wait(5);
  chat("!spinmode questions", { broadcaster: true });
  chat("!spinask What is your biggest fear?", { nick: "GenerousViewer" });
  chat("!spinask Best concert ever?", { nick: "Marigold" });
  chat("!spinask Weirdest food combo?", { nick: "Sunny" });
  ok(entryCount() === "3 questions" && hasCls("mode-questions"), "three questions (" + entryCount() + ")");
  chat("!spin", { broadcaster: true });
  await wait(40);
  const q1 = winnerName();
  ok(q1 && q1.length > 3, "question revealed: " + q1.slice(0, 24));
  ok(elements["winner-overlay"].hidden === false, "question card stays up");
  ok(elements["lifelines"].hidden === false && elements["lifelines"].textContent.indexOf("♥") >= 0, "lifelines shown");
  chat("!spinveto", { broadcaster: true });
  await wait(40); ok(entryCount() === "2 questions", "vetoed question removed (" + entryCount() + ")");
  ok(winnerName() !== q1, "fresh question after veto");
  chat("!spinveto", { broadcaster: true }); await wait(10);
  ok(elements["winner-sub"].textContent.toLowerCase().indexOf("no more skips") >= 0, "veto refused at 0 lifelines");
  ok(entryCount() === "2 questions", "refused veto removed nothing");
  chat("!spinstrike", { mod: true }); await wait(40); ok(entryCount() === "1 question", "mod strike removed one free (" + entryCount() + ")");
  chat("!spinresetlifelines", { mod: true }); ok(elements["lifelines"].textContent === "Lifelines ♥", "lifelines reset");
  chat("!spinmode giveaway", { broadcaster: true });
  const before = entryCount();
  chat("!spinask ignored now", { nick: "Late" });
  ok(entryCount() === before, "!spinask ignored outside questions mode");

  // Q. questions persistence
  console.log("\n[questions persistence]");
  load({ defaultMode: "questions" }); await wait(5);
  chat("!spinask a remembered question?", { nick: "Echo" });
  await wait(450);
  elements["entry-count"].textContent = "";
  reload(); await wait(10);
  ok(entryCount() === "1 question", "question survived a reload (" + entryCount() + ")");

  // R. theme presets (regression for the rgba colour-format bug)
  console.log("\n[theme presets]");
  load({ themePreset: "cosycabin" }); await wait(5);
  ok(app._theme.accent === "#7C6142", "cosy cabin accent (" + app._theme.accent + ")");
  load({ themePreset: "celestial" }); await wait(5);
  ok(app._theme.accent === "#E8C06B", "switching to celestial changes palette");
  load({ themePreset: "pastelgoth" }); await wait(5);
  ok(app._theme.segs[0] === "#C8B6E2", "pastel goth slices change");
  load({ themePreset: "custom", colorAccent: "#123456" }); await wait(5);
  ok(app._theme.accent === "#123456", "custom uses the colour picker");
  load({ themePreset: "pastel", colorAccent: "rgba(1,2,3,1)" }); await wait(5);
  ok(app._theme.accent === "#BF684C", "a non-hex colour field does not stop a preset");

  // S. dynamic forfeits add/remove/clear
  console.log("\n[dynamic forfeits]");
  load({ defaultMode: "forfeits" }); await wait(5);
  ok(entryCount() === "0 forfeits", "forfeits start blank (" + entryCount() + ")");
  chat("!spinforfeitadd Karaoke, Pyjama party", { mod: true }); ok(entryCount() === "2 forfeits", "added two (" + entryCount() + ")");
  chat("!spinforfeitadd Karaoke", { mod: true }); ok(entryCount() === "2 forfeits", "duplicate ignored");
  chat("!spinforfeitremove Karaoke", { mod: true }); ok(entryCount() === "1 forfeit", "removed one (" + entryCount() + ")");
  chat("!spinforfeitclear", { mod: true }); ok(entryCount() === "0 forfeits", "cleared");

  // T. forfeit auto-spin on cumulative bits (cross-off off, so pool stable)
  console.log("\n[forfeit auto-spin: cumulative bits]");
  load({ defaultMode: "forfeits", enableAutoSpin: true, triggerType: "bits", threshold: 100, triggerCount: "cumulative", forfeitCrossOff: false }); await wait(5);
  chat("!spinforfeitadd Alpha, Beta, Gamma", { broadcaster: true });
  elements["winner-name"].textContent = "\u2014";
  event("cheer-latest", 50); await wait(20); ok(winnerName() === "\u2014", "50 bits below threshold, no spin");
  event("cheer-latest", 60); await wait(40); ok(["Alpha", "Beta", "Gamma"].indexOf(winnerName()) >= 0, "bits threshold spun a forfeit: " + winnerName());
  await wait(850); ok(entryCount() === "3 forfeits", "cross-off off keeps forfeits (" + entryCount() + ")");

  // U. forfeit auto-spin on each donation
  console.log("\n[forfeit auto-spin: each donation]");
  load({ defaultMode: "forfeits", enableAutoSpin: true, triggerType: "tips", threshold: 5, triggerCount: "each" }); await wait(5);
  chat("!spinforfeitadd Alpha, Beta, Gamma", { broadcaster: true });
  elements["winner-name"].textContent = "\u2014";
  event("tip-latest", 3); await wait(20); ok(winnerName() === "\u2014", "donation below threshold, no spin");
  event("tip-latest", 5); await wait(40); ok(winnerName() !== "\u2014", "qualifying donation spun: " + winnerName());
  await wait(850);

  // V. entry toast
  console.log("\n[entry toast]");
  load(); await wait(5);
  chat("!spintowin", { nick: "GenerousViewer" });
  ok(elements["entry-toast"].hidden === false, "toast shown on entry");
  ok(/GenerousViewer joined/i.test(elements["entry-toast"].textContent), "toast text: " + elements["entry-toast"].textContent);
  load({ showEntryToast: false }); await wait(5);
  elements["entry-toast"].hidden = true;
  chat("!spintowin", { nick: "Bob" });
  ok(elements["entry-toast"].hidden === true, "no toast when disabled");

  // W. forfeit cross-off off keeps the forfeit
  console.log("\n[forfeit cross-off off]");
  load({ defaultMode: "forfeits", forfeitCrossOff: false }); await wait(5);
  chat("!spinforfeitadd A, B, C, D", { broadcaster: true });
  chat("!spin", { broadcaster: true });
  await wait(40); await wait(850);
  ok(entryCount() === "4 forfeits", "forfeit kept when cross-off off (" + entryCount() + ")");


  // X. the default look matches the rest of the set
  console.log("\n[default look]");
  load(); await wait(5);
  const A = app.style;
  ok(A["--bg"] === "rgba(0, 0, 0, 0.55)" && A["--text"] === "#FFFFFF" && A["--accent"] === "#FFFFFF", "a soft see-through black panel with white text (" + A["--bg"] + ")");
  ok(A["--font"].indexOf("BioRhyme") !== -1 && /family=BioRhyme:wght@200\.\.800/.test(elements["wheel-font-link"].href || ""), "in BioRhyme, with its whole weight range requested");
  ok(A["--seg-a"] === "#FFFFFF" && A["--seg-b"] === "#D9D9D9", "slices in shades of white and grey");
  ok(A["--tail-display"] === "none" && A["--pill-shadow"] === "none" && A["--pill-tilt"] === "0deg" && A["--card-tilt"] === "0deg", "flat: no tails, shadows or tilt");
  ok(A["--c-pill-bg"] === "rgba(0, 0, 0, 0.55)" && A["--c-eyebrow"] === "#111111", "pills in soft black, the winner label in white");
  load({ themePreset: "cosycabin" }); await wait(5);
  ok(A["--accent"] === "#7C6142" && A["--c-pill-bg"] === "#F5ECD6" && A["--c-pill"] === "#57442E" && A["--c-eyebrow-bg"] === "#7C6142" && A["--c-eyebrow"] === "#F5ECD6", "a coloured preset colours each part from its own tones");

  // Y. wording
  console.log("\n[wording]");
  load({ modeGiveawayLabel: "Raffle", entryWord: "name", entriesWord: "names", openLabel: "Come in!", closedLabel: "Shut", toastSuffix: " is in!", idleMessage: "Say hello" }); await wait(5);
  chat("!spintowin", { nick: "Alice" });
  ok(elements["mode-badge"].textContent === "Raffle" && entryCount() === "1 name" && elements["open-badge"].textContent === "Come in!", "badges and nouns (" + elements["mode-badge"].textContent + ", " + entryCount() + ", " + elements["open-badge"].textContent + ")");
  chat("!spintowin", { nick: "Bob" });
  ok(entryCount() === "2 names", "plural noun (" + entryCount() + ")");
  // Toasts come one at a time from a queue, so wait for this one to reach the screen.
  for (let i = 0; i < 60 && !/ is in!$/.test(elements["entry-toast"].textContent); i++) await wait(100);
  ok(/ is in!$/.test(elements["entry-toast"].textContent), "joined toast wording (" + elements["entry-toast"].textContent + ")");
  chat("!spinclose", { mod: true });
  ok(elements["open-badge"].textContent === "Shut", "closed badge");
  chat("!spinclear", { mod: true });
  ok(elements["idle-message"].textContent === "Say hello", "idle message (" + elements["idle-message"].textContent + ")");
  load({ defaultMode: "forfeits", modeForfeitsLabel: "Dares", forfeitWord: "dare", forfeitsWord: "dares", idleForfeitsText: "Nothing yet. {cmd}!" }); await wait(5);
  ok(elements["mode-badge"].textContent === "Dares" && entryCount() === "0 dares", "forfeit badge and noun (" + entryCount() + ")");
  ok(elements["idle-message"].textContent === "Nothing yet. !spinforfeitadd!", "forfeit idle text fills in the command (" + elements["idle-message"].textContent + ")");
  chat("!spinforfeitadd Solo", { broadcaster: true });
  ok(entryCount() === "1 dare", "singular forfeit noun (" + entryCount() + ")");
  load({ defaultMode: "questions", modeQuestionsLabel: "Ask me", questionWord: "ask", questionsWord: "asks", idleQuestionsText: "Send {cmd} now", lifelinesLabel: "Skips", heartFull: "X", heartEmpty: "o", lifelineCount: 3 }); await wait(5);
  ok(elements["mode-badge"].textContent === "Ask me" && entryCount() === "0 asks", "question badge and noun");
  ok(elements["idle-message"].textContent === "Send !spinask now", "question idle text (" + elements["idle-message"].textContent + ")");
  ok(elements["lifelines"].textContent === "Skips XXX", "lifelines label and symbols (" + elements["lifelines"].textContent + ")");
  load({ winnerLabel: "Champion", winnerOfLabel: "No. {n} of {total}" }); await wait(5);
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  chat("!spin", { broadcaster: true }); await wait(40);
  ok(elements["winner-eyebrow"].textContent === "Champion", "winner label (" + elements["winner-eyebrow"].textContent + ")");
  await wait(900);
  load({ winnerOfLabel: "No. {n} of {total}", spinDuration: 100 }); await wait(5);
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" }); chat("!spintowin", { nick: "Cara" });
  chat("!spin 2", { broadcaster: true }); await wait(40);
  ok(/^No\. 1 of 2$/.test(elements["winner-eyebrow"].textContent), "several winners wording (" + elements["winner-eyebrow"].textContent + ")");
  await wait(1500);
  load({ goalSubLabel: "Subs to go", enableAutoSpin: true, triggerType: "sub" }); await wait(5);
  ok(/^Subs to go: /.test(elements["goal-text"].textContent), "goal bar label (" + elements["goal-text"].textContent + ")");
  load({ timerPrefix: "Closing in ", timerSuffix: " secs", entrySeconds: 30 }); await wait(5);
  chat("!spinopen", { mod: true });
  ok(/^Closing in \d+ secs$/.test(elements["entry-timer"].textContent), "entry countdown wording (" + elements["entry-timer"].textContent + ")");

  load({ timerPrefix: "", timerSuffix: "", entrySeconds: 30 }); await wait(5);
  chat("!spinopen", { mod: true });
  ok(/^\d+$/.test(elements["entry-timer"].textContent), "blank countdown words leave just the number (" + elements["entry-timer"].textContent + ")");
  load({ idleMessage: "" }); await wait(5);
  ok(elements["idle-message"].textContent === "", "a blank idle message stays blank instead of bringing the default back (" + JSON.stringify(elements["idle-message"].textContent) + ")");

  // Z. look settings
  console.log("\n[look settings]");
  load({ pillRadius: 20, pillPaddingV: 8, pillPaddingH: 24, pillTilt: 3, toastRadius: 6, toastTilt: -4, cardRadius: 50, cardTilt: 2, cardPaddingV: 20, cardPaddingH: 30,
    cardBorderWidth: 3, goalHeight: 30, hubRing: 10, showTail: true, pillShadow: true, cardShadow: true, wheelShadow: true, textShadow: true }); await wait(5);
  ok(A["--pill-radius"] === "20" && A["--pill-pad-v"] === "8" && A["--pill-pad-h"] === "24" && A["--pill-tilt"] === "3deg", "pill shape (" + A["--pill-radius"] + ")");
  ok(A["--toast-radius"] === "6" && A["--toast-tilt"] === "-4deg" && A["--card-radius"] === "50" && A["--card-tilt"] === "2deg", "toast and card shape");
  ok(A["--card-pad-v"] === "20" && A["--card-pad-h"] === "30" && A["--card-border"] === "3px" && A["--goal-h"] === "30" && A["--hub-ring"] === "10", "card padding, outline, goal bar and hub");
  ok(A["--tail-display"] === "block" && A["--pill-shadow"] !== "none" && A["--card-shadow"] !== "none" && A["--wheel-shadow"] !== "none" && A["--text-shadow"] !== "none", "tails and shadows can be switched on");
  load({ idleScale: 2, idleWeight: "400", toastScale: 1.5, toastWeight: "600", pillScale: 1.2, pillWeight: "500", goalScale: 0.8, goalWeight: "400",
    eyebrowScale: 1.1, eyebrowWeight: "800", eyebrowSpacing: 4, eyebrowUppercase: false, nameScale: 0.7, nameWeight: "700", subScale: 1.3, subWeight: "400",
    lifelineScale: 0.9, lifelineWeight: "600", questionScale: 1.4 }); await wait(5);
  ok(A["--idle-scale"] === "2" && A["--idle-w"] === "400" && A["--toast-scale"] === "1.5" && A["--toast-w"] === "600", "idle and toast text");
  ok(A["--pill-scale"] === "1.2" && A["--pill-w"] === "500" && A["--goal-scale"] === "0.8" && A["--goal-w"] === "400", "pill and goal text");
  ok(A["--eyebrow-scale"] === "1.1" && A["--eyebrow-w"] === "800" && A["--eyebrow-spacing"] === "4" && A["--eyebrow-case"] === "none", "winner label text");
  ok(A["--name-scale"] === "0.7" && A["--name-w"] === "700" && A["--sub-scale"] === "1.3" && A["--sub-w"] === "400", "winner name and line");
  ok(A["--life-scale"] === "0.9" && A["--life-w"] === "600" && A["--question-scale"] === "1.4", "lifelines and questions");
  load({ themePreset: "custom", colorBg: "#102030", panelOpacity: 0.8, colorText: "#EEEEEE", colorAccent: "#FF00AA", colorPointer: "#00FFAA",
    colorPillBg: "#010101", colorPill: "#020202", colorToastBg: "#030303", colorToast: "#040404", colorCardBg: "#050505", colorCard: "#060606",
    colorEyebrowBg: "#070707", colorEyebrow: "#080808", colorIdle: "#090909", colorGoal: "#0A0A0A", colorGoalTrack: "#FFFFFF", goalTrackOpacity: 0.4,
    colorGoalFrom: "#0B0B0B", colorGoalTo: "#0C0C0C", colorHub: "#0D0D0D", colorHubRing: "#0E0E0E", colorSpent: "#0F0F0F", colorBorder: "#111111" }); await wait(5);
  ok(A["--bg"] === "rgba(16, 32, 48, 0.8)" && A["--text"] === "#EEEEEE" && A["--accent"] === "#FF00AA" && A["--pointer"] === "#00FFAA", "Custom panel, text, accent and pointer (" + A["--bg"] + ")");
  ok(A["--c-pill-bg"] === "rgba(1, 1, 1, 0.8)" && A["--c-pill"] === "#020202" && A["--c-toast-bg"] === "rgba(3, 3, 3, 0.8)" && A["--c-toast"] === "#040404", "Custom pill and toast colours (" + A["--c-pill-bg"] + ")");
  ok(A["--c-card-bg"] === "rgba(5, 5, 5, 0.8)" && A["--c-card"] === "#060606" && A["--c-eyebrow-bg"] === "#070707" && A["--c-eyebrow"] === "#080808", "Custom card and label colours");
  ok(A["--c-idle"] === "#090909" && A["--c-goal"] === "#0A0A0A" && A["--c-goal-track"] === "rgba(255, 255, 255, 0.4)" && A["--c-goal-from"] === "#0B0B0B" && A["--c-goal-to"] === "#0C0C0C", "Custom idle and goal colours");
  ok(A["--c-hub"] === "#0D0D0D" && A["--c-hub-ring"] === "#0E0E0E" && A["--c-spent"] === "#0F0F0F" && A["--c-refused"] === "#0F0F0F" && A["--c-border"] === "#111111", "Custom hub, spent and outline colours");
  ok(A["--c-life-bg"] === "rgba(1, 1, 1, 0.8)", "lifelines share the pill colours");
  load({ themePreset: "custom", colorSegA: "#AA0000", colorSegF: "#0000AA" }); await wait(5);
  ok(A["--seg-a"] === "#AA0000" && A["--seg-f"] === "#0000AA", "Custom slice colours");
  load({ themePreset: "celestial", colorPill: "#123123" }); await wait(5);
  ok(A["--c-pill"] !== "#123123", "a preset ignores the custom colours");
  load({ pillRadius: 999, nameScale: 99, idleScale: 0, cardTilt: 99 }); await wait(5);
  ok(A["--pill-radius"] === "60" && A["--name-scale"] === "3" && A["--idle-scale"] === "0.4" && A["--card-tilt"] === "20deg", "silly values are held to sensible limits");

  // AA. the wheel itself, drawn on the canvas
  console.log("\n[wheel drawing]");
  const widths = () => ctxLog.filter(x => x[0] === "lineWidth").map(x => x[1]);
  const fonts = () => ctxLog.filter(x => x[0] === "font").map(x => x[1]);
  load(); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" }); chat("!spintowin", { nick: "Cara" });
  ok(widths().indexOf(8) !== -1 && widths().indexOf(2) !== -1, "the rim is 8 and the dividers 2 by default (" + widths().slice(-4) + ")");
  ok(fonts().some(f => /^700 /.test(f)) && ctxLog.some(x => x[0] === "fillText" && x[1] === "Alice"), "names are drawn in bold");
  load({ rimWidth: 14, dividerWidth: 5 }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  ok(widths().indexOf(14) !== -1 && widths().indexOf(5) !== -1 && widths().indexOf(8) === -1, "rim and divider widths are configurable (" + widths().slice(-4) + ")");
  load({ rimWidth: 0, dividerWidth: 0 }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  ok(widths().length === 0, "and can be switched off (" + widths() + ")");
  load({ labelWeight: "400" }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  ok(fonts().some(f => /^400 /.test(f)) && !fonts().some(f => /^700 /.test(f)), "name boldness is configurable (" + fonts().slice(-1) + ")");
  load({ themePreset: "custom", colorLabelDark: "#010203", colorLabelLight: "#040506" }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  const fills = ctxLog.filter(x => x[0] === "fillStyle").map(x => x[1]);
  ok(fills.indexOf("#010203") !== -1 || fills.indexOf("#040506") !== -1, "Custom name colours reach the canvas (" + fills.slice(-3) + ")");
  load({ labelScale: 2 }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  const size = f => parseFloat(String(f).replace(/^\d+ /, ""));
  const big = Math.max.apply(null, fonts().map(size));
  load({ labelScale: 1 }); await wait(5); ctxLog.length = 0;
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" });
  ok(big > Math.max.apply(null, fonts().map(size)), "name size scales (" + big + " against " + Math.max.apply(null, fonts().map(size)) + ")");

  // AB. animation
  console.log("\n[animation]");
  load(); await wait(5);
  ok(!hasCls("no-motion") && A["--toast-s"] === "0.45s" && A["--card-s"] === "0.55s" && A["--goal-s"] === "0.6s" && A["--pulse-s"] === "1s", "on by default, at the original speeds");
  load({ animations: false, toastSeconds: 2, cardSeconds: 1, goalSeconds: 3, pulseSeconds: 0.5 }); await wait(5);
  ok(hasCls("no-motion") && A["--toast-s"] === "2s" && A["--card-s"] === "1s" && A["--goal-s"] === "3s" && A["--pulse-s"] === "0.5s", "the switch and the timings");

  // AC. sounds
  console.log("\n[sounds]");
  const played = () => audioLog.filter(a => a.played).map(a => a.src.replace("data:", ""));
  const clearLog = () => { audioLog.length = 0; };
  const withSounds = (o) => Object.assign({ enterSound: "data:enter", tickSound: "data:tick", winSound: "data:win" }, o || {});
  load(); await wait(5); clearLog();
  chat("!spintowin", { nick: "Alice" }); chat("!spintowin", { nick: "Bob" }); chat("!spin", { broadcaster: true }); await wait(60);
  ok(played().length === 0, "no sound plays when none are chosen");
  await wait(900);
  load(withSounds()); await wait(5); clearLog();
  chat("!spintowin", { nick: "Alice" });
  ok(played().join() === "enter", "joining plays the join sound (" + played() + ")");
  clearLog(); chat("!spintowin", { nick: "Alice" });
  ok(played().length === 0, "a repeat join is silent (" + played() + ")");
  chat("!spintowin", { nick: "Bob" }); clearLog();
  chat("!spin", { broadcaster: true }); await wait(60);
  ok(played().indexOf("win") !== -1, "the winner plays the winner sound (" + played().join() + ")");
  await wait(900);
  load(withSounds({ enterSoundVolume: 25 })); await wait(5); clearLog();
  chat("!spintowin", { nick: "Alice" });
  ok(audioLog[0].volume === 0.25, "each sound has its own volume (" + audioLog[0].volume + ")");
  load(withSounds({ enterSoundVolume: 900 })); await wait(5); clearLog(); chat("!spintowin", { nick: "Alice" });
  ok(audioLog[0].volume === 1, "held to the 0 to 1 range");
  load(withSounds({ enableSounds: false })); await wait(5); clearLog();
  chat("!spintowin", { nick: "Alice" });
  ok(played().length === 0, "unticking Play sounds mutes everything");
  load(withSounds()); await wait(5); clearLog();
  button("btnSoundEnter"); button("btnSoundTick"); button("btnSoundWin");
  ok(played().join() === "enter,tick,win", "the test buttons play each sound (" + played() + ")");

  // AD. every field is read
  console.log("\n[every field is read]");
  const keys = Object.keys(fields).filter(k => fields[k].type !== "button");
  const unread = keys.filter(k => src.indexOf("f." + k) === -1);
  ok(unread.length === 0, "every field in fields.json is read by widget.js (unread: " + unread.join(", ") + ")");
  const unhandled = Object.keys(fields).filter(k => fields[k].type === "button" && src.indexOf('"' + k + '"') === -1);
  ok(unhandled.length === 0, "every button is handled (unhandled: " + unhandled.join(", ") + ")");


  // ---- style presets: the same twenty-one, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#89AFFF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF98BE", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#BF684C", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}, "pastelpink": {"text": "#6A2E4B", "accent": "#BF5179", "panel": "#FFE3EC", "font": "Fredoka"}, "faegreen": {"text": "#EEF5DA", "accent": "#C9E265", "panel": "#2C4A36", "font": "Almendra"}, "pride": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(194, 168, 154, 0.9)", "font": "Fredoka"}, "trans": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(185, 201, 225, 0.9)", "font": "Fredoka"}, "bi": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(117, 39, 142, 0.9)", "font": "Fredoka"}, "pan": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(181, 142, 132, 0.9)", "font": "Fredoka"}, "enby": {"text": "#1A1426", "accent": "#2D2D2D", "panel": "rgba(212, 202, 192, 0.9)", "font": "Fredoka"}, "lesbian": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(232, 167, 169, 0.9)", "font": "Fredoka"}, "ace": {"text": "#1A1426", "accent": "#000000", "panel": "rgba(202, 187, 202, 0.9)", "font": "Fredoka"}};
  const LABELS = {"glass": "Soft black (default)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "pastelpink": "Pastel pink", "faegreen": "Fae green", "pride": "Rainbow pride", "trans": "Trans pride", "bi": "Bi pride", "pan": "Pan pride", "enby": "Non-binary pride", "lesbian": "Lesbian pride", "ace": "Ace pride", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 22, "the dropdown offers the twenty-one shared presets and Custom, in the shared order");
  ok(Object.keys(LABELS).every(k => fields.themePreset.options[k] === LABELS[k]), "with the shared labels");
  ok(fields.themePreset.value === "glass", "and Soft black is the default");
  for (const key of Object.keys(EXPECT)) {
    load({ themePreset: key }); await wait(5);
    const S2 = elements["wheel-app"].style;
    ok(S2["--text"] === EXPECT[key].text && S2["--accent"] === EXPECT[key].accent && S2["--bg"] === EXPECT[key].panel && S2["--font"].indexOf('"' + EXPECT[key].font + '"') !== -1,
      key + ": panel, text, accent and font match the shared table (" + S2["--text"] + ", " + S2["--accent"] + ")");
  }
  console.log("\n[pride flags]");
  load({ themePreset: "trans" }); await wait(5);
  const FW = elements["wheel-app"].style;
  ok(FW["--flag-img"] === "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)", "the trans preset puts its flag behind the pills, toast and winner card (" + FW["--flag-img"] + ")");
  ok(FW["--goal-flag"] === "linear-gradient(180deg, #5BCEFA 0% 20%, #F5A9B8 20% 40%, #FFFFFF 40% 60%, #F5A9B8 60% 80%, #5BCEFA 80% 100%)" && FW["--flag-edge"] === "inset 0 0 0 1px rgba(20, 16, 38, 0.38)", "and stripes the goal bar like its flag, outlined so the white stripe keeps its edge");
  load({ themePreset: "glass" }); await wait(5);
  ok(FW["--flag-img"] === "none" && FW["--goal-flag"] === "" && FW["--flag-edge"] === "none", "every other preset keeps its plain panels and its two colour goal bar");
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
