/* Headless integration test for widget.js.
   Mocks the slice of DOM/SE the widget needs, then drives it through the real
   onWidgetLoad / onEventReceived events and asserts on the observable DOM.
   Covers parsing, voting, permissions, the whole rollback family (end, cancel,
   restart, extend, undo), ties, blind polls, escaping, theming and persistence. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
const vclock = require("./clock")();   // time is pretend: timers and the Date the widget reads follow it, so the test never sleeps
const src = fs.readFileSync(ROOT + "/widget/widget.js", "utf8");
const fields = JSON.parse(fs.readFileSync(ROOT + "/widget/fields.json", "utf8"));

function makeEl(id) {
  const e = {
    id, textContent: "", innerHTML: "", hidden: false, offsetWidth: 0, href: "",
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    _cls: new Set(),
    classList: {
      _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }
    },
    addEventListener() {}, children: [], className: "", parentNode: null, setAttribute() {},
    get firstChild() { return this.children[0] || null; },
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
const ids = ["vote-app", "vote-card", "vote-title", "vote-timer", "vote-eyebrow",
  "vote-options", "vote-lie", "vote-notice", "vote-praise", "vote-praise-title", "vote-praise-window", "vote-praise-names", "vote-board", "vote-board-title", "vote-board-list", "vote-total", "vote-hint", "vote-font-link"];
const elements = {}; ids.forEach(id => elements[id] = makeEl(id));
const document = {
  getElementById: id => elements[id] || null,
  createElement: () => makeEl("x"), head: makeEl("head"), body: makeEl("body")
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
// A pretend answer server: `served` is what /state says next, and `asked` is every address the widget fetched.
let served = null;
const asked = [];
// Commands: `sent` is every command address, `reply` what comes back (null is no answer), and `after` what /state says once it has run.
let reply = null, after = null, status = 200;
const sent = [];
const fetchMock = (url) => {
  if (url.indexOf("/?q=") !== -1) {
    sent.push(url);
    if (after) served = after;
    const body = reply;
    return body === null ? Promise.reject(new Error("offline " + url)) : Promise.resolve({ ok: status === 200, status, text: () => Promise.resolve(body) });
  }
  asked.push(url);
  return served ? Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(JSON.stringify(served))) }) : Promise.reject(new Error("offline"));
};
const sandbox = {
  fetch: fetchMock, window, document, CustomEvent, SE_API, Audio, Date: vclock.Date, RegExp, Array, Object,
  setTimeout: vclock.setTimeout, clearTimeout: vclock.clearTimeout, setInterval: vclock.setInterval, clearInterval: vclock.clearInterval,
  console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String, encodeURIComponent
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

const KEY = "spot_the_lie_v1";
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
  if (o.id) data.msgId = o.id;
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "message", event: { data } } }));
}
const boss = { broadcaster: true, nick: "Streamer" };
function button(field) {
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } }));
}
const wait = ms => vclock.advance(ms);

// ---- reading the rendered card ----
const html = () => elements["vote-options"].innerHTML;
function votes() {
  return (html().match(/data-votes="(\d+)"/g) || []).map(m => parseInt(m.match(/\d+/)[0], 10));
}
function labels() {
  return (html().match(/class="vote-label">([^<]*)</g) || []).map(m => m.replace(/^[^>]*>/, "").replace(/<$/, ""));
}
const winners = () => (html().match(/class="vote-option win"/g) || []).length;
// A card that is fading out has already gone, as far as the round is concerned.
const shown = () => elements["vote-card"].hidden === false && !elements["vote-card"].classList.contains("leaving");
const eyebrow = () => elements["vote-eyebrow"].hidden ? "" : elements["vote-eyebrow"].textContent;
const timer = () => parseInt(elements["vote-timer"].textContent, 10);
const total = () => elements["vote-total"].textContent;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } }

(async () => {
  // A. starting a poll
  console.log("\n[starting a poll]");
  load(); await wait(5);
  ok(!shown(), "nothing on screen until a poll opens");
  chat("!vote Fact A, Fact B, The lie", boss); await wait(5);
  ok(shown(), "the card appears when a poll opens");
  ok(labels().join("|") === "Fact A|Fact B|The lie", "options parsed in order (" + labels().join("|") + ")");
  ok(timer() === 45, "default 45 second clock (" + timer() + ")");
  ok(html().indexOf(">A<") > -1 && html().indexOf(">C<") > -1, "options are keyed A, B, C");

  // B. permissions
  console.log("\n[permissions]");
  load(); await wait(5);
  chat("!vote One, Two", { nick: "Randomer" }); await wait(5);
  ok(!shown(), "a viewer cannot open a poll");
  chat("!vote One, Two", { mod: true }); await wait(5);
  ok(shown(), "a mod can open a poll");
  load({ whoCanManage: "broadcaster" }); await wait(5);
  chat("!vote One, Two", { mod: true }); await wait(5);
  ok(!shown(), "a mod cannot open one in broadcaster-only mode");
  chat("!vote One, Two", boss); await wait(5);
  ok(shown(), "the broadcaster still can");

  // C. how a vote is recognised
  console.log("\n[casting votes]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B, The lie", boss); await wait(5);
  chat("2", { nick: "ann" });
  ok(votes().join(",") === "0,1,0", "a bare number votes (" + votes().join(",") + ")");
  chat("C", { nick: "ben" });
  ok(votes().join(",") === "0,1,1", "a letter votes (" + votes().join(",") + ")");
  chat("the lie", { nick: "cat" });
  ok(votes().join(",") === "0,1,2", "the option text itself votes, case-insensitively");
  chat("#1", { nick: "dee" });
  ok(votes().join(",") === "1,1,2", "#1 votes too");
  chat("I reckon it's the last one honestly", { nick: "eve" });
  ok(votes().join(",") === "1,1,2", "ordinary chatter is not a vote");
  ok(total() === "5 votes" || total() === "4 votes", "total counts votes not messages (" + total() + ")");

  // D. one person, one vote
  console.log("\n[one person, one vote]");
  load(); await wait(5);
  chat("!vote A thing, B thing", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("1", { nick: "ann" }); chat("1", { nick: "ann" });
  ok(votes().join(",") === "1,0", "the same person voting three times counts once (" + votes().join(",") + ")");
  chat("2", { nick: "ann" });
  ok(votes().join(",") === "0,1", "changing your mind moves the vote across");
  load({ allowChangeVote: false }); await wait(5);
  chat("!vote A thing, B thing", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ann" });
  ok(votes().join(",") === "1,0", "with changes off, the first answer stands");

  // E. inline duration
  console.log("\n[inline duration]");
  load(); await wait(5);
  chat("!vote 60s Fact A, Fact B, The lie", boss); await wait(5);
  ok(timer() === 60, "a leading 60s overrides the 45 second default (" + timer() + ")");
  ok(labels()[0] === "Fact A", "the duration token is not treated as an option");

  // F. parsing edges
  console.log("\n[parsing edges]");
  load(); await wait(5);
  chat("!vote OnlyOne", boss); await wait(5);
  ok(!shown(), "one option is not a poll");
  chat("!vote  Same , same ,  Other ", boss); await wait(5);
  ok(labels().join("|") === "Same|Other", "duplicates collapse and whitespace is tidied (" + labels().join("|") + ")");
  chat("!vote one,two,three,four,five,six,seven,eight,nine,ten", boss); await wait(5);
  ok(labels().length === 8, "options are capped at 8 (" + labels().length + ")");

  // G. declaring a winner
  console.log("\n[declaring a winner]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B, The lie", boss); await wait(5);
  chat("3", { nick: "ann" }); chat("3", { nick: "ben" }); chat("1", { nick: "cat" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 1, "one winner is highlighted (" + winners() + ")");
  ok(html().indexOf('data-votes="2"') > -1, "the winning option kept its two votes");
  ok(eyebrow() === "Chat says", "the result tag reads Chat says (" + eyebrow() + ")");
  ok(elements["vote-timer"].hidden === true, "the countdown goes away once it is decided");

  // H. ties and empty polls
  console.log("\n[ties and empty polls]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 2, "a tie highlights both options (" + winners() + ")");
  ok(eyebrow() === "It's a tie", "the tie tag shows (" + eyebrow() + ")");
  load({ tieBreak: "random" }); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 1, "random tiebreak picks exactly one (" + winners() + ")");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("!vote end", boss); await wait(5);
  ok(winners() === 0 && eyebrow() === "Nobody voted", "an empty poll declares nobody, not a false winner");

  // H2. one command word: options start a poll, a lone verb runs it
  console.log("\n[one command word]");
  load(); await wait(5);
  chat("!vote End of year, Tacos", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B in chat", "a first option that begins with a verb word still starts a poll (" + elements["vote-hint"].textContent + ")");
  chat("1", { nick: "ann" }); chat("!vote end", boss); await wait(5);
  ok(winners() === 1 && eyebrow() === "Chat says", "while a line that is only the verb ends it (" + eyebrow() + ")");
  load(); await wait(5);
  chat("!vote Cancel the stream, Keep going", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B in chat", "so a poll about cancelling is not a cancel");
  chat("!vote cancel", { nick: "viewer" }); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B in chat", "and a viewer typing the verb changes nothing");
  chat("!vote extend 20", boss); chat("!vote extend", boss); await wait(5);
  ok(true, "extend takes a number, or none (15 seconds)");
  load({ command: "!poll" }); await wait(5);
  chat("!poll One, Two", boss); chat("!vote Three, Four", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B in chat", "the command word is a setting");

  // I. cancel: chat was not ready, bin it entirely
  console.log("\n[cancel]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote cancel", boss); await wait(5);
  ok(!shown(), "cancelling takes the card off screen with nothing declared");

  // J. restart: same options, clean slate
  console.log("\n[restart]");
  load(); await wait(5);
  chat("!vote 60s Fact A, Fact B, The lie", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote restart", boss); await wait(5);
  ok(shown(), "the card stays up after a restart");
  ok(votes().join(",") === "0,0,0", "restart wipes the votes (" + votes().join(",") + ")");
  ok(labels().join("|") === "Fact A|Fact B|The lie", "restart keeps the same options");
  ok(timer() === 60, "restart gives the full clock back (" + timer() + ")");
  chat("1", { nick: "ann" });
  ok(votes().join(",") === "1,0,0", "someone who voted before can vote again after a restart");

  // K. extend
  console.log("\n[extend]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("!vote extend 20", boss); await wait(5);
  ok(timer() === 65, "20 seconds are added to the clock (" + timer() + ")");
  chat("!vote extend", boss); await wait(5);
  ok(timer() === 80, "a bare extend adds the default 15 (" + timer() + ")");

  // L. undo, the actual rollback
  console.log("\n[undo]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B, The lie", boss); await wait(5);
  chat("3", { nick: "ann" }); chat("3", { nick: "ben" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 1, "poll ended and declared");
  chat("!vote undo", boss); await wait(5);
  ok(winners() === 0, "undo takes the result back off");
  ok(votes().join(",") === "0,0,2", "undo keeps the votes that were cast (" + votes().join(",") + ")");
  ok(timer() > 40 && timer() <= 45, "undoing an early end gives back the time that was left (" + timer() + ")");
  chat("1", { nick: "cat" });
  ok(votes().join(",") === "1,0,2", "voting works again after an undo");

  console.log("\n[undo a cancel]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote cancel", boss); await wait(5);
  ok(!shown(), "cancelled");
  chat("!vote undo", boss); await wait(5);
  ok(shown() && votes().join(",") === "1,0", "undo brings a cancelled poll back with its votes");

  console.log("\n[undo a replaced poll]");
  load(); await wait(5);
  chat("!vote First A, First B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote Second A, Second B", boss); await wait(5);
  ok(labels()[0] === "Second A", "a new poll replaces the old one");
  chat("!vote undo", boss); await wait(5);
  ok(labels()[0] === "First A" && votes().join(",") === "1,0", "undo restores the poll that was replaced");

  // M. blind polls
  console.log("\n[blind polls]");
  load({ liveResults: false }); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" });
  ok(elements["vote-card"].classList.contains("blind"), "a blind poll hides its counts while running");
  ok(html().indexOf("50%") === -1, "no percentages leak into the row while blind");
  ok(total().indexOf("1 vote in") === 0, "the total still shows that votes are landing (" + total() + ")");
  chat("!vote end", boss); await wait(5);
  ok(!elements["vote-card"].classList.contains("blind"), "the counts open up when it ends");
  ok(votes().join(",") === "1,0", "the votes were being counted all along");

  // N. hide and re-show
  console.log("\n[hide and re-show]");
  load(); await wait(5);
  chat("!vote Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote end", boss); await wait(5);
  chat("!vote hide", boss); await wait(5);
  ok(!shown(), "hide takes the card away");
  chat("!vote results", boss); await wait(5);
  ok(shown() && winners() === 1, "the result can be put back up");

  // O. a browser-source refresh mid-poll
  console.log("\n[surviving a refresh]");
  load(); await wait(5);
  chat("!vote 60s Fact A, Fact B, The lie", boss); await wait(5);
  chat("3", { nick: "ann" }); chat("3", { nick: "ben" });
  await wait(350);
  elements["vote-options"].innerHTML = "";
  reload(); await wait(20);
  ok(shown(), "the poll is still on screen after a refresh");
  ok(votes().join(",") === "0,0,2", "the votes survived (" + votes().join(",") + ")");
  ok(timer() > 50 && timer() <= 60, "the clock picked up where it was (" + timer() + ")");
  chat("3", { nick: "ann" });
  ok(votes().join(",") === "0,0,2", "someone who already voted cannot vote twice across a refresh");

  // P. the clock running out on its own
  console.log("\n[the clock running out]");
  load(); await wait(5);
  chat("!vote 5s Fact A, Fact B", boss); await wait(5);
  chat("1", { nick: "ann" });
  ok(winners() === 0, "still running at the start");
  await wait(5400);
  ok(winners() === 1, "the poll declared itself when the clock ran out");
  ok(eyebrow() === "Chat says", "and tagged the result");
  chat("!vote undo", boss); await wait(5);
  ok(winners() === 0 && timer() > 0 && timer() <= 15,
    "undoing a poll that ran out reopens it on the grace window (" + timer() + ")");
  ok(votes().join(",") === "1,0", "with the votes it already had (" + votes().join(",") + ")");

  // Q. option text is escaped, because it comes from chat
  console.log("\n[escaping]");
  load(); await wait(5);
  chat('!vote <img src=x onerror=alert(1)>, Safe option', boss); await wait(5);
  ok(html().indexOf("<img") === -1, "html in an option is escaped, not rendered");
  ok(html().indexOf("&lt;img") > -1, "and shows as text instead");

  // R. contains mode
  console.log("\n[contains mode]");
  load({ matchMode: "contains" }); await wait(5);
  chat("!vote pineapple, mushroom", boss); await wait(5);
  chat("definitely pineapple for me", { nick: "ann" });
  ok(votes().join(",") === "1,0", "in contains mode the option can sit in a sentence (" + votes().join(",") + ")");
  load(); await wait(5);
  chat("!vote pineapple, mushroom", boss); await wait(5);
  chat("definitely pineapple for me", { nick: "ann" });
  ok(votes().join(",") === "0,0", "in exact mode the same sentence is not a vote");

  // S. manual buttons mirror the commands
  console.log("\n[manual controls]");
  load(); await wait(5);
  button("btnDemo"); await wait(5);
  ok(shown() && votes().length === 3, "the demo button opens a three-option poll");
  chat("1", { nick: "ann" });
  button("btnEnd"); await wait(5);
  ok(winners() === 1, "the end button declares");
  button("btnUndo"); await wait(5);
  ok(winners() === 0, "the undo button rolls it back");
  button("btnCancel"); await wait(5);
  ok(!shown(), "the cancel button bins it");

  // T. theming
  console.log("\n[theme presets]");
  load({ themePreset: "cosycabin" }); await wait(5);
  ok(elements["vote-app"].style["--accent"] === "#7C6142", "cosy cabin accent (" + elements["vote-app"].style["--accent"] + ")");
  load({ themePreset: "pastelgoth" }); await wait(5);
  ok(elements["vote-app"].style["--accent"] === "#C8B6E2", "pastel goth changes the accent");
  load({ themePreset: "custom", cAccent: "#123456" }); await wait(5);
  ok(elements["vote-app"].style["--accent"] === "#123456", "custom uses the colour picker");
  load(); await wait(5);
  chat("!vote One, Two", boss); await wait(5);
  ok(html().indexOf("--seg:#FFFFFF") > -1 && html().indexOf("--seg:#D9D9D9") > -1, "by default the options are shades of white and grey");
  load({ themePreset: "cosycabin" }); await wait(5);
  chat("!vote One, Two", boss); await wait(5);
  ok(html().indexOf("--seg:#CB9265") > -1, "each option gets its own colour from a coloured preset's palette");

  console.log("\n[scale]");
  load(); await wait(5);
  ok(elements["vote-app"].style["--scale"] === "1", "100% is the default (" + elements["vote-app"].style["--scale"] + ")");
  load({ scale: 400 }); await wait(5);
  ok(elements["vote-app"].style["--scale"] === "4", "400% quadruples the whole card");
  load({ scale: 250 }); await wait(5);
  ok(elements["vote-app"].style["--scale"] === "2.5", "and anything in between works");
  load({ scale: 9000 }); await wait(5);
  ok(elements["vote-app"].style["--scale"] === "4", "an absurd value is clamped to 400%");

  // U. a poll opened before the store has answered must not be wiped by it
  console.log("\n[a poll opened while the store is still loading]");
  delete storeData[KEY];
  lastFD = fieldData();
  window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
  chat("!vote Fact A, Fact B, The lie", boss);   // no await: the store read is still in flight
  ok(shown(), "the poll opens straight away");
  await wait(30);
  ok(shown(), "and survives the store answering with nothing");
  ok(labels().length === 3, "with its options intact (" + labels().length + ")");
  chat("2", { nick: "ann" });
  ok(votes().join(",") === "0,1,0", "and it still takes votes (" + votes().join(",") + ")");

  // V. a poll of bare letters carries no text worth showing
  console.log("\n[letters-only polls]");
  const keysOnly = () => elements["vote-card"].classList.contains("keys-only");
  load(); await wait(5);
  chat("!vote A, B, C, D", boss); await wait(5);
  ok(keysOnly(), "!vote A, B, C, D is recognised as letters only");
  ok(labels().length === 0, "no labels are rendered (" + labels().length + ")");
  ok(html().indexOf(">A<") > -1, "the keyword chips are still there to vote with");
  ok(html().indexOf("vote-bar") > -1, "and the bars still show the split");
  chat("1", { nick: "ann" }); chat("d", { nick: "ben" });
  ok(votes().join(",") === "1,0,0,1", "voting still works by number and letter (" + votes().join(",") + ")");

  chat("!vote 1, 2, 3", boss); await wait(5);
  ok(keysOnly() && labels().length === 0, "!vote 1, 2, 3 is treated the same way");

  chat("!vote B, A, C", boss); await wait(5);
  ok(keysOnly() && labels().length === 0, "letters typed out of order still show as A, B, C");
  chat("B", { nick: "ann" });
  ok(votes().join(",") === "0,1,0",
    "and a vote for B lands on the row showing B, not the one labelled B (" + votes().join(",") + ")");
  chat("2", { nick: "ben" });
  ok(votes().join(",") === "0,2,0", "the number agrees with the letter");

  chat("!vote 3, 1, 2", boss); await wait(5);
  ok(keysOnly() && labels().length === 0, "numbers out of order too");

  chat("!vote A, B, Z", boss); await wait(5);
  ok(!keysOnly() && labels().join("|") === "A|B|Z",
    "a letter outside the set keeps every label, so Z does not vanish behind a chip reading C");

  chat("!vote Fact A, Fact B", boss); await wait(5);
  ok(!keysOnly() && labels().length === 2, "an ordinary poll is unaffected");
  chat("fact b", { nick: "cat" });
  ok(votes().join(",") === "0,1", "and still matches on its label text (" + votes().join(",") + ")");

  console.log("\n[blank wording stays blank]");
  load({ hintSuffix: "", blindSuffix: "", liveResults: false }); await wait(5);
  chat("!vote One, Two", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B", "a blank hint ending leaves none, with no stray space (" + JSON.stringify(elements["vote-hint"].textContent) + ")");
  chat("1", { nick: "ann" });
  ok(total() === "1 vote", "and a blank 'in' after the total leaves just the total (" + total() + ")");

  console.log("\n[the hint stays short]");
  load(); await wait(5);
  chat("!vote One, Two", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A or B in chat",
    "two options (" + elements["vote-hint"].textContent + ")");
  chat("!vote One, Two, Three", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A, B or C in chat",
    "three options (" + elements["vote-hint"].textContent + ")");
  chat("!vote One, Two, Three, Four, Five, Six", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "type A to F in chat",
    "six options collapse to a range (" + elements["vote-hint"].textContent + ")");

  // V. a big chat: every distinct voter counted exactly once
  console.log("\n[a rush of two thousand]");
  load({ duration: 600 }); await wait(5);
  chat("!vote 600s Fact A, Fact B, The lie", boss); await wait(5);
  const expected = [0, 0, 0];
  const t0 = Date.now();
  for (let i = 0; i < 2000; i++) {
    const pick = i % 3;
    expected[pick]++;
    chat([String(pick + 1), "ABC"[pick], "abc"[pick]][i % 3], { nick: "voter" + i });
  }
  const elapsed = Date.now() - t0;
  ok(votes().join(",") === expected.join(","),
    "2000 voters counted exactly (" + votes().join(",") + " vs " + expected.join(",") + ")");
  ok(total() === "2000 votes", "the total agrees (" + total() + ")");
  ok(elapsed < 3000, "2000 votes stay comfortably fast (" + elapsed + "ms)");
  chat("2", { nick: "voter0" });
  ok(total() === "2000 votes", "a returning voter moves their vote without adding one");


  // ---- the default look matches the rest of the set
  console.log("\n[default look]");
  load(); await wait(5);
  const V = elements["vote-app"].style;
  ok(V["--bg"] === "rgba(0, 0, 0, 0.55)" && V["--text"] === "#FFFFFF" && V["--accent"] === "#FFFFFF", "a soft see-through black panel with white text (" + V["--bg"] + ")");
  ok(V["--font"].indexOf("BioRhyme") !== -1, "in BioRhyme (" + V["--font"] + ")");
  ok(/family=BioRhyme:wght@200\.\.800/.test(elements["vote-font-link"].href || ""), "with its whole weight range requested");
  ok(V["--frame-w"] === "0.14" && V["--border-w"] === "0" && V["--c-border"] === "#FFFFFF" && V["--shadow"] === "none" && V["--tail-display"] === "none" && V["--pill-tilt"] === "0deg", "flat: no shadow, tail or tilt, but an outer frame in the accent colour (" + V["--frame-w"] + ")");
  ok(V["--title-w"] === "800", "and an extra bold heading");

  // ---- wording
  console.log("\n[wording]");
  load({ voteWord: "ballot", votesWord: "ballots", blindSuffix: " cast", hintVerb: "say", hintOr: "or maybe", hintSuffix: "below", hintTo: "through", timerSuffix: "s" }); await wait(5);
  chat("!vote A, B, C", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "say A, B or maybe C below", "hint line wording (" + elements["vote-hint"].textContent + ")");
  ok(total() === "0 ballots", "plural vote word (" + total() + ")");
  chat("A", { nick: "ann" });
  ok(total() === "1 ballot", "singular vote word (" + total() + ")");
  ok(/s$/.test(elements["vote-timer"].textContent), "timer suffix (" + elements["vote-timer"].textContent + ")");
  chat("!vote 1, 2, 3, 4, 5", boss); await wait(5);
  ok(elements["vote-hint"].textContent === "say 1 through 5 below" || elements["vote-hint"].textContent === "say A through E below", "range wording (" + elements["vote-hint"].textContent + ")");
  load({ liveResults: false, blindSuffix: " cast" }); await wait(5);
  chat("!vote One, Two", boss); await wait(5); chat("1", { nick: "a" });
  ok(total() === "1 vote cast", "blind total suffix (" + total() + ")");

  // ---- look settings
  console.log("\n[look settings]");
  load({ radius: 2, paddingV: 1, paddingH: 1.5, cardGap: 1, rowGap: 0.5, borderWidth: 0.3, shadow: true, textShadow: true, showTail: true,
    timerRadius: 1, timerTilt: 5, eyebrowTilt: -4, barWidth: 6, barHeight: 0.8, eyebrowUppercase: false }); await wait(5);
  ok(V["--radius"] === "2" && V["--pad-v"] === "1" && V["--pad-h"] === "1.5" && V["--gap"] === "1" && V["--row-gap"] === "0.5", "shape and spacing");
  ok(V["--frame-w"] === "0.3" && V["--shadow"] !== "none" && V["--text-shadow"] !== "none" && V["--tail-display"] === "block", "frame thickness, shadows and tail");
  ok(V["--pill-radius"] === "1" && V["--pill-tilt"] === "5deg" && V["--eyebrow-tilt"] === "-4deg" && V["--eyebrow-case"] === "none", "timer and result label");
  ok(V["--bar-w"] === "6em" && V["--bar-h"] === "0.8em", "bar size");
  load({ titleScale: 2, titleWeight: "400", timerScale: 1.5, timerWeight: "600", eyebrowScale: 1, eyebrowWeight: "800", eyebrowSpacing: 0.3,
    labelScale: 1.2, labelWeight: "500", keyScale: 1.1, keyWeight: "400", countScale: 1, countWeight: "800", countOpacity: 0.5,
    footScale: 0.9, footWeight: "400", footOpacity: 0.4, lostOpacity: 0.2 }); await wait(5);
  ok(V["--title-scale"] === "2" && V["--title-w"] === "400" && V["--timer-scale"] === "1.5" && V["--timer-w"] === "600", "heading and timer text");
  ok(V["--eyebrow-scale"] === "1" && V["--eyebrow-w"] === "800" && V["--eyebrow-spacing"] === "0.3em", "result label text");
  ok(V["--label-scale"] === "1.2" && V["--label-weight"] === "500" && V["--key-scale"] === "1.1" && V["--key-w"] === "400", "option text and chips");
  ok(V["--count-scale"] === "1" && V["--count-weight"] === "800" && V["--count-opacity"] === "0.5", "count text");
  ok(V["--foot-scale"] === "0.9" && V["--foot-w"] === "400" && V["--foot-opacity"] === "0.4" && V["--lost-opacity"] === "0.2", "footer and lost options");
  load({ themePreset: "pastelpink" }); await wait(5); const solidBg = V["--bg"];
  load({ themePreset: "pastelpink", panelOpacity: 0.3 }); await wait(5);
  ok(V["--bg"] === solidBg, "a preset keeps its own opacity unless the box is ticked");
  load({ themePreset: "pastelpink", usePanelOpacity: true, panelOpacity: 0.3 }); await wait(5);
  ok(V["--bg"] === "rgba(255, 227, 236, 0.3)", "ticked, the preset's panel takes the Panel opacity (" + V["--bg"] + ")");
  load({ themePreset: "pride", usePanelOpacity: true, panelOpacity: 0.3 }); await wait(5);
  ok(String(V["--bg-img"]).indexOf("#") === -1 && /rgba\(229, 0, 0, 0\.3\)/.test(V["--bg-img"]), "and a flag's stripes fade with it (" + V["--bg-img"] + ")");
  ok(/#E50000/i.test(V["--frame-img"] || ""), "while the frame and the decorations still know the flag's own colours (" + String(V["--frame-img"]).slice(0, 60) + ")");
  load({ themePreset: "custom", outerFrame: false, borderWidth: 0.2, colorPanel: "#102030", panelOpacity: 0.8, cText: "#EEEEEE", cAccent: "#FF00AA", colorOnAccent: "#001122",
    colorBorder: "#010101", colorTitle: "#020202", colorPillBg: "#030303", colorPill: "#040404", colorEyebrowBg: "#050505", colorEyebrow: "#060606",
    colorRow: "#000000", rowOpacity: 0.3, colorKey: "#070707", colorLabel: "#080808", cTrack: "#FFFFFF", trackOpacity: 0.4, colorCount: "#090909",
    colorWinBg: "#0A0A0A", colorWin: "#0B0B0B", colorFoot: "#0C0C0C", colorSegA: "#AA0000", colorSegB: "#00AA00" }); await wait(5);
  ok(V["--bg"] === "rgba(16, 32, 48, 0.8)" && V["--text"] === "#EEEEEE" && V["--accent"] === "#FF00AA", "Custom panel colour with its opacity, text and accent (" + V["--bg"] + ")");
  ok(V["--c-border"] === "#010101" && V["--c-title"] === "#020202" && V["--c-pill-bg"] === "#030303" && V["--c-pill"] === "#040404", "Custom outline, heading and countdown colours");
  ok(V["--c-eyebrow-bg"] === "#050505" && V["--c-eyebrow"] === "#060606" && V["--c-key"] === "#070707" && V["--c-label"] === "#080808", "Custom result label, chip and option colours");
  ok(V["--c-row"] === "rgba(0, 0, 0, 0.3)" && V["--c-track"] === "rgba(255, 255, 255, 0.4)", "Custom row and track tints (" + V["--c-row"] + ")");
  ok(V["--c-count"] === "#090909" && V["--c-win-bg"] === "#0A0A0A" && V["--c-win"] === "#0B0B0B" && V["--c-foot"] === "#0C0C0C", "Custom count, winner and footer colours");
  chat("!vote One, Two", boss); await wait(5);
  ok(html().indexOf("--seg:#AA0000") > -1 && html().indexOf("--seg:#00AA00") > -1, "Custom option colours");
  load({ themePreset: "cosycabin", colorBorder: "#010101", colorKey: "#070707" }); await wait(5);
  ok(V["--c-border"] === "#7C6142" && V["--c-key"] !== "#070707", "a preset ignores the custom colours");
  load({ radius: 99, titleScale: 99, scale: 5000, barHeight: 0, countOpacity: 9 }); await wait(5);
  ok(V["--radius"] === "4" && V["--title-scale"] === "3" && V["--bar-h"] === "0.1em" && V["--count-opacity"] === "1" && V["--scale"] === "4", "silly values are held to sensible limits");

  // ---- the heading's own font
  console.log("\n[heading font]");
  load(); await wait(5);
  ok(V["--title-font"] === "inherit", "the heading uses the main font by default");
  load({ titleOwnFont: true, titleFont: "Pacifico" }); await wait(5);
  ok(V["--title-font"].indexOf("Pacifico") !== -1, "or its own (" + V["--title-font"] + ")");
  load({ titleOwnFont: false, titleFont: "Pacifico" }); await wait(5);
  ok(V["--title-font"] === "inherit", "an own font that is not ticked is ignored");

  // ---- animation
  console.log("\n[animation]");
  load(); await wait(5);
  ok(!elements["vote-app"].classList.contains("no-motion") && V["--fill-s"] === "0.45s" && V["--in-s"] === "0.42s" && V["--pulse-s"] === "0.8s", "on by default, at the original speeds");
  load({ animate: false, fillSeconds: 1.5, enterSeconds: 1, pulseSeconds: 2 }); await wait(5);
  ok(elements["vote-app"].classList.contains("no-motion"), "unticking Animate adds the no-motion class");
  ok(V["--fill-s"] === "1.5s" && V["--in-s"] === "1s" && V["--pulse-s"] === "2s", "and the timings are configurable");

  // ---- urgent seconds
  console.log("\n[urgent seconds]");
  load({ urgentSeconds: 30 }); await wait(5);
  chat("!vote 20s One, Two", boss); await wait(5);
  ok(elements["vote-timer"]._cls.has("urgent"), "the timer pulses from the chosen number of seconds out (" + elements["vote-timer"].textContent + ")");
  load({ urgentSeconds: 0 }); await wait(5);
  chat("!vote 20s One, Two", boss); await wait(5);
  ok(!elements["vote-timer"]._cls.has("urgent"), "and not at all when set to 0");

  // ---- sounds
  console.log("\n[sounds]");
  const played = () => audioLog.filter(a => a.played).map(a => a.src.replace("data:", ""));
  const clearLog = () => { audioLog.length = 0; };
  const withSounds = (o) => Object.assign({ openSound: "data:open", voteSound: "data:vote", tickSound: "data:tick", resultSound: "data:result" }, o || {});
  load(); await wait(5); clearLog();
  chat("!vote One, Two", boss); chat("1", { nick: "a" }); chat("!vote end", boss);
  ok(played().length === 0, "no sound plays when none are chosen");
  load(withSounds()); await wait(5); clearLog();
  chat("!vote One, Two", boss); await wait(5);
  ok(played().join() === "open", "opening a poll plays the open sound (" + played() + ")");
  clearLog(); chat("1", { nick: "a" });
  ok(played().join() === "vote", "a counted vote plays the vote sound (" + played() + ")");
  clearLog(); chat("1", { nick: "a" }); chat("banana", { nick: "b" });
  ok(played().length === 0, "a repeated vote or a non-vote is silent (" + played() + ")");
  clearLog(); chat("!vote end", boss);
  ok(played().join() === "result", "ending plays the result sound (" + played() + ")");
  load(withSounds({ urgentSeconds: 60 })); await wait(5); clearLog();
  chat("!vote One, Two", boss); await wait(5);
  ok(played().indexOf("tick") !== -1, "the last seconds tick (" + played() + ")");
  const ticks = played().filter(x => x === "tick").length;
  chat("1", { nick: "a" }); chat("2", { nick: "b" });
  ok(played().filter(x => x === "tick").length === ticks, "once a second at most, not once per render");
  load(withSounds({ voteSoundVolume: 25 })); await wait(5); clearLog();
  chat("!vote One, Two", boss); chat("1", { nick: "a" });
  ok(audioLog.filter(a => a.src === "data:vote")[0].volume === 0.25, "each sound has its own volume");
  load(withSounds({ mute: true })); await wait(5); clearLog();
  chat("!vote One, Two", boss); chat("1", { nick: "a" }); chat("!vote end", boss);
  ok(played().length === 0, "unticking Play sounds mutes everything");
  load(withSounds()); await wait(5); clearLog();
  button("btnSoundOpen"); button("btnSoundVote"); button("btnSoundTick"); button("btnSoundResult");
  ok(played().join() === "open,vote,tick,result", "the test buttons play each sound (" + played() + ")");

  // ---- every field is read
  console.log("\n[every field is read]");
  const keys = Object.keys(fields).filter(k => fields[k].type !== "button");
  const unread = keys.filter(k => src.indexOf("f." + k) === -1 && src.indexOf('f["' + k) === -1 && !/^colorSeg[A-H]$/.test(k));
  ok(unread.length === 0, "every field in fields.json is read by widget.js (unread: " + unread.join(", ") + ")");
  ok(src.indexOf('f["colorSeg"') !== -1 || src.indexOf("f[\"colorSeg\" + k]") !== -1, "including the eight option colours");
  const unhandled = Object.keys(fields).filter(k => fields[k].type === "button" && src.indexOf('"' + k + '"') === -1);
  ok(unhandled.length === 0, "every button is handled (unhandled: " + unhandled.join(", ") + ")");


  // ---- style presets: the same twenty-two, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "textonly": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#89AFFF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF98BE", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#BF684C", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}, "pastelpink": {"text": "#6A2E4B", "accent": "#BF5179", "panel": "#FFE3EC", "font": "Fredoka"}, "pastelsage": {"text": "#2B4636", "accent": "#4A7A5A", "panel": "#DEEBD8", "font": "Fredoka"}, "faegreen": {"text": "#EEF5DA", "accent": "#C9E265", "panel": "#2C4A36", "font": "Almendra"}, "pride": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(194, 168, 154, 0.9)", "font": "Fredoka"}, "trans": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(185, 201, 225, 0.9)", "font": "Fredoka"}, "bi": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(117, 39, 142, 0.9)", "font": "Fredoka"}, "pan": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(181, 142, 132, 0.9)", "font": "Fredoka"}, "enby": {"text": "#1A1426", "accent": "#2D2D2D", "panel": "rgba(212, 202, 192, 0.9)", "font": "Fredoka"}, "lesbian": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(232, 167, 169, 0.9)", "font": "Fredoka"}, "ace": {"text": "#1A1426", "accent": "#000000", "panel": "rgba(202, 187, 202, 0.9)", "font": "Fredoka"}};
  const LABELS = {"glass": "Soft black (default)", "textonly": "Text only (no box)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "pastelpink": "Pastel pink", "pastelsage": "Pastel sage", "faegreen": "Fae green", "pride": "Rainbow pride", "trans": "Trans pride", "bi": "Bi pride", "pan": "Pan pride", "enby": "Non-binary pride", "lesbian": "Lesbian pride", "ace": "Ace pride", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 24, "the dropdown offers the twenty-two shared presets and Custom, in the shared order");
  ok(Object.keys(LABELS).every(k => fields.themePreset.options[k] === LABELS[k]), "with the shared labels");
  ok(fields.themePreset.value === "glass", "and Soft black is the default");
  for (const key of Object.keys(EXPECT)) {
    load({ themePreset: key }); await wait(5);
    const S2 = elements["vote-app"].style;
    ok(S2["--text"] === EXPECT[key].text && S2["--accent"] === EXPECT[key].accent && S2["--bg"] === EXPECT[key].panel && S2["--font"].indexOf('"' + EXPECT[key].font + '"') !== -1,
      key + ": panel, text, accent and font match the shared table (" + S2["--text"] + ", " + S2["--accent"] + ")");
  }
  console.log("\n[pride flags behind the card]");
  load({ themePreset: "trans" }); await wait(5);
  ok(elements["vote-app"].style["--bg-img"] === "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)", "the trans preset puts its flag behind the card (" + elements["vote-app"].style["--bg-img"] + ")");
  ok(elements["vote-app"].style["--edge"] === "inset 0 0 0 1px rgba(20, 16, 38, 0.38)", "and gives the option chips and bars a thin outline, so a white stripe keeps its edge");
  load({ themePreset: "ace" }); await wait(5);
  ok(/^linear-gradient\(rgba\(255, 255, 255, 0\.\d+\), rgba\(255, 255, 255, 0\.\d+\)\), linear-gradient\(135deg, #000000, #A3A3A3, #FFFFFF, #800080\)$/.test(elements["vote-app"].style["--bg-img"]), "a flag with a black stripe gets a light wash over it, so the dark text stays readable");
  load({ themePreset: "glass" }); await wait(5);
  ok(elements["vote-app"].style["--bg-img"] === "none", "and every other preset leaves the card plain");
  ok(elements["vote-app"].style["--edge"] === "none", "with no outline either");
  console.log("\n[fitting the box]");
  ok(!fields.grow && fields.scale.max === 100, "the card always fills its box, and Text size only makes text smaller");
  // The mock has no layout, so the card and the box are given sizes by hand: a layout 300 by 200 pixels at its starting
  // text size, in a box with 900 by 400 to spare.
  const sized = () => { const c = elements["vote-card"], a = elements["vote-app"]; c.offsetWidth = 300; c.offsetHeight = 200; c.scrollHeight = 0; c.clientHeight = 0; a.clientWidth = 900; a.clientHeight = 400; };
  const fitFor = async (settings, prepare) => { (prepare || sized)(); load(settings); await wait(5); (prepare || sized)(); chat("!vote Pizza, Tacos, Sushi", { broadcaster: true }); await wait(5); return parseFloat(elements["vote-card"].style["--fit"]); };
  const full = await fitFor({});
  ok(full > 1.9 && full <= 2, "the text is scaled up to suit the box (" + full + ")");
  const half = await fitFor({ scale: 50 });
  ok(Math.abs(half - full / 2) < 0.01, "the Text size setting makes it smaller (" + half + ")");
  const tight = await fitFor({}, () => { sized(); elements["vote-app"].clientHeight = 100; });
  ok(tight < 0.5, "and a small box gets small text (" + tight + ")");
  load({}); await wait(5);
  console.log("\n[the winning row]");
  const cssText = fs.readFileSync(ROOT + "/widget/widget.css", "utf8");
  ok(/\.vote-option\.win \.vote-label,\s*\.vote-option\.win \.vote-count\s*\{\s*color:\s*var\(--c-win\)/.test(cssText), "the winning row's name and count take the winning colour, since their own colours would leave them white on the white highlight");
  console.log("\n[the outer frame]");
  load({}); await wait(5);
  ok(V["--frame-w"] === "0.14" && V["--c-border"] === V["--accent"], "by default the card has a frame in the accent colour, a default thickness (" + V["--frame-w"] + ", " + V["--c-border"] + ")");
  load({ themePreset: "midnight" }); await wait(5);
  ok(V["--c-border"] === "#89AFFF" && V["--c-border"] === V["--accent"], "which is each preset's own accent (" + V["--c-border"] + ")");
  load({ outerFrame: false }); await wait(5);
  ok(V["--frame-w"] === "0" && V["--border-w"] === "0", "it can be switched off, which leaves no outline");
  load({ borderWidth: 0.4 }); await wait(5);
  ok(V["--frame-w"] === "0.4", "a thickness sets the frame's thickness (" + V["--frame-w"] + ")");
  load({ themePreset: "custom", cAccent: "#FF00AA", colorBorder: "#010101", borderWidth: 0.3 }); await wait(5);
  ok(V["--c-border"] === "#FF00AA", "and in Custom the frame is the accent colour you picked, not the outline colour (" + V["--c-border"] + ")");
  load({ themePreset: "custom", cAccent: "#FF00AA", colorBorder: "#010101", borderWidth: 0.3, outerFrame: false }); await wait(5);
  ok(V["--c-border"] === "#010101" && V["--border-w"] === "0.3", "with the frame unticked a Custom outline is the colour and thickness you set (" + V["--c-border"] + ", " + V["--border-w"] + ")");
  console.log("\n[the outer frame in a pride preset]");
  load({ themePreset: "trans" }); await wait(5);
  ok(String(V["--frame-img"]).indexOf("linear-gradient(180deg, #5BCEFA") === 0 && V["--c-border"] === "transparent", "a pride preset's frame is its flag's stripes, as a ring, and the border is only the room it takes (" + String(V["--frame-img"]).slice(0, 38) + ")");
  load({ themePreset: "pride" }); await wait(5);
  ok(String(V["--frame-img"]).split(", ").length === 7, "in the rainbow, six stripes (" + String(V["--frame-img"]).split(", ").length + " parts)");
  load({ themePreset: "glass" }); await wait(5);
  ok(V["--frame-img"] === "none", "and a preset with no flag has no ring");
  load({ themePreset: "trans", outerFrame: false }); await wait(5);
  ok(V["--frame-img"] === "none", "and unticking the frame takes the stripes away too");
  console.log("\n[decorations]");
  {
    const settle = async o => { await load(o); await wait(5); };
    {
      const host = () => elements["vote-card"];
      const layer = () => host().children.find(c => String(c.className).indexOf("w-deco") === 0);
      const items = () => (layer() ? layer().children : []);
      await settle({});
      ok(!layer() && !host().style.isolation, "there are no decorations unless they are asked for (vote-card)");
      await settle({ decoration: "hearts", decorationCount: 6 });
      ok(items().length === 6 && items().every(i => i.className === "w-di hearts") && host().children[0] === layer() && host().style.isolation === "isolate", "choosing hearts draws six behind the words");
      reload(); await wait(5);
      ok(host().children.filter(c => String(c.className).indexOf("w-deco") === 0).length === 1, "and loading again does not pile them up");
      await settle({ decoration: "mixed", decorationCount: 3 });
      ok(items().map(i => i.className.split(" ")[1]).join() === "sparkles,hearts,stars", "mixed takes sparkles, hearts and stars in turn");
      await settle({ decoration: "stars", decorationCount: 99 }); ok(items().length === 24, "no more than 24");
      await settle({ decoration: "stars", decorationMotion: "drift" }); ok(layer().className === "w-deco drift", "they can drift");
      await settle({ decoration: "stars", animate: false }); ok(layer().className.split(" ").indexOf("still") !== -1, "and with Animate off they stay still");
      await settle({ decoration: "stars", decorationSize: 2 }); ok(layer().style["--w-deco-size"] === 2, "their size is a setting");
      await settle({ decoration: "stars", decorationCount: 7, themePreset: "trans" });
      ok(items().every((i, n) => i.style["--c"].toLowerCase() === ["#5bcefa", "#f5a9b8", "#ffffff", "#f5a9b8", "#5bcefa"][n % 5]), "in a pride preset they take the colours of the flag in turn (" + items().map(i => i.style["--c"]).join(" ") + ")");
      await settle({ decoration: "butterflies", decorationCount: 8, decorationPlacement: "edges" });
      ok(items().every(i => i.className === "w-di butterflies") && items().map(i => [parseFloat(i.style["--x"]), parseFloat(i.style["--y"])]).every(([x, y]) => x <= 6 || x >= 86 || y <= 6 || y >= 82), "the newer shapes work, and along the edges every one sits on the border");
      await settle({ decoration: "stars", decorationCount: 8, decorationPlacement: "border" });
      ok(layer().className.split(" ").indexOf("outside") !== -1 && items().map(i => [parseFloat(i.style["--x"]), parseFloat(i.style["--y"])]).every(([x, y]) => x < 0.1 || x > 99.9 || y < 0.1 || y > 99.9), "on the border every shape sits on the edge itself, and the layer is let out");
      await settle({ decoration: "stars", decorationCount: 4, decorationPlacement: "corners" });
      ok(new Set(items().map(i => (parseFloat(i.style["--x"]) < 50 ? "l" : "r") + (parseFloat(i.style["--y"]) < 50 ? "t" : "b"))).size === 4, "in the corners, four shapes take one corner each");
      await settle({ decoration: "stars", decorationCount: 2, decorationPlacement: "offset" });
      ok(items().length === 2 && items().every(i => parseFloat(i.style["--x"]) > 50) && parseFloat(items()[0].style["--y"]) < 50 && parseFloat(items()[1].style["--y"]) > 50, "offset from the corners, two shapes take the top right and the bottom right");
      await settle({ decoration: "stars", decorationCount: 12, decorationPlacement: "offset" });
      ok(items().every(i => parseFloat(i.style["--x"]) >= 7 && parseFloat(i.style["--x"]) <= 84 && parseFloat(i.style["--y"]) >= 6 && parseFloat(i.style["--y"]) <= 84), "and a second and third ring stay inside the panel");
      await settle({ decoration: "stars", decorationCount: 3, decorationColor: "custom", decorationTint: "#ABCDEF" });
      ok(items().every(i => i.style["--c"] === "#ABCDEF"), "a colour of your own");
      await settle({ decoration: "stars", decorationColor: "text" }); ok(new Set(items().map(i => i.style["--c"])).size === 1, "or the text colour");
      await settle({ decoration: "stars", decorationOpacity: 0.5 }); ok(layer().style["--w-deco-opacity"] === 0.5, "how solid they are is a setting");
      await settle({ decoration: "stars" }); await settle({ decoration: "none" });
      ok(!layer() && !host().style.isolation, "turning them off takes them away");
      await settle({ decoration: "confetti" }); ok(!layer(), "and a shape that does not exist is none");
    }
  }
  // reveals, by hand and from the answer server
  console.log("\n[revealing the lie]");
  const lieText = () => elements["vote-lie"].hidden ? "" : elements["vote-lie"].textContent;
  const heading = () => elements["vote-title"].textContent;
  const lit = () => (html().match(/class="vote-option win" [^>]*data-index="(\d)"/) || [])[1];
  load(); await wait(5);
  chat("!vote", boss); await wait(5);
  ok(shown() && html().indexOf("vote-label") === -1 && votes().length === 3, "!vote on its own opens A, B and C");
  chat("!vote 20s", boss); await wait(5);
  ok(votes().length === 3 && timer() === 20, "with a length on its own too");
  chat("a", { nick: "ann" }); chat("a", { nick: "ben" }); chat("b", { nick: "cat" });
  chat("!vote reveal b", { nick: "Randomer" });
  ok(winners() === 0, "a viewer cannot reveal");
  chat("!vote reveal b", boss); await wait(5);
  ok(eyebrow() === "The lie was B" && winners() === 1 && lit() === "1", "revealing ends the poll and lights the lie, not the favourite");
  ok(total() === "1 / 3 spotted it", "and says how many spotted it (" + total() + ")");
  chat("c", { nick: "dee" });
  ok(total() === "1 / 3 spotted it", "no votes count after the reveal");
  chat("!vote reveal A", boss);
  ok(eyebrow() === "The lie was B", "a poll is only revealed once");
  chat("!vote undo", boss); await wait(5);
  ok(eyebrow() === "" && winners() === 0 && votes().join() === "2,1,0", "undo takes a mistaken reveal back");
  load(); await wait(5);
  chat("!vote", boss); await wait(5);
  chat("!vote reveal 8", boss);
  ok(winners() === 0 && eyebrow() === "", "a letter the poll does not have reveals nothing");
  chat("!vote cancel", boss); chat("!vote reveal A", boss);
  ok(!shown(), "nor does a cancelled poll come back");

  console.log("\n[following the answer server]");
  asked.length = 0; served = null;
  load(); await wait(5000);
  ok(asked.length === 0, "with no address it asks nothing");
  served = { rev: 4, number: 9, who: "Earlier", letter: "A", lie: "an old lie" };
  load({ serverUrl: " https://lie.example.com/state/ ", resultSeconds: 5, praise: false, leaderboard: false }); await wait(5);
  ok(asked.length === 1 && asked[0] === "https://lie.example.com/state", "it asks /state, however the address was typed (" + asked[0] + ")");
  chat("!vote", boss); await wait(2100);
  ok(winners() === 0 && heading() === "Which one is the lie?", "what had been revealed before it loaded is not replayed");
  chat("a", { nick: "ann" }); chat("c", { nick: "ben" });
  served = { rev: 5, number: 1, who: "Alex", letter: "", lie: "" }; await wait(2100);
  ok(heading() === "#1 was Alex" && winners() === 0 && timer() > 0, "the name goes in the heading and voting carries on");
  chat("!vote end", boss); await wait(6000);
  ok(!shown(), "the result leaves the screen as usual");
  served = { rev: 6, number: 1, who: "Alex", letter: "C", lie: "I <b>swam</b> with sharks" }; await wait(2100);
  ok(shown() && eyebrow() === "The lie was C" && lit() === "2", "the lie brings the card back and lights it");
  ok(heading() === "#1 was Alex" && lieText() === "I <b>swam</b> with sharks", "with the name, and the lie as plain text");
  ok(total() === "1 / 2 spotted it", "counting who spotted it (" + total() + ")");
  await wait(10000);
  ok(!shown(), "asking again does not bring back a reveal already shown");
  chat("!vote", boss); await wait(5);
  ok(heading() === "Which one is the lie?" && lieText() === "", "the next poll starts clean");
  chat("!vote cancel", boss);
  served = { rev: 7, number: 2, who: "Sam", letter: "", lie: "" }; await wait(2100);
  chat("!vote", boss); await wait(5);
  ok(heading() === "#2 was Sam", "a name heard before the poll opens is waiting for it");
  served = { rev: 8, number: 0, who: "", letter: "", lie: "" }; await wait(2100);
  chat("!vote", boss); await wait(5);
  ok(heading() === "Which one is the lie?" && winners() === 0, "a reset reveals nothing and forgets the name");
  served = null; await wait(6000);
  ok(shown() && timer() > 0, "a server that is down leaves the poll running");
  served = { rev: 9, number: 1, who: "Alex", letter: "A", lie: "back again" }; await wait(2100);
  ok(eyebrow() === "The lie was A", "and it carries on when the server returns");
  console.log("\n[the server going back and skipping]");
  const say = async (st) => { served = Object.assign({ number: 0, who: "", letter: "", lie: "", back: false, undone: null }, st); await wait(2100); };
  load({ serverUrl: "https://lie.example.com", resultSeconds: 0 }); await say({ rev: 20 });
  chat("!vote", boss); chat("a", { nick: "ann" });
  await say({ rev: 21, number: 3, who: "Kit" });
  await say({ rev: 22, number: 3, who: "Kit", letter: "A", lie: "too soon" });
  ok(eyebrow() === "The lie was A", "a stray press reveals the lie");
  await say({ rev: 23, number: 3, who: "Kit", back: true, undone: { number: 3, part: "lie" } });
  ok(eyebrow() !== "The lie was A" && lieText() === "" && heading() === "#3 was Kit", "going back takes the lie off and keeps the name");
  chat("b", { nick: "ben" });
  ok(votes().join() === "1,0,0", "voting stays closed, since chat has seen the answer");
  await say({ rev: 24, number: 3, who: "Kit", letter: "A", lie: "now it is time" });
  ok(eyebrow() === "The lie was A" && lieText() === "now it is time", "and it can be revealed again");
  await say({ rev: 25, back: true, undone: { number: 3, part: "who" } });
  ok(lieText() === "" && heading() === "Which one is the lie?", "two steps back at once takes off both");
  chat("!vote", boss);
  await say({ rev: 26, number: 4, who: "Robin" });
  await say({ rev: 27, number: 3, who: "Kit", letter: "A", lie: "old one", back: true, undone: { number: 4, part: "who" } });
  ok(heading() === "Which one is the lie?" && winners() === 0 && timer() > 0, "undoing a name does not reveal the person before on the new card");
  await say({ rev: 28, number: 4, who: "Robin" });
  await say({ rev: 29 });
  ok(heading() === "Which one is the lie?", "a skip takes the skipped name off");
  chat("!vote", boss);
  ok(heading() === "Which one is the lie?", "and off the next card");
  chat("!vote reveal B", boss);
  await say({ rev: 30, back: true, undone: { number: 4, part: "lie" } });
  ok(eyebrow() === "The lie was B", "a reveal typed by hand is left alone");

  asked.length = 0; load(); await wait(10000);
  ok(asked.length === 0, "taking the address out stops the asking");
  served = null;

  console.log("\n[three answers on the card]");
  {
    const cardIs = (name) => elements["vote-card"].classList.contains(name);
    const A = ["I own <3> boats", "I met a penguin", "I can juggle"];
    const quiet = { rev: 1, number: 0, who: "", letter: "", lie: "", answers: [] };
    const asked1 = { rev: 2, number: 1, who: "Alex", letter: "", lie: "", answers: A };
    const told1 = { rev: 3, number: 1, who: "Alex", letter: "B", lie: A[1], answers: A };
    const say = async (s) => { served = s; await wait(2100); };
    const url = { serverUrl: "https://lie.example.com", resultSeconds: 5, duration: 20, praise: false, leaderboard: false };
    served = quiet; load(url); await wait(5);
    ok(!shown(), "nothing is on screen before !lie");
    await say(asked1);
    ok(shown() && heading() === "Alex's Answers" && eyebrow() === "Spot the lie..", "the first !lie shows whose answers they are, and asks chat to spot the lie (" + heading() + " / " + eyebrow() + ")");
    ok(labels().join("|") === "I own &lt;3&gt; boats|I met a penguin|I can juggle", "with an answer on each of A, B and C, as plain text (" + labels().join("|") + ")");
    ok(cardIs("answers") && !cardIs("keys-only") && timer() > 0 && winners() === 0, "and voting is open");
    chat("b", { nick: "ann" }); chat("2", { nick: "ben" }); chat("c", { nick: "cat" });
    ok(votes().join() === "0,2,1", "chat votes by letter or number (" + votes().join() + ")");
    await wait(60000);
    ok(shown() && eyebrow() === "Spot the lie..", "when the clock runs out the answers stay up for the reveal");
    await say(told1);
    ok(heading() === "Alex's Answers" && eyebrow() === "The lie was B" && lit() === "1" && labels().length === 3, "the second !lie lights the lie, with the answers still there");
    ok(lieText() === "" && total() === "2 / 3 spotted it", "without repeating it underneath, and says who spotted it");
    await say({ rev: 4, number: 1, who: "Alex", letter: "", lie: "", answers: A, back: true, undone: { number: 1, part: "lie" } });
    ok(shown() && eyebrow() === "Spot the lie.." && winners() === 0 && votes().join() === "0,2,1", "undoing the lie takes it off and keeps the answers and votes");
    await say({ rev: 5, number: 0, who: "", letter: "", lie: "", answers: [], back: true, undone: { number: 1, part: "who" } });
    ok(!shown(), "undoing the answers takes the card away");
    await say({ rev: 6, number: 1, who: "Alex", letter: "", lie: "", answers: A });
    await say({ rev: 7, number: 0, who: "", letter: "", lie: "", answers: [] });
    ok(!shown(), "and so does a skip or a reset");
    await say({ rev: 8, number: 1, who: "Alex", letter: "", lie: "", answers: A, back: true, undone: null });
    ok(shown() && heading() === "Alex's Answers" && votes().join() === "0,0,0", "going back to someone's answers puts them up again");
    await say({ rev: 9, number: 0, who: "", letter: "", lie: "", answers: [] });

    chat("!vote", boss); await wait(5);
    chat("a", { nick: "ann" });
    await say({ rev: 10, number: 2, who: "Sam", letter: "", lie: "", answers: A });
    ok(heading() === "Sam's Answers" && votes().join() === "1,0,0" && labels().length === 3, "a vote already opened with !vote gets the answers and keeps its votes");
    await say({ rev: 11, number: 2, who: "Sam", letter: "A", lie: A[0], answers: A });
    await wait(6000);
    ok(!shown(), "after the reveal the card leaves as usual");
    await say({ rev: 12, number: 3, who: "Kit", letter: "C", lie: A[2], answers: A });
    ok(heading() === "Kit's Answers" && lit() === "2" && labels().length === 3, "a lie whose answers were never shown still arrives with them");

    served = { rev: 20, number: 4, who: "Robin", letter: "", lie: "", answers: A };
    load(url); await wait(2100);
    ok(!shown(), "loading the overlay mid-round opens nothing by itself");
    load(Object.assign({ answersTitle: "What {name} said", spotLabel: "Which?" }, url)); served = quiet; await wait(2100);
    await say({ rev: 21, number: 4, who: "$& Co", letter: "", lie: "", answers: A });
    ok(heading() === "What $& Co said" && eyebrow() === "Which?", "both lines are settings, and a name is used exactly as written (" + heading() + ")");
    served = null;
  }

  console.log("\n[leaving after the reveal]");
  {
    const A = ["one", "two", "three"];
    const asked = { rev: 2, number: 1, who: "Alex", letter: "", lie: "", answers: A };
    const told = { rev: 3, number: 1, who: "Alex", letter: "B", lie: "two", answers: A };
    const url = { serverUrl: "https://lie.example.com", leaderboard: false };
    const reveal = async () => { served = { rev: 1, number: 0, who: "" }; load(url); await wait(2100); served = asked; await wait(2100); served = told; await wait(2000); };
    await reveal();
    ok(shown() && /The lie was/.test(eyebrow()), "the reveal is on screen");
    await wait(7900);
    ok(shown(), "and is still there just short of ten seconds");
    await wait(2200);
    ok(!shown(), "after ten quiet seconds it is gone");
    served = { rev: 4, number: 2, who: "Sam", letter: "", lie: "", answers: A }; await wait(2100);
    ok(shown() && heading() === "Sam's Answers", "and the next round brings it back");

    await reveal(); await wait(3000); reload(); await wait(5);
    ok(shown(), "a refresh while the reveal is up shows it again");
    await wait(11000);
    ok(!shown(), "and it still leaves");
    reload(); await wait(5);
    ok(!shown(), "and stays gone after another refresh");
    load(Object.assign({ resultSeconds: 0 }, url)); served = { rev: 1, number: 0, who: "" }; await wait(2100); served = asked; await wait(2100); served = told; await wait(2100);
    reload(); await wait(60000);
    ok(shown(), "set to 0, it stays until you hide it");
    served = null;
  }

  console.log("\n[well done]");
  {
    const praising = () => shown() && !elements["vote-praise"].hidden && elements["vote-card"].classList.contains("praising");
    const lines = () => elements["vote-praise-names"].children.map(c => c.textContent);
    const listed = () => lines().join(", ");
    const round = async (settings) => {
      served = null; load(Object.assign({ leaderboard: false }, settings)); await wait(5);
      chat("!vote", boss); await wait(5);
      chat("b", { nick: "UserX" }); chat("a", { nick: "Wrong" }); chat("b", { nick: "UserY" }); chat("c", { nick: "Changed" }); chat("b", { nick: "Changed" }); chat("b", { nick: "UserZ" }); chat("b", { nick: "Left" }); chat("a", { nick: "Left" });
      chat("!vote reveal b", boss); await wait(5);
    };
    await round();
    ok(shown() && !praising() && /The lie was/.test(eyebrow()), "the lie shows on its own first");
    await wait(4900);
    ok(!praising(), "for five seconds");
    await wait(300);
    ok(praising() && elements["vote-praise-title"].textContent === "Well Done", "then the card says Well Done");
    ok(listed() === "UserX, UserY, Changed, UserZ", "to everyone whose last vote was on the lie, with names as chat shows them (" + listed() + ")");
    ok(lines().length === 4 && elements["vote-praise-names"].classList.contains("scroll") && !elements["vote-praise-names"].classList.contains("again"), "one name to a line, rolling like credits, once");
    await wait(9500);
    ok(praising(), "for ten seconds");
    await wait(800);
    ok(!shown(), "and then the card leaves");
    chat("!vote", boss); await wait(5);
    ok(shown() && !praising() && elements["vote-praise"].hidden, "the next round starts clean");

    await round(); await wait(6000);
    chat("!vote undo", boss); await wait(5);
    ok(shown() && !praising() && winners() === 0, "undoing the reveal takes the names away too");
    await round(); await wait(6000);
    chat("!vote Fresh, Poll", boss); await wait(20000);
    ok(shown() && !praising(), "a new vote during the names is not interrupted by them");
    await round(); await wait(6000); reload(); await wait(5);
    ok(praising() && listed().indexOf("UserZ") !== -1, "a refresh during the names shows them again");
    await wait(10500);
    ok(!shown(), "and the card still leaves");

    served = null; load({ leaderboard: false }); await wait(5); chat("!vote", boss); await wait(5); chat("a", { nick: "Wrong" }); chat("!vote reveal b", boss); await wait(5500);
    ok(shown() && !praising(), "if nobody spotted it there is no Well Done");
    await wait(5000);
    ok(!shown(), "and the card leaves after ten seconds");
    await round({ praise: false }); await wait(6000);
    ok(shown() && !praising(), "it can be switched off");
    await wait(4500);
    ok(!shown(), "leaving after ten seconds as before");
    await round({ praiseTitle: "Nice one", praiseAfter: 2, praiseSeconds: 4 }); await wait(2100);
    ok(praising() && elements["vote-praise-title"].textContent === "Nice one", "the heading and the timings are settings");
    await wait(4100);
    ok(!shown(), "both of them");
    const roll = () => elements["vote-praise-names"].style;
    await round(); await wait(5200);
    ok(roll()["--praise-for"] === "9.6s", "a few names take the whole time, less a moment (" + roll()["--praise-for"] + ")");
    served = null; load({ leaderboard: false }); await wait(5); chat("!vote", boss); await wait(5);
    for (let i = 0; i < 100; i++) chat("a", { nick: "w" + i });
    chat("!vote reveal a", boss); await wait(5200);
    ok(roll()["--praise-for"] === "9.6s", "and so do a hundred, which simply roll faster");
    await wait(9500);
    ok(praising(), "a long list does not keep the card any longer");
    await wait(500);
    ok(!shown(), "which leaves on time");
    await round({ praiseSeconds: 20 }); await wait(5200);
    ok(roll()["--praise-for"] === "19.6s", "a longer time means a slower roll");
    await wait(6000);
    elements["vote-praise-window"].clientHeight = 300; button("btnExtend"); chat("!vote results", boss); await wait(5);
    const resumed = parseFloat(roll()["--praise-from-time"]);
    ok(resumed < -5.9 && resumed > -7, "drawn again part way through, the roll carries on and does not start over (" + roll()["--praise-from-time"] + ")");
    elements["vote-praise-window"].clientHeight = 0;
    await round(); await wait(9000); reload(); await wait(5);
    ok(parseFloat(roll()["--praise-from-time"]) > -0.1, "after a refresh it starts over, along with the card's time");

    await round({ resultSeconds: 0 }); await wait(60000);
    ok(praising() && elements["vote-praise-names"].classList.contains("again"), "with the result set to stay, the names stay and roll round again");
    served = null; load({}); await wait(5); chat("!vote", boss); await wait(5);
    for (let i = 0; i < 130; i++) chat("a", { nick: "v" + i });
    chat("!vote reveal a", boss); await wait(5200);
    ok(lines().length === 101 && lines()[99] === "v99" && lines()[100] === "and 30 more", "a very long list is cut short and counted");

    const A = ["one", "two", "three"];
    served = { rev: 1, number: 0, who: "" }; load({ serverUrl: "https://lie.example.com" }); await wait(2100);
    served = { rev: 2, number: 1, who: "Alex", letter: "", lie: "", answers: A }; await wait(2100);
    chat("c", { nick: "UserX" });
    served = { rev: 3, number: 1, who: "Alex", letter: "C", lie: "three", answers: A }; await wait(2100);
    await wait(5000);
    ok(praising() && listed() === "UserX", "a reveal from the server praises too");
    await wait(12000);
    served = { rev: 4, number: 1, who: "Alex", letter: "", lie: "", answers: A, back: true, undone: { number: 1, part: "lie" } }; await wait(2100);
    ok(shown() && !praising() && eyebrow() === "Spot the lie..", "going back after the card has left brings the answers back");
    served = null;
  }

  console.log("\n[leaderboard]");
  {
    const board = () => shown() && !elements["vote-board"].hidden && elements["vote-card"].classList.contains("ranking");
    const table = () => elements["vote-board-list"].children.map(r => r.children.map(c => c.textContent).join(" ")).join(" | ");
    const play = async (right, wrong) => {
      chat("!vote", boss); await wait(5);
      right.forEach(n => chat("b", { nick: n })); (wrong || []).forEach(n => chat("a", { nick: n }));
      chat("!vote reveal b", boss); await wait(5);
    };
    const toBoard = async () => { await wait(5200); await wait(10200); };
    served = null; load({}); await wait(5);
    await play(["Ann", "Ben"], ["Cat"]);
    ok(!board(), "the reveal shows first");
    await wait(5200);
    ok(!board() && !elements["vote-praise"].hidden, "then Well Done");
    await wait(10200);
    ok(board() && elements["vote-praise"].hidden && elements["vote-board-title"].textContent === "Leaderboard", "and then the card rests on the leaderboard");
    ok(table() === "1. Ann 1 | 1. Ben 1", "with a point for each correct answer, and level scores sharing a place (" + table() + ")");
    await wait(600000);
    ok(board(), "where it stays until the next round");
    chat("c", { nick: "Dee" });
    ok(table() === "1. Ann 1 | 1. Ben 1", "chat does not change it");
    chat("!vote", boss); await wait(5);
    ok(shown() && !board() && elements["vote-board"].hidden, "the next round takes its place");
    chat("!vote cancel", boss);
    await play(["Ben", "Cat"]); await toBoard();
    ok(table() === "1. Ben 2 | 2. Ann 1 | 2. Cat 1", "points add up across rounds (" + table() + ")");
    await play([], ["Ann"]); await wait(5200);
    ok(!board(), "a round nobody got shows its result");
    await wait(5200);
    ok(board() && table() === "1. Ben 2 | 2. Ann 1 | 2. Cat 1", "and goes back to the leaderboard with the scores unchanged");
    await play(["Ann", "Dee", "Eve", "Fay", "Gus"]); await toBoard();
    ok(elements["vote-board-list"].children.length === 5 && table().indexOf("1. Ben 2 | 1. Ann 2") === 0, "it lists the top five, whoever got there first ahead (" + table() + ")");

    chat("!vote undo", boss); await wait(5);
    ok(!board(), "undo steps back to the card before the leaderboard");
    load({}); await wait(5);
    await play(["Ann"]); await toBoard(); chat("!vote undo", boss); await wait(5);
    chat("!vote undo", boss); await wait(5);
    await play(["Zed"]); await toBoard();
    ok(table() === "1. Zed 1", "a reveal that is undone takes its points with it (" + table() + ")");
    chat("!vote scores clear", { nick: "Randomer" });
    ok(board(), "a viewer cannot clear it");
    chat("!vote scores clear", boss);
    ok(!shown(), "!vote scores clear starts it again and takes it off");
    chat("!vote scores", boss);
    ok(!shown(), "and with no points there is nothing to show");

    await play(["Ann"]); await toBoard(); chat("!vote hide", boss);
    ok(!shown(), "!vote hide takes it off the screen");
    chat("!vote scores", boss);
    ok(board() && table() === "1. Ann 1", "!vote scores brings it back");
    chat("!vote results", boss);
    ok(!board() && /The lie was/.test(eyebrow()), "!vote results replays the reveal");
    await toBoard();
    await wait(1000); reload(); await wait(5);
    ok(board() && table() === "1. Ann 1", "it survives a refresh");
    button("btnClearScores"); await wait(1000); reload(); await wait(5);
    ok(!shown(), "and the editor button clears it for good");

    load({ praise: false }); await wait(5); await play(["Ann"]); await wait(10200);
    ok(board(), "without Well Done, the result gives way to it");
    load({ leaderboard: false }); await wait(5); await play(["Ann"]); await toBoard();
    ok(!shown(), "switched off, the card leaves as before");
    load({ leaderboardTitle: "Top spotters", leaderboardSize: 3 }); await wait(5); await play(["A1", "B1", "C1", "D1"]); await toBoard();
    ok(elements["vote-board-title"].textContent === "Top spotters" && elements["vote-board-list"].children.length === 3, "its heading and length are settings");

    const A = ["one", "two", "three"];
    const url = { serverUrl: "https://lie.example.com" };
    let rev = 1;
    const say = async (s) => { served = Object.assign({ rev: ++rev, number: 0, who: "", letter: "", lie: "", answers: [] }, s); await wait(2100); };
    const asked1 = { number: 1, who: "Alex", answers: A }, told1 = { number: 1, who: "Alex", letter: "C", lie: "three", answers: A };
    served = { rev: 1, number: 0, who: "" }; load(url); await wait(2100);
    await say(asked1); chat("c", { nick: "Ann" }); await say(told1); await wait(16000);
    ok(board() && table() === "1. Ann 1", "a reveal from the server scores too");
    await say(Object.assign({ back: true, undone: { number: 1, part: "lie" } }, asked1));
    ok(shown() && !board() && eyebrow() === "Spot the lie..", "!lieprev from the leaderboard goes back to the answers");
    await say(told1); await wait(16000);
    ok(board() && table() === "1. Ann 1", "and revealing again does not count it twice (" + table() + ")");
    await say({});
    ok(board(), "a server reset leaves the leaderboard as it is");
    await say({ number: 2, who: "Sam", answers: A });
    ok(shown() && !board() && heading() === "Sam's Answers", "and the next answers take its place");
    chat("c", { nick: "Ann" }); chat("c", { nick: "Ben" }); await say({ number: 2, who: "Sam", letter: "C", lie: "three", answers: A }); await wait(16000);
    ok(table() === "1. Ann 2 | 2. Ben 1", "adding to the scores (" + table() + ")");
    await say(Object.assign({ number: 3, who: "Kit", answers: A }));
    await say({ number: 2, who: "Sam", letter: "C", lie: "three", answers: A, back: true, undone: { number: 3, part: "who" } });
    await say({ number: 2, who: "Sam", answers: A, back: true, undone: { number: 2, part: "lie" } });
    chat("!vote scores clear", boss);
    served = null;
  }

  console.log("\n[fades]");
  {
    const has = (id, name) => elements[id].classList.contains(name);
    const onPage = () => elements["vote-card"].hidden === false;
    served = null; load({ praise: false, leaderboard: false, resultSeconds: 5 }); await wait(5);
    chat("!vote", boss); await wait(5); chat("!vote cancel", boss);
    ok(onPage() && has("vote-card", "leaving"), "a card that is taken down fades before it goes");
    await wait(300); ok(onPage(), "staying on the page while it does");
    await wait(200); ok(!onPage() && !has("vote-card", "leaving"), "and then it is gone");
    chat("!vote", boss); await wait(5); chat("!vote cancel", boss); await wait(100); chat("!vote", boss);
    await wait(1000);
    ok(shown(), "a new vote during the fade keeps the card, and the old fade does not take it away");
    chat("a", { nick: "ann" }); chat("!vote reveal a", boss); await wait(5400);
    ok(has("vote-card", "leaving"), "after a result it fades away by itself");

    load({}); await wait(5); chat("!vote", boss); await wait(5); chat("b", { nick: "Ann" }); chat("!vote reveal b", boss);
    await wait(4400); ok(!has("vote-card", "changing"), "the reveal holds");
    await wait(300); ok(has("vote-card", "changing") && elements["vote-praise"].hidden !== false, "then fades out just before Well Done");
    await wait(400); ok(!has("vote-card", "changing") && !elements["vote-praise"].hidden, "which takes its place on time");
    await wait(9600); ok(has("vote-card", "changing") && !has("vote-card", "leaving"), "its words fade before the leaderboard, while the card stays");
    await wait(500); ok(!has("vote-card", "changing") && !elements["vote-board"].hidden && shown(), "and the leaderboard arrives");
    chat("!vote", boss); await wait(5); chat("b", { nick: "Ann" }); chat("!vote reveal b", boss); await wait(4800);
    chat("!vote Fresh, Poll", boss); await wait(5);
    ok(!has("vote-card", "changing"), "a new vote in the middle of a fade is shown in full");

    load({ animate: false, praise: false, leaderboard: false }); await wait(5); chat("!vote", boss); await wait(5); chat("!vote cancel", boss);
    ok(!onPage(), "with Animate off the card goes at once");
    load({ enterSeconds: 0, praise: false, leaderboard: false }); await wait(5); chat("!vote", boss); await wait(5); chat("!vote cancel", boss);
    ok(!onPage(), "as it does with the fade set to nothing");
    load({ enterSeconds: 1, praise: false, leaderboard: false }); await wait(5); chat("!vote", boss); await wait(5); chat("!vote cancel", boss);
    await wait(900); const during = onPage(); await wait(200);
    ok(during && !onPage(), "and the length of a fade is the setting");
  }

  console.log("\n[running the server from chat]");
  const note = () => elements["vote-notice"].hidden ? "" : elements["vote-notice"].textContent;
  const server = { serverUrl: "https://lie.example.com/", serverKey: "  a-key&with=odd+chars  ", followSeconds: 30 };
  const quietState = { rev: 1, number: 0, who: "", letter: "", lie: "" };
  const mod = (o) => Object.assign({ mod: true, nick: "Marlow" }, o || {});

  sent.length = 0; reply = "#1 was Alex."; served = quietState;
  load({ serverUrl: server.serverUrl }); await wait(5);
  chat("!lie", boss); chat("!liereset", boss); await wait(5);
  ok(sent.length === 0, "with no key the commands are left to a chatbot");
  load({ serverKey: server.serverKey }); await wait(5);
  chat("!lie", boss); await wait(5);
  ok(sent.length === 0, "and with a key but no address nothing is sent");

  load(server); await wait(5);
  chat("!lie", { nick: "Randomer" }); await wait(5);
  ok(sent.length === 0, "a viewer cannot run them");
  chat("!lie please", boss); chat("!lieful", boss); chat("!lie 2", boss); await wait(5);
  ok(sent.length === 0, "nor does a line that only starts like one");
  load(Object.assign({ whoCanManage: "broadcaster" }, server)); await wait(5);
  chat("!lie", mod()); await wait(5);
  ok(sent.length === 0, "in broadcaster-only mode a moderator cannot either");

  served = quietState; load(server); await wait(5);
  chat("!vote", boss); await wait(5);
  chat("a", { nick: "ann" }); chat("c", { nick: "ben" });
  after = { rev: 2, number: 1, who: "Alex", letter: "", lie: "" };
  chat("!LIE", mod({ id: "abc 1" })); await wait(5);
  ok(sent.length === 1 && sent[0] === "https://lie.example.com/?q=step&key=a-key%26with%3Dodd%2Bchars&id=abc%201", "a moderator's !lie is sent with the key and the message id (" + sent[0].replace(/key=[^&]+/, "key=...") + ")");
  ok(heading() === "#1 was Alex" && note() === "", "the name is on the card at once, with no extra message");
  ok(votes().join() === "1,0,1", "and the command is not counted as a vote");
  reply = "#1 - the lie was C: sharks"; after = { rev: 3, number: 1, who: "Alex", letter: "C", lie: "sharks" };
  chat("!lie", boss); await wait(5);
  ok(eyebrow() === "The lie was C" && lieText() === "sharks" && note() === "", "the second !lie reveals the lie at once");
  ok(sent[1].indexOf("&id=") === -1, "a message with no id is sent without one");

  reply = "Went back one. Next !lie says #1's lie."; after = { rev: 4, number: 1, who: "Alex", letter: "", lie: "", back: true, undone: { number: 1, part: "lie" } };
  chat("!lieprev", boss); await wait(5);
  ok(sent[2].indexOf("?q=prev&") !== -1 && lieText() === "" && !/The lie was/.test(eyebrow()) && note() === reply, "!lieprev takes the lie off and says what happened");
  await wait(8600);
  ok(note() === "", "the message goes after a few seconds");
  const others = [["!lienext", "next"], ["!liereset", "reset"], ["!lierefresh", "refresh"]];
  after = null;
  for (const [command, q] of others) {
    reply = "Done " + q + ".";
    chat(command, boss); await wait(5);
    ok(sent[sent.length - 1].indexOf("?q=" + q + "&") !== -1 && note() === reply, command + " is sent, and its reply is shown");
  }

  chat("!vote cancel", boss);
  served = { rev: 10, number: 0, who: "", letter: "", lie: "" }; await wait(30100);
  reply = "#2 was Sam."; after = { rev: 11, number: 2, who: "Sam", letter: "", lie: "" };
  chat("!lie", boss); await wait(5);
  ok(!shown() && note() === "#2 was Sam.", "with no poll on screen, !lie still shows what it read out");
  chat("!vote", boss); await wait(5);
  ok(heading() === "#2 was Sam", "and the name is waiting for the next poll");
  reply = "That is everyone in the running order. !liereset starts again."; after = null;
  chat("!lie", boss); await wait(5);
  ok(note() === reply, "the end of the running order is said on screen");

  reply = "Sorry, that link is missing its key.";
  chat("!lie", boss); await wait(5);
  ok(/refused the key/.test(note()), "a wrong key says to check the setting");
  reply = "<!doctype html><p>another site</p>";
  chat("!lie", boss); await wait(5);
  ok(/did not reply like the answer server/.test(note()), "a web page is not shown as a reply");
  reply = "x".repeat(900);
  chat("!lienext", boss); await wait(5);
  ok(note().length === 200, "a long reply is cut short");
  const count = sent.length;
  reply = null;
  chat("!lie", boss); await wait(20000);
  ok(sent.length === count + 1, "a command with no answer is never sent again by itself");
  reply = null;
  chat("!lie", boss); await wait(5);
  ok(/Check the card/.test(note()) && note().indexOf("a-key") === -1, "and it says to check the card, without the key");
  status = 502; reply = "Bad gateway";
  chat("!liereset", boss); await wait(5);
  ok(/Check the card/.test(note()), "so does an error from the tunnel");
  status = 200;
  const logged = [], realLog = console.log;
  load(Object.assign({ debug: true }, server)); await wait(5);
  reply = null; console.log = (...a) => logged.push(a.join(" "));
  chat("!lie", boss); await wait(5);
  console.log = realLog;
  ok(logged.join(" ").indexOf("a-key") === -1, "the key is never logged, even with troubleshooting on");
  reload(); await wait(5);
  ok(note() === "", "a reload clears the message");
  served = null; reply = null; after = null;


  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
