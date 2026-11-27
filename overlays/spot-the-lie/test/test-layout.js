/* Layout test for the Two Truths and a Lie widget. The DOM mock has no layout, so this renders the
   real widget in headless Chromium and skips when chromium is not on PATH.
   
     node test/test-layout.js */
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

/* The default font is wide, so it is fetched when the network allows. */
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

  /* lateFont opens the poll before the font has arrived. */
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
// Eight options, the maximum.
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

  /* Every vote on one option gives the widest count. */
  { name: "8 options, 1000 votes all on one (widest possible count)",
    box: [1920, 1080], options: EIGHT, votes: 1000, allOnOne: true },
  { name: "8 options, 1000 on one, narrow box",
    box: [700, 900], options: EIGHT, votes: 1000, allOnOne: true },
  { name: "4 options, 1000 on one, small square box",
    box: [600, 600], options: SHORT, votes: 1000, allOnOne: true }
];

/* One round, from the vote opening to a long lie, measuring where every part sits at each step. The card and
   its parts must not move or change size, and every piece of text must be inside its own space. */
const LONG_NAME = "Sample_Wren_With_A_Long_Name";
const LONG_LIE = "I spent a whole summer teaching a very stubborn parrot to say good morning, and it only ever learned to cough";
const ANSWERS = [LONG_LIE, "I can juggle five oranges at once while reciting the alphabet backwards", "I once met a penguin on a bus"];
function round(box, index, answers) {
  const page = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontFace}
html,body{margin:0}
#box{width:${box[0]}px;height:${box[1]}px}
${css}
*:not(.vote-praise-names),*::before,*::after{animation:none !important;transition:none !important;}
</style></head><body><div id="box">${html}</div><script>
window.SE_API={store:{set:()=>Promise.resolve(),get:()=>Promise.resolve(null)}};
var served={rev:1,number:0,who:"",letter:"",lie:""};
window.fetch=function(){return Promise.resolve({ok:true,json:function(){return Promise.resolve(served)}})};
${js}
window.dispatchEvent(new CustomEvent("onWidgetLoad",{detail:{fieldData:${JSON.stringify(Object.assign({}, defaults, { serverUrl: "https://x", followSeconds: 1, mute: true }))}}}));
function chat(t,n){window.dispatchEvent(new CustomEvent("onEventReceived",{detail:{listener:"message",
  event:{data:{text:t,nick:n||"streamer",displayName:n||"Streamer",badges:n?[]:[{type:"broadcaster"}],tags:{}}}}}));}
var answers=${JSON.stringify(answers || null)};
var steps=[], wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};
function look(name){
  var card=document.getElementById("vote-card"), c=card.getBoundingClientRect();
  var at=[".vote-card",".vote-head",".vote-eyebrow",".vote-options",".vote-lie",".vote-foot",".vote-option",".vote-bar",".vote-count"].map(function(q){
    return [].map.call(document.querySelectorAll(q),function(e){var r=e.getBoundingClientRect();
      var b=[r.top,r.height]; if(q!==".vote-eyebrow") b.push(r.left,r.width);
      if(q===".vote-count") b=[r.left,r.width];   // its height follows its text, which may shrink
      if(q===".vote-option") b=[e.offsetTop,e.offsetHeight,e.offsetWidth];
      return b.map(Math.round).join(",")}).join(";")}).join("|");
  var clipped=[].filter.call(document.querySelectorAll(".vote-title,.vote-lie,.vote-count,.vote-label"),function(e){
    var r=document.createRange();r.selectNodeContents(e);var wide=e.scrollWidth>e.clientWidth||(e.className==="vote-title"&&r.getBoundingClientRect().width>e.getBoundingClientRect().width+0.05);return getComputedStyle(e).visibility!=="hidden"&&(wide||(/lie|label/.test(e.className)&&e.scrollHeight>e.clientHeight+Math.max(1,parseFloat(getComputedStyle(e).fontSize)*0.4)))}).map(function(e){return e.className});
  var low=document.querySelector(".vote-foot").getBoundingClientRect().bottom;
  var list=document.querySelector(".vote-options").getBoundingClientRect(), rows=[].slice.call(document.querySelectorAll(".vote-option"));
  var whole=rows.length===3&&rows.every(function(r){var b=r.getBoundingClientRect();return b.top>=list.top-1&&b.bottom<=list.bottom+1});
  steps.push({name:name,at:at,whole:whole,clipped:clipped,inside:low<=c.bottom+1&&c.bottom<=${box[1]}+1&&c.right<=${box[0]}+1,
    w:Math.round(c.width),h:Math.round(c.height),text:parseFloat(getComputedStyle(card).fontSize),title:document.querySelector(".vote-title").textContent});
}
(async function(){
  await document.fonts.ready; await wait(60);
  if(answers){ served={rev:2,number:5,who:"${LONG_NAME}",letter:"",lie:"",answers:answers}; await wait(1300); }
  else { chat("!vote 600s"); await wait(300); }
  look("vote open");
  chat("a","a_very_long_viewer_name_indeed_it_is"); for(var v=0;v<999;v++) chat("a","v"+v); await wait(300); look("1000 votes");
  served={rev:3,number:5,who:"${LONG_NAME}",letter:"",lie:"",answers:answers||[]}; await wait(1300); look("long name");
  served={rev:4,number:5,who:"${LONG_NAME}",letter:"A",lie:${JSON.stringify(LONG_LIE)},answers:answers||[]}; await wait(1300); look("long lie");
  await wait(5000);
  var card=document.getElementById("vote-card").getBoundingClientRect(), say=document.getElementById("vote-praise-title").getBoundingClientRect();
  var view=document.getElementById("vote-praise-window").getBoundingClientRect(), names=document.getElementById("vote-praise-names");
  steps.praise={shown:!document.getElementById("vote-praise").hidden,w:Math.round(card.width),h:Math.round(card.height),
    titleIn:say.top>=card.top&&say.bottom<=view.top+1&&say.height>0,viewIn:view.bottom<=card.bottom+1&&view.height>20,
    scrolls:names.classList.contains("scroll"),wide:names.scrollWidth>names.clientWidth+1,
    from:parseFloat(names.style.getPropertyValue("--praise-from")),to:parseFloat(names.style.getPropertyValue("--praise-to")),
    viewH:view.height,listH:names.offsetHeight,
    perLine:[].every.call(names.children,function(n,i){return !i||n.offsetTop>=names.children[i-1].offsetTop+names.children[i-1].offsetHeight-1}),
    count:names.children.length,
    // When the browser's own animation ends, in seconds from its start, counting any head start.
    ends:names.getAnimations().length?names.getAnimations()[0].effect.getComputedTiming().endTime/1000:0};
  await wait(10500);
  var bc=document.getElementById("vote-card").getBoundingClientRect(), list=document.getElementById("vote-board-list"), lr=list.getBoundingClientRect();
  var board={shown:!document.getElementById("vote-board").hidden,w:Math.round(bc.width),h:Math.round(bc.height),count:list.children.length,
    rows:[].every.call(list.children,function(r){var b=r.getBoundingClientRect();return b.top>=lr.top-1&&b.bottom<=lr.bottom+1&&b.left>=lr.left-1&&b.right<=lr.right+1&&b.height>8}),
    points:[].every.call(list.querySelectorAll(".vote-board-points"),function(p){var b=p.getBoundingClientRect();return b.width>0&&b.right<=lr.right+1}),
    inside:lr.bottom<=bc.bottom+1,
    top:list.children.length?list.children[0].getBoundingClientRect().top-lr.top:99};
  // With only one person listed, first place is in the same spot, not floating in the middle.
  var kept=[].slice.call(list.children,1); kept.forEach(function(r){list.removeChild(r)});
  board.alone=list.children[0].getBoundingClientRect().top-lr.top;
  board.under=list.children[0].getBoundingClientRect().top-document.getElementById("vote-board-title").getBoundingClientRect().bottom;
  board.text=parseFloat(getComputedStyle(document.getElementById("vote-card")).fontSize);
  document.title=JSON.stringify({steps:steps,praise:steps.praise,board:board});
})();
<\/script></body></html>`.replace("<\\/script>", "<\/script>");
  const file = path.join(tmp, "round-" + index + ".html");
  fs.writeFileSync(file, page);
  return new Promise((resolve, reject) => {
    execFile(CHROME, [
      "--headless", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=34000",
      "--user-data-dir=" + path.join(tmp, "round-profile-" + index), "--dump-dom", "file://" + file
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }, (err, dom) => {
      const m = !err && dom.match(/<title>([^<]*)<\/title>/);
      if (!m) { reject(err || new Error("the round never reported")); return; }
      resolve(JSON.parse(m[1]));
    });
  });
}
const ROUND_BOXES = [[640, 360], [900, 300], [500, 500], [1920, 1080]];

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

const plans = ROUND_BOXES.map((box) => ({ box })).concat(ROUND_BOXES.map((box) => ({ box, answers: ANSWERS })));
return Promise.all(plans.map((p, i) => round(p.box, i, p.answers))).then((rounds) => {
  rounds.forEach((result, i) => {
    const steps = result.steps, praise = result.praise, board = result.board;
    const box = plans[i].box;
    console.log("\n[one round " + (plans[i].answers ? "with three long answers " : "") + "in a " + box[0] + " by " + box[1] + " box]");
    const first = steps[0];
    ok(steps.length === 4 && /Long_Name/.test(steps[3].title), "the round reaches the long lie");
    ok(first.w >= box[0] * 0.85 && first.h >= box[1] * 0.85, "the card fills the box (" + first.w + " by " + first.h + ")");
    steps.slice(1).forEach((s) => ok(s.at === first.at && s.text === first.text, "nothing moves or changes size at: " + s.name));
    ok(steps.every((s) => !s.clipped.length), "all the text fits its space (" + steps.map((s) => s.clipped.join(" ")).join("/") + ")");
    ok(steps.every((s) => s.inside), "and everything stays inside the card");
    ok(steps.every((s) => s.whole), "with all three rows showing in full");
    ok(praise.shown && praise.w === first.w && praise.h === first.h, "Well Done takes over a card of the same size (" + praise.w + " by " + praise.h + ")");
    ok(praise.titleIn && praise.viewIn && !praise.wide, "with its heading and the names inside it");
    ok(board.shown && board.w === first.w && board.h === first.h, "the leaderboard keeps the card the same size");
    ok(board.count === 5 && board.rows && board.points && board.inside, "with all five rows and their points inside it");
    ok(Math.abs(board.top) <= 1 && Math.abs(board.alone) <= 1 && board.under >= 0 && board.under <= board.text, "first place sits just under the heading, with five listed or only one (" + Math.round(board.under) + "px below it)");
    ok(praise.ends > 0 && praise.ends < 10, "ending before the card leaves at ten seconds (" + praise.ends.toFixed(2) + "s)");
    ok(praise.count > 1 && praise.perLine, "with each name on its own line (" + praise.count + " lines)");
    ok(praise.scrolls && Math.abs(praise.from - praise.viewH) <= 2 && Math.abs(praise.to + praise.listH) <= 2, "rolling from below the window until the last has left the top (" + praise.from + " to " + praise.to + ")");
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  console.log("\n=== " + pass + " passed, " + fail + " failed ===");
  process.exit(fail ? 1 : 0);
});
}).catch((e) => { console.error(e.message || e); process.exit(1); });
