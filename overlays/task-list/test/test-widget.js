/* Headless test for the task list and schedule overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData } = env;
const shown = () => !E("tl-root").hidden;
const rows = () => E("tl-list").children.filter(li => li.className.indexOf("tl-row") === 0);
const texts = () => rows().map(li => li.children.filter(c => c.className === "tl-text")[0].textContent);
const doneFlags = () => rows().map(li => li.className.indexOf("done") !== -1 ? "x" : "o").join("");
const more = () => { const m = E("tl-list").children.find(li => li.className === "tl-more"); return m ? m.textContent : ""; };
const stored = () => (storeData.task_list_v1 ? storeData.task_list_v1.tasks : []);
const names = () => stored().map(t => t.text + (t.done ? "*" : "")).join(",");
const slots = () => E("tl-list").children.filter(li => li.className.indexOf("tl-slot") === 0);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NONE = { slot1: "", slot2: "", slot3: "", slot4: "" };
const sched = o => load(Object.assign({ mode: "schedule" }, NONE, o));
const SLOTS = { mode: "schedule", slot1: "Monday | 7pm | Chill games", slot2: "Wednesday | 7pm | Art stream", slot3: "Friday | 8pm | Variety | with friends", slot4: "Sunday | | Rest day", slot5: "Just a line", slot6: "", slot7: "   |  | " };

(async () => {
  section("adding tasks");
  await load();
  ok(!shown(), "nothing shows with an empty list");
  boss("!task add say hello"); boss("!task add play the new game"); boss("!task add   stretch  ");
  ok(shown() && texts().join() === "say hello,play the new game,stretch" && doneFlags() === "ooo", "!task add puts a task on the list, in order (" + texts().join() + ")");
  ok(rows()[0].children[0].textContent === "1." && rows()[0].children[1].className === "tl-box", "each has its number and a box to tick");
  boss("!task add"); boss("!task add    "); ok(stored().length === 3, "an empty task is ignored");
  ok(E("tl-title").textContent === "Today's tasks" && E("tl-count").textContent === "0 / 3" && E("tl-fill").style.width === "0%", "under a title, with how many are done and a bar");
  await reload(); ok(texts().length === 3, "the list survives a refresh");

  section("ticking off");
  boss("!task done 2"); ok(doneFlags() === "oxo" && E("tl-count").textContent === "1 / 3" && E("tl-fill").style.width === "33.3%", "!task done 2 ticks the second (" + doneFlags() + ")");
  boss("!task done stretch"); ok(doneFlags() === "oxx", "or one with those words in it, ignoring capitals");
  boss("!task done STR"); ok(doneFlags() === "oxx", "and one already done stays done");
  boss("!task undo 2"); ok(doneFlags() === "oox", "!task undo 2 unticks it");
  boss("!task done 9"); boss("!task done nothing"); boss("!task done"); ok(doneFlags() === "oox", "a task that is not there changes nothing");
  boss("!task add stretch again"); boss("!task done stretch"); ok(names() === "say hello,play the new game,stretch*,stretch again*", "a words match prefers a task that is not done yet (" + names() + ")");
  boss("!task tick 1"); boss("!task untick 1"); ok(doneFlags().charAt(0) === "o", "tick and untick work as well");
  boss("!task remove 4"); boss("!task rm 3"); ok(names() === "say hello,play the new game", "!task remove takes one away by number (" + names() + ")");
  boss("!task remove play"); ok(names() === "say hello", "or by words");
  boss("!task edit 1 say hello properly"); ok(names() === "say hello properly" && texts()[0] === "say hello properly", "!task edit 1 changes the words");
  boss("!task edit 9 x"); boss("!task edit 1"); boss("!task edit x y"); ok(names() === "say hello properly", "and a bad edit changes nothing");

  section("finishing");
  await load(); boss("!task add a"); boss("!task add b"); boss("!task done 1"); boss("!task done 2");
  ok(E("tl-title").textContent === "All done, well done!" && E("tl-count").textContent === "2 / 2" && E("tl-fill").style.width === "100%", "when every task is ticked the title cheers (" + E("tl-title").textContent + ")");
  boss("!task add c"); ok(E("tl-title").textContent === "Today's tasks", "and goes back to the title when there is more to do");
  boss("!task done 3"); boss("!task clear"); ok(stored().length === 0 && !shown(), "!task clear takes away the ticked ones, and an empty list hides the widget");
  await load(); boss("!task add a"); boss("!task add b"); boss("!task done 1"); boss("!task clear"); ok(names() === "b", "!task clear keeps the ones still to do");
  boss("!task done 1"); boss("!task add c"); boss("!task clear all"); ok(stored().length === 0, "!task clear all takes away everything");
  await load({ allDoneText: "" }); boss("!task add a"); boss("!task done 1"); ok(E("tl-title").textContent === "Today's tasks", "a blank cheer keeps the title");
  await load({ hideWhenEmpty: false }); ok(shown(), "the widget can stay when the list is empty");

  section("the list");
  await load({ maxShown: 3 }); for (const t of ["a", "b", "c", "d", "e"]) boss("!task add " + t);
  ok(rows().length === 3 && more() === "+2 more", "only as many as fit are shown, and the rest are counted (" + more() + ")");
  await load({ maxTasks: 2 }); boss("!task add a"); boss("!task add b"); boss("!task add c"); ok(stored().length === 2, "the length of the list is limited");
  await load({ hideDone: true }); boss("!task add a"); boss("!task add b"); boss("!task done 1"); ok(texts().join() === "b" && rows()[0].children[0].textContent === "2.", "a ticked task can be hidden, and the numbers stay the same (" + texts().join() + ")");
  await load({ showNumbers: false }); boss("!task add a"); ok(rows()[0].children[0].className === "tl-box", "numbers can be left off");
  await load({ showCount: false, showBar: false }); boss("!task add a"); ok(E("tl-count").hidden && E("tl-bar").hidden, "so can the count and the bar");

  section("who may use it");
  await load();
  chat("!task add a", { nick: "Viewer" }); ok(stored().length === 0, "a viewer cannot add");
  chat("!task add a", { mod: true }); ok(stored().length === 1, "a moderator can by default");
  chat("!task done 1", { nick: "Viewer" }); chat("!task clear all", { nick: "Viewer" }); ok(names() === "a", "a viewer cannot tick or clear either");
  await load({ whoCanManage: "broadcaster" }); chat("!task add a", { mod: true }); ok(stored().length === 0, "or only the broadcaster, when set");
  await load({ command: "!todo" }); boss("!task add x"); boss("!todo add y"); ok(names() === "y", "the command word is a setting");
  boss("!todox add z"); ok(names() === "y", "and a longer word that merely starts the same is not the command");
  await load(); boss("!task add a"); chat("!task", { nick: "Viewer" }); ok(E("tl-title").classList.contains("pop") && names() === "a", "the bare command from anyone only makes the title pop");
  boss("!task done 1"); ok(E("tl-title").classList.contains("pop"), "and so does ticking one off");

  section("buttons");
  await load();
  button("btnAdd"); ok(names() === "A test task", "Add a test task");
  button("btnAdd"); button("btnNext"); ok(names() === "A test task*,A test task", "Tick off the next task");
  button("btnClearDone"); ok(names() === "A test task", "Clear the ticked tasks");
  button("btnClearAll"); ok(stored().length === 0, "Clear every task");

  section("the schedule");
  await sched(SLOTS);
  ok(shown() && slots().length === 5, "each slot with something in it is a row, and blank ones are left out (" + slots().length + ")");
  ok(E("tl-title").textContent === "This week" && E("tl-count").hidden && E("tl-bar").hidden, "under its own title, with no count or bar");
  const cells = s => s.children.map(c => c.className + "=" + c.textContent).join(";");
  ok(cells(slots()[0]) === "tl-day=Monday;tl-when=7pm;tl-what=Chill games", "a slot is a day, a time and what is on (" + cells(slots()[0]) + ")");
  ok(slots()[2].children[2].textContent === "Variety | with friends", "more bars stay in the words");
  ok(cells(slots()[3]) === "tl-day=Sunday;tl-what=Rest day", "a slot with no time has none");
  ok(cells(slots()[4]) === "tl-what=Just a line", "and one with only words is just a line");
  const dayNow = DAYS[new Date(env.fake).getDay()];
  await sched({ slot1: "Someday | 1pm | Elsewhere", slot2: dayNow.slice(0, 3) + " | 7pm | Today's one", slot3: dayNow + " | 9pm | And later" });
  ok(slots().map(s => s.className.indexOf("today") !== -1 ? "T" : "-").join("") === "-TT", "today's slots are marked, by the first three letters of the day (" + slots().map(s => s.className).join(";") + ")");
  await sched({ slot1: dayNow + " | 7pm | x", highlightToday: false }); ok(slots()[0].className.indexOf("today") === -1, "which can be switched off");
  await sched({ slot1: dayNow + " | 7pm | x" }); env.fake += 24 * 3600000; await wait(61000); ok(slots()[0].className.indexOf("today") === -1, "and it moves on when the day does");
  await sched({ slot1: "Monday | 7pm | x", note: "All times GMT" }); ok(!E("tl-note").hidden && E("tl-note").textContent === "All times GMT", "a note can go under it");
  await sched({ slot1: "Monday | 7pm | x", scheduleTitle: "Streaming times" }); ok(E("tl-title").textContent === "Streaming times", "the title is a setting");
  await sched({}); ok(!shown(), "a schedule with no slots hides the widget");
  await sched({ slot1: "Monday | 7pm | x" }); boss("!task add a"); ok(stored().length === 0 && slots().length === 1, "the task commands do nothing in schedule mode");
  chat("!task", { nick: "Viewer" }); ok(E("tl-title").classList.contains("pop"), "though the bare one still pops the title");
  await load({ mode: "nonsense" }); boss("!task add a"); ok(stored().length === 1, "an unknown mode is the task list");

  section("saved");
  await load(); boss("!task add a"); boss("!task add b"); boss("!task done 1");
  await reload(); ok(names() === "a*,b" && doneFlags() === "xo", "ticks survive a refresh");
  storeData.task_list_v1 = { tasks: [{ id: 3, text: "ok", done: true }, null, { id: "x", text: "" }, "no", { text: "fine" }], seq: "bad" }; await reload();
  ok(texts().join() === "ok,fine" && doneFlags() === "xo", "a damaged save keeps what is good (" + texts().join() + ")");
  boss("!task add next"); ok(stored().length === 3 && new Set(stored().map(t => t.id)).size === 3, "and new tasks get their own ids");
  storeData.task_list_v1 = 7; await reload(); ok(!shown(), "a save that is not a list is ignored");

  section("look");
  await load({ textSize: 7, titleScale: 0.9, itemGap: 0.7, radius: 10, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, pad: 1, animate: false });
  boss("!task add a");
  const v = env.vars("tl-app");
  ok(v["--tl-size"] === "7cqw" && v["--tl-title"] === 0.9 && v["--tl-gap"] === "0.7em", "the size and spacing settings apply");
  ok(v["--w-radius"] === "10px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-pad"] === 1 && v["--w-shadow"] !== "none", "the corner, outline, weight, padding and shadow settings apply");
  ok(E("tl-root").classList.contains("no-motion") && v["--tl-tick"] === "rgb(0, 0, 0)", "Animate off stops motion, and the tick takes the panel's colour (" + v["--tl-tick"] + ")");
  await load({ title: "" }); boss("!task add a"); ok(E("tl-title").hidden, "a blank title hides it");
  await load({ showTitle: false }); boss("!task add a"); ok(E("tl-title").hidden, "so does turning it off");
  await load({ title: "To do" }); boss("!task add a"); ok(E("tl-title").textContent === "To do", "and it can be renamed");
  await env.checkPresets("tl-app");
  await env.checkFrame("tl-app");
  await env.checkDecor("tl-app");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
