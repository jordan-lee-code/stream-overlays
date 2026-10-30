/* Headless test for the counter. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, and drives it through the same events StreamElements sends. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, settled, wait, E, storeData, audioLog } = env;
const value = () => E("ct-value").textContent;
const note = () => E("ct-note").hidden ? "" : E("ct-note").textContent;
const flash = () => E("ct-flash").hidden ? "" : E("ct-flash").textContent;

(async () => {
  section("the number");
  await load();
  ok(value() === "0" && E("ct-title").textContent === "Deaths", "starts at zero with its title (" + value() + ")");
  boss("!count +1"); ok(value() === "1", "!count +1 adds one");
  boss("!count +5"); ok(value() === "6", "!count +5 adds five");
  boss("!count 4"); ok(value() === "10", "a bare number adds too");
  boss("!count -3"); ok(value() === "7", "!count -3 takes three off");
  boss("!count set 42"); ok(value() === "42", "!count set 42");
  boss("!count =9"); ok(value() === "9", "!count =9");
  boss("!count +"); ok(value() === "10", "a bare + adds one step");
  boss("!count -"); ok(value() === "9", "a bare - takes one step off");
  boss("!count nonsense"); boss("!count +x"); boss("!count set"); boss("!count 1.5.2");
  ok(value() === "9", "unreadable commands change nothing");
  boss("!count -500"); ok(value() === "0", "it stops at zero by default, never negative (" + value() + ")");
  boss("!count reset"); ok(value() === "0", "!count reset goes to the starting value");

  section("undo");
  await load();
  boss("!count +3"); boss("!count +4"); boss("!count undo");
  ok(value() === "3", "!count undo reverses the last change (" + value() + ")");
  boss("!count undo"); boss("!count undo"); ok(value() === "0", "and the ones before it, stopping at the start");
  boss("!count +2"); boss("!count reset"); boss("!count undo");
  ok(value() === "0", "reset clears the history, so undo cannot bring it back");

  section("who may change it");
  await load();
  chat("!count +1", { nick: "Viewer" }); ok(value() === "0", "a viewer cannot change it");
  chat("!count +1", { mod: true }); ok(value() === "1", "a moderator can by default");
  await load({ whoCanManage: "broadcaster" });
  chat("!count +1", { mod: true }); ok(value() === "0", "or only the broadcaster, when set");
  boss("!count +1"); ok(value() === "1", "the broadcaster always can");
  await load({ command: "!deaths" });
  boss("!deaths +2"); boss("!count +2"); ok(value() === "2", "the command word is a setting");
  boss("!deathsx +2"); ok(value() === "2", "and a longer word that merely starts the same is not the command");

  section("limits");
  await load({ allowNegative: true });
  boss("!count -3"); ok(value() === "-3", "it can go negative when allowed (" + value() + ")");
  await load({ maxCount: 10 });
  boss("!count +50"); ok(value() === "10", "it stops at the highest value (" + value() + ")");
  await load({ startCount: 5 });
  ok(value() === "5", "it starts on the starting value");
  boss("!count +3"); boss("!count reset"); ok(value() === "5", "and resets to it");
  await load({ startCount: 3, step: 5 });
  boss("!count +"); ok(value() === "8", "the step is a setting");

  section("lock");
  await load();
  boss("!count +2"); boss("!count lock"); boss("!count +5"); boss("!count reset"); boss("!count undo");
  ok(value() === "2" && note() === "locked", "while locked nothing changes and it says so (" + note() + ")");
  button("btnPlus"); button("btnReset"); ok(value() === "2", "and the buttons are held too");
  boss("!count unlock"); boss("!count +1"); ok(value() === "3" && note() === "", "unlocking lets it change again");
  await load({ lockedText: "frozen" }); boss("!count lock"); ok(note() === "frozen", "the locked text is a setting");

  section("buttons");
  await load({ step: 2 });
  button("btnPlus"); button("btnPlus"); ok(value() === "4", "Add one step");
  button("btnMinus"); ok(value() === "2", "Subtract one step");
  button("btnUndo"); ok(value() === "4", "Undo the last change");
  button("btnReset"); ok(value() === "0", "Reset");
  button("btnLock"); button("btnPlus"); ok(value() === "0" && note() === "locked", "Lock");
  button("btnUnlock"); button("btnPlus"); ok(value() === "2", "Unlock");

  section("goal, milestones and the chip");
  await load({ goal: 10 });
  boss("!count +4");
  ok(E("ct-goal").textContent === "of 10" && !E("ct-goal").hidden && E("ct-fill").style.width === "40%", "a goal shows under the number with a bar at 40% (" + E("ct-fill").style.width + ")");
  boss("!count +20"); ok(E("ct-fill").style.width === "100%" && E("ct-app").classList.contains("reached"), "the bar stops at 100% and marks the goal reached");
  ok(note() === "Goal reached!", "and says so (" + note() + ")");
  await load({ goal: 10, showGoal: false, showBar: false });
  ok(E("ct-goal").hidden && E("ct-bar").hidden, "the goal line and the bar can each be hidden");
  await load();
  ok(E("ct-goal").hidden && E("ct-bar").hidden, "no goal, no goal line or bar");
  await load({ milestoneEvery: 10, milestoneText: "Ten more!" });
  boss("!count +9"); ok(note() === "", "no milestone before the tenth");
  boss("!count +1"); ok(note() === "Ten more!", "a milestone every ten (" + note() + ")");
  boss("!count -1"); boss("!count +1"); ok(true, "(dipping back below and up again re-triggers it, which is intended)");
  await load({ milestoneEvery: 10, milestoneSeconds: 1 });
  boss("!count +10"); await wait(1100); ok(note() === "", "the milestone text goes away after its time");
  await load();
  boss("!count +3"); ok(flash() === "+3", "the chip shows the change (" + flash() + ")");
  boss("!count -2"); ok(flash() === "-2", "negative too");
  boss("!count undo"); ok(flash() === "", "undo shows no chip");
  await load({ flash: false }); boss("!count +3"); ok(flash() === "", "the chip can be turned off");

  section("look");
  await load({ prefix: "x", suffix: " deaths", digits: 3 }); boss("!count +7");
  ok(value() === "x007 deaths", "text before and after, and padding with zeros (" + value() + ")");
  await load({ layout: "inline" }); ok(E("ct-app").classList.contains("inline"), "the inline layout");
  await load({ showTitle: false }); ok(E("ct-title").hidden, "the title can be hidden");
  await load({ title: "Wins" }); ok(E("ct-title").textContent === "Wins", "and renamed");
  await load({ numberSize: 30, titleScale: 0.4, goalScale: 0.3, radius: 10, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  const v = env.vars("ct-app");
  ok(v["--ct-size"] === "30cqw" && v["--ct-title"] === 0.4 && v["--ct-goal"] === 0.3, "the size settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("ct-root").classList.contains("no-motion"), "and Animate off stops motion");
  await env.checkPresets("ct-app");

  section("saving");
  await load();
  boss("!count +7"); boss("!count lock");
  ok(storeData.counter_v1 && storeData.counter_v1.count === 7 && storeData.counter_v1.locked === true, "the count and the lock are saved");
  await reload(); ok(value() === "7" && note() === "locked", "and survive a refresh");
  boss("!count unlock"); boss("!count undo"); ok(value() === "0", "even the undo history does");

  section("sounds");
  await load({ soundUp: "data:audio/wav;base64,AA", soundUpVol: 40, soundDown: "data:audio/wav;base64,BB", soundMilestone: "data:audio/wav;base64,CC", soundGoal: "data:audio/wav;base64,DD", milestoneEvery: 5, goal: 7 });
  audioLog.length = 0; boss("!count +1");
  ok(audioLog.length === 1 && Math.abs(audioLog[0].volume - 0.4) < 1e-9 && /AA/.test(audioLog[0].src), "going up plays its sound at its volume");
  audioLog.length = 0; boss("!count -1"); ok(audioLog.length === 1 && /BB/.test(audioLog[0].src), "going down plays its own");
  audioLog.length = 0; boss("!count +5"); ok(audioLog.some(a => /CC/.test(a.src)), "a milestone plays its sound");
  audioLog.length = 0; boss("!count +5"); ok(audioLog.some(a => /DD/.test(a.src)), "reaching the goal plays its sound");
  audioLog.length = 0; button("test_soundGoal"); ok(audioLog.length === 1, "the Test buttons play");
  await load({ soundUp: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; boss("!count +1");
  ok(audioLog.length === 0, "mute silences everything");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
