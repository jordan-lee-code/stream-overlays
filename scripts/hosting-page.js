/* Copyright (c) 2026 Jordan Lee (https://ko-fi.com/journeyingjordan). Released under the MIT licence: this notice must be kept in copies and substantial portions of the code. See LICENSE. */
/* For an overlay that works alongside a service you run yourself, the website needs two more things:
 * the service's files to download, and the steps for hosting it. Both are made here, from the files
 * in the overlay's folder, so the site and the repository cannot say different things.
 *
 * An overlay asks for them with a `hosting` entry in its package.json:
 *   { "folder": "server", "guide": "README.md", "zip": "name.zip", "unzipsTo": "name", "files": [...] }
 * Only the files it names, and the guide, go into the download. A real answers file or key left in
 * the same folder is never picked up. */
"use strict";
const fs = require("fs");
const path = require("path");

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- a zip with its files stored as they are, which needs nothing installed to make ----
const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// Every file is dated 1 January 2026, so the same files always make the same zip.
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function zip(entries) {
  const files = [], directory = [];
  let offset = 0;
  entries.forEach(e => {
    const name = Buffer.from(e.name, "utf8"), crc = crc32(e.data), size = e.data.length;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(DOS_DATE, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(size, 18); local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x0314, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(DOS_DATE, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(size, 20); central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);     // an ordinary file, when unzipped on Linux or a Mac
    central.writeUInt32LE(offset, 42);
    files.push(local, name, e.data);
    directory.push(central, name);
    offset += local.length + name.length + size;
  });
  const listing = Buffer.concat(directory), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(listing.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat(files.concat([listing, end]));
}

// ---- as much Markdown as a hosting guide uses: headings, paragraphs, lists, tables, code and links ----
function inline(text) {
  return text.split(/(`[^`]*`)/).map(part => {
    if (part.length > 1 && part[0] === "`" && part[part.length - 1] === "`") return "<code>" + esc(part.slice(1, -1)) + "</code>";
    return esc(part)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // Only web addresses become links. A path into the repository would lead nowhere on the site.
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, words, to) => /^https?:\/\//.test(to) ? '<a href="' + to + '">' + words + "</a>" : words);
  }).join("");
}
function markdown(source) {
  const lines = String(source).replace(/\r\n/g, "\n").split("\n"), out = [];
  const cells = row => row.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const starts = l => /^(#{1,4}\s|```|\||- |\d+\. )/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }
    if (/^```/.test(line)) {
      const code = [];
      for (i++; i < lines.length && !/^```/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      out.push("<pre><code>" + esc(code.join("\n")) + "</code></pre>");
    } else if ((m = /^(#{1,4})\s+(.*)$/.exec(line))) {
      out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">");
      i++;
    } else if (/^\|/.test(line)) {
      const rows = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(lines[i]);
      const row = (r, tag) => "<tr>" + cells(r).map(c => "<" + tag + ">" + inline(c) + "</" + tag + ">").join("") + "</tr>";
      out.push('<div class="wide"><table><thead>' + row(rows[0], "th") + "</thead><tbody>" + rows.slice(2).map(r => row(r, "td")).join("") + "</tbody></table></div>");
    } else if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d/.test(line), marker = ordered ? /^\d+\. / : /^- /, items = [];
      for (; i < lines.length && marker.test(lines[i]); i++) items.push("<li>" + inline(lines[i].replace(marker, "")) + "</li>");
      out.push((ordered ? "<ol>" : "<ul>") + items.join("") + (ordered ? "</ol>" : "</ul>"));
    } else {
      const words = [line];
      for (i++; i < lines.length && lines[i].trim() && !starts(lines[i]); i++) words.push(lines[i]);
      out.push("<p>" + inline(words.join(" ")) + "</p>");
    }
  }
  return out.join("\n");
}

function page(title, zipName, unzipsTo, guide) {
  const body = markdown(guide);
  const download = '<aside class="download"><a class="go" href="' + esc(zipName) + '" download>Download the server files</a>' +
    "<p>A zip file that unzips to a folder called <code>" + esc(unzipsTo) + "</code>, with the server, an example of its data file, the other files these steps use and a copy of this page.</p></aside>";
  const first = body.indexOf("<h2>");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hosting for ${esc(title)}</title>
  <script>
    try { if (localStorage.getItem("stream-overlays-theme") === "light") document.documentElement.setAttribute("data-theme", "light"); } catch (e) {}
  </script>
  <style>
    :root { color-scheme: dark; --bg: #14111c; --text: #e8e3f2; --card: #1f1a2c; --link: #c0abff; --btn: #6a4cb8; --btn-hover: #7d60cc; --rule: #332b4a; }
    html[data-theme="light"] { color-scheme: light; --bg: #f3eefb; --text: #2b2f36; --card: #fff; --link: #5b3fa0; --btn: #5b3fa0; --btn-hover: #46307f; --rule: #d9cff0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Quicksand", "Segoe UI", system-ui, sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; }
    main { max-width: 780px; margin: 0 auto; padding: 24px 20px 56px; }
    nav { display: flex; gap: 16px; flex-wrap: wrap; }
    a { color: var(--link); }
    h1 { font-size: 1.9rem; margin: 18px 0 8px; }
    h2 { font-size: 1.3rem; margin: 30px 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--rule); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; background: var(--card); border-radius: 5px; padding: 1px 5px; overflow-wrap: break-word; }
    pre { background: var(--card); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; overflow-x: auto; }
    pre code { padding: 0; background: none; overflow-wrap: normal; }
    .wide { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid var(--rule); }
    .download { background: var(--card); border: 1px solid var(--rule); border-radius: 14px; padding: 16px; margin: 18px 0; }
    .download p { margin: 10px 0 0; }
    a.go { display: inline-block; padding: 8px 16px; border-radius: 999px; background: var(--btn); color: #fff; text-decoration: none; font-weight: 700; }
    a.go:hover, a.go:focus { background: var(--btn-hover); }
  </style>
</head>
<body>
  <main>
    <nav><a href="../">All overlays</a><a href="dev/">Set up the ${esc(title)} overlay</a></nav>
${first === -1 ? body + download : body.slice(0, first) + download + "\n" + body.slice(first)}
  </main>
</body>
</html>
`;
}

// Writes the download and the page into the overlay's folder on the site.
function writeHosting(overlayDir, outDir, title, hosting) {
  const from = path.join(overlayDir, hosting.folder);
  const guide = fs.readFileSync(path.join(from, hosting.guide), "utf8");
  const entries = hosting.files.concat([hosting.guide]).map(f => ({ name: hosting.unzipsTo + "/" + f, data: fs.readFileSync(path.join(from, f)) }));
  fs.writeFileSync(path.join(outDir, hosting.zip), zip(entries));
  fs.writeFileSync(path.join(outDir, "hosting.html"), page(title, hosting.zip, hosting.unzipsTo, guide));
}

module.exports = { writeHosting, markdown, zip, crc32 };
