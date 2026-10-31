/* Headless test for the over camera cover. Runs the real widget/widget.js against a small mock of the
   page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData, audioLog } = env;

const LOCK = String.fromCodePoint(0x1F512), COFFEE = String.fromCodePoint(0x2615), ZZZ = String.fromCodePoint(0x1F4A4);
const cover = () => E("oc-cover");
const covered = () => !cover().classList.contains("live");
const text = () => E("oc-text").textContent;
const sub = () => E("oc-sub").hidden ? "" : E("oc-sub").textContent;
const icon = () => E("oc-icon").hidden ? "" : E("oc-icon").textContent;
const skip = async ms => { env.fake += ms; await wait(ms > 600 ? 600 : ms + 300); };
const saved = () => storeData.overcamera_v1;

(async () => {
  section("starting out");
  await load();
  ok(!covered() && !cover().classList.contains("holding") && text() === "" && icon() === "" && sub() === "", "the camera is showing, and the cover says nothing");
  await load({ startMode: "off" });
  ok(covered() && text() === "Camera off", "it can start covered the very first time (" + text() + ")");
  boss("!camera on"); await reload();
  ok(!covered(), "but after that it remembers where it was, not where it started");

  section("covering and uncovering");
  await load();
  boss("!camera off");
  ok(covered() && text() === "Camera off" && sub() === "Back soon" && icon() === LOCK, "off covers, with its message, its line and its icon (" + text() + ", " + sub() + ")");
  boss("!camera on"); ok(!covered() && text() === "" && icon() === "" && sub() === "", "on uncovers it, and the cover says nothing again");
  boss("!camera off"); boss("!camera live"); ok(!covered(), "live is another word for on");
  boss("!camera OFF"); ok(covered(), "a command is not case sensitive");
  boss("!camera on");
  chat("!camera off", { nick: "viewer" }); ok(!covered(), "a viewer cannot cover it");
  chat("!camera off", { mod: true }); ok(covered(), "a moderator can, which is the point of it");
  chat("!camera on", { nick: "viewer" }); ok(covered(), "and a viewer cannot uncover it");
  chat("!camera on", { mod: true }); ok(!covered(), "though a moderator can");
  await load({ whoCanManage: "broadcaster" }); chat("!camera off", { mod: true }); ok(!covered(), "unless only the broadcaster is allowed");
  boss("!camera off"); ok(covered(), "who always can");
  boss("!camera on");
  boss("!camera"); ok(!covered(), "the bare word does nothing");
  boss("!camera off"); boss("!camera"); ok(covered(), "and does not uncover it either");
  boss("!camera on");
  boss("!camerax off"); boss("!cameras off"); chat("!camera-off", { mod: true }); ok(!covered(), "whole words only: !camerax is not the command");
  boss("!camera nonsense"); boss("!camera offf"); boss("!camera off now please"); ok(!covered() || text() === "Camera off", "anything it does not know changes nothing");
  await load({ command: "!privacy" }); boss("!camera off"); ok(!covered(), "the command word is a setting");
  boss("!privacy off"); ok(covered(), "and the new one works");
  await load(); boss("!camera off"); boss("!camera off"); boss("!camera off"); ok(covered() && text() === "Camera off", "saying it again changes nothing");
  boss("!camera cover Back soon"); boss("!camera off"); ok(text() === "Camera off", "and off always puts its own message back");

  section("be right back and away");
  await load();
  boss("!camera brb"); ok(covered() && text() === "Be right back" && icon() === COFFEE && sub() === "", "brb covers, with no countdown unless one is asked for (" + text() + ")");
  boss("!camera away"); ok(covered() && text() === "Away for a moment" && icon() === ZZZ, "away covers with its own message (" + text() + ")");
  boss("!camera on");
  boss("!camera brb 5m"); ok(sub() === "Back in 5:00", "a time starts a countdown (" + sub() + ")");
  await skip(1000); ok(sub() === "Back in 4:59", "which counts down as time passes (" + sub() + ")");
  await skip(60000); ok(sub() === "Back in 3:59", "a minute at a time too (" + sub() + ")");
  boss("!camera away 10m"); ok(text() === "Away for a moment" && sub() === "Back in 10:00", "away takes a time as well (" + sub() + ")");
  for (const form of [["5m", "5:00"], ["90s", "1:30"], ["1h30m", "1:30:00"], ["2:30", "2:30"], ["5", "5:00"], ["1.5m", "1:30"], ["1h", "1:00:00"], ["12h", "12:00:00"], ["  7m  ", "7:00"]]) {
    boss("!camera brb " + form[0]); ok(sub() === "Back in " + form[1], "a time can be written as " + JSON.stringify(form[0]) + " (" + sub() + ")");
  }
  for (const bad of ["soon", "5 mins please", "m5", "-5m", "0", "0m", "13h", "99999h", "1e3m", "five", "5m5"]) {
    boss("!camera on"); boss("!camera brb " + bad);
    ok(covered() && text() === "Be right back" && sub() === "", "a time that cannot be read, or is absurd, still covers the camera, without a countdown: " + JSON.stringify(bad) + " (" + sub() + ")");
  }
  boss("!camera on"); chat("!camera brb 5m", { nick: "viewer" }); ok(!covered(), "a viewer cannot start one");

  section("when a countdown ends");
  await load();
  boss("!camera brb 2m"); await skip(119000); ok(sub() === "Back in 0:01", "the last second (" + sub() + ")");
  await skip(2000); ok(covered() && sub() === "Back any moment now", "at zero it says so, and stays covered (" + sub() + ")");
  await skip(3600000); ok(covered(), "even an hour later: it does not lift itself");
  boss("!camera on"); ok(!covered(), "until it is told to");
  await load({ autoReveal: true }); boss("!camera brb 1m"); await skip(61000);
  ok(!covered() && text() === "", "unless the setting asks for it to lift by itself (" + text() + ")");
  await load({ autoReveal: true }); boss("!camera off"); await skip(7200000); ok(covered(), "and off never lifts itself, whatever the setting");
  await load({ overText: "Nearly there", timerText: "{time} to go" }); boss("!camera brb 1m"); ok(sub() === "1:00 to go", "the wording is a setting (" + sub() + ")");
  await skip(61000); ok(sub() === "Nearly there", "at zero too (" + sub() + ")");

  section("a message of your own");
  await load();
  boss("!camera cover Doorbell!"); ok(covered() && text() === "Doorbell!" && icon() === "" && sub() === "", "cover shows what you tell it (" + text() + ")");
  boss("!camera cover"); ok(covered() && text() === "Camera off", "with nothing after it, it covers as off would (" + text() + ")");
  boss("!camera cover " + "x".repeat(300)); ok(text().length === 120, "a long message is cut short (" + text().length + ")");
  boss("!camera cover <b>hi</b> & <img src=x onerror=alert(1)>"); ok(text() === "<b>hi</b> & <img src=x onerror=alert(1)>", "text is shown as typed, never as markup");
  chat("!camera cover Hello", { nick: "viewer" }); ok(text() !== "Hello", "a viewer cannot set one");
  await load({ coverIcon: "!" }); boss("!camera cover Hi"); ok(icon() === "!", "and it can have an icon of its own");

  section("changing from one cover to another");
  await load({ soundCover: "data:audio/wav;base64,AA", soundReveal: "data:audio/wav;base64,BB", soundCoverVol: 40, soundRevealVol: 90 });
  audioLog.length = 0; boss("!camera off");
  ok(audioLog.length === 1 && audioLog[0].src.endsWith("AA") && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "covering the camera plays its sound at its volume");
  audioLog.length = 0; boss("!camera brb"); boss("!camera away 5m"); boss("!camera cover Hi"); ok(audioLog.length === 0 && covered(), "going from one cover to another makes no sound, and never uncovers it");
  audioLog.length = 0; boss("!camera on"); ok(audioLog.length === 1 && audioLog[0].src.endsWith("BB") && Math.abs(audioLog[0].volume - 0.9) < 1e-9, "uncovering plays its sound");
  audioLog.length = 0; boss("!camera on"); ok(audioLog.length === 0, "uncovering it again is silent");
  audioLog.length = 0; button("test_soundCover"); button("test_soundReveal"); ok(audioLog.length === 2, "the Test buttons play");
  await load({ soundCover: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; boss("!camera off"); ok(audioLog.length === 0 && covered(), "mute silences it, and still covers");
  await load({ soundReveal: "data:audio/wav;base64,BB", autoReveal: true }); boss("!camera brb 1m"); audioLog.length = 0; await skip(61000); ok(audioLog.length === 1, "a countdown that lifts the cover plays the uncover sound");

  section("keeping it between refreshes");
  await load(); boss("!camera off"); await reload();
  ok(covered() && text() === "Camera off", "a covered camera is still covered after a refresh");
  boss("!camera cover Back at nine"); await reload(); ok(text() === "Back at nine", "with its message (" + text() + ")");
  boss("!camera brb 10m"); await skip(1000); await reload(); ok(sub() === "Back in 9:59", "and a countdown carries on from where it was (" + sub() + ")");
  await skip(11 * 60000); await reload(); ok(covered() && sub() === "Back any moment now", "one that ended while it was away is over, and still covered (" + sub() + ")");
  boss("!camera on"); await reload(); ok(!covered(), "and an uncovered camera stays that way");
  ok(saved() && saved().mode === "live", "what it keeps is the state (" + JSON.stringify(saved()) + ")");
  storeData.overcamera_v1 = "garbage"; await reload(); ok(!covered(), "a save that is not an object is no save, so it starts as it starts");
  await load({ startMode: "off" }); storeData.overcamera_v1 = "garbage"; await reload(); ok(covered(), "and if it starts covered, a damaged save leaves it covered");
  for (const bad of [{ mode: "sideways" }, { mode: 7 }, { text: "x" }, null, [], { mode: null }]) { await load({ startMode: "off" }); storeData.overcamera_v1 = bad; await reload(); ok(covered(), "a save with no usable state falls back to where it starts: " + JSON.stringify(bad)); }
  await load(); storeData.overcamera_v1 = { mode: "brb", until: "soon", text: 5 }; await reload(); ok(covered() && sub() === "", "a countdown that is not a number is no countdown");
  storeData.overcamera_v1 = { mode: "brb", until: 1e30 }; await reload(); ok(covered() && sub() === "", "nor is an absurd one");
  storeData.overcamera_v1 = { mode: "cover", text: "y".repeat(500) }; await reload(); ok(text().length === 120, "and a saved message is held to its limit");
  storeData.overcamera_v1 = { mode: "off" }; await load({ startMode: "live" }, true); ok(covered(), "a saved cover beats where it would start");

  section("a refresh can never show the camera");
  env.storeLatency = 1000;
  storeData.overcamera_v1 = { mode: "off" };
  await load({}, true);
  ok(cover().classList.contains("holding") && covered() && text() === "", "the cover is up, and silent, while the saved state is still on its way");
  boss("!camera on"); ok(covered(), "and a command that arrives before it is known waits, and cannot uncover it");
  await wait(1100);
  ok(!cover().classList.contains("holding") && covered() && text() === "Camera off", "when it arrives, the cover says what it should (" + text() + ")");
  storeData.overcamera_v1 = { mode: "live" }; await load({}, true); ok(covered(), "an uncovered camera is also held covered until it is known");
  await wait(1100); ok(!covered() && !cover().classList.contains("holding"), "then uncovered, once it is known");
  env.storeLatency = Infinity;
  await load(); await wait(2900); ok(covered() && cover().classList.contains("holding"), "if the saved state never comes, it waits for a while");
  await wait(200); ok(covered() && text() === "Camera off" && !cover().classList.contains("holding"), "and then stops waiting, but stays covered, because it cannot know the camera was safe to show (" + text() + ")");
  boss("!camera on"); ok(!covered(), "and a moderator can lift it");
  await load({ startMode: "off" }); await wait(3100); ok(covered() && text() === "Camera off" && !cover().classList.contains("holding"), "which is the same if it starts covered");
  await load({ holdWhileLoading: false }); await wait(3100); ok(!covered(), "but with the hold switched off it uses where it starts (live)");
  env.storeLatency = 1000;
  await load({ holdWhileLoading: false }); ok(!covered() && !cover().classList.contains("holding"), "with the hold switched off the camera shows straight away, which is why it is recommended");
  await wait(1100); ok(!covered(), "and the saved state still applies when it arrives");
  env.storeLatency = undefined;
  await load(); ok(cover().classList.contains("holding") === false, "with the store as usual it settles at once");

  section("it is always solid");
  const rgb = css => { const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(css) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css); const h = css.charAt(0) === "#"; return "rgb(" + [1, 2, 3].map(i => h ? parseInt(m[i], 16) : m[i]).join(", ") + ")"; };
  let allSolid = true;
  for (const key of Object.keys(env.expectedPresets)) {
    await load({ themePreset: key });
    const v = env.vars("oc-cover")["--oc-solid"];
    if (!/^rgb\(\d+, \d+, \d+\)$/.test(String(v)) || v !== rgb(env.expectedPresets[key].panel)) { allSolid = false; console.log("    not solid or not the panel colour for " + key + ": " + v); }
  }
  ok(allSolid, "in every one of the " + Object.keys(env.expectedPresets).length + " style presets the cover is the panel's colour with no transparency");
  await load({ themePreset: "custom", colorPanel: "#102030", panelOpacity: 0.1 });
  ok(env.vars("oc-cover")["--oc-solid"] === "rgb(16, 32, 48)", "and in a custom colour, however see-through it is set (" + env.vars("oc-cover")["--oc-solid"] + ")");
  await load({ themePreset: "custom", colorPanel: "nonsense" });
  ok(env.vars("oc-cover")["--oc-solid"] === "rgb(0, 0, 0)", "a colour that is not one is black, which is still solid (" + env.vars("oc-cover")["--oc-solid"] + ")");

  section("looks");
  await load({ textSize: 12 }); ok(env.vars("oc-cover")["--oc-size"] === 12, "the text size is a setting");
  await load({ textSize: 999 }); ok(env.vars("oc-cover")["--oc-size"] === 30, "within limits");
  await load({ textSize: 0 }); ok(env.vars("oc-cover")["--oc-size"] === 2, "both ways");
  await load({ radius: 10 }); ok(env.vars("oc-stage")["--oc-radius"] === "10px", "the corner is a setting");
  await load({ shape: "circle" }); ok(env.vars("oc-stage")["--oc-radius"] === "50%", "and it can be a circle, for a round camera");
  await load({ animate: false }); ok(E("oc-root").classList.contains("no-motion"), "Animate off stops motion");
  await load({ offText: "Hidden", offSub: "", offIcon: "" }); boss("!camera off");
  ok(text() === "Hidden" && sub() === "" && icon() === "", "a blank line or icon is left out (" + text() + ")");
  await load({ offText: "" }); boss("!camera off"); ok(covered() && text() === "", "even a blank message still covers the camera");
  await load({ brbIcon: "", awayIcon: "" }); boss("!camera brb"); ok(icon() === "", "icons can be left off");
  await env.checkPresets("oc-stage");

  section("a frame along the camera's edge");
  const fill = () => env.vars("oc-stage")["--oc-frame-fill"], ring = () => E("oc-root").classList.contains("no-frame");
  await load(); ok(ring(), "there is no frame unless you ask for one");
  await load({ showFrame: true }); ok(!ring() && fill() === "var(--w-flag)" && env.vars("oc-stage")["--oc-frame"] === 1.5, "a frame in the preset's colour, one and a half percent of the width (" + fill() + ")");
  await load({ showFrame: true, themePreset: "midnight" }); ok(env.vars("oc-stage")["--w-flag"] === env.expectedPresets.midnight.accent, "which is the preset's accent");
  let flagged = 0, plain = 0;
  for (const key of Object.keys(env.expectedPresets)) {
    await load({ showFrame: true, themePreset: key });
    const flag = String(env.vars("oc-stage")["--w-flag"]);
    if (env.expectedPresets[key].flag) { if (flag.indexOf("linear-gradient(180deg") === 0) flagged++; } else if (flag === env.expectedPresets[key].accent) plain++;
  }
  ok(flagged === 7 && plain === Object.keys(env.expectedPresets).length - 7, "a pride preset's frame is its flag and every other preset's is its accent (" + flagged + " flags, " + plain + " plain)");
  await load({ showFrame: true, frameStyle: "panel" }); ok(fill() === "rgb(0, 0, 0)", "the panel's colour can be used, made solid (" + fill() + ")");
  await load({ showFrame: true, frameStyle: "custom", colorFrame: "#FF8800" }); ok(fill() === "#FF8800", "or any colour you pick (" + fill() + ")");
  await load({ showFrame: true, frameStyle: "nonsense" }); ok(fill() === "var(--w-flag)", "a style that is not one of the choices is the preset's");
  await load({ showFrame: true, frameWidth: 99 }); ok(env.vars("oc-stage")["--oc-frame"] === 10, "the thickness is held within limits");
  await load({ showFrame: true, frameWidth: 0 }); ok(env.vars("oc-stage")["--oc-frame"] === 0.2, "both ways");
  await load({ showFrame: true, shape: "circle" }); ok(env.vars("oc-stage")["--oc-radius"] === "50%", "a round camera gets a round frame");
  await load({ showFrame: true }); boss("!camera off"); ok(!ring() && covered(), "the frame stays while the camera is covered");
  boss("!camera on"); ok(!ring() && !covered(), "and while it is showing, which is when it is wanted");

  section("the cover's shape");
  const locked = () => E("oc-root").classList.contains("locked"), ar = () => env.vars("oc-stage")["--oc-ar"];
  await load(); ok(!locked() && ar() === "", "by default the cover fills the whole box");
  for (const [setting, ratio] of [["16:9", "1.7778"], ["4:3", "1.3333"], ["3:2", "1.5"], ["1:1", "1"], ["9:16", "0.5625"]]) {
    await load({ aspect: setting }); ok(locked() && ar() === ratio, "a cover of " + setting + " keeps that shape (" + ar() + ")");
  }
  await load({ aspect: "free" }); ok(!locked() && ar() === "", "free keeps none");
  await load({ aspect: "sideways" }); ok(!locked(), "and anything else is free");
  await load({ aspect: "1:1", shape: "circle" }); ok(locked() && env.vars("oc-stage")["--oc-radius"] === "50%", "with a square shape and a circle, it is a true circle");
  await load({ aspect: "4:3", showFrame: true }); boss("!camera off"); ok(locked() && covered() && !E("oc-root").classList.contains("no-frame"), "the frame keeps the shape too, and the shape holds while it is covered");
  boss("!camera on"); ok(locked() && !covered(), "and while it is not");
  env.storeLatency = 1000;
  await load({ aspect: "16:9" }, false); ok(!locked() && covered() && cover().classList.contains("holding"), "while the saved state is loading the cover is the whole box, whatever the shape, so a shape set too small cannot show a corner of the camera");
  await wait(1100); ok(locked(), "and takes its shape once it is known");
  env.storeLatency = Infinity;
  await load({ aspect: "16:9" }); await wait(3100); ok(locked() && covered(), "also if the saved state never comes, when it stays covered and takes its shape");
  env.storeLatency = undefined;

  section("the buttons");
  await load();
  button("btnOff"); ok(covered() && text() === "Camera off", "the off button covers it");
  button("btnBrb"); ok(covered() && text() === "Be right back", "the brb button");
  button("btnAway"); ok(covered() && text() === "Away for a moment", "the away button");
  button("btnOn"); ok(!covered(), "and the on button uncovers it");

  section("odd input never uncovers it");
  await load(); boss("!camera off");
  env.ev("message", {}); env.ev("message", { data: null }); env.ev("message", { data: { text: 5 } }); env.ev("message", { data: { text: "!camera on", badges: "x", tags: null } });
  env.ev("nonsense", {}); env.ev("widget-button", { field: "nope" }); env.ev("widget-button", {}); env.ev("message", { data: { text: "!camera on", badges: [{ type: "viewer" }] } });
  ok(covered(), "empty, missing and wrongly typed events change nothing, and nothing uncovers it but a command from someone allowed");
  boss("!camera on"); ok(!covered(), "and it carries on afterwards");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
