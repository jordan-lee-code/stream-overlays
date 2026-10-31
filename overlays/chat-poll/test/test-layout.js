/* Layout regression test for the Chat Voting widget.
 *
 * The headless suite in test-widget.js drives the real logic through a DOM mock,
 * which is perfect for counting votes and hopeless for anything about size,
 * because a mock has no layout. Every sizing bug this widget has had was
 * invisible to it: statements broken mid-word, an option pushed off the bottom,
 * counts clipped past the right edge.
 *
 * So this one renders the actual widget in headless Chromium at a range of box
 * sizes and scale settings, and asserts on what the browser computed. It needs
 * `chromium` on PATH and skips cleanly when there is none.
 *
 *   node test/test-layout.js
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync, execFile } = require("child_process");

const ROOT = path.join(__dirname, "..");
const W = path.join(ROOT, "widget");

function chromiumBinary() {
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      execSync("command -v " + bin, { stdio: "ignore" });
      return bin;
    } catch (e) { /* try the next one */ }
  }
  return null;
}

const CHROME = chromiumBinary();
if (!CHROME) {
  console.log("No chromium on PATH, skipping the layout test.");
  process.exit(0);
}

const css = fs.readFileSync(path.join(W, "widget.css"), "utf8");
const html = fs.readFileSync(path.join(W, "widget.html"), "utf8");
const js = fs.readFileSync(path.join(W, "widget.js"), "utf8");
const fields = JSON.parse(fs.readFileSync(path.join(W, "fields.json"), "utf8"));

const defaults = {};
Object.keys(fields).forEach((k) => {
  if (fields[k].type !== "button") defaults[k] = fields[k].value;
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vote-layout-"));

/* Chicle is a wide display face and the widget's default, so measuring against a
   narrow fallback would let real overflows pass. Fetched once if the network is
   there; without it the structural assertions still hold, they are just kinder. */
let fontFace = "";
try {
  const url = "https://fonts.gstatic.com/s/chicle/v27/lJwG-pw9i2dqU-Bzzmiv.woff2";
  const out = path.join(tmp, "chicle.woff2");
  execSync(`curl -sSf --max-time 10 "${url}" -o "${out}"`, { stdio: "ignore" });
  const b64 = fs.readFileSync(out).toString("base64");
  fontFace = `@font-face{font-family:'Chicle';font-style:normal;font-weight:400;` +
    `src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
} catch (e) {
  console.log("  (no network for the Chicle font, measuring with the fallback face)");
}

// Each scenario gets its own page and its own browser profile, so several can be measured at once.
function measure(scenario, index) {
  const fd = Object.assign({}, defaults, scenario.fields || {});

  /* `lateFont` reproduces a cold browser source: the poll opens while Chicle is
     still on its way, so the first measurement sees the narrower fallback. The
     widget has to notice the font landing and measure again, or every statement
     grows past the room it was given. */
  const late = scenario.lateFont && fontFace;
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${late ? "" : fontFace}
html,body{margin:0}
#box{width:${scenario.box[0]}px;height:${scenario.box[1]}px}
${css}
*,*::before,*::after{animation:none !important;transition:none !important;}
</style></head><body><div id="box">${html}</div><script>
window.SE_API={store:{set:()=>Promise.resolve(),get:()=>Promise.resolve(null)}};
${js}
window.dispatchEvent(new CustomEvent("onWidgetLoad",{detail:{fieldData:${JSON.stringify(fd)}}}));
function chat(t){window.dispatchEvent(new CustomEvent("onEventReceived",{detail:{listener:"message",
  event:{data:{text:t,nick:"streamer",displayName:"Streamer",badges:[{type:"broadcaster"}],tags:{}}}}}));}
setTimeout(function(){
  chat(${JSON.stringify("!vote 600s " + scenario.options)});
  ${scenario.votes ? `for(var v=0;v<${scenario.votes};v++){
    window.dispatchEvent(new CustomEvent("onEventReceived",{detail:{listener:"message",
      event:{data:{text:String(${scenario.allOnOne ? "1" : "(v%" + (scenario.optionCount || 4) + ")+1"}),nick:"v"+v,displayName:"v"+v,badges:[],tags:{}}}}}));
  }` : ""}
  ${late ? `var s=document.createElement("style");
  s.textContent=${JSON.stringify(fontFace)};
  document.head.appendChild(s);` : ""}
  document.fonts.ready.then(function(){ return new Promise(function(r){ setTimeout(r,400); }); }).then(function(){
    var app=document.getElementById("vote-app"), card=document.getElementById("vote-card");
    var rows=[].slice.call(document.querySelectorAll(".vote-option"));
    document.title=JSON.stringify({
      cardW:card.offsetWidth, cardInner:card.clientWidth,
      cardOverflowY:card.scrollHeight-card.clientHeight,
      // the content box, since the widget box now carries padding for the shadow
      boxW:app.clientWidth-(parseFloat(getComputedStyle(app).paddingLeft)||0)
        -(parseFloat(getComputedStyle(app).paddingRight)||0),
      boxH:app.clientHeight-(parseFloat(getComputedStyle(app).paddingTop)||0)
        -(parseFloat(getComputedStyle(app).paddingBottom)||0),
      worstRow:Math.max.apply(null,rows.map(function(r){return r.scrollWidth;})),
      barSpread:(function(){var xs=rows.map(function(r){var b=r.querySelector(".vote-bar");
        return b?Math.round(b.getBoundingClientRect().left):0;});
        return Math.max.apply(null,xs)-Math.min.apply(null,xs);})(),
      countSpread:(function(){var xs=rows.map(function(r){var c=r.querySelector(".vote-count");
        return c?Math.round(c.getBoundingClientRect().left):0;});
        return Math.max.apply(null,xs)-Math.min.apply(null,xs);})(),
      counts:rows.map(function(r){var c=r.querySelector('.vote-count');return c?c.textContent:'';}),
      countClipped:rows.some(function(r){var c=r.querySelector('.vote-count');return c?c.scrollWidth>c.clientWidth+1:false;}),
      maxLines:Math.max.apply(null,rows.map(function(r){
        var l=r.querySelector(".vote-label");
        if(!l) return 1;
        return Math.round(l.clientHeight/parseFloat(getComputedStyle(l).lineHeight));
      }))
    });
  });
},60);
<\/script></body></html>`;

  const file = path.join(tmp, "page-" + index + ".html");
  fs.writeFileSync(file, page);
  return new Promise((resolve, reject) => {
    execFile(CHROME, [
      "--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=8000",
      "--user-data-dir=" + path.join(tmp, "profile-" + index), "--dump-dom", "file://" + file
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (err, dom) => {
      if (err) { reject(err); return; }
      const m = dom.match(/<title>([^<]*)<\/title>/);
      if (!m) { reject(new Error("the page never reported its measurements")); return; }
      try { resolve(JSON.parse(m[1])); } catch (e) { reject(e); }
    });
  });
}

const SHORT = "Spaghetti, Sandwich, Coleslaw, Ice Cream";
const LONG = "Pizza, Roll, Spaghetti, Lasagne. Sandwich, Kebab, Coleslaw, Ice Cream";
// Eight options, the maximum, and the case that was missing when every layout
// test stopped at seven and the eight-option path shipped broken.
const EIGHT = "Spaghetti, Lasagne, Salmon, Shish Kebab, Sandwich, Kebab, Coleslaw, Ice Cream";

const scenarios = [
  { name: "4 options, 1080p box, default size", box: [1920, 1080], options: SHORT },
  { name: "4 options, 1080p box, size 400%", box: [1920, 1080], options: SHORT, fields: { scale: 400 } },
  { name: "4 options, small square box, size 400%", box: [600, 600], options: SHORT, fields: { scale: 400 } },
  { name: "4 options, tall narrow box, size 400%", box: [620, 760], options: SHORT, fields: { scale: 400 } },
  { name: "7 options, 1080p box, size 400%", box: [1920, 1080], options: LONG, fields: { scale: 400 } },
  { name: "7 options, 1080p box, size 250%", box: [1920, 1080], options: LONG, fields: { scale: 250 } },
  { name: "2 options, wide short box", box: [1600, 400], options: "Yes, No" },

  // The font arriving after the poll has already been measured and laid out.
  { name: "4 options, font arrives late", box: [620, 760], options: SHORT, lateFont: true, fields: { scale: 400 } },
  { name: "7 options, font arrives late", box: [1920, 1080], options: LONG, lateFont: true, fields: { scale: 400 } },
  { name: "4 options, font arrives late, default size", box: [900, 900], options: SHORT, lateFont: true },

  { name: "8 options, 1080p box", box: [1920, 1080], options: EIGHT },
  { name: "8 options, 1080p box, size 400%", box: [1920, 1080], options: EIGHT, fields: { scale: 400 } },
  { name: "8 options, short wide box", box: [1920, 400], options: EIGHT },
  { name: "8 options, narrow tall box", box: [700, 900], options: EIGHT },
  { name: "8 options, font arrives late", box: [1920, 1080], options: EIGHT, lateFont: true },

  // Counts widen as votes land, well after the card was first measured.
  { name: "8 options, 137 votes cast", box: [1920, 1080], options: EIGHT, votes: 137, optionCount: 8 },
  { name: "4 options, 1240 votes cast", box: [1920, 1080], options: SHORT, votes: 1240, optionCount: 4 },
  { name: "8 options, 137 votes, narrow box", box: [700, 900], options: EIGHT, votes: 137, optionCount: 8 },

  /* The widest count a poll can actually produce. Every vote on one option makes
     that row read "1000 \u00b7 100%", and since the count column is shared this
     sizes it for the worst case on every row at once. */
  { name: "8 options, 1000 votes all on one (widest possible count)",
    box: [1920, 1080], options: EIGHT, votes: 1000, allOnOne: true },
  { name: "8 options, 1000 on one, narrow box",
    box: [700, 900], options: EIGHT, votes: 1000, allOnOne: true },
  { name: "4 options, 1000 on one, small square box",
    box: [600, 600], options: SHORT, votes: 1000, allOnOne: true }
];

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log("  PASS " + msg); }
  else { fail++; console.log("  FAIL " + msg); }
}

// The browsers run side by side, a few at a time, and the results are then read out in order.
async function measureAll() {
  const results = new Array(scenarios.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, scenarios.length) }, async () => {
    while (next < scenarios.length) { const at = next++; results[at] = await measure(scenarios[at], at); }
  }));
  return results;
}

measureAll().then((results) => {
scenarios.forEach((s, i) => {
  console.log("\n[" + s.name + "]");
  const r = results[i];

  ok(r.worstRow <= r.cardInner + 1,
    "no row overflows the card (widest row " + r.worstRow + " vs " + r.cardInner + " of space)");
  ok(r.cardW <= r.boxW + 1,
    "the card stays inside the box (" + r.cardW + " in " + r.boxW + ")");
  ok(r.cardOverflowY <= 1,
    "nothing is cut off the bottom (overflow " + r.cardOverflowY + "px)");
  ok(r.maxLines <= 2,
    "no statement is pushed past two lines (worst " + r.maxLines + ")");
  ok(r.barSpread <= 1,
    "every bar starts at the same place (spread " + r.barSpread + "px)");
  ok(r.countSpread <= 1,
    "every count and percentage lines up (spread " + r.countSpread + "px)");
  ok(!r.countClipped,
    "no count or percentage is clipped (widest shown: " +
    r.counts.reduce(function (a, b) { return b.length > a.length ? b : a; }, "") + ")");
});

try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best effort */ }

console.log("\n=== " + pass + " passed, " + fail + " failed ===");
process.exit(fail ? 1 : 0);
}, (e) => { console.error(e.message || e); process.exit(1); });
