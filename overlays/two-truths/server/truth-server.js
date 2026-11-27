#!/usr/bin/env node
/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The Two Truths and a Lie answer server. See README.md beside this file for hosting it.
 *
 * It keeps the answers in a local file and walks through them one press at a time, so a
 * chatbot gets its reply straight away and nothing slow sits between a command and chat.
 * No dependencies, nothing to install beyond Node 18 or newer.
 *
 * Two kinds of address:
 *   /state          open to anyone, and only ever says what has already been revealed.
 *                   The overlay reads this.
 *   /?q=...&key=... the commands, which can read any answer, so they all need the key.
 *                   A chatbot calls these, or the overlay does when it has been given the key.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SECRET = process.env.TRUTH_SECRET || "";
const PORT = process.env.TRUTH_PORT === undefined ? 8099 : Number(process.env.TRUTH_PORT);
// Only this machine by default: a tunnel or a reverse proxy running here is what lets the internet in.
const HOST = process.env.TRUTH_HOST || "127.0.0.1";
const DATA = process.env.TRUTH_DATA || __dirname;
const ORDER_FILE = path.join(DATA, "running-order.json");
const STATE_FILE = path.join(DATA, "state.json");
// Optional: an address that returns a running order as JSON, fetched when you refresh.
const SOURCE_URL = process.env.TRUTH_SOURCE_URL || "";
const MIN_SECRET = 12;
const UNDO_DEPTH = 100;
const REMEMBERED = 200;

if (SECRET.length < MIN_SECRET) {
  console.error("Set TRUTH_SECRET to at least " + MIN_SECRET + " characters. Without a key anyone who finds the address can read the answers.");
  console.error("One way to make one:  node -e \"console.log(require('crypto').randomBytes(18).toString('base64url'))\"");
  process.exit(1);
}

let rows = [];

function tidy(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((r) => r && Number.isInteger(Number(r.number)) && Number(r.number) > 0)
    .map((r) => ({
      number: Number(r.number),
      username: String(r.username || "").trim(),
      letter: String(r.letter || "").trim(),
      lie: String(r.lie || "").trim()
    }))
    .sort((a, b) => a.number - b.number);
}

function loadOrder() {
  try {
    rows = tidy(JSON.parse(fs.readFileSync(ORDER_FILE, "utf8")));
  } catch (e) {
    rows = [];
    // The parser's own message can quote the file, so only the kind of problem is logged.
    console.error("Could not read " + ORDER_FILE + ": " + (e.code || "it is not valid JSON"));
  }
  return rows.length;
}

/* Where the round has got to lives in a file, so restarting the server mid-round does not
   put you back at the top. `shown` is a copy of what has been read out, and not a number to
   look up later, so loading a new running order can never make /state show a new answer. */
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      current: Number(s.current) || 1, stage: s.stage === 1 ? 1 : 0, rev: Number(s.rev) || 0, shown: s.shown || null,
      history: Array.isArray(s.history) ? s.history : [], back: !!s.back, undone: s.undone || null
    };
  } catch (e) {
    return { current: 1, stage: 0, rev: 0, shown: null, history: [], back: false, undone: null };
  }
}

// Throws if it cannot save, so that a step which was not recorded is not announced either.
function writeState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function publicState() {
  const state = readState();
  const s = state.shown || {};
  return {
    rev: state.rev, number: s.number || 0, who: s.who || "", letter: s.letter || "", lie: s.lie || "",
    back: state.back, undone: state.undone
  };
}

const findRow = (number) => rows.find((r) => r.number === number) || null;
const whoLine = (row) => "#" + row.number + " was " + row.username + ".";
const lieLine = (row) => "The lie was " + row.letter + ": " + row.lie;

/* Every change to the round goes through here, which remembers where things stood so that
   `prev` can put them back. `did` is what the change read out, if it read anything out. */
function move(state, next, did) {
  const before = { current: state.current, stage: state.stage, shown: state.shown, did: did || null };
  writeState(Object.assign({}, next, {
    rev: state.rev + 1, history: state.history.concat([before]).slice(-UNDO_DEPTH), back: false, undone: null
  }));
}

function nextUp(state) {
  const row = findRow(state.current);
  if (!row) return "That is the end of the running order.";
  return state.stage === 1 ? "Next !truth says #" + row.number + "'s lie." : "Next !truth says who #" + row.number + " was.";
}

// Undoes the last step, skip or reset. Its reply goes to chat, so it names numbers and no answers.
function goBack() {
  const state = readState();
  const history = state.history.slice();
  const before = history.pop();
  if (!before) return "There is nothing to go back to.";
  const restored = { current: before.current, stage: before.stage, shown: before.shown };
  writeState(Object.assign({}, restored, { rev: state.rev + 1, history, back: true, undone: before.did }));
  return "Went back one. " + nextUp(restored);
}

// Moves past whoever is up without reading anything out.
function skip() {
  const state = readState();
  const row = findRow(state.current);
  if (!row) return "There is nobody left to skip.";
  const after = rows.find((r) => r.number > row.number);
  const next = { current: after ? after.number : row.number + 1, stage: 0, shown: null };
  move(state, next);
  return "Skipped " + (state.stage === 1 ? "the rest of " : "") + "#" + row.number + ". " + nextUp(next);
}

/* One command walks the round: who #1 was, then what #1's lie was, then on to #2. Every
   reply names its number, so a stray press shows up straight away. */
function stepAlong() {
  const state = readState();
  const row = findRow(state.current);
  if (!row) return "That is everyone in the running order. !truthreset starts again.";

  if (state.stage === 0) {
    move(state, { current: row.number, stage: 1, shown: { number: row.number, who: row.username } }, { number: row.number, part: "who" });
    return whoLine(row);
  }

  move(state, {
    current: row.number + 1, stage: 0,
    shown: { number: row.number, who: row.username, letter: row.letter, lie: row.lie }
  }, { number: row.number, part: "lie" });
  return "#" + row.number + " - the lie was " + row.letter + ": " + row.lie;
}

// The old file is only replaced once a new one has arrived and makes sense.
async function pullFromSource() {
  let list;
  try {
    const response = await fetch(SOURCE_URL, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    if (!response.ok) return "The source answered " + response.status + ". Kept the old copy.";
    list = tidy(await response.json());
  } catch (e) {
    console.error("Refresh failed: " + e.name);
    return "Could not fetch a running order from the source. Kept the old copy.";
  }
  if (!list.length) return "Nothing usable came back from the source. Kept the old copy.";
  try {
    fs.writeFileSync(ORDER_FILE, JSON.stringify(list, null, 2));
  } catch (e) {
    return "Could not save the new running order. Kept the old copy.";
  }
  rows = list;
  return "Pulled a fresh running order: " + rows.length + " people.";
}

function readQuery(params) {
  const text = ["q", "n", "what", "a"].map((k) => params.get(k)).filter((v) => v !== null).join(" ").toLowerCase();
  const number = (text.match(/\d+/) || [])[0];
  let what = "both";
  if (/\b(refresh|reread|reload)\b/.test(text)) what = "refresh";
  else if (/\b(prev|previous|back|undo)\b/.test(text)) what = "back";
  else if (/\b(next|skip)\b/.test(text)) what = "skip";
  else if (/\b(reset|restart|start)\b/.test(text)) what = "reset";
  else if (/\b(step|go)\b/.test(text)) what = "step";
  else if (/\b(lie|what|answer)\b/.test(text)) what = "lie";
  else if (/\b(who|whose|name)\b/.test(text)) what = "who";
  return { number: number ? parseInt(number, 10) : 0, what };
}

const digest = (s) => crypto.createHash("sha256").update(s).digest();
const keyMatches = (given) => crypto.timingSafeEqual(digest(String(given || "")), digest(SECRET));

async function answer(params) {
  const asked = readQuery(params);
  if (asked.what === "refresh") {
    if (SOURCE_URL) return pullFromSource();
    return "Reread the running order: " + loadOrder() + " people.";
  }
  if (asked.what === "reset") {
    move(readState(), { current: 1, stage: 0, shown: null });
    return "Back to the top. Next up is who #1 was.";
  }
  if (asked.what === "step") return stepAlong();
  if (asked.what === "back") return goBack();
  if (asked.what === "skip") return skip();

  // Looking one up by number replies in chat and leaves both the round and the overlay where they are.
  const number = asked.number || readState().current;
  const row = findRow(number);
  if (!row) return "There is no number " + number + " in the running order yet.";
  if (asked.what === "who") return whoLine(row);
  if (asked.what === "lie") return lieLine(row);
  return whoLine(row) + " " + lieLine(row);
}

/* Two copies of the overlay, such as the editor and OBS, both hear the same chat message. Each
   sends its id, so the command runs once and both get the same reply. */
const heard = new Map();
function answerOnce(params) {
  const id = String(params.get("id") || "").slice(0, 100);
  if (!id) return answer(params);
  if (heard.has(id)) return heard.get(id);
  const reply = answer(params);
  heard.set(id, reply);
  if (heard.size > REMEMBERED) heard.delete(heard.keys().next().value);
  reply.catch(() => heard.delete(id));
  return reply;
}

function send(res, status, type, body, extra) {
  // Never cached: a cached step would repeat itself for ever.
  res.writeHead(status, Object.assign({ "content-type": type + "; charset=utf-8", "cache-control": "no-store" }, extra));
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (req.method !== "GET") return send(res, 405, "text/plain", "Only GET is answered here.\n");
    if (url.pathname === "/health") return send(res, 200, "text/plain", "ok, " + rows.length + " people loaded\n");
    // The overlay runs on another site, so the browser needs to be told this may be read from there.
    if (url.pathname === "/state") return send(res, 200, "application/json", JSON.stringify(publicState()), { "access-control-allow-origin": "*" });
    if (url.pathname !== "/") return send(res, 404, "text/plain", "Nothing here.\n");
    // The overlay reads these replies from another site too. The key is what protects them.
    const open = { "access-control-allow-origin": "*" };
    // A chatbot posts whatever comes back, so even a refusal is a plain sentence.
    if (!keyMatches(url.searchParams.get("key"))) return send(res, 200, "text/plain", "Sorry, that link is missing its key.", open);
    return send(res, 200, "text/plain", await answerOnce(url.searchParams), open);
  } catch (e) {
    console.error(e.code || e.name);
    return send(res, 200, "text/plain", "Something went wrong on the answer server. Check its log.");
  }
});

loadOrder();
server.listen(PORT, HOST, () => {
  console.log("Answers on http://" + HOST + ":" + server.address().port + "  (" + rows.length + " people loaded)");
  console.log(SOURCE_URL ? "Refresh fetches from the source." : "Refresh rereads running-order.json.");
});
