/* Headless test for the stream start countdown overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData, audioLog } = env;
const skip = async ms => { env.fake += ms; await wait(400); };
const SEC = 1000, MIN = 60000, HOUR = 3600000;
const clock = () => E("sc-clock").textContent;
const shown = id => !E(id).hidden;
const title = () => E("sc-title").textContent;
const stored = () => storeData.start_countdown_v1 || {};
const left = () => stored().target - env.fake;
const cls = c => E("sc-app").classList.contains(c);

(async () => {
  section("before anything is set");
  await load();
  ok(cls("idle") && title() === "Starting soon" && shown("sc-title"), "the headline shows with no countdown (" + title() + ")");
  ok(!shown("sc-clock") && !shown("sc-bar") && !shown("sc-at"), "and there is no clock, bar or start time yet");
  ok(shown("sc-msg") && E("sc-msg").textContent === "Grab a drink and get comfy", "the first rotating line shows (" + E("sc-msg").textContent + ")");

  section("starting a countdown");
  boss("!countdown 10m");
  ok(left() === 10 * MIN && stored().from === env.fake, "!countdown 10m sets the start ten minutes away");
  ok(cls("count") && shown("sc-clock") && clock() === "10:00" && shown("sc-bar") && shown("sc-at"), "the clock, bar and start time appear (" + clock() + ")");
  await skip(61 * SEC); ok(clock() === "08:59", "the clock counts down (" + clock() + ")");
  await skip(8 * MIN); ok(clock() === "00:59", "to the last minute (" + clock() + ")");
  ok(E("sc-fill").style.width === "90.2%" || E("sc-fill").style.width === "90.1%" || E("sc-fill").style.width === "90.3%", "and the bar is nearly full (" + E("sc-fill").style.width + ")");
  await skip(49 * SEC); ok(E("sc-clock").classList.contains("hot"), "the clock turns urgent for the last ten seconds");
  await skip(11 * SEC);
  ok(cls("live") && !shown("sc-clock") && !shown("sc-bar") && title() === "We're live!", "at zero the headline changes and the clock goes (" + title() + ")");
  await skip(3 * HOUR); ok(cls("live") && title() === "We're live!", "and it stays that way until cleared");
  await reload(); ok(cls("live"), "even after a refresh");
  boss("!countdown stop"); ok(cls("idle") && title() === "Starting soon" && !stored().target, "!countdown stop puts it back to the headline");

  section("ways of writing the time");
  const lens = async (cmd, ms) => { await load(); boss(cmd); return left() === ms ? "" : cmd + " gave " + left(); };
  const cases = [["!countdown 90s", 90 * SEC], ["!countdown 1h30m", 90 * MIN], ["!countdown 1:30:00", 90 * MIN], ["!countdown 5:00", 5 * MIN], ["!countdown 20", 20 * MIN], ["!countdown 1.5h", 90 * MIN], ["!countdown start 15m", 15 * MIN], ["!countdown start", 10 * MIN]];
  let bad = []; for (const [c, ms] of cases) { const r = await lens(c, ms); if (r) bad.push(r); }
  ok(bad.length === 0, "90s, 1h30m, 1:30:00, 5:00, a bare number of minutes, 1.5h and start all read correctly" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await load({ startMinutes: 25 }); boss("!countdown start"); ok(left() === 25 * MIN, "the default length is a setting");
  await load(); boss("!countdown soon"); boss("!countdown 0m"); boss("!countdown -5m"); boss("!countdown 3d"); boss("!countdown 99:99:99");
  ok(!stored().target, "words, zero, negative and over two days are ignored");

  section("a time of day");
  const at = async (words, h, m) => {
    await load(); boss("!countdown at " + words);
    const d = new Date(stored().target);
    return d.getHours() === h && d.getMinutes() === m && d.getSeconds() === 0 && left() > 0 && left() <= 24 * HOUR ? "" : words + " gave " + d.toString();
  };
  bad = []; for (const [w, h, m] of [["20:30", 20, 30], ["8pm", 20, 0], ["8:30 pm", 20, 30], ["12am", 0, 0], ["12:15pm", 12, 15], ["7:05", 7, 5]]) { const r = await at(w, h, m); if (r) bad.push(r); }
  ok(bad.length === 0, "at 20:30, 8pm, 8:30 pm, 12am, 12:15pm and 7:05 all land on that minute within the next day" + (bad.length ? " (" + bad.join("; ") + ")" : ""));
  await load(); const here = new Date(env.fake);
  boss("!countdown at " + here.getHours() + ":" + (here.getMinutes() < 10 ? "0" : "") + here.getMinutes());
  ok(left() > 0 && left() <= 24 * HOUR, "a time that has already passed today means tomorrow");
  await load(); boss("!countdown at 25:00"); boss("!countdown at 13pm"); boss("!countdown at 8"); boss("!countdown at"); boss("!countdown at soon");
  ok(!stored().target, "a bare number, an impossible time and words are ignored");
  await load({ clock24: true }); boss("!countdown at 8:05pm"); ok(E("sc-at").textContent === "Starting at 20:05", "the start time is shown (" + E("sc-at").textContent + ")");
  await load({ clock24: false }); boss("!countdown at 8:05pm"); ok(E("sc-at").textContent === "Starting at 8:05 pm", "on a 12-hour clock if asked (" + E("sc-at").textContent + ")");
  await load({ clock24: false }); boss("!countdown at 12:00am"); ok(E("sc-at").textContent === "Starting at 12:00 am", "midnight reads as 12:00 am (" + E("sc-at").textContent + ")");
  await load({ atPrefix: "" }); boss("!countdown at 21:00"); ok(E("sc-at").textContent === "21:00", "and the words before it can be blank");
  await load({ showStartTime: false }); boss("!countdown 5m"); ok(!shown("sc-at"), "or the start time can be hidden");

  section("changing it");
  await load(); boss("!countdown 10m"); await skip(2 * MIN);
  boss("!countdown add 5m"); ok(left() === 13 * MIN, "!countdown add 5m pushes the start back (" + left() / MIN + ")");
  boss("!countdown less 3m"); ok(left() === 10 * MIN, "!countdown less 3m brings it forward");
  boss("!countdown less 1h"); ok(cls("live"), "taking off more than is left goes live");
  boss("!countdown add 7m"); ok(cls("count") && left() === 7 * MIN, "adding after that starts a fresh countdown (" + left() / MIN + ")");
  await load(); boss("!countdown add 5m"); ok(left() === 5 * MIN, "adding with nothing running starts one");
  await load(); boss("!countdown less 5m"); ok(!stored().target, "and taking time off with nothing running does nothing");
  await load(); boss("!countdown 10m"); boss("!countdown add 3d"); boss("!countdown add soon"); ok(left() === 10 * MIN, "an unreadable or huge change is ignored");
  boss("!countdown live"); ok(cls("live"), "!countdown live goes live at once");
  await load(); boss("!countdown 10m"); boss("!countdown now"); ok(cls("live"), "so does now");
  await load(); boss("!countdown 10m"); boss("!countdown 20m"); ok(left() === 20 * MIN, "a new time replaces the running one");
  await load(); boss("!countdown 10m"); boss("!countdown clear"); ok(cls("idle"), "clear works like stop");

  section("the bar");
  await load(); boss("!countdown 10m");
  ok(E("sc-fill").style.width === "0%", "starts empty (" + E("sc-fill").style.width + ")");
  await skip(5 * MIN); ok(E("sc-fill").style.width === "50%", "is half full half way (" + E("sc-fill").style.width + ")");
  boss("!countdown add 10m"); ok(E("sc-fill").style.width === "25%", "and steps back when time is added (" + E("sc-fill").style.width + ")");
  await load({ showBar: false }); boss("!countdown 10m"); ok(!shown("sc-bar"), "it can be hidden");

  section("who may use it");
  await load();
  chat("!countdown 10m", { nick: "Viewer" }); ok(!stored().target, "a viewer cannot start one");
  chat("!countdown 10m", { mod: true }); ok(stored().target, "a moderator can by default");
  chat("!countdown stop", { nick: "Viewer" }); ok(stored().target, "or stop it");
  await load({ whoCanManage: "broadcaster" }); chat("!countdown 10m", { mod: true }); ok(!stored().target, "or only the broadcaster, when set");
  await load({ command: "!soon" }); boss("!countdown 10m"); boss("!soon 10m"); ok(left() === 10 * MIN, "the command word is a setting");
  await load({ command: "!soon" }); boss("!soonish 10m"); ok(!stored().target, "and a longer word that merely starts the same is not the command");
  await load(); chat("!countdown", { nick: "Viewer" }); ok(E("sc-title").classList.contains("pop") && !stored().target, "the bare command from anyone only makes the headline pop");

  section("when the overlay was closed");
  await load(); boss("!countdown 30m"); env.fake += 10 * MIN; await reload();
  ok(cls("count") && clock() === "20:00", "a countdown carries on through a refresh at the right time (" + clock() + ")");
  env.fake += 25 * MIN; audioLog.length = 0; await reload();
  ok(cls("live") && audioLog.length === 0, "one that ran out while it was closed shows live, without a sound");
  await load(); await reload(); ok(cls("idle"), "an empty one stays empty");
  storeData.start_countdown_v1 = { target: "soon", from: [] }; await reload(); ok(cls("idle"), "a damaged save is ignored");
  storeData.start_countdown_v1 = { target: env.fake + 5 * MIN, from: env.fake + 9 * MIN }; await reload(); ok(cls("count") && E("sc-fill").style.width === "100%", "a start after the end counts as no progress rather than breaking (" + E("sc-fill").style.width + ")");

  section("the rotating lines");
  await load({ messageSeconds: 5 });
  const line = () => E("sc-msg").textContent;
  ok(line() === "Grab a drink and get comfy", "the first line shows first");
  await skip(5 * SEC + 300); ok(line() === "Say hi in chat, we can see you", "then the next (" + line() + ")");
  await skip(5 * SEC); ok(line() === "Be kind to each other", "then the next (" + line() + ")");
  await skip(5 * SEC); ok(line() === "Grab a drink and get comfy", "and round again");
  await load({ messages: "Just one" }); await skip(60 * SEC); ok(line() === "Just one", "a single line stays");
  await load({ messages: "  a |  | b " }); ok(line() === "a", "blank pieces are skipped and spaces trimmed");
  await load({ messages: "" }); ok(!shown("sc-msg"), "no lines hides the space for them");

  section("going live");
  await load({ soundLive: "data:audio/wav;base64,AA", soundLiveVol: 40 });
  boss("!countdown 1m"); audioLog.length = 0; await skip(59 * SEC); ok(audioLog.length === 0, "no sound before zero");
  await skip(2 * SEC); ok(audioLog.length === 1 && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "a sound plays once when it reaches zero");
  await skip(30 * SEC); ok(audioLog.length === 1, "and not again");
  boss("!countdown 1m"); await skip(61 * SEC); ok(audioLog.length === 2, "but again for the next countdown");
  audioLog.length = 0; button("test_soundLive"); ok(audioLog.length === 1, "the Test button plays");
  await load({ soundLive: "data:audio/wav;base64,AA", mute: true }); boss("!countdown 1m"); audioLog.length = 0; await skip(61 * SEC); ok(audioLog.length === 0, "mute silences it");
  await load({ liveTitle: "Hello!" }); boss("!countdown 1m"); await skip(61 * SEC); ok(title() === "Hello!", "the live headline is a setting");
  await load({ liveTitle: "" }); boss("!countdown 1m"); await skip(61 * SEC); ok(E("sc-title").hidden, "and a blank one leaves none");

  section("buttons");
  await load();
  button("btnStart"); ok(left() === 10 * MIN, "Start a countdown of the default length");
  button("btnAdd5"); ok(left() === 15 * MIN, "Add five minutes");
  button("btnLess1"); ok(left() === 14 * MIN, "Take a minute off");
  button("btnLive"); ok(cls("live"), "Go live now");
  button("btnStop"); ok(cls("idle"), "Clear the countdown");

  section("look");
  await load({ clockSize: 20, titleSize: 7, messageSize: 3, atSize: 3.5, barSize: 2, gap: 2, radius: 12, outerFrame: false, borderWidth: 2, borderColor: "#FF0000", shadow: true, weight: 600, animate: false });
  const v = env.vars("sc-app");
  ok(v["--sc-clock"] === 20 && v["--sc-title"] === 7 && v["--sc-msg"] === 3 && v["--sc-at"] === 3.5 && v["--sc-bar"] === 2 && v["--sc-gap"] === 2, "the size and spacing settings apply");
  ok(v["--w-radius"] === "12px" && v["--w-border"] === "2px solid #FF0000" && v["--w-weight"] === 600 && v["--w-shadow"] !== "none", "the corner, outline, weight and shadow settings apply");
  ok(E("sc-root").classList.contains("no-motion"), "and Animate off stops motion");
  await load({ title: "" }); ok(E("sc-title").hidden, "a blank headline hides it");
  await load({ showTitle: false }); ok(E("sc-title").hidden, "so does turning it off");
  await load({ title: "Back soon" }); ok(title() === "Back soon", "and it can be renamed");
  await load({ urgentSeconds: 0 }); boss("!countdown 5s"); await skip(1 * SEC); ok(!E("sc-clock").classList.contains("hot"), "the urgent colour can be turned off");
  await env.checkPresets("sc-app");
  await env.checkFrame("sc-app");

  section("the stylesheet");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/container-type:\s*size/.test(css) && /--u:\s*min\(1cqw,\s*1\.7778cqh\)/.test(css), "sizes come from a unit that is the smaller of the width and the height at 16 by 9, so it fits any shape of box");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
