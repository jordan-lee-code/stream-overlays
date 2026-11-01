/* Headless test for the rotating panel overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, E, storeData } = env;
const skip = async ms => { env.fake += ms; await env.wait(ms > 1000 ? ms : 400); };
const stage = () => E("rp-stage").children;
const heads = () => stage().map(e => e.children.map(c => c.textContent).join(" / "));
const shownNow = () => { const i = stage().findIndex(e => e._cls.has("on")); return i === -1 ? "" : heads()[i]; };
const dots = () => E("rp-dots").children.map(d => d._cls.has("on") ? "x" : "o").join("");
const shownOnly = () => stage().filter(e => e._cls.has("on")).length === 1;
const stored = () => storeData.rotating_panel_v1 || {};
const ENTRIES = { entry1: "Twitch | twitch.tv/me", entry2: "Discord | discord.gg/me", entry3: "!lurk | Settle in", entry4: "", entry5: "Just a heading", entry6: "| only words" };

(async () => {
  section("what it shows");
  await load(ENTRIES);
  ok(heads().join(";") === "Twitch / twitch.tv/me;Discord / discord.gg/me;!lurk / Settle in;Just a heading;only words", "each entry has its heading and words, a blank one is left out, and one with no bar is a heading alone (" + heads().join(";") + ")");
  ok(stage()[0].children[0].className === "rp-head" && stage()[0].children[1].className === "rp-text", "the heading and the words are styled apart");
  ok(stage()[3].children.length === 1 && stage()[4].children.length === 1 && stage()[4].children[0].className === "rp-text", "a lone heading, or lone words, has just that part");
  ok(shownNow() === "Twitch / twitch.tv/me" && shownOnly(), "the first one shows, and only one at a time");
  ok(E("rp-dots").children.length === 5 && dots() === "xoooo", "with a dot for each (" + dots() + ")");
  ok(!E("rp-root").hidden && E("rp-title").textContent === "Find me online" && !E("rp-title").hidden, "under a title");

  section("taking turns");
  await skip(7900); ok(shownNow().indexOf("Twitch") === 0, "an entry stays for its time (8 seconds by default)");
  await skip(500); ok(shownNow().indexOf("Discord") === 0 && dots() === "oxooo", "then the next arrives, and its dot lights (" + shownNow() + ")");
  await skip(8000); await skip(8000); await skip(8000);
  ok(shownNow().indexOf("only words") === 0, "through all of them (" + shownNow() + ")");
  await skip(8000); ok(shownNow().indexOf("Twitch") === 0 && dots() === "xoooo", "and round to the start again");
  await load(Object.assign({ seconds: 3 }, ENTRIES)); await skip(3300); ok(shownNow().indexOf("Discord") === 0, "the time is a setting");
  await load(Object.assign({ seconds: 0 }, ENTRIES)); await skip(2300); ok(shownNow().indexOf("Discord") === 0, "and cannot be shorter than two seconds");
  await load({ entry1: "Only | one", entry2: "", entry3: "", entry4: "" }); await skip(60000); ok(shownNow() === "Only / one" && E("rp-dots").hidden && E("rp-bar").hidden, "a single entry just stays, without dots or a bar");
  await load({ entry1: "", entry2: "", entry3: "", entry4: "" }); ok(E("rp-root").hidden, "with no entries the whole panel goes");
  await load({ entry1: "a|1", entry2: "b|2", entry3: "", entry4: "" }); await skip(8100); await skip(8000); ok(shownNow() === "a / 1", "two entries go back and forth");
  const many = {}; for (let i = 1; i <= 12; i++) many["entry" + i] = "h" + i + " | t";
  await load(many); ok(stage().length === 12, "up to twelve entries are read");

  section("the order");
  await load(Object.assign({ shuffle: true }, ENTRIES));
  const seen = [shownNow()];
  for (let i = 0; i < 4; i++) { await skip(8100); seen.push(shownNow()); }
  ok(new Set(seen).size === 5, "a shuffle shows every entry once round (" + seen.length + " shown, " + new Set(seen).size + " different)");
  const second = [];
  for (let i = 0; i < 5; i++) { await skip(8100); second.push(shownNow()); }
  ok(new Set(second).size === 5 && second[0] !== seen[4], "and again the next time round, never the same one twice in a row");
  await load(ENTRIES); await skip(8100); await skip(8000); await skip(8000); await skip(8000); await skip(8000);
  ok(shownNow().indexOf("Twitch") === 0, "without shuffle the order is the one written");

  section("chat commands");
  await load(ENTRIES);
  boss("!panel next"); ok(shownNow().indexOf("Discord") === 0 && dots() === "oxooo", "!panel next moves on (" + shownNow() + ")");
  boss("!panel prev"); boss("!panel prev"); ok(shownNow().indexOf("only words") === 0, "!panel prev goes back, and round to the last from the start (" + shownNow() + ")");
  boss("!panel go 3"); ok(shownNow().indexOf("!lurk") === 0, "!panel go 3 jumps to the third as written");
  boss("!panel go 9"); boss("!panel go x"); boss("!panel go"); ok(shownNow().indexOf("!lurk") === 0, "an entry that is not there changes nothing");
  await skip(7000); boss("!panel next"); await skip(7000); ok(shownNow().indexOf("Just a heading") === 0, "moving on starts the entry's time again");
  boss("!panel pause"); ok(E("rp-app").classList.contains("paused") && stored().paused === true, "!panel pause holds it where it is");
  await skip(60000); ok(shownNow().indexOf("Just a heading") === 0, "for as long as you like");
  await reload(); await skip(60000); ok(shownNow().indexOf("Twitch") === 0 || shownNow().indexOf("Just") === 0, "and a refresh keeps it held (" + shownNow() + ")");
  boss("!panel resume"); ok(!E("rp-app").classList.contains("paused"), "!panel resume lets it carry on");
  await skip(8100); ok(shownNow().indexOf("Just a heading") === -1, "and it moves on after its time");
  boss("!panel off"); ok(E("rp-root").hidden && stored().off === true, "!panel off hides the whole panel");
  await reload(); ok(E("rp-root").hidden, "through a refresh");
  boss("!panel on"); ok(!E("rp-root").hidden, "!panel on brings it back");
  await load(ENTRIES); chat("!panel next", { nick: "Viewer" }); chat("!panel off", { mod: false }); ok(shownNow().indexOf("Twitch") === 0 && !E("rp-root").hidden, "a viewer cannot steer it");
  chat("!panel next", { mod: true }); ok(shownNow().indexOf("Discord") === 0, "a moderator can by default");
  await load(Object.assign({ whoCanManage: "broadcaster" }, ENTRIES)); chat("!panel next", { mod: true }); ok(shownNow().indexOf("Twitch") === 0, "or only the broadcaster, when set");
  await load(Object.assign({ command: "!links" }, ENTRIES)); boss("!panel next"); ok(shownNow().indexOf("Twitch") === 0, "the command word is a setting");
  boss("!links next"); ok(shownNow().indexOf("Discord") === 0, "and the new one works");
  boss("!linksx next"); ok(shownNow().indexOf("Discord") === 0, "but a longer word that merely starts the same does not");
  await load(ENTRIES); chat("!panel", { nick: "Viewer" }); ok(E("rp-title").classList.contains("pop") && shownNow().indexOf("Twitch") === 0, "the bare command from anyone only makes the title pop");

  section("buttons");
  await load(ENTRIES);
  button("btnNext"); ok(shownNow().indexOf("Discord") === 0, "Next entry");
  button("btnPrev"); ok(shownNow().indexOf("Twitch") === 0, "Previous entry");
  button("btnPause"); ok(stored().paused === true, "Pause on this entry");
  button("btnResume"); ok(stored().paused === false, "Carry on rotating");
  button("btnHide"); ok(E("rp-root").hidden, "Hide the panel");
  button("btnShow"); ok(!E("rp-root").hidden, "Show the panel");

  section("look");
  await load(Object.assign({ textSize: 6, headingScale: 2.2, titleScale: 0.8, gap: 0.5, seconds: 5, align: "left", transition: "slide", radius: 10, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false }, ENTRIES));
  const v = env.vars("rp-app");
  ok(v["--rp-size"] === "6cqw" && v["--rp-head"] === 2.2 && v["--rp-title"] === 0.8 && v["--rp-gap"] === "0.5em" && v["--rp-dur"] === "5s" && v["--rp-align"] === "left", "the size, spacing, timing and alignment settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("rp-root").classList.contains("no-motion"), "Animate off stops motion");
  ok(E("rp-app").classList.contains("fx-slide"), "the arrival style applies");
  await load(Object.assign({ transition: "none" }, ENTRIES)); ok(E("rp-app").classList.contains("fx-none"), "including none");
  await load(Object.assign({ transition: "spin" }, ENTRIES)); ok(!E("rp-app").classList.contains("fx-none") && !E("rp-app").classList.contains("fx-slide"), "and an unknown one falls back to a fade");
  await load(Object.assign({ showDots: false, showBar: false }, ENTRIES)); ok(E("rp-dots").hidden && E("rp-bar").hidden, "the dots and the bar can be hidden");
  await load(Object.assign({ title: "" }, ENTRIES)); ok(E("rp-title").hidden, "a blank title hides it");
  await load(Object.assign({ showTitle: false }, ENTRIES)); ok(E("rp-title").hidden, "so does turning it off");
  await load(Object.assign({ title: "Links" }, ENTRIES)); ok(E("rp-title").textContent === "Links", "and it can be renamed");
  await env.checkPresets("rp-app");
  await env.checkFrame("rp-app");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
