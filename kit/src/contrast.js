/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The contrast standards every preset has to meet.
 *   text    4.5 or better against its panel (WCAG AA for body text)
 *   accent  3.5 or better against its panel (headings, big numbers and bars, which are large)
 * A stream's backdrop is unknown, so a see-through panel is tried over both a dark and a light one
 * and the worse result counts. A pride preset is designed against every stripe of its own flag,
 * so its text must reach 4.6 and its accent 3.0. */
"use strict";
const K = require("./presets");

const THRESHOLDS = { text: 4.5, accent: 3.5, prideText: 4.6, prideAccent: 3.0 };
const BACKDROPS = [[20, 20, 30], [235, 235, 240]];

function parse(c) {
  c = c.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return { rgb: K.rgb(m[1]), a: 1 };
  m = /^rgba?\(([^)]*)\)$/.exec(c);
  const v = m[1].split(",").map(Number);
  return { rgb: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 };
}
const over = (p, bd) => [0, 1, 2].map(i => Math.round(p.rgb[i] * p.a + bd[i] * (1 - p.a)));

function measure(x) {
  const panel = parse(x.panel), text = parse(x.text).rgb, accent = parse(x.accent).rgb;
  if (x.bgimg) {
    // against the stripes themselves, as the panel is drawn
    const bgs = x.flag.map(K.rgb), scrim = /^linear-gradient\(rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/.exec(x.bgimg);
    const shown = scrim ? bgs.map(c => K.blend(c, [Number(scrim[1]), Number(scrim[2]), Number(scrim[3])], Number(scrim[4]))) : bgs;
    return { text: Math.min.apply(null, shown.map(c => K.contrast(text, c))), accent: Math.min.apply(null, shown.map(c => K.contrast(accent, c))) };
  }
  return {
    text: Math.min.apply(null, BACKDROPS.map(bd => K.contrast(text, over(panel, bd)))),
    accent: Math.min.apply(null, BACKDROPS.map(bd => K.contrast(accent, over(panel, bd))))
  };
}

function checkContrast() {
  const lines = [], failures = [];
  K.PRESETS.forEach(x => {
    const m = measure(x), pride = !!x.bgimg;
    const needText = pride ? THRESHOLDS.prideText : THRESHOLDS.text, needAccent = pride ? THRESHOLDS.prideAccent : THRESHOLDS.accent;
    const problems = [];
    if (m.text < needText - 1e-9) problems.push("text " + m.text.toFixed(1) + " is under " + needText);
    if (m.accent < needAccent - 1e-9) problems.push("accent " + m.accent.toFixed(1) + " is under " + needAccent);
    lines.push(x.key.padEnd(11) + "text " + m.text.toFixed(1).padStart(5) + "  accent " + m.accent.toFixed(1).padStart(5) + (problems.length ? "   FAIL: " + problems.join(", ") : ""));
    if (problems.length) failures.push(x.key + ": " + problems.join(", "));
  });
  return { lines, failures };
}

module.exports = { checkContrast, measure, THRESHOLDS };
