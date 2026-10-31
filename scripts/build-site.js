/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* Builds the website that GitHub Pages serves: a landing page with a card for each overlay, and for
 * each overlay its dev page and its widget files, so someone can set an overlay up in the browser and
 * copy its files into StreamElements without downloading the repository.
 *
 *   node scripts/build-site.js [folder]        (the folder is _site by default)
 *
 * Only what a visitor needs is copied: widget/ and dev/ from each overlay, and one picture for its
 * card. The tests, the docs and the build tooling are left out. */
"use strict";
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/jordan-lee-code/stream-overlays";
const KOFI = "https://ko-fi.com/journeyingjordan";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from, { withFileTypes: true }).forEach(e => {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  });
}

// What a card says about an overlay: its name from the README's title, its description, and a picture.
function describe(root, name) {
  const dir = path.join(root, "overlays", name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let title = name;
  const readme = path.join(dir, "README.md");
  if (fs.existsSync(readme)) {
    const m = /^#\s+(.+?)\s*$/m.exec(fs.readFileSync(readme, "utf8"));
    if (m) title = m[1].replace(/\s+Overlay$/, "");
  }
  const pic = ["docs/card.png"].find(p => fs.existsSync(path.join(dir, p)));
  return { name, title, description: pkg.description || "", picture: pic ? path.join(dir, pic) : null };
}

function landing(cards) {
  const items = cards.map(c => `
      <li class="card">
        <a class="pic" href="${esc(c.name)}/dev/">${c.picture ? `<img src="${esc(c.name)}/card.png" alt="The ${esc(c.title)} overlay" loading="lazy">` : ""}</a>
        <h2><a href="${esc(c.name)}/dev/">${esc(c.title)}</a></h2>
        <p>${esc(c.description.replace(/^A StreamElements custom widget:\s*/i, "").replace(/^./, ch => ch.toUpperCase()))}</p>
        <p class="links"><a class="go" href="${esc(c.name)}/dev/">Set it up and copy it</a> <a href="${REPO}/tree/main/overlays/${esc(c.name)}#readme">Read about it</a></p>
      </li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stream overlays for StreamElements</title>
  <meta name="description" content="Free StreamElements custom widgets. Set one up in your browser, then copy its files into StreamElements. Nothing to download.">
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Quicksand", "Segoe UI", system-ui, sans-serif; color: #2b2f36; background: #f3eefb; line-height: 1.5; }
    header, main, footer { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
    header { padding-top: 40px; }
    h1 { margin: 0 0 8px; font-size: 2rem; }
    .lead { max-width: 640px; font-size: 1.05rem; margin: 0 0 20px; }
    ol.steps { max-width: 640px; margin: 0 0 28px; padding-left: 22px; }
    ol.steps li { margin: 4px 0; }
    ul.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .card { background: #fff; border-radius: 16px; padding: 14px; box-shadow: 0 2px 10px rgba(60, 40, 90, 0.08); display: flex; flex-direction: column; }
    .card .pic { display: block; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #3b4a73, #6d4f87 55%, #c9809a); height: 190px; }
    .card img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .card h2 { font-size: 1.15rem; margin: 12px 0 4px; }
    .card h2 a { color: inherit; text-decoration: none; }
    .card p { margin: 0 0 8px; font-size: 0.95rem; }
    .card .links { margin-top: auto; padding-top: 6px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    a { color: #5b3fa0; }
    a.go { display: inline-block; padding: 6px 12px; border-radius: 999px; background: #5b3fa0; color: #fff; text-decoration: none; font-weight: 700; }
    a.go:hover, a.go:focus { background: #46307f; }
    footer { padding-top: 28px; padding-bottom: 40px; font-size: 0.9rem; }
    footer p { margin: 6px 0; max-width: 760px; }
  </style>
</head>
<body>
  <header>
    <h1>Stream overlays for StreamElements</h1>
    <p class="lead">Free custom widgets for your stream: goals, chat, polls, a wheel and more, all in the same style presets so they look right together. You do not need to download anything.</p>
    <ol class="steps">
      <li>Pick an overlay below and set it up. The page shows it live, and you can change every setting.</li>
      <li>Press the copy buttons at the top of its page, one for each file.</li>
      <li>In StreamElements, add a Custom Widget to your overlay, open its editor, and paste each file into the tab it names.</li>
    </ol>
  </header>
  <main>
    <ul class="cards">${items}
    </ul>
  </main>
  <footer>
    <p>The code is on <a href="${REPO}">GitHub</a>, under the MIT licence, with a README for each overlay. If these save you time, you can support them on <a href="${KOFI}">Ko-fi</a>.</p>
    <p>These pages load fonts from Google Fonts and the Ko-fi button from Ko-fi. Your settings stay in your browser. The Chat Feed overlay, when it is on stream, looks up chatters' profile pictures and pronouns on two outside services, and its README says exactly what is sent.</p>
  </footer>
</body>
</html>
`;
}

function build(out, root) {
  root = root || path.join(__dirname, "..");
  out = path.resolve(out || path.join(root, "_site"));
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const names = fs.readdirSync(path.join(root, "overlays")).filter(n => fs.statSync(path.join(root, "overlays", n)).isDirectory()).sort();
  const cards = [];
  names.forEach(name => {
    const dir = path.join(root, "overlays", name);
    if (!fs.existsSync(path.join(dir, "dev", "index.html")) || !fs.existsSync(path.join(dir, "widget", "widget.js"))) return;
    const card = describe(root, name);
    copyDir(path.join(dir, "widget"), path.join(out, name, "widget"));
    copyDir(path.join(dir, "dev"), path.join(out, name, "dev"));
    if (card.picture) fs.copyFileSync(card.picture, path.join(out, name, "card.png"));
    cards.push(card);
  });
  fs.writeFileSync(path.join(out, "index.html"), landing(cards));
  fs.writeFileSync(path.join(out, ".nojekyll"), "");        // serve the files as they are
  return { out, overlays: cards.map(c => c.name) };
}

module.exports = { build, landing, describe, esc };

if (require.main === module) {
  const r = build(process.argv[2]);
  console.log("Built " + r.overlays.length + " overlays into " + r.out);
}
