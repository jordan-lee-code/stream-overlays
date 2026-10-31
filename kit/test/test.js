/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Tests for overlay-kit. No dependencies: it runs with plain Node. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const K = require("../src/presets");
const { pyRound, pyJson } = require("../src/format");
const { checkContrast } = require("../src/contrast");
const { sync } = require("../src/sync");

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log("  PASS " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message.split("\n")[0]); }
}
// Tests that wait on something. They run one after another once the plain ones are done.
let later = Promise.resolve();
function atest(name, fn) {
  later = later.then(async () => {
    try { await fn(); pass++; console.log("  PASS " + name); }
    catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message.split("\n")[0]); }
  });
}
function asection(title) { later = later.then(() => console.log("\n[" + title + "]")); }

console.log("\n[the table]");
test("there are twenty-two presets with unique keys and labels", () => {
  assert.strictEqual(K.PRESETS.length, 22);
  assert.strictEqual(new Set(K.PRESETS.map(x => x.key)).size, 22);
  assert.strictEqual(new Set(K.PRESETS.map(x => x.label)).size, 22);
});
test("Soft black is first and the default", () => assert.strictEqual(K.PRESETS[0].key, "glass"));
test("the dropdown lists every preset and ends with Custom", () => {
  const keys = Object.keys(K.options());
  assert.strictEqual(keys.length, 23);
  assert.strictEqual(keys[keys.length - 1], "custom");
});
test("every preset has eight option colours and a font", () => K.PRESETS.forEach(x => {
  assert.strictEqual(x.segs.length, 8, x.key + " segs");
  assert.ok(x.font, x.key + " font");
}));
test("exactly the seven pride presets carry a flag and a background image", () => {
  const flagged = K.PRESETS.filter(x => x.flag).map(x => x.key);
  assert.deepStrictEqual(flagged, ["pride", "trans", "bi", "pan", "enby", "lesbian", "ace"]);
  K.PRESETS.forEach(x => assert.strictEqual(!!x.bgimg, !!x.flag, x.key));
});
test("the pride flags are the published stripes", () => {
  assert.deepStrictEqual(K.BY_KEY.trans.flag, ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"]);
  assert.deepStrictEqual(K.BY_KEY.bi.flag, ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"]);
  assert.deepStrictEqual(K.BY_KEY.pan.flag, ["#FF218C", "#FFD800", "#21B1FF"]);
  assert.strictEqual(K.BY_KEY.lesbian.flag.length, 7);
  assert.strictEqual(K.BY_KEY.pride.flag.length, 6);
});

console.log("\n[contrast]");
test("every preset meets the contrast standards", () => {
  const r = checkContrast();
  assert.deepStrictEqual(r.failures, []);
});
test("a flag with no black stripe needs no wash, and one with a black stripe gets a light one", () => {
  assert.strictEqual(K.designPanel(K.BY_KEY.trans.flag).alpha, 0);
  assert.ok(K.designPanel(K.BY_KEY.ace.flag).alpha > 0.4);
  assert.strictEqual(K.designPanel(K.BY_KEY.bi.flag).text, "#FFFFFF");
});
test("contrast is the WCAG ratio", () => {
  assert.ok(Math.abs(K.contrast([0, 0, 0], [255, 255, 255]) - 21) < 1e-9);
  assert.ok(Math.abs(K.contrast([119, 119, 119], [255, 255, 255]) - 4.48) < 0.01);
});

console.log("\n[formatting]");
test("rounding is half to even, as the tables were first written", () => {
  assert.strictEqual(pyRound(2.5), 2); assert.strictEqual(pyRound(3.5), 4); assert.strictEqual(pyRound(2.4), 2); assert.strictEqual(pyRound(2.6), 3);
});
test("JSON has a space after commas and colons", () => assert.strictEqual(pyJson({ a: [1, "x"], b: null }), '{"a": [1, "x"], "b": null}'));

console.log("\n[the generated tables]");
Object.keys(K.generators).forEach(kind => {
  test(kind + ": the table is valid JavaScript with every preset in it", () => {
    const out = vm.runInNewContext(K.generators[kind]() + "\nPRESETS");
    assert.deepStrictEqual(Object.keys(out), K.PRESETS.map(x => x.key));
    K.PRESETS.forEach(x => assert.ok(x.accent && JSON.stringify(out[x.key]).indexOf(x.accent) !== -1, x.key));
  });
  test(kind + ": only the pride presets carry a background image", () => {
    const out = vm.runInNewContext(K.generators[kind]() + "\nPRESETS");
    K.PRESETS.forEach(x => assert.strictEqual(!!out[x.key].bgimg, !!x.bgimg, x.key));
  });
});

asection("the pretend clock");
{
  const createClock = require("../shared/clock");
  atest("timers fire in order of when they are due, and only once they are", async () => {
    const c = createClock(), log = [];
    c.setTimeout(() => log.push("b"), 200); c.setTimeout(() => log.push("a"), 100); c.setTimeout(() => log.push("c"), 300);
    await c.advance(150); assert.deepStrictEqual(log, ["a"]);
    await c.advance(100); assert.deepStrictEqual(log, ["a", "b"]);
    await c.advance(100); assert.deepStrictEqual(log, ["a", "b", "c"]);
  });
  atest("an hour passes without a moment really passing", async () => {
    const c = createClock(), began = Date.now();
    await c.advance(3600000);
    assert.ok(Date.now() - began < 200 && c.now() === 1700000000000 + 3600000);
  });
  atest("an interval repeats, and stops when it is cleared", async () => {
    const c = createClock(); let n = 0;
    const id = c.setInterval(() => n++, 500);
    await c.advance(2100); assert.strictEqual(n, 4);
    c.clearInterval(id); await c.advance(5000); assert.strictEqual(n, 4);
  });
  atest("a timer can be cleared before it fires", async () => {
    const c = createClock(); let hit = false;
    c.clearTimeout(c.setTimeout(() => { hit = true; }, 10)); await c.advance(100);
    assert.ok(!hit && c.pending() === 0);
  });
  atest("a timer set by a timer fires in the same stretch of time if it falls due in it", async () => {
    const c = createClock(), log = [];
    c.setTimeout(() => { log.push("first"); c.setTimeout(() => log.push("second"), 50); c.setTimeout(() => log.push("late"), 5000); }, 100);
    await c.advance(200); assert.deepStrictEqual(log, ["first", "second"]);
  });
  atest("promises settle between timers, so an answer that arrives through one can schedule the next", async () => {
    const c = createClock(), log = [];
    c.setTimeout(() => { Promise.resolve().then(() => Promise.resolve()).then(() => { log.push("answered"); c.setTimeout(() => log.push("then"), 10); }); }, 100);
    await c.advance(200); assert.deepStrictEqual(log, ["answered", "then"]);
  });
  atest("a timer sees the time it was due, not the time the stretch ends", async () => {
    const c = createClock(0), seen = [];
    c.setTimeout(() => seen.push(c.now()), 120); c.setTimeout(() => seen.push(c.now()), 340);
    await c.advance(1000); assert.deepStrictEqual(seen, [120, 340]);
  });
  atest("arguments are passed, and equal times keep the order they were set in", async () => {
    const c = createClock(), log = [];
    c.setTimeout((x, y) => log.push(x + y), 10, "a", "b"); c.setTimeout(() => log.push("same time"), 10);
    await c.advance(10); assert.deepStrictEqual(log, ["ab", "same time"]);
  });
  atest("its Date follows the clock, with or without a date given", async () => {
    const c = createClock(5000);
    assert.strictEqual(c.Date.now(), 5000); assert.strictEqual(new c.Date().getTime(), 5000);
    await c.advance(250); assert.strictEqual(new c.Date().getTime(), 5250);
    assert.strictEqual(new c.Date(2026, 0, 1).getFullYear(), 2026);
    assert.ok(new c.Date() instanceof Date);
  });
  atest("a timer that always schedules another is stopped rather than run for ever", async () => {
    const c = createClock(); const again = () => c.setTimeout(again, 0); again();
    await assert.rejects(() => c.advance(10), /keeps scheduling timers/);
  });
}

console.log("\n[the shared helpers]");
{
  const common = fs.readFileSync(path.join(__dirname, "../shared/common.js"), "utf8");
  const START = "  // ---- shared by every overlay in this set ----", END = "  // ---- end of the shared primitives ----\n";
  const block = common.slice(common.indexOf(START), common.indexOf(END) + END.length);
  const drifted = block.replace("Math.max(lo, Math.min(hi, n))", "n");
  const withBlock = body => {
    const dir = tempRepo("counter");
    const p = path.join(dir, "widget/widget.js");
    sync(dir);                       // settle the preset table first, so only the helpers are in question
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("  var PRESETS", body + "  var PRESETS"));
    return { dir, p };
  };
  test("a drifted helper is reported, and an overlay with no block is left alone", () => {
    const { dir, p } = withBlock(drifted);
    assert.ok(sync(dir, { check: true }).changes.some(x => /shared primitives/.test(x)));
    assert.ok(fs.readFileSync(p, "utf8").indexOf(block) === -1);
    assert.ok(!sync(tempRepo("counter"), { check: true }).changes.some(x => /shared primitives/.test(x)));
  });
  test("syncing puts the shared block back, keeps the overlay's own code, and a second run changes nothing", () => {
    const { dir, p } = withBlock(drifted);
    sync(dir);
    const out = fs.readFileSync(p, "utf8");
    assert.ok(out.indexOf(block) > -1 && /var after = 1;/.test(out));
    assert.deepStrictEqual(sync(dir, { check: true }).changes, []);
  });
}

console.log("\n[the settings standard]");
const { checkFields } = require("../src/settings");
const good = { animate: { type: "checkbox", value: true, group: "Look" }, mute: { type: "checkbox", value: false, group: "Sounds" }, cText: { type: "colorpicker", value: "#fff", group: "Custom colours" } };
test("an overlay that follows the standard has no problems", () => assert.deepStrictEqual(checkFields(good), []));
test("an old name for a standard setting is refused, and says what replaced it", () => {
  const p = checkFields({ animations: { type: "checkbox", value: true, group: "Animation" } });
  assert.ok(p.length === 1 && /animations: is the old name for animate/.test(p[0]));
});
test("a standard name with the wrong type or default is refused", () => {
  assert.ok(checkFields({ animate: { type: "dropdown", value: true, group: "x" } }).some(x => /should be a checkbox/.test(x)));
  assert.ok(checkFields({ mute: { type: "checkbox", value: true, group: "x" } }).some(x => /should default to false/.test(x)));
});
test("a second command word is refused, since one command takes verbs", () => assert.ok(checkFields({ lockCommand: { type: "text", group: "Commands" } }).some(x => /second command word/.test(x))));
test("a setting with no group is refused", () => assert.ok(checkFields({ anything: { type: "text" } }).some(x => /not in a group/.test(x))));
test("a documented exception is allowed, and one with no reason, or for a missing setting, is not", () => {
  const f = { debug: { type: "checkbox", value: true, group: "Troubleshooting" } };
  assert.deepStrictEqual(checkFields(f, { debug: "Logging is on until the first real event has been captured." }), []);
  assert.ok(checkFields(f, { debug: "short" }).length >= 1);
  assert.ok(checkFields(good, { debug: "This setting does not exist in the overlay." }).some(x => /no such setting/.test(x)));
});

console.log("\n[syncing a repo]");
function tempRepo(name, kind) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kit-")), name);
  fs.mkdirSync(path.join(dir, "widget"), { recursive: true });
  fs.mkdirSync(path.join(dir, "test"), { recursive: true });
  fs.writeFileSync(path.join(dir, "widget/widget.js"), "(function () {\n  \"use strict\";\n  var PRESETS = {\n    old: 1\n  };\n  var after = 1;\n})();\n");
  fs.writeFileSync(path.join(dir, "widget/fields.json"), JSON.stringify({ themePreset: { type: "dropdown", options: { old: "Old" }, value: "glass" } }, null, 2) + "\n");
  fs.writeFileSync(path.join(dir, "test/presets.expected.json"), "{}");
  fs.writeFileSync(path.join(dir, "test/mock.js"), "old mock");
  fs.writeFileSync(path.join(dir, "test/test-widget.js"), 'const EXPECT = {"old": {}};\nconst LABELS = {"old": "Old"};\nok(Object.keys(LABELS).length === 2);\n');
  return dir;
}
test("check mode reports drift and writes nothing", () => {
  const dir = tempRepo("counter");
  const before = fs.readFileSync(path.join(dir, "widget/widget.js"), "utf8");
  const r = sync(dir, { check: true });
  assert.ok(r.changes.length >= 5);
  assert.strictEqual(fs.readFileSync(path.join(dir, "widget/widget.js"), "utf8"), before);
});
test("sync brings a repo in line, keeps the code around the table, and a second run changes nothing", () => {
  const dir = tempRepo("counter");
  sync(dir);
  const widget = fs.readFileSync(path.join(dir, "widget/widget.js"), "utf8");
  assert.ok(widget.indexOf("faegreen:") !== -1 && widget.indexOf("var after = 1;") !== -1 && widget.indexOf("old: 1") === -1);
  assert.strictEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "widget/fields.json"), "utf8")).themePreset.options).length, 23);
  assert.ok(fs.readFileSync(path.join(dir, "test/test-widget.js"), "utf8").indexOf("=== 23") !== -1);
  assert.strictEqual(fs.readFileSync(path.join(dir, "test/mock.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../shared/mock.js"), "utf8"));
  assert.strictEqual(fs.readFileSync(path.join(dir, "test/clock.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../shared/clock.js"), "utf8"));
  assert.deepStrictEqual(sync(dir, { check: true }).changes, []);
});
test("each kind of overlay is recognised by name", () => {
  assert.strictEqual(sync(tempRepo("rage-bar"), { check: true }).info.kind, "rage");
  assert.strictEqual(sync(tempRepo("spin-wheel"), { check: true }).info.kind, "wheel");
  assert.strictEqual(sync(tempRepo("something-else"), { check: true }).info.kind, "clock");
});
test("a folder with no widget is refused with a clear message", () => {
  assert.throws(() => sync(fs.mkdtempSync(path.join(os.tmpdir(), "empty-")), { check: true }), /No widget\/widget\.js/);
});

later.then(() => {
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
});
