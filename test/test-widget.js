/* Headless test for the hype meter. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, settled, wait, E, storeData, audioLog } = env;
const sub = e => env.ev("subscriber-latest", e);
const cheer = n => env.ev("cheer-latest", { amount: n, name: "C" });
const tip = n => env.ev("tip-latest", { amount: n, name: "T" });
const bomb = n => sub({ gifted: true, bulkGifted: true, amount: n, sender: "G", tier: "1000" });
const msg = (text, nick) => chat(text, { nick: nick || "viewer" });
const level = () => E("hy-name").textContent;
const pts = () => E("hy-points").textContent;
const banner = () => E("hy-banner").hidden ? "" : E("hy-banner").textContent;
const status = () => E("hy-status").hidden ? "" : E("hy-status").textContent;
const skip = async ms => { env.fake += ms; await wait(400); };
const pipsOn = () => E("hy-pips").children.filter(p => p.className.indexOf("on") !== -1).length;

(async () => {
  section("the meter");
  await load();
  ok(level() === "Warming up" && pts() === "0 / 100" && E("hy-num").textContent === "Level 1", "starts on level 1 with nothing in the bar (" + level() + ", " + pts() + ")");
  boss("!hype add 40"); ok(pts() === "40 / 100" && E("hy-fill").style.width === "40%", "points fill the bar (" + pts() + ")");
  boss("!hype add 70"); ok(level() === "Heating up" && pts() === "10 / 150", "overflowing a level carries into the next, which is bigger (" + level() + ", " + pts() + ")");
  ok(pipsOn() === 2, "and a dot lights for each level reached (" + pipsOn() + ")");
  boss("!hype add 2000"); ok(level() === "Legendary" && pts() === "MAX" && E("hy-app").classList.contains("full"), "the top level fills and says MAX (" + level() + ", " + pts() + ")");
  boss("!hype add 500"); ok(pts() === "MAX" && E("hy-fill").style.width === "100%", "and it does not overflow");
  await load({ levels: 3, levelNames: "One, Two", basePoints: 50, growth: 1 });
  boss("!hype add 100"); ok(level() === "Level 3" && E("hy-pips").children.length === 3, "levels with no name use the level word, and the level count is a setting (" + level() + ")");
  await load({ levelWord: "Tier", levels: 3, levelNames: "One" }); boss("!hype add 100"); ok(level() === "Tier 2" && E("hy-num").textContent === "Tier 2", "the level word is a setting (" + level() + ")");
  await load({ maxText: "FULL", levels: 1 }); boss("!hype add 500"); ok(pts() === "FULL", "and so is the text at the top");

  section("earning from chat");
  await load();
  msg("hello", "a"); ok(pts() === "1 / 100", "a chat message earns a point");
  msg("hello again", "a"); ok(pts() === "1 / 100", "but not twice inside the cooldown");
  msg("hi", "b"); ok(pts() === "2 / 100", "another person earns straight away");
  await skip(11000); msg("back", "a"); ok(pts() === "3 / 100", "and the first person can earn again after it (" + pts() + ")");
  msg("!lurk", "c"); msg("!hype", "c"); ok(pts() === "3 / 100", "commands earn nothing by default");
  await load({ ignoreCommands: false }); msg("!lurk", "c"); ok(pts() === "1 / 100", "unless that is turned off");
  await load({ ignoreNames: "Nightbot, Moobot" }); msg("hi", "nightbot"); msg("hi", "moobot"); msg("hi", "real"); ok(pts() === "1 / 100", "listed chatters earn nothing, ignoring case (" + pts() + ")");
  await load({ userCooldown: 0 }); msg("a", "x"); msg("b", "x"); msg("c", "x"); ok(pts() === "3 / 100", "a cooldown of zero lets everything through");
  await load({ pointsMessage: 0 }); msg("a", "x"); ok(pts() === "0 / 100", "and chat can be made to earn nothing");
  await load({ pointsMessage: 5 }); msg("a", "x"); ok(pts() === "5 / 100", "the points per message are a setting");

  section("earning from events");
  await load();
  sub({ amount: 1, tier: "1000", name: "A" }); ok(pts() === "20 / 100", "a tier 1 sub earns 20 (" + pts() + ")");
  sub({ amount: 4, tier: "prime", name: "B" }); ok(pts() === "40 / 100", "a Prime sub counts as tier 1, and a resub is one sub");
  sub({ amount: 1, tier: "2000", name: "C" }); ok(pts() === "80 / 100", "tier 2 earns 40");
  await load(); sub({ amount: 1, tier: "3000", name: "D" }); ok(level() === "Heating up" && pts() === "0 / 150", "tier 3 earns 100, which fills the first level (" + level() + ", " + pts() + ")");
  await load();
  bomb(5);
  for (let i = 0; i < 5; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "G", name: "R" + i });
  ok(level() === "Heating up" && pts() === "0 / 150", "a gift bomb of 5 earns 5 x 20 once, and the per-recipient follow-ups earn nothing (" + level() + ", " + pts() + ")");
  await load(); sub({ gifted: true, amount: 1, tier: "1000", sender: "G", name: "R" }); ok(pts() === "20 / 100", "a single gifted sub earns 20");
  await load(); cheer(500); ok(pts() === "25 / 100", "500 bits at 5 per 100 earns 25 (" + pts() + ")");
  cheer(50); ok(pts() === "27 / 100", "bits count in proportion (" + pts() + ")");
  await load(); tip(5); ok(pts() === "25 / 100", "a 5 tip earns 25");
  await load(); env.ev("follower-latest", { name: "F" }); ok(pts() === "5 / 100", "a follow earns 5");
  env.ev("raid-latest", { name: "R", amount: 30 }); ok(pts() === "30 / 100", "a raid earns 25");
  await load(); cheer(0); cheer(-100); tip(0); tip(-3); ok(pts() === "0 / 100", "empty and negative events earn nothing");
  await load({ pointsSub1: 7, pointsGift: 3, pointsBits: 1, pointsTip: 2, pointsFollow: 4, pointsRaid: 9 });
  sub({ amount: 1, tier: "1000" }); bomb(2); cheer(200); tip(1); env.ev("follower-latest", {}); env.ev("raid-latest", {});
  ok(pts() === "30 / 100", "every value is a setting (7 + 6 + 2 + 2 + 4 + 9) (" + pts() + ")");

  section("level-ups");
  await load({ bannerSeconds: 1 });
  boss("!hype add 100"); ok(banner() === "Level up: Heating up", "reaching a level shows a banner (" + banner() + ")");
  await wait(1100); ok(banner() === "", "which goes away after its time");
  await load({ bannerText: "{name}!!" }); boss("!hype add 100"); ok(banner() === "Heating up!!", "the banner text is a setting");
  await load(); boss("!hype add 10"); ok(banner() === "", "no banner without a level-up");
  await load({ showPoints: false, showPips: false, showLevelNumber: false });
  ok(E("hy-points").hidden && E("hy-pips").hidden && E("hy-num").hidden, "the points, dots and level number can each be hidden");

  section("falling when it goes quiet");
  await load({ decayPerMinute: 10, decayDelay: 0 });
  boss("!hype add 50"); await skip(60000); ok(pts() === "40 / 100", "it loses points as time passes (" + pts() + ")");
  await skip(240000); ok(pts() === "0 / 100" && level() === "Warming up", "and stops at the bottom of the level (" + pts() + ")");
  await load({ decayPerMinute: 10, decayDelay: 30 });
  boss("!hype add 50"); await skip(20000); ok(pts() === "50 / 100", "it waits for the delay before falling (" + pts() + ")");
  await load({ decayPerMinute: 0, decayDelay: 0 }); boss("!hype add 50"); await skip(600000); ok(pts() === "50 / 100", "a decay of zero never falls");
  await load({ decayPerMinute: 60, decayDelay: 0 }); boss("!hype add 120"); await skip(1000);
  boss("!hype add 1"); ok(level() === "Heating up", "(a level reached stays reached by default)");
  await skip(60000); ok(level() === "Heating up" && pts() === "0 / 150", "a level is not lost by default, it stops at the bottom of it (" + level() + ", " + pts() + ")");
  await load({ decayPerMinute: 60, decayDelay: 0, canDropLevel: true });
  boss("!hype add 120"); await skip(60000);
  ok(level() === "Warming up" && pts() === "60 / 100", "with the option on, it falls back a level (" + level() + ", " + pts() + ")");
  await load({ decayPerMinute: 60, decayDelay: 0 }); boss("!hype pause"); boss("!hype add 50"); ok(pts() === "0 / 100" && status() === "paused", "while paused it earns nothing and says so (" + status() + ")");
  boss("!hype resume"); boss("!hype add 50"); await skip(1000); ok(status() === "" && pts() !== "0 / 100", "and resuming lets it earn again");
  await load({ decayPerMinute: 60, decayDelay: 0 }); boss("!hype add 50"); boss("!hype pause"); await skip(60000); ok(pts() === "50 / 100", "paused also stops it falling");

  section("chat commands");
  await load();
  boss("!hype level 3"); ok(level() === "Hyped" && pts() === "0 / 225", "!hype level 3 jumps to a level (" + level() + ")");
  boss("!hype level 99"); ok(level() === "Legendary", "up to the top at most");
  boss("!hype level 0"); ok(level() === "Warming up", "and down to the first at least");
  boss("!hype add 30"); boss("!hype reset"); ok(level() === "Warming up" && pts() === "0 / 100", "!hype reset starts again");
  boss("!hype add"); boss("!hype add x"); boss("!hype add -5"); boss("!hype nonsense"); boss("!hype level"); ok(pts() === "0 / 100", "unreadable commands change nothing");
  chat("!hype add 50", { nick: "Viewer" }); ok(pts() === "0 / 100", "a viewer cannot change it");
  chat("!hype add 50", { mod: true }); ok(pts() === "50 / 100", "a moderator can by default");
  await load({ whoCanManage: "broadcaster" }); chat("!hype add 50", { mod: true }); ok(pts() === "0 / 100", "or only the broadcaster, when set");
  await load({ command: "!energy" }); boss("!energy add 5"); boss("!hype add 5"); ok(pts() === "5 / 100", "the command word is a setting");
  boss("!energyx add 5"); ok(pts() === "5 / 100", "and a longer word that merely starts the same is not the command");

  section("buttons");
  await load({ addAmount: 30 });
  button("btnAdd"); ok(pts() === "30 / 100", "Add those points");
  button("btnLevelUp"); ok(level() === "Heating up", "Go up a level");
  button("btnLevelDown"); ok(level() === "Warming up", "Go down a level");
  button("btnAdd"); button("btnReset"); ok(pts() === "0 / 100", "Reset");
  button("btnPause"); button("btnAdd"); ok(pts() === "0 / 100", "Pause");
  button("btnResume"); button("btnAdd"); ok(pts() === "30 / 100", "Resume");

  section("saving");
  await load({ decayPerMinute: 0 });
  boss("!hype add 130"); boss("!hype pause");
  ok(storeData.hype_v1 && storeData.hype_v1.level === 2 && storeData.hype_v1.paused === true, "the meter is saved");
  await reload(); ok(level() === "Heating up" && pts() === "30 / 150" && status() === "paused", "and survives a refresh (" + level() + ", " + pts() + ")");

  section("look");
  await load({ textSize: 9, titleScale: 1.4, barHeight: 1, radius: 10, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false, title: "Chat energy" });
  const v = env.vars("hy-app");
  ok(v["--hy-size"] === "9cqw" && v["--hy-title"] === 1.4 && v["--hy-bar"] === "1em" && E("hy-title").textContent === "Chat energy", "the size settings and the title apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("hy-root").classList.contains("no-motion"), "and Animate off stops motion");
  await load({ showTitle: false }); ok(E("hy-title").hidden, "the title can be hidden");
  await env.checkPresets("hy-app");

  section("sounds");
  await load({ soundLevel: "data:audio/wav;base64,AA", soundLevelVol: 40, soundMax: "data:audio/wav;base64,BB", soundDrop: "data:audio/wav;base64,CC", levels: 2 });
  audioLog.length = 0; boss("!hype add 100"); ok(audioLog.length === 1 && /BB/.test(audioLog[0].src), "reaching the top plays the top sound");
  audioLog.length = 0; boss("!hype level 1"); ok(audioLog.length === 1 && /CC/.test(audioLog[0].src), "losing a level plays the drop sound");
  await load({ soundLevel: "data:audio/wav;base64,AA", soundLevelVol: 40 }); audioLog.length = 0; boss("!hype add 100");
  ok(audioLog.length === 1 && /AA/.test(audioLog[0].src) && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "a level plays its sound at its volume");
  audioLog.length = 0; button("test_soundLevel"); ok(audioLog.length === 1, "the Test buttons play");
  await load({ soundLevel: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; boss("!hype add 100"); ok(audioLog.length === 0, "mute silences everything");

  section("blanking the wording");
  await load({ bannerText: "" }); boss("!hype add 100"); ok(level() === "Heating up" && E("hy-banner").hidden, "a blank banner text means no banner, and the level-up still happens");
  await load({ levels: 1, maxText: "" }); boss("!hype add 500"); ok(pts() === "", "a blank top text shows nothing");
  await load({ levelNames: "" }); ok(level() === "Level 1", "blank level names fall back to the level word, not the default names (" + level() + ")");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
