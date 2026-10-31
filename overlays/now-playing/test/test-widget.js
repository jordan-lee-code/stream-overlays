/* Headless test for the now playing card. Runs the real widget/widget.js against a small mock of
   the page and StreamElements, with a pretend network and a clock the test controls. */
const env = require("./mock")(require("path").join(__dirname, ".."));
const { ok, section, wait, E } = env;
// Each load starts with a clean request log, so a test can read what that load asked for. `pass` lets time go by for the
// clock and the date together, which is what moves a track's position on between asks.
let handler = () => { throw new Error("offline"); };
const net = fn => { handler = fn; env.net(fn); };
const load = (o, keep) => { env.net(handler); return env.load(o, keep); };
const pass = async ms => { env.fake += ms; await wait(ms); };

const text = id => E(id).hidden ? "" : E(id).textContent;
const title = () => text("np-title"), artist = () => text("np-artist"), label = () => text("np-label");
const gone = () => E("np-app").classList.contains("gone");
const art = () => E("np-art").src;
const KEY = "key123", USER = "mina";
const lastfmJson = (tr) => ({ recenttracks: { track: tr, "@attr": { user: USER } } });
const lfTrack = (o) => Object.assign({ name: "Song", artist: { "#text": "Band" }, album: { "#text": "Record" }, image: [{ size: "small", "#text": "http://i/s.png" }, { size: "extralarge", "#text": "http://i/xl.png" }], "@attr": { nowplaying: "true" } }, o || {});

(async () => {
  section("Last.fm");
  const lf = { user: USER, key: KEY };
  const cfgLf = o => Object.assign({ source: "lastfm", lastfmUser: lf.user, lastfmKey: lf.key }, o || {});
  net(() => ({ json: lastfmJson([lfTrack()]) }));
  await load(cfgLf());
  ok(!gone() && title() === "Song" && artist() === "Band", "a track that is playing shows its title and artist (" + title() + ", " + artist() + ")");
  ok(label() === "Now playing", "under the line that says so (" + label() + ")");
  ok(art() === "http://i/xl.png" && !E("np-art-wrap").hidden, "with the biggest picture it has (" + art() + ")");
  const url = env.fetchLog[0];
  ok(/^https:\/\/ws\.audioscrobbler\.com\/2\.0\/\?/.test(url) && /user=mina/.test(url) && /api_key=key123/.test(url) && /method=user\.getrecenttracks/.test(url) && /limit=1/.test(url) && /format=json/.test(url), "it asks Last.fm for the one most recent track (" + url + ")");
  ok(E("np-progress").hidden, "Last.fm does not say how far through a track it is, so there is no bar");
  net(() => ({ json: lastfmJson([lfTrack({ "@attr": undefined, name: "Old one" })]) }));
  await wait(5100); ok(gone(), "a track that is not playing now, only the last one played, shows nothing");
  net(() => ({ json: lastfmJson(lfTrack({ name: "Alone" })) }));
  await wait(5100); ok(title() === "Alone" && !gone(), "a single track sent as an object and not a list still reads");
  net(() => ({ json: lastfmJson([lfTrack({ image: [{ size: "extralarge", "#text": "http://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png" }] })]) }));
  await wait(5100); ok(E("np-art-wrap").hidden, "the grey star Last.fm sends for a track with no cover is not shown as a cover");
  net(() => ({ json: lastfmJson([lfTrack({ name: "<b>Bold</b> & <i>co</i>", artist: "<img src=x onerror=alert(1)>" })]) }));
  await wait(5100); ok(title() === "<b>Bold</b> & <i>co</i>" && artist() === "<img src=x onerror=alert(1)>", "names are shown as typed, never as markup");
  net(() => ({ json: lastfmJson([lfTrack({ image: [{ size: "extralarge", "#text": "javascript:alert(1)" }] })]) }));
  await wait(5100); ok(E("np-art-wrap").hidden, "a picture address that is not a web address is never used");
  await load({ source: "lastfm" }); ok(gone() && env.fetchLog.length === 0, "with no username or key it asks nothing and shows nothing");
  await load(cfgLf({ lastfmUser: "  mina  ", lastfmKey: " key123 " })); ok(/user=mina&/.test(env.fetchLog[0]) && /api_key=key123$/.test(env.fetchLog[0]), "spaces around them are ignored");
  await load(cfgLf({ lastfmUser: "a b&c" })); ok(/user=a%20b%26c/.test(env.fetchLog[env.fetchLog.length - 1]), "and a name with odd characters is sent safely");

  section("Tuna");
  const tunaJson = o => Object.assign({ status: "playing", title: "Tuna song", artists: ["One", "Two"], album: "Alb", cover_url: "http://localhost:1608/cover.png", progress: 30000, duration: 120000 }, o || {});
  net(() => ({ json: tunaJson() }));
  await load({ source: "tuna" });
  ok(env.fetchLog[0] === "http://localhost:1608/", "it asks the Tuna web server on this PC (" + env.fetchLog[0] + ")");
  ok(title() === "Tuna song" && artist() === "One, Two", "the artists are joined (" + artist() + ")");
  ok(art() === "http://localhost:1608/cover.png?track=" + encodeURIComponent("tu:Tuna song|One, Two"), "Tuna's cover has the track in its address, or the old picture would be kept (" + art() + ")");
  ok(!E("np-progress").hidden && text("np-pos") === "0:30" && text("np-dur") === "2:00", "it says how far through it is (" + text("np-pos") + " of " + text("np-dur") + ")");
  await pass(3000); ok(text("np-pos") === "0:33", "and the position moves on between asks (" + text("np-pos") + ")");
  ok(Math.abs(parseFloat(E("np-fill").style.width) - 33000 / 120000 * 100) < 1, "with the bar (" + E("np-fill").style.width + ")");
  net(() => ({ json: tunaJson({ status: "paused" }) }));
  await pass(5100); const held = text("np-pos"); ok(label() === "Paused" && title() === "Tuna song", "paused keeps the track, with its own line (" + label() + ")");
  await pass(20000); ok(text("np-pos") === held, "and the bar stops while it is paused (" + text("np-pos") + ")");
  net(() => ({ json: tunaJson({ status: "stopped" }) }));
  await pass(5100); ok(gone(), "stopped shows nothing");
  await load({ source: "tuna", tunaPort: 9999 }); ok(env.fetchLog[0] === "http://localhost:9999/", "the port is a setting");
  await load({ source: "tuna", tunaPort: 99999 }); ok(env.fetchLog[0] === "http://localhost:1608/", "and one that cannot be a port is the usual one");
  net(() => ({ json: tunaJson({ progress: 999999999 }) })); await load({ source: "tuna" }); await pass(1000);
  ok(text("np-pos") === "2:00", "a position can never run past the end of the track (" + text("np-pos") + ")");

  section("Pear Desktop (YouTube Music)");
  const pearJson = o => Object.assign({ title: "Pear song", artist: "Artist", album: "Alb", imageSrc: "https://lh3.example/cover.jpg", isPaused: false, songDuration: 200, elapsedSeconds: 50, videoId: "abc" }, o || {});
  net(() => ({ json: pearJson() }));
  await load({ source: "pear" });
  ok(env.fetchLog[0] === "http://localhost:26538/api/v1/song", "it asks Pear Desktop's API Server on this PC (" + env.fetchLog[0] + ")");
  ok(title() === "Pear song" && artist() === "Artist" && art() === "https://lh3.example/cover.jpg", "title, artist and cover");
  ok(text("np-pos") === "0:50" && text("np-dur") === "3:20", "its times are in seconds, and are read that way (" + text("np-pos") + " of " + text("np-dur") + ")");
  ok(env.fetchOpts[0] === null || !env.fetchOpts[0].headers, "with no token it sends none");
  await load({ source: "pear", pearToken: "tok" }); ok(env.fetchOpts[0].headers.Authorization === "Bearer tok", "and with one it sends it");
  net(() => ({ status: 204 })); await load({ source: "pear" }); ok(gone(), "no song at all (the empty answer) shows nothing");
  net(() => ({ json: pearJson({ isPaused: true }) })); await load({ source: "pear" }); ok(label() === "Paused", "a paused song says so");
  await load({ source: "pear", pearPort: 1234 }); ok(env.fetchLog[0] === "http://localhost:1234/api/v1/song", "the port is a setting");

  section("Spotify");
  const spot = { token: "access-1", playing: true, item: { id: "tid", name: "Spot song", artists: [{ name: "A" }, { name: "B" }], album: { name: "Alb", images: [{ url: "https://i.scdn.co/640", width: 640 }, { url: "https://i.scdn.co/300", width: 300 }, { url: "https://i.scdn.co/64", width: 64 }] }, duration_ms: 180000 }, type: "track" };
  let tokenCalls = 0, nowCalls = 0, expires = 3600, rotate = null, nowStatus = 200;
  const spotNet = (u, o) => {
    if (u === "https://accounts.spotify.com/api/token") { tokenCalls++; return { json: Object.assign({ access_token: spot.token, expires_in: expires }, rotate ? { refresh_token: rotate } : {}) }; }
    if (u === "https://api.spotify.com/v1/me/player/currently-playing") {
      nowCalls++;
      if (nowStatus !== 200) return { status: nowStatus, json: {}, headers: nowStatus === 429 ? { "Retry-After": 12 } : {} };
      return { json: { is_playing: spot.playing, progress_ms: 60000, currently_playing_type: spot.type, item: spot.item } };
    }
    throw new Error("unexpected " + u);
  };
  const sp = o => Object.assign({ source: "spotify", spotifyClientId: "cid", spotifyRefreshToken: "rt" }, o || {});
  net(spotNet); await load(sp());
  const tokenOpts = env.fetchOpts[0];
  ok(env.fetchLog[0] === "https://accounts.spotify.com/api/token" && tokenOpts.method === "POST" && /grant_type=refresh_token/.test(tokenOpts.body) && /refresh_token=rt/.test(tokenOpts.body) && /client_id=cid/.test(tokenOpts.body) && !/client_secret/.test(tokenOpts.body), "it makes an access token from the refresh token and client ID, and uses no secret (" + tokenOpts.body + ")");
  ok(env.fetchOpts[1].headers.Authorization === "Bearer access-1", "and asks what is playing with it");
  ok(title() === "Spot song" && artist() === "A, B" && art() === "https://i.scdn.co/300", "title, artists, and a cover of a sensible size (" + art() + ")");
  ok(text("np-pos") === "1:00" && text("np-dur") === "3:00", "with the times (" + text("np-pos") + " of " + text("np-dur") + ")");
  await wait(5100); await wait(5100); ok(tokenCalls === 1 && nowCalls >= 3, "the access token is kept and reused while it is good (" + tokenCalls + " token requests, " + nowCalls + " asks)");
  expires = 3600; await pass(3700000); await wait(5100); ok(tokenCalls >= 2, "and renewed once it has run out (" + tokenCalls + ")");
  await load(sp({ spotifyRefreshToken: "" })); ok(gone() && env.fetchLog.length === 0, "with no refresh token it asks nothing");
  net(() => ({ status: 204 })); await load(sp()); ok(true, "(an empty answer to the token request is survived)");
  net(spotNet); spot.type = "episode"; await load(sp()); ok(gone(), "a podcast episode is not a track, and shows nothing"); spot.type = "track";
  spot.item = null; await load(sp()); ok(gone(), "an advert, which has no track, shows nothing"); spot.item = { id: "tid", name: "Spot song", artists: [{ name: "A" }], album: { name: "Alb", images: [] }, duration_ms: 180000 };
  spot.playing = false; await load(sp()); ok(label() === "Paused", "paused says so"); spot.playing = true;
  await load(sp()); nowStatus = 401; tokenCalls = 0; await wait(5100); nowStatus = 200; await wait(10100); ok(tokenCalls >= 1 && title() === "Spot song", "if Spotify refuses the access token it makes a new one and carries on (" + tokenCalls + ")");
  await load(sp()); nowStatus = 429; await wait(5100); const calls = nowCalls; await wait(8000); ok(nowCalls === calls, "when Spotify says to slow down it waits as long as it is told, not the usual few seconds"); nowStatus = 200;
  rotate = "rt-2"; await load(sp());
  ok(env.storeData.nowplaying_v1 && env.storeData.nowplaying_v1.spotify && env.storeData.nowplaying_v1.spotify.token === "rt-2", "a new refresh token from Spotify is kept for next time, since the settings cannot be changed from here");
  rotate = null; expires = 1; await load(sp(), true); ok(/refresh_token=rt-2/.test(env.fetchOpts[0].body), "and used on the next load");
  await load(sp({ spotifyRefreshToken: "pasted-fresh" }), true); ok(/refresh_token=pasted-fresh/.test(env.fetchOpts[0].body), "unless a new one has been pasted into the settings, which then wins");
  expires = 3600;

  section("when it cannot be read");
  net(() => { throw new Error("offline"); }); await load(cfgLf({ showProblems: true }));
  ok(gone() && !E("np-note").hidden && /offline/.test(E("np-note").textContent), "an unreachable source shows nothing, and says why when asked (" + E("np-note").textContent + ")");
  await load(cfgLf()); ok(E("np-note").hidden, "and says nothing on stream by default");
  net(() => ({ json: lastfmJson([lfTrack()]) })); await load(cfgLf());
  net(() => { throw new Error("offline"); });
  await wait(5100); ok(!gone(), "one miss does not make the card flicker away");
  await wait(10100); await wait(20100); ok(gone(), "but a source that stays quiet is not playing anything");
  net(() => ({ json: lastfmJson([lfTrack()]) })); await wait(60100); ok(!gone(), "and it comes back once the source does");
  net(() => ({ json: { error: 10, message: "Invalid API key" } })); await load(cfgLf({ showProblems: true })); ok(/Invalid API key/.test(E("np-note").textContent), "Last.fm's own complaint is passed on (" + E("np-note").textContent + ")");
  net(() => ({ ok: false })); await load(cfgLf({ showProblems: true })); ok(/404/.test(E("np-note").textContent), "as is a plain refusal (" + E("np-note").textContent + ")");
  await load(cfgLf(), false);
  net(() => ({ json: lastfmJson([lfTrack()]) })); await load(cfgLf());
  let n0 = env.fetchLog.length; await wait(5100); ok(env.fetchLog.length === n0 + 1, "it asks again every five seconds");
  await load(cfgLf({ pollSeconds: 20 })); n0 = env.fetchLog.length; await wait(10000); ok(env.fetchLog.length === n0, "or as often as you say"); await wait(10100); ok(env.fetchLog.length === n0 + 1, "(" + (env.fetchLog.length - n0) + ")");
  await load(cfgLf({ pollSeconds: 0 })); n0 = env.fetchLog.length; await wait(2900); ok(env.fetchLog.length === n0, "never faster than every three seconds, however low it is set");
  await load(cfgLf({ pollSeconds: 9999 })); n0 = env.fetchLog.length; await wait(60100); ok(env.fetchLog.length === n0 + 1, "or slower than a minute");
  await load(cfgLf()); await load(cfgLf()); await load(cfgLf()); n0 = env.fetchLog.length; await wait(5100); ok(env.fetchLog.length === n0 + 1, "reloading does not leave old timers asking as well");

  section("showing it");
  net(() => ({ json: lastfmJson([lfTrack()]) }));
  await load(cfgLf({ showAlbum: true })); ok(text("np-album") === "Record", "the album can be shown");
  await load(cfgLf()); ok(text("np-album") === "", "and is not unless asked for");
  await load(cfgLf({ showArt: false })); ok(E("np-art-wrap").hidden, "the art can be left off");
  await load(cfgLf({ artShape: "round" })); ok(E("np-app").classList.contains("round-art"), "or round");
  await load(cfgLf({ labelPlaying: "" })); ok(label() === "", "the line above the title can be blank");
  await load(cfgLf({ labelPlaying: "Listening to" })); ok(label() === "Listening to", "or anything you like");
  net(() => ({ json: tunaJson({ status: "paused" }) })); await load({ source: "tuna", showPaused: false }); ok(gone(), "paused can be treated as nothing playing");
  net(() => ({ json: lastfmJson([lfTrack({ "@attr": undefined })]) })); await load(cfgLf({ idleText: "Nothing on right now" })); ok(!gone() && title() === "Nothing on right now" && artist() === "" && E("np-art-wrap").hidden && E("np-progress").hidden, "when nothing is playing it can say so, with nothing else on the card");
  net(() => ({ json: lastfmJson([lfTrack()]) }));
  await load(cfgLf({ animate: true })); ok(E("np-app").classList.contains("pop"), "a new track pops in");
  await load(cfgLf({ animate: false })); ok(E("np-root").classList.contains("no-motion"), "and with Animate off nothing moves");
  await load(cfgLf({ textSize: 7, titleScale: 2, artSize: 6 }));
  const v = env.vars("np-app"); ok(v["--np-size"] === "7cqw" && v["--np-title"] === 2 && v["--np-art"] === 6, "the sizes are settings");
  await load(cfgLf({ titleScale: 99, artSize: 99 })); ok(env.vars("np-app")["--np-title"] === 3 && env.vars("np-app")["--np-art"] === 10, "within limits");
  await load(cfgLf({ themePreset: "pride" })); ok(String(env.vars("np-app")["--w-flag"]).indexOf("linear-gradient(180deg") === 0, "a pride preset's bar wears its flag");
  await env.checkPresets("np-app");

  section("hiding it from chat");
  net(() => ({ json: lastfmJson([lfTrack()]) })); await load(cfgLf());
  env.chat("!nowplaying off", { mod: true }); ok(gone(), "a moderator can hide it");
  env.chat("!nowplaying on", { mod: true }); ok(!gone(), "and show it again");
  env.boss("!nowplaying hide"); ok(gone(), "the broadcaster can hide it (hide is off)");
  env.boss("!nowplaying show"); ok(!gone(), "(show is on)");
  env.chat("!nowplaying off"); ok(!gone(), "a viewer cannot");
  env.chat("!nowplaying off", { mod: true }); await wait(10);
  await load(cfgLf(), true); ok(gone(), "it stays hidden over a refresh of the overlay");
  env.boss("!nowplaying on"); await load(cfgLf(), true); ok(!gone(), "and stays shown");
  await load(cfgLf({ whoCanManage: "broadcaster" })); env.chat("!nowplaying off", { mod: true }); ok(!gone(), "moderators can be left out");
  env.boss("!nowplaying"); ok(!gone(), "the bare word does nothing");
  env.boss("!nowplaying sideways"); ok(!gone(), "nor does a word it does not know");
  env.boss("!nowplayingnow off"); ok(!gone(), "nor a different command that starts the same");
  await load(cfgLf({ command: "!song" })); env.boss("!song off"); ok(gone(), "the command word is a setting");
  await load(cfgLf({ command: "!song" })); env.boss("!NowPlaying off"); env.boss("!SONG on"); ok(!gone(), "in any case");
  await load(cfgLf()); env.boss("!nowplaying off"); n0 = env.fetchLog.length; env.boss("!nowplaying refresh"); await wait(5); ok(env.fetchLog.length === n0 + 1, "refresh reads what is playing now");
  env.button("btnHide"); ok(gone(), "the buttons do the same: hide");
  env.button("btnShow"); ok(!gone(), "show");
  n0 = env.fetchLog.length; env.button("btnRefresh"); await wait(5); ok(env.fetchLog.length === n0 + 1, "and read now");
  env.storeLatency = 1000; net(() => ({ json: lastfmJson([lfTrack()]) }));
  await load(cfgLf(), true); ok(gone(), "while the saved on or off state is loading the card stays hidden, so a refresh never shows it for a moment");
  await wait(1100); ok(!gone(), "and it is shown once the state is known");
  env.storeLatency = Infinity; await load(cfgLf(), true); await wait(3100); ok(!gone(), "if the state never comes it is shown after a moment, because a broken store should not hide it for good");
  env.storeLatency = undefined;

  section("odd input never breaks it");
  net(() => ({ json: null })); await load(cfgLf()); ok(gone(), "an empty answer is nothing playing");
  net(() => ({ json: { recenttracks: {} } })); await load(cfgLf()); ok(gone(), "so is one with no tracks in it");
  net(() => ({ json: lastfmJson([{ "@attr": { nowplaying: "true" } }]) })); await load(cfgLf()); ok(gone(), "and a track with no name");
  net(() => ({ json: lastfmJson([lfTrack()]) }));
  await load({ source: "nonsense", lastfmUser: "u", lastfmKey: "k" }); ok(/audioscrobbler/.test(env.fetchLog[0]), "a source that is not one of the choices is Last.fm");
  await load(cfgLf({ lastfmUser: 5, lastfmKey: 7, pollSeconds: "soon", textSize: "big" })); ok(!gone(), "settings of the wrong type are read as text or fall back to the usual");
  env.ev("message", {}); env.ev("nonsense", null); env.ev("widget-button", { field: "x" }); ok(!gone(), "and events it has no use for are ignored");

  section("the Spotify sign-in page");
  const P = require("../dev/spotify-pkce"), page = require("fs").readFileSync(require("path").join(__dirname, "../dev/spotify-token.html"), "utf8");
  ok(await P.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") === "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "the code challenge is the one in the PKCE standard's own example");
  const v1 = P.randomString(64), v2 = P.randomString(64);
  ok(/^[A-Za-z0-9\-._~]{64}$/.test(v1) && v1 !== v2, "the verifier is 64 allowed characters, different each time (" + v1.length + ")");
  const au = new URL(P.authorizeUrl({ clientId: "cid", redirectUri: "https://example.org/a/b.html", state: "st", challenge: "ch" }));
  ok(au.origin + au.pathname === "https://accounts.spotify.com/authorize" && au.searchParams.get("response_type") === "code" && au.searchParams.get("client_id") === "cid" && au.searchParams.get("redirect_uri") === "https://example.org/a/b.html" && au.searchParams.get("state") === "st" && au.searchParams.get("code_challenge") === "ch" && au.searchParams.get("code_challenge_method") === "S256", "the sign-in address has everything Spotify needs");
  ok(au.searchParams.get("scope") === "user-read-currently-playing", "and asks only to see what is playing (" + au.searchParams.get("scope") + ")");
  const tb = new URLSearchParams(P.tokenBody({ code: "c0de", redirectUri: "https://example.org/a/b.html", clientId: "cid", verifier: "ver" }));
  ok(tb.get("grant_type") === "authorization_code" && tb.get("code") === "c0de" && tb.get("client_id") === "cid" && tb.get("code_verifier") === "ver" && !tb.has("client_secret"), "the exchange for a token sends the verifier, and no secret");
  ok(!/client_secret/i.test(page) && /spotify-pkce\.js/.test(page), "the page has no secret in it, and uses the same code the tests check");

  section("every setting is wired up");
  env.checkWired();
  env.checkNotice();
  env.finish();
})();
