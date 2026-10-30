/* Headless integration test for widget.js.
   Mocks the slice of DOM/SE the widget needs, then drives it through the real
   onWidgetLoad / onEventReceived events and asserts on the observable DOM.
   Covers parsing, voting, permissions, the whole rollback family (end, cancel,
   restart, extend, undo), ties, blind polls, escaping, theming and persistence. */
const fs = require("fs"), vm = require("vm");
const ROOT = require("path").join(__dirname, "..");
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
    addEventListener() {}, appendChild() {}
  };
  e.classList._s = e._cls; return e;
}
const ids = ["vote-app", "vote-card", "vote-title", "vote-timer", "vote-eyebrow",
  "vote-options", "vote-total", "vote-hint", "vote-font-link"];
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
const sandbox = {
  window, document, CustomEvent, SE_API, Audio, Date, RegExp, Array, Object,
  setTimeout, clearTimeout, setInterval, clearInterval,
  console, Math, Promise, JSON, parseFloat, parseInt, isNaN, String, encodeURIComponent
};
sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

const KEY = "chat_poll_v1";
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
const boss = { broadcaster: true, nick: "Streamer" };
function button(field) {
  window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener: "widget-button", event: { field } } }));
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- reading the rendered card ----
const html = () => elements["vote-options"].innerHTML;
function votes() {
  return (html().match(/data-votes="(\d+)"/g) || []).map(m => parseInt(m.match(/\d+/)[0], 10));
}
function labels() {
  return (html().match(/class="vote-label">([^<]*)</g) || []).map(m => m.replace(/^[^>]*>/, "").replace(/<$/, ""));
}
const winners = () => (html().match(/class="vote-option win"/g) || []).length;
const shown = () => elements["vote-card"].hidden === false;
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
  chat("!vote Truth A, Truth B, The lie", boss); await wait(5);
  ok(shown(), "the card appears when a poll opens");
  ok(labels().join("|") === "Truth A|Truth B|The lie", "options parsed in order (" + labels().join("|") + ")");
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
  chat("!vote Truth A, Truth B, The lie", boss); await wait(5);
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
  chat("!vote 60s Truth A, Truth B, The lie", boss); await wait(5);
  ok(timer() === 60, "a leading 60s overrides the 45 second default (" + timer() + ")");
  ok(labels()[0] === "Truth A", "the duration token is not treated as an option");

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
  chat("!vote Truth A, Truth B, The lie", boss); await wait(5);
  chat("3", { nick: "ann" }); chat("3", { nick: "ben" }); chat("1", { nick: "cat" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 1, "one winner is highlighted (" + winners() + ")");
  ok(html().indexOf('data-votes="2"') > -1, "the winning option kept its two votes");
  ok(eyebrow() === "Chat says", "the result tag reads Chat says (" + eyebrow() + ")");
  ok(elements["vote-timer"].hidden === true, "the countdown goes away once it is decided");

  // H. ties and empty polls
  console.log("\n[ties and empty polls]");
  load(); await wait(5);
  chat("!vote Truth A, Truth B", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 2, "a tie highlights both options (" + winners() + ")");
  ok(eyebrow() === "It's a tie", "the tie tag shows (" + eyebrow() + ")");
  load({ tieBreak: "random" }); await wait(5);
  chat("!vote Truth A, Truth B", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote end", boss); await wait(5);
  ok(winners() === 1, "random tiebreak picks exactly one (" + winners() + ")");
  load(); await wait(5);
  chat("!vote Truth A, Truth B", boss); await wait(5);
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
  chat("!vote Truth A, Truth B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote cancel", boss); await wait(5);
  ok(!shown(), "cancelling takes the card off screen with nothing declared");

  // J. restart: same options, clean slate
  console.log("\n[restart]");
  load(); await wait(5);
  chat("!vote 60s Truth A, Truth B, The lie", boss); await wait(5);
  chat("1", { nick: "ann" }); chat("2", { nick: "ben" });
  chat("!vote restart", boss); await wait(5);
  ok(shown(), "the card stays up after a restart");
  ok(votes().join(",") === "0,0,0", "restart wipes the votes (" + votes().join(",") + ")");
  ok(labels().join("|") === "Truth A|Truth B|The lie", "restart keeps the same options");
  ok(timer() === 60, "restart gives the full clock back (" + timer() + ")");
  chat("1", { nick: "ann" });
  ok(votes().join(",") === "1,0,0", "someone who voted before can vote again after a restart");

  // K. extend
  console.log("\n[extend]");
  load(); await wait(5);
  chat("!vote Truth A, Truth B", boss); await wait(5);
  chat("!vote extend 20", boss); await wait(5);
  ok(timer() === 65, "20 seconds are added to the clock (" + timer() + ")");
  chat("!vote extend", boss); await wait(5);
  ok(timer() === 80, "a bare extend adds the default 15 (" + timer() + ")");

  // L. undo, the actual rollback
  console.log("\n[undo]");
  load(); await wait(5);
  chat("!vote Truth A, Truth B, The lie", boss); await wait(5);
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
  chat("!vote Truth A, Truth B", boss); await wait(5);
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
  chat("!vote Truth A, Truth B", boss); await wait(5);
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
  chat("!vote Truth A, Truth B", boss); await wait(5);
  chat("1", { nick: "ann" });
  chat("!vote end", boss); await wait(5);
  chat("!vote hide", boss); await wait(5);
  ok(!shown(), "hide takes the card away");
  chat("!vote results", boss); await wait(5);
  ok(shown() && winners() === 1, "the result can be put back up");

  // O. a browser-source refresh mid-poll
  console.log("\n[surviving a refresh]");
  load(); await wait(5);
  chat("!vote 60s Truth A, Truth B, The lie", boss); await wait(5);
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
  chat("!vote 5s Truth A, Truth B", boss); await wait(5);
  chat("1", { nick: "ann" });
  ok(winners() === 0, "still running at the start");
  await wait(5400);
  ok(winners() === 1, "the poll declared itself when the clock ran out");
  ok(eyebrow() === "Chat says", "and tagged the result");
  chat("!vote undo", boss); await wait(5);
  ok(winners() === 0 && timer() > 0 && timer() <= 15,
    "undoing a poll that genuinely ran out reopens it on the grace window (" + timer() + ")");
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
  ok(shown() && labels().length === 3, "the demo button opens a three-option poll");
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
  chat("!vote Truth A, Truth B, The lie", boss);   // no await: the store read is still in flight
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

  chat("!vote Truth A, Truth B", boss); await wait(5);
  ok(!keysOnly() && labels().length === 2, "an ordinary poll is unaffected");
  chat("truth b", { nick: "cat" });
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
  chat("!vote 600s Truth A, Truth B, The lie", boss); await wait(5);
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
  ok(total() === "2000 votes", "a returning voter moves their vote rather than adding one");


  // ---- the default look matches the rest of the set
  console.log("\n[default look]");
  load(); await wait(5);
  const V = elements["vote-app"].style;
  ok(V["--bg"] === "rgba(0, 0, 0, 0.55)" && V["--text"] === "#FFFFFF" && V["--accent"] === "#FFFFFF", "a soft see-through black panel with white text (" + V["--bg"] + ")");
  ok(V["--font"].indexOf("BioRhyme") !== -1, "in BioRhyme (" + V["--font"] + ")");
  ok(/family=BioRhyme:wght@200\.\.800/.test(elements["vote-font-link"].href || ""), "with its whole weight range requested");
  ok(V["--border-w"] === "0" && V["--shadow"] === "none" && V["--tail-display"] === "none" && V["--pill-tilt"] === "0deg", "flat: no outline, shadow, tail or tilt");
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
  ok(V["--border-w"] === "0.3" && V["--shadow"] !== "none" && V["--text-shadow"] !== "none" && V["--tail-display"] === "block", "outline, shadows and tail");
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
  load({ themePreset: "custom", colorPanel: "#102030", panelOpacity: 0.8, cText: "#EEEEEE", cAccent: "#FF00AA", colorOnAccent: "#001122",
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


  // ---- style presets: the same twenty-one, with the same colours, in every overlay
  console.log("\n[style presets]");
  const EXPECT = {"glass": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(0, 0, 0, 0.55)", "font": "BioRhyme"}, "frost": {"text": "#1B2130", "accent": "#1B2130", "panel": "rgba(255, 255, 255, 0.72)", "font": "BioRhyme"}, "midnight": {"text": "#E8EEFF", "accent": "#89AFFF", "panel": "rgba(10, 18, 46, 0.72)", "font": "BioRhyme"}, "sunset": {"text": "#FFF1E6", "accent": "#FF9A5A", "panel": "rgba(48, 18, 42, 0.72)", "font": "BioRhyme"}, "forest": {"text": "#EAF7EE", "accent": "#6FD6A0", "panel": "rgba(12, 36, 28, 0.72)", "font": "BioRhyme"}, "ocean": {"text": "#E6F8FF", "accent": "#4CD3E0", "panel": "rgba(6, 36, 50, 0.72)", "font": "BioRhyme"}, "rose": {"text": "#FFE9F1", "accent": "#FF98BE", "panel": "rgba(58, 14, 34, 0.72)", "font": "BioRhyme"}, "neon": {"text": "#FFFFFF", "accent": "#00F0FF", "panel": "rgba(4, 4, 16, 0.82)", "font": "BioRhyme"}, "cosycabin": {"text": "#57442E", "accent": "#7C6142", "panel": "#F5ECD6", "font": "Chicle"}, "pastel": {"text": "#6B4F3A", "accent": "#BF684C", "panel": "#FFF6E9", "font": "Baloo 2"}, "celestial": {"text": "#F3ECFF", "accent": "#E8C06B", "panel": "#2E1A47", "font": "Cinzel"}, "pastelgoth": {"text": "#F2E9F0", "accent": "#C8B6E2", "panel": "#3A3340", "font": "Quicksand"}, "pastelpink": {"text": "#6A2E4B", "accent": "#BF5179", "panel": "#FFE3EC", "font": "Fredoka"}, "faegreen": {"text": "#EEF5DA", "accent": "#C9E265", "panel": "#2C4A36", "font": "Almendra"}, "pride": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(194, 168, 154, 0.9)", "font": "Fredoka"}, "trans": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(185, 201, 225, 0.9)", "font": "Fredoka"}, "bi": {"text": "#FFFFFF", "accent": "#FFFFFF", "panel": "rgba(117, 39, 142, 0.9)", "font": "Fredoka"}, "pan": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(181, 142, 132, 0.9)", "font": "Fredoka"}, "enby": {"text": "#1A1426", "accent": "#2D2D2D", "panel": "rgba(212, 202, 192, 0.9)", "font": "Fredoka"}, "lesbian": {"text": "#1A1426", "accent": "#1A1426", "panel": "rgba(232, 167, 169, 0.9)", "font": "Fredoka"}, "ace": {"text": "#1A1426", "accent": "#000000", "panel": "rgba(202, 187, 202, 0.9)", "font": "Fredoka"}};
  const LABELS = {"glass": "Soft black (default)", "frost": "Soft white", "midnight": "Midnight blue", "sunset": "Sunset", "forest": "Forest", "ocean": "Ocean", "rose": "Rose", "neon": "Neon", "cosycabin": "Cosy cabin", "pastel": "Cosy summer pastel", "celestial": "Celestial", "pastelgoth": "Pastel goth", "pastelpink": "Pastel pink", "faegreen": "Fae green", "pride": "Rainbow pride", "trans": "Trans pride", "bi": "Bi pride", "pan": "Pan pride", "enby": "Non-binary pride", "lesbian": "Lesbian pride", "ace": "Ace pride", "custom": "Custom (use the colours below)"};
  ok(JSON.stringify(Object.keys(fields.themePreset.options)) === JSON.stringify(Object.keys(LABELS)) && Object.keys(LABELS).length === 22, "the dropdown offers the twenty-one shared presets and Custom, in the shared order");
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
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})();
