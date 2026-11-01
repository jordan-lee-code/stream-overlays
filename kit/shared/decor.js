  // ---- decorations, shared by every overlay in this set ----
  // Small shapes (sparkles, hearts, stars and so on) drawn behind a panel's words, in the accent colour, or in a pride preset's
  // flag colours. They are placed by a fixed recipe and not at random, so they sit in the same places every time the widget loads.
  var DECOR_KINDS = { sparkles: 1, hearts: 1, stars: 1, flowers: 1, moons: 1, snowflakes: 1, bubbles: 1, mixed: 1 };
  var DECOR_MOTION = { twinkle: 1, drift: 1, still: 1 };
  function readDecor(f) {
    f = f || {};
    var kind = str(f.decoration, "none"), motion = str(f.decorationMotion, "twinkle");
    return {
      kind: DECOR_KINDS[kind] === 1 ? kind : "none",
      count: clamp(Math.floor(num(f.decorationCount, 8)), 1, 24),
      size: clamp(num(f.decorationSize, 1), 0.3, 4),
      motion: DECOR_MOTION[motion] === 1 ? motion : "twinkle"
    };
  }
  // `host` is the panel the shapes sit behind, `colors` the list of colours they take in turn, and `animate` whether they move.
  function applyDecor(d, host, colors, animate) {
    if (!host || !host.children || typeof document === "undefined") return;
    for (var i = host.children.length - 1; i >= 0; i--) {
      if (host.children[i].className && String(host.children[i].className).indexOf("w-deco") === 0) host.removeChild(host.children[i]);
    }
    if (!d || d.kind === "none") { if (host.style) host.style.isolation = ""; return; }
    // Behind the words but above the panel's own background: the panel becomes its own stacking context.
    if (host.style) host.style.isolation = "isolate";
    var layer = document.createElement("div");
    layer.className = "w-deco " + d.motion + (animate ? "" : " still");
    layer.setAttribute("aria-hidden", "true");
    if (layer.style) layer.style.setProperty("--w-deco-size", d.size);
    var mix = ["sparkles", "hearts", "stars"], pal = colors && colors.length ? colors : ["currentColor"];
    for (var n = 0; n < d.count; n++) {
      var item = document.createElement("span");
      var frac = function (v) { return v - Math.floor(v); };
      var dur = d.motion === "drift" ? 7 + (n % 4) * 2 : 2.4 + (n % 5) * 0.7;
      item.className = "w-di " + (d.kind === "mixed" ? mix[n % 3] : d.kind);
      item.style.setProperty("--x", (frac(0.12 + n * 0.618034) * 92 + 2).toFixed(1) + "%");
      item.style.setProperty("--y", (frac(0.31 + n * 0.754878) * 88 + 4).toFixed(1) + "%");
      item.style.setProperty("--s", (0.7 + frac(n * 0.37 + 0.2) * 0.6).toFixed(2));
      item.style.setProperty("--d", dur.toFixed(1) + "s");
      item.style.setProperty("--dl", "-" + ((n * 1.37) % dur).toFixed(2) + "s");
      item.style.setProperty("--c", pal[n % pal.length]);
      layer.appendChild(item);
    }
    host.insertBefore(layer, host.firstChild);
  }
  // ---- end of the decorations ----
