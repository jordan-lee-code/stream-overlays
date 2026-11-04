# Be Right Back Overlay

A StreamElements custom widget for the moments you step away. Type `!brb 5m` and a big clock counts down to your return on a "Be right back" screen, with a bar that fills, the time you will be back, and a few friendly lines that take turns. Type `!brb` on its own and it counts up instead, so chat can see how long you have been gone. When you are back, `!brb back` clears it.

<p align="center"><img src="docs/default.png" alt="A full-screen be right back card with Back in above a large clock reading 04:32, a bar, the words Back at 20:00 and a friendly line underneath, in a white frame" width="640"></p>

It is a single self-contained widget in plain JavaScript, with no dependencies and nothing to install. It is designed around a full 1920 by 1080 scene, and it stretches to any box you draw for it.

## Features

- Set from chat: `!brb 5m` for back in five minutes, `!brb at 20:30` for a time of day, or `!brb` for no set time.
- Two kinds of clock: Back in, counting down to when you said, with a bar that fills and Back at 20:35 beneath it, or Away for, counting up the time you have been gone when you did not say.
- Kind when you run late: if the time you gave passes and you are not back, the clock goes and the headline changes to "Back any moment now", and stays until you clear it, so there is no countdown stuck on zero.
- Lines that take turns: "Grab a drink and stretch your legs", "Chat is open, say hi to each other", or whatever you like, changing every few seconds.
- Changed while it runs: `add 5m` when you need longer, `less 1m`, `back` when you return.
- Made for a full screen, and happy in any box: every size is a share of the box's width at 16 by 9, or of its height if the box is short for its width, so it never runs off the edge.
- Moderator control: the streamer, and by default moderators, can run it. Viewers cannot, though the bare command from anyone makes the headline pop.
- Saved: the times are kept as moments, so a refresh, or closing OBS for a minute, does the right thing.
- Customisable: around fifty settings cover the wording, sizes, colours, fonts and animation.
- All twenty-three style presets, including the seven pride flags.
- An outer frame in the accent colour, on by default in every preset, and switched off with one checkbox (the flag's stripes in the pride presets).
- Decorations: sparkles, hearts, stars, flowers, moons, snowflakes, bubbles, butterflies, clouds, leaves, paw prints, music notes or bows behind the words, scattered, along the edges, in the corners, a little way in from the corners or on the border, twinkling, drifting or still. Off by default.
- Tests and a dev harness: a local harness with a time machine and an automated test script.

## Screenshots

**Counting up.** With no time given, the clock says how long you have been away.

<p><img src="docs/away.png" alt="Away for above a clock reading 03:12 on the card, with a line underneath" width="640"></p>

**Running late.** When the time you gave has passed, the clock goes and the headline changes.

<p><img src="docs/late.png" alt="The words Back any moment now on the card" width="640"></p>

**Stretched.** It adapts to the box you give it. Here it is a tall, narrow box in the trans pride preset.

<p><img src="docs/stretched.png" alt="A tall narrow card in the trans pride colours, with the headline, a clock and the time you will be back in the middle" width="300"></p>

**Just the headline.** With nothing set, it is a card with a headline and your lines, which suits a scene that is always a break.

<p><img src="docs/idle.png" alt="A card with the words Be right back and a line underneath" width="640"></p>

**Your own look.** Choose Custom for the style preset and every colour, the font, the corners and the wording are settings.

<p><img src="docs/custom.png" alt="A deep plum card with pink lettering in a script font, the headline Gone for a bit and a clock reading 04:32" width="640"></p>

## Quick start

1. In StreamElements, edit your overlay and add **+ Add Widget, Static/Custom, Custom Widget**.
2. Select the widget, open **Settings, Open Editor**, and paste each file from `widget/` into the matching tab: `widget.html` into HTML, `widget.css` into CSS, `widget.js` into JS, and `fields.json` into Fields.
3. Click **Done**. The settings are grouped into Commands, Break, Messages, Size, Manual controls, Look, Custom colours and Troubleshooting.
4. Make the widget as big as your scene, 1920 by 1080 for a full screen, and put it at the front of a "Be right back" scene with your own background behind it. Switch to that scene when you step away, and type `!brb` in chat.

The widget reads Twitch chat through StreamElements, so it works as soon as it is on an active overlay.

## Chat commands

The command word is a setting. Viewers can type the bare `!brb` to make the headline pop, and everything else needs the broadcaster or, by default, a moderator.

| Command | What it does |
| --- | --- |
| `!brb` | Starts a break with no set time, and the clock counts up how long you have been away. If you set a default length, it starts one of that length instead. |
| `!brb 5m` | Starts a break that ends in five minutes. |
| `!brb at 20:30` | Starts one that ends at the next 20:30 on the computer running the overlay. `8pm` and `8:30 pm` work too. |
| `!brb add 5m` | Pushes your return back by five minutes. Adding to a break with no set time gives it one, counted from now. |
| `!brb less 2m` | Brings your return forward by two minutes. |
| `!brb back` | You are back: clears the break and goes back to the headline. `stop`, `clear` and `done` do the same. |

**Writing a length of time.** `90s`, `10m`, `1h30m`, `1d`, `1.5h`, `1:30:00` (hours, minutes, seconds), `5:00` (minutes and seconds), or a bare number, which is minutes. A break can be set up to two days ahead, and anything longer or unreadable is ignored.

**Writing a time of day.** After `at`, a 24-hour time such as `20:30`, or an am or pm one such as `8pm` or `8:30 pm`. If that time has already passed today, it means tomorrow. A bare number is not a time of day, because a bare number is minutes.

## When you run late

If the time you gave passes and you have not typed `!brb back`, the clock and bar go and the headline changes to the words in **What the headline says when the time you gave has passed**, "Back any moment now" by default. It stays until you clear it, or give a new time with `!brb add 5m`, which counts from now. A break that ran past its time while the overlay was closed shows the same way as soon as it loads.

## The rotating lines

Under the clock, a line from your list takes its turn every few seconds, fading in as it arrives. Write them in the **Lines that rotate** setting, separated by a vertical bar: `Grab a drink and stretch your legs | Chat is open, say hi to each other`. A single line just stays, and a blank setting leaves none.

## Style presets

One setting picks the look. The same twenty-three presets, with the same colours, are in every overlay in this set, so overlays from this set match whichever you choose. This is how each one looks in this overlay. The presets are defined once, in the [kit](../../kit), and a test keeps this overlay in step with it.

<p><img src="docs/presets.png" alt="A grid of this overlay in each of the twenty-three style presets: Soft black, Text only, Soft white, Midnight blue, Sunset, Forest, Ocean, Rose, Neon, Cosy cabin, Cosy summer pastel, Celestial, Pastel goth, Pastel pink, Pastel sage, Fae green, Rainbow pride, Trans pride, Bi pride, Pan pride, Non-binary pride, Lesbian pride and Ace pride" width="760"></p>

| Preset | Look |
| --- | --- |
| Soft black (default) | See-through black with white text. |
| Text only (no box) | No box, frame or shadow: just the words, with a soft dark halo so they read over any picture. |
| Soft white | Frosted white with dark text. |
| Midnight blue | Deep navy with a periwinkle accent. |
| Sunset | Deep plum with orange and coral. |
| Forest | Deep green with a mint accent. |
| Ocean | Deep teal with an aqua accent. |
| Rose | Deep berry with a pink accent. |
| Neon | Near black with cyan and magenta. |
| Cosy cabin | Cream and brown, in Chicle. |
| Cosy summer pastel | Warm cream and coral, in Baloo 2. |
| Celestial | Deep purple and gold, in Cinzel. |
| Pastel goth | Charcoal and lilac, in Quicksand. |
| Pastel pink | Soft blush pink with rose, in Fredoka. |
| Pastel sage | Soft sage green with deep green, in Fredoka. |
| Fae green | Mossy green with a firefly lime accent, in Almendra. |
| Rainbow pride | A soft wash of the six rainbow stripes, in Fredoka. |
| Trans pride | Light blue, pink and white. |
| Bi pride | Magenta, purple and blue, with white text. |
| Pan pride | Pink, yellow and light blue. |
| Non-binary pride | Yellow, white, purple and black, softened so the text stays readable. |
| Lesbian pride | The orange to pink stripes. |
| Ace pride | Black, grey, white and purple, softened so the text stays readable. |

The last seven are pride presets, built from the stripes of the rainbow, trans, bi, pan, non-binary, lesbian and ace flags. The card or panel wears the flag as its background, with only as much of a wash over it as the text needs to stay readable, so flags with a black stripe come out softer. A bar is striped like the flag where an overlay has one, and the slices of a wheel and the options of a poll take their colours from the stripes in order. The colours follow each flag's published design,.

Choose **Custom** to use the colour pickers and font instead. They are ignored while a preset is chosen.

## Configuration

Every setting has a plain label in StreamElements, grouped as follows.

| Group | What it covers |
| --- | --- |
| Commands | The command word and who may use it. |
| Break | The default length (0 for no set time), the words above the clock, the headline for when you are late, whether and how the time you will be back shows, and the bar. |
| Messages | The rotating lines and how long each stays. |
| Size | The clock, headline, label, line and time sizes, the bar's thickness and the space between the parts, all in units of the box. |
| Manual controls | Buttons to start a break, add five minutes, take a minute off and clear it. |
| Look | Headline, the style preset, font, boldness, corners, outer frame, outline, shadow and Animate. |
| Custom colours | Panel, text, accent and bar colours, used when the style preset is Custom. A checkbox there also lets the Panel opacity apply to any preset, not only Custom. |
| Decorations | The shape, where they go, how many, how big, how solid (the Decoration opacity, which is its own setting and not the panel's, and 1 is fully solid), their colour, and how they move. |
| Troubleshooting | A debug log of every event to the browser-source console. |

**Sizes.** A unit is a hundredth of the box's width at 16 by 9, so the default clock, 15 units, is a little under a sixth of a 1920 by 1080 screen. In a box that is short for its width, a unit is smaller so that everything still fits.

The overlay's panel is the whole box, with square corners by default, so it works as a full-screen scene. Put your own background picture or video underneath it in OBS and the translucent panel will sit over it.

The full list, with defaults, is in [`widget/fields.json`](widget/fields.json). The colour and font pickers apply only when the style preset is **Custom**.

## Local development

There is no build step and no dependencies. Serve this overlay's folder and open the dev harness:

```sh
npm run dev
# then open http://localhost:8000/dev/
```

The harness stands in for StreamElements. It sends chat commands as a viewer, moderator or broadcaster, with quick buttons for the common ones. A **time machine** skips the clock forward, so a break ten minutes long runs out in a click. Its **Every setting** section is generated from `widget/fields.json`, so it offers exactly what StreamElements will.

At the top of the harness, **Look and export** switches the style preset on the live widget, and can download or copy a `fields.json` with your current settings as its defaults. Paste that into the Fields tab of a new custom widget in StreamElements and it starts out looking the way it does here.

The **Design** panel under the copy buttons carries a look from one overlay to the next, so it only has to be set up once. Set the style preset, font, colours, shape, frame and decorations here, press **Save this design**, then open another overlay's dev page and press **Use saved design**. It can also be copied, downloaded as `design.json` or pasted in, and **Use my saved design whenever I open an overlay** applies it for you. Only the design travels, so each overlay's own wording and behaviour settings are left as they are, and anything an overlay does not have is skipped.

The **Troubleshooting import** panel brings a problem seen on stream into the dev page. In the StreamElements widget editor open the **Data** tab, copy everything in it, paste it into the panel and press **Load this**: the settings come across as they are on stream, and anything the Data tab does not hold stays as it was. A Data tab that holds another widget's settings changes nothing.

The **box-size bar** at the bottom of the stage sets the size of the widget's box in pixels, from two number boxes or a list of common sizes, and remembers it for next time. A StreamElements widget fills whatever box you draw for it, so drawing it in different boxes is the quickest way to see how it behaves. It is the same bar on every overlay's dev page.

The harness must be served over http rather than opened as a file, and fonts come from Google Fonts. It also shows a Ko-fi support button in the corner. That button belongs to the harness only and is not part of the widget, so it never appears on stream.

## Testing

```sh
npm test
```

This runs the real `widget/widget.js` headlessly against a small mock of the page and StreamElements, with a clock the test controls, and exits non-zero on any failure. It covers every way of writing a length of time or a time of day, a break with no set time and one with a time, running late, changing and clearing a break, the bar, the rotating lines, who may do what, a break that ran past its time while the overlay was closed, every look setting and saving across a refresh. It also checks the style presets against the shared palette, and that every setting in `fields.json` is read by the widget and every button does something.

## Project layout

```
widget/   the widget: HTML, CSS, JS and the StreamElements fields
dev/      the local dev harness
test/     the automated tests
docs/     screenshots used in this README
```

## Compatibility and limitations

The widget uses the StreamElements events `onWidgetLoad` and `onEventReceived` with `message` and `widget-button`, and `SE_API.store`.

The clock is timed by the computer running the overlay, and so is a time of day such as `20:30`. If you stream from one computer and your chat commands are read on another, they still agree, because the times are saved as moments and not as a number of seconds left.

A StreamElements widget can read chat but cannot write to it, so a command gives no reply in chat. You will see the clock change on screen straight away.

It does not switch your OBS scene for you. You change to your Be right back scene yourself, and the overlay shows how long you have been gone or when you will be back.

The JavaScript is plain ES5, so it can be pasted straight into the StreamElements editor.

## Related overlays

These overlays share the same default look and the same twenty-three style presets, so they sit together on one stream.

- [Stream Start Countdown Overlay](../start-countdown): a starting soon screen with a countdown to when you go live.
- [Rotating Panel Overlay](../rotating-panel): socials and chat commands that take turns on one panel.
- [Be Right Back Overlay](../be-right-back): a break screen with a clock that counts down to your return, or up the time you have been away, until you are back.
- [Reminder Overlay](../reminder): reminders you set from chat, which stay on screen until cleared.
- [Sub Goals Overlay](../sub-goals): sub and bits goals that fill as chat reaches them.
- [Subathon Overlay](../subathon): a subathon clock with a cap, power-ups and sub goals.
- [Spin Wheel Overlay](../spin-wheel): a wheel for giveaways, raffles and forfeits.
- [Chat Poll Overlay](../chat-poll): quick polls voted on by typing an option.
- [Squat Tracker Overlay](../squat-tracker): a running count driven by gifted sub bombs.
- [Rage Bar Overlay](../rage-bar): a bar chat fills with subs, bits and channel points.
- [Chat Counter Overlay](../counter): a counter chat commands change, for deaths, wins and anything else.
- [Leaderboard Overlay](../leaderboard): top gifters, cheerers and tippers.
- [Hype Meter Overlay](../hype-meter): a meter that chat activity fills, with levels.
- [Recent Activity Overlay](../recent-activity): the latest subs, gifts, bits, tips, follows and raids.
- [Stream Goals Overlay](../stream-goals): sub and bits goals that start again for each stream.
- [Chat Feed Overlay](../chat-feed): on-screen chat with profile pictures and pronouns.
- [Camera Overlay](../camera): a framed window for your camera with a nameplate, and a cover that you and your moderators control from chat.
- [Now Playing Overlay](../now-playing): what you are playing, from Last.fm, Tuna, Spotify or Pear Desktop, with album art and a progress bar.

## Support

If this saves you time, you can support its development on Ko-fi:

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-ff38b8?logo=ko-fi&logoColor=white)](https://ko-fi.com/journeyingjordan)

Thanks for using it.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

[MIT](../../LICENSE). The copyright notice, including the Ko-fi link, must be kept in copies and substantial portions of the code.
