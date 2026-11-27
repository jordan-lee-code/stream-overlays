/* Headless test for the be right back overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData } = env;
const skip = async ms => { env.fake += ms; await wait(400); };
const SEC = 1000, MIN = 60000, HOUR = 3600000;
const clock = () => E("br-clock").textContent;
const shown = id => !E(id).hidden;
const title = () => E("br-title").textContent;
const label = () => E("br-label").textContent;
const stored = () => storeData.be_right_back_v1 || {};
const left = () => stored().until - env.fake;
const cls = c => E("br-app").classList.contains(c);

(async () => {
  section("before anything is set");
  await load();
  ok(cls("idle") && !shown("br-app"), "the overlay is hidden with no break set");
  ok(!shown("br-clock") && !shown("br-bar") && !shown("br-at") && !shown("br-label"), "and there is no clock, bar, time or label yet");
  ok(shown("br-msg") && E("br-msg").textContent === "Grab a drink and stretch your legs", "the first rotating line is ready for when a break starts (" + E("br-msg").textContent + ")");

  section("a break with no set time");
  boss("!brb");
  ok(cls("away") && stored().since === env.fake && !stored().until, "!brb starts a break with no end");
  ok(shown("br-clock") && clock() === "00:00" && label() === "Away for" && !shown("br-bar") && !shown("br-at"), "the clock counts up, with Away for above it, and no bar or time (" + clock() + ", " + label() + ")");
  await skip(61 * SEC); ok(clock() === "01:01", "it counts the time away (" + clock() + ")");
  await skip(HOUR); ok(clock() === "1:01:01", "into hours (" + clock() + ")");
  await reload(); ok(cls("away") && clock() === "1:01:01", "and carries on through a refresh (" + clock() + ")");
  boss("!brb back"); ok(cls("idle") && !stored().since && !shown("br-app"), "!brb back ends it, and the overlay vanishes");
  await load({ startMinutes: 0 }); boss("!brb start"); ok(cls("away"), "!brb start does the same");

  section("a break with a time");
  await load(); boss("!brb 5m");
  ok(cls("count") && left() === 5 * MIN && stored().since === env.fake, "!brb 5m says you will be back in five minutes");
  ok(shown("br-clock") && clock() === "05:00" && label() === "Back in" && shown("br-bar") && shown("br-at"), "the clock counts down, with Back in above it, and the bar and time appear (" + clock() + ")");
  await skip(61 * SEC); ok(clock() === "03:59", "it counts down (" + clock() + ")");
  await skip(3 * MIN); ok(clock() === "00:59", "to the last minute (" + clock() + ")");
  ok(/^(79|80)(\.\d)?%$/.test(E("br-fill").style.width), "and the bar is nearly full (" + E("br-fill").style.width + ")");
  await skip(59 * SEC + 500);
  ok(cls("late") && title() === "Back any moment now" && !shown("br-clock") && !shown("br-bar") && !shown("br-at") && !shown("br-label"), "at zero the headline changes and the clock goes, since you are not back yet (" + title() + ")");
  await skip(3 * HOUR); ok(cls("late"), "and it stays that way until you are back");
  await reload(); ok(cls("late"), "even after a refresh");
  boss("!brb back"); ok(cls("idle") && !stored().since && !shown("br-app"), "!brb back hides it after running late too");
  boss("!brb 5m"); ok(shown("br-app"), "and the next break brings it back"); boss("!brb back"); await reload(); ok(!shown("br-app"), "it stays hidden after a refresh");
  await load({ lateTitle: "" }); boss("!brb 1m"); await skip(61 * SEC); ok(E("br-title").hidden, "a blank late headline leaves none");
  await load({ lateTitle: "Nearly!" }); boss("!brb 1m"); await skip(61 * SEC); ok(title() === "Nearly!", "and it is a setting");

  section("ways of writing the time");
  const lens = async (cmd, ms) => { await load(); boss(cmd); return left() === ms ? "" : cmd + " gave " + left(); };
  const cases = [["!brb 90s", 90 * SEC], ["!brb 1h30m", 90 * MIN], ["!brb 1:30:00", 90 * MIN], ["!brb 5:00", 5 * MIN], ["!brb 20", 20 * MIN], ["!brb 1.5h", 90 * MIN], ["!brb start 7m", 7 * MIN]];
  let bad = []; for (const [c, ms] of cases) { const r = await lens(c, ms); if (r) bad.push(r); }
  ok(bad.length === 0, "90s, 1h30m, 1:30:00, 5:00, a bare number of minutes, 1.5h and start 7m all read correctly" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await load({ startMinutes: 10 }); boss("!brb"); ok(left() === 10 * MIN && cls("count"), "the default length is a setting, and 0 means no set time");
  await load(); boss("!brb soon"); boss("!brb -5m"); boss("!brb 3d"); boss("!brb 99:99:99"); boss("!brb 0m");
  ok(!stored().since, "words, negative, zero and over two days are ignored");

  section("a time of day");
  const at = async (words, h, m) => {
    await load(); boss("!brb at " + words);
    const d = new Date(stored().until);
    return d.getHours() === h && d.getMinutes() === m && d.getSeconds() === 0 && left() > 0 && left() <= 24 * HOUR ? "" : words + " gave " + d.toString();
  };
  bad = []; for (const [w, h, m] of [["20:30", 20, 30], ["8pm", 20, 0], ["8:30 pm", 20, 30], ["12am", 0, 0], ["7:05", 7, 5]]) { const r = await at(w, h, m); if (r) bad.push(r); }
  ok(bad.length === 0, "at 20:30, 8pm, 8:30 pm, 12am and 7:05 all land on that minute within the next day" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await load(); boss("!brb at 25:00"); boss("!brb at 13pm"); boss("!brb at 8"); boss("!brb at"); boss("!brb at soon");
  ok(!stored().since, "a bare number, an impossible time and words are ignored");
  await load({ clock24: true }); boss("!brb at 8:05pm"); ok(E("br-at").textContent === "Back at 20:05", "the time you will be back is shown (" + E("br-at").textContent + ")");
  await load({ clock24: false }); boss("!brb at 8:05pm"); ok(E("br-at").textContent === "Back at 8:05 pm", "on a 12-hour clock if asked (" + E("br-at").textContent + ")");
  await load({ returnPrefix: "" }); boss("!brb at 21:00"); ok(E("br-at").textContent === "21:00", "and the words before it can be blank");
  await load({ showReturn: false }); boss("!brb 5m"); ok(!shown("br-at"), "or the time can be hidden");
  await load({ countLabel: "Returning in", awayLabel: "Gone for" }); boss("!brb 5m"); ok(label() === "Returning in", "the words above the clock are settings (" + label() + ")");
  boss("!brb back"); boss("!brb"); ok(label() === "Gone for", "both of them (" + label() + ")");
  await load({ countLabel: "" }); boss("!brb 5m"); ok(!shown("br-label"), "and can be blank");

  section("changing it");
  await load(); boss("!brb 10m"); await skip(2 * MIN);
  boss("!brb add 5m"); ok(left() === 13 * MIN, "!brb add 5m pushes the time back (" + left() / MIN + ")");
  boss("!brb less 3m"); ok(left() === 10 * MIN, "!brb less 3m brings it forward");
  boss("!brb less 1h"); ok(cls("late"), "taking off more than is left makes it late at once");
  boss("!brb add 7m"); ok(cls("count") && left() === 7 * MIN, "adding when you are late gives a fresh time from now (" + left() / MIN + ")");
  await load(); boss("!brb add 5m"); ok(cls("count") && left() === 5 * MIN, "adding with nothing on starts a break");
  await load(); boss("!brb"); await skip(3 * MIN); boss("!brb add 10m"); ok(cls("count") && left() === 10 * MIN && stored().since === env.fake - 3 * MIN, "adding to a break with no set time gives it one, and keeps when it began");
  await load(); boss("!brb less 5m"); ok(!stored().since, "taking time off with nothing on does nothing");
  await load(); boss("!brb"); boss("!brb less 5m"); ok(cls("away"), "and so does taking time off one with no set time");
  await load(); boss("!brb 10m"); boss("!brb add 3d"); boss("!brb add soon"); ok(left() === 10 * MIN, "an unreadable or huge change is ignored");
  await load(); boss("!brb 10m"); boss("!brb 20m"); ok(left() === 20 * MIN, "a new time replaces the running one");
  await load(); boss("!brb 10m"); boss("!brb stop"); ok(cls("idle"), "stop, clear and done work like back");
  boss("!brb 10m"); boss("!brb clear"); ok(cls("idle"), "(clear)"); boss("!brb 10m"); boss("!brb done"); ok(cls("idle"), "(done)");

  section("the bar");
  await load(); boss("!brb 10m");
  ok(E("br-fill").style.width === "0%", "starts empty (" + E("br-fill").style.width + ")");
  await skip(5 * MIN); ok(E("br-fill").style.width === "50%", "is half full half way (" + E("br-fill").style.width + ")");
  boss("!brb add 10m"); ok(E("br-fill").style.width === "25%", "and steps back when time is added (" + E("br-fill").style.width + ")");
  await load({ showBar: false }); boss("!brb 10m"); ok(!shown("br-bar"), "it can be hidden");

  section("who may use it");
  await load();
  chat("!brb 10m", { nick: "Viewer" }); ok(!stored().since, "a viewer cannot start a break");
  chat("!brb", { nick: "Viewer" }); ok(!stored().since && E("br-title").classList.contains("pop"), "the bare command from a viewer starts nothing, and only makes the headline pop");
  chat("!brb 10m", { mod: true }); ok(stored().since, "a moderator can by default");
  chat("!brb back", { nick: "Viewer" }); ok(stored().since, "a viewer cannot end it");
  await load({ whoCanManage: "broadcaster" }); chat("!brb 10m", { mod: true }); ok(!stored().since, "or only the broadcaster, when set");
  await load({ command: "!afk" }); boss("!brb 10m"); boss("!afk 10m"); ok(left() === 10 * MIN, "the command word is a setting");
  await load({ command: "!afk" }); boss("!afkish 10m"); ok(!stored().since, "and a longer word that merely starts the same is not the command");

  section("a meeting");
  const meetingWords = "Currently in a meeting, be back soon <3";
  await load({ startMinutes: 10 });
  boss("!brb meeting");
  ok(cls("away") && title() === meetingWords, "!brb meeting shows the meeting headline, with no set time even when breaks have a default length (" + title() + ")");
  await reload(); ok(title() === meetingWords, "and it is still a meeting after a refresh");
  boss("!brb add 5m"); ok(title() === meetingWords && left() === 5 * MIN, "moving the time keeps it a meeting");
  boss("!brb back"); ok(cls("idle") && title() === "Be right back", "ending it brings the usual headline back");
  boss("!brb meeting 30m"); ok(cls("count") && left() === 30 * MIN && title() === meetingWords, "a meeting can have a length");
  await skip(31 * MIN); ok(title() === "Back any moment now", "and runs late like a break (" + title() + ")");
  boss("!brb 5m"); ok(title() === "Be right back", "a new break is not a meeting");
  boss("!brb meeting add 5m"); ok(title() === "Be right back", "adding time to a break does not make it a meeting");
  boss("!brb meeting back"); ok(cls("idle"), "!brb meeting back ends it");
  boss("!brb meeting add 5m"); ok(title() === meetingWords, "adding time with nothing on starts a meeting");
  await load(); chat("!brb meeting", { nick: "Viewer" }); ok(!stored().since, "a viewer cannot start one");
  await load({ command: "!afk", meetingTitle: "On a call" }); boss("!afk MEETING"); ok(title() === "On a call", "it follows the command word, in any case, and the headline is a setting");
  await load(); boss("!brb meetings"); boss("!meeting"); ok(!stored().since, "a longer word, or !meeting on its own, is not a meeting");

  section("a meeting with the clock off");
  const timers = ["br-label", "br-clock", "br-bar", "br-at"];
  await load({ meetingClock: false });
  boss("!brb meeting");
  ok(timers.every(id => !shown(id)) && title() === meetingWords && shown("br-msg"), "only the headline and the rotating line show");
  boss("!brb meeting 30m"); ok(timers.every(id => !shown(id)) && left() === 30 * MIN, "a timed meeting hides them too, and still keeps its time");
  await reload(); ok(timers.every(id => !shown(id)), "and they stay hidden after a refresh");
  await skip(31 * MIN); ok(title() === "Back any moment now", "it still says when it has run late");
  boss("!brb 5m"); ok(timers.every(shown), "an ordinary break keeps its clock, words, bar and time");
  boss('!brb custom "Walking the dog"'); ok(shown("br-clock"), "and so does a custom headline");

  section("the clock off for every break");
  await load({ showClock: false, meetingClock: true });
  for (const [command, words] of [["!brb 5m", "Be right back"], ["!brb meeting 30m", meetingWords], ['!brb custom "Walking the dog"', "Walking the dog"], ["!brb", "Be right back"]]) {
    boss(command);
    ok(shown("br-app") && title() === words && shown("br-msg") && timers.every(id => !shown(id)), command + " shows only the headline and the rotating line");
  }
  boss("!brb 5m"); await reload(); ok(timers.every(id => !shown(id)) && left() === 5 * MIN, "they stay hidden after a refresh, and the time is still kept");
  await skip(6 * MIN); ok(title() === "Back any moment now", "it still says when it has run late");
  boss("!brb back"); ok(!shown("br-app"), "and !brb back still hides the overlay");

  section("a custom headline");
  const shop = "I'm heading out to the shop, see you soon!";
  await load({ startMinutes: 10 });
  boss('!brb custom "' + shop + '"');
  ok(cls("away") && title() === shop, "!brb custom shows your words without the quotes, with no set time (" + title() + ")");
  await reload(); ok(title() === shop, "and keeps them through a refresh");
  boss("!brb add 10m"); ok(left() === 10 * MIN && title() === shop, "a time can be added and the words stay");
  boss("!brb back"); ok(title() === "Be right back", "coming back clears them");
  boss("!brb CUSTOM Walking the dog <3"); ok(title() === "Walking the dog <3", "quotes are optional and your capitals are kept");
  boss("!brb custom \u201CMaking tea\u201D"); ok(title() === "Making tea", "the curly quotes a phone types are removed too");
  boss("!brb custom Back in 5m"); ok(title() === "Back in 5m" && !stored().until, "a time inside the words is just words");
  boss("!brb 5m"); ok(title() === "Be right back", "a new break goes back to the usual headline");
  await load(); boss("!brb custom"); boss('!brb custom ""'); ok(!stored().since, "custom with no words does nothing");
  chat("!brb custom hello", { nick: "Viewer" }); ok(!stored().since, "a viewer cannot set one");
  boss("!brb custom " + "a".repeat(300)); ok(title().length === 140, "a very long one is cut at 140 characters");
  ok(env.vars("br-app")["--br-title-fit"] === 0.567, "and its letters are smaller, to leave room for the clock (" + env.vars("br-app")["--br-title-fit"] + ")");
  boss('!brb custom "' + shop + '"'); ok(env.vars("br-app")["--br-title-fit"] === 1, "an everyday one keeps the full size");

  section("when the overlay was closed");
  await load(); boss("!brb 30m"); env.fake += 10 * MIN; await reload();
  ok(cls("count") && clock() === "20:00", "a break carries on through a refresh at the right time (" + clock() + ")");
  env.fake += 25 * MIN; await reload(); ok(cls("late"), "one whose time passed while it was closed shows late");
  await load(); await reload(); ok(cls("idle"), "an empty one stays empty");
  storeData.be_right_back_v1 = { since: "soon", until: [] }; await reload(); ok(cls("idle"), "a damaged save is ignored");
  storeData.be_right_back_v1 = { since: env.fake - MIN, until: "x" }; await reload(); ok(cls("away"), "a damaged end time means no set time");
  storeData.be_right_back_v1 = { since: env.fake - MIN, until: env.fake + 4 * MIN }; await reload(); ok(cls("count") && E("br-fill").style.width === "20%", "a good one is read back (" + E("br-fill").style.width + ")");

  section("the rotating lines");
  await load({ messageSeconds: 5 });
  const line = () => E("br-msg").textContent;
  ok(line() === "Grab a drink and stretch your legs", "the first line shows first");
  await skip(5 * SEC + 300); ok(line() === "Chat is open, say hi to each other", "then the next (" + line() + ")");
  await skip(5 * SEC); ok(line() === "Back soon, I promise", "then the next (" + line() + ")");
  await skip(5 * SEC); ok(line() === "Grab a drink and stretch your legs", "and round again");
  await load({ messages: "Just one" }); await skip(60 * SEC); ok(line() === "Just one", "a single line stays");
  await load({ messages: "  a |  | b " }); ok(line() === "a", "blank pieces are skipped and spaces trimmed");
  await load({ messages: "" }); ok(!shown("br-msg"), "no lines hides the space for them");

  section("buttons");
  await load();
  button("btnStart"); ok(cls("away"), "Start a break, with no set time by default");
  await load({ startMinutes: 10 }); button("btnStart"); ok(left() === 10 * MIN, "or of the default length");
  button("btnAdd5"); ok(left() === 15 * MIN, "Add five minutes");
  button("btnLess1"); ok(left() === 14 * MIN, "Take a minute off");
  button("btnStop"); ok(cls("idle"), "I am back: clear the break");

  section("look");
  await load({ clockSize: 20, titleSize: 7, labelSize: 4, messageSize: 3, atSize: 3.5, barSize: 2, gap: 2, radius: 12, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, animate: false });
  const v = env.vars("br-app");
  ok(v["--br-clock"] === 20 && v["--br-title"] === 7 && v["--br-label"] === 4 && v["--br-msg"] === 3 && v["--br-at"] === 3.5 && v["--br-bar"] === 2 && v["--br-gap"] === 2, "the size and spacing settings apply");
  ok(v["--w-radius"] === "12px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-shadow"] !== "none", "the corner, outline, weight and shadow settings apply");
  ok(E("br-root").classList.contains("no-motion"), "and Animate off stops motion");
  await load({ title: "" }); ok(E("br-title").hidden, "a blank headline hides it");
  await load({ showTitle: false }); ok(E("br-title").hidden, "so does turning it off");
  await load({ title: "Back soon" }); ok(title() === "Back soon", "and it can be renamed");
  await env.checkPresets("br-app");
  await env.checkFrame("br-app");
  await env.checkDecor("br-app");

  section("the stylesheet");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/container-type:\s*size/.test(css) && /--u:\s*min\(1cqw,\s*1\.7778cqh\)/.test(css), "sizes come from a unit that is the smaller of the width and the height at 16 by 9, so it fits any shape of box");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
