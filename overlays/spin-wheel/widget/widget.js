/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Spinning Wheel. StreamElements custom widget logic.
 *
 * Reads all configuration from the editor Fields (delivered on onWidgetLoad),
 * listens to Twitch chat + goal events on onEventReceived, and drives a canvas
 * wheel for a giveaway raffle (!spintowin to enter, !spin to draw) plus a
 * fixed-forfeit mode, subscriber-weighted odds, mod controls and goal auto-spins.
 *
 * It has no dependency on the StreamElements runtime beyond the two custom
 * events and SE_API.store, so dev/harness.js can exercise it in a plain browser.
 */
(function () {
  "use strict";

  // ---- shared by every overlay in this set ----
  function str(v, d) { return (v === undefined || v === null || v === "") ? d : String(v); }
  // For wording where an empty field is a real choice (no tag, no currency symbol, no title).
  // StreamElements sends "" for a cleared field, which str() would turn back into the default.
  function txt(v, d) { return (v === undefined || v === null) ? d : String(v); }
  function num(v, d) { var n = parseFloat(v); return isNaN(n) ? d : n; }
  function bool(v, d) {
    if (v === undefined || v === null || v === "") return d;
    return v === true || v === "true" || v === 1 || v === "1" || v === "on";
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function byId(id) { return document.getElementById(id); }
  function rgba(hex, opacity) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex === undefined || hex === null ? "" : hex).trim());
    if (!m) return "rgba(0, 0, 0, " + clamp(opacity, 0, 1) + ")";
    var h = m[1];
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255) + ", " + clamp(opacity, 0, 1) + ")";
  }
  function rolesOf(data) {
    var r = { broadcaster: false, mod: false, sub: false, vip: false };
    var badges = (data && data.badges) || [];
    for (var i = 0; i < badges.length; i++) {
      var t = String(badges[i].type || "").toLowerCase();
      if (t === "broadcaster") r.broadcaster = true;
      else if (t === "moderator") r.mod = true;
      else if (t === "subscriber" || t === "founder") r.sub = true;
      else if (t === "vip") r.vip = true;
    }
    var tags = (data && data.tags) || {};
    if (tags.mod === "1" || tags.mod === 1) r.mod = true;
    if (tags.subscriber === "1" || tags.subscriber === 1 || tags.subscriber === true) r.sub = true;
    if (tags.vip === "1" || tags.vip === 1) r.vip = true;
    if (typeof tags.badges === "string") {
      if (/broadcaster/.test(tags.badges)) r.broadcaster = true;
      if (/vip/.test(tags.badges)) r.vip = true;
    }
    return r;
  }
  // ---- end of the shared primitives ----

  var STORE_KEY = "spin_wheel_v1";

  /* Style presets. The same twenty-one, with the same colours, in every overlay in this
     set, generated from one table so they cannot drift apart, so any preset looks
     like one family across a whole stream. The default, Soft black, is a see-through
     black panel with white text. */
  var PRESETS = {
    glass: {
      bg: "rgba(0, 0, 0, 0.55)", text: "#FFFFFF", accent: "#FFFFFF", pointer: "#FFFFFF",
      segs: ["#FFFFFF", "#D9D9D9", "#BFBFBF", "#EDEDED", "#A6A6A6", "#CCCCCC"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(0, 0, 0, 0.55)", "pill": "#FFFFFF", "toastBg": "rgba(0, 0, 0, 0.7)", "toast": "#FFFFFF", "cardBg": "rgba(0, 0, 0, 0.7)", "card": "#FFFFFF", "eyebrowBg": "#FFFFFF", "eyebrow": "#111111", "idle": "#FFFFFF", "goal": "#FFFFFF", "goalTrack": "rgba(255, 255, 255, 0.2)", "goalFrom": "#D9D9D9", "goalTo": "#FFFFFF", "hub": "rgba(0, 0, 0, 0.7)", "hubRing": "#FFFFFF", "spent": "#D64545", "refused": "#D64545", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(0, 0, 0, 0.22)", "border": "transparent"}
    },
    frost: {
      bg: "rgba(255, 255, 255, 0.72)", text: "#1B2130", accent: "#1B2130", pointer: "#1B2130",
      segs: ["#1B2130", "#3A4256", "#5B6478", "#2A3248", "#7A839A", "#454E64"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(255, 255, 255, 0.72)", "pill": "#1B2130", "toastBg": "rgba(255, 255, 255, 0.88)", "toast": "#1B2130", "cardBg": "rgba(255, 255, 255, 0.88)", "card": "#1B2130", "eyebrowBg": "#1B2130", "eyebrow": "#FFFFFF", "idle": "#1B2130", "goal": "#1B2130", "goalTrack": "rgba(0, 0, 0, 0.14)", "goalFrom": "#5B6478", "goalTo": "#1B2130", "hub": "rgba(255, 255, 255, 0.88)", "hubRing": "#1B2130", "spent": "#C0392B", "refused": "#C0392B", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.5)", "border": "transparent"}
    },
    midnight: {
      bg: "rgba(10, 18, 46, 0.72)", text: "#E8EEFF", accent: "#89AFFF", pointer: "#89AFFF",
      segs: ["#7FA8FF", "#4F77D6", "#A9C4FF", "#3A5BB0", "#C9DAFF", "#6A90E8"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(10, 18, 46, 0.72)", "pill": "#E8EEFF", "toastBg": "rgba(10, 18, 46, 0.88)", "toast": "#E8EEFF", "cardBg": "rgba(10, 18, 46, 0.88)", "card": "#E8EEFF", "eyebrowBg": "#89AFFF", "eyebrow": "#0A122E", "idle": "#E8EEFF", "goal": "#E8EEFF", "goalTrack": "rgba(127, 168, 255, 0.22)", "goalFrom": "#4F77D6", "goalTo": "#A9C4FF", "hub": "rgba(10, 18, 46, 0.88)", "hubRing": "#89AFFF", "spent": "#FF6B6B", "refused": "#FF6B6B", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(10, 18, 46, 0.35)", "border": "transparent"}
    },
    sunset: {
      bg: "rgba(48, 18, 42, 0.72)", text: "#FFF1E6", accent: "#FF9A5A", pointer: "#FF9A5A",
      segs: ["#FF9A5A", "#FF6B8A", "#FFC27A", "#E0508F", "#FFD9A0", "#FF7F6B"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(48, 18, 42, 0.72)", "pill": "#FFF1E6", "toastBg": "rgba(48, 18, 42, 0.88)", "toast": "#FFF1E6", "cardBg": "rgba(48, 18, 42, 0.88)", "card": "#FFF1E6", "eyebrowBg": "#FF9A5A", "eyebrow": "#30122A", "idle": "#FFF1E6", "goal": "#FFF1E6", "goalTrack": "rgba(255, 154, 90, 0.24)", "goalFrom": "#FF6B8A", "goalTo": "#FFB36B", "hub": "rgba(48, 18, 42, 0.88)", "hubRing": "#FF9A5A", "spent": "#FF4D4D", "refused": "#FF4D4D", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(48, 18, 42, 0.35)", "border": "transparent"}
    },
    forest: {
      bg: "rgba(12, 36, 28, 0.72)", text: "#EAF7EE", accent: "#6FD6A0", pointer: "#6FD6A0",
      segs: ["#6FD6A0", "#3FAE7C", "#9BEBC1", "#2E8C62", "#C4F5DA", "#59C48C"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(12, 36, 28, 0.72)", "pill": "#EAF7EE", "toastBg": "rgba(12, 36, 28, 0.88)", "toast": "#EAF7EE", "cardBg": "rgba(12, 36, 28, 0.88)", "card": "#EAF7EE", "eyebrowBg": "#6FD6A0", "eyebrow": "#0C241C", "idle": "#EAF7EE", "goal": "#EAF7EE", "goalTrack": "rgba(111, 214, 160, 0.22)", "goalFrom": "#3FAE7C", "goalTo": "#9BEBC1", "hub": "rgba(12, 36, 28, 0.88)", "hubRing": "#6FD6A0", "spent": "#FF7A59", "refused": "#FF7A59", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(12, 36, 28, 0.35)", "border": "transparent"}
    },
    ocean: {
      bg: "rgba(6, 36, 50, 0.72)", text: "#E6F8FF", accent: "#4CD3E0", pointer: "#4CD3E0",
      segs: ["#4CD3E0", "#2FA4B8", "#8FEAF2", "#1F7F96", "#B8F3F8", "#3DBBCB"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(6, 36, 50, 0.72)", "pill": "#E6F8FF", "toastBg": "rgba(6, 36, 50, 0.88)", "toast": "#E6F8FF", "cardBg": "rgba(6, 36, 50, 0.88)", "card": "#E6F8FF", "eyebrowBg": "#4CD3E0", "eyebrow": "#06242F", "idle": "#E6F8FF", "goal": "#E6F8FF", "goalTrack": "rgba(76, 211, 224, 0.22)", "goalFrom": "#2FA4B8", "goalTo": "#8FEAF2", "hub": "rgba(6, 36, 50, 0.88)", "hubRing": "#4CD3E0", "spent": "#FF6B6B", "refused": "#FF6B6B", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(6, 36, 50, 0.35)", "border": "transparent"}
    },
    rose: {
      bg: "rgba(58, 14, 34, 0.72)", text: "#FFE9F1", accent: "#FF98BE", pointer: "#FF98BE",
      segs: ["#FF8FB8", "#E0558C", "#FFB3D1", "#C23C74", "#FFD3E3", "#F06FA2"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(58, 14, 34, 0.72)", "pill": "#FFE9F1", "toastBg": "rgba(58, 14, 34, 0.88)", "toast": "#FFE9F1", "cardBg": "rgba(58, 14, 34, 0.88)", "card": "#FFE9F1", "eyebrowBg": "#FF98BE", "eyebrow": "#3A0E22", "idle": "#FFE9F1", "goal": "#FFE9F1", "goalTrack": "rgba(255, 143, 184, 0.24)", "goalFrom": "#E0558C", "goalTo": "#FFB3D1", "hub": "rgba(58, 14, 34, 0.88)", "hubRing": "#FF98BE", "spent": "#FF4D6D", "refused": "#FF4D6D", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(58, 14, 34, 0.35)", "border": "transparent"}
    },
    neon: {
      bg: "rgba(4, 4, 16, 0.82)", text: "#FFFFFF", accent: "#00F0FF", pointer: "#00F0FF",
      segs: ["#00F0FF", "#FF2BD6", "#B6FF00", "#FFB300", "#7A5CFF", "#00FF9C"],
      font: "BioRhyme",
      parts: {"pillBg": "rgba(4, 4, 16, 0.82)", "pill": "#FFFFFF", "toastBg": "rgba(4, 4, 16, 0.92)", "toast": "#FFFFFF", "cardBg": "rgba(4, 4, 16, 0.92)", "card": "#FFFFFF", "eyebrowBg": "#00F0FF", "eyebrow": "#040410", "idle": "#FFFFFF", "goal": "#FFFFFF", "goalTrack": "rgba(0, 240, 255, 0.2)", "goalFrom": "#FF2BD6", "goalTo": "#00F0FF", "hub": "rgba(4, 4, 16, 0.92)", "hubRing": "#00F0FF", "spent": "#FF3366", "refused": "#FF3366", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(4, 4, 16, 0.4)", "border": "transparent"}
    },
    cosycabin: {
      bg: "#F5ECD6", text: "#57442E", accent: "#7C6142", pointer: "#7C6142",
      segs: ["#CB9265", "#9A7A4E", "#DFBD7B", "#6E5636", "#E2C79B", "#8B6F47"],
      font: "Chicle",
      parts: {"pillBg": "#F5ECD6", "pill": "#57442E", "toastBg": "#F5ECD6", "toast": "#57442E", "cardBg": "#F5ECD6", "card": "#57442E", "eyebrowBg": "#7C6142", "eyebrow": "#F5ECD6", "idle": "#57442E", "goal": "#57442E", "goalTrack": "rgba(0, 0, 0, 0.11)", "goalFrom": "#E2C79B", "goalTo": "#7C6142", "hub": "#F5ECD6", "hubRing": "#7C6142", "spent": "#C05746", "refused": "#C05746", "labelDark": "#3a2a1d", "labelLight": "#ffffff", "divider": "rgba(255, 255, 255, 0.7)", "border": "transparent"}
    },
    pastel: {
      bg: "#FFF6E9", text: "#6B4F3A", accent: "#BF684C", pointer: "#BF684C",
      segs: ["#FF8A65", "#F7B5CA", "#A8E6CF", "#9BD3E3", "#FFD1A9", "#C7B9E8"],
      font: "Baloo 2",
      parts: {"pillBg": "#FFF6E9", "pill": "#6B4F3A", "toastBg": "#FFF6E9", "toast": "#6B4F3A", "cardBg": "#FFF6E9", "card": "#6B4F3A", "eyebrowBg": "#BF684C", "eyebrow": "#FFF6E9", "idle": "#6B4F3A", "goal": "#6B4F3A", "goalTrack": "rgba(0, 0, 0, 0.11)", "goalFrom": "#FFD1A9", "goalTo": "#FF8A65", "hub": "#FFF6E9", "hubRing": "#BF684C", "spent": "#F4587A", "refused": "#F4587A", "labelDark": "#3a2a1d", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.7)", "border": "transparent"}
    },
    celestial: {
      bg: "#2E1A47", text: "#F3ECFF", accent: "#E8C06B", pointer: "#E8C06B",
      segs: ["#8E7CC3", "#E8C06B", "#5B4A8A", "#C9B6E4", "#6D5BA6", "#3B2A5E"],
      font: "Cinzel",
      parts: {"pillBg": "#2E1A47", "pill": "#F3ECFF", "toastBg": "#2E1A47", "toast": "#F3ECFF", "cardBg": "#2E1A47", "card": "#F3ECFF", "eyebrowBg": "#E8C06B", "eyebrow": "#2E1A47", "idle": "#F3ECFF", "goal": "#F3ECFF", "goalTrack": "rgba(255, 255, 255, 0.18)", "goalFrom": "#8E7CC3", "goalTo": "#E8C06B", "hub": "#2E1A47", "hubRing": "#E8C06B", "spent": "#B5495B", "refused": "#B5495B", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.35)", "border": "transparent"}
    },
    pastelgoth: {
      bg: "#3A3340", text: "#F2E9F0", accent: "#C8B6E2", pointer: "#C8B6E2",
      segs: ["#C8B6E2", "#D9A7C7", "#A88FC0", "#8E7B9E", "#6E6080", "#B695C8"],
      font: "Quicksand",
      parts: {"pillBg": "#3A3340", "pill": "#F2E9F0", "toastBg": "#3A3340", "toast": "#F2E9F0", "cardBg": "#3A3340", "card": "#F2E9F0", "eyebrowBg": "#C8B6E2", "eyebrow": "#3A3340", "idle": "#F2E9F0", "goal": "#F2E9F0", "goalTrack": "rgba(255, 255, 255, 0.18)", "goalFrom": "#D9A7C7", "goalTo": "#C8B6E2", "hub": "#3A3340", "hubRing": "#C8B6E2", "spent": "#C96A8E", "refused": "#C96A8E", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.35)", "border": "transparent"}
    },
    pastelpink: {
      bg: "#FFE3EC", text: "#6A2E4B", accent: "#BF5179", pointer: "#BF5179",
      segs: ["#F7A8C6", "#FFC8DD", "#E0679A", "#FBB1BD", "#D98BB0", "#FFD6E6"],
      font: "Fredoka",
      parts: {"pillBg": "#FFE3EC", "pill": "#6A2E4B", "toastBg": "#FFE3EC", "toast": "#6A2E4B", "cardBg": "#FFE3EC", "card": "#6A2E4B", "eyebrowBg": "#BF5179", "eyebrow": "#FFF5F9", "idle": "#6A2E4B", "goal": "#6A2E4B", "goalTrack": "rgba(106, 46, 75, 0.14)", "goalFrom": "#F7A8C6", "goalTo": "#E0679A", "hub": "#FFE3EC", "hubRing": "#BF5179", "spent": "#D6456F", "refused": "#D6456F", "labelDark": "#4a1d33", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.75)", "border": "transparent"}
    },
    faegreen: {
      bg: "#2C4A36", text: "#EEF5DA", accent: "#C9E265", pointer: "#C9E265",
      segs: ["#C9E265", "#8FB84E", "#E6F29A", "#6E9A45", "#F2F7C0", "#A8CB62"],
      font: "Almendra",
      parts: {"pillBg": "#2C4A36", "pill": "#EEF5DA", "toastBg": "#2C4A36", "toast": "#EEF5DA", "cardBg": "#2C4A36", "card": "#EEF5DA", "eyebrowBg": "#C9E265", "eyebrow": "#2C4A36", "idle": "#EEF5DA", "goal": "#EEF5DA", "goalTrack": "rgba(238, 245, 218, 0.2)", "goalFrom": "#8FB84E", "goalTo": "#D7EE7A", "hub": "#2C4A36", "hubRing": "#C9E265", "spent": "#E0805A", "refused": "#E0805A", "labelDark": "#1F3326", "labelLight": "#FFFFFF", "divider": "rgba(44, 74, 54, 0.45)", "border": "transparent"}
    },
    pride: {
      bg: "rgba(194, 168, 154, 0.9)", text: "#1A1426", accent: "#1A1426", pointer: "#1A1426",
      segs: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"],
      font: "Fredoka",
      flag: ["#E50000", "#FF8D00", "#FFEE00", "#028121", "#004CFF", "#770088"],
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #E50000, #FF8D00, #FFEE00, #028121, #004CFF, #770088)",
      parts: {"pillBg": "rgba(194, 168, 154, 0.9)", "pill": "#1A1426", "toastBg": "rgba(194, 168, 154, 0.96)", "toast": "#1A1426", "cardBg": "rgba(194, 168, 154, 0.96)", "card": "#1A1426", "eyebrowBg": "#1A1426", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#E50000", "goalTo": "#004CFF", "hub": "rgba(194, 168, 154, 0.96)", "hubRing": "#1A1426", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    },
    trans: {
      bg: "rgba(185, 201, 225, 0.9)", text: "#1A1426", accent: "#1A1426", pointer: "#1A1426",
      segs: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#5BCEFA", "#F5A9B8", "#FFFFFF"],
      font: "Fredoka",
      flag: ["#5BCEFA", "#F5A9B8", "#FFFFFF", "#F5A9B8", "#5BCEFA"],
      bgimg: "linear-gradient(135deg, #5BCEFA, #F5A9B8, #FFFFFF, #F5A9B8, #5BCEFA)",
      parts: {"pillBg": "rgba(185, 201, 225, 0.9)", "pill": "#1A1426", "toastBg": "rgba(185, 201, 225, 0.96)", "toast": "#1A1426", "cardBg": "rgba(185, 201, 225, 0.96)", "card": "#1A1426", "eyebrowBg": "#1A1426", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#5BCEFA", "goalTo": "#F5A9B8", "hub": "rgba(185, 201, 225, 0.96)", "hubRing": "#1A1426", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    },
    bi: {
      bg: "rgba(117, 39, 142, 0.9)", text: "#FFFFFF", accent: "#FFFFFF", pointer: "#FFFFFF",
      segs: ["#D60270", "#9B4F96", "#0038A8", "#D60270", "#9B4F96", "#0038A8"],
      font: "Fredoka",
      flag: ["#D60270", "#D60270", "#9B4F96", "#0038A8", "#0038A8"],
      bgimg: "linear-gradient(135deg, #D60270, #D60270, #9B4F96, #0038A8, #0038A8)",
      parts: {"pillBg": "rgba(117, 39, 142, 0.9)", "pill": "#FFFFFF", "toastBg": "rgba(117, 39, 142, 0.96)", "toast": "#FFFFFF", "cardBg": "rgba(117, 39, 142, 0.96)", "card": "#FFFFFF", "eyebrowBg": "#FFFFFF", "eyebrow": "#1A1426", "idle": "#FFFFFF", "goal": "#FFFFFF", "goalTrack": "rgba(255, 255, 255, 0.24)", "goalFrom": "#D60270", "goalTo": "#0038A8", "hub": "rgba(117, 39, 142, 0.96)", "hubRing": "#FFFFFF", "spent": "#FF6B6B", "refused": "#FF6B6B", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(0, 0, 0, 0.3)", "border": "transparent"}
    },
    pan: {
      bg: "rgba(181, 142, 132, 0.9)", text: "#1A1426", accent: "#1A1426", pointer: "#1A1426",
      segs: ["#FF218C", "#FFD800", "#21B1FF", "#FF218C", "#FFD800", "#21B1FF"],
      font: "Fredoka",
      flag: ["#FF218C", "#FFD800", "#21B1FF"],
      bgimg: "linear-gradient(135deg, #FF218C, #FFD800, #21B1FF)",
      parts: {"pillBg": "rgba(181, 142, 132, 0.9)", "pill": "#1A1426", "toastBg": "rgba(181, 142, 132, 0.96)", "toast": "#1A1426", "cardBg": "rgba(181, 142, 132, 0.96)", "card": "#1A1426", "eyebrowBg": "#1A1426", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#FF218C", "goalTo": "#21B1FF", "hub": "rgba(181, 142, 132, 0.96)", "hubRing": "#1A1426", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    },
    enby: {
      bg: "rgba(212, 202, 192, 0.9)", text: "#1A1426", accent: "#2D2D2D", pointer: "#2D2D2D",
      segs: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D", "#FFF433", "#FFFFFF"],
      font: "Fredoka",
      flag: ["#FFF433", "#FFFFFF", "#9B59D0", "#2D2D2D"],
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.45)), linear-gradient(135deg, #FFF433, #FFFFFF, #9B59D0, #2D2D2D)",
      parts: {"pillBg": "rgba(212, 202, 192, 0.9)", "pill": "#1A1426", "toastBg": "rgba(212, 202, 192, 0.96)", "toast": "#1A1426", "cardBg": "rgba(212, 202, 192, 0.96)", "card": "#1A1426", "eyebrowBg": "#2D2D2D", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#FFF433", "goalTo": "#9B59D0", "hub": "rgba(212, 202, 192, 0.96)", "hubRing": "#2D2D2D", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    },
    lesbian: {
      bg: "rgba(232, 167, 169, 0.9)", text: "#1A1426", accent: "#1A1426", pointer: "#1A1426",
      segs: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690"],
      font: "Fredoka",
      flag: ["#D52D00", "#EF7627", "#FF9A56", "#FFFFFF", "#D162A4", "#B55690", "#A30262"],
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.40), rgba(255, 255, 255, 0.40)), linear-gradient(135deg, #D52D00, #EF7627, #FF9A56, #FFFFFF, #D162A4, #B55690, #A30262)",
      parts: {"pillBg": "rgba(232, 167, 169, 0.9)", "pill": "#1A1426", "toastBg": "rgba(232, 167, 169, 0.96)", "toast": "#1A1426", "cardBg": "rgba(232, 167, 169, 0.96)", "card": "#1A1426", "eyebrowBg": "#1A1426", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#D52D00", "goalTo": "#A30262", "hub": "rgba(232, 167, 169, 0.96)", "hubRing": "#1A1426", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    },
    ace: {
      bg: "rgba(202, 187, 202, 0.9)", text: "#1A1426", accent: "#000000", pointer: "#000000",
      segs: ["#A3A3A3", "#FFFFFF", "#800080", "#000000", "#A3A3A3", "#FFFFFF"],
      font: "Fredoka",
      flag: ["#000000", "#A3A3A3", "#FFFFFF", "#800080"],
      bgimg: "linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), linear-gradient(135deg, #000000, #A3A3A3, #FFFFFF, #800080)",
      parts: {"pillBg": "rgba(202, 187, 202, 0.9)", "pill": "#1A1426", "toastBg": "rgba(202, 187, 202, 0.96)", "toast": "#1A1426", "cardBg": "rgba(202, 187, 202, 0.96)", "card": "#1A1426", "eyebrowBg": "#000000", "eyebrow": "#FFFFFF", "idle": "#1A1426", "goal": "#1A1426", "goalTrack": "rgba(26, 20, 38, 0.34)", "goalFrom": "#A3A3A3", "goalTo": "#800080", "hub": "rgba(202, 187, 202, 0.96)", "hubRing": "#000000", "spent": "#B3123A", "refused": "#B3123A", "labelDark": "#111111", "labelLight": "#FFFFFF", "divider": "rgba(255, 255, 255, 0.45)", "border": "transparent"}
    }
  };
  // The baseline the colour fields default to; a preset shows through only until
  // a picker is changed from this baseline. Cosy cabin is the shipped default.
  var BASE = PRESETS.glass;

  var SIZE = 620; // logical canvas size; backing store scales with DPR

  // ---- runtime state ----
  var cfg = {};
  var entries = [];            // { nick, displayName, weight, color }
  var questions = [];          // Truth or... question pool: { nick, displayName, text, color }
  var forfeits = [];             // forfeit pool: { label, weight, color }
  var state = {
    mode: "giveaway", open: false, spinning: false, goalProgress: 0,
    history: [],              // recent winners, most recent first: { label, key }
    openUntil: 0,             // epoch ms the entry window auto-closes (0 = no timer)
    drawsTotal: 1, drawIndex: 0,
    lifelines: null,          // remaining vetoes in questions mode (null = uninitialised)
    current: null             // the question currently on screen in questions mode
  };
  var segments = [];           // current render model (names or forfeits)
  var rotation = 0;            // current wheel rotation, degrees clockwise
  var pendingWinner = null;
  var lastDraw = null;         // { entry, removed } for !spinreroll
  var saveTimer = null;
  var timerInterval = null;
  var idleStarted = false;
  var idleLast = 0;
  var toastQueue = [];
  var toastActive = false;

  var IDLE_DEG_PER_MS = 0.006; // ~6 degrees/second gentle drift

  var el = {};
  var ctx = null;
  var confettiCtx = null;
  var confettiParticles = [];
  var confettiRAF = null;

  function validHex(v) {
    return (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim())) ? v.trim() : "";
  }

  // Fills {n}, {total} and {cmd} in a wording template.
  function tpl(text, vars) {
    return String(text).replace(/\{(n|total|cmd)\}/g, function (m, k) {
      return vars && vars[k] !== undefined ? vars[k] : m;
    });
  }

  function readConfig(f) {
    f = f || {};
    cfg = {
      cmd: str(f.command, "!spin").toLowerCase().trim(),
      whoCanSpin: str(f.whoCanSpin, "mods"),
      defaultMode: str(f.defaultMode, "giveaway"),
      startOpen: bool(f.startOpen, true),
      oneEntryPerUser: bool(f.oneEntryPerUser, true),
      subscriberOnly: bool(f.subscriberOnly, false),
      maxEntriesCap: num(f.maxEntriesCap, 0),
      subscriberWeight: Math.max(1, Math.round(num(f.subscriberWeight, 1))),
      vipWeight: Math.max(1, Math.round(num(f.vipWeight, 1))),
      removeWinner: bool(f.removeWinner, true),
      forfeitCrossOff: bool(f.forfeitCrossOff, true),
      showEntryToast: bool(f.showEntryToast, true),
      winnerCooldown: Math.max(0, Math.round(num(f.winnerCooldown, 0))),
      entrySeconds: Math.max(0, Math.round(num(f.entrySeconds, 0))),
      useChatColors: bool(f.useChatColors, false),
      idleSpin: bool(f.idleSpin, true),
      lifelineCount: Math.max(0, Math.round(num(f.lifelineCount, 4))),
      maxQuestionLen: Math.max(20, Math.round(num(f.maxQuestionLen, 200))),
      questionsAnonymous: bool(f.questionsAnonymous, false),
      enableAutoSpin: bool(f.enableAutoSpin, false),
      triggerType: str(f.triggerType, "sub"),
      triggerCount: str(f.triggerCount, "cumulative"),
      threshold: Math.max(1, num(f.threshold, 10)),
      showGoalBar: bool(f.showGoalBar, true),
      wheelShape: str(f.wheelShape, "semicircle"),
      themePreset: str(f.themePreset, "glass"),
      fontFamily: str(f.fontFamily, BASE.font),
      panelOpacity: clamp(num(f.panelOpacity, 0.55), 0, 1),
      colors: {
        bg: str(f.colorPanel, "#000000"),
        text: str(f.cText, "#FFFFFF"),
        accent: str(f.cAccent, "#FFFFFF"),
        pointer: str(f.colorPointer, "#FFFFFF"),
        segs: [
          str(f.colorSegA, BASE.segs[0]),
          str(f.colorSegB, BASE.segs[1]),
          str(f.colorSegC, BASE.segs[2]),
          str(f.colorSegD, BASE.segs[3]),
          str(f.colorSegE, BASE.segs[4]),
          str(f.colorSegF, BASE.segs[5])
        ]
      },
      // Colours of the individual parts, used when the preset is Custom.
      parts: {
        pillBg: str(f.colorPillBg, "#000000"), pill: str(f.colorPill, "#FFFFFF"),
        toastBg: str(f.colorToastBg, "#000000"), toast: str(f.colorToast, "#FFFFFF"),
        cardBg: str(f.colorCardBg, "#000000"), card: str(f.colorCard, "#FFFFFF"),
        eyebrowBg: str(f.colorEyebrowBg, "#FFFFFF"), eyebrow: str(f.colorEyebrow, "#111111"),
        idle: str(f.colorIdle, "#FFFFFF"), goal: str(f.colorGoal, "#FFFFFF"),
        goalTrack: str(f.colorGoalTrack, "#FFFFFF"), goalFrom: str(f.colorGoalFrom, "#D9D9D9"),
        goalTo: str(f.colorGoalTo, "#FFFFFF"), hub: str(f.colorHub, "#111111"),
        hubRing: str(f.colorHubRing, "#FFFFFF"), spent: str(f.colorSpent, "#ff8a8a"),
        border: str(f.colorBorder, "#FFFFFF"), labelDark: str(f.colorLabelDark, "#111111"),
        labelLight: str(f.colorLabelLight, "#FFFFFF"), divider: str(f.colorDivider, "#000000")
      },
      look: {
        pillRadius: clamp(num(f.pillRadius, 14), 0, 60), pillPadV: clamp(num(f.pillPaddingV, 6), 0, 40),
        pillPadH: clamp(num(f.pillPaddingH, 16), 0, 80), pillTilt: clamp(num(f.pillTilt, 0), -20, 20),
        toastTilt: clamp(num(f.toastTilt, 0), -20, 20), toastRadius: clamp(num(f.toastRadius, 14), 0, 60),
        cardRadius: clamp(num(f.cardRadius, 30), 0, 100), cardTilt: clamp(num(f.cardTilt, 0), -20, 20),
        cardPadV: clamp(num(f.cardPaddingV, 34), 0, 120), cardPadH: clamp(num(f.cardPaddingH, 48), 0, 160),
        cardBorder: clamp(num(f.cardBorderWidth, 0), 0, 30), goalHeight: clamp(num(f.goalHeight, 18), 4, 60),
        hubRing: clamp(num(f.hubRing, 6), 0, 30),
        tail: bool(f.showTail, false), pillShadow: bool(f.pillShadow, false), cardShadow: bool(f.cardShadow, false),
        wheelShadow: bool(f.wheelShadow, false), textShadow: bool(f.textShadow, false),
        rimWidth: clamp(num(f.rimWidth, 8), 0, 40), dividerWidth: clamp(num(f.dividerWidth, 2), 0, 20),
        dividerOpacity: clamp(num(f.dividerOpacity, 0.22), 0, 1), goalTrackOpacity: clamp(num(f.goalTrackOpacity, 0.2), 0, 1),
        labelScale: clamp(num(f.labelScale, 1), 0.5, 2), labelWeight: str(f.labelWeight, "700"),
        idleScale: clamp(num(f.idleScale, 1), 0.4, 3), idleWeight: str(f.idleWeight, "700"),
        toastScale: clamp(num(f.toastScale, 1), 0.4, 3), toastWeight: str(f.toastWeight, "700"),
        pillScale: clamp(num(f.pillScale, 1), 0.4, 3), pillWeight: str(f.pillWeight, "700"),
        goalScale: clamp(num(f.goalScale, 1), 0.4, 3), goalWeight: str(f.goalWeight, "700"),
        eyebrowScale: clamp(num(f.eyebrowScale, 1), 0.4, 3), eyebrowWeight: str(f.eyebrowWeight, "700"),
        eyebrowSpacing: clamp(num(f.eyebrowSpacing, 2), 0, 12), eyebrowUpper: bool(f.eyebrowUppercase, true),
        nameScale: clamp(num(f.nameScale, 1), 0.4, 3), nameWeight: str(f.nameWeight, "800"),
        subScale: clamp(num(f.subScale, 1), 0.4, 3), subWeight: str(f.subWeight, "600"),
        lifeScale: clamp(num(f.lifelineScale, 1), 0.4, 3), lifeWeight: str(f.lifelineWeight, "800"),
        questionScale: clamp(num(f.questionScale, 1), 0.4, 3),
        animate: bool(f.animate, true), toastMs: clamp(num(f.toastSeconds, 0.45), 0, 5),
        cardMs: clamp(num(f.cardSeconds, 0.55), 0, 5), goalMs: clamp(num(f.goalSeconds, 0.6), 0, 5),
        pulseMs: clamp(num(f.pulseSeconds, 1), 0.2, 5)
      },
      words: {
        modeGiveaway: str(f.modeGiveawayLabel, "Giveaway"), modeForfeits: str(f.modeForfeitsLabel, "Forfeits"),
        modeQuestions: str(f.modeQuestionsLabel, "Truth or..."),
        entry: str(f.entryWord, "entry"), entries: str(f.entriesWord, "entries"),
        forfeit: str(f.forfeitWord, "forfeit"), forfeits: str(f.forfeitsWord, "forfeits"),
        question: str(f.questionWord, "question"), questions: str(f.questionsWord, "questions"),
        open: str(f.openLabel, "Entries open"), closed: str(f.closedLabel, "Entries closed"),
        timerPrefix: txt(f.timerPrefix, "Entries close in "), timerSuffix: txt(f.timerSuffix, "s"),
        toastSuffix: txt(f.toastSuffix, " joined!"),
        winner: str(f.winnerLabel, "Winner"), winnerOf: str(f.winnerOfLabel, "Winner {n} of {total}"),
        lastWinner: str(f.lastWinnerLabel, "Last winner"), drawnFrom: txt(f.drawnFromText, "drawn from {n} entries"),
        lifelines: str(f.lifelinesLabel, "Lifelines"), heartFull: str(f.heartFull, "♥"), heartEmpty: str(f.heartEmpty, "♡"),
        lifelineLeft: str(f.lifelineLeftText, "{n} lifeline left, {cmd} to skip"),
        lifelinesLeft: str(f.lifelinesLeftText, "{n} lifelines left, {cmd} to skip"),
        noLifelines: str(f.noLifelinesText, "No lifelines left, no more skips! 🙈"),
        asks: txt(f.asksSuffix, " asks"), anonymousEyebrow: str(f.anonymousEyebrow, "Truth or..."),
        idleQuestions: txt(f.idleQuestionsText, "Type {cmd} your question ☀️"),
        idleForfeits: txt(f.idleForfeitsText, "No forfeits yet, {cmd} to add some"),
        goalSub: str(f.goalSubLabel, "Sub goal"), goalFollows: str(f.goalFollowsLabel, "Follower goal"),
        goalBits: str(f.goalBitsLabel, "Bits goal"), goalTips: str(f.goalTipsLabel, "Tip goal"),
        goalDefault: str(f.goalDefaultLabel, "Goal")
      },
      sounds: {
        enter: { url: str(f.enterSound, ""), vol: clamp(num(f.enterSoundVolume, 60), 0, 100) },
        tick: { url: str(f.tickSound, ""), vol: clamp(num(f.tickSoundVolume, 45), 0, 100) },
        win: { url: str(f.winSound, ""), vol: clamp(num(f.winSoundVolume, 80), 0, 100) }
      },
      enableSounds: bool(f.enableSounds, true),
      idleMessage: txt(f.idleMessage, "Type !spintowin to enter"),
      spinDuration: Math.max(800, num(f.spinDuration, 6000)),
      winnerDisplayDuration: Math.max(800, num(f.winnerDisplayDuration, 6000))
    };
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  // A preset drives the whole look. Choosing "Custom" uses the colour pickers and
  // font field instead. This stays format-independent on purpose: StreamElements
  // hands colour values back in its own format (often rgba, not the #hex we ship),
  // so comparing a field against a baseline to detect "did they change it" was
  // unreliable and made every preset render with the same field colours.
  function resolvedTheme() {
    if (cfg.themePreset === "custom") {
      var c = cfg.colors, q = cfg.parts, a = cfg.panelOpacity;
      return {
        bg: rgba(c.bg, a), text: c.text, accent: c.accent, pointer: c.pointer,
        segs: c.segs.slice(), font: cfg.fontFamily,
        parts: {
          pillBg: rgba(q.pillBg, a), pill: q.pill, toastBg: rgba(q.toastBg, a), toast: q.toast,
          cardBg: rgba(q.cardBg, a), card: q.card, eyebrowBg: q.eyebrowBg, eyebrow: q.eyebrow,
          idle: q.idle, goal: q.goal, goalTrack: rgba(q.goalTrack, cfg.look.goalTrackOpacity),
          goalFrom: q.goalFrom, goalTo: q.goalTo, hub: q.hub, hubRing: q.hubRing,
          spent: q.spent, refused: q.spent, border: q.border, labelDark: q.labelDark,
          labelLight: q.labelLight, divider: rgba(q.divider, cfg.look.dividerOpacity)
        }
      };
    }
    var p = PRESETS[cfg.themePreset] || BASE;
    // A preset that does not name every part colours it from its own three tones.
    var parts = {
      pillBg: p.accent, pill: p.bg, toastBg: p.accent, toast: p.bg, cardBg: p.accent, card: p.bg,
      eyebrowBg: p.bg, eyebrow: p.accent, idle: p.text, goal: p.text,
      goalTrack: "rgba(255, 255, 255, 0.7)", goalFrom: p.segs[1], goalTo: p.accent,
      hub: p.bg, hubRing: p.accent, spent: "#d64545", refused: "#d64545", border: "transparent",
      labelDark: "#3a2a1d", labelLight: "#ffffff", divider: "rgba(255, 255, 255, 0.7)"
    };
    var over = p.parts || {};
    Object.keys(over).forEach(function (k) { parts[k] = over[k]; });
    return {
      bg: p.bg, text: p.text, accent: p.accent, pointer: p.pointer,
      segs: p.segs.slice(), font: p.font, parts: parts, bgimg: p.bgimg || "", flag: p.flag || null
    };
  }

  // Redraw the wheel, and re-fit the winner card, once a web font is actually
  // available. This runs when the font was already loaded, and again whenever the
  // browser finishes loading one, because asking for a font before its stylesheet
  // has arrived resolves at once with nothing, and without the second call the
  // canvas would keep the fallback font it was first drawn in.
  function onFontsReady() {
    drawWheel();
    if (el.winnerOverlay && !el.winnerOverlay.hidden) {
      fitEyebrow();
      if (el.winnerOverlay.classList.contains("is-question")) fitQuestion();
      else fitWinnerName();
    }
  }
  if (typeof document !== "undefined" && document.fonts && typeof document.fonts.addEventListener === "function") {
    document.fonts.addEventListener("loadingdone", onFontsReady);
  }

  // A flag is a list of stripes, top to bottom. A bar can wear it as horizontal bands.
  function flagGradient(stripes) {
    var n = stripes.length, parts = [];
    for (var i = 0; i < n; i++) parts.push(stripes[i] + " " + (i * 100 / n) + "% " + ((i + 1) * 100 / n) + "%");
    return "linear-gradient(180deg, " + parts.join(", ") + ")";
  }

  function applyTheme() {
    var t = resolvedTheme();
    var root = el.app;
    root.style.setProperty("--bg", t.bg);
    root.style.setProperty("--text", t.text);
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--pointer", t.pointer);
    t.segs.forEach(function (col, i) {
      root.style.setProperty("--seg-" + "abcdef"[i], col);
    });
    root.style.setProperty("--font", '"' + t.font + '", "Quicksand", sans-serif');

    var P = t.parts, L = cfg.look;
    var set = function (k, v) { root.style.setProperty(k, v); };
    set("--c-pill-bg", P.pillBg); set("--c-pill", P.pill);
    set("--c-toast-bg", P.toastBg); set("--c-toast", P.toast);
    set("--c-card-bg", P.cardBg); set("--c-card", P.card);
    set("--c-eyebrow-bg", P.eyebrowBg); set("--c-eyebrow", P.eyebrow);
    set("--c-idle", P.idle); set("--c-goal", P.goal); set("--c-goal-track", P.goalTrack);
    set("--c-goal-from", P.goalFrom); set("--c-goal-to", P.goalTo);
    // A flag preset puts its flag behind the pills, the toast and the winner card, and stripes the goal bar.
    set("--flag-img", t.bgimg || "none");
    set("--goal-flag", t.flag ? flagGradient(t.flag) : "");
    set("--flag-edge", t.flag ? "inset 0 0 0 1px rgba(20, 16, 38, 0.38)" : "none");
    set("--c-life-bg", P.pillBg); set("--c-life", P.pill);
    set("--c-spent", P.spent); set("--c-refused", P.refused);
    set("--c-hub", P.hub); set("--c-hub-ring", P.hubRing); set("--c-border", P.border);

    set("--idle-scale", String(L.idleScale)); set("--idle-w", L.idleWeight);
    set("--toast-scale", String(L.toastScale)); set("--toast-w", L.toastWeight);
    set("--pill-scale", String(L.pillScale)); set("--pill-w", L.pillWeight);
    set("--goal-scale", String(L.goalScale)); set("--goal-w", L.goalWeight);
    set("--eyebrow-scale", String(L.eyebrowScale)); set("--eyebrow-w", L.eyebrowWeight);
    set("--eyebrow-spacing", String(L.eyebrowSpacing)); set("--eyebrow-case", L.eyebrowUpper ? "uppercase" : "none");
    set("--name-scale", String(L.nameScale)); set("--name-w", L.nameWeight);
    set("--sub-scale", String(L.subScale)); set("--sub-w", L.subWeight);
    set("--life-scale", String(L.lifeScale)); set("--life-w", L.lifeWeight);
    set("--question-scale", String(L.questionScale));
    set("--pill-radius", String(L.pillRadius)); set("--pill-tilt", L.pillTilt + "deg");
    set("--pill-pad-v", String(L.pillPadV)); set("--pill-pad-h", String(L.pillPadH));
    set("--toast-tilt", L.toastTilt + "deg"); set("--toast-radius", String(L.toastRadius));
    set("--card-radius", String(L.cardRadius)); set("--card-tilt", L.cardTilt + "deg");
    set("--card-pad-v", String(L.cardPadV)); set("--card-pad-h", String(L.cardPadH));
    set("--card-border", L.cardBorder + "px");
    set("--goal-h", String(L.goalHeight)); set("--hub-ring", String(L.hubRing));
    set("--tail-display", L.tail ? "block" : "none");
    set("--pill-shadow", L.pillShadow ? "0 5px 12px rgba(0, 0, 0, 0.26)" : "none");
    set("--card-shadow", L.cardShadow ? "0 16px 44px rgba(0, 0, 0, 0.30)" : "none");
    set("--wheel-shadow", L.wheelShadow ? "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.18))" : "none");
    set("--text-shadow", L.textShadow ? "0 1px 4px rgba(0, 0, 0, 0.55)" : "none");
    set("--toast-s", L.toastMs + "s"); set("--card-s", L.cardMs + "s");
    set("--goal-s", L.goalMs + "s"); set("--pulse-s", L.pulseMs + "s");
    if (L.animate) root.classList.remove("no-motion");
    else root.classList.add("no-motion");

    document.body.style.background = "transparent";
    loadFont(t.font);
    el.app._theme = t;
    // The web font arrives after this runs, so redraw once it is ready or the
    // canvas labels and reveal are measured with the wrong (fallback) metrics.
    whenFontReady(t.font, onFontsReady);
  }

  function whenFontReady(family, cb) {
    try {
      if (document.fonts && document.fonts.load) {
        document.fonts.load('24px "' + family + '"').then(cb).catch(function () {});
        return;
      }
    } catch (e) { /* fall through */ }
    setTimeout(cb, 300); // best-effort fallback where the Font Loading API is absent
  }

  // BioRhyme is a variable font, so ask for its whole weight range and every
  // boldness the settings offer is drawn for real. Other families are requested
  // plainly because single-weight ones (such as Chicle) reject a weight axis.
  var FONT_WEIGHTS = { "BioRhyme": ":wght@200..800" };

  function loadFont(name) {
    if (!name) return;
    var id = "wheel-font-link";
    // No weight axis: the css2 API rejects it for single-weight families (e.g. Chicle),
    // so request the family plainly and let the browser faux-bold heavier weights.
    var href = "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(name).replace(/%20/g, "+") + (FONT_WEIGHTS[name] || "") + "&display=swap";
    var link = document.getElementById(id);
    if (!link) {
      link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== href) link.href = href;
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------
  function hasStore() {
    return typeof SE_API !== "undefined" && SE_API && SE_API.store &&
      typeof SE_API.store.set === "function";
  }
  function saveState() {
    if (!hasStore()) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        SE_API.store.set(STORE_KEY, {
          entries: entries,
          questions: questions,
          forfeits: forfeits,
          mode: state.mode,
          open: state.open,
          goalProgress: state.goalProgress,
          history: state.history,
          openUntil: state.openUntil,
          lifelines: state.lifelines
        });
      } catch (e) { /* store is best-effort */ }
    }, 400);
  }
  function restoreState(done) {
    if (!hasStore() || typeof SE_API.store.get !== "function") { done(false); return; }
    try {
      Promise.resolve(SE_API.store.get(STORE_KEY)).then(function (saved) {
        if (saved && typeof saved === "object") {
          if (Array.isArray(saved.entries)) entries = saved.entries;
          if (Array.isArray(saved.questions)) questions = saved.questions;
          if (Array.isArray(saved.forfeits)) forfeits = saved.forfeits;
          if (typeof saved.lifelines === "number") state.lifelines = saved.lifelines;
          if (saved.mode === "giveaway" || saved.mode === "forfeits" || saved.mode === "questions") state.mode = saved.mode;
          if (typeof saved.open === "boolean") state.open = saved.open;
          if (typeof saved.goalProgress === "number") state.goalProgress = saved.goalProgress;
          if (Array.isArray(saved.history)) state.history = saved.history;
          if (typeof saved.openUntil === "number") state.openUntil = saved.openUntil;
          done(true);
        } else {
          done(false);
        }
      }).catch(function () { done(false); });
    } catch (e) { done(false); }
  }

  function canManage(roles) {
    if (roles.broadcaster) return true;
    return cfg.whoCanSpin === "mods" && roles.mod;
  }
  function weightFor(roles) {
    var w = 1;
    if (roles.sub) w = Math.max(w, cfg.subscriberWeight);
    if (roles.vip) w = Math.max(w, cfg.vipWeight);
    return w;
  }

  // ---------------------------------------------------------------------------
  // Entries
  // ---------------------------------------------------------------------------
  function findEntry(nick) {
    for (var i = 0; i < entries.length; i++) if (entries[i].nick === nick) return i;
    return -1;
  }
  function handleEnter(data, roles) {
    if (state.mode !== "giveaway" || !state.open) return;
    if (cfg.subscriberOnly && !roles.sub && !roles.vip && !roles.mod && !roles.broadcaster) return;
    var nick = String(data.nick || data.displayName || "").toLowerCase();
    if (!nick) return;
    var display = String(data.displayName || data.nick || nick);
    var color = validHex(data.color) || validHex(data.tags && data.tags.color) || "";
    var weight = weightFor(roles);
    var idx = findEntry(nick);
    if (idx >= 0) {
      if (cfg.oneEntryPerUser) {
        // keep them in, but let an improved weight (e.g. resubbed) apply
        if (weight > entries[idx].weight) entries[idx].weight = weight;
        if (color) entries[idx].color = color;
        return;
      }
    }
    if (cfg.maxEntriesCap > 0 && entries.length >= cfg.maxEntriesCap) return;
    entries.push({ nick: nick, displayName: display, weight: weight, color: color });
    pulse(el.entryCount);
    if (cfg.showEntryToast) showToast(display + cfg.words.toastSuffix);
    playSound("enter");
    refresh();
    saveState();
  }
  function clearEntries() {
    if (state.mode === "questions") {
      questions = [];
      state.current = null;
      state.lifelines = cfg.lifelineCount;
      hideWinner();
    } else {
      entries = [];
    }
    refresh();
    saveState();
  }

  // Truth or...: a viewer submits a question with !spinask <question>.
  function handleAsk(data, roles, rawText) {
    if (state.mode !== "questions" || !state.open) return;
    if (cfg.subscriberOnly && !roles.sub && !roles.vip && !roles.mod && !roles.broadcaster) return;
    var text = String(rawText || "").trim();
    if (text.length < 3) return;
    if (text.length > cfg.maxQuestionLen) text = text.slice(0, cfg.maxQuestionLen);
    if (cfg.maxEntriesCap > 0 && questions.length >= cfg.maxEntriesCap) return;
    var nick = String(data.nick || data.displayName || "").toLowerCase();
    if (!nick) return;
    questions.push({
      nick: nick,
      displayName: String(data.displayName || nick),
      text: text,
      color: validHex(data.color) || validHex(data.tags && data.tags.color) || ""
    });
    pulse(el.entryCount);
    refresh();
    saveState();
  }
  // Mod-added entrants by name (comma-separated), handy for testing or adding
  // someone who could not type the command themselves.
  function addManualEntry(rest) {
    if (state.mode !== "giveaway") return;
    var added = false;
    String(rest || "").split(",").forEach(function (part) {
      var display = part.trim().replace(/^@/, "");
      if (!display) return;
      var nick = display.toLowerCase();
      if (cfg.oneEntryPerUser && findEntry(nick) >= 0) return;
      if (cfg.maxEntriesCap > 0 && entries.length >= cfg.maxEntriesCap) return;
      entries.push({ nick: nick, displayName: display, weight: 1 });
      added = true;
    });
    if (added) { pulse(el.entryCount); refresh(); saveState(); }
  }
  function removeEntrant(arg) {
    if (!arg) return;
    var key = String(arg).replace(/^@/, "").toLowerCase();
    if (state.mode === "questions") {
      var qBefore = questions.length;
      questions = questions.filter(function (q) {
        return q.nick !== key && q.displayName.toLowerCase() !== key;
      });
      if (state.current && (state.current.nick === key ||
          state.current.displayName.toLowerCase() === key)) {
        state.current = null;
        hideWinner();
      }
      if (questions.length !== qBefore) { refresh(); saveState(); }
      return;
    }
    var before = entries.length;
    entries = entries.filter(function (e) {
      return e.nick !== key && e.displayName.toLowerCase() !== key;
    });
    if (entries.length !== before) { refresh(); saveState(); }
  }

  // ---------------------------------------------------------------------------
  // Forfeits (label | weight | #colour)
  // ---------------------------------------------------------------------------
  function parseForfeitItem(part) {
    part = String(part).trim();
    if (!part) return null;
    var bits = part.split("|");
    var label = bits[0].trim();
    if (!label) return null;
    return {
      label: label,
      weight: bits.length > 1 ? Math.max(0.01, num(bits[1], 1)) : 1,
      color: bits.length > 2 ? (validHex(bits[2].trim()) || null) : null
    };
  }
  function findForfeit(label) {
    var key = String(label).trim().toLowerCase();
    for (var i = 0; i < forfeits.length; i++) if (forfeits[i].label.toLowerCase() === key) return i;
    return -1;
  }
  // !spinforfeitadd Karaoke hour, Pyjama party  (each item may be label|weight|#colour)
  function addForfeit(rest) {
    var added = false;
    String(rest || "").split(",").forEach(function (part) {
      var p = parseForfeitItem(part);
      if (!p || findForfeit(p.label) >= 0) return; // skip blanks and duplicate labels
      forfeits.push(p);
      added = true;
    });
    if (added) { pulse(el.entryCount); refresh(); saveState(); }
  }
  function removeForfeit(rest) {
    var key = String(rest || "").trim().toLowerCase();
    if (!key) return;
    var before = forfeits.length;
    forfeits = forfeits.filter(function (p) { return p.label.toLowerCase() !== key; });
    if (forfeits.length !== before) { refresh(); saveState(); }
  }
  function clearForfeits() {
    forfeits = [];
    refresh();
    saveState();
  }
  function buildSegments() {
    var theme = el.app._theme || resolvedTheme();
    var palette = theme.segs;
    if (state.mode === "questions") {
      segments = questions.map(function (q, i) {
        var label = cfg.questionsAnonymous ? ("Q" + (i + 1)) : q.displayName;
        var col = (cfg.useChatColors && validHex(q.color)) ? q.color : palette[i % palette.length];
        return { label: label, weight: 1, color: col, _q: q };
      });
    } else if (state.mode === "forfeits") {
      segments = forfeits.map(function (p, i) {
        return { label: p.label, weight: p.weight, color: p.color || palette[i % palette.length], _forfeit: p };
      });
    } else {
      segments = entries.map(function (en, i) {
        var col = (cfg.useChatColors && validHex(en.color)) ? en.color : palette[i % palette.length];
        return { label: en.displayName, weight: en.weight, color: col, _entry: en };
      });
    }
    // angular geometry, clockwise degrees from the top (pointer)
    var total = segments.reduce(function (s, x) { return s + x.weight; }, 0) || 1;
    var acc = 0;
    segments.forEach(function (seg) {
      var span = (seg.weight / total) * 360;
      seg.start = acc;
      seg.end = acc + span;
      seg.mid = acc + span / 2;
      acc += span;
    });
  }

  // ---------------------------------------------------------------------------
  // Canvas wheel
  // ---------------------------------------------------------------------------
  function setupCanvas() {
    var dpr = window.devicePixelRatio || 1;
    el.canvas.width = SIZE * dpr;
    el.canvas.height = SIZE * dpr;
    ctx = el.canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    el.confetti.width = SIZE * dpr;
    el.confetti.height = SIZE * dpr;
    confettiCtx = el.confetti.getContext("2d");
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function canvasAngle(deg) { return (deg - 90) * Math.PI / 180; }

  function luminance(hex) {
    var c = String(hex).replace("#", "");
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = parseInt(c.substr(0, 2), 16) || 0;
    var g = parseInt(c.substr(2, 2), 16) || 0;
    var b = parseInt(c.substr(4, 2), 16) || 0;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function drawWheel() {
    if (!ctx) return;
    var cx = SIZE / 2, cy = SIZE / 2, R = SIZE / 2 - 6;
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!segments.length) {
      // Solid, readable disc when empty so the idle message isn't lost over the scene.
      var t0 = el.app._theme || resolvedTheme();
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = t0.bg;
      ctx.fill();
      if (cfg.look.rimWidth > 0) {
        ctx.lineWidth = cfg.look.rimWidth;
        ctx.strokeStyle = t0.accent;
        ctx.stroke();
      }
      return;
    }
    var single = segments.length === 1;
    segments.forEach(function (seg) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, canvasAngle(seg.start), canvasAngle(single ? seg.end - 0.0001 : seg.end));
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      if (cfg.look.dividerWidth > 0) {
        ctx.lineWidth = cfg.look.dividerWidth;
        ctx.strokeStyle = (el.app._theme || resolvedTheme()).parts.divider;
        ctx.stroke();
      }
    });

    // outer rim
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    if (cfg.look.rimWidth > 0) {
      ctx.lineWidth = cfg.look.rimWidth;
      ctx.strokeStyle = (el.app._theme || resolvedTheme()).accent;
      ctx.stroke();
    }

    // labels: sized to the slice and truncated to the real width between the rim
    // and the hub, measured in the actual font so no font can overspill.
    var labelR = R * 0.62;
    var themeFont = (el.app._theme || resolvedTheme()).font;
    var maxTextW = (R - 18) - R * 0.20; // rim padding in, minus a gap for the hub
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    segments.forEach(function (seg) {
      var span = seg.end - seg.start;
      var arcPx = (span * Math.PI / 180) * labelR;
      if (arcPx < 15) return; // too thin to read
      var fontSize = Math.max(12, Math.min(30, arcPx * 0.7, R * 0.12) * cfg.look.labelScale);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(canvasAngle(seg.mid));
      var tp = (el.app._theme || resolvedTheme()).parts;
      ctx.fillStyle = luminance(seg.color) > 0.6 ? tp.labelDark : tp.labelLight;
      ctx.font = cfg.look.labelWeight + " " + fontSize + "px '" + themeFont + "', sans-serif";
      ctx.fillText(ellipsize(String(seg.label), maxTextW), R - 18, 0);
      ctx.restore();
    });
  }

  // Trim text to fit maxW in the ctx's current font, adding an ellipsis.
  function ellipsize(text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + "…").width > maxW) {
      text = text.slice(0, -1);
    }
    return text + "…";
  }

  function segmentUnderPointer() {
    if (!segments.length) return -1;
    var topAngle = ((-rotation) % 360 + 360) % 360;
    for (var i = 0; i < segments.length; i++) {
      if (topAngle >= segments[i].start && topAngle < segments[i].end) return i;
    }
    return segments.length - 1;
  }

  // ---------------------------------------------------------------------------
  // Spin
  // ---------------------------------------------------------------------------
  function segKey(seg) {
    return seg._entry ? seg._entry.nick : ("forfeit:" + seg.label);
  }
  // Weighted random over the eligible segments, skipping anyone still inside the
  // recent-winner cooldown window (unless that would leave nobody to pick).
  function pickIndex() {
    var pool = [];
    for (var i = 0; i < segments.length; i++) pool.push(i);
    if (cfg.winnerCooldown > 0 && state.history.length) {
      var blocked = {};
      state.history.slice(0, cfg.winnerCooldown).forEach(function (h) { blocked[h.key] = true; });
      var eligible = pool.filter(function (i) { return !blocked[segKey(segments[i])]; });
      if (eligible.length) pool = eligible;
    }
    var total = 0;
    pool.forEach(function (i) { total += segments[i].weight; });
    var r = Math.random() * total;
    for (var k = 0; k < pool.length; k++) {
      r -= segments[pool[k]].weight;
      if (r <= 0) return pool[k];
    }
    return pool[pool.length - 1];
  }

  // count = how many winners to draw in this sequence (via `!spin 3`).
  function triggerSpin(count) {
    if (state.spinning) return;
    if (state.mode === "questions") { questionAdvance(true); return; }
    buildSegments();
    if (!segments.length) return;
    var cap = state.mode === "giveaway" ? Math.max(1, entries.length)
      : state.mode === "forfeits" ? Math.max(1, forfeits.length) : (count || 1);
    state.drawsTotal = Math.min(Math.max(1, Math.round(count || 1)), cap);
    state.drawIndex = 0;
    spinOnce();
  }

  function spinOnce() {
    buildSegments();
    if (!segments.length) { endSequence(); return; }
    if (state.mode === "questions") hideWinner(); // reveal the wheel spin, not the old card
    state.spinning = true;
    el.app.classList.add("is-spinning");

    var winIdx = pickIndex();
    pendingWinner = segments[winIdx];

    var spins = 5 + Math.floor(Math.random() * 3);
    var cWin = pendingWinner.mid;
    var align = ((360 - ((rotation + cWin) % 360)) % 360 + 360) % 360;
    var target = rotation + align + 360 * spins;

    animateTo(target, cfg.spinDuration);
  }

  function endSequence() {
    state.spinning = false;
    el.app.classList.remove("is-spinning");
    state.drawsTotal = 1;
    state.drawIndex = 0;
    maybeAutoSpin();
  }

  function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

  function animateTo(target, dur) {
    var start = rotation;
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var lastSeg = segmentUnderPointer();
    function frame() {
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var p = Math.min(1, (now - t0) / dur);
      rotation = start + (target - start) * easeOutCubic(p);
      el.canvas.style.transform = "rotate(" + rotation + "deg)";
      var seg = segmentUnderPointer();
      if (seg !== lastSeg) { lastSeg = seg; playTick(); }
      if (p < 1) requestAnimationFrame(frame);
      else finishSpin();
    }
    requestAnimationFrame(frame);
  }

  function finishSpin() {
    rotation = ((rotation % 360) + 360) % 360; // keep the number small
    el.canvas.style.transform = "rotate(" + rotation + "deg)";
    state.spinning = false;
    el.app.classList.remove("is-spinning");

    // Truth or...: the drawn question stays on screen until the streamer deals with it.
    if (state.mode === "questions") {
      state.current = pendingWinner._q;
      showQuestion(state.current);
      playWin();
      burstConfetti();
      refresh();
      saveState();
      return;
    }

    var multi = state.drawsTotal > 1;
    showWinner(pendingWinner, multi
      ? tpl(cfg.words.winnerOf, { n: state.drawIndex + 1, total: state.drawsTotal })
      : cfg.words.winner);
    playWin();
    burstConfetti();
    recordWinner(pendingWinner);

    var winnerEntry = pendingWinner && pendingWinner._entry;
    var winnerForfeit = pendingWinner && pendingWinner._forfeit;
    var removeThisDraw = multi || cfg.removeWinner; // multi-draw always removes so winners are distinct
    lastDraw = { entry: winnerEntry, removed: false };

    setTimeout(function () {
      hideWinner();
      if (state.mode === "giveaway" && removeThisDraw && winnerEntry) {
        var idx = findEntry(winnerEntry.nick);
        if (idx >= 0) { entries.splice(idx, 1); lastDraw.removed = true; }
        refresh();
        saveState();
      } else if (state.mode === "forfeits" && cfg.forfeitCrossOff && winnerForfeit) {
        // cross the forfeit off the list once it's landed on
        var fi = forfeits.indexOf(winnerForfeit);
        if (fi >= 0) forfeits.splice(fi, 1);
        refresh();
        saveState();
      }
      var poolLeft = state.mode === "giveaway" ? entries.length
        : state.mode === "forfeits" ? forfeits.length : 1;
      if (state.drawIndex < state.drawsTotal - 1 && poolLeft > 0) {
        state.drawIndex++;
        spinOnce();
      } else {
        endSequence();
      }
    }, cfg.winnerDisplayDuration);
  }

  function recordWinner(seg) {
    if (!seg) return;
    state.history.unshift({ label: seg.label, key: segKey(seg) });
    var cap = Math.max(20, cfg.winnerCooldown);
    if (state.history.length > cap) state.history.length = cap;
    saveState();
  }

  function showWinner(seg, eyebrow) {
    if (!seg) return;
    el.winnerOverlay.classList.remove("is-question");
    if (el.winnerEyebrow) el.winnerEyebrow.textContent = eyebrow || cfg.words.winner;
    el.winnerName.textContent = seg.label;
    el.winnerSub.textContent = state.mode === "forfeits" ? "" :
      (seg.weight > 1 ? tpl(cfg.words.drawnFrom, { n: entries.length }) : "");
    el.winnerOverlay.hidden = false;
    // retrigger the pop animation
    el.winnerOverlay.style.animation = "none";
    void el.winnerOverlay.offsetWidth;
    el.winnerOverlay.style.animation = "";
    fitEyebrow();
    fitWinnerName();
  }

  // Re-show the most recent winner on the overlay (no chat needed).
  function showLastWinner() {
    if (!state.history.length || state.spinning) return;
    el.winnerOverlay.classList.remove("is-question");
    if (el.winnerEyebrow) el.winnerEyebrow.textContent = cfg.words.lastWinner;
    el.winnerName.textContent = state.history[0].label;
    el.winnerSub.textContent = "";
    el.winnerOverlay.hidden = false;
    el.winnerOverlay.style.animation = "none";
    void el.winnerOverlay.offsetWidth;
    el.winnerOverlay.style.animation = "";
    fitWinnerName();
    setTimeout(hideWinner, cfg.winnerDisplayDuration);
  }

  // Put the last drawn winner back and spin again.
  function reroll() {
    if (state.spinning) return;
    if (lastDraw && lastDraw.removed && lastDraw.entry) {
      if (findEntry(lastDraw.entry.nick) < 0) entries.push(lastDraw.entry);
      lastDraw.removed = false;
    }
    if (state.history.length) state.history.shift();
    refresh();
    saveState();
    triggerSpin(1);
  }

  // ---------------------------------------------------------------------------
  // Truth or... (question mode with veto lifelines; the consequence is the
  // streamer's to decide, so nothing here names or encourages one)
  // ---------------------------------------------------------------------------
  function lifelinesLeft() {
    return (typeof state.lifelines === "number") ? state.lifelines : cfg.lifelineCount;
  }
  function updateLifelines() {
    if (!el.lifelines) return;
    var show = state.mode === "questions";
    el.lifelines.hidden = !show;
    if (!show) return;
    var total = cfg.lifelineCount, rem = Math.max(0, Math.min(lifelinesLeft(), total));
    var hearts = "";
    for (var i = 0; i < total; i++) hearts += (i < rem) ? cfg.words.heartFull : cfg.words.heartEmpty;
    el.lifelines.textContent = cfg.words.lifelines + " " + hearts;
    el.lifelines.classList.toggle("spent", rem === 0);
  }
  function lifelineText() {
    var n = lifelinesLeft();
    return n > 0
      ? tpl(n === 1 ? cfg.words.lifelineLeft : cfg.words.lifelinesLeft, { n: n, cmd: cfg.cmd + " veto" })
      : cfg.words.noLifelines;
  }
  function showQuestion(q) {
    if (!q) return;
    el.winnerOverlay.classList.add("is-question");
    if (el.winnerEyebrow) {
      el.winnerEyebrow.textContent = (!cfg.questionsAnonymous && q.displayName)
        ? (q.displayName + cfg.words.asks) : cfg.words.anonymousEyebrow;
    }
    el.winnerName.textContent = q.text;
    el.winnerSub.textContent = lifelineText();
    el.winnerSub.classList.remove("refused");
    el.winnerOverlay.hidden = false;
    el.winnerOverlay.style.animation = "none";
    void el.winnerOverlay.offsetWidth;
    el.winnerOverlay.style.animation = "";
    fitEyebrow();
    fitQuestion();
  }

  // Shrink a long question so it fits the card height instead of spilling or
  // being clipped. Wrapping handles the width; this handles the height.
  function fitQuestion() {
    var node = el.winnerName;
    var MAX = 34, MIN = 15;
    node.style.whiteSpace = ""; // let the CSS wrap the question
    var capPx = (window.innerHeight || 900) * 0.42;
    node.style.fontSize = MAX + "px";
    var size = MAX, guard = 30;
    while (size > MIN && node.scrollHeight > capPx && guard-- > 0) {
      size -= 2;
      node.style.fontSize = size + "px";
    }
  }

  // Resolve the question on screen (answered/vetoed/struck) and draw the next.
  function questionAdvance() {
    if (state.spinning) return;
    if (state.current) { removeQuestionRef(state.current); state.current = null; }
    buildSegments();
    if (!segments.length) { hideWinner(); refresh(); saveState(); return; }
    spinOnce();
  }
  function removeQuestionRef(ref) {
    questions = questions.filter(function (q) { return q !== ref; });
  }

  function veto() {
    if (state.mode !== "questions" || state.spinning) return;
    if (!state.current) return;
    if (lifelinesLeft() <= 0) { flashNoLifelines(); return; }
    state.lifelines = lifelinesLeft() - 1;
    updateLifelines();
    saveState();
    questionAdvance();
  }
  function strike() {
    if (state.mode !== "questions" || state.spinning || !state.current) return;
    questionAdvance(); // mod removal of the current question, no lifeline spent
  }
  function resetLifelines() {
    state.lifelines = cfg.lifelineCount;
    updateLifelines();
    saveState();
  }
  function flashNoLifelines() {
    if (!el.winnerSub) return;
    el.winnerSub.textContent = "No lifelines left, no more skips! 🙈";
    el.winnerSub.classList.add("refused");
  }

  // Scale the winner name down so long usernames fit on one line, and if even the
  // smallest size still will not fit, let it wrap rather than spill out of the card.
  function fitWinnerName() {
    var node = el.winnerName;
    var MAX = 56, MIN = 16;
    node.style.whiteSpace = "nowrap";
    node.style.fontSize = MAX + "px";
    var avail = node.clientWidth;
    var needed = node.scrollWidth;
    if (!(avail > 0) || !(needed > avail)) return;
    var size = Math.max(MIN, Math.floor(MAX * avail / needed));
    node.style.fontSize = size + "px";
    var guard = 50;
    while (size > MIN && node.scrollWidth > node.clientWidth && guard-- > 0) {
      size -= 1;
      node.style.fontSize = size + "px";
    }
    if (node.scrollWidth > node.clientWidth) node.style.whiteSpace = "normal"; // wrap as a last resort
  }

  // Shrink the eyebrow (e.g. "LONGUSERNAME ASKS") so it fits the card width;
  // if even the smallest size will not fit, the CSS break-word lets it wrap.
  function fitEyebrow() {
    var node = el.winnerEyebrow;
    if (!node) return;
    var MAX = state.mode === "questions" ? 18 : 22, MIN = 11;
    node.style.whiteSpace = "nowrap";
    node.style.fontSize = MAX + "px";
    var size = MAX, guard = 30;
    while (size > MIN && node.clientWidth > 0 && node.scrollWidth > node.clientWidth && guard-- > 0) {
      size -= 1;
      node.style.fontSize = size + "px";
    }
    node.style.whiteSpace = ""; // back to normal; wraps only if it still overflows at MIN
  }
  function hideWinner() { el.winnerOverlay.hidden = true; }

  // ---------------------------------------------------------------------------
  // Confetti
  // ---------------------------------------------------------------------------
  function burstConfetti() {
    var theme = el.app._theme || resolvedTheme();
    var colors = theme.segs.concat([theme.accent]);
    var cx = SIZE / 2, cy = SIZE / 2;
    for (var i = 0; i < 140; i++) {
      var ang = Math.random() * Math.PI * 2;
      var speed = 4 + Math.random() * 9;
      confettiParticles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 4,
        size: 5 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        life: 1
      });
    }
    if (!confettiRAF) confettiRAF = requestAnimationFrame(confettiFrame);
  }
  function confettiFrame() {
    confettiCtx.clearRect(0, 0, SIZE, SIZE);
    for (var i = confettiParticles.length - 1; i >= 0; i--) {
      var p = confettiParticles[i];
      p.vy += 0.22;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 0.012;
      if (p.life <= 0 || p.y > SIZE + 40) { confettiParticles.splice(i, 1); continue; }
      confettiCtx.save();
      confettiCtx.globalAlpha = Math.max(0, p.life);
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
    }
    if (confettiParticles.length) requestAnimationFrame(confettiFrame);
    else { confettiCtx.clearRect(0, 0, SIZE, SIZE); confettiRAF = null; }
  }

  // ---------------------------------------------------------------------------
  // Sounds
  // ---------------------------------------------------------------------------
  // A sound is a file uploaded into the widget settings. Each play makes a fresh
  // Audio so quick sounds can overlap, and a browser that refuses to autoplay stays
  // quiet rather than erroring.
  function playSound(kind) {
    var snd = cfg.sounds && cfg.sounds[kind];
    if (!cfg.enableSounds || !snd || !snd.url) return;
    if (typeof Audio === "undefined") return;
    try {
      var a = new Audio(snd.url);
      a.volume = clamp(snd.vol / 100, 0, 1);
      var pr = a.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) { /* ignore audio failures */ }
  }
  function playTick() { playSound("tick"); }
  function playWin() { playSound("win"); }

  // ---------------------------------------------------------------------------
  // Goal auto-spin
  // ---------------------------------------------------------------------------
  function goalNeed() {
    return cfg.triggerType === "sub" ? 1 : cfg.threshold;
  }
  function goalLabel() {
    var need = goalNeed();
    var names = { sub: cfg.words.goalSub, follows: cfg.words.goalFollows, bits: cfg.words.goalBits, tips: cfg.words.goalTips };
    return (names[cfg.triggerType] || cfg.words.goalDefault) + ": " +
      Math.floor(state.goalProgress) + " / " + need;
  }
  function updateGoalBar() {
    // The bar tracks a cumulative goal; in per-event ("each") mode there is
    // nothing to accumulate, so it is hidden.
    var show = cfg.enableAutoSpin && cfg.showGoalBar && !eachMode();
    el.goalWrap.hidden = !show;
    if (!show) return;
    var need = goalNeed();
    el.goalText.textContent = goalLabel();
    el.goalFill.style.width = Math.min(100, (state.goalProgress / need) * 100) + "%";
  }
  function addGoalProgress(inc) {
    if (!cfg.enableAutoSpin) return;
    state.goalProgress += inc;
    saveState();
    maybeAutoSpin();
    updateGoalBar();
  }
  function maybeAutoSpin() {
    if (!cfg.enableAutoSpin || state.spinning) { updateGoalBar(); return; }
    var need = goalNeed();
    if (state.goalProgress >= need) {
      buildSegments();
      if (segments.length) {
        state.goalProgress -= need;
        updateGoalBar();
        triggerSpin();
        return;
      }
    }
    updateGoalBar();
  }

  function handleGoalEvent(listener, event) {
    var data = event || {};
    if (listener === "subscriber-latest") {
      if (cfg.triggerType === "sub") addGoalProgress(num(data.amount, 1) || 1);
    } else if (listener === "follower-latest") {
      if (cfg.triggerType === "follows") addGoalProgress(1);
    } else if (listener === "cheer-latest") {
      if (cfg.triggerType === "bits") amountTrigger(num(data.amount, 0));
    } else if (listener === "tip-latest") {
      if (cfg.triggerType === "tips") amountTrigger(num(data.amount, 0));
    }
  }
  // Bits / donation amount trigger, honouring the count mode:
  // "each" spins once per event that meets the threshold; "cumulative" adds up.
  function amountTrigger(amt) {
    if (cfg.triggerCount === "each") {
      if (amt >= cfg.threshold) addGoalProgress(goalNeed());
    } else {
      addGoalProgress(amt);
    }
  }
  function eachMode() {
    return cfg.triggerCount === "each" && (cfg.triggerType === "bits" || cfg.triggerType === "tips");
  }

  // ---------------------------------------------------------------------------
  // Entry countdown timer
  // ---------------------------------------------------------------------------
  function stopEntryTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }
  function startEntryTimer() {
    stopEntryTimer();
    timerInterval = setInterval(tickTimer, 250);
    updateTimerUI();
  }
  function tickTimer() {
    if (!state.open || state.mode !== "giveaway") { stopEntryTimer(); updateTimerUI(); return; }
    if (nowMs() >= state.openUntil) { stopEntryTimer(); setOpen(false); return; }
    updateTimerUI();
  }
  function updateTimerUI() {
    if (!el.entryTimer) return;
    var active = cfg.entrySeconds > 0 && state.open && state.mode === "giveaway" &&
      state.openUntil > nowMs();
    el.entryTimer.hidden = !active;
    if (active) {
      el.entryTimer.textContent = cfg.words.timerPrefix + Math.ceil((state.openUntil - nowMs()) / 1000) + cfg.words.timerSuffix;
    }
  }
  function nowMs() { return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0; }

  // ---------------------------------------------------------------------------
  // Idle drift: gentle rotation while the wheel is waiting
  // ---------------------------------------------------------------------------
  function startIdle() {
    if (idleStarted) return;
    idleStarted = true;
    requestAnimationFrame(idleFrame);
  }
  function idleFrame(now) {
    if (!idleLast) idleLast = now;
    var dt = now - idleLast;
    idleLast = now;
    if (cfg.idleSpin && !state.spinning && dt > 0 && dt < 500) {
      rotation = (rotation + dt * IDLE_DEG_PER_MS) % 360;
      if (el.canvas) el.canvas.style.transform = "rotate(" + rotation + "deg)";
    }
    requestAnimationFrame(idleFrame);
  }

  // ---------------------------------------------------------------------------
  // Mode / open state / UI
  // ---------------------------------------------------------------------------
  function setOpen(b) {
    state.open = !!b;
    if (state.open && cfg.entrySeconds > 0 && state.mode === "giveaway") {
      state.openUntil = nowMs() + cfg.entrySeconds * 1000;
      startEntryTimer();
    } else {
      state.openUntil = 0;
      stopEntryTimer();
    }
    refresh();
    saveState();
  }
  var MODES = { giveaway: 1, forfeits: 1, questions: 1 };
  function setMode(m) {
    if (!MODES[m] || state.mode === m) return;
    state.mode = m;
    state.current = null;
    hideWinner();
    if (m === "questions" && typeof state.lifelines !== "number") state.lifelines = cfg.lifelineCount;
    refresh();
    saveState();
  }
  function toggleMode() {
    var order = ["giveaway", "forfeits", "questions"];
    setMode(order[(order.indexOf(state.mode) + 1) % order.length]);
  }

  function updateStatus() {
    el.app.classList.toggle("mode-giveaway", state.mode === "giveaway");
    el.app.classList.toggle("mode-forfeits", state.mode === "forfeits");
    el.app.classList.toggle("mode-questions", state.mode === "questions");
    el.app.classList.toggle("state-open", state.open);
    el.app.classList.toggle("state-closed", !state.open);

    var count = state.mode === "questions" ? questions.length
      : state.mode === "forfeits" ? forfeits.length : entries.length;
    var empty = state.mode === "giveaway" ? entries.length === 0
      : state.mode === "questions" ? questions.length === 0
      : forfeits.length === 0;
    el.app.classList.toggle("is-empty", empty && !state.spinning);

    var W = cfg.words;
    el.modeBadge.textContent = state.mode === "forfeits" ? W.modeForfeits
      : state.mode === "questions" ? W.modeQuestions : W.modeGiveaway;
    var noun = state.mode === "questions" ? W.question
      : state.mode === "forfeits" ? W.forfeit : W.entry;
    var nounP = state.mode === "questions" ? W.questions
      : state.mode === "forfeits" ? W.forfeits : W.entries;
    el.entryCount.textContent = count + " " + (count === 1 ? noun : nounP);
    el.openBadge.textContent = state.open ? W.open : W.closed;
  }

  function refresh() {
    buildSegments();
    drawWheel();
    updateStatus();
    updateGoalBar();
    updateTimerUI();
    updateLifelines();
    if (el.idle) {
      el.idle.textContent = state.mode === "questions"
        ? tpl(cfg.words.idleQuestions, { cmd: cfg.cmd + " ask" })
        : state.mode === "forfeits"
        ? tpl(cfg.words.idleForfeits, { cmd: cfg.cmd + " forfeit add" })
        : cfg.idleMessage;
    }
  }

  function pulse(node) {
    if (!node) return;
    node.style.transform = "scale(1.18)";
    setTimeout(function () { node.style.transform = ""; }, 180);
  }

  // A little sticker toast (e.g. "GenerousViewer joined!") shown one at a time so a rush
  // of entries doesn't stack; the backlog is capped so it can't fall far behind.
  function showToast(msg) {
    if (!el.toast) return;
    toastQueue.push(msg);
    if (toastQueue.length > 5) toastQueue.shift();
    if (!toastActive) nextToast();
  }
  function nextToast() {
    if (!el.toast || !toastQueue.length) { toastActive = false; return; }
    toastActive = true;
    el.toast.textContent = toastQueue.shift();
    el.toast.hidden = false;
    el.toast.style.animation = "none";
    void el.toast.offsetWidth;
    el.toast.style.animation = "";
    setTimeout(function () { el.toast.hidden = true; nextToast(); }, 1900);
  }

  // ---------------------------------------------------------------------------
  // Event handling
  // ---------------------------------------------------------------------------
  function handleMessage(data) {
    if (!data) return;
    var text = String(data.text || "").trim();
    if (!text) return;
    var first = text.toLowerCase().split(/\s+/)[0];
    var rest = text.replace(/^\S+\s*/, "").trim();
    var roles = rolesOf(data);
    if (first !== cfg.cmd) return;

    // One command word with verbs after it. A bare word enters the giveaway, and
    // "ask" is open to everyone; every other verb is for the broadcaster and mods.
    var parts = /^(\S+)\s*(.*)$/.exec(rest);
    if (!parts) { handleEnter(data, roles); return; }
    var verb = parts[1].toLowerCase(), arg = parts[2];
    if (verb === "ask") { handleAsk(data, roles, arg); return; }
    if (!canManage(roles)) return;
    var forfeit = /^forfeit\s+(add|remove|clear)\b\s*(.*)$/i.exec(rest);
    if (forfeit) {
      var fv = forfeit[1].toLowerCase();
      if (fv === "add") addForfeit(forfeit[2]);
      else if (fv === "remove") removeForfeit(forfeit[2]);
      else clearForfeits();
      return;
    }
    switch (verb) {
      case "go": triggerSpin(parseInt(arg, 10) || 1); break;
      case "open": setOpen(true); break;
      case "close": setOpen(false); break;
      case "clear": clearEntries(); break;
      case "remove": removeEntrant(arg); break;
      case "add": addManualEntry(arg); break;
      case "mode": setMode(arg.toLowerCase()); break;
      case "lastwinner": showLastWinner(); break;
      case "reroll": reroll(); break;
      case "veto": veto(); break;
      case "strike": strike(); break;
      case "resetlifelines": resetLifelines(); break;
    }
  }

  function handleButton(field) {
    switch (field) {
      case "btnSpin": triggerSpin(1); break;
      case "btnOpen": setOpen(true); break;
      case "btnClose": setOpen(false); break;
      case "btnClear": clearEntries(); break;
      case "btnMode": toggleMode(); break;
      case "btnReroll": reroll(); break;
      case "btnLastWinner": showLastWinner(); break;
      case "btnVeto": veto(); break;
      case "btnStrike": strike(); break;
      case "btnResetLives": resetLifelines(); break;
      case "btnSoundEnter": playSound("enter"); break;
      case "btnSoundTick": playSound("tick"); break;
      case "btnSoundWin": playSound("win"); break;
      case "btnForfeitClear": clearForfeits(); break;
    }
  }

  window.addEventListener("onEventReceived", function (obj) {
    if (!obj || !obj.detail) return;
    var listener = obj.detail.listener;
    var event = obj.detail.event || {};
    if (listener === "message") handleMessage(event.data || {});
    else if (listener === "widget-button") handleButton(event.field);
    else if (listener && listener.indexOf("-latest") >= 0) handleGoalEvent(listener, event);
  });

  window.addEventListener("onWidgetLoad", function (obj) {
    var fieldData = (obj && obj.detail && obj.detail.fieldData) || {};
    readConfig(fieldData);

    // Start from a clean slate (as a fresh browser source would), then let the
    // store restore whatever it saved. Keeps a re-dispatched load deterministic.
    entries = [];
    questions = [];
    forfeits = [];
    state.history = [];
    state.goalProgress = 0;
    state.openUntil = 0;
    state.lifelines = null;
    state.current = null;
    state.spinning = false;
    state.drawsTotal = 1;
    state.drawIndex = 0;

    el.app = document.getElementById("wheel-app");
    el.canvas = document.getElementById("wheel-canvas");
    el.confetti = document.getElementById("confetti-canvas");
    el.idle = document.getElementById("idle-message");
    el.modeBadge = document.getElementById("mode-badge");
    el.entryCount = document.getElementById("entry-count");
    el.openBadge = document.getElementById("open-badge");
    el.goalWrap = document.getElementById("goal-wrap");
    el.goalText = document.getElementById("goal-text");
    el.goalFill = document.getElementById("goal-fill");
    el.winnerOverlay = document.getElementById("winner-overlay");
    el.winnerEyebrow = document.getElementById("winner-eyebrow");
    el.winnerName = document.getElementById("winner-name");
    el.winnerSub = document.getElementById("winner-sub");
    el.entryTimer = document.getElementById("entry-timer");
    el.lifelines = document.getElementById("lifelines");
    el.toast = document.getElementById("entry-toast");

    applyTheme();
    el.app.classList.toggle("shape-semicircle", cfg.wheelShape === "semicircle");
    setupCanvas();

    el.idle.textContent = cfg.idleMessage;

    // defaults only apply the first time, when the store had nothing to restore
    restoreState(function (restored) {
      if (!restored) {
        state.mode = cfg.defaultMode;
        state.open = cfg.startOpen;
      }
      if (typeof state.lifelines !== "number") state.lifelines = cfg.lifelineCount;
      // resume a saved countdown after a refresh, expire it if it already passed,
      // or start a fresh one if entries opened this session with a timer configured
      if (state.open && cfg.entrySeconds > 0 && state.mode === "giveaway") {
        if (state.openUntil > nowMs()) startEntryTimer();
        else if (state.openUntil > 0) setOpen(false);
        else { state.openUntil = nowMs() + cfg.entrySeconds * 1000; startEntryTimer(); }
      } else {
        state.openUntil = 0;
      }
      refresh();
      startIdle();
    });
  });
})();
