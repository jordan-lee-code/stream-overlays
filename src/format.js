/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Formatting that matches how the overlays' tables were first written, so a regenerated table
 * is byte for byte what is already in each repo. */
"use strict";

/** Round half to even, as Python does, so a tie rounds the same way it always has. */
function pyRound(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

/** JSON with a space after every comma and colon: ["#fff", "#000"] and {"a": 1, "b": 2}. */
function pyJson(v) {
  if (Array.isArray(v)) return "[" + v.map(pyJson).join(", ") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).map(k => JSON.stringify(k) + ": " + pyJson(v[k])).join(", ") + "}";
  return JSON.stringify(v);
}

module.exports = { pyRound, pyJson };
