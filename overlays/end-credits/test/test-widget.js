/* Headless test for the end credits overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData } = env;
const ev = env.ev;
const lists = () => (storeData.end_credits_v1 || { lists: {} }).lists;
const names = k => (lists()[k] || []).map(p => p.name + (p.n > 1 ? ":" + p.n : "")).join(",");
const shown = () => !E("ec-root").hidden;
const roll = () => E("ec-roll").children;
const secs = () => roll().filter(c => c.className === "ec-sec");
const headOf = s => s.children[0].textContent;
const namesOf = s => s.children[s.children.length - 1].children.map(n => n.textContent);
const chatter = (n, o) => chat("hi", Object.assign({ nick: n }, o || {}));

(async () => {
  section("collecting names");
  await load();
  ev("follower-latest", { name: "Fern" }); ev("follower-latest", { name: "fern" }); ev("follower-latest", { name: "Gus" });
  ok(names("follows") === "Fern:2,Gus", "a follower is kept once, whatever the capitals (" + names("follows") + ")");
  ev("subscriber-latest", { name: "Alder", amount: 1, tier: "1000" }); ev("subscriber-latest", { name: "Alder", amount: 7 }); ev("subscriber-latest", { name: "Briar", amount: 1 });
  ok(names("subs").split(",").length === 2 && names("subs").indexOf("Alder") === 0, "a sub and a resub by the same person are one name (" + names("subs") + ")");
  ev("subscriber-latest", { gifted: true, bulkGifted: true, amount: 5, sender: "Hazel", tier: "1000" });
  for (let i = 0; i < 5; i++) ev("subscriber-latest", { gifted: true, isCommunityGift: true, amount: 170, sender: "Hazel", name: "R" + i });
  ok(names("gifts") === "Hazel:5" && names("subs").indexOf("R") === -1, "a gift bomb counts once at its real size, and its follow-ups are not subscribers (" + names("gifts") + ")");
  ev("subscriber-latest", { gifted: true, sender: "Hazel", name: "Someone", amount: 1 }); ev("subscriber-latest", { gifted: true, sender: "Ivy", name: "Someone", amount: 1 });
  ok(names("gifts") === "Hazel:6,Ivy" && names("subs").indexOf("Someone") === -1, "a single gift counts one for the giver, not the recipient (" + names("gifts") + ")");
  ev("subscriber-latest", { gifted: true, bulkGifted: true, amount: 5, sender: "anonymous" }); ev("cheer-latest", { name: "AnAnonymousCheerer", amount: 0 });
  ok(names("gifts") === "Hazel:6,Ivy", "an anonymous gifter, and a cheer of nothing, are left out");
  ev("cheer-latest", { name: "Kestrel", amount: 100 }); ev("cheer-latest", { name: "Kestrel", amount: 50 });
  ev("tip-latest", { name: "Nettle", amount: 5 }); ev("tip-latest", { name: "Nettle", amount: 0 });
  ev("raid-latest", { name: "Pippin", amount: 30 });
  ok(names("bits") === "Kestrel:150" && names("tips") === "Nettle:5" && names("raids") === "Pippin:30", "cheers, tips and raids are kept by name (" + names("bits") + " " + names("tips") + " " + names("raids") + ")");
  chatter("Zephyr"); chatter("zephyr"); chatter("Wren");
  chat("hello", { nick: "Streamer", broadcaster: true }); chatter("Nightbot"); chatter("StreamElements");
  ok(names("chatters") === "Zephyr:2,Wren", "chatters are kept once, without the broadcaster or the bots (" + names("chatters") + ")");
  await load({ ignore: "wren" }); chatter("Wren"); chatter("Nightbot"); ok(names("chatters") === "Nightbot", "and who to leave out is a setting (" + names("chatters") + ")");

  section("the roll");
  await load();
  ok(!shown(), "nothing shows until the credits roll");
  ev("follower-latest", { name: "Fern" }); ev("subscriber-latest", { name: "Alder" }); ev("subscriber-latest", { gifted: true, bulkGifted: true, amount: 5, sender: "Hazel" });
  ev("subscriber-latest", { gifted: true, bulkGifted: true, amount: 12, sender: "Ivy" }); ev("cheer-latest", { name: "Kestrel", amount: 100 }); ev("raid-latest", { name: "Pippin", amount: 3 });
  ok(!shown(), "and collecting changes nothing on screen");
  boss("!credits roll");
  ok(shown() && E("ec-roll")._cls.has("go") && E("ec-roll").style.animationDuration === "10s", "!credits roll starts them, for a time that follows the speed (" + E("ec-roll").style.animationDuration + ")");
  ok(roll()[0].className === "ec-title" && roll()[0].textContent === "Thank you for watching", "under a title");
  ok(secs().map(headOf).join(",") === "Subscribers,Gifted subs,Cheers,Raiders,New followers", "lists come in a set order, with a heading each, and an empty one is left out (" + secs().map(headOf).join(",") + ")");
  ok(namesOf(secs()[1]).join(",") === "Ivy x12,Hazel x5", "gifters come biggest first, with how many (" + namesOf(secs()[1]).join(",") + ")");
  ok(roll()[roll().length - 1].className === "ec-end" && roll()[roll().length - 1].textContent === "See you next time", "and a last line");
  await wait(9000); ok(shown(), "they keep rolling");
  await wait(1500); ok(!shown(), "and the widget goes when they have gone past (10 seconds at this speed)");
  ok(names("follows") === "Fern", "the names are kept, to roll again");
  boss("!credits roll"); await wait(3000); boss("!credits stop"); ok(!shown(), "!credits stop ends it early");
  await wait(20000); ok(!shown(), "and it stays ended");
  await load({ speed: 20 }); ev("follower-latest", { name: "Fern" }); boss("!credits roll"); ok(E("ec-roll").style.animationDuration === "5s", "a faster speed is a shorter roll");
  await load({ animate: false }); ev("follower-latest", { name: "Fern" }); boss("!credits roll"); ok(shown() && E("ec-root").classList.contains("no-motion") && E("ec-roll")._cls.has("go"), "with Animate off it still rolls");
  await load(); ev("follower-latest", { name: "Fern" }); boss("!credits roll"); boss("!credits roll"); await wait(10500); ok(!shown(), "rolling again while it rolls starts over, and there is one end");

  section("the lists");
  await load(); ev("follower-latest", { name: "Fern" }); ev("subscriber-latest", { name: "Alder" }); ev("tip-latest", { name: "Nettle", amount: 3 }); chatter("Zephyr");
  await load({ showFollows: false, showTips: false }, true); boss("!credits roll");
  ok(secs().map(headOf).join(",") === "Subscribers,Chatters", "a list can be left out (" + secs().map(headOf).join(",") + ")");
  await load({ headSubs: "Supporters", headChatters: "" }, true); boss("!credits roll");
  ok(headOf(secs()[0]) === "Supporters" && secs()[secs().length - 1].children[0].className === "ec-names", "headings are settings, and a blank one has none");
  await load({ special: "Mum | Amy | ", headSpecial: "With love" }, true); boss("!credits roll");
  ok(headOf(secs()[0]) === "With love" && namesOf(secs()[0]).join(",") === "Mum,Amy", "special thanks come first, from the names you write");
  await load({ endLine: "", title: "" }, true); boss("!credits roll");
  ok(roll()[0].className === "ec-sec" && roll()[roll().length - 1].className === "ec-sec", "the title and last line can be blank");
  await load({ showTitle: false }, true); boss("!credits roll"); ok(roll()[0].className === "ec-sec", "or the title turned off");
  await load({ maxPerSection: 2 }); for (const n of ["A", "B", "C", "D", "E"]) ev("follower-latest", { name: n }); boss("!credits roll");
  ok(namesOf(secs()[0]).join(",") === "A,B,and 3 more", "a long list is cut, and counted (" + namesOf(secs()[0]).join(",") + ")");
  await load({ showCounts: false }); ev("subscriber-latest", { gifted: true, bulkGifted: true, amount: 5, sender: "Hazel" }); boss("!credits roll");
  ok(namesOf(secs()[0]).join(",") === "Hazel", "the count by a gifter can be left off");
  await load({}); for (let i = 0; i < 3500; i++) ev("follower-latest", { name: "n" + i });
  ok(lists().follows.length === 3000, "a list is kept to a size that cannot grow for ever (" + lists().follows.length + ")");

  section("a sample, and starting again");
  await load(); ev("follower-latest", { name: "Fern" });
  boss("!credits sample"); ok(shown() && namesOf(secs().filter(s => headOf(s) === "New followers")[0]).indexOf("Quill") !== -1 && names("follows") === "Fern", "!credits sample rolls made-up names and keeps nothing");
  await wait(10500);
  await load({ clearAfter: true }); ev("follower-latest", { name: "Fern" }); boss("!credits roll"); boss("!credits stop"); ok(names("follows") === "Fern", "stopping early keeps the names, even when set to start again");
  boss("!credits roll"); await wait(10500); ok(names("follows") === "", "set to start again, a roll that finishes clears them");
  ev("follower-latest", { name: "Fern" }); boss("!credits sample"); await wait(10500); ok(names("follows") === "Fern", "though not a sample");
  await load(); ev("follower-latest", { name: "Fern" }); boss("!credits reset"); ok(names("follows") === "", "!credits reset forgets every name");
  ev("follower-latest", { name: "Fern" }); boss("!credits clear"); ok(names("follows") === "", "so does clear");

  section("who may use it");
  await load(); ev("follower-latest", { name: "Fern" });
  chat("!credits roll", { nick: "Viewer" }); ok(!shown(), "a viewer cannot roll them");
  chat("!credits reset", { nick: "Viewer" }); ok(names("follows") === "Fern", "or start again");
  chat("!credits roll", { mod: true }); ok(shown(), "a moderator can by default");
  boss("!credits stop");
  await load({ whoCanManage: "broadcaster" }); chat("!credits roll", { mod: true }); ok(!shown(), "or only the broadcaster, when set");
  await load({ command: "!thanks" }); ev("follower-latest", { name: "Fern" }); boss("!credits roll"); ok(!shown(), "the command word is a setting");
  boss("!thanks roll"); ok(shown(), "and the new one works"); boss("!thanks stop");
  boss("!thanksx roll"); ok(!shown(), "a longer word that merely starts the same does not");
  await load(); chat("!credits", { nick: "Viewer" }); boss("!credits"); ok(!shown(), "the bare command does nothing");
  boss("!credits dance"); ok(!shown(), "and neither does one it does not know");

  section("saved");
  await load(); ev("follower-latest", { name: "Fern" }); ev("tip-latest", { name: "Nettle", amount: 3 });
  await reload(); boss("!credits roll"); ok(secs().length === 2, "the names survive a refresh");
  storeData.end_credits_v1 = { lists: { follows: [{ name: "Ok", n: 1 }, null, { name: "", n: 1 }, "x", { name: "Fine" }], subs: "no" } }; await reload(); boss("!credits roll");
  ok(secs().length === 1 && namesOf(secs()[0]).join(",") === "Ok,Fine", "a damaged save keeps what is good (" + secs().length + ")");
  storeData.end_credits_v1 = 5; await reload(); boss("!credits roll"); ok(shown() && secs().length === 0, "and one that is not even a list is ignored");

  section("buttons");
  await load(); ev("follower-latest", { name: "Fern" });
  button("btnRoll"); ok(shown() && secs().length === 1, "Roll the credits now");
  button("btnStop"); ok(!shown(), "Stop the credits");
  button("btnSample"); ok(shown() && secs().length > 3, "Roll a sample with made-up names");
  button("btnStop"); button("btnReset"); ok(names("follows") === "", "Start the lists again");

  section("look");
  await load({ titleSize: 8, headingSize: 3, nameSize: 4, gap: 6, columns: 3, radius: 10, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600 });
  const v = env.vars("ec-app");
  ok(v["--ec-title"] === 8 && v["--ec-head"] === 3 && v["--ec-name"] === 4 && v["--ec-gap"] === 6 && v["--ec-cols"] === 3, "the size, spacing and column settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-shadow"] !== "none", "the corner, outline, weight and shadow settings apply");
  await env.checkPresets("ec-app");
  await env.checkFrame("ec-app");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/container-type:\s*size/.test(css) && /--u:\s*min\(1cqw,\s*1\.7778cqh\)/.test(css) && /#ec-root\[hidden\]/.test(css), "sizes come from the same unit as the countdown, and the widget hides itself when it is not rolling");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
