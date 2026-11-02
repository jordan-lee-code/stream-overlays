/* Headless test for the local time overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, wait, E } = env;
const at = (y, mo, d, h, mi, s) => { env.fake = Date.UTC(y, mo - 1, d, h, mi, s || 0); };
const digits = () => E("lt-digits").textContent;
const ampm = () => E("lt-ampm").hidden ? "" : E("lt-ampm").textContent;
const label = () => E("lt-label").hidden ? "" : E("lt-label").textContent;
const date = () => E("lt-date").hidden ? "" : E("lt-date").textContent;
const WINTER = [2026, 1, 15, 15, 7, 9], SUMMER = [2026, 7, 1, 12, 0, 0];

(async () => {
  section("the time and the line above it");
  at(...WINTER);
  await load({ timezone: "Europe/London" });
  ok(digits() === "15:07:09", "the time is shown in the timezone chosen (" + digits() + ")");
  ok(label() === "Local timezone: GMT", "with the line above it, as asked: Local timezone: GMT (" + label() + ")");
  at(...SUMMER); await load({ timezone: "Europe/London" });
  ok(digits() === "13:00:00" && label() === "Local timezone: BST", "in summer London is an hour on, and says BST (" + digits() + ", " + label() + ")");
  at(...WINTER); await load({ timezone: "Etc/GMT" });
  ok(digits() === "15:07:09" && label() === "Local timezone: GMT", "GMT stays GMT all year (" + label() + ")");
  await load({ timezone: "UTC" }); ok(label() === "Local timezone: UTC", "and UTC says UTC (" + label() + ")");
  await load({ timezone: "America/New_York" });
  ok(digits() === "10:07:09" && label() === "Local timezone: EST", "New York is five hours behind, and says EST (" + digits() + ", " + label() + ")");
  at(...SUMMER); await load({ timezone: "America/New_York" });
  ok(digits() === "08:00:00" && label() === "Local timezone: EDT", "and EDT in summer (" + digits() + ", " + label() + ")");
  at(...WINTER); await load({ timezone: "Asia/Kolkata" });
  ok(digits() === "20:37:09" && /^Local timezone: (IST|GMT\+5:30)$/.test(label()), "a half hour offset is shown properly (" + digits() + ", " + label() + ")");
  await load({ timezone: "Asia/Tokyo" });
  ok(digits() === "00:07:09" && /^Local timezone: (JST|GMT\+9)$/.test(label()), "and so is the next day (" + digits() + ", " + label() + ")");

  section("zones that do not work");
  await load({ timezone: "Europe/London", ownZone: "Asia/Tokyo" }); ok(digits() === "00:07:09", "a zone typed in wins over the list (" + digits() + ")");
  await load({ timezone: "Europe/London", ownZone: "Mars/Olympus" }); ok(digits() === "15:07:09", "a typed zone that does not exist is ignored, and the list is used (" + digits() + ")");
  await load({ timezone: "Mars/Olympus", ownZone: "" }); ok(/^\d\d:\d\d:\d\d$/.test(digits()) && /^Local timezone: .+/.test(label()), "a list value that does not exist falls back to this computer's time (" + digits() + ", " + label() + ")");
  await load({ timezone: "device" }); ok(/^\d\d:\d\d:\d\d$/.test(digits()), "this computer's own timezone is the default");
  await load({ ownZone: "  Asia/Tokyo  " }); ok(digits() === "00:07:09", "a name with spaces round it does not break it (" + digits() + ")");

  section("12-hour and 24-hour");
  await load({ timezone: "Europe/London", hour24: false });
  ok(digits() === "3:07:09" && ampm() === "PM", "12-hour has no leading zero, and says PM (" + digits() + ", " + ampm() + ")");
  at(2026, 1, 15, 0, 5, 0); await load({ timezone: "Europe/London", hour24: false });
  ok(digits() === "12:05:00" && ampm() === "AM", "just after midnight is 12:05 AM (" + digits() + ", " + ampm() + ")");
  await load({ timezone: "Europe/London", hour24: true });
  ok(digits() === "00:05:00" && ampm() === "", "and 00:05 in 24-hour, never 24:05, with no AM or PM (" + digits() + ")");
  at(2026, 1, 15, 12, 0, 0); await load({ timezone: "Europe/London", hour24: false });
  ok(digits() === "12:00:00" && ampm() === "PM", "noon is 12 PM (" + digits() + ", " + ampm() + ")");
  at(...WINTER); await load({ timezone: "Europe/London", showSeconds: false });
  ok(digits() === "15:07", "the seconds can be left off (" + digits() + ")");

  section("the date");
  await load({ timezone: "Europe/London" }); ok(date() === "", "no date unless asked for");
  await load({ timezone: "Europe/London", showDate: true }); ok(date() === "Thursday 15 January", "the day and date can go under the time (" + date() + ")");
  await load({ timezone: "Asia/Tokyo", showDate: true }); ok(date() === "Friday 16 January", "in the chosen timezone, so it can be a day ahead (" + date() + ")");

  section("the wording");
  await load({ timezone: "America/New_York", labelText: "Time in {city} ({offset})" });
  ok(label() === "Time in New York (GMT-5)", "the line can say anything, with the place and the offset (" + label() + ")");
  await load({ timezone: "Europe/London", labelText: "{zone} {zone}" }); ok(label() === "GMT GMT", "a name can be used more than once");
  await load({ timezone: "Europe/London", labelText: "Hello" }); ok(label() === "Hello", "and with none of them it is just the words");
  await load({ timezone: "Europe/London", labelText: "" }); ok(label() === "" && E("lt-label").hidden, "a blank line is hidden");
  await load({ timezone: "Europe/London", showLabel: false }); ok(label() === "" && E("lt-label").hidden, "or can be switched off");
  await load({ timezone: "Europe/London" }); ok(label() === "Local timezone: GMT", "and is there by default");
  await load({ timezone: "Europe/London", labelText: "<b>{zone}</b>" }); ok(label() === "<b>GMT</b>", "it is shown as typed, never as markup");

  section("keeping time");
  await load({ timezone: "Europe/London" }); await env.advance(1000); ok(digits() === "15:07:10", "it follows the clock (" + digits() + ")");
  await env.advance(51000); ok(digits() === "15:08:01", "through the minute (" + digits() + ")");
  at(2026, 3, 29, 0, 59, 58); await load({ timezone: "Europe/London" });
  ok(digits() === "00:59:58" && label() === "Local timezone: GMT", "before the clocks go forward it says GMT (" + digits() + ", " + label() + ")");
  await env.advance(3000);
  ok(digits() === "02:00:01" && label() === "Local timezone: BST", "and after, an hour on and BST, without a reload (" + digits() + ", " + label() + ")");

  section("sizes");
  await load({ textSize: 6, labelScale: 1.2, timeScale: 4, dateScale: 0.8 });
  const v = env.vars("lt-app");
  ok(v["--lt-size"] === "6cqw" && v["--lt-label"] === 1.2 && v["--lt-time"] === 4 && v["--lt-date"] === 0.8, "the sizes are settings");
  await load({ textSize: -3, labelScale: 99, timeScale: 99, dateScale: 0 });
  ok(env.vars("lt-app")["--lt-size"] === "1cqw" && env.vars("lt-app")["--lt-label"] === 3 && env.vars("lt-app")["--lt-time"] === 8 && env.vars("lt-app")["--lt-date"] === 0.3, "within limits");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/tabular-nums/.test(css) && /white-space:\s*nowrap/.test(css), "the digits are a fixed width and stay on one line");

  section("looks");
  await load({ animate: false }); ok(E("lt-root").classList.contains("no-motion"), "Animate off stops motion");
  await env.checkPresets("lt-app");
  await env.checkFrame("lt-app");
  await env.checkDecor("lt-app");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
