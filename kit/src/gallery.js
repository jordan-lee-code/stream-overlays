/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Renders an overlay in every style preset and lays the results out as a labelled grid, which is
 * the picture in each README. It needs Chromium (or Chrome) on the machine.
 *
 * What to draw comes from docs/gallery.json in the overlay's folder:
 *   { "width": 400, "height": 270, "fields": { "goal": 25 }, "script": "chat('!count +12');" }
 * `fields` are settings to override. `script` runs shortly after the widget loads, with these
 * helpers: se(listener, event), chat(text, { nick, mod, broadcaster }), sub(event), cheer(bits, who),
 * tip(amount, who), gift(count) and button(field).
 * `setup` is script that runs before the widget does, for an overlay that reads from somewhere outside the page: it can
 * stand in for the network (window.fetch) so a picture never depends on one. */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const K = require("./presets");

const BACKDROP = "linear-gradient(135deg,#3b4a73,#6d4f87 55%,#c9809a)";
const FONTS = "https://fonts.googleapis.com/css2?family=BioRhyme:wght@400;700;800&family=Chicle&family=Baloo+2:wght@400;700;800&family=Cinzel:wght@400;700&family=Quicksand:wght@400;700&family=Fredoka:wght@400;700;800&family=Almendra:wght@400;700&family=Lobster&display=swap";

function findChromium(preferred) {
  const candidates = [preferred, process.env.CHROMIUM, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"].filter(Boolean);
  for (const c of candidates) if (spawnSync(c, ["--version"], { encoding: "utf8" }).status === 0) return c;
  throw new Error("No Chromium or Chrome found. Install one, or set CHROMIUM to its path.");
}

// Inline the script so a page can never end its own script tag early.
const safe = s => s.replace(/<\/script/gi, "<\\/script");

function page(dir, widget, fields, script, w, h, setup) {
  const read = f => fs.readFileSync(path.join(dir, "widget", f), "utf8");
  const defs = JSON.parse(read("fields.json")), data = {};
  Object.keys(defs).forEach(k => { if (defs[k].type !== "button" && "value" in defs[k]) data[k] = defs[k].value; });
  Object.assign(data, fields);
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${BACKDROP};width:${w + 40}px;height:${h + 40}px}
#stage{position:absolute;left:20px;top:20px;width:${w}px;height:${h}px}</style><style>${read("widget.css")}</style>
<link rel="stylesheet" href="${FONTS}"></head><body><div id="stage">${read("widget.html")}</div>
<script>var __s={};window.SE_API={store:{set:function(k,v){__s[k]=JSON.parse(JSON.stringify(v));return Promise.resolve()},get:function(k){return Promise.resolve(__s[k]?JSON.parse(JSON.stringify(__s[k])):null)}}};</script>
<script>${safe(setup || "")}</script>
<script>${safe(read("widget.js"))}</script>
<script>
var FD=${JSON.stringify(data)};
function se(l,e){window.dispatchEvent(new CustomEvent("onEventReceived",{detail:{listener:l,event:e}}))}
function chat(t,o){o=o||{};var b=[],boss=o.broadcaster===true||(o.broadcaster!==false&&!o.mod&&!o.nick);if(boss)b.push({type:"broadcaster"});if(o.mod)b.push({type:"moderator"});
  se("message",{data:{text:t,nick:(o.nick||"streamer").toLowerCase(),displayName:o.nick||"Streamer",badges:b,tags:{mod:o.mod?"1":"0"}}})}
function sub(e){se("subscriber-latest",e)}
function cheer(n,w){se("cheer-latest",{amount:n,name:w||"Cheerer"})}
function tip(n,w){se("tip-latest",{amount:n,name:w||"Tipper"})}
function gift(n){se("subscriber-latest",{gifted:true,bulkGifted:true,amount:n,sender:"GenerousViewer",tier:"1000"})}
function button(f){se("widget-button",{field:f})}
window.dispatchEvent(new CustomEvent("onWidgetLoad",{detail:{fieldData:FD}}));
setTimeout(function(){${safe(script)}},400);
</script></body></html>`;
}

function shoot(chromium, html, out, w, h, budget) {
  const file = out.replace(/\.png$/, ".html");
  fs.writeFileSync(file, html);
  spawnSync(chromium, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=" + budget,
    "--window-size=" + (w + 40) + "," + (h + 40), "--screenshot=" + out, "file://" + file], { stdio: "ignore", timeout: 120000 });
  if (!fs.existsSync(out)) throw new Error("Chromium did not produce " + path.basename(out));
}

function gallery(dir, opts) {
  opts = opts || {};
  const cfgPath = path.join(dir, "docs", "gallery.json");
  if (!fs.existsSync(cfgPath)) throw new Error("No docs/gallery.json in " + dir + ". It says what to draw: width, height, fields and script.");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const w = cfg.width, h = cfg.height, tileW = cfg.tileWidth || 340, budget = cfg.budget || 6000;
  const chromium = findChromium(opts.chromium);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gallery-"));
  const presets = K.PRESETS.filter(x => !opts.only || opts.only.indexOf(x.key) !== -1);
  const tiles = presets.map(x => {
    const out = path.join(tmp, x.key + ".png");
    shoot(chromium, page(dir, x, Object.assign({}, cfg.fields || {}, { themePreset: x.key }), cfg.script || "", w, h, cfg.setup), out, w, h, budget);
    if (opts.log) opts.log("  " + x.label);
    return { label: x.label, file: out };
  });
  const cells = tiles.map(t => '<div><img src="file://' + t.file + '" width=' + tileW + "><p>" + t.label + "</p></div>").join("");
  const html = '<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:#fff;font:700 14px Quicksand,sans-serif;color:#222}' +
    ".g{display:grid;grid-template-columns:repeat(3," + tileW + "px);gap:18px 20px}.g div{text-align:center}.g img{border-radius:14px;display:block}p{margin:8px 0 6px}</style>" +
    '<link rel="stylesheet" href="' + FONTS + '"><div class=g>' + cells + "</div>";
  const gp = path.join(tmp, "grid.html");
  fs.writeFileSync(gp, html);
  const th = Math.round((h + 40) * tileW / (w + 40)), rows = Math.ceil(tiles.length / 3);
  const W = 3 * tileW + 40 + 48, H = rows * (th + 46) + 24 + 24 + 10;
  const target = path.resolve(opts.out || path.join(dir, "docs", "presets.png"));
  spawnSync(chromium, ["--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=3000",
    "--window-size=" + W + "," + H, "--screenshot=" + target, "file://" + gp], { stdio: "ignore", timeout: 120000 });
  if (!fs.existsSync(target)) throw new Error("Chromium did not produce the gallery");
  fs.rmSync(tmp, { recursive: true, force: true });
  return { target, tiles: tiles.length };
}

/** One picture of the overlay in its default look, from the same scene, for its card on the website. */
function card(dir, opts) {
  opts = opts || {};
  const cfgPath = path.join(dir, "docs", "gallery.json");
  if (!fs.existsSync(cfgPath)) throw new Error("No docs/gallery.json in " + dir + ". It says what to draw: width, height, fields and script.");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const w = cfg.width, h = cfg.height, chromium = findChromium(opts.chromium);
  const target = path.resolve(opts.out || path.join(dir, "docs", "card.png"));
  shoot(chromium, page(dir, K.PRESETS[0], Object.assign({}, cfg.fields || {}, { themePreset: K.PRESETS[0].key }), cfg.script || "", w, h, cfg.setup), target, w, h, cfg.budget || 6000);
  try { fs.rmSync(target.replace(/\.png$/, ".html"), { force: true }); } catch (e) { /* best effort */ }
  return { target };
}

module.exports = { gallery, card, page };
