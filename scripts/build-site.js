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
const { makeZip } = require("./zip");

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
  return { name, title, category: pkg.category || "", description: pkg.description || "", picture: pic ? path.join(dir, pic) : null };
}

// The groups the landing page sorts the overlays into, in the order they are shown. Each overlay names its group in its
// package.json as `category`.
const CATEGORIES = [
  { id: "goals", title: "Goals and counters", blurb: "Bars and counters that move as chat subscribes, cheers and tips." },
  { id: "chat", title: "Chat and viewers", blurb: "Things your viewers see, and things they can take part in." },
  { id: "info", title: "On-screen info", blurb: "Small panels for your scene: what is playing, the time, your socials, your camera." },
  { id: "start-end", title: "Stream start and end", blurb: "For the first and the last minutes of a stream." }
];

function cardHtml(c) {
  return `
        <li class="card">
          <a class="pic" href="${esc(c.name)}/dev/">${c.picture ? `<img src="${esc(c.name)}/card.png" alt="The ${esc(c.title)} overlay" loading="lazy">` : ""}</a>
          <h3><a href="${esc(c.name)}/dev/">${esc(c.title)}</a></h3>
          <p>${esc(c.description.replace(/^A StreamElements custom widget:\s*/i, "").replace(/^./, ch => ch.toUpperCase()))}</p>
          <p class="links"><a class="go" href="${esc(c.name)}/dev/"><span class="se">Set it up and copy it</span><span class="sb">Set it up and get its link</span></a> <a href="${REPO}/tree/main/overlays/${esc(c.name)}#readme">Read about it</a></p>
        </li>`;
}

function landing(cards) {
  const known = CATEGORIES.map(g => g.id);
  // An overlay with no known category is still shown, under a group of its own at the end, so it can never go missing.
  const groups = CATEGORIES.concat(cards.some(c => known.indexOf(c.category) === -1) ? [{ id: "more", title: "More", blurb: "" }] : []);
  const inGroup = g => cards.filter(c => g.id === "more" ? known.indexOf(c.category) === -1 : c.category === g.id);
  const jump = groups.filter(g => inGroup(g).length).map(g => `<a href="#${g.id}">${esc(g.title)}</a>`).join("");
  const sections = groups.filter(g => inGroup(g).length).map(g => `
    <section id="${g.id}" aria-labelledby="${g.id}-title">
      <h2 id="${g.id}-title">${esc(g.title)}</h2>${g.blurb ? `
      <p class="blurb">${esc(g.blurb)}</p>` : ""}
      <ul class="cards">${inGroup(g).map(cardHtml).join("")}
      </ul>
    </section>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stream overlays for StreamElements and Streamer.bot</title>
  <meta name="description" content="Free stream overlays for StreamElements and Streamer.bot. Set one up in your browser, then copy it into StreamElements or add its link to OBS. Nothing to download.">
  <script>
    try { if (localStorage.getItem("stream-overlays-theme") === "light") document.documentElement.setAttribute("data-theme", "light"); } catch (e) {}
    /* Which tool the visitor uses. An address ending in ?platform=streamerbot, or #streamerbot, chooses it, and the choice is kept for the dev pages too. */
    try {
      var asked = /[?&]platform=(streamerbot|streamelements)/.exec(location.search) || /^#(streamerbot|streamelements)$/.exec(location.hash);
      if (asked) localStorage.setItem("stream-overlays-platform", asked[1]);
      if (localStorage.getItem("stream-overlays-platform") === "streamerbot") document.documentElement.setAttribute("data-platform", "streamerbot");
    } catch (e) {}
  </script>
  <style>
    /* Dark by default. A visitor who chooses light keeps it, and the dev pages use the same choice. */
    :root { color-scheme: dark; --bg: #14111c; --text: #e8e3f2; --muted: #b3abc6; --card: #1f1a2c; --shadow: 0 2px 12px rgba(0, 0, 0, 0.4); --link: #c0abff; --chip: #2a2340; --chip-text: #e3d9ff; --btn: #6a4cb8; --btn-hover: #7d60cc; --rule: #332b4a; }
    html[data-theme="light"] { color-scheme: light; --bg: #f3eefb; --text: #2b2f36; --muted: #4b4560; --card: #fff; --shadow: 0 2px 10px rgba(60, 40, 90, 0.08); --link: #5b3fa0; --chip: #e6dcf8; --chip-text: #46307f; --btn: #5b3fa0; --btn-hover: #46307f; --rule: #d9cff0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Quicksand", "Segoe UI", system-ui, sans-serif; color: var(--text); background: var(--bg); line-height: 1.5; }
    header, main, footer { max-width: 1040px; margin: 0 auto; padding: 0 20px; }
    header { padding-top: 40px; position: relative; }
    h1 { margin: 0 0 8px; font-size: 2rem; }
    .lead { max-width: 640px; font-size: 1.05rem; margin: 0 0 20px; }
    ol.steps { max-width: 640px; margin: 0 0 20px; padding-left: 22px; }
    ol.steps li { margin: 4px 0; }
    /* Only what belongs to the chosen tool is shown. StreamElements is the default. */
    html:not([data-platform="streamerbot"]) .sb, html[data-platform="streamerbot"] .se { display: none !important; }
    .platform { display: inline-flex; margin: 0 0 18px; padding: 3px; border-radius: 999px; background: var(--card); border: 1px solid var(--rule); }
    .platform button { font: inherit; font-weight: 700; font-size: 0.95rem; padding: 6px 18px; border: 0; border-radius: 999px; background: transparent; color: var(--text); cursor: pointer; }
    .platform button[aria-pressed="true"] { background: var(--btn); color: #fff; }
    .platform button:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
    #theme { position: absolute; top: 40px; right: 20px; font: inherit; font-size: 0.85rem; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--text); cursor: pointer; }
    #theme:hover, #theme:focus { border-color: var(--link); }
    nav.jump { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 8px; }
    nav.jump a { padding: 5px 14px; border-radius: 999px; background: var(--chip); color: var(--chip-text); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
    nav.jump a:hover, nav.jump a:focus { outline: 2px solid var(--link); }
    section { padding-top: 26px; }
    section h2 { font-size: 1.4rem; margin: 0 0 2px; padding-bottom: 6px; border-bottom: 1px solid var(--rule); }
    .blurb { margin: 8px 0 14px; color: var(--muted); }
    ul.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .card { background: var(--card); border-radius: 16px; padding: 14px; box-shadow: var(--shadow); display: flex; flex-direction: column; }
    .card .pic { display: block; border-radius: 10px; overflow: hidden; background: linear-gradient(135deg, #3b4a73, #6d4f87 55%, #c9809a); height: 190px; }
    .card img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
    .card h3 { font-size: 1.15rem; margin: 12px 0 4px; }
    .card h3 a { color: inherit; text-decoration: none; }
    .card p { margin: 0 0 8px; font-size: 0.95rem; }
    .card .links { margin-top: auto; padding-top: 6px; display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    a { color: var(--link); }
    a.go { display: inline-block; padding: 6px 12px; border-radius: 999px; background: var(--btn); color: #fff; text-decoration: none; font-weight: 700; }
    a.go:hover, a.go:focus { background: var(--btn-hover); }
    footer { padding-top: 28px; padding-bottom: 40px; font-size: 0.9rem; }
    footer p { margin: 6px 0; max-width: 760px; }
  </style>
</head>
<body>
  <header>
    <div class="platform" role="group" aria-label="Which tool do you stream with?">
      <button type="button" data-platform="streamelements" aria-pressed="true">StreamElements</button>
      <button type="button" data-platform="streamerbot" aria-pressed="false">Streamer.bot</button>
    </div>
    <h1>Stream overlays</h1>
    <p class="lead">Free overlays for your stream: goals, chat, polls, a wheel and more, all in the same style presets so they look right together. You do not need to download anything.</p>
    <button id="theme" type="button" aria-label="Switch between dark and light mode"></button>
    <ol class="steps se">
      <li>Pick an overlay below and set it up. The page shows it live, and you can change every setting.</li>
      <li>Press the copy buttons at the top of its page, one for each file.</li>
      <li>In StreamElements, add a Custom Widget to your overlay, open its editor, and paste each file into the tab it names.</li>
    </ol>
    <ol class="steps sb">
      <li><a href="${ZIP_FOLDER}.zip">Download the overlays</a> and unzip them somewhere you will keep them. Once is enough for every overlay.</li>
      <li>In Streamer.bot, open Servers/Clients, then HTTP Server. Add a mapping with Path <code>overlays</code> and Folder set to the folder you unzipped, tick Auto Start and press Start Server. Do the same for WebSocket Server.</li>
      <li>Pick an overlay below and set it up. The page shows it live, and you can change every setting.</li>
      <li>Press the button at the top of its page to copy its address. In OBS, add a Browser source, paste the address into URL, and give it the size of the box you want.</li>
    </ol>
    <nav class="jump" aria-label="Overlay groups">${jump}</nav>
  </header>
  <main>${sections}
  </main>
  <footer>
    <p>The code is on <a href="${REPO}">GitHub</a>, under the MIT licence, with a README for each overlay. If these save you time, you can support them on <a href="${KOFI}">Ko-fi</a>.</p>
    <p class="sb">With Streamer.bot, the overlays are hosted by Streamer.bot itself from the folder you unzipped, so they do not need this website, or the internet, while you stream. (Their fonts still come from Google Fonts.) Its chat commands work from chat, and the buttons in an overlay's StreamElements settings, such as Manual controls, are not there: use the chat commands instead. Tips arrive through whichever of StreamElements, Streamlabs, Ko-fi or TipeeeStream you have connected to Streamer.bot.</p>
    <p>These pages load fonts from Google Fonts and the Ko-fi button from Ko-fi. Your settings stay in your browser. The Chat Feed overlay, when it is on stream, looks up chatters' profile pictures and pronouns on two outside services, and its README says exactly what is sent.</p>
  </footer>
  <script>
    (function () {
      var root = document.documentElement, b = document.getElementById("theme");
      var picks = document.querySelectorAll(".platform button");
      function showPlatform() {
        var sb = root.getAttribute("data-platform") === "streamerbot";
        Array.prototype.forEach.call(picks, function (p) { p.setAttribute("aria-pressed", String((p.getAttribute("data-platform") === "streamerbot") === sb)); });
      }
      Array.prototype.forEach.call(picks, function (p) {
        p.addEventListener("click", function () {
          var sb = p.getAttribute("data-platform") === "streamerbot";
          if (sb) root.setAttribute("data-platform", "streamerbot"); else root.removeAttribute("data-platform");
          try { localStorage.setItem("stream-overlays-platform", sb ? "streamerbot" : "streamelements"); } catch (e) {}
          showPlatform();
        });
      });
      showPlatform();
      function show() { b.textContent = root.getAttribute("data-theme") === "light" ? "Switch to dark mode" : "Switch to light mode"; }
      b.addEventListener("click", function () {
        var light = root.getAttribute("data-theme") !== "light";
        if (light) root.setAttribute("data-theme", "light"); else root.removeAttribute("data-theme");
        try { localStorage.setItem("stream-overlays-theme", light ? "light" : "dark"); } catch (e) {}
        show();
      });
      show();
    })();
  </script>
</body>
</html>
`;
}

// The same overlay pages as a download, for Streamer.bot to host itself. Streamer.bot's HTTP server can serve a folder from the
// streamer's own computer, so OBS then shows the overlay from there, with no dependence on this site while they stream. The zip holds
// only what an overlay page needs: its own files, the adapter and the client it uses. It does not hold the dev pages.
const ZIP_FOLDER = "stream-overlays-streamerbot";
const ZIP_README = `Stream overlays for Streamer.bot
================================

These are the overlay pages, ready for Streamer.bot to host from your own computer, so OBS shows them without needing the internet.

1. Unzip this folder somewhere you will keep it, such as C:\\Overlays\\${ZIP_FOLDER}.
2. In Streamer.bot, open Servers/Clients, then HTTP Server.
3. Add a mapping: set Path to  overlays  and Folder to the folder you unzipped. Tick Auto Start, and press Start Server.
   (Streamer.bot serves on 127.0.0.1 port 7474 unless you change them.)
4. In Streamer.bot, open Servers/Clients, then WebSocket Server, tick Auto Start and press Start Server.
5. On the website, choose Streamer.bot, set an overlay up, and press the button to copy its address. It looks like
   http://127.0.0.1:7474/overlays/counter/streamerbot.html
6. In OBS, add a Browser source, paste the address into URL, and give it the size you want.

To use a newer version, download this zip again and replace the folder. Your settings are in each overlay's address, so they are not lost.

The Streamer.bot client in this folder is @streamerbot/client, MIT licensed, and its licence is alongside it.
https://github.com/jordan-lee-code/stream-overlays
`;

// The page OBS shows for an overlay when it is used with Streamer.bot: the overlay's own HTML, CSS and JavaScript exactly as they are
// in StreamElements, with streamerbot.js after them to hand the overlay the events it expects. Nothing in the overlay is changed.
function streamerbotPage(dir, title) {
  const htmlPath = path.join(dir, "widget", "widget.html");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}, for Streamer.bot</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- A browser source is a whole page, not a box inside one, so the page is the box. -->
  <style>html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }</style>
  <link rel="stylesheet" href="widget/widget.css">
</head>
<body>
${html}
<script src="widget/widget.js"></script>
<script src="../streamerbot.js"></script>
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
    fs.writeFileSync(path.join(out, name, "streamerbot.html"), streamerbotPage(dir, card.title));
    cards.push(card);
  });
  const shared = path.join(__dirname, "..", "kit", "shared"), vendor = path.join(__dirname, "..", "kit", "vendor");
  fs.copyFileSync(path.join(shared, "streamerbot.js"), path.join(out, "streamerbot.js"));
  ["streamerbot-client.js", "streamerbot-client.LICENSE"].forEach(f => fs.copyFileSync(path.join(vendor, f), path.join(out, f)));
  const files = [{ name: "README.txt", data: ZIP_README.replace(/\n/g, "\r\n") }];
  ["streamerbot.js"].forEach(f => files.push({ name: f, data: fs.readFileSync(path.join(out, f)) }));
  ["streamerbot-client.js", "streamerbot-client.LICENSE"].forEach(f => files.push({ name: f, data: fs.readFileSync(path.join(out, f)) }));
  cards.forEach(c => {
    files.push({ name: c.name + "/streamerbot.html", data: fs.readFileSync(path.join(out, c.name, "streamerbot.html")) });
    fs.readdirSync(path.join(out, c.name, "widget")).sort().forEach(f => files.push({ name: c.name + "/widget/" + f, data: fs.readFileSync(path.join(out, c.name, "widget", f)) }));
  });
  files.forEach(f => { f.name = ZIP_FOLDER + "/" + f.name; });
  fs.writeFileSync(path.join(out, ZIP_FOLDER + ".zip"), makeZip(files));
  fs.writeFileSync(path.join(out, "index.html"), landing(cards));
  fs.writeFileSync(path.join(out, ".nojekyll"), "");        // serve the files as they are
  return { out, overlays: cards.map(c => c.name) };
}

module.exports = { build, landing, describe, esc, streamerbotPage, CATEGORIES, ZIP_FOLDER };

if (require.main === module) {
  const r = build(process.argv[2]);
  console.log("Built " + r.overlays.length + " overlays into " + r.out);
}
