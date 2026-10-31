/* Headless test for the camera overlay: the cover that blocks the camera when it is needed, and the nameplate and frame
   round the window the camera shows through. Runs the real widget/widget.js against a small mock of the page and
   StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, reload, boss, chat, button, wait, E, storeData, audioLog } = env;

const LOCK = String.fromCodePoint(0x1F512), COFFEE = String.fromCodePoint(0x2615), ZZZ = String.fromCodePoint(0x1F4A4);
const cover = () => E("cam-cover");
const covered = () => !cover().classList.contains("live");
const text = () => E("cam-text").textContent;
const sub = () => E("cam-sub").hidden ? "" : E("cam-sub").textContent;
const icon = () => E("cam-icon").hidden ? "" : E("cam-icon").textContent;
const skip = async ms => { env.fake += ms; await wait(ms > 600 ? 600 : ms + 300); };
const saved = () => storeData.camera_v1;
const hold = () => E("cam-hold");
const nameT = () => E("cam-name").hidden ? "" : E("cam-name").textContent;
const pron = () => E("cam-pron").hidden ? "" : E("cam-pron").textContent;
const tagline = () => E("cam-tagline").hidden ? "" : E("cam-tagline").textContent;
const lineEls = () => E("cam-lines").children;
const line = () => { const on = lineEls().find(c => c.classList.contains("on")); return on ? on.textContent : ""; };
const app = () => E("cam-app");

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
  storeData.camera_v1 = "garbage"; await reload(); ok(!covered(), "a save that is not an object is no save, so it starts as it starts");
  await load({ startMode: "off" }); storeData.camera_v1 = "garbage"; await reload(); ok(covered(), "and if it starts covered, a damaged save leaves it covered");
  for (const bad of [{ mode: "sideways" }, { mode: 7 }, { text: "x" }, null, [], { mode: null }]) { await load({ startMode: "off" }); storeData.camera_v1 = bad; await reload(); ok(covered(), "a save with no usable state falls back to where it starts: " + JSON.stringify(bad)); }
  await load(); storeData.camera_v1 = { mode: "brb", until: "soon", text: 5 }; await reload(); ok(covered() && sub() === "", "a countdown that is not a number is no countdown");
  storeData.camera_v1 = { mode: "brb", until: 1e30 }; await reload(); ok(covered() && sub() === "", "nor is an absurd one");
  storeData.camera_v1 = { mode: "cover", text: "y".repeat(500) }; await reload(); ok(text().length === 120, "and a saved message is held to its limit");
  storeData.camera_v1 = { mode: "off" }; await load({ startMode: "live" }, true); ok(covered(), "a saved cover beats where it would start");

  section("a refresh can never show the camera");
  env.storeLatency = 1000;
  storeData.camera_v1 = { mode: "off" };
  await load({}, true);
  ok(cover().classList.contains("holding") && covered() && text() === "", "the cover is up, and silent, while the saved state is still on its way");
  ok(!hold().classList.contains("done"), "and a layer over the whole box is up too, whatever shape the window has, so nothing can show while the layout settles");
  boss("!camera on"); ok(covered(), "and a command that arrives before it is known waits, and cannot uncover it");
  await wait(1100);
  ok(!cover().classList.contains("holding") && covered() && text() === "Camera off", "when it arrives, the cover says what it should (" + text() + ")");
  ok(hold().classList.contains("done"), "and the layer over the whole box comes down, leaving the cover in the window");
  storeData.camera_v1 = { mode: "live" }; await load({}, true); ok(covered(), "an uncovered camera is also held covered until it is known");
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

  section("waiting for the fonts too");
  // The plate's height, and so the window's size, depends on the fonts, so the cover waits for them as well as for the saved state.
  let fontsLoaded; env.document.fonts = { ready: new Promise(r => { fontsLoaded = r; }) };
  storeData.camera_v1 = { mode: "live" };
  await load({}, true); await wait(200);
  ok(covered() && !hold().classList.contains("done") && cover().classList.contains("holding"), "with the saved state known but the fonts still loading, the camera stays covered");
  fontsLoaded(); await wait(50); ok(!covered() && hold().classList.contains("done"), "and is shown once they have loaded");
  env.document.fonts = { ready: new Promise(() => {}) };
  storeData.camera_v1 = { mode: "live" };
  await load({}, true); await wait(2900); ok(covered(), "fonts that never load are waited for a while");
  await wait(200); ok(!covered() && hold().classList.contains("done"), "and then the saved state is used, so a font service that is down does not keep the camera covered for good");
  storeData.camera_v1 = { mode: "off" };
  await load({}, true); await wait(3100); ok(covered() && text() === "Camera off", "and a camera that was covered stays covered");
  env.document.fonts = null;

  section("it is always solid");
  const rgb = css => { const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(css) || /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(css); const h = css.charAt(0) === "#"; return "rgb(" + [1, 2, 3].map(i => h ? parseInt(m[i], 16) : m[i]).join(", ") + ")"; };
  let allSolid = true;
  for (const key of Object.keys(env.expectedPresets)) {
    await load({ themePreset: key });
    const v = env.vars("cam-root")["--cam-solid"];
    if (!/^rgb\(\d+, \d+, \d+\)$/.test(String(v)) || v !== rgb(env.expectedPresets[key].panel)) { allSolid = false; console.log("    not solid or not the panel colour for " + key + ": " + v); }
  }
  ok(allSolid, "in every one of the " + Object.keys(env.expectedPresets).length + " style presets the cover is the panel's colour with no transparency");
  await load({ themePreset: "custom", colorPanel: "#102030", panelOpacity: 0.1 });
  ok(env.vars("cam-root")["--cam-solid"] === "rgb(16, 32, 48)", "and in a custom colour, however see-through it is set (" + env.vars("cam-root")["--cam-solid"] + ")");
  await load({ themePreset: "custom", colorPanel: "nonsense" });
  ok(env.vars("cam-root")["--cam-solid"] === "rgb(0, 0, 0)", "a colour that is not one is black, which is still solid (" + env.vars("cam-root")["--cam-solid"] + ")");

  section("looks");
  await load({ coverSize: 12 }); ok(env.vars("cam-root")["--cam-cover"] === 12, "the cover's text size is a setting");
  await load({ coverSize: 999 }); ok(env.vars("cam-root")["--cam-cover"] === 30, "within limits");
  await load({ coverSize: 0 }); ok(env.vars("cam-root")["--cam-cover"] === 2, "both ways");
  await load({ radius: 10 }); ok(env.vars("cam-root")["--cam-radius"] === "10px", "the corner is a setting");
  await load({ shape: "circle" }); ok(env.vars("cam-root")["--cam-radius"] === "50%", "and it can be a circle, for a round camera");
  await load({ animate: false }); ok(E("cam-root").classList.contains("no-motion"), "Animate off stops motion");
  await load({ offText: "Hidden", offSub: "", offIcon: "" }); boss("!camera off");
  ok(text() === "Hidden" && sub() === "" && icon() === "", "a blank line or icon is left out (" + text() + ")");
  await load({ offText: "" }); boss("!camera off"); ok(covered() && text() === "", "even a blank message still covers the camera");
  await load({ brbIcon: "", awayIcon: "" }); boss("!camera brb"); ok(icon() === "", "icons can be left off");
  await env.checkPresets("cam-root");

  section("the frame round the window");
  const fill = () => env.vars("cam-root")["--cam-frame-fill"], ring = () => E("cam-root").classList.contains("no-frame");
  await load(); ok(!ring(), "the frame is on by default, since it is the edge of the window");
  await load({ showFrame: false }); ok(ring(), "and can be switched off in any preset");
  await load({ showFrame: true }); ok(!ring() && fill() === "var(--w-flag)" && env.vars("cam-root")["--cam-frame"] === 1.5, "a frame in the preset's colour, one and a half percent of the width (" + fill() + ")");
  await load({ showFrame: true, themePreset: "midnight" }); ok(env.vars("cam-root")["--w-flag"] === env.expectedPresets.midnight.accent, "which is the preset's accent");
  let flagged = 0, plain = 0;
  for (const key of Object.keys(env.expectedPresets)) {
    await load({ showFrame: true, themePreset: key });
    const flag = String(env.vars("cam-root")["--w-flag"]);
    if (env.expectedPresets[key].flag) { if (flag.indexOf("linear-gradient(180deg") === 0) flagged++; } else if (flag === env.expectedPresets[key].accent) plain++;
  }
  ok(flagged === 7 && plain === Object.keys(env.expectedPresets).length - 7, "a pride preset's frame is its flag and every other preset's is its accent (" + flagged + " flags, " + plain + " plain)");
  await load({ showFrame: true, frameStyle: "panel" }); ok(fill() === "rgb(0, 0, 0)", "the panel's colour can be used, made solid (" + fill() + ")");
  await load({ showFrame: true, frameStyle: "custom", colorFrame: "#FF8800" }); ok(fill() === "#FF8800", "or any colour you pick (" + fill() + ")");
  await load({ showFrame: true, frameStyle: "nonsense" }); ok(fill() === "var(--w-flag)", "a style that is not one of the choices is the preset's");
  await load({ showFrame: true, frameWidth: 99 }); ok(env.vars("cam-root")["--cam-frame"] === 10, "the thickness is held within limits");
  await load({ showFrame: true, frameWidth: 0 }); ok(env.vars("cam-root")["--cam-frame"] === 0.2, "both ways");
  await load({ showFrame: true, shape: "circle" }); ok(env.vars("cam-root")["--cam-radius"] === "50%", "a round camera gets a round frame");
  await load({ showFrame: true }); boss("!camera off"); ok(!ring() && covered(), "the frame stays while the camera is covered");
  boss("!camera on"); ok(!ring() && !covered(), "and while it is showing, which is when it is wanted");

  section("the window's shape");
  const locked = () => E("cam-root").classList.contains("locked"), ar = () => env.vars("cam-root")["--cam-ar"];
  await load(); ok(!locked() && ar() === "", "by default the window takes whatever room the nameplate leaves");
  for (const [setting, ratio] of [["16:9", "1.7778"], ["4:3", "1.3333"], ["3:2", "1.5"], ["1:1", "1"], ["9:16", "0.5625"]]) {
    await load({ aspect: setting }); ok(locked() && ar() === ratio, "a window of " + setting + " keeps that shape (" + ar() + ")");
  }
  await load({ aspect: "free" }); ok(!locked() && ar() === "", "free keeps none");
  await load({ aspect: "sideways" }); ok(!locked(), "and anything else is free");
  await load({ aspect: "1:1", shape: "circle" }); ok(locked() && env.vars("cam-root")["--cam-radius"] === "50%", "with a square shape and a circle, it is a true circle");
  await load({ aspect: "4:3", showFrame: true }); boss("!camera off"); ok(locked() && covered() && !E("cam-root").classList.contains("no-frame"), "the frame keeps the shape too, and the shape holds while it is covered");
  boss("!camera on"); ok(locked() && !covered(), "and while it is not");

  section("the nameplate");
  await load();
  ok(nameT() === "Your name" && tagline() === "Welcome in" && pron() === "", "it starts with a name and a line, and no pronouns (" + nameT() + ", " + tagline() + ")");
  ok(line() === "Thanks for being here", "and the first of its rotating lines (" + line() + ")");
  await load({ title: "Mina", pronouns: "she/her", tagline: "Cosy games and chat" });
  ok(nameT() === "Mina" && pron() === "she/her" && tagline() === "Cosy games and chat", "your name, your pronouns and your line are settings");
  await load({ title: "<b>Mina</b> & co", tagline: "<img src=x onerror=alert(1)>", pronouns: "<i>x</i>", lines: "<script>alert(1)</script>" });
  ok(nameT() === "<b>Mina</b> & co" && tagline() === "<img src=x onerror=alert(1)>" && pron() === "<i>x</i>" && line() === "<script>alert(1)</script>", "all of it is shown as typed, never as markup");
  await load(); boss("!camera off"); ok(nameT() === "Your name" && covered(), "the nameplate stays while the camera is covered");

  section("what a blank hides");
  await load({ title: "" }); ok(E("cam-name").hidden, "a blank name hides it");
  await load({ showTitle: false }); ok(E("cam-name").hidden, "or it can be switched off");
  await load({ tagline: "" }); ok(E("cam-tagline").hidden, "a blank line under the name hides it");
  await load({ showTagline: false }); ok(E("cam-tagline").hidden, "or it can be switched off");
  await load({ pronouns: "they/them", showPronouns: false }); ok(E("cam-pron").hidden, "pronouns can be switched off, and are never shown while blank");
  await load({ lines: "" }); ok(E("cam-lines").hidden, "no rotating lines shows none");
  await load({ lines: " | | " }); ok(E("cam-lines").hidden, "and a list of only separators is no lines");
  await load({ showLines: false }); ok(E("cam-lines").hidden, "or they can be switched off");
  await load({ title: "", tagline: "", lines: "", pronouns: "" }); ok(E("cam-name").hidden && E("cam-tagline").hidden && E("cam-lines").hidden && E("cam-pron").hidden, "and everything can be blank without breaking it");
  ok(app().hidden, "and then the plate itself is gone, so no empty card is left in front of the camera");
  await load({ title: "", tagline: "x", lines: "", pronouns: "" }); ok(!app().hidden, "while anything on it keeps it");

  section("pronouns");
  await load({ pronouns: "she/her" }); ok(pron() === "she/her" && E("cam-pron").className.indexOf("style-tag") !== -1, "a small tag by default (" + E("cam-pron").className + ")");
  await load({ pronouns: "she/her", pronounStyle: "brackets" }); ok(pron() === "(she/her)", "in brackets (" + pron() + ")");
  await load({ pronouns: "she/her", pronounStyle: "plain" }); ok(pron() === "she/her" && E("cam-pron").className.indexOf("style-plain") !== -1, "or plain");
  await load({ pronouns: "she/her", pronounStyle: "nonsense" }); ok(pron() === "she/her", "a style that is not one of the choices still shows them");

  section("lines that take turns");
  await load({ lines: "one | two | three", rotateSeconds: 5 });
  ok(lineEls().length === 3 && lineEls().filter(c => c.classList.contains("on")).length === 1, "every line is in the plate at once and one shows, so the plate is as tall as the tallest and never changes height, which would move the window the camera sits in");
  ok(line() === "one", "the first line shows first");
  await wait(4900); ok(line() === "one", "and stays its time");
  await wait(200); ok(line() === "two", "then the next takes its place (" + line() + ")");
  await wait(5000); ok(line() === "three", "in turn (" + line() + ")");
  await wait(5000); ok(line() === "one", "and round to the start again (" + line() + ")");
  await load({ lines: "only one", rotateSeconds: 2 }); await wait(10000); ok(line() === "only one", "a single line stays where it is");
  await load({ lines: "one | two", rotateSeconds: 2, showLines: false }); await wait(10000); ok(E("cam-lines").hidden, "switched off, nothing rotates");
  await load({ lines: "one | two", rotateSeconds: 0 }); await wait(1900); ok(line() === "one", "the shortest time is two seconds, however low it is set");
  await wait(200); ok(line() === "two", "(" + line() + ")");
  await load({ lines: "one | two", rotateSeconds: 99999 }); await wait(601000); ok(line() === "two", "and the longest is ten minutes");
  await load({ lines: "one | two | three", rotateSeconds: 5 }); await wait(5100);
  await load({ lines: "one | two | three", rotateSeconds: 5 }); ok(line() === "one", "a reload starts from the first line again");
  await wait(5100); ok(line() === "two", "and the old rotation is gone, so it does not run twice as fast (" + line() + ")");
  await load({ lines: "a|b|c|d|e|f", rotateSeconds: 2 }); ok(line() === "a" && lineEls().length === 6, "lines can be written with no spaces round the bar");
  await load({ lines: Array.from({ length: 50 }, (_, i) => "n" + i).join(" | "), rotateSeconds: 2 });
  ok(lineEls().length === 20, "no more than twenty take turns (" + lineEls().length + ")");
  await wait(2000 * 50); ok(line() === "n10", "so after fifty turns it is on the tenth, not back at the start, which fifty lines would be (" + line() + ")");
  await load({ rotateSeconds: 3 }); await wait(3000); await wait(400); ok(!lineEls()[0].classList.contains("on") && lineEls()[1].classList.contains("on"), "the lines hand over with a fade, and with Animate off it is simply a change");

  section("the nameplate's looks");
  await load(); ok(!app().classList.contains("align-left") && !app().classList.contains("align-right"), "in the middle by default");
  await load({ align: "left" }); ok(app().classList.contains("align-left") && !app().classList.contains("align-right"), "on the left");
  await load({ align: "right" }); ok(app().classList.contains("align-right") && !app().classList.contains("align-left"), "on the right");
  await load({ align: "sideways" }); ok(!app().classList.contains("align-left") && !app().classList.contains("align-right"), "and anything else is the middle");
  await load({ textSize: 7, titleScale: 2, rowGap: 0.5 });
  const v = env.vars("cam-root");
  ok(v["--cam-size"] === "7cqw" && v["--cam-title"] === 2 && v["--cam-gap"] === "0.5em", "the sizes are settings");
  await load({ titleScale: 99 }); ok(env.vars("cam-root")["--cam-title"] === 4, "within limits");
  await load(); ok(!E("cam-root").classList.contains("plate-above"), "the nameplate is below the window by default");
  await load({ platePosition: "above" }); ok(E("cam-root").classList.contains("plate-above"), "and can go above it");
  await load({ platePosition: "sideways" }); ok(!E("cam-root").classList.contains("plate-above"), "anything else is below");
  await load({ platePosition: "above", aspect: "16:9" }); ok(E("cam-root").classList.contains("plate-above") && E("cam-root").classList.contains("locked"), "it works with a window that keeps its shape");
  await load(); ok(env.vars("cam-root")["--w-bg"] === "rgba(0, 0, 0, 0.55)", "Soft black is the default");
  await load({ themePreset: "custom", radius: 10, borderWidth: 2, borderColor: "#FF0000", weight: 600, pad: 1, shadow: true });
  const w = env.vars("cam-root");
  ok(w["--w-radius"] === "10px" && w["--w-border"] === "2px solid #FF0000" && w["--w-weight"] === 600 && w["--w-pad"] === 1 && w["--w-shadow"] !== "none", "the corner, outline, boldness, padding and shadow follow the settings");

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
