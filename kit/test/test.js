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

console.log("\n[the table]");
test("there are twenty-one presets with unique keys and labels", () => {
  assert.strictEqual(K.PRESETS.length, 21);
  assert.strictEqual(new Set(K.PRESETS.map(x => x.key)).size, 21);
  assert.strictEqual(new Set(K.PRESETS.map(x => x.label)).size, 21);
});
test("Soft black is first and the default", () => assert.strictEqual(K.PRESETS[0].key, "glass"));
test("the dropdown lists every preset and ends with Custom", () => {
  const keys = Object.keys(K.options());
  assert.strictEqual(keys.length, 22);
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
  assert.strictEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(dir, "widget/fields.json"), "utf8")).themePreset.options).length, 22);
  assert.ok(fs.readFileSync(path.join(dir, "test/test-widget.js"), "utf8").indexOf("=== 22") !== -1);
  assert.strictEqual(fs.readFileSync(path.join(dir, "test/mock.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../shared/mock.js"), "utf8"));
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

console.log("\n=== " + pass + " passed, " + fail + " failed ===");
process.exit(fail ? 1 : 0);
