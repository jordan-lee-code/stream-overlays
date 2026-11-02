/* Headless test for the socials bar overlay. Runs the real widget/widget.js against a small mock
   of the page and StreamElements, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, wait, E } = env;
const left = () => E("sb-left").children;
const right = () => E("sb-right").children;
const site = (n) => n.getAttribute("data-site");
const on = (list) => list.filter(i => i.classList.contains("on")).map(site);
const nameOf = (n) => (n.children[1] ? n.children[1].textContent : "");

(async () => {
  section("what is shown");
  await load({});
  ok(left().map(site).join() === "instagram,youtube,tiktok,twitter,bluesky", "instagram, youtube, tiktok, twitter and bluesky are on the left, in that order (" + left().map(site) + ")");
  ok(right().map(site).join() === "kofi", "ko-fi is on the right");
  ok(left().every(i => i.children[0].className === "sb-ico") && right()[0].children[0].className === "sb-ico", "each has its logo first, then the handle after it");
  ok(nameOf(left()[0]) === "@yourname" && nameOf(right()[0]) === "ko-fi.com/yourname", "the handle is shown beside the logo");
  await load({ twitch: "@me", discord: "me#1", facebook: "me", threads: "@me", mastodon: "@me@m.social", snapchat: "me", github: "me", kick: "me", reddit: "u/me", patreon: "patreon.com/me" });
  ok(left().length === 14 && right().length === 2, "the other sites join the left, and patreon joins ko-fi on the right (" + left().length + ", " + right().length + ")");
  ok(right().map(site).join() === "kofi,patreon", "ko-fi comes first on the right");
  await load({ instagram: "", youtube: "", tiktok: "", twitter: "", bluesky: "" });
  ok(left().length === 0 && right().length === 1, "a blank handle hides that site");
  await load({ instagram: "  @spaced  " }); ok(nameOf(left()[0]) === "@spaced", "spaces round a handle are trimmed");
  await load({ instagram: "<b>hi</b>" }); ok(nameOf(left()[0]) === "<b>hi</b>", "a handle is shown as typed, never as markup");
  await load({ instagram: "", youtube: "", tiktok: "", twitter: "", bluesky: "", kofi: "" });
  ok(E("sb-root").hidden === true, "with nothing to show the whole widget goes");
  await load({}); ok(E("sb-root").hidden === false, "and comes back when there is");
  await load({}); await load({});
  ok(left().length === 5 && right().length === 1, "loading again does not pile them up");

  section("logos on their own");
  await load({ showNames: false });
  ok(left().every(i => i.children.length === 1) && right()[0].children.length === 1, "with the handles off there is only the logo");
  ok(/Instagram: @yourname/.test(left()[0].getAttribute("aria-label")), "and it is still described for a screen reader");

  section("rotating the left side");
  await load({});
  ok(E("sb-left").classList.contains("rotating"), "the left side rotates by default");
  ok(on(left()).join() === "instagram", "starting with the first (" + on(left()) + ")");
  await wait(4000); ok(on(left()).join() === "youtube", "after four seconds the next fades in, and only that one (" + on(left()) + ")");
  await wait(4000); ok(on(left()).join() === "tiktok", "then the next (" + on(left()) + ")");
  await wait(4000 * 3); ok(on(left()).join() === "instagram", "and round to the start again (" + on(left()) + ")");
  await load({ rotateSeconds: 10 }); await wait(9000); ok(on(left()).join() === "instagram", "the seconds are a setting");
  await wait(1500); ok(on(left()).join() === "youtube", "(still on the first at nine, on the next after ten)");
  await load({ rotateSeconds: 0 }); await wait(1000); ok(on(left()).join() === "youtube", "never faster than a second");
  await load({}); await load({}); await wait(4000); ok(on(left()).join() === "youtube", "loading again does not start a second timer, which would make it hurry");
  await load({ rotate: false });
  ok(!E("sb-left").classList.contains("rotating") && on(left()).length === 5, "with Rotate off they are all shown side by side");
  await wait(20000); ok(on(left()).length === 5, "and stay that way");
  await load({ instagram: "", youtube: "", tiktok: "", twitter: "" });
  ok(!E("sb-left").classList.contains("rotating") && on(left()).join() === "bluesky", "one site on the left just stays, with no rotation");
  await wait(20000); ok(on(left()).join() === "bluesky", "and does not fade out");
  await load({ fadeSeconds: 1.5 }); ok(env.vars("sb-app")["--sb-fade"] === "1.5s", "the fade time is a setting");
  await load({ fadeSeconds: 99 }); ok(env.vars("sb-app")["--sb-fade"] === "3s", "within limits");
  const css = require("fs").readFileSync(require("path").join(__dirname, "../widget/widget.css"), "utf8");
  ok(/\.sb-left\.rotating \.sb-item\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity/.test(css), "the others are faded out by a transition on opacity, so it is a fade and not a jump");
  ok(/\.sb-left\.rotating\s*\{[^}]*display:\s*grid/.test(css) && /grid-area:\s*1 \/ 1/.test(css), "all the sites share one cell, so the bar does not change width as they change");

  section("spreading across the box");
  await load({ rotate: false });
  ok(E("sb-left").classList.contains("spread"), "side by side, the sites spread across the width, so the gaps follow the box");
  await load({ rotate: false, spread: false }); ok(!E("sb-left").classList.contains("spread"), "or can stay close together on the left");
  await load({}); ok(!E("sb-left").classList.contains("spread"), "rotating, there is one at a time and nothing to spread");
  await load({ rotate: false }); await load({}); ok(!E("sb-left").classList.contains("spread"), "going back to rotating leaves nothing behind");
  ok(/\.sb-left\.spread\s*\{[^}]*flex:\s*1 1 0[^}]*justify-content:\s*space-between/.test(css), "the left side takes the room that is left and divides it between the sites");
  ok(/#sb-app\s*\{[^}]*column-gap:\s*calc\(var\(--sb-gap[^}]*--sb-squeeze/.test(css) && /\.sb-side\s*\{[^}]*column-gap:\s*calc\(var\(--sb-gap[^}]*--sb-squeeze/.test(css), "the gaps, between the sites and between the two sides, close up together when the bar is squeezed");

  section("squeezing into a small box");
  // The mock has no layout, so the sides are given rectangles that say whether the bar would wrap at the current gaps and size.
  const stub = (wraps) => {
    E("sb-left").getBoundingClientRect = () => ({ top: 0, bottom: 10 });
    E("sb-right").getBoundingClientRect = () => (wraps(env.vars("sb-app")) ? { top: 20, bottom: 30 } : { top: 0, bottom: 10 });
    E("sb-app").getBoundingClientRect = () => ({ top: 0, bottom: 10 });
  };
  stub(() => false); await load({});
  ok(env.vars("sb-app")["--sb-squeeze"] === 1 && env.vars("sb-app")["--sb-shrink"] === 1, "with room to spare nothing is squeezed or shrunk");
  stub(v => v["--sb-squeeze"] > 0.6); await load({});
  ok(env.vars("sb-app")["--sb-squeeze"] === 0.6 && env.vars("sb-app")["--sb-shrink"] === 1, "a little short of room, the gaps close up first and the size is left alone (" + env.vars("sb-app")["--sb-squeeze"] + ")");
  stub(v => v["--sb-shrink"] > 0.5); await load({});
  ok(env.vars("sb-app")["--sb-squeeze"] === 0.2, "short of room, the gaps close up as far as they go");
  ok(env.vars("sb-app")["--sb-shrink"] <= 0.5 && env.vars("sb-app")["--sb-shrink"] > 0.49, "and then the whole bar shrinks just far enough to stay on one line (" + env.vars("sb-app")["--sb-shrink"] + ")");
  await load({ fit: false }); ok(env.vars("sb-app")["--sb-shrink"] === 1, "with Shrink to fit off it keeps its size, and wraps");
  stub(() => true); await load({});
  ok(env.vars("sb-app")["--sb-shrink"] === 0.2, "it never shrinks past a fifth");
  stub(() => false); await load({}); ok(env.vars("sb-app")["--sb-shrink"] === 1 && env.vars("sb-app")["--sb-squeeze"] === 1, "and when there is room again it returns to full size");
  ok(/font-size:\s*calc\(var\(--sb-size[^;]*--sb-shrink/.test(css), "the size is the text size times the shrink");

  section("the look");
  await load({ textSize: 2, iconScale: 2, gap: 3 });
  let a = env.vars("sb-app");
  ok(a["--sb-size"] === "2cqw" && a["--sb-icon"] === 2 && a["--sb-gap"] === 3, "the text, logo and gap sizes are settings");
  await load({ textSize: -1, iconScale: 99, gap: 0 });
  a = env.vars("sb-app");
  ok(a["--sb-size"] === "0.5cqw" && a["--sb-icon"] === 4 && a["--sb-gap"] === 0.2, "within limits");
  const cls = () => E("sb-app").classList;
  await load({}); ok(!cls().contains("ic-text") && !cls().contains("ic-brand"), "logos take the accent colour by default");
  await load({ iconColor: "text" }); ok(cls().contains("ic-text"), "or the text colour");
  await load({ iconColor: "brand" }); ok(cls().contains("ic-brand") && !cls().contains("ic-text"), "or each site's own colour");
  await load({ iconColor: "pink" }); ok(!cls().contains("ic-text") && !cls().contains("ic-brand"), "an unknown choice is the accent");
  await load({ iconColor: "brand" }); await load({}); ok(!cls().contains("ic-brand"), "going back leaves nothing behind");
  ok(/flex-wrap:\s*wrap/.test(css), "when there are too many for the width they wrap onto a second row");
  ok(/margin-left:\s*auto/.test(css), "ko-fi stays on the right even when the left is short");
  await load({ animate: false }); ok(E("sb-root").classList.contains("no-motion"), "Animate off stops motion");
  await env.checkPresets("sb-app");
  await env.checkFrame("sb-app");
  await env.checkDecor("sb-app");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
