/* A small mock of the page and StreamElements, shared by the tests. It runs the real
   widget/widget.js with a clock the test controls, drives it through the same
   onWidgetLoad and onEventReceived events StreamElements sends, and lets the test read
   the rendered result back out. */
const fs = require("fs"), vm = require("vm"), path = require("path");

module.exports = function createEnv(root) {
  const src = fs.readFileSync(path.join(root, "widget/widget.js"), "utf8");
  const fields = JSON.parse(fs.readFileSync(path.join(root, "widget/fields.json"), "utf8"));
  const expectedPresets = JSON.parse(fs.readFileSync(path.join(root, "test/presets.expected.json"), "utf8"));

  function makeEl(id) {
    const e = {
      scrollWidth: 0, clientWidth: 0, offsetHeight: 0, clientHeight: 0, offsetWidth: 0,
      id, tagName: "div", className: "", textContent: "", innerHTML: "", hidden: false, href: "", rel: "",
      parentNode: null, children: [], _cls: new Set(), _attrs: {},
      style: { setProperty(k, v) { this[k] = v; } },
      classList: {
        _s: null, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
        contains(c) { return this._s.has(c); },
        toggle(c, on) { if (on === undefined) on = !this._s.has(c); if (on) this._s.add(c); else this._s.delete(c); }
      },
      setAttribute(k, v) { this._attrs[k] = v; }, getAttribute(k) { return this._attrs[k]; },
      addEventListener() {},
      appendChild(c) { return this.insertBefore(c, null); },
      insertBefore(c, ref) {
        if (c.parentNode) c.parentNode.removeChild(c);
        const at = ref ? this.children.indexOf(ref) : -1;
        if (at === -1) this.children.push(c); else this.children.splice(at, 0, c);
        c.parentNode = this; return c;
      },
      removeChild(c) { const at = this.children.indexOf(c); if (at !== -1) this.children.splice(at, 1); c.parentNode = null; return c; },
      get firstChild() { return this.children[0] || null; }
    };
    e.classList._s = e._cls; return e;
  }
  const elements = {};
  const document = {
    getElementById: id => (elements[id] = elements[id] || makeEl(id)),
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
  const env = { fake: 1700000000000 };
  class FakeDate extends Date { static now() { return env.fake; } }
  const sandbox = {
    window, document, CustomEvent, SE_API, Audio, Date: FakeDate,
    setTimeout, clearTimeout, setInterval, clearInterval, console, Math, Promise, JSON,
    parseFloat, parseInt, isNaN, String, Array, Object, encodeURIComponent, RegExp
  };
  sandbox.global = sandbox; vm.createContext(sandbox); vm.runInContext(src, sandbox);

  let pass = 0, fail = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let lastFD = {};
  Object.assign(env, {
    src, fields, expectedPresets, E, storeData, audioLog, wait,
    ok(cond, msg) { if (cond) { pass++; console.log("  PASS " + msg); } else { fail++; console.log("  FAIL " + msg); } },
    section(t) { console.log("\n[" + t + "]"); },
    fieldData(ov) {
      const fd = {}; Object.keys(fields).forEach(k => { if (fields[k].type !== "button") fd[k] = fields[k].value; });
      return Object.assign(fd, ov || {});
    },
    async load(ov, keep) {
      if (!keep) Object.keys(storeData).forEach(k => delete storeData[k]);
      lastFD = env.fieldData(ov);
      window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } }));
      await wait(5);
    },
    async reload() { window.dispatchEvent(new CustomEvent("onWidgetLoad", { detail: { fieldData: lastFD } })); await wait(5); },
    ev(listener, event) { window.dispatchEvent(new CustomEvent("onEventReceived", { detail: { listener, event } })); },
    chat(text, o) {
      o = o || {}; const badges = [];
      if (o.broadcaster) badges.push({ type: "broadcaster" });
      if (o.mod) badges.push({ type: "moderator" });
      env.ev("message", { data: { text, nick: (o.nick || "viewer").toLowerCase(), displayName: o.nick || "Viewer", badges, tags: { mod: o.mod ? "1" : "0" } } });
    },
    boss(t) { env.chat(t, { broadcaster: true }); },
    button(field) { env.ev("widget-button", { field }); },
    async advance(ms) { env.fake += ms; await wait(260); },
    async settled() { await wait(260); },
    vars(id) { return E(id).style; },
    // Every preset's label, panel, text, accent and font must match the shared table, in
    // the same order, with Custom last. `appId` is the card that carries the --w-* variables.
    async checkPresets(appId) {
      const opts = fields.themePreset.options, keys = Object.keys(opts);
      env.ok(keys.length === Object.keys(expectedPresets).length + 1 && keys[keys.length - 1] === "custom", "the dropdown has the twenty-one shared presets and Custom (" + keys.length + ")");
      env.ok(fields.themePreset.value === "glass", "Soft black is the default");
      let all = true;
      for (const key of Object.keys(expectedPresets)) {
        const x = expectedPresets[key];
        if (opts[key] !== x.label) { all = false; console.log("    label differs for " + key); }
        await env.load({ themePreset: key });
        const v = env.vars(appId);
        if (v["--w-bg"] !== x.panel || v["--w-text"] !== x.text || v["--w-accent"] !== x.accent || String(v["--w-font"]).indexOf('"' + x.font + '"') !== 0) {
          all = false; console.log("    colours differ for " + key + ": " + v["--w-bg"]);
        }
        // A pride preset puts its flag behind the panel as an image. Every other preset leaves the panel plain.
        if (v["--w-edge"] !== (x.flag ? "inset 0 0 0 1px rgba(20, 16, 38, 0.38)" : "none")) { all = false; console.log("    outline differs for " + key + ": " + v["--w-edge"]); }
        if (v["--w-bgimg"] !== (x.bgimg || "none")) { all = false; console.log("    panel image differs for " + key + ": " + v["--w-bgimg"]); }
        // A pride preset gives bars the stripes of its flag, top to bottom. Every other preset gives them the accent.
        const wantFlag = x.flag ? "linear-gradient(180deg, " + x.flag[0] + " 0% " + (100 / x.flag.length) + "%" : x.accent;
        if (x.flag ? String(v["--w-flag"]).indexOf(wantFlag) !== 0 || String(v["--w-flag"]).split(", ").length !== x.flag.length + 1 : v["--w-flag"] !== wantFlag) {
          all = false; console.log("    bar differs for " + key + ": " + v["--w-flag"]);
        }
      }
      env.ok(all, "every preset's label, panel, text, accent and font match the shared table");
      await env.load({ themePreset: "custom", colorPanel: "#102030", panelOpacity: 0.5, cText: "#112233", cAccent: "#445566", cWarn: "#778899", fontFamily: "Lobster" });
      const v = env.vars(appId);
      env.ok(v["--w-bg"] === "rgba(16, 32, 48, 0.5)" && v["--w-text"] === "#112233" && v["--w-accent"] === "#445566" && v["--w-alarm"] === "#778899", "Custom uses the colour pickers (" + v["--w-bg"] + ")");
      env.ok(String(v["--w-font"]).indexOf("Lobster") !== -1, "and the font setting");
      await env.load({ themePreset: "celestial", colorPanel: "#102030", cText: "#112233" });
      env.ok(env.vars(appId)["--w-text"] === expectedPresets.celestial.text, "a preset ignores the colour pickers");
      await env.load({ themePreset: "nonsense" });
      env.ok(env.vars(appId)["--w-bg"] !== undefined, "an unknown preset name does not break the widget");
    },
    // Every setting must be read by the widget, and every button handled.
    checkWired(prefixRe) {
      const noRead = Object.keys(fields).filter(k => fields[k].type !== "button" && src.indexOf("f." + k) === -1);
      env.ok(noRead.length === 0, "every setting is read by the widget" + (noRead.length ? " (unread: " + noRead.join(", ") + ")" : ""));
      const dead = Object.keys(fields).filter(k => fields[k].type === "button" && src.indexOf('case "' + k + '"') === -1);
      env.ok(dead.length === 0, "every button does something" + (dead.length ? " (dead: " + dead.join(", ") + ")" : ""));
      const bare = Object.keys(fields).filter(k => !fields[k].group);
      env.ok(bare.length === 0, "every setting is in a group");
    },
    checkNotice(root2) {
      const html = fs.readFileSync(path.join(root, "widget/widget.html"), "utf8");
      env.ok(/ko-fi\.com\/journeyingjordan/.test(src.slice(0, 400)) && /ko-fi\.com\/journeyingjordan/.test(html.slice(0, 300)), "the licence notice is in the widget files");
      const bad = ["README.md", "CONTRIBUTING.md"].filter(f => fs.existsSync(path.join(root, f)) && /[\u2013\u2014]/.test(fs.readFileSync(path.join(root, f), "utf8")));
      env.ok(bad.length === 0, "the docs use no em or en dashes");
    },
    finish() { console.log("\n=== " + pass + " passed, " + fail + " failed ==="); process.exit(fail ? 1 : 0); }
  });
  return env;
};
