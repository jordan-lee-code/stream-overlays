/* Headless test for the leaderboard. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, and drives it through the same events StreamElements sends. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, settled, wait, E, storeData, audioLog } = env;
const sub = e => env.ev("subscriber-latest", e);
const cheer = (n, name) => env.ev("cheer-latest", { amount: n, name: name || "Cheerer" });
const tip = (n, name) => env.ev("tip-latest", { amount: n, name: name || "Tipper" });
const bomb = (n, who) => sub({ gifted: true, bulkGifted: true, amount: n, sender: who || "Generous", tier: "1000" });
const heading = () => E("lb-heading").textContent;
const skip = async ms => { env.fake += ms; await wait(400); };
function rows() {
  const list = E("lb-list");
  return list.children.filter(li => li.className.indexOf("lb-row") === 0).map(li => li.children.map(c => c.textContent).join("|"));
}
const names = () => E("lb-list").children.filter(li => li.className.indexOf("lb-row") === 0).map(li => li.children[li.children.length - 2].textContent).join(",");

(async () => {
  section("gifters");
  await load({ mode: "gifts" });
  ok(heading() === "Top gifters" && rows().length === 0 && E("lb-list").children[0].textContent === "No one yet", "starts empty with a message");
  bomb(10, "Alice");
  for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "Alice", name: "Recipient" + i });
  ok(rows().join() === "1|Alice|10 gifted", "a gift bomb of 10 credits the gifter 10, once, not 10 plus ten streak figures (" + rows().join() + ")");
  sub({ gifted: true, amount: 1, sender: "Bob", name: "Carl", tier: "1000" });
  sub({ gifted: true, amount: 1, sender: "Bob", name: "Dee", tier: "1000" });
  ok(rows().join() === "1|Alice|10 gifted,2|Bob|2 gifted", "single gifted subs credit the gifter one each (" + rows().join() + ")");
  sub({ amount: 1, name: "Eve", tier: "1000" }); sub({ amount: 6, name: "Fay", tier: "2000" });
  ok(names() === "Alice,Bob", "a person subscribing for themselves is not a gift");
  sub({ gifted: true, amount: 5, sender: "alice" }); sub({ gifted: true, bulkGifted: true, amount: 3, sender: "ALICE" });
  ok(rows()[0] === "1|ALICE|14 gifted", "names are matched ignoring case, a single gift counts one whatever its amount says, and the latest spelling is shown (" + rows()[0] + ")");
  sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "Zed" });
  ok(names().indexOf("Zed") === -1, "a community gift follow-up on its own is ignored");
  bomb(0, "Nobody"); bomb(-4, "Nobody2"); ok(names().indexOf("Nobody") === -1, "an empty bomb is ignored");

  section("cheerers and tippers");
  await load({ mode: "bits" });
  cheer(300, "Cara"); cheer(1500, "Dan"); cheer(250, "Cara");
  ok(rows().join() === "1|Dan|1,500 bits,2|Cara|550 bits", "bits add up per person and show thousands separators (" + rows().join() + ")");
  ok(heading() === "Top cheerers", "with its own title");
  cheer(0, "Nope"); cheer(-5, "Nope"); ok(names() === "Dan,Cara", "empty cheers are ignored");
  await load({ mode: "tips" });
  tip(5, "Eli"); tip(12.5, "Fran"); tip(2.25, "Eli");
  ok(rows().join() === "1|Fran|£12.50,2|Eli|£7.25", "tips add up with two decimals when needed (" + rows().join() + ")");
  tip(10, "Gus"); ok(rows()[1] === "2|Gus|£10" || rows()[0] === "1|Fran|£12.50", "and whole amounts have no decimals (" + rows().join() + ")");
  await load({ mode: "tips", currency: "$", formatTips: "{c}{n} tipped" }); tip(3, "Hal");
  ok(rows()[0] === "1|Hal|$3 tipped", "the currency and the wording are settings (" + rows()[0] + ")");

  section("ranking");
  await load({ mode: "bits", rows: 3 });
  cheer(100, "A"); cheer(300, "B"); cheer(200, "C"); cheer(50, "D");
  ok(names() === "B,C,A", "highest first, and only the number of rows asked for (" + names() + ")");
  cheer(50, "D"); ok(names() === "B,C,A", "a tie keeps whoever got there first (" + names() + ")");
  cheer(250, "A"); ok(names() === "A,B,C", "someone overtaking moves up (" + names() + ")");
  await load({ mode: "bits", showRank: false }); cheer(100, "A"); ok(rows()[0] === "A|100 bits", "rank numbers can be hidden (" + rows()[0] + ")");
  await load({ mode: "bits", maxName: 6 }); cheer(100, "AVeryLongName"); ok(rows()[0].indexOf("AVery...") === 2 || rows()[0] === "1|AVery...|100 bits", "long names are shortened (" + rows()[0] + ")");
  await load({ mode: "bits", highlightFirst: true }); cheer(100, "A");
  ok(E("lb-list").children[0].className.indexOf("first") !== -1, "first place is highlighted");
  await load({ mode: "bits", highlightFirst: false }); cheer(100, "A");
  ok(E("lb-list").children[0].className.indexOf("first") === -1, "unless that is turned off");
  await load({ mode: "bits" }); cheer(100, "A"); cheer(50, "A");
  ok(E("lb-list").children[0].className.indexOf("bump") !== -1, "a row pops when its total changes");
  await load({ mode: "bits", highlightChange: false }); cheer(100, "A"); cheer(50, "A");
  ok(E("lb-list").children[0].className.indexOf("bump") === -1, "unless that is turned off");

  section("anonymous and ignored names");
  await load({ mode: "gifts" });
  bomb(5, "anonymous"); sub({ gifted: true, bulkGifted: true, amount: 5, sender: "" }); bomb(5, "AnAnonymousGifter"); ok(rows().length === 0, "anonymous gifters are left out by default");
  await load({ mode: "gifts", anonymousGifts: true }); bomb(5, "anonymous"); bomb(3, "AnAnonymousGifter");
  ok(rows().join() === "1|Anonymous|8 gifted", "or counted together as Anonymous (" + rows().join() + ")");
  await load({ mode: "bits", ignoreNames: "Nightbot, StreamElements " }); cheer(100, "nightbot"); cheer(100, "StreamElements"); cheer(100, "Real");
  ok(names() === "Real", "listed names are left out, ignoring case and spaces (" + names() + ")");

  section("rotating and showing one board");
  await load({ mode: "rotate", rotateSeconds: 3 });
  bomb(5, "G"); cheer(100, "C"); tip(5, "T");
  ok(heading() === "Top gifters", "rotation starts on the first board");
  await skip(3100); ok(heading() === "Top cheerers", "then moves on after the set time (" + heading() + ")");
  await skip(3100); ok(heading() === "Top tippers", "through each board");
  await skip(3100); ok(heading() === "Top gifters", "and round again");
  await load({ mode: "rotate", rotateSeconds: 3, showBits: false });
  await skip(3100); ok(heading() === "Top tippers", "a board can be left out of the rotation (" + heading() + ")");
  await load({ mode: "rotate", title: "Hall of fame" }); ok(heading() === "Hall of fame", "one title can replace every board's own");
  await load({ mode: "rotate", showTitle: false }); ok(E("lb-heading").hidden, "the title can be hidden");
  await load({ mode: "rotate", rotateSeconds: 3 });
  boss("!leaderboard show tips"); ok(heading() === "Top tippers", "!leaderboard show tips pins a board");
  await skip(3100); ok(heading() === "Top tippers", "and the rotation stays off while pinned");
  boss("!leaderboard rotate"); ok(true, "!leaderboard rotate lets it move again");
  button("btnNext"); const first = heading(); button("btnNext"); ok(heading() !== first, "the Next button moves to another board");
  button("btnRotate"); ok(true, "and the Rotate button resumes");
  await load({ mode: "gifts" }); boss("!leaderboard show bits"); ok(heading() === "Top gifters", "a fixed board cannot be pinned elsewhere");

  section("chat commands");
  await load({ mode: "gifts" });
  bomb(4, "Alice"); bomb(2, "Bob");
  boss("!leaderboard add gifts Cara 7"); ok(names() === "Cara,Alice,Bob", "!leaderboard add gifts Cara 7 gives someone a total (" + names() + ")");
  boss("!leaderboard add gifts Cara -3"); ok(rows()[1] === "2|Cara|4 gifted" || names() === "Alice,Cara,Bob", "and can take some off (" + rows().join() + ")");
  boss("!leaderboard add gifts Cara -99"); ok(names().indexOf("Cara") === -1, "never below zero, so they drop off");
  boss("!leaderboard add gifts"); boss("!leaderboard add nonsense Zed 4"); boss("!leaderboard add gifts Zed x"); ok(names() === "Alice,Bob", "unreadable ones change nothing");
  boss("!leaderboard remove alice"); ok(names() === "Bob", "!leaderboard remove takes someone off");
  chat("!leaderboard reset", { nick: "Viewer" }); ok(names() === "Bob", "a viewer cannot change anything");
  chat("!leaderboard reset", { mod: true }); ok(names() === "", "a moderator can, by default");
  await load({ mode: "gifts", whoCanManage: "broadcaster" }); bomb(3, "A");
  chat("!leaderboard reset", { mod: true }); ok(names() === "A", "or only the broadcaster, when set");
  await load({ mode: "bits" }); cheer(100, "A"); bomb(5, "B");
  boss("!leaderboard reset bits"); ok(names() === "", "!leaderboard reset bits clears one board");
  await load({ mode: "gifts" }); ok(true, "(a fresh load starts clean)");
  bomb(5, "B"); cheer(50, "B"); boss("!leaderboard reset gifts"); await load({ mode: "bits" }, true); ok(names() === "B", "and leaves the others (" + names() + ")");
  boss("!leaderboard reset"); ok(names() === "", "!leaderboard reset clears every board");
  await load({ mode: "gifts", command: "!top" }); boss("!top add gifts Q 2"); boss("!leaderboard add gifts R 2"); ok(names() === "Q", "the command word is a setting");
  button("btnReset"); ok(names() === "", "the Clear button empties every board");

  section("saving");
  await load({ mode: "gifts" }); bomb(5, "Alice"); bomb(3, "Bob"); boss("!leaderboard show gifts");
  ok(storeData.leaderboard_v1 && Object.keys(storeData.leaderboard_v1.users).length === 2, "the totals are saved");
  await reload(); ok(rows().join() === "1|Alice|5 gifted,2|Bob|3 gifted", "and survive a refresh (" + rows().join() + ")");
  bomb(3, "Cara"); ok(names() === "Alice,Bob,Cara" || names() === "Alice,Cara,Bob", "and order among ties is remembered too (" + names() + ")");

  section("look");
  await load({ mode: "bits", rowSize: 8, titleScale: 1.5, rowGap: 0.5, radius: 10, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  const v = env.vars("lb-app");
  ok(v["--lb-size"] === "8cqw" && v["--lb-title"] === 1.5 && v["--lb-gap"] === "0.5em", "the size and spacing settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("lb-root").classList.contains("no-motion"), "and Animate off stops motion");
  await load({ titleGifts: "Gift heroes", mode: "gifts", emptyText: "Be the first" });
  ok(heading() === "Gift heroes" && E("lb-list").children[0].textContent === "Be the first", "titles and the empty text are settings");
  await env.checkPresets("lb-app");
  await env.checkFrame("lb-app");

  section("sounds");
  await load({ mode: "bits", soundUpdate: "data:audio/wav;base64,AA", soundUpdateVol: 40, soundLead: "data:audio/wav;base64,BB" });
  audioLog.length = 0; cheer(100, "A"); ok(audioLog.length === 1 && /BB/.test(audioLog[0].src), "taking first place plays the lead sound");
  audioLog.length = 0; cheer(10, "B"); ok(audioLog.length === 1 && /AA/.test(audioLog[0].src) && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "another change plays the update sound at its volume");
  audioLog.length = 0; button("test_soundLead"); ok(audioLog.length === 1, "the Test buttons play");
  await load({ mode: "bits", soundUpdate: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; cheer(100, "A"); ok(audioLog.length === 0, "mute silences everything");

  section("blanking the wording");
  await load({ mode: "gifts", titleGifts: "" }); ok(E("lb-heading").hidden, "a blank board title hides the heading instead of bringing the default back");
  await load({ mode: "tips", currency: "" }); tip(5, "A"); ok(rows()[0] === "1|A|5", "a blank currency symbol means none (" + rows()[0] + ")");
  await load({ mode: "gifts", emptyText: "" }); ok(E("lb-list").children[0].textContent === "", "a blank empty text shows nothing");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
