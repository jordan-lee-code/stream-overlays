/* Builds widget/ from the clock in src/ and the Sub Goals overlay in ../sub-goals/.
 *
 * StreamElements takes one HTML, one CSS, one JS and one fields file per widget, so the
 * module is not loaded at run time. It is composed in here, byte for byte, and the clock
 * is added around it. Nothing in the module is edited: its sub counting, goals and look
 * are exactly what that project ships, which is the point of reusing it.
 *
 * The module's settings keep their names, so a style preset chosen once styles the clock
 * and the goals together. Their groups gain a "Goals: " prefix so the editor shows the two
 * sets of settings apart.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MODULE = path.join(ROOT, "..", "sub-goals", "widget");
const NOTICE = "Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE.";

function read(p) { return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"); }
function out(name, text) {
  fs.mkdirSync(path.join(ROOT, "widget"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "widget", name), text);
}

if (!fs.existsSync(MODULE)) {
  console.error("The Sub Goals overlay is missing. It is expected next to this one, at ../sub-goals.");
  process.exit(1);
}

const clockHtml = read(path.join(ROOT, "src", "clock.html")).trim();
const goalsHtml = read(path.join(MODULE, "widget.html")).trim();
out("widget.html",
  "<!-- " + NOTICE + " -->\n" +
  "<div id=\"subathon-root\">\n" + clockHtml + "\n" +
  "<div id=\"subathon-goals\" class=\"subathon-goals\">\n" + goalsHtml + "\n</div>\n</div>\n");

out("widget.css",
  read(path.join(ROOT, "src", "clock.css")).trim() + "\n\n" +
  "/* ---- Sub Incentives module (sub-goals-overlay), unchanged ---- */\n" +
  read(path.join(MODULE, "widget.css")).trim() + "\n");

out("widget.js",
  "/* ---- Sub Incentives module (sub-goals-overlay), unchanged ---- */\n" +
  read(path.join(MODULE, "widget.js")).trim() + "\n\n" +
  "/* ---- Subathon clock ---- */\n" +
  read(path.join(ROOT, "src", "clock.js")).trim() + "\n");

const clockFields = JSON.parse(read(path.join(ROOT, "src", "fields.json")));
const goalFields = JSON.parse(read(path.join(MODULE, "fields.json")));
const merged = {};
Object.keys(clockFields).forEach(function (k) { merged[k] = clockFields[k]; });
Object.keys(goalFields).forEach(function (k) {
  if (merged[k]) { console.error("Field name clash with the module: " + k); process.exit(1); }
  const f = Object.assign({}, goalFields[k]);
  f.group = "Goals: " + f.group;
  merged[k] = f;
});
out("fields.json", JSON.stringify(merged, null, 2) + "\n");

console.log("Built widget/ from " + Object.keys(clockFields).length + " clock fields and " + Object.keys(goalFields).length + " goal fields.");
