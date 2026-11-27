/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* The website's page of every chat command. It is made from the overlays' READMEs, so a command is only ever
 * written down in one place: any table whose first column is headed Command is picked up. */
"use strict";
const fs = require("fs");
const path = require("path");

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Code, bold and web links. A link to somewhere in the repository keeps only its words.
function inline(text) {
  return String(text).split(/(`[^`]*`)/).map(part => {
    if (part.length > 1 && part[0] === "`" && part[part.length - 1] === "`") return "<code>" + esc(part.slice(1, -1)) + "</code>";
    return esc(part)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, words, to) => /^https?:\/\//.test(to) ? '<a href="' + to + '">' + words + "</a>" : words);
  }).join("");
}

const cells = line => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, "|"));

/* The command tables of one README, each under the heading it sits below. A command listed a second time, as in a
 * section that explains a few of them again, is left out. */
function commandTables(readme) {
  const lines = String(readme).replace(/\r\n/g, "\n").split("\n"), tables = [], seen = new Set();
  let heading = "";
  for (let i = 0; i < lines.length; i++) {
    const h = /^##+\s+(.+?)\s*$/.exec(lines[i]);
    if (h) heading = h[1];
    if (lines[i][0] !== "|" || !/^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || "")) continue;
    const head = cells(lines[i]), who = head.indexOf("Who"), rows = [];
    let j = i + 2;
    for (; j < lines.length && lines[j][0] === "|"; j++) {
      const row = cells(lines[j]);
      if (head[0] !== "Command" || seen.has(row[0])) continue;
      seen.add(row[0]);
      rows.push({ command: row[0], who: who === -1 ? "" : row[who] || "", does: row[head.length - 1] || "" });
    }
    if (rows.length) tables.push({ heading, hasWho: who !== -1, rows });
    i = j - 1;
  }
  return tables;
}

// What an overlay's page section needs, from its folder.
function commandsOf(dir) {
  const read = f => { try { return fs.readFileSync(path.join(dir, f), "utf8"); } catch (e) { return ""; } };
  let fields = {};
  try { fields = JSON.parse(read("widget/fields.json")); } catch (e) { /* an overlay without settings has no command word to show */ }
  // The Subathon's clock has its own word, and its `command` setting is the one for the goals underneath.
  const own = fields.tmCommand || fields.command;
  const word = own && own.type === "text" ? String(own.value) : "";
  const limit = fields.whoCanManage && fields.whoCanManage.value === "mods";
  return { tables: commandTables(read("README.md")), word, limit };
}

function tableHtml(t) {
  return `
        <table>
          <thead><tr><th scope="col">Type this</th>${t.hasWho ? '<th scope="col">Who</th>' : ""}<th scope="col">What happens</th></tr></thead>
          <tbody>${t.rows.map(r => `
            <tr><td class="type">${inline(r.command)}</td>${t.hasWho ? `<td class="who">${inline(r.who)}</td>` : ""}<td>${inline(r.does)}</td></tr>`).join("")}
          </tbody>
        </table>`;
}

function sectionHtml(o) {
  const about = [];
  if (o.word) about.push("Command word: <code>" + esc(o.word) + "</code>, which you can change in the overlay's settings.");
  if (o.limit) about.push("Unless it says otherwise, a command is for you and your moderators, and a setting can keep it to you.");
  return `
    <section id="${esc(o.name)}" class="overlay" aria-labelledby="${esc(o.name)}-title">
      <h2 id="${esc(o.name)}-title">${esc(o.title)}</h2>
      <p class="about">${about.join(" ")} <a href="${esc(o.name)}/dev/">Set up ${esc(o.title)}</a></p>${o.tables.map(t => `
      <div class="group">${o.tables.length > 1 ? `
        <h3>${esc(t.heading)}</h3>` : ""}${tableHtml(t)}
      </div>`).join("")}
    </section>`;
}

/** The whole page. `overlays` are { name, title, tables, word, limit }, in the order to show them. */
function commandsPage(overlays) {
  const listed = overlays.filter(o => o.tables.length), without = overlays.filter(o => !o.tables.length);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chat commands for every overlay</title>
  <meta name="description" content="Every chat command for these stream overlays, with examples.">
  <script>try { if (localStorage.getItem("stream-overlays-theme") === "light") document.documentElement.setAttribute("data-theme", "light"); } catch (e) {}</script>
  <style>
    :root { color-scheme: dark; --bg: #14111c; --text: #e8e3f2; --muted: #b3abc6; --card: #1f1a2c; --link: #c0abff; --chip: #2a2340; --chip-text: #e3d9ff; --rule: #332b4a; }
    html[data-theme="light"] { color-scheme: light; --bg: #f3eefb; --text: #2b2f36; --muted: #4b4560; --card: #fff; --link: #5b3fa0; --chip: #e6dcf8; --chip-text: #46307f; --rule: #d9cff0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Quicksand", "Segoe UI", system-ui, sans-serif; color: var(--text); background: var(--bg); line-height: 1.5; }
    header, main, footer { max-width: 960px; margin: 0 auto; padding: 0 16px; }
    header { padding-top: 32px; }
    h1 { margin: 8px 0; font-size: 2rem; }
    a { color: var(--link); }
    nav.jump { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    nav.jump a { padding: 4px 12px; border-radius: 999px; background: var(--chip); color: var(--chip-text); text-decoration: none; font-weight: 700; font-size: 0.9rem; }
    nav.jump a:hover, nav.jump a:focus { outline: 2px solid var(--link); }
    label { display: block; font-weight: 700; margin-bottom: 4px; }
    #find { width: 100%; max-width: 420px; font: inherit; padding: 8px 14px; border-radius: 999px; border: 1px solid var(--rule); background: var(--card); color: var(--text); }
    section { padding-top: 26px; }
    section h2 { font-size: 1.35rem; margin: 0; padding-bottom: 6px; border-bottom: 1px solid var(--rule); }
    section h3 { font-size: 1.05rem; margin: 16px 0 6px; }
    .about { margin: 8px 0 10px; color: var(--muted); }
    table { width: 100%; border-collapse: collapse; background: var(--card); border-radius: 12px; overflow: hidden; }
    th, td { text-align: left; vertical-align: top; padding: 8px 12px; border-top: 1px solid var(--rule); overflow-wrap: break-word; }
    thead th { border-top: 0; font-size: 0.85rem; color: var(--muted); }
    td.type { width: 36%; }
    td.who { width: 16%; color: var(--muted); }
    code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.9em; background: var(--chip); color: var(--chip-text); padding: 1px 6px; border-radius: 6px; }
    [hidden] { display: none !important; }
    footer { padding-top: 28px; padding-bottom: 40px; font-size: 0.9rem; }
    /* On a phone each command is a small block of its own, so nothing has to scroll sideways. */
    @media (max-width: 600px) {
      thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      table, tbody, tr, td { display: block; }
      tr { border-top: 1px solid var(--rule); padding: 6px 0; }
      td, td.type, td.who { width: auto; border: 0; padding: 3px 12px; }
    }
  </style>
</head>
<body>
  <header>
    <a href="./">&larr; All overlays</a>
    <h1>Chat commands</h1>
    <p>Every command for every overlay, with examples to copy into chat. They use each overlay's starting command word.</p>
    <nav class="jump" aria-label="Overlays">${listed.map(o => `<a href="#${esc(o.name)}">${esc(o.title)}</a>`).join("")}</nav>
    <div id="search" hidden>
      <label for="find">Find a command</label>
      <input id="find" type="search" placeholder="Try timer, reset or !brb" autocomplete="off">
    </div>
  </header>
  <main>${listed.map(sectionHtml).join("")}
    <p id="none" role="status" hidden>No command matches that.</p>
  </main>
  <footer>${without.length ? `
    <p>No chat commands: ${without.map(o => `<a href="${esc(o.name)}/dev/">${esc(o.title)}</a>`).join(", ")}.</p>` : ""}
  </footer>
  <script>
    (function () {
      var find = document.getElementById("find"), none = document.getElementById("none");
      var each = function (from, query, fn) { Array.prototype.forEach.call(from.querySelectorAll(query), fn); };
      document.getElementById("search").hidden = false;
      // A match on an overlay's name shows all of its commands. Otherwise only the rows that match stay.
      function filter() {
        var words = find.value.toLowerCase().trim(), any = false;
        each(document, "section.overlay", function (section) {
          var whole = section.querySelector("h2").textContent.toLowerCase().indexOf(words) !== -1, shown = 0;
          each(section, ".group", function (group) {
            var here = 0;
            each(group, "tbody tr", function (row) {
              row.hidden = !(whole || row.textContent.toLowerCase().indexOf(words) !== -1);
              if (!row.hidden) here++;
            });
            group.hidden = !here;
            shown += here;
          });
          section.hidden = !shown;
          if (shown) any = true;
        });
        none.hidden = any;
      }
      find.addEventListener("input", filter);
      filter();
    })();
  </script>
</body>
</html>
`;
}

module.exports = { commandsPage, commandsOf, commandTables };
