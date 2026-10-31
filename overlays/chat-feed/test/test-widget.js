/* Headless test for the chat feed. Runs the real widget/widget.js against a small mock of the
   page, StreamElements and the network, with a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, load, boss, chat, button, wait, E, storeData, audioLog } = env;

const CDN = "https://static-cdn.jtvnw.net/jtv_user_pictures/abc-profile_image-300x300.png";
// What the real services answer: an avatar address as plain text, a list of pronouns, and a
// user as a list holding their one record (or nothing).
const LIST = [{ display: "He/Him", name: "hehim" }, { display: "She/Her", name: "sheher" }, { display: "They/Them", name: "theythem" }];
function services(users, avatars) {
  env.net(url => {
    let m = /decapi\.me\/twitch\/avatar\/(.+)$/.exec(url);
    if (m) return { text: avatars && avatars[m[1]] !== undefined ? avatars[m[1]] : "User not found: " + m[1] };
    if (/alejo\.io\/api\/pronouns$/.test(url)) return { json: LIST };
    m = /alejo\.io\/api\/users\/(.+)$/.exec(url);
    if (m) return { json: users && users[m[1]] ? [{ id: "1", login: m[1], pronoun_id: users[m[1]] }] : [] };
    throw new Error("unexpected " + url);
  });
}
const say = (text, o) => {
  o = o || {};
  const nick = (o.nick || "alice").toLowerCase();
  env.ev("message", { data: Object.assign({ text, nick, displayName: o.name || nick.charAt(0).toUpperCase() + nick.slice(1), userId: o.userId || "u-" + nick, msgId: o.msgId || "m-" + Math.random().toString(36).slice(2), badges: o.badges || [], tags: { mod: o.mod ? "1" : "0", color: o.color || "" }, emotes: o.emotes || [], isAction: !!o.action }, o.extra || {}) });
};
const rowEls = () => E("cf-list").children;
const part = (li, cls) => { const f = n => { if ((n.className || "").split(" ").indexOf(cls) !== -1) return n; for (const c of n.children) { const r = f(c); if (r) return r; } return null; }; return f(li); };
const names = () => rowEls().map(li => part(li, "cf-name").textContent);
const texts = () => rowEls().map(li => part(li, "cf-text").children.map(c => c.tagName === "img" ? "[" + c.alt + "]" : c.textContent).join(""));
const pron = li => { const p = part(li, "cf-pron"); return !p || p.hidden ? "" : p.textContent; };
const avatarImg = li => { const a = part(li, "cf-avatar"); return a && a.children.find(c => c.tagName === "img"); };
const skip = async ms => { env.fake += ms; await wait(700); };
// Waits, for up to a couple of seconds, until something becomes true.
const until = async (test, ms) => { for (let i = 0; i < (ms || 2000) / 25 && !test(); i++) await wait(25); return test(); };

(async () => {
  section("what appears");
  services({});
  await load();
  ok(rowEls().length === 0 && E("cf-title").hidden, "starts empty, with the title off by default");
  say("Hello there", { nick: "alice", name: "Alice" });
  ok(names().join() === "Alice" && texts().join() === "Hello there", "a message shows its name and text (" + names() + ": " + texts() + ")");
  say("second", { nick: "bram", name: "Bram" }); say("third", { nick: "cass", name: "Cass" });
  ok(names().join() === "Alice,Bram,Cass", "newest at the bottom, older ones above (" + names() + ")");
  say("", { nick: "dev" }); say("   ", { nick: "dev" });
  ok(rowEls().length === 3, "empty messages add nothing");
  say("a <b>bold</b> & \"quoted\" line", { nick: "eli", name: "Eli" });
  ok(texts()[3] === "a <b>bold</b> & \"quoted\" line", "text is shown exactly as typed, never as markup (" + texts()[3] + ")");
  ok(rowEls()[0].className.indexOf("new") !== -1, "a new message animates in");
  await load({ animate: false }); say("x", { nick: "alice" }); ok(rowEls()[0].className.indexOf("new") === -1, "and not when Animate is off");

  section("order and length");
  await load({ maxMessages: 3 });
  for (const n of ["a", "b", "c", "d", "e"]) say("hi " + n, { nick: n, name: n.toUpperCase() });
  ok(names().join() === "C,D,E", "only as many as asked for, the oldest dropped (" + names() + ")");
  await load({ maxMessages: 3, order: "top" });
  for (const n of ["a", "b", "c", "d"]) say("hi " + n, { nick: n, name: n.toUpperCase() });
  ok(names().join() === "D,C,B" && E("cf-app").classList.contains("newest-top"), "or newest at the top (" + names() + ")");
  await load({ maxMessages: 999 }); for (let i = 0; i < 40; i++) say("m" + i, { nick: "u" + (i % 5) });
  ok(rowEls().length === 30, "never more than thirty (" + rowEls().length + ")");

  section("fading away");
  await load({ fadeAfter: 10, animate: false });
  say("old", { nick: "alice" }); await skip(8000); say("newer", { nick: "bram" }); await skip(4000);
  ok(texts().join() === "newer", "a message goes after its time, the newer one stays (" + texts().join() + ")");
  await load({ fadeAfter: 10 });
  say("soft", { nick: "alice" }); env.fake += 11000;
  ok(await until(() => rowEls().length === 1 && rowEls()[0].classList.contains("fading")), "with motion on it fades first (" + rowEls().length + ")");
  ok(await until(() => rowEls().length === 0), "and is then removed");
  await load({ fadeAfter: 0 }); say("stays", { nick: "alice" }); await skip(3600000);
  ok(rowEls().length === 1, "0 keeps a message until it is pushed off");

  section("what is left out");
  await load();
  say("!so someone", { nick: "alice" }); say("!uptime", { nick: "bram" });
  ok(rowEls().length === 0, "chat commands are not shown");
  await load({ hideCommands: false }); say("!so someone", { nick: "alice" }); ok(rowEls().length === 1, "unless that is switched off");
  await load(); say("hi", { nick: "Nightbot" }); say("hi", { nick: "streamelements" }); say("hi", { nick: "alice" });
  ok(names().join() === "Alice", "the usual bots are ignored (" + names() + ")");
  await load({ ignoreNames: " @Alice , bram" }); say("a", { nick: "alice" }); say("b", { nick: "bram" }); say("c", { nick: "cass", name: "Cass" });
  ok(names().join() === "Cass", "and the list is a setting, with or without an @ (" + names() + ")");

  section("emotes and badges");
  await load();
  const urls = n => ({ "1": "https://cdn.example/e" + n + "/1", "2": "https://cdn.example/e" + n + "/2", "4": "https://cdn.example/e" + n + "/4" });
  say("hi Kappa there", { nick: "alice", emotes: [{ type: "twitch", name: "Kappa", id: "25", start: 3, end: 7, urls: urls(25) }] });
  ok(texts()[0] === "hi [Kappa] there", "an emote is a picture in the right place (" + texts()[0] + ")");
  ok(part(rowEls()[0], "cf-emote").src === "https://cdn.example/e25/2", "using the middle size");
  say("A B", { nick: "alice", emotes: [{ name: "B", start: 2, end: 2, urls: urls(2) }, { name: "A", start: 0, end: 0, urls: urls(1) }] });
  ok(texts()[1] === "[A] [B]", "emotes given out of order still land correctly (" + texts()[1] + ")");
  say("overlap", { nick: "alice", emotes: [{ name: "x", start: 0, end: 3, urls: urls(3) }, { name: "y", start: 2, end: 5, urls: urls(4) }] });
  ok(texts()[2] === "[x]lap", "an overlapping emote is ignored, not doubled (" + texts()[2] + ")");
  say("bad", { nick: "alice", emotes: [{ name: "z", start: 1, end: 99, urls: urls(5) }, { name: "q", start: 0, end: 1, urls: { "2": "javascript:alert(1)" } }, null, { name: "n" }] });
  ok(texts()[3] === "bad", "an emote that does not fit, or has an unsafe address, stays as text (" + texts()[3] + ")");
  await load({ showEmotes: false }); say("hi Kappa", { nick: "alice", emotes: [{ name: "Kappa", start: 3, end: 7, urls: urls(25) }] });
  ok(texts()[0] === "hi Kappa", "emotes can be left as words");
  await load();
  say("b", { nick: "alice", badges: [{ type: "moderator", url: "https://cdn.example/mod.png", description: "Moderator" }, { type: "x", url: "http://insecure/x.png" }, { type: "vip" }] });
  const bs = part(rowEls()[0], "cf-badges");
  ok(bs && bs.children.length === 1 && bs.children[0].src === "https://cdn.example/mod.png", "badges show, but only ones on a secure address");
  await load({ showBadges: false }); say("b", { nick: "alice", badges: [{ type: "moderator", url: "https://cdn.example/mod.png" }] });
  ok(!part(rowEls()[0], "cf-badges"), "and can be switched off");
  await load(); say("waves", { nick: "alice", action: true }); ok(rowEls()[0].className.indexOf("action") !== -1, "/me messages are marked");

  section("avatars");
  services({}, { alice: CDN });
  await load();
  say("hi", { nick: "alice" }); await wait(20);
  ok(env.fetchLog.indexOf("https://decapi.me/twitch/avatar/alice") !== -1, "a first message looks the chatter up");
  ok(avatarImg(rowEls()[0]) && avatarImg(rowEls()[0]).src === CDN, "and shows the picture it finds");
  ok(part(rowEls()[0], "cf-initial").textContent === "A", "with their initial underneath until then");
  env.fetchLog.length = 0; say("again", { nick: "alice" }); await wait(20);
  ok(env.fetchLog.length === 0 && avatarImg(rowEls()[1]) && avatarImg(rowEls()[1]).src === CDN, "they are not asked about again (" + env.fetchLog.length + " requests)");
  say("who", { nick: "nobody" }); await wait(20);
  ok(avatarImg(rowEls()[2]) === undefined && part(rowEls()[2], "cf-initial").textContent === "N", "someone with no picture keeps their initial");
  env.fetchLog.length = 0; say("again", { nick: "nobody" }); await wait(20);
  ok(env.fetchLog.length === 0, "and a miss is not retried straight away");
  await skip(11 * 60 * 1000); env.fetchLog.length = 0; say("later", { nick: "nobody" }); await wait(20);
  ok(env.fetchLog.some(u => /avatar\/nobody/.test(u)), "but is, after ten minutes");
  services({}, { evil: "https://evil.example/x.png", sneaky: "https://static-cdn.jtvnw.net.evil.example/x.png", script: "javascript:alert(1)", html: "<img src=x onerror=alert(1)>" });
  await load();
  for (const n of ["evil", "sneaky", "script", "html"]) say("hi", { nick: n });
  await wait(20);
  ok(rowEls().every(li => !avatarImg(li)), "only an address on Twitch's own image host is ever used");
  services({}, {});
  await load();
  say("a", { nick: "w1" }); say("b", { nick: "w1" }); say("c", { nick: "w1" }); await wait(20);
  ok(env.fetchLog.filter(u => /avatar\/w1/.test(u)).length === 1, "several messages at once make one request");
  env.net(() => { throw new Error("offline"); });
  await load(); say("hi", { nick: "alice" }); await wait(20);
  ok(rowEls().length === 1 && !avatarImg(rowEls()[0]), "with the service down the message still shows");
  services({}, { alice: CDN });
  await load();
  env.fetchLog.length = 0;
  for (const n of ["Bad Name", "a-b", "x".repeat(26), "../etc", "a/b", "a?b=c"]) say("hi", { nick: n, name: "Odd" });
  env.ev("message", { data: { text: "no login at all", displayName: "Odd" } });
  await wait(20);
  ok(env.fetchLog.length === 0, "a login that is not a real Twitch login is never sent anywhere (" + env.fetchLog.join() + ")");
  await load({ showAvatars: false }); env.fetchLog.length = 0; say("hi", { nick: "alice" }); await wait(20);
  ok(!part(rowEls()[0], "cf-avatar") && !env.fetchLog.some(u => /decapi/.test(u)), "with avatars off there is no picture and no lookup");
  await load({ avatarShape: "square", avatarSize: 3 });
  ok(env.vars("cf-app")["--cf-avatar-r"] === "0" && env.vars("cf-app")["--cf-avatar"] === "3em", "the shape and size are settings");
  await load({ avatarShape: "rounded" }); ok(env.vars("cf-app")["--cf-avatar-r"] === "22%", "rounded");
  await load({ avatarShape: "circle" }); ok(env.vars("cf-app")["--cf-avatar-r"] === "50%", "circle");

  section("a change of settings while a lookup is out");
  let release; const held = new Promise(r => { release = r; });
  env.net(url => held.then(() => ({ text: CDN })));
  await load(); say("hi", { nick: "late" }); await wait(10);
  services({}, { late: CDN });
  await load(); release(); await wait(20);
  env.fetchLog.length = 0; say("hi", { nick: "late" }); await wait(20);
  ok(env.fetchLog.some(u => /avatar\/late/.test(u)) && avatarImg(rowEls()[0]) && avatarImg(rowEls()[0]).src === CDN, "an answer left over from before the change is ignored, and the chatter is asked afresh");

  section("keeping lookups between refreshes");
  services({}, { alice: CDN });
  await load(); say("hi", { nick: "alice" }); await wait(1200);
  ok(storeData.chatfeed_cache_v1 && storeData.chatfeed_cache_v1.avatars.alice.url === CDN, "avatars are saved");
  env.fetchLog.length = 0; await env.reload(); say("hi", { nick: "alice" }); await wait(20);
  ok(env.fetchLog.filter(u => /avatar/.test(u)).length === 0 && avatarImg(rowEls()[0]).src === CDN, "and a refresh does not ask again");
  storeData.chatfeed_cache_v1 = { avatars: { alice: { url: "https://evil.example/a.png", at: env.fake }, "Bad Login": { url: CDN, at: env.fake }, bram: "oops", cass: { url: CDN } }, list: ["x"] };
  await env.reload(); say("hi", { nick: "alice" }); await wait(20);
  ok(avatarImg(rowEls()[0]) === undefined || avatarImg(rowEls()[0]).src === CDN, "a damaged or tampered save is never trusted");
  storeData.chatfeed_cache_v1 = "garbage"; await env.reload(); say("hi", { nick: "bram" }); ok(rowEls().length === 1, "and garbage does not break the widget");

  section("pronouns");
  services({ alice: "sheher", bram: "hehim", cass: "theythem", dev: "madeup" }, {});
  await load();
  say("hi", { nick: "alice" }); say("hi", { nick: "bram" }); say("hi", { nick: "cass" }); say("hi", { nick: "eli", name: "Eli" }); await wait(30);
  ok(rowEls().map(pron).join("|") === "She/Her|He/Him|They/Them|", "pronouns appear beside the name, and nothing for someone who has none (" + rowEls().map(pron).join("|") + ")");
  ok(part(rowEls()[0], "cf-pron").className.indexOf("style-tag") !== -1, "as a tag by default");
  ok(env.fetchLog.filter(u => /pronouns$/.test(u)).length === 1, "the list is fetched once for everyone");
  say("hi", { nick: "dev" }); await wait(30);
  ok(pron(rowEls()[4]) === "", "an id the list does not know shows nothing");
  env.fetchLog.length = 0; say("again", { nick: "alice" }); await wait(20);
  ok(env.fetchLog.length === 0 && pron(rowEls()[5]) === "She/Her", "they are cached, so the same person is not asked again");
  await skip(5 * 60 * 1000 + 1000); env.fetchLog.length = 0; say("later", { nick: "alice" }); await wait(20);
  ok(env.fetchLog.some(u => /users\/alice/.test(u)), "but are asked for again after five minutes, as the service requests");
  services({ alice: "sheher" }, {}); await load({ pronounStyle: "brackets" }); say("hi", { nick: "alice" }); await wait(30);
  ok(pron(rowEls()[0]) === "(She/Her)", "or in brackets (" + pron(rowEls()[0]) + ")");
  await load({ pronounStyle: "plain" }); say("hi", { nick: "alice" }); await wait(30);
  ok(pron(rowEls()[0]) === "She/Her" && part(rowEls()[0], "cf-pron").className.indexOf("style-plain") !== -1, "or plain");
  await load({ showPronouns: false }); env.fetchLog.length = 0; say("hi", { nick: "alice" }); await wait(30);
  ok(!part(rowEls()[0], "cf-pron") && !env.fetchLog.some(u => /alejo/.test(u)), "with pronouns off there is nothing shown and no lookup");
  await load({ pronounOverrides: "alice=She/They, @Bram = He/Him , broken, =x, y=" }); env.fetchLog.length = 0;
  say("hi", { nick: "alice" }); say("hi", { nick: "bram" }); await wait(30);
  ok(rowEls().map(pron).join("|") === "She/They|He/Him" && !env.fetchLog.some(u => /users\/(alice|bram)/.test(u)), "pronouns can be set by hand, which wins and needs no lookup (" + rowEls().map(pron).join("|") + ")");
  env.net(url => { if (/pronouns$/.test(url)) throw new Error("down"); return { json: [{ id: "1", login: "alice", pronoun_id: "ziehir" }] }; });
  await load(); say("hi", { nick: "alice" }); await wait(30);
  ok(pron(rowEls()[0]) === "Zie/Hir", "if the list cannot be fetched, the built in one is used (" + pron(rowEls()[0]) + ")");
  env.net(url => { if (/pronouns$/.test(url)) return { json: { not: "a list" } }; return { json: [{ pronoun_id: "sheher" }] }; });
  await load(); say("hi", { nick: "alice" }); await wait(30);
  ok(pron(rowEls()[0]) === "She/Her", "and so is it if the list is not in the shape expected");
  env.net(url => { if (/users/.test(url)) return { json: { pronoun_id: "hehim" } }; return { json: LIST }; });
  await load(); say("hi", { nick: "alice" }); await wait(30);
  ok(pron(rowEls()[0]) === "He/Him", "a record that is not wrapped in a list is understood too");
  env.net(url => { if (/users/.test(url)) return { ok: false }; return { json: LIST }; });
  await load(); say("hi", { nick: "alice" }); await wait(30);
  ok(rowEls().length === 1 && pron(rowEls()[0]) === "", "a refused lookup shows nothing and breaks nothing");
  env.net(() => { throw new Error("offline"); }); await load(); say("hi", { nick: "alice" }); await wait(30);
  ok(rowEls().length === 1, "and so does being offline");

  section("name colours");
  await load({ themePreset: "glass" });
  say("a", { nick: "alice", color: "#FF7BAC" }); say("b", { nick: "bram", color: "#000000" }); say("c", { nick: "cass", color: "nonsense" }); say("d", { nick: "dev" });
  const col = i => part(rowEls()[i], "cf-name").style.color;
  ok(col(0) === "#FF7BAC", "a chatter's own colour is used when it can be read on the panel");
  ok(col(1) === "#FFFFFF" && col(2) === "#FFFFFF" && col(3) === "#FFFFFF", "and the accent when it cannot, or when they have none (" + [col(1), col(2), col(3)] + ")");
  await load({ themePreset: "frost" }); say("a", { nick: "alice", color: "#FFFF00" }); say("b", { nick: "bram", color: "#1B2130" });
  ok(col(0) === "#1B2130" && col(1) === "#1B2130", "a pale colour on a pale panel is swapped too, and a dark one is kept (" + [col(0), col(1)] + ")");
  await load({ nameColor: "accent", themePreset: "midnight" }); say("a", { nick: "alice", color: "#FF7BAC" }); ok(col(0) === "#89AFFF", "the name can always use the accent");
  await load({ nameColor: "text", themePreset: "midnight" }); say("a", { nick: "alice", color: "#FF7BAC" }); ok(col(0) === "#E8EEFF", "or the text colour");

  section("layout");
  await load();
  ok(!E("cf-app").classList.contains("inline") && !E("cf-app").classList.contains("bubbles"), "name above and one panel by default");
  await load({ nameLine: "inline", cardStyle: "bubbles" });
  ok(E("cf-app").classList.contains("inline") && E("cf-app").classList.contains("bubbles"), "the name can share the line, and each message can be its own card");
  await load({ textSize: 6, rowGap: 1 });
  ok(env.vars("cf-app")["--cf-size"] === "6cqw" && env.vars("cf-app")["--cf-gap"] === "1em", "size and spacing are settings");
  await load({ title: "Chat", showTitle: true }); ok(!E("cf-title").hidden && E("cf-title").textContent === "Chat", "the title can be shown");
  await load({ title: "", showTitle: true }); ok(E("cf-title").hidden, "a blank title hides it");

  section("commands");
  await load();
  say("one", { nick: "alice" }); say("two", { nick: "bram" });
  chat("!chatfeed clear", { nick: "viewer" }); ok(rowEls().length === 2, "a viewer cannot clear it");
  chat("!chatfeed clear", { mod: true }); ok(rowEls().length === 0, "a moderator can");
  await load({ whoCanManage: "broadcaster" }); say("one", { nick: "alice" });
  chat("!chatfeed clear", { mod: true }); ok(rowEls().length === 1, "unless only the broadcaster is allowed");
  boss("!chatfeed clear"); ok(rowEls().length === 0, "who always can");
  say("one", { nick: "alice" }); chat("!chatfeed", { nick: "viewer" });
  ok(E("cf-app").classList.contains("pop") && rowEls().length === 1, "the bare command only draws the eye to it");
  say("!chatfeed clear", { nick: "alice" }); ok(rowEls().length === 1, "the command is never shown as a message");
  chat("!chatfeedx clear", { mod: true }); say("two", { nick: "bram" }); ok(rowEls().length === 2, "whole words only: !chatfeedx is not the command");
  await load({ command: "!screen" }); say("one", { nick: "alice" }); boss("!chatfeed clear"); ok(rowEls().length === 1, "the command word is a setting");
  boss("!screen clear"); ok(rowEls().length === 0, "and the new one works");
  await load(); say("a", { nick: "alice" }); say("b", { nick: "bram" }); say("c", { nick: "alice" });
  boss("!chatfeed hide @Alice"); ok(names().join() === "Bram", "hide takes a chatter's messages off the screen (" + names() + ")");
  say("d", { nick: "alice" }); ok(names().join() === "Bram", "and keeps them off");
  ok(storeData.chatfeed_v1 && storeData.chatfeed_v1.hidden.join() === "alice", "it is saved");
  await env.reload(); say("e", { nick: "alice" }); ok(rowEls().length === 0, "so it survives a refresh");
  boss("!chatfeed unhide alice"); say("f", { nick: "alice" }); ok(names().join() === "Alice", "unhide lets them back");
  chat("!chatfeed hide bram", { nick: "viewer" }); say("g", { nick: "bram" }); ok(rowEls().length === 2, "a viewer cannot hide anyone");
  boss("!chatfeed hide bad name"); boss("!chatfeed hide"); boss("!chatfeed nonsense"); ok(rowEls().length === 2, "unreadable commands change nothing");
  storeData.chatfeed_v1 = { hidden: ["ok", 5, "Bad Name", null] }; await env.reload(); say("h", { nick: "ok" }); ok(rowEls().length === 0, "a damaged save keeps what is valid and drops the rest");

  section("when StreamElements deletes a message");
  await load();
  say("keep", { nick: "alice", msgId: "m1", userId: "u1" }); say("gone", { nick: "bram", msgId: "m2", userId: "u2" }); say("also gone", { nick: "bram", msgId: "m3", userId: "u2" }); say("keep too", { nick: "cass", msgId: "m4", userId: "u3" });
  env.ev("delete-message", { msgId: "m2" }); ok(texts().join() === "keep,also gone,keep too", "a deleted message disappears (" + texts() + ")");
  env.ev("delete-messages", { userId: "u2" }); ok(texts().join() === "keep,keep too", "so do all of a banned chatter's (" + texts() + ")");
  env.ev("delete-message", {}); env.ev("delete-messages", {}); env.ev("delete-message", { msgId: "nope" }); ok(rowEls().length === 2, "an event with nothing to match changes nothing");

  section("buttons");
  await load();
  button("btnDemo"); ok(rowEls().length === 4 && names().join() === "Alice,Bram,Cass,Dev", "the example messages show how it looks");
  ok(rowEls().map(pron).join("|") === "She/Her|He/Him|They/Them|" && !env.fetchLog.some(u => /demo_/.test(u)), "with pronouns, without any lookups");
  button("btnClear"); ok(rowEls().length === 0, "Clear empties it");

  section("looks");
  await load();
  const v = env.vars("cf-app");
  ok(v["--w-bg"] === "rgba(0, 0, 0, 0.55)" && v["--w-text"] === "#FFFFFF", "Soft black is the default");
  await load({ themePreset: "custom", radius: 10, borderWidth: 2, borderColor: "#FF0000", weight: 600, pad: 1, shadow: true, animate: false });
  const w = env.vars("cf-app");
  ok(w["--w-radius"] === "10px" && w["--w-border"] === "2px solid #FF0000" && w["--w-weight"] === 600 && w["--w-pad"] === 1 && w["--w-shadow"] !== "none", "the corner, outline, boldness, padding and shadow follow the settings");
  ok(E("cf-root").classList.contains("no-motion"), "and Animate off stops motion");
  await env.checkPresets("cf-app");

  section("sounds");
  await load({ soundMessage: "data:audio/wav;base64,AA", soundMessageVol: 40 });
  audioLog.length = 0; say("hi", { nick: "alice" }); ok(audioLog.length === 1 && Math.abs(audioLog[0].volume - 0.4) < 1e-9, "a message plays its sound at its volume");
  audioLog.length = 0; say("!hidden", { nick: "alice" }); say("x", { nick: "nightbot" }); ok(audioLog.length === 0, "but not for one that is left out");
  audioLog.length = 0; button("test_soundMessage"); ok(audioLog.length === 1, "the Test button plays");
  await load({ soundMessage: "data:audio/wav;base64,AA", mute: true }); audioLog.length = 0; say("hi", { nick: "alice" }); ok(audioLog.length === 0, "mute silences it");

  section("odd input never breaks it");
  await load();
  env.ev("message", {}); env.ev("message", { data: null }); env.ev("message", { data: { text: 5 } }); env.ev("message", { data: { text: "hi" } });
  env.ev("message", { data: { text: "hi", nick: null, displayName: null, badges: "x", emotes: "x", tags: null } });
  env.ev("nonsense", {}); env.ev("widget-button", { field: "nope" });
  ok(true, "empty, missing and wrongly typed events are ignored");
  ok(rowEls().length >= 1, "a message with almost nothing in it still shows (" + rowEls().length + ")");
  say("x".repeat(3000), { nick: "alice" }); ok(texts()[texts().length - 1].length === 3000, "a very long message is kept whole for the CSS to wrap");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
