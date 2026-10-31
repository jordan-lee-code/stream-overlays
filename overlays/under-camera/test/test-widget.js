/* Headless test for the under camera nameplate. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, wait, E } = env;

const name = () => E("uc-name").hidden ? "" : E("uc-name").textContent;
const pron = () => E("uc-pron").hidden ? "" : E("uc-pron").textContent;
const tagline = () => E("uc-tagline").hidden ? "" : E("uc-tagline").textContent;
const line = () => E("uc-line").hidden ? "" : E("uc-line").textContent;
const app = () => E("uc-app");

(async () => {
  section("the plate");
  await load();
  ok(name() === "Your name" && tagline() === "Welcome in" && pron() === "", "it starts with a name and a line, and no pronouns (" + name() + ", " + tagline() + ")");
  ok(line() === "Thanks for being here", "and the first of its rotating lines (" + line() + ")");
  await load({ title: "Mina", pronouns: "she/her", tagline: "Cosy games and chat" });
  ok(name() === "Mina" && pron() === "she/her" && tagline() === "Cosy games and chat", "your name, your pronouns and your line are settings (" + name() + ", " + pron() + ")");
  await load({ title: "<b>Mina</b> & co", tagline: "<img src=x onerror=alert(1)>", pronouns: "<i>x</i>", lines: "<script>alert(1)</script>" });
  ok(name() === "<b>Mina</b> & co" && tagline() === "<img src=x onerror=alert(1)>" && pron() === "<i>x</i>" && line() === "<script>alert(1)</script>", "all of it is shown as typed, never as markup");

  section("what a blank hides");
  await load({ title: "" }); ok(E("uc-name").hidden, "a blank name hides it");
  await load({ showTitle: false }); ok(E("uc-name").hidden, "or it can be switched off");
  await load({ tagline: "" }); ok(E("uc-tagline").hidden, "a blank line under the name hides it");
  await load({ showTagline: false }); ok(E("uc-tagline").hidden, "or it can be switched off");
  await load({ pronouns: "they/them", showPronouns: false }); ok(E("uc-pron").hidden, "pronouns can be switched off, and are never shown while blank");
  await load({ lines: "" }); ok(E("uc-line").hidden, "no rotating lines shows none");
  await load({ lines: " | | " }); ok(E("uc-line").hidden, "and a list of only separators is no lines");
  await load({ showLines: false }); ok(E("uc-line").hidden, "or they can be switched off");
  await load({ title: "", tagline: "", lines: "", pronouns: "" }); ok(E("uc-name").hidden && E("uc-tagline").hidden && E("uc-line").hidden && E("uc-pron").hidden, "and everything can be blank without breaking it");

  section("pronouns");
  await load({ pronouns: "she/her" }); ok(pron() === "she/her" && E("uc-pron").className.indexOf("style-tag") !== -1, "a small tag by default (" + E("uc-pron").className + ")");
  await load({ pronouns: "she/her", pronounStyle: "brackets" }); ok(pron() === "(she/her)", "in brackets (" + pron() + ")");
  await load({ pronouns: "she/her", pronounStyle: "plain" }); ok(pron() === "she/her" && E("uc-pron").className.indexOf("style-plain") !== -1, "or plain");
  await load({ pronouns: "she/her", pronounStyle: "nonsense" }); ok(pron() === "she/her", "a style that is not one of the choices still shows them");

  section("lines that take turns");
  await load({ lines: "one | two | three", rotateSeconds: 5, animate: false });
  ok(line() === "one", "the first line shows first");
  await wait(4900); ok(line() === "one", "and stays its time");
  await wait(200); ok(line() === "two", "then the next takes its place (" + line() + ")");
  await wait(5000); ok(line() === "three", "in turn (" + line() + ")");
  await wait(5000); ok(line() === "one", "and round to the start again (" + line() + ")");
  await load({ lines: "only one", rotateSeconds: 2, animate: false }); await wait(10000); ok(line() === "only one", "a single line stays where it is");
  await load({ lines: "one | two", rotateSeconds: 2, animate: false, showLines: false }); await wait(10000); ok(E("uc-line").hidden, "switched off, nothing rotates");
  await load({ lines: "one | two", rotateSeconds: 0, animate: false }); await wait(1900); ok(line() === "one", "the shortest time is two seconds, however low it is set");
  await wait(200); ok(line() === "two", "(" + line() + ")");
  await load({ lines: "one | two", rotateSeconds: 99999, animate: false }); await wait(601000); ok(line() === "two", "and the longest is ten minutes");
  await load({ lines: "one | two | three", rotateSeconds: 5, animate: false }); await wait(5100);
  await load({ lines: "one | two | three", rotateSeconds: 5, animate: false }); ok(line() === "one", "a reload starts from the first line again");
  await wait(5100); ok(line() === "two", "and the old rotation is gone, so it does not run twice as fast (" + line() + ")");
  await load({ lines: "a|b|c|d|e|f", rotateSeconds: 2, animate: false });
  ok(line() === "a", "lines can be written with no spaces round the bar");
  await load({ lines: Array.from({ length: 50 }, (_, i) => "n" + i).join(" | "), rotateSeconds: 2, animate: false });
  await wait(2000 * 50); ok(line() === "n10", "no more than twenty take turns: after fifty turns it is on the tenth, not back at the start, which fifty lines would be (" + line() + ")");

  section("with motion");
  await load({ lines: "one | two", rotateSeconds: 3 });
  await wait(3000); ok(E("uc-line").classList.contains("swap") && line() === "one", "a line fades out first, and keeps its words while it does");
  await wait(400); ok(line() === "two" && !E("uc-line").classList.contains("swap"), "then the next fades in (" + line() + ")");
  await load({ lines: "one | two", rotateSeconds: 3, animate: false }); await wait(3100); ok(line() === "two" && !E("uc-line").classList.contains("swap"), "and with Animate off it simply changes");
  ok(E("uc-root").classList.contains("no-motion"), "Animate off stops motion");

  section("looks");
  await load(); ok(!app().classList.contains("align-left") && !app().classList.contains("align-right"), "in the middle by default");
  await load({ align: "left" }); ok(app().classList.contains("align-left") && !app().classList.contains("align-right"), "on the left");
  await load({ align: "right" }); ok(app().classList.contains("align-right") && !app().classList.contains("align-left"), "on the right");
  await load({ align: "sideways" }); ok(!app().classList.contains("align-left") && !app().classList.contains("align-right"), "and anything else is the middle");
  await load({ textSize: 7, titleScale: 2, rowGap: 0.5 });
  const v = env.vars("uc-app");
  ok(v["--uc-size"] === "7cqw" && v["--uc-title"] === 2 && v["--uc-gap"] === "0.5em", "the sizes are settings");
  await load({ titleScale: 99 }); ok(env.vars("uc-app")["--uc-title"] === 4, "within limits");
  await load(); ok(env.vars("uc-app")["--w-bg"] === "rgba(0, 0, 0, 0.55)", "Soft black is the default");
  await load({ themePreset: "custom", radius: 10, borderWidth: 2, borderColor: "#FF0000", weight: 600, pad: 1, shadow: true });
  const w = env.vars("uc-app");
  ok(w["--w-radius"] === "10px" && w["--w-border"] === "2px solid #FF0000" && w["--w-weight"] === 600 && w["--w-pad"] === 1 && w["--w-shadow"] !== "none", "the corner, outline, boldness, padding and shadow follow the settings");
  await env.checkPresets("uc-app");

  section("odd input never breaks it");
  await load({ lines: 5, title: 7, tagline: null, pronouns: undefined, rotateSeconds: "soon", textSize: "big" });
  ok(name() === "7" && line() === "5", "settings of the wrong type are read as text or fall back to the usual (" + name() + ", " + line() + ")");
  env.ev("message", {}); env.ev("nonsense", null); env.ev("widget-button", { field: "x" });
  ok(name() === "7", "and events it has no use for are ignored");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
