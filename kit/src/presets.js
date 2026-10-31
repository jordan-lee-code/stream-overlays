/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The one table every overlay's style presets come from, so the colours cannot drift between
 * widgets. The plain presets are data. The pride presets are designed from their flags' stripes:
 * the flag becomes the panel's background, with the weakest scrim that keeps the text readable.
 */
"use strict";
const { pyRound, pyJson } = require("./format");

function preset(key, label, font, panel, strong, text, accent, onAccent, row, track, glow, fillFrom, fillTo, alarm, segs, more) {
  more = more || {};
  const d = { key, label, font, panel, strong, text, accent, onAccent, row, track, glow, fillFrom, fillTo, alarm, segs,
    labelDark: more.labelDark || "#111111", labelLight: more.labelLight || "#FFFFFF", divider: more.divider || "rgba(0, 0, 0, 0.22)" };
  if (more.flag) d.flag = more.flag;       // the stripes of a flag, top to bottom, for bars that can show them
  if (more.bgimg) d.bgimg = more.bgimg;    // a background image for the main panel, with the solid panel colour as its fallback
  return d;
}

// ---------------------------------------------------------------------------------------------
// Contrast, as the WCAG defines it.
// ---------------------------------------------------------------------------------------------
const rgb = h => { h = h.replace(/^#/, ""); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
function lum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function contrast(a, b) {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const blend = (c, over, a) => [0, 1, 2].map(i => pyRound(c[i] * (1 - a) + over[i] * a));

// ---------------------------------------------------------------------------------------------
// Pride panels: the flag itself as the background, with the weakest scrim that keeps the text
// readable (contrast 4.6 or better) against every stripe, worked out and not chosen by eye.
// ---------------------------------------------------------------------------------------------
const DARK_TEXT = "#1A1426";
function designPanel(stops) {
  const cols = stops.map(rgb);
  let best = null;
  for (const [text, scrim] of [["#FFFFFF", [14, 10, 26]], [DARK_TEXT, [255, 255, 255]]]) {
    const t = rgb(text);
    for (let step = 0; step < 18; step++) {
      const a = step * 0.05;
      if (Math.min.apply(null, cols.map(c => contrast(t, blend(c, scrim, a)))) >= 4.6) {
        if (best === null || a < best[2] - 1e-9) best = [text, scrim, a];
        break;
      }
    }
  }
  const [text, scrim, a] = best;
  const shown = cols.map(c => blend(c, scrim, a));
  const grad = "linear-gradient(135deg, " + stops.join(", ") + ")";
  const layer = "linear-gradient(rgba(" + scrim.join(", ") + ", " + a.toFixed(2) + "), rgba(" + scrim.join(", ") + ", " + a.toFixed(2) + "))";
  const image = a > 0 ? layer + ", " + grad : grad;
  const avg = [0, 1, 2].map(i => pyRound(shown.reduce((s, c) => s + c[i], 0) / shown.length));
  // the accent: a flag colour that stays clear of every stripe, else white or dark
  const cands = stops.filter(x => x.toUpperCase() !== text.toUpperCase()).concat(["#FFFFFF", DARK_TEXT]);
  const worst = x => Math.min.apply(null, shown.map(c => contrast(rgb(x), c)));
  let accent = null, bestKey = null;
  cands.forEach((x, idx) => {
    const w = worst(x), key = [w >= 3.0 ? 1 : 0, w < 3.0 ? w : 0, -idx];
    if (bestKey === null || key[0] > bestKey[0] || (key[0] === bestKey[0] && (key[1] > bestKey[1] || (key[1] === bestKey[1] && key[2] > bestKey[2])))) { bestKey = key; accent = x; }
  });
  return { text, light: text === DARK_TEXT, alpha: a, image, avg, accent };
}

function pride(key, label, stripes, segs, fillFrom, fillTo) {
  const d = designPanel(stripes), light = d.light, [r, g, b] = d.avg;
  const panel = "rgba(" + r + ", " + g + ", " + b + ", 0.9)", strong = "rgba(" + r + ", " + g + ", " + b + ", 0.96)";
  const onAccent = lum(rgb(d.accent)) < 0.35 ? "#FFFFFF" : DARK_TEXT;
  return preset(key, label, "Fredoka", panel, strong, d.text, d.accent, onAccent,
    light ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.14)", light ? "rgba(26, 20, 38, 0.34)" : "rgba(255, 255, 255, 0.24)",
    d.accent, fillFrom, fillTo, light ? "#B3123A" : "#FF6B6B", segs,
    { divider: light ? "rgba(255, 255, 255, 0.45)" : "rgba(0, 0, 0, 0.3)", flag: stripes, bgimg: d.image });
}

const PRESETS = [
  preset("glass", "Soft black (default)", "BioRhyme", "rgba(0, 0, 0, 0.55)", "rgba(0, 0, 0, 0.7)", "#FFFFFF", "#FFFFFF", "#111111", "rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.2)", "#FFFFFF", "#D9D9D9", "#FFFFFF", "#D64545", ["#FFFFFF", "#D9D9D9", "#BFBFBF", "#EDEDED", "#A6A6A6", "#CCCCCC", "#F5F5F5", "#B3B3B3"]),
  preset("frost", "Soft white", "BioRhyme", "rgba(255, 255, 255, 0.72)", "rgba(255, 255, 255, 0.88)", "#1B2130", "#1B2130", "#FFFFFF", "rgba(0, 0, 0, 0.07)", "rgba(0, 0, 0, 0.14)", "#1B2130", "#5B6478", "#1B2130", "#C0392B", ["#1B2130", "#3A4256", "#5B6478", "#2A3248", "#7A839A", "#454E64", "#1F2840", "#69728A"], { divider: "rgba(255, 255, 255, 0.5)" }),
  preset("midnight", "Midnight blue", "BioRhyme", "rgba(10, 18, 46, 0.72)", "rgba(10, 18, 46, 0.88)", "#E8EEFF", "#89AFFF", "#0A122E", "rgba(127, 168, 255, 0.12)", "rgba(127, 168, 255, 0.22)", "#89AFFF", "#4F77D6", "#A9C4FF", "#FF6B6B", ["#7FA8FF", "#4F77D6", "#A9C4FF", "#3A5BB0", "#C9DAFF", "#6A90E8", "#8FB0FF", "#2B4690"], { divider: "rgba(10, 18, 46, 0.35)" }),
  preset("sunset", "Sunset", "BioRhyme", "rgba(48, 18, 42, 0.72)", "rgba(48, 18, 42, 0.88)", "#FFF1E6", "#FF9A5A", "#30122A", "rgba(255, 154, 90, 0.12)", "rgba(255, 154, 90, 0.24)", "#FF9A5A", "#FF6B8A", "#FFB36B", "#FF4D4D", ["#FF9A5A", "#FF6B8A", "#FFC27A", "#E0508F", "#FFD9A0", "#FF7F6B", "#F4A261", "#C44581"], { divider: "rgba(48, 18, 42, 0.35)" }),
  preset("forest", "Forest", "BioRhyme", "rgba(12, 36, 28, 0.72)", "rgba(12, 36, 28, 0.88)", "#EAF7EE", "#6FD6A0", "#0C241C", "rgba(111, 214, 160, 0.12)", "rgba(111, 214, 160, 0.22)", "#6FD6A0", "#3FAE7C", "#9BEBC1", "#FF7A59", ["#6FD6A0", "#3FAE7C", "#9BEBC1", "#2E8C62", "#C4F5DA", "#59C48C", "#7FE0AE", "#237052"], { divider: "rgba(12, 36, 28, 0.35)" }),
  preset("ocean", "Ocean", "BioRhyme", "rgba(6, 36, 50, 0.72)", "rgba(6, 36, 50, 0.88)", "#E6F8FF", "#4CD3E0", "#06242F", "rgba(76, 211, 224, 0.12)", "rgba(76, 211, 224, 0.22)", "#4CD3E0", "#2FA4B8", "#8FEAF2", "#FF6B6B", ["#4CD3E0", "#2FA4B8", "#8FEAF2", "#1F7F96", "#B8F3F8", "#3DBBCB", "#6BDDE8", "#16647A"], { divider: "rgba(6, 36, 50, 0.35)" }),
  preset("rose", "Rose", "BioRhyme", "rgba(58, 14, 34, 0.72)", "rgba(58, 14, 34, 0.88)", "#FFE9F1", "#FF98BE", "#3A0E22", "rgba(255, 143, 184, 0.12)", "rgba(255, 143, 184, 0.24)", "#FF98BE", "#E0558C", "#FFB3D1", "#FF4D6D", ["#FF8FB8", "#E0558C", "#FFB3D1", "#C23C74", "#FFD3E3", "#F06FA2", "#FF9DC3", "#A82B62"], { divider: "rgba(58, 14, 34, 0.35)" }),
  preset("neon", "Neon", "BioRhyme", "rgba(4, 4, 16, 0.82)", "rgba(4, 4, 16, 0.92)", "#FFFFFF", "#00F0FF", "#040410", "rgba(0, 240, 255, 0.10)", "rgba(0, 240, 255, 0.2)", "#00F0FF", "#FF2BD6", "#00F0FF", "#FF3366", ["#00F0FF", "#FF2BD6", "#B6FF00", "#FFB300", "#7A5CFF", "#00FF9C", "#FF4D4D", "#4DA3FF"], { divider: "rgba(4, 4, 16, 0.4)" }),
  preset("cosycabin", "Cosy cabin", "Chicle", "#F5ECD6", "#F5ECD6", "#57442E", "#7C6142", "#F5ECD6", "rgba(255, 255, 255, 0.42)", "rgba(0, 0, 0, 0.11)", "#7C6142", "#E2C79B", "#7C6142", "#C05746", ["#CB9265", "#9A7A4E", "#DFBD7B", "#6E5636", "#E2C79B", "#8B6F47", "#B8834F", "#7A5C3A"], { labelDark: "#3a2a1d", labelLight: "#ffffff", divider: "rgba(255, 255, 255, 0.7)" }),
  preset("pastel", "Cosy summer pastel", "Baloo 2", "#FFF6E9", "#FFF6E9", "#6B4F3A", "#BF684C", "#FFF6E9", "rgba(255, 255, 255, 0.42)", "rgba(0, 0, 0, 0.11)", "#BF684C", "#FFD1A9", "#FF8A65", "#F4587A", ["#FF8A65", "#F7B5CA", "#A8E6CF", "#9BD3E3", "#FFD1A9", "#C7B9E8", "#FFE08A", "#F49BA5"], { labelDark: "#3a2a1d", divider: "rgba(255, 255, 255, 0.7)" }),
  preset("celestial", "Celestial", "Cinzel", "#2E1A47", "#2E1A47", "#F3ECFF", "#E8C06B", "#2E1A47", "rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.18)", "#E8C06B", "#8E7CC3", "#E8C06B", "#B5495B", ["#8E7CC3", "#E8C06B", "#5B4A8A", "#C9B6E4", "#6D5BA6", "#3B2A5E", "#B39DDB", "#D4AF37"], { divider: "rgba(255, 255, 255, 0.35)" }),
  preset("pastelgoth", "Pastel goth", "Quicksand", "#3A3340", "#3A3340", "#F2E9F0", "#C8B6E2", "#3A3340", "rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.18)", "#C8B6E2", "#D9A7C7", "#C8B6E2", "#C96A8E", ["#C8B6E2", "#D9A7C7", "#A88FC0", "#8E7B9E", "#6E6080", "#B695C8", "#E0BBD4", "#4F4658"], { divider: "rgba(255, 255, 255, 0.35)" }),
  preset("pastelpink", "Pastel pink", "Fredoka", "#FFE3EC", "#FFE3EC", "#6A2E4B", "#BF5179", "#FFF5F9", "rgba(255, 255, 255, 0.5)", "rgba(106, 46, 75, 0.14)", "#BF5179", "#F7A8C6", "#E0679A", "#D6456F", ["#F7A8C6", "#FFC8DD", "#E0679A", "#FBB1BD", "#D98BB0", "#FFD6E6", "#F28DB2", "#C95F8B"], { labelDark: "#4a1d33", divider: "rgba(255, 255, 255, 0.75)" }),
  preset("pastelsage", "Pastel sage", "Fredoka", "#DEEBD8", "#DEEBD8", "#2B4636", "#4A7A5A", "#F5FAF2", "rgba(255, 255, 255, 0.5)", "rgba(43, 70, 54, 0.14)", "#4A7A5A", "#B3D3B8", "#6FA283", "#C5533F", ["#A8CBB0", "#CFE4C9", "#6FA283", "#BCD8B3", "#8DB89B", "#DCEBD3", "#7DAE8C", "#5B8F6D"], { labelDark: "#1E382A", divider: "rgba(255, 255, 255, 0.75)" }),
  preset("faegreen", "Fae green", "Almendra", "#2C4A36", "#2C4A36", "#EEF5DA", "#C9E265", "#2C4A36", "rgba(238, 245, 218, 0.12)", "rgba(238, 245, 218, 0.2)", "#C9E265", "#8FB84E", "#D7EE7A", "#E0805A", ["#C9E265", "#8FB84E", "#E6F29A", "#6E9A45", "#F2F7C0", "#A8CB62", "#B7D96D", "#4F7A3A"], { labelDark: "#1F3326", divider: "rgba(44, 74, 54, 0.45)" }),
  pride("pride", "Rainbow pride", ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"], ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088", "#E50000", "#FF8D00"], "#E50000", "#004CFF"),
  pride("trans", "Trans pride", ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"], ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#5BCEFA", "#F5A9B8", "#FFFFFF", "#5BCEFA", "#F5A9B8"], "#5BCEFA", "#F5A9B8"),
  pride("bi", "Bi pride", ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"], ["#D60270", "#9B4F96", "#0038A8", "#D60270", "#9B4F96", "#0038A8", "#D60270", "#9B4F96"], "#D60270", "#0038A8"),
  pride("pan", "Pan pride", ["#FF218C", "#FFD800", "#21B1FF"], ["#FF218C", "#FFD800", "#21B1FF", "#FF218C", "#FFD800", "#21B1FF", "#FF218C", "#FFD800"], "#FF218C", "#21B1FF"),
  pride("enby", "Non-binary pride", ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"], ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D", "#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"], "#FFF433", "#9B59D0"),
  pride("lesbian", "Lesbian pride", ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"], ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262", "#EF7627"], "#D52D00", "#A30262"),
  pride("ace", "Ace pride", ["#000000", "#A3A3A3", "#FFFFFF", "#800080"], ["#A3A3A3", "#FFFFFF", "#800080", "#000000", "#A3A3A3", "#FFFFFF", "#800080", "#000000"], "#A3A3A3", "#800080")
];

const BY_KEY = {};
PRESETS.forEach(x => { BY_KEY[x.key] = x; });

/** The dropdown options, identical in every overlay. */
function options() {
  const o = {};
  PRESETS.forEach(x => { o[x.key] = x.label; });
  o.custom = "Custom (use the colours below)";
  return o;
}

/** What a test should find for every preset, as plain data. */
function expected() {
  const e = {};
  PRESETS.forEach(x => { e[x.key] = { label: x.label, panel: x.panel, text: x.text, accent: x.accent, font: x.font, flag: x.flag || null, bgimg: x.bgimg || null }; });
  return e;
}

// ---------------------------------------------------------------------------------------------
// Generators: the same palette, emitted in the shape each widget's own code expects.
// ---------------------------------------------------------------------------------------------
const js = pyJson;
const wrap = lines => "  var PRESETS = {\n" + lines.join(",\n") + "\n  };";

const generators = {
  squat() {
    return wrap(PRESETS.map(x => {
      const img = x.bgimg ? ", bgimg: " + js(x.bgimg) : "";
      return "    " + x.key + ": { panel: " + js(x.panel) + ", strong: " + js(x.strong) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", font: " + js(x.font) + img + " }";
    }));
  },
  poll() {
    return wrap(PRESETS.map(x => {
      const img = x.bgimg ? ",\n      bgimg: " + js(x.bgimg) : "";
      return "    " + x.key + ": {\n      bg: " + js(x.panel) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", onAccent: " + js(x.onAccent) + ",\n      row: " + js(x.row) + ", track: " + js(x.track) + ",\n      segs: " + js(x.segs) + ",\n      font: " + js(x.font) + img + "\n    }";
    }));
  },
  wheel() {
    return wrap(PRESETS.map(x => {
      const parts = {
        pillBg: x.panel, pill: x.text, toastBg: x.strong, toast: x.text, cardBg: x.strong, card: x.text, eyebrowBg: x.accent,
        eyebrow: x.onAccent, idle: x.text, goal: x.text, goalTrack: x.track, goalFrom: x.fillFrom, goalTo: x.fillTo, hub: x.strong,
        hubRing: x.accent, spent: x.alarm, refused: x.alarm, labelDark: x.labelDark, labelLight: x.labelLight, divider: x.divider, border: "transparent"
      };
      let extra = "";
      if (x.flag) extra += ",\n      flag: " + js(x.flag);
      if (x.bgimg) extra += ",\n      bgimg: " + js(x.bgimg);
      return "    " + x.key + ": {\n      bg: " + js(x.panel) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", pointer: " + js(x.accent) + ",\n      segs: " + js(x.segs.slice(0, 6)) + ",\n      font: " + js(x.font) + extra + ",\n      parts: " + js(parts) + "\n    }";
    }));
  },
  rage() {
    return wrap(PRESETS.map(x => {
      const parts = {
        title: x.text, timer: x.text, readout: x.text, note: x.text, border: x.accent, track: x.track, lock: x.accent, lockHole: x.strong,
        float: x.text, floatBg: x.strong, alert: "#FFFFFF", alertFill: "#FFFFFF", alertTrack: "rgba(0, 0, 0, 0.22)"
      };
      let img = x.bgimg ? "      bgimg: " + js(x.bgimg) + ",\n" : "";
      if (x.flag) img += "      flag: " + js(x.flag) + ",\n";
      return "    " + x.key + ": {\n      bg: " + js(x.panel) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", font: " + js(x.font) + ",\n" + img + "      fillFrom: " + js(x.fillFrom) + ", fillTo: " + js(x.fillTo) + ", alarm: " + js(x.alarm) + ",\n      parts: " + js(parts) + "\n    }";
    }));
  },
  /** The sub goals module's table: the parts its panel is made of. */
  goals() {
    return wrap(PRESETS.map(x => {
      const flag = x.flag ? ", flag: " + js(x.flag) : "", img = x.bgimg ? ", bgimg: " + js(x.bgimg) : "";
      return "    " + x.key + ": { panel: " + js(x.panel) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", track: " + js(x.track) + ", glow: " + js(x.glow) + ", font: " + js(x.font) + flag + img + " }";
    }));
  },
  /** The table of the clock-shaped overlays: the card, its text, the accent chips and the warning colour. */
  clock() {
    return wrap(PRESETS.map(x => {
      const flag = x.flag ? ", flag: " + js(x.flag) : "", img = x.bgimg ? ", bgimg: " + js(x.bgimg) : "";
      return "    " + x.key + ": { panel: " + js(x.panel) + ", text: " + js(x.text) + ", accent: " + js(x.accent) + ", track: " + js(x.track) + ", alarm: " + js(x.alarm) + ", font: " + js(x.font) + flag + img + " }";
    }));
  }
};

module.exports = { PRESETS, BY_KEY, options, expected, generators, designPanel, contrast, lum, rgb, blend, DARK_TEXT };
