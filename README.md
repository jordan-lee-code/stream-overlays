# Stream Overlays

A set of overlays for Twitch streams, for StreamElements and for Streamer.bot. Each is plain JavaScript with no dependencies and nothing to install: with StreamElements you paste its four files into a custom widget, and with Streamer.bot you add one link to OBS. They share one design, twenty-three style presets including seven pride flags, so they look like one family on a stream.

**Goals and counters**

| Overlay | What it does |
| --- | --- |
| [Sub Goals](overlays/sub-goals) | Goals that fill as chat reaches them, with names like "15 subs unlocks chat confessions". |
| [Subathon](overlays/subathon) | A subathon clock with a cap, power-ups and sub goals underneath. |
| [Squat Tracker](overlays/squat-tracker) | A running count driven by gifted sub bombs. |
| [Rage Bar](overlays/rage-bar) | A bar chat fills with subs, bits and channel points. |
| [Chat Counter](overlays/counter) | A counter chat commands change, for deaths, wins and anything else. |
| [Hype Meter](overlays/hype-meter) | A meter that chat activity fills, with levels. |
| [Stream Goals](overlays/stream-goals) | Sub and bits goals that start again for each stream. |

**Chat and viewers**

| Overlay | What it does |
| --- | --- |
| [Spin Wheel](overlays/spin-wheel) | A wheel for giveaways, raffles and forfeits. |
| [Chat Poll](overlays/chat-poll) | Quick polls voted on by typing an option. |
| [Leaderboard](overlays/leaderboard) | Top gifters, cheerers and tippers. |
| [Recent Activity](overlays/recent-activity) | The latest subs, gifts, bits, tips, follows and raids. |
| [Chat Feed](overlays/chat-feed) | On-screen chat with profile pictures and pronouns, in the same style presets. |

**On-screen info**

| Overlay | What it does |
| --- | --- |
| [Reminder](overlays/reminder) | Reminders you set from chat, which stay on screen until cleared. |
| [Camera](overlays/camera) | A framed window for your camera with a nameplate, and a cover that you and your moderators control from chat: off, brb, away, or a message of your own. |
| [Now Playing](overlays/now-playing) | What you are playing, from Last.fm, Tuna, Spotify or Pear Desktop, with album art and a progress bar. |
| [Rotating Panel](overlays/rotating-panel) | One panel that takes turns showing your socials and chat commands. |
| [Task List and Schedule](overlays/task-list) | A task list you tick off from chat, or a weekly schedule with today's slot highlighted. |
| [Local Time](overlays/local-time) | The time in any timezone, with a line above it such as Local timezone: GMT. |
| [Socials Bar](overlays/socials-bar) | A horizontal bar of your social logos and handles, rotating on the left, with Ko-fi on the right. |

**Stream start and end**

| Overlay | What it does |
| --- | --- |
| [Stream Start Countdown](overlays/start-countdown) | A full-screen starting soon countdown you set from chat, with a clock, a bar and friendly lines that take turns. |
| [Be Right Back](overlays/be-right-back) | A break screen with a clock that counts down to your return, or up the time you have been away. |
| [End Credits](overlays/end-credits) | A thank-you that collects your followers, subscribers, gifters, cheerers, tippers, raiders and chatters through the stream and rolls them as credits. |

## Using an overlay

1. Open the overlay's folder and read its README.
2. In StreamElements, add a **Custom Widget** to your overlay, and paste each file from the overlay's `widget/` folder into the matching tab: `widget.html` into HTML, `widget.css` into CSS, `widget.js` into JS and `fields.json` into Fields.
3. Choose a **Style preset** in the settings.

## Using an overlay with Streamer.bot

The website has a switch at the top between StreamElements and Streamer.bot. Choose Streamer.bot and every overlay's page gives you a link for an OBS browser source instead of files to paste.

1. In Streamer.bot, open **Servers/Clients**, then **WebSocket Server**, tick **Auto Start** and press **Start Server**. It listens on `127.0.0.1` port `8080` unless you change it. Connect your Twitch account under **Platforms**.
2. Set the overlay up on its page on the website, with the Streamer.bot choice made, and press **Copy the browser source address**.
3. In OBS, add a **Browser** source, paste the address into **URL**, and give it the width and height of the box you want. Leave **Shutdown source when not visible** unticked, so counts are not lost.

The overlays are not rewritten for this. `streamerbot.js` turns what Streamer.bot says (`Twitch.Cheer`, `Twitch.GiftBomb`, `Twitch.ChatMessage` and so on) into the events StreamElements sends, and keeps what an overlay remembers in the browser source's own storage, so the same code runs in both. Your settings travel in the address after a `#`, so nothing is stored on the website.

What is different from StreamElements:

- **Chat commands work, the editor buttons do not.** The buttons in an overlay's settings, such as Manual controls, belong to the StreamElements editor. Use the overlay's chat commands instead.
- **Who can use a command** comes from the Twitch role and badges Streamer.bot reports, so the broadcaster and moderators work as they do on StreamElements.
- **Tips** arrive from whichever of StreamElements, Streamlabs, Ko-fi or TipeeeStream you have connected to Streamer.bot. Streamer.bot's documentation does not list those events' fields, so they are read by the names a tip is likely to use. If a tip does not show, add `?debug=1` to the address to see in the browser source's console what arrived.
- **It needs internet** while you stream, since the page loads from the website, and it loads Streamer.bot's own client script from jsDelivr.
- **Streamer.bot on another computer** needs its address and port in the box on the overlay's page, and a browser source on a secure page may refuse an unencrypted connection to another machine; `127.0.0.1` is the case that is known to work.

## Setting the look once

Every overlay's dev page has a **Design** panel. Set the style preset, font, colours, shape, frame and decorations in one overlay, save the design, and apply it in any other, so the look only has to be configured once. It can also be copied or downloaded as a small file, to keep or share. Only the design travels, so each overlay keeps its own wording and behaviour settings.

## Trying one without going live

Every overlay has a local dev harness that stands in for StreamElements.

```sh
cd overlays/counter
npm run dev
# then open http://localhost:8000/dev/
```

## The shared design

The style presets, the contrast rules every preset has to meet, and the standards the overlays follow live in [`kit/`](kit). `npm test` checks every overlay against them.

## Support

If this saves you time, you can support its development on Ko-fi:

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-ff38b8?logo=ko-fi&logoColor=white)](https://ko-fi.com/journeyingjordan)

Thanks for using it.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). The copyright notice, including the Ko-fi link, must be kept in copies and substantial portions of the code.
