/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The settings every overlay shares, by name. An overlay need not have all of them, but one that
 * has a setting with a standard name must give it the standard type and default, and the older
 * names for the same idea are not allowed back. See docs/STANDARDS.md. */
"use strict";
const fs = require("fs");
const path = require("path");

const STANDARD = {
  command: { type: "text" },
  whoCanManage: { type: "dropdown" },
  title: { type: "text" },
  showTitle: { type: "checkbox" },
  themePreset: { type: "dropdown", value: "glass" },
  fontFamily: { type: "googleFont" },
  weight: { type: "number" },
  radius: { type: "number" },
  pad: { type: "number" },
  borderWidth: { type: "number" },
  borderColor: { type: "colorpicker" },
  outerFrame: { type: "checkbox", value: true },
  shadow: { type: "checkbox" },
  animate: { type: "checkbox", value: true },
  fit: { type: "checkbox", value: true },
  colorPanel: { type: "colorpicker" },
  panelOpacity: { type: "number" },
  cText: { type: "colorpicker" },
  cAccent: { type: "colorpicker" },
  cTrack: { type: "colorpicker" },
  cWarn: { type: "colorpicker" },
  mute: { type: "checkbox", value: false },
  debug: { type: "checkbox", value: false }
};

// Names the overlays used before the standard, and what replaced them.
const LEGACY = {
  animations: "animate",
  soundsEnabled: "mute",
  colorText: "cText",
  colorAccent: "cAccent",
  colorTrack: "cTrack",
  colorBg: "colorPanel",
  boxOpacity: "panelOpacity"
};

// An overlay can keep a deliberate difference by naming it in its package.json, with the reason:
//   "overlay-kit": { "exceptions": { "debug": "Why it differs." } }
// An exception without a reason is itself a problem, so a difference is always explained.
function checkFields(fields, exceptions) {
  exceptions = exceptions || {};
  const problems = [];
  Object.keys(exceptions).forEach(k => {
    if (typeof exceptions[k] !== "string" || exceptions[k].replace(/\s/g, "").length < 20) problems.push(k + ": an exception needs a reason of at least a sentence");
    if (!fields[k]) problems.push(k + ": has an exception, but the overlay has no such setting");
  });
  Object.keys(fields).forEach(key => {
    const f = fields[key];
    if (LEGACY[key]) problems.push(key + ": is the old name for " + LEGACY[key]);
    if (!f.group) problems.push(key + ": is not in a group");
    if (/Command$/i.test(key) && key !== "command" && !(typeof exceptions[key] === "string" && exceptions[key].length >= 20)) problems.push(key + ": is a second command word; use the one command setting with verbs after it");
    const std = STANDARD[key];
    if (!std) return;
    if (f.type !== std.type) problems.push(key + ": should be a " + std.type + ", not a " + f.type);
    if ("value" in std && f.value !== std.value && !(typeof exceptions[key] === "string" && exceptions[key].length >= 20)) problems.push(key + ": should default to " + JSON.stringify(std.value) + ", not " + JSON.stringify(f.value));
  });
  return problems;
}

function checkSettings(dir) {
  const p = path.join(dir, "widget", "fields.json");
  if (!fs.existsSync(p)) throw new Error("No widget/fields.json in " + dir);
  const pkg = path.join(dir, "package.json");
  const exceptions = fs.existsSync(pkg) ? ((JSON.parse(fs.readFileSync(pkg, "utf8"))["overlay-kit"] || {}).exceptions) : null;
  return checkFields(JSON.parse(fs.readFileSync(p, "utf8")), exceptions);
}

module.exports = { STANDARD, LEGACY, checkFields, checkSettings };
