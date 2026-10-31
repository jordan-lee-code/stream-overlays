/* Headless test for the reminder overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData, audioLog } = env;
const skip = async ms => { env.fake += ms; await wait(400); };
const MIN = 60000, HOUR = 3600000;
const shown = () => !E("rm-root").hidden;
const L = o => load(Object.assign({ showPending: false }, o));       // most tests want a reminder to show only once it is due
const rows = () => E("rm-list").children.filter(li => li.className.indexOf("rm-row") === 0);
const items = () => rows().filter(li => li.className.indexOf("due") !== -1).map(li => li.children[0].textContent);
const timeOf = n => rows()[n].children[1].textContent;
const more = () => { const m = E("rm-list").children.find(li => li.className === "rm-more"); return m ? m.textContent : ""; };
const stored = () => (storeData.reminder_v1 ? storeData.reminder_v1.items : []);

(async () => {
  section("setting a reminder");
  await L();
  ok(!shown(), "nothing shows when there is no reminder");
  boss("!reminder 15m clean room");
  ok(!shown() && stored().length === 1 && stored()[0].text === "clean room" && stored()[0].due === env.fake + 15 * MIN, "!reminder 15m clean room is kept, and nothing shows yet (" + JSON.stringify(stored()) + ")");
  await skip(14 * MIN); ok(!shown(), "14 minutes later it still has not appeared");
  await skip(61000); ok(shown() && items().join() === "clean room" && !E("rm-title").hidden && E("rm-title").textContent === "Reminder", "at 15 minutes it appears with its words and a title (" + items().join() + ")");
  await skip(5 * HOUR); ok(shown() && items().join() === "clean room", "and it stays, however long it is left");
  await reload(); ok(shown() && items().join() === "clean room", "even through a refresh of the browser source");
  boss("!reminder clear"); ok(!shown() && stored().length === 0, "only !reminder clear takes it away");

  section("ways of writing the time");
  const due = async (cmd, ms) => { await L(); boss(cmd); return stored().length === 1 && stored()[0].due === env.fake + ms ? "" : cmd + " gave " + JSON.stringify(stored().map(i => i.due - env.fake)); };
  const cases = [["!reminder 90s a", 90000], ["!reminder 1h30m a", 90 * MIN], ["!reminder 1:30:00 a", 90 * MIN], ["!reminder 5:00 a", 5 * MIN], ["!reminder 2 a", 2 * MIN], ["!reminder 1.5h a", 90 * MIN], ["!reminder 1d a", 24 * HOUR], ["!reminder 45m a", 45 * MIN]];
  let bad = []; for (const [c, ms] of cases) { const r = await due(c, ms); if (r) bad.push(r); }
  ok(bad.length === 0, "90s, 1h30m, 1:30:00, 5:00, a bare number of minutes, 1.5h and 1d all read correctly" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await L();
  boss("!reminder soon do it"); boss("!reminder 0m x"); boss("!reminder -5m x"); boss("!reminder 3d x"); boss("!reminder 15m"); boss("!reminder");
  ok(stored().length === 1 && stored()[0].text === "Time's up", "unreadable times, zero, negative and over two days are ignored, and no words gives the default text (" + JSON.stringify(stored()) + ")");
  await L({ defaultText: "Look up" }); boss("!reminder 1m"); ok(stored()[0].text === "Look up", "the default text is a setting");
  await L(); boss("!reminder 1m   water   the   plants "); ok(stored()[0].text === "water   the   plants", "the words are kept as typed (" + JSON.stringify(stored()[0].text) + ")");

  section("several at once");
  await L();
  boss("!reminder 1m first"); boss("!reminder 2m second"); boss("!reminder 3m third"); boss("!reminder 4m fourth");
  await skip(3 * MIN + 1000);
  ok(items().join() === "first,second,third" && more() === "", "reminders stack in the order they came due (" + items().join() + ")");
  await skip(2 * MIN); ok(more() === "+1 more" && items().length === 3, "and the rest are counted (" + more() + ")");
  await L({ maxShown: 2 }); boss("!reminder 1m a"); boss("!reminder 1m b"); boss("!reminder 1m c"); await skip(61000);
  ok(items().length === 2 && more() === "+1 more", "the number shown at once is a setting (" + items().length + ", " + more() + ")");
  await L(); boss("!reminder 1m a"); boss("!reminder 1h b"); await skip(61000);
  boss("!reminder clear"); ok(!shown() && stored().length === 1 && stored()[0].text === "b", "clear takes away what is showing and keeps what is still waiting");
  boss("!reminder clear all"); ok(stored().length === 0, "clear all takes away everything");

  section("cancelling and snoozing");
  await L();
  boss("!reminder 1h tea"); boss("!reminder 2h call mum"); boss("!reminder 3h stretch");
  boss("!reminder cancel 2"); ok(stored().map(i => i.text).join() === "tea,stretch", "!reminder cancel 2 cancels the second waiting one (" + stored().map(i => i.text).join() + ")");
  boss("!reminder cancel STR"); ok(stored().map(i => i.text).join() === "tea", "or one matching some of its words, ignoring case");
  boss("!reminder cancel 9"); boss("!reminder cancel nothing"); boss("!reminder cancel"); ok(stored().length === 1, "unknown ones change nothing");
  await L(); boss("!reminder 1m stretch"); await skip(61000);
  boss("!reminder snooze 10m"); ok(!shown() && stored().length === 1 && stored()[0].shown === false, "!reminder snooze 10m hides it for a while");
  await skip(9 * MIN); ok(!shown(), "still hidden after 9 minutes");
  await skip(2 * MIN); ok(shown() && items().join() === "stretch", "and it comes back, still not dismissed (" + items().join() + ")");
  boss("!reminder snooze"); await skip(4 * MIN); ok(!shown(), "a bare snooze uses the default time (5 minutes)");
  await skip(2 * MIN); ok(shown(), "and the reminder returns");
  await L({ snoozeTime: "1m" }); boss("!reminder 1m x"); await skip(61000); boss("!reminder snooze"); await skip(61000); ok(shown(), "the default snooze time is a setting");
  boss("!reminder snooze nonsense"); boss("!reminder snooze 9d"); ok(shown(), "an unreadable or huge snooze is ignored");

  section("who may use it");
  await L();
  chat("!reminder 1m x", { nick: "Viewer" }); ok(stored().length === 0, "a viewer cannot set one");
  chat("!reminder 1m x", { mod: true }); ok(stored().length === 1, "a moderator can by default");
  chat("!reminder clear all", { nick: "Viewer" }); ok(stored().length === 1, "or clear");
  await L({ whoCanManage: "broadcaster" }); chat("!reminder 1m x", { mod: true }); ok(stored().length === 0, "or only the broadcaster, when set");
  await L({ command: "!remindme" }); boss("!reminder 1m x"); boss("!remindme 1m y"); ok(stored().length === 1 && stored()[0].text === "y", "the command word is a setting");
  boss("!remindmex 1m z"); ok(stored().length === 1, "and a longer word that merely starts the same is not the command");
  await L(); boss("!reminder 1m x"); await skip(61000); chat("!reminder", { nick: "Viewer" }); ok(items().join() === "x", "the bare command from anyone changes nothing");

  section("when the overlay was closed");
  await L(); boss("!reminder 5m while away"); env.fake += 20 * MIN;
  await reload(); ok(shown() && items().join() === "while away", "a reminder that came due while it was closed shows as soon as it loads (" + items().join() + ")");
  await L(); boss("!reminder 30m later"); env.fake += 10 * MIN; await reload(); ok(!shown() && stored().length === 1, "and one still in the future keeps waiting");

  section("the countdown, and due");
  await load();
  ok(!shown(), "nothing shows with nothing set");
  boss("!reminder 15m clean room");
  ok(shown() && rows().length === 1 && rows()[0].children[0].textContent === "clean room" && timeOf(0) === "15:00" && rows()[0].className.indexOf("waiting") !== -1, "a reminder shows as soon as it is set, with its words and a countdown (" + timeOf(0) + ")");
  ok(rows()[0].children.length === 2 && rows()[0].children[1].className === "rm-time", "the timer is a cell of its own, which the stylesheet right-aligns");
  ok(E("rm-title").hidden, "and the REMINDER title waits until it is due");
  await skip(61000); ok(timeOf(0) === "13:59", "the countdown ticks down (" + timeOf(0) + ")");
  await skip(14 * MIN); ok(timeOf(0) === "due" && rows()[0].className.indexOf("due") !== -1 && !E("rm-title").hidden && E("rm-app").classList.contains("alert"), "when it runs out the timer says due, the title appears and the border pulses (" + timeOf(0) + ")");
  await skip(5 * HOUR); ok(timeOf(0) === "due", "and it says due however long it is left");
  await reload(); ok(timeOf(0) === "due", "even after a refresh");
  boss("!reminder clear"); ok(!shown(), "!reminder clear takes it away");
  await load({ dueText: "NOW" }); boss("!reminder 1m x"); await skip(61000); ok(timeOf(0) === "NOW", "the word is a setting");
  await load({ dueText: "" }); boss("!reminder 1m x"); await skip(61000); ok(timeOf(0) === "" && items().join() === "x", "and a blank one stays blank, though the reminder still shows");
  await load(); boss("!reminder 1m a"); boss("!reminder 1h b"); await skip(61000);
  ok(rows().length === 2 && timeOf(0) === "due" && timeOf(1) === "58:59" && rows()[0].children[0].textContent === "a", "one that is due sits above the ones still counting down (" + rows().map(r => r.children.map(c => c.textContent).join("=")).join(";") + ")");
  boss("!reminder clear"); ok(rows().length === 1 && timeOf(0) === "58:59", "clear takes away only what is due, and the rest keep counting");
  await load(); boss("!reminder 1m a"); boss("!reminder 20m b"); boss("!reminder 30m c"); boss("!reminder 40m d"); boss("!reminder 50m e");
  ok(rows().length === 3 && rows()[0].children[0].textContent === "a", "only three waiting ones show by default, the soonest first (" + rows().length + ")");
  await load({ pendingRows: 1 }); boss("!reminder 20m b"); boss("!reminder 30m c"); ok(rows().length === 1 && rows()[0].children[0].textContent === "b", "the soonest show first, and how many is a setting");
  await L(); boss("!reminder 15m clean room"); ok(!shown(), "with the countdown turned off a reminder shows only once it is due");
  await skip(15 * MIN + 1000); ok(shown() && timeOf(0) === "due", "and then says due");
  await load(); boss("!reminder 1m x"); await skip(61000); boss("!reminder snooze 10m"); ok(rows().length === 1 && timeOf(0) === "10:00" && rows()[0].className.indexOf("waiting") !== -1, "snoozing sends it back to a countdown (" + timeOf(0) + ")");
  await skip(10 * MIN + 1000); ok(timeOf(0) === "due", "which runs out to due again");

  section("limits");
  await L({ maxPending: 2 }); boss("!reminder 1h a"); boss("!reminder 1h b"); boss("!reminder 1h c"); ok(stored().length === 2, "only as many can wait as the limit allows (" + stored().length + ")");

  section("buttons");
  await L();
  button("btnTest"); ok(shown() && items().join() === "Test reminder", "Show a test reminder now");
  button("btnClear"); ok(!shown(), "Clear the reminders that are showing");
  boss("!reminder 1m a"); await skip(61000); boss("!reminder 1h b"); button("btnSnooze"); ok(!shown(), "Snooze the reminders that are showing");
  button("btnClearAll"); ok(stored().length === 0, "Clear everything");

  section("attention");
  await L(); boss("!reminder 1m a"); await skip(61000);
  ok(E("rm-app").classList.contains("alert"), "the border pulses while a reminder is showing");
  await L({ pulse: false }); boss("!reminder 1m a"); await skip(61000); ok(!E("rm-app").classList.contains("alert"), "unless that is turned off");
  await L({ soundRemind: "data:audio/wav;base64,AA", soundRemindVol: 40, repeatSeconds: 5 });
  boss("!reminder 1m a"); audioLog.length = 0; await skip(61000);
  ok(audioLog.length === 1 && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "a reminder plays its sound once when it arrives");
  await skip(6000); ok(audioLog.length === 2, "and again every few seconds when asked, until it is cleared (" + audioLog.length + ")");
  boss("!reminder clear"); audioLog.length = 0; await skip(30000); ok(audioLog.length === 0, "then it stops");
  await L({ soundRemind: "data:audio/wav;base64,AA" }); boss("!reminder 1m a"); audioLog.length = 0; await skip(61000); await skip(60000);
  ok(audioLog.length === 1, "with no repeat it plays just once");
  audioLog.length = 0; button("test_soundRemind"); ok(audioLog.length === 1, "the Test button plays");
  await L({ soundRemind: "data:audio/wav;base64,AA", mute: true }); boss("!reminder 1m a"); audioLog.length = 0; await skip(61000); ok(audioLog.length === 0, "mute silences everything");

  section("look");
  await L({ textSize: 9, titleScale: 0.8, pendingScale: 0.7, itemGap: 0.6, radius: 10, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  const v = env.vars("rm-app");
  ok(v["--rm-size"] === "9cqw" && v["--rm-title"] === 0.8 && v["--rm-wait"] === 0.7 && v["--rm-gap"] === "0.6em", "the size and spacing settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("rm-root").classList.contains("no-motion"), "and Animate off stops motion");
  await L({ title: "" }); boss("!reminder 1m a"); await skip(61000); ok(E("rm-title").hidden, "a blank title hides the title");
  await L({ showTitle: false }); boss("!reminder 1m a"); await skip(61000); ok(E("rm-title").hidden, "so does turning it off");
  await L({ title: "Heads up" }); boss("!reminder 1m a"); await skip(61000); ok(E("rm-title").textContent === "Heads up", "and it can be renamed");
  await env.checkPresets("rm-app");

  section("disappearing when there is nothing to show");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/#rm-root\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(css), "the stylesheet hides the whole widget when it is marked hidden, since the root's own display would otherwise beat the browser's hiding and leave an empty card on screen");
  await L({}); ok(!shown(), "with no reminder set nothing is shown");
  boss("!reminder 15m clean room"); await skip(1000); ok(!shown(), "a reminder that is waiting shows nothing while pending reminders are not shown");
  await skip(15 * MIN); ok(shown(), "it appears when the reminder is due");
  boss("!reminder clear"); await skip(1000); ok(!shown(), "and goes again once it is cleared");
  await load({ showPending: true }); boss("!reminder 15m clean room"); await skip(1000); ok(shown(), "with pending reminders shown the card is there while one is waiting");
  boss("!reminder cancel 1"); await skip(1000); ok(!shown(), "and goes when the last is cancelled");
  await L({}); boss("!reminder 1m a"); await skip(2 * MIN); ok(shown(), "(a due reminder shows)"); boss("!reminder snooze"); await skip(1000); ok(!shown(), "a snoozed reminder takes the card away until it is back");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
