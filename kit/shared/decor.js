  // ---- decorations, shared by every overlay in this set ----
  // Small shapes (sparkles, hearts, stars and so on) drawn behind a panel's words, in the accent colour, or in a pride preset's
  // flag colours. They are placed by a fixed recipe and not at random, so they sit in the same places every time the widget loads.
  var DECOR_KINDS = { sparkles: 1, hearts: 1, stars: 1, flowers: 1, moons: 1, snowflakes: 1, bubbles: 1, butterflies: 1, clouds: 1, leaves: 1, paws: 1, notes: 1, bows: 1, mixed: 1 };
  var DECOR_MOTION = { twinkle: 1, drift: 1, still: 1 };
  var DECOR_PLACE = { scatter: 1, edges: 1, corners: 1, border: 1 };
  var DECOR_COLOR = { accent: 1, text: 1, mixed: 1, custom: 1 };
  function readDecor(f) {
    f = f || {};
    var kind = str(f.decoration, "none"), motion = str(f.decorationMotion, "twinkle"), place = str(f.decorationPlacement, "scatter"), color = str(f.decorationColor, "accent");
    return {
      kind: DECOR_KINDS[kind] === 1 ? kind : "none",
      count: clamp(Math.floor(num(f.decorationCount, 8)), 1, 24),
      size: clamp(num(f.decorationSize, 1), 0.3, 4),
      motion: DECOR_MOTION[motion] === 1 ? motion : "twinkle",
      place: DECOR_PLACE[place] === 1 ? place : "scatter",
      color: DECOR_COLOR[color] === 1 ? color : "accent",
      tint: str(f.decorationTint, "#FFB6D9"),
      opacity: clamp(num(f.decorationOpacity, 0.5), 0.1, 1)
    };
  }
  // `host` is the panel the shapes sit behind, `colors` the list of colours they take in turn (the accent, or a flag), `animate` whether they
  // move, and `text` the panel's text colour, for a setting that asks for it.
  function applyDecor(d, host, colors, animate, text) {
    if (!host || !host.children || typeof document === "undefined") return;
    for (var i = host.children.length - 1; i >= 0; i--) {
      if (host.children[i].className && String(host.children[i].className).indexOf("w-deco") === 0) host.removeChild(host.children[i]);
    }
    if (!d || d.kind === "none") { if (host.style) host.style.isolation = ""; return; }
    // Behind the words but above the panel's own background: the panel becomes its own stacking context.
    if (host.style) host.style.isolation = "isolate";
    var layer = document.createElement("div");
    layer.className = "w-deco " + d.motion + (animate ? "" : " still") + (d.place === "border" ? " outside" : "");
    layer.setAttribute("aria-hidden", "true");
    if (layer.style) { layer.style.setProperty("--w-deco-size", d.size); layer.style.setProperty("--w-deco-opacity", d.opacity); }
    var mix = ["sparkles", "hearts", "stars"], pal = colors && colors.length ? colors : ["currentColor"];
    // Which colours the shapes take, in turn: the accent (or the flag), the text colour, both together, or one you pick.
    if (d.color === "text" && text) pal = [text];
    else if (d.color === "custom") pal = [d.tint];
    else if (d.color === "mixed" && text) pal = pal.concat([text]);
    for (var n = 0; n < d.count; n++) {
      var item = document.createElement("span");
      var frac = function (v) { return v - Math.floor(v); };
      var dur = d.motion === "drift" ? 7 + (n % 4) * 2 : 2.4 + (n % 5) * 0.7;
      item.className = "w-di " + (d.kind === "mixed" ? mix[n % 3] : d.kind);
      var x = frac(0.12 + n * 0.618034) * 92 + 2, y = frac(0.31 + n * 0.754878) * 88 + 4, s = 0.7 + frac(n * 0.37 + 0.2) * 0.6;
      if (d.place === "edges") {
        // Round the border of the panel, by the same kind of recipe: a point a fraction of the way round, on one of its four sides.
        var around = frac(0.07 + n * 0.618034) * 4, along = frac(around) * 88;
        if (around < 1) { x = along + 2; y = 3; } else if (around < 2) { x = 90; y = along + 4; } else if (around < 3) { x = 90 - along; y = 86; } else { x = 3; y = 86 - along; }
        s = 0.8 + frac(n * 0.37 + 0.2) * 0.4;
      } else if (d.place === "border") {
        // On the border itself, so that half of each shape is outside the panel. The stylesheet centres a shape on its point.
        var rim = frac(0.07 + n * 0.618034) * 4, run = frac(rim) * 100;
        if (rim < 1) { x = run; y = 0; } else if (rim < 2) { x = 100; y = run; } else if (rim < 3) { x = 100 - run; y = 100; } else { x = 0; y = 100 - run; }
        s = 0.8 + frac(n * 0.37 + 0.2) * 0.4;
      } else if (d.place === "corners") {
        // The four corners in turn, and a second ring a little further in once there are more than four.
        var ring = Math.floor(n / 4), cx = n % 4 < 2 ? 3 + ring * 9 : 88 - ring * 9, cy = n % 4 === 0 || n % 4 === 3 ? 4 + ring * 9 : 84 - ring * 9;
        x = cx; y = cy; s = 1.25 - Math.min(ring, 3) * 0.2;
      }
      item.style.setProperty("--x", x.toFixed(1) + "%");
      item.style.setProperty("--y", y.toFixed(1) + "%");
      item.style.setProperty("--s", s.toFixed(2));
      item.style.setProperty("--d", dur.toFixed(1) + "s");
      item.style.setProperty("--dl", "-" + ((n * 1.37) % dur).toFixed(2) + "s");
      item.style.setProperty("--c", pal[n % pal.length]);
      layer.appendChild(item);
    }
    host.insertBefore(layer, host.firstChild);
  }
  // ---- end of the decorations ----
