/* Headless test for the stream goals. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, settled, wait, E, storeData, audioLog } = env;
const sub = e => env.ev("subscriber-latest", e);
const bomb = n => sub({ gifted: true, bulkGifted: true, amount: n, sender: "G", tier: "1000" });
const cheer = n => env.ev("cheer-latest", { amount: n, name: "C" });
const tip = n => env.ev("tip-latest", { amount: n, name: "T" });
const follow = () => env.ev("follower-latest", { name: "F" });
const count = k => E("sg-count-" + k).textContent;
const fill = k => E("sg-fill-" + k).style.width;
const shown = k => !E("sg-row-" + k).hidden;
const skip = async ms => { env.fake += ms; await wait(400); };
const HOUR = 3600000;

(async () => {
  section("the goals");
  await load();
  ok(E("sg-title").textContent === "Stream goals" && shown("subs") && shown("bits") && !shown("tips") && !shown("follows"), "subs and bits show by default, tips and follows do not");
  ok(count("subs") === "0 / 50" && count("bits") === "0 / 5,000" && E("sg-label-subs").textContent === "Sub goal", "each starts at zero with its goal (" + count("subs") + ", " + count("bits") + ")");
  sub({ amount: 1, tier: "1000", name: "A" }); ok(count("subs") === "1 / 50" && fill("subs") === "2%", "a sub counts one and the bar moves (" + count("subs") + ", " + fill("subs") + ")");
  sub({ amount: 6, tier: "2000", name: "B" }); ok(count("subs") === "2 / 50", "a resub is one sub, whatever its months or tier");
  sub({ gifted: true, amount: 1, tier: "1000", sender: "G", name: "R" }); ok(count("subs") === "3 / 50", "a single gifted sub counts one");
  bomb(10); for (let i = 0; i < 10; i++) sub({ gifted: true, isCommunityGift: true, amount: 170, sender: "G", name: "R" + i });
  ok(count("subs") === "13 / 50", "a gift bomb of 10 counts 10 once, and the per-recipient follow-ups count nothing (" + count("subs") + ")");
  bomb(0); bomb(-3); ok(count("subs") === "13 / 50", "empty bombs count nothing");
  cheer(1250); cheer(250); ok(count("bits") === "1,500 / 5,000" && fill("bits") === "30%", "bits add up with separators (" + count("bits") + ", " + fill("bits") + ")");
  cheer(0); cheer(-5); ok(count("bits") === "1,500 / 5,000", "empty cheers count nothing");
  await load({ showTips: true, showFollows: true });
  tip(5); tip(2.5); follow(); follow(); follow();
  ok(count("tips") === "£7.50 / £50" && count("follows") === "3 / 100", "tips and follows can be switched on (" + count("tips") + ", " + count("follows") + ")");
  await load({ showSubs: false }); ok(!shown("subs") && shown("bits"), "any goal can be hidden");
  await load({ subPoints: true }); sub({ amount: 1, tier: "1000" }); sub({ amount: 1, tier: "2000" }); sub({ amount: 1, tier: "3000" }); sub({ amount: 1, tier: "prime" });
  ok(count("subs") === "10 / 50", "sub points count tier 2 as 2 and tier 3 as 6 (1 + 2 + 6 + 1) (" + count("subs") + ")");
  bomb(5); ok(count("subs") === "15 / 50", "and a bomb counts each gift as a tier 1 sub");

  section("reaching a goal");
  await load({ targetSubs: 3, raiseSubs: 0 });
  sub({ amount: 1 }); sub({ amount: 1 }); sub({ amount: 1 });
  ok(count("subs") === "Goal reached!" && fill("subs") === "100%" && E("sg-row-subs").classList.contains("reached"), "reaching the goal says so and fills the bar (" + count("subs") + ")");
  sub({ amount: 1 }); ok(count("subs") === "Goal reached!" && fill("subs") === "100%", "with no raise it stays reached, and the bar stops at the top");
  await load({ targetSubs: 3, raiseSubs: 0, reachedText: "Done!" }); for (let i = 0; i < 3; i++) sub({ amount: 1 }); ok(count("subs") === "Done!", "the text is a setting");
  await load({ targetSubs: 3, raiseSubs: 2, raiseDelay: 1 });
  for (let i = 0; i < 3; i++) sub({ amount: 1 });
  ok(count("subs") === "Goal reached!", "with a raise it first celebrates");
  await wait(1200); ok(count("subs") === "3 / 5" && fill("subs") === "60%" && !E("sg-row-subs").classList.contains("reached"), "then the goal is raised by the amount you set (" + count("subs") + ")");
  sub({ amount: 1 }); sub({ amount: 1 }); await wait(1200); ok(count("subs") === "5 / 7", "and again each time it is reached (" + count("subs") + ")");
  await load({ targetBits: 100, raiseBits: 100, raiseDelay: 1 }); cheer(450); await wait(1200);
  ok(count("bits") === "450 / 500" || count("bits") === "Goal reached!", "a big gift can pass several goals at once (" + count("bits") + ")");
  await load({ targetBits: 100, raiseBits: 100, raiseDelay: 1 }); cheer(450); await wait(1300); ok(count("bits") === "450 / 500", "and raises past all of them (" + count("bits") + ")");
  await load({ format: "{n} of {target} subs", targetSubs: 10 }); sub({ amount: 1 }); ok(count("subs") === "1 of 10 subs", "the wording of a count is a setting");
  await load({ labelSubs: "Road to 100" }); ok(E("sg-label-subs").textContent === "Road to 100", "and so is a label");
  await load({ targetSubs: 20 }); sub({ amount: 1 }); ok(count("subs") === "1 / 20", "a goal can be changed in the settings and applies at once");

  section("starting again for a new stream");
  await load({ gapHours: 6 });
  sub({ amount: 1 }); cheer(500);
  ok(storeData.stream_goals_v1 && storeData.stream_goals_v1.counts.subs === 1, "the counts are saved");
  await reload(); ok(count("subs") === "1 / 50" && count("bits") === "500 / 5,000", "and a quick refresh keeps them (" + count("subs") + ")");
  storeData.stream_goals_v1.lastSeen = env.fake - 5 * HOUR;
  await env.reload(); ok(count("subs") === "1 / 50", "a widget last seen 5 hours ago is still the same stream");
  storeData.stream_goals_v1.lastSeen = env.fake - 7 * HOUR;
  await env.reload(); ok(count("subs") === "0 / 50" && count("bits") === "0 / 5,000", "one last seen 7 hours ago is a new stream, so everything starts again (" + count("subs") + ")");
  await load({ gapHours: 2 }); sub({ amount: 1 }); storeData.stream_goals_v1.lastSeen = env.fake - 3 * HOUR; await env.reload();
  ok(count("subs") === "0 / 50", "the number of quiet hours is a setting");
  await load({ gapHours: 6 }); sub({ amount: 1 }); await skip(40000); await wait(1100);
  ok(storeData.stream_goals_v1.lastSeen === env.fake, "while it is running it keeps noting that it is alive, so a long stream is never mistaken for a new one (" + (env.fake - storeData.stream_goals_v1.lastSeen) + ")");
  await skip(7 * HOUR); sub({ amount: 1 }); ok(count("subs") === "1 / 50", "an event after a long quiet gap starts a new stream first, then counts (" + count("subs") + ")");
  await load({ resetMode: "manual", gapHours: 6 }); sub({ amount: 1 }); storeData.stream_goals_v1.lastSeen = env.fake - 50 * HOUR; await env.reload(); await skip(10 * HOUR); sub({ amount: 1 });
  ok(count("subs") === "2 / 50", "in manual mode it never starts again by itself (" + count("subs") + ")");
  await load({ resetMode: "load" }); sub({ amount: 1 }); await env.reload(); ok(count("subs") === "0 / 50", "or it starts afresh every time the widget loads");

  section("chat commands and buttons");
  await load();
  sub({ amount: 1 }); cheer(100);
  boss("!goals reset"); ok(count("subs") === "0 / 50" && count("bits") === "0 / 5,000", "!goals reset starts every goal again");
  boss("!goals set subs 30"); ok(count("subs") === "30 / 50", "!goals set subs 30 (" + count("subs") + ")");
  boss("!goals add bits 1250"); boss("!goals add bits -250"); ok(count("bits") === "1,000 / 5,000", "!goals add bits 1250, and a negative takes some off (" + count("bits") + ")");
  boss("!goals set subs -5"); ok(count("subs") === "0 / 50", "never below zero");
  boss("!goals set subs x"); boss("!goals set nonsense 4"); boss("!goals set subs"); boss("!goals nonsense"); ok(count("subs") === "0 / 50", "unreadable commands change nothing");
  boss("!goals pause"); sub({ amount: 1 }); ok(count("subs") === "0 / 50" && E("sg-status").textContent === "paused", "while paused nothing counts and it says so");
  boss("!goals resume"); sub({ amount: 1 }); ok(count("subs") === "1 / 50" && E("sg-status").hidden, "and resuming counts again");
  chat("!goals reset", { nick: "Viewer" }); ok(count("subs") === "1 / 50", "a viewer cannot change anything");
  chat("!goals reset", { mod: true }); ok(count("subs") === "0 / 50", "a moderator can by default");
  await load({ whoCanManage: "broadcaster" }); sub({ amount: 1 }); chat("!goals reset", { mod: true }); ok(count("subs") === "1 / 50", "or only the broadcaster, when set");
  await load({ command: "!stream" }); sub({ amount: 1 }); boss("!goals reset"); boss("!stream reset"); ok(count("subs") === "0 / 50", "the command word is a setting");
  await load({ targetSubs: 10, raiseSubs: 5 }); boss("!goals set subs 12"); ok(count("subs") === "12 / 15", "setting a number past the goal lands on the right stage (" + count("subs") + ")");
  await load(); sub({ amount: 1 }); button("btnReset"); ok(count("subs") === "0 / 50", "the Start again button");
  button("btnPause"); sub({ amount: 1 }); ok(count("subs") === "0 / 50", "Pause");
  button("btnResume"); sub({ amount: 1 }); ok(count("subs") === "1 / 50", "Resume");

  section("look");
  await load({ textSize: 7, titleScale: 1.5, barHeight: 1, rowGap: 1, radius: 10, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  const v = env.vars("sg-app");
  ok(v["--sg-size"] === "7cqw" && v["--sg-title"] === 1.5 && v["--sg-bar"] === "1em" && v["--sg-gap"] === "1em", "the size and spacing settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("sg-root").classList.contains("no-motion"), "and Animate off stops motion");
  await load({ showTitle: false }); ok(E("sg-title").hidden, "the title can be hidden");
  await load({ title: "Tonight" }); ok(E("sg-title").textContent === "Tonight", "and renamed");
  await env.checkPresets("sg-app");

  section("sounds");
  await load({ targetSubs: 2, raiseSubs: 0, soundProgress: "data:audio/wav;base64,AA", soundProgressVol: 40, soundReached: "data:audio/wav;base64,BB" });
  audioLog.length = 0; sub({ amount: 1 }); ok(audioLog.length === 1 && /AA/.test(audioLog[0].src) && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "progress plays its sound at its volume");
  audioLog.length = 0; sub({ amount: 1 }); ok(audioLog.length === 1 && /BB/.test(audioLog[0].src), "reaching the goal plays its own");
  audioLog.length = 0; sub({ amount: 1 }); ok(audioLog.length === 1 && /AA/.test(audioLog[0].src), "and more after that is plain progress");
  audioLog.length = 0; button("test_soundReached"); ok(audioLog.length === 1, "the Test buttons play");
  await load({ soundProgress: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; sub({ amount: 1 }); ok(audioLog.length === 0, "mute silences everything");

  section("blanking the wording");
  await load({ labelSubs: "" }); ok(E("sg-label-subs").textContent === "", "a blank label stays blank");
  await load({ showTips: true, currency: "" }); tip(5); ok(count("tips") === "5 / 50", "a blank currency symbol means none (" + count("tips") + ")");
  await load({ targetSubs: 2, raiseSubs: 0, reachedText: "" }); sub({ amount: 1 }); sub({ amount: 1 }); ok(count("subs") === "2 / 2", "a blank reached text keeps showing the count (" + count("subs") + ")");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
