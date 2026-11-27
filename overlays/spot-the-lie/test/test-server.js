/* Runs the real answer server on a spare port, with made-up answers in a temporary folder, and checks above all
   that nothing unrevealed can be read without the key. */
"use strict";
const fs = require("fs"), os = require("os"), path = require("path"), http = require("http");
const { spawn, spawnSync } = require("child_process");

const SERVER = path.join(__dirname, "..", "server", "lie-server.js");
const KEY = "a-test-key-of-good-length";
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lie-"));
const ORDER = [
  { number: 2, username: "Second", letter: "C", lie: "second lie" },
  { number: 1, username: "First", letter: "B", lie: "first lie" }
];
const writeOrder = (list) => fs.writeFileSync(path.join(dir, "running-order.json"), JSON.stringify(list));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } };

function start(extra) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], { env: Object.assign({}, process.env, { LIE_SECRET: KEY, LIE_PORT: "0", LIE_HOST: "127.0.0.1", LIE_DATA: dir, LIE_SOURCE_URL: "" }, extra) });
    let out = "";
    child.stdout.on("data", (d) => { out += d; const m = /:(\d+)\s+\(/.exec(out); if (m) resolve({ child, base: "http://127.0.0.1:" + m[1] }); });
    child.on("exit", (code) => reject(new Error("server stopped with " + code)));
  });
}

(async () => {
  console.log("\n[the key]");
  ["", "short"].forEach((secret) => {
    const r = spawnSync(process.execPath, [SERVER], { env: Object.assign({}, process.env, { LIE_SECRET: secret, LIE_PORT: "0", LIE_DATA: dir }), timeout: 5000 });
    ok(r.status === 1 && /LIE_SECRET/.test(String(r.stderr)), "it will not start with " + (secret ? "a short key" : "no key"));
  });

  writeOrder(ORDER);
  let s = await start();
  const get = async (p) => { const r = await fetch(s.base + p); return { status: r.status, headers: r.headers, text: await r.text() }; };
  const run = async (q) => (await get("/?q=" + q + "&key=" + KEY)).text;
  const state = async () => JSON.parse((await get("/state")).text);

  for (const p of ["/?q=step", "/?q=step&key=wrong", "/?q=lie+1"]) ok((await get(p)).text === "Sorry, that link is missing its key.", "without the right key nothing is given away (" + p + ")");
  ok((await state()).rev === 0, "and a refused press does not move the round on");
  const first = await get("/state");
  ok(first.headers.get("access-control-allow-origin") === "*" && first.headers.get("cache-control") === "no-store", "the overlay may read /state, and it is never cached");
  ok(!/First|Second|first lie/.test(first.text), "before the round, /state names nobody");
  ok((await get("/?q=step&key=" + KEY)).headers.get("access-control-allow-origin") === "*", "the overlay may read a command's reply when it has the key");
  ok((await get("/?q=step&key=wrong")).headers.get("access-control-allow-origin") === "*", "and may read that its key was refused");
  ok((await get("/health")).text === "ok, 2 people loaded\n", "health says how many are loaded");
  await run("reset");

  console.log("\n[walking the round]");
  ok((await run("step")) === "#1 was First.", "the first press says who");
  let now = await state();
  ok(now.who === "First" && now.letter === "" && now.lie === "", "/state then has the name and no lie");
  ok((await run("step")) === "#1 - the lie was B: first lie", "the second says the lie");
  now = await state();
  ok(now.letter === "B" && now.lie === "first lie" && !/Second|second/.test(JSON.stringify(now)), "/state has that lie and nothing about the next person");
  const rev = now.rev;
  ok(/second lie/.test(await run("lie+2")), "a lookup by number answers in chat");
  ok((await state()).rev === rev && !/second/.test((await get("/state")).text), "and leaves /state alone");

  console.log("\n[a new running order, and a restart]");
  writeOrder([{ number: 1, username: "Changed", letter: "A", lie: "fresh secret" }, ORDER[0]]);
  await run("refresh");
  ok(!/Changed|fresh secret/.test((await get("/state")).text), "loading new answers never puts them in /state");
  s.child.removeAllListeners("exit"); s.child.kill();
  s = await start();
  ok((await state()).rev === rev, "a restart keeps your place");
  ok((await run("step")) === "#2 was Second.", "and carries on with the next person");
  await run("step");
  ok(/That is everyone/.test(await run("step")), "it says when the round is over");
  await run("reset");
  now = await state();
  ok(now.who === "" && now.letter === "" && now.rev > rev, "a reset clears what was shown and counts as a change");

  console.log("\n[going back and skipping]");
  writeOrder([ORDER[1], ORDER[0], { number: 3, username: "Third", letter: "A", lie: "third lie" }]);
  await run("refresh");
  await run("reset");
  await run("step"); await run("step");
  let reply = await run("prev");
  ok(reply === "Went back one. Next !lie says #1's lie.", "prev undoes a lie (" + reply + ")");
  now = await state();
  ok(now.who === "First" && now.letter === "" && now.lie === "" && now.back === true && now.undone.part === "lie" && now.undone.number === 1, "/state takes the lie back and says what was undone");
  reply = await run("prev");
  ok(reply === "Went back one. Next !lie says who #1 was." && (await state()).who === "", "and then the name");
  ok((await run("step")) === "#1 was First." && (await state()).back === false, "stepping forward again reads it out again");
  reply = await run("next");
  ok(reply === "Skipped the rest of #1. Next !lie says who #2 was.", "next skips the rest of a person (" + reply + ")");
  ok((await state()).who === "" && !/second|Second/.test((await get("/state")).text), "without revealing anything");
  reply = await run("next");
  ok(reply === "Skipped #2. Next !lie says who #3 was.", "or a whole person (" + reply + ")");
  ok((await run("prev")) === "Went back one. Next !lie says who #2 was.", "prev undoes a skip");
  await run("step");
  await run("reset");
  ok((await run("prev")) === "Went back one. Next !lie says #2's lie." && (await state()).who === "Second", "prev even undoes a reset");
  await run("next"); await run("next");
  ok((await run("next")) === "There is nobody left to skip.", "skipping stops at the end");
  ok((await run("prev")) === "Went back one. Next !lie says who #3 was.", "and you can come back from the end");
  for (let i = 0; i < 20; i++) await run("prev");
  ok((await run("prev")) === "There is nothing to go back to.", "prev stops when there is nothing left");
  const quiet = (await state()).rev;
  ok((await get("/?q=prev&key=wrong")).text === "Sorry, that link is missing its key." && (await get("/?q=next")).text === "Sorry, that link is missing its key." && (await state()).rev === quiet, "both need the key");
  for (let i = 0; i < 70; i++) { await run("reset"); await run("step"); }
  ok(JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf8")).history.length === 100, "the history does not grow for ever");
  await run("reset");

  console.log("\n[one chat message, heard twice]");
  const press = async (q, id) => (await get("/?q=" + q + "&key=" + KEY + "&id=" + id)).text;
  const twice = await Promise.all([press("step", "msg-1"), press("step", "msg-1")]);
  const once = await state();
  ok(twice[0] === twice[1] && once.who !== "" && once.letter === "", "two copies sending it together move one step (" + twice[0] + ")");
  ok((await press("step", "msg-1")) === twice[0] && (await state()).rev === once.rev, "and a late copy gets the same reply without moving");
  ok((await press("step", "msg-2")) !== twice[0] && (await state()).rev === once.rev + 1, "the next message moves on");
  ok((await get("/?q=step&key=wrong&id=msg-3")).text === "Sorry, that link is missing its key.", "a wrong key is refused with an id too");
  await press("reset", "msg-3");
  ok((await state()).who === "", "and that refusal does not use up the id");
  for (let i = 0; i < 205; i++) await press("who+1", "bulk-" + i);
  const before = (await state()).rev;
  await press("step", "msg-1");
  ok((await state()).rev === before + 1, "only the latest ids are remembered");
  await run("reset");

  console.log("\n[three answers]");
  writeOrder([{ number: 1, username: "First", letter: "b", a: "one a", b: "one b", c: "one c" }, { number: 2, username: "Second", letter: "A", a: "two a", b: "", c: "two c", lie: "two lie" }]);
  ok((await run("refresh")) === "Reread the running order: 2 people. 1 without all three answers.", "a refresh says when an entry is missing an answer");
  await run("reset");
  ok(!/one a|one b|one c/.test((await get("/state")).text), "no answer is public before !lie");
  await run("step");
  let three = await state();
  ok(three.answers.join("|") === "one a|one b|one c" && three.letter === "" && three.lie === "" && !/two/.test(JSON.stringify(three)), "the first press shows all three, without saying which is the lie");
  ok((await run("step")) === "#1 - the lie was b: one b", "the lie comes from its letter when it is not written out");
  three = await state();
  ok(three.lie === "one b" && three.answers.length === 3, "and the answers stay with the reveal");
  await run("step");
  three = await state();
  ok(three.who === "Second" && three.answers.length === 0 && !/two a|two c|two lie/.test(JSON.stringify(three)), "with an answer missing, none of them are shown");
  await run("prev");
  ok((await state()).answers.length === 3, "going back brings the answers back");
  writeOrder(ORDER);
  await run("refresh");
  await run("reset");

  console.log("\n[a bad file and bad requests]");
  fs.writeFileSync(path.join(dir, "running-order.json"), "not json, secret words");
  ok((await run("refresh")) === "Reread the running order: 0 people.", "a broken file loads nobody and does not crash it");
  ok((await get("/running-order.json")).status === 404, "the answers file is not served");
  const posted = await fetch(s.base + "/?q=step&key=" + KEY, { method: "POST" });
  ok(posted.status === 405, "only GET is answered");

  console.log("\n[fetching from a source]");
  reply = "[]";
  const source = http.createServer((q, r) => r.end(reply));
  await new Promise((done) => source.listen(0, "127.0.0.1", done));
  writeOrder(ORDER);
  s.child.removeAllListeners("exit"); s.child.kill();
  s = await start({ LIE_SOURCE_URL: "http://127.0.0.1:" + source.address().port + "/" });
  ok(/Kept the old copy/.test(await run("refresh")) && /2 people/.test((await get("/health")).text), "an empty reply keeps the old answers");
  reply = JSON.stringify([{ number: 1, username: "Pulled", letter: "A", lie: "pulled lie" }]);
  ok((await run("refresh")) === "Pulled a fresh running order: 1 people.", "a good reply replaces them");

  s.child.removeAllListeners("exit"); s.child.kill(); source.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
