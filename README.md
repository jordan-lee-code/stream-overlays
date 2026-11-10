# Stream Overlays

A set of overlays for Twitch streams, for StreamElements and Mix It Up. Each is plain JavaScript with no dependencies and nothing to install: with StreamElements you paste its four files into a custom widget, and with Mix It Up you bring in one widget. They share one design, twenty-three style presets including seven pride flags, so they look like one family on a stream.

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

## Using an overlay with Mix It Up

Choose Mix It Up at the top of the website and each overlay's page gives you a widget to bring into Mix It Up, in the form Mix It Up itself uses for a Custom widget.

1. Set the overlay up on its page and press **Download the .miuoverlay file**. It is the overlay's own HTML, CSS and JavaScript with your settings in one custom property, packed as the JSON Mix It Up reads. **Copy the widget** gives the same JSON to paste. **Copy the HTML**, **Copy the CSS**, **Copy the JavaScript** and **Copy the Settings property** are there too, for a Custom widget made by hand.
2. In Mix It Up, open **Overlay Widgets** and use its import overlay button on the file. Mix It Up's documentation does not describe the file, so if it will not take it, make a Custom widget and paste the three boxes instead.
3. Edit the widget, set **Display Option** to **Single Widget URL**, save it, and click the link icon on the widget to get its address. Use one address for each overlay, because widgets sharing the default overlay page share one page and their functions would meet.
4. In OBS, add a **Browser** source, paste the address into **URL**, and give it the width and height of the box you want.

An overlay is not rewritten for this. `mixitup.js` goes in front of the overlay's JavaScript and defines the functions Mix It Up calls (`ChatMessageReceived`, `Follow`, `Raid`, `Subscription`, `SubscriptionGifted`, `MassSubscriptionGifted`, `TwitchBits` and `Donation`), turning each call into the event StreamElements sends. What an overlay remembers is kept in the page's own storage.

Moving over from StreamElements? On the overlay's page there is a box for the Data tab of the widget editor there: paste it in and the settings come across as they are on stream. The Fields tab works too.

How each part of StreamElements is matched:

| In StreamElements | In Mix It Up |
| --- | --- |
| The settings in the widget editor | The settings are packed into the widget from the overlay's page, and **Bring my settings across** loads them from a Data tab. |
| Chat commands, and who may use them | The same. Chat is read from the fields of a real Mix It Up chat message, so the streamer, moderators and subscribers are known. |
| Subs, gifts, bits, tips, follows and raids | The same events, through the functions Mix It Up calls. |
| The buttons in the editor, such as Manual controls | Each button is a function a Mix It Up command can run: add an **Overlay** action, choose **Run Widget Function**, pick the widget and give the button's name, such as `btnPlus`. `PressButton` takes the name as a parameter instead. The overlay's page lists every button. |
| Channel point rewards (Rage Bar) | Run the function `Redemption` from a Mix It Up channel point command, with the reward's title as its parameter. |
| Bits spent through Tangia | Run the function `TangiaBits` from a command that Mix It Up's own webhook triggers (see below), with a parameter whose value is `$webhookpayload`, which is the whole JSON the webhook received. It counts as bits do on every overlay that counts bits. StreamElements has no equivalent. |
| The debug setting, which logs to a console | The same setting shows what Mix It Up sent on the overlay itself, newest first, since a browser source has no console. |
| What an overlay remembers | Kept in the page's own storage, as in a browser source. |

What is not the same:

- **Only chat is known for certain.** Mix It Up's documentation does not list what is in its other events, so a follow, raid, sub, gift, bits or donation is read by trying the names a field is likely to have. If one does not show, turn on the overlay's debug setting, trigger it, and the overlay will show what Mix It Up sent, so the name can be added.
- **Tangia's bits** can be counted in Mix It Up, with a few steps in Mix It Up and in Tangia. They are set out in [Counting Tangia bits in Mix It Up](#counting-tangia-bits-in-mix-it-up) below.
- **YouTube and Kick events** are not used. The overlays are written around Twitch events.
- **Whether Mix It Up takes the pasted widget** is not something its documentation says. If it does not, make a Custom widget and paste the three boxes instead.

## Counting Tangia bits in Mix It Up

Bits spent on Tangia interactions go through a Twitch extension, so StreamElements and Mix It Up do not see them as cheers. This counts them in Mix It Up, using a Tangia alert that tells a Mix It Up webhook how much was spent. It works for Mix It Up only, because StreamElements has no way to receive it. Nothing here was documented by Tangia, so it was found by trying, and the last part below says what to check.

You need the Stream Goals widget (or any overlay that counts bits) already in Mix It Up, a Tangia account, and about ten minutes.

### 1. In Mix It Up: a webhook that counts bits

1. Open the **Webhooks** page and click **Add Webhook**.
2. Click **Add Command**, then add an **Overlay** action. If you only see "Overlay (Images & Videos)", open it and look for the widget options in its type list: the one you want is **Run Widget Function**.
3. In **Run Widget Function**, pick your Stream Goals widget and set the function name to `TangiaBits`.
4. Add one parameter: set its name to `payload` and its value to `$webhookpayload`. That is the whole JSON the webhook receives, and `TangiaBits` finds the amount in it. You do not need Mix It Up's JSON mapping.
5. Save the command, then click **Copy URL**. It looks like `https://desktop.api.mixitup.bot/api/webhook/ID?secret=SECRET`. Anyone who has it can trigger the command, so keep it to yourself.

To check this half before involving Tangia, send a test from a terminal. The goal should go up by 250:

```
curl -X POST -H "Content-Type: application/json" -d '{"amount":250,"user":"Test"}' "PASTE-THE-URL-HERE"
```

### 2. In Tangia: an alert that sends the amount

1. Log in to Tangia and open **Alerts** (Better Alerts).
2. Make a new alert flow. Pick the **trigger** that fires when a viewer uses an interaction. Do not pick the plain bit cheer trigger, which is an ordinary Twitch event that is already counted, so the bits would be counted twice.
3. Add an **action**, and choose the one that shows a website in an iFrame.
4. For its address, paste the one below, with your webhook URL from step 1 on the end. Paste the URL exactly as Mix It Up gave it:

   ```
   https://jordan-lee-code.github.io/stream-overlays/tangia-relay.html#hook=PASTE-THE-WEBHOOK-URL-HERE
   ```

5. Make the iFrame as small as Tangia allows, and give it a duration of at least 5 seconds. The page needs a moment to send, and nothing on it is visible.
6. Save the flow, and make sure it is switched on.

The page takes whatever amount Tangia sends. Tangia adds the trigger's properties to the address as query parameters, and the page looks for one called `amount`, `bits`, `price`, `cost`, `credits`, `value` or `total` and sends it to Mix It Up as the amount. The part after the `#` is never sent to the site, so the secret stays between you, Tangia and Mix It Up. The page only ever posts to a Mix It Up webhook address.

### 3. Test it, then check the amount

1. Add `?debug=1` before the `#` in the Tangia address: `...tangia-relay.html?debug=1#hook=...`. Then use Tangia's test button on the alert, or spend something on an interaction.
2. The page then shows a box in Tangia's browser source in OBS. It lists what Tangia sent, what the page sent on, and Mix It Up's answer.
   - `Mix It Up answered 204 (accepted)`: it worked, and the goal goes up.
   - `No bits or price amount was found`: Tangia's property has a name the page does not look for. The box lists what it received, so open an issue with that line.
   - `No Mix It Up webhook address`: the address after `#hook=` is not a Mix It Up webhook URL. Copy it again.
3. Look at the amount the box shows for a **real** purchase, not only the test button, which sends a sample. If it is a price in Tangia credits and not in bits, the count will be in credits.
4. When it counts as you expect, take `?debug=1` out, so nothing shows on stream.

If you think the webhook address has leaked, delete the webhook in Mix It Up, make a new one, and update the address in Tangia.

### If nothing happens

- Run the **curl** test above. If the goal does not move, the problem is in Mix It Up: check the command is saved, points at the right widget and that Mix It Up is open.
- If curl works but Tangia does not, open the address in an ordinary browser tab with `?debug=1`. It should show "sending" and the answer. If it does not, the address is wrong.
- If that works but Tangia's alert does nothing, check that the flow is saved and on, that its trigger fired, and that the iFrame lasts at least 5 seconds.

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
