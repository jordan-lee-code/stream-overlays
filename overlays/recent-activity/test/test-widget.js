/* Headless test for the recent activity feed. Runs the real widget/widget.js against a small
   mock of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, settled, wait, E, storeData, audioLog } = env;
const sub = e => env.ev("subscriber-latest", e);
const bomb = (n, who) => sub({ gifted: true, bulkGifted: true, amount: n, sender: who || "G", tier: "1000" });
const cheer = (n, name) => env.ev("cheer-latest", { amount: n, name: name === undefined ? "C" : name });
const tip = (n, name) => env.ev("tip-latest", { amount: n, name: name === undefined ? "T" : name });
const follow = n => env.ev("follower-latest", { name: n || "F" });
const raid = (n, v) => env.ev("raid-latest", { name: n || "R", amount: v === undefined ? 40 : v });
const rowEls = () => E("ac-list").children;
const rows = () => rowEls().map(li => li.children.map(c => c.textContent).join("|"));
const texts = () => rowEls().map(li => li.children[li.children.length - 1].textContent);
const totals = () => E("ac-totals").hidden ? "" : E("ac-totals").textContent;
const skip = async ms => { env.fake += ms; await wait(700); };

(async () => {
  section("what appears");
  await load();
  ok(rows().length === 0 && E("ac-title").textContent === "Recent activity" && totals() === "This stream: 0 subs · 0 gifted · 0 bits · £0", "starts empty, with the totals at zero (" + totals() + ")");
  sub({ amount: 1, tier: "1000", name: "Alice" }); ok(rows()[0] === "Sub|Alice subscribed", "a new sub (" + rows()[0] + ")");
  sub({ amount: 6, tier: "1000", name: "Bob" }); ok(texts()[0] === "Bob resubscribed for 6 months", "a resub says how many months (" + texts()[0] + ")");
  bomb(10, "Gifty");
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "Gifty", name: "R" + i });
  ok(rowEls().length === 3 && texts()[0] === "Gifty gifted 10 subs", "a gift bomb is one line at its real size, and the per-recipient follow-ups add none (" + texts()[0] + ")");
  sub({ gifted: true, amount: 1, sender: "Solo", name: "Rec", tier: "1000" }); ok(texts()[0] === "Solo gifted 1 sub", "a single gift reads in the singular (" + texts()[0] + ")");
  cheer(1500, "Cara"); ok(rows()[0] === "Bits|Cara cheered 1,500 bits", "bits, with thousands separators (" + rows()[0] + ")");
  tip(12.5, "Dan"); ok(rows()[0] === "Tip|Dan tipped £12.50", "a tip with its currency (" + rows()[0] + ")");
  tip(5, "Eli"); ok(texts()[0] === "Eli tipped £5", "whole tips have no decimals");
  follow("Fay"); ok(rows()[0] === "Follow|Fay followed", "a follow");
  raid("Gus", 1200); ok(rows()[0] === "Raid|Gus raided with 1,200 viewers", "a raid with its viewers (" + rows()[0] + ")");
  cheer(0); cheer(-5); tip(0); tip(-2); bomb(0); ok(texts()[0] === "Gus raided with 1,200 viewers", "empty events add nothing");

  section("order and length");
  await load({ rows: 3 });
  for (const n of ["A", "B", "C", "D", "E"]) follow(n);
  ok(texts().join() === "E followed,D followed,C followed", "newest first, and only as many as asked for (" + texts().join() + ")");
  await load({ rows: 3, order: "newest-last" });
  for (const n of ["A", "B", "C", "D"]) follow(n);
  ok(texts().join() === "B followed,C followed,D followed", "or newest at the bottom (" + texts().join() + ")");
  await load({ layout: "latest" });
  follow("A"); follow("B"); ok(texts().join() === "B followed" && E("ac-app").classList.contains("latest"), "the latest layout shows only the newest event");
  await load({ rows: 3 }); follow("A"); ok(rowEls()[0].className.indexOf("new") !== -1, "the newest row animates in");
  await load({ fadeAfter: 10 });
  follow("A"); ok(rowEls().length === 1, "events show at first");
  await skip(11000); ok(rowEls().length === 0, "and are hidden after the fade time (" + rowEls().length + ")");
  await load({ fadeAfter: 10 }); follow("Old"); await skip(8000); follow("Newer"); await skip(4000);
  ok(texts().join() === "Newer followed", "only the ones past the time go (" + texts().join() + ")");

  section("choosing what shows");
  await load({ showSubs: false, showGifts: false, showBits: false, showTips: false, showFollows: false, showRaids: false });
  sub({ amount: 1, name: "A" }); bomb(5); cheer(100); tip(5); follow(); raid(); ok(rows().length === 0, "each kind can be turned off");
  await load({ showBits: false }); cheer(100); follow("Z"); ok(texts().join() === "Z followed", "turning one off leaves the others");
  await load({ showBits: false }); cheer(100); await load({ showBits: true }, true); ok(rows().length === 0, "and an event hidden when it arrived stays out of the feed");
  await load({ minBits: 100, minTip: 5 });
  cheer(99, "Low"); cheer(100, "Ok"); tip(4.99, "LowT"); tip(5, "OkT"); ok(texts().join() === "OkT tipped £5,Ok cheered 100 bits", "small cheers and tips can be left out (" + texts().join() + ")");
  await load({ ignoreNames: "Nightbot, StreamElements" }); follow("nightbot"); cheer(100, "StreamElements"); follow("Real"); ok(texts().join() === "Real followed", "listed names are left out, ignoring case (" + texts().join() + ")");
  await load(); cheer(100, ""); bomb(5, "anonymous"); sub({ gifted: true, bulkGifted: true, amount: 3, sender: "AnAnonymousGifter" });
  ok(texts().join() === "Anonymous gifted 3 subs,Anonymous gifted 5 subs,Anonymous cheered 100 bits", "anonymous people are shown as Anonymous (" + texts().join() + ")");
  await load({ anonymousName: "Someone" }); cheer(100, ""); ok(texts()[0] === "Someone cheered 100 bits", "and that name is a setting");

  section("wording and tags");
  await load({ textSub: "NEW: {name}", textResub: "{name} x{months}", textGift: "{count} {subs} from {name}", textBits: "{name}: {amount}", textTip: "{name} {currency}{amount}", textFollow: "hi {name}", textRaid: "{name} +{amount}", currency: "$" });
  sub({ amount: 1, name: "A" }); sub({ amount: 3, name: "B" }); bomb(1, "C"); bomb(2, "D"); cheer(5, "E"); tip(2, "F"); follow("G"); raid("H", 9);
  ok(texts().join() === "H +9,hi G,F $2,E: 5,2 subs from D", "every sentence is a setting (" + texts().join() + ")");
  await load({ rows: 8, textSub: "NEW: {name}", textResub: "{name} x{months}", textGift: "{count} {subs} from {name}" });
  sub({ amount: 1, name: "A" }); sub({ amount: 3, name: "B" }); bomb(1, "C"); bomb(2, "D");
  ok(texts().join() === "2 subs from D,1 sub from C,B x3,NEW: A", "including the tokens (" + texts().join() + ")");
  await load({ tagSub: "S", tagGift: "G", tagBits: "B", tagTip: "T", tagFollow: "F", tagRaid: "R", rows: 8 });
  sub({ amount: 1, name: "A" }); bomb(1); cheer(1); tip(1); follow(); raid();
  ok(rows().map(r => r.split("|")[0]).join("") === "RFTBGS", "each kind has a tag of its own");
  await load({ showTags: false }); follow("A"); ok(rowEls()[0].children.length === 1, "tags can be hidden");
  await load({ showTitle: false }); ok(E("ac-title").hidden, "the title can be hidden");
  await load({ title: "Latest" }); ok(E("ac-title").textContent === "Latest", "and renamed");

  section("totals");
  await load();
  sub({ amount: 1, name: "A" }); sub({ amount: 5, name: "B" }); bomb(10); cheer(1500); cheer(500); tip(5); tip(2.5); follow(); follow(); raid();
  ok(totals() === "This stream: 2 subs · 10 gifted · 2,000 bits · £7.50", "totals add up and read well (" + totals() + ")");
  await load({ totalFollows: true, totalRaids: true, totalSubs: false }); follow(); raid(); follow();
  ok(totals() === "This stream: 0 gifted · 0 bits · £0 · 2 follows · 1 raids", "any can be added or left out (" + totals() + ")");
  await load({ totalsLabel: "" }); sub({ amount: 1, name: "A" }); ok(totals().indexOf(":") === -1, "the label can be removed");
  await load({ showTotals: false }); sub({ amount: 1, name: "A" }); ok(E("ac-totals").hidden, "the totals can be hidden");
  await load({ showSubs: false }); sub({ amount: 1, name: "A" }); ok(totals().indexOf("1 subs") === -1, "an event that is not shown is not totalled");

  section("chat commands and buttons");
  await load();
  follow("A"); sub({ amount: 1, name: "B" });
  boss("!activity clear"); ok(rowEls().length === 0 && totals().indexOf("1 subs") !== -1, "!activity clear empties the feed and keeps the totals (" + totals() + ")");
  boss("!activity reset"); ok(totals() === "This stream: 0 subs · 0 gifted · 0 bits · £0", "!activity reset clears the totals too (" + totals() + ")");
  follow("A"); chat("!activity clear", { nick: "Viewer" }); ok(rowEls().length === 1, "a viewer cannot change anything");
  chat("!activity clear", { mod: true }); ok(rowEls().length === 0, "a moderator can by default");
  await load({ whoCanManage: "broadcaster" }); follow("A"); chat("!activity clear", { mod: true }); ok(rowEls().length === 1, "or only the broadcaster, when set");
  boss("!activity"); boss("!activity nonsense"); ok(rowEls().length === 1, "the bare command and unknown ones change nothing");
  await load({ command: "!feed" }); follow("A"); boss("!activity clear"); boss("!feed clear"); ok(rowEls().length === 0, "the command word is a setting");
  await load(); follow("A"); sub({ amount: 1, name: "B" }); button("btnClear"); ok(rowEls().length === 0 && totals().indexOf("1 subs") !== -1, "the Clear button keeps the totals");
  button("btnReset"); ok(totals().indexOf("1 subs") === -1, "and Reset clears them too");

  section("saving");
  await load({ rows: 3 });
  for (let i = 0; i < 60; i++) follow("F" + i);
  ok(storeData.activity_v1 && storeData.activity_v1.feed.length === 50 && storeData.activity_v1.totals.follows === 60, "the last 50 events and the totals are saved");
  await reload(); ok(texts().join() === "F59 followed,F58 followed,F57 followed", "and survive a refresh (" + texts().join() + ")");
  follow("New"); ok(texts()[0] === "New followed", "new events carry on from where it left off");

  section("look");
  await load({ textSize: 7, titleScale: 1.5, latestScale: 2, rowGap: 0.5, radius: 10, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  const v = env.vars("ac-app");
  ok(v["--ac-size"] === "7cqw" && v["--ac-title"] === 1.5 && v["--ac-latest"] === 2 && v["--ac-gap"] === "0.5em", "the size and spacing settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("ac-root").classList.contains("no-motion"), "and Animate off stops motion");
  await env.checkPresets("ac-app");
  await env.checkFrame("ac-app");

  section("sounds");
  await load({ soundEvent: "data:audio/wav;base64,AA", soundEventVol: 40 });
  audioLog.length = 0; follow("A"); ok(audioLog.length === 1 && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "an event plays its sound at its volume");
  audioLog.length = 0; bomb(5); for (let i = 0; i < 5; i++) sub({ gifted: true, isCommunityGift: true, amount: 170 }); ok(audioLog.length === 1, "a gift bomb plays it once");
  audioLog.length = 0; button("test_soundEvent"); ok(audioLog.length === 1, "the Test button plays");
  await load({ soundEvent: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; follow("A"); ok(audioLog.length === 0, "mute silences everything");

  section("blanking the wording");
  await load({ tagSub: "" }); sub({ amount: 1, name: "A" }); ok(rowEls()[0].children.length === 1, "a blank tag means no tag for that kind of event");
  await load({ currency: "" }); tip(5, "T"); ok(texts()[0] === "T tipped 5", "a blank currency symbol means none (" + texts()[0] + ")");
  await load({ title: "" }); ok(E("ac-title").hidden, "a blank title hides the title");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
