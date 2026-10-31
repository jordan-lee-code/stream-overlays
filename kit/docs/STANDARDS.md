# Standards

These are the patterns the overlays in this set follow, written down so a new overlay, or a change to an old one, can follow them too. Where an older overlay differs, that is said plainly under [Known differences](#known-differences).

## Style presets

Every overlay offers the same twenty-two presets, with the same colours and fonts, in the same order, under a setting called `themePreset` whose default is `glass` (Soft black). The last choice is `custom`, which uses the overlay's own colour pickers and font instead. The colour pickers are ignored for every other choice.

The table lives in [`src/presets.js`](../src/presets.js). Each overlay holds a generated copy in its widget, in the shape its own code reads, and the sync tool keeps the two in step.

### Contrast

Every preset has to meet these, which `overlay-kit check-contrast` checks and CI enforces:

| What | Needs | Why |
| --- | --- | --- |
| Text against its panel | 4.5 or better | WCAG AA for body text. |
| Accent against its panel | 3.5 or better | The accent colours headings, big numbers and bars, which are large. |

A see-through panel sits over whatever is on stream, which is not known, so it is tried over both a dark and a light backdrop and the worse result counts.

### Pride presets

The seven pride presets (rainbow, trans, bi, pan, non-binary, lesbian and ace) are designed from the stripes of their flags, taken from each flag's published design.

- The panel's background is the flag as a soft gradient, with a scrim over it. The scrim is the weakest one that keeps the text at 4.6 or better against every stripe, worked out in `designPanel`, in white or dark text as the flag needs. Trans, bi and pan need no scrim. A flag with a black stripe, such as ace and non-binary, needs a lighter wash.
- A plain solid colour stays as the fallback, so anything that only understands a colour is unaffected.
- A bar is striped like the flag, with a thin dark outline so a pale stripe keeps its edge, and only the pride presets get either.
- A wheel's slices and a poll's options take their colours from the stripes in order.

## Settings

A setting that more than one overlay needs has the same name, label and group everywhere.

| Setting | Meaning |
| --- | --- |
| `command` | The command word, for example `!count`. |
| `whoCanManage` | `broadcaster` or `mods`. The broadcaster can always manage. |
| `title`, `showTitle` | The heading text and whether to show it. |
| `themePreset` | One of the presets above, or `custom`. |
| `fontFamily` | A Google font, used when the preset is Custom. |
| `weight`, `radius`, `pad` | Boldness, corner roundness and padding. |
| `borderWidth`, `borderColor`, `shadow` | The outline and the shadow. |
| `animate` | One switch for all motion. When it is off, nothing moves or eases. |
| `fit` | Shrinks the whole card until it fits the box it is given, and never enlarges it. |
| `colorPanel`, `panelOpacity`, `cText`, `cAccent`, `cTrack`, `cWarn` | The Custom colours. |
| `mute` | Silences every sound. |
| `debug` | Logs every event to the browser-source console. |

Groups are named **Commands**, then the overlay's own groups, then **Look**, **Custom colours**, **Manual controls**, **Sounds** and **Troubleshooting**.

Every setting has a plain label that says what it does, and a Custom colour's label says that it applies only when the preset is Custom. Every button has a **Test** or **Manual controls** home, and every button does something.

### Shared helpers

The small functions every widget needs (`str`, `txt`, `num`, `bool`, `clamp`, `pad2`, `byId`, `rgba` and `rolesOf`) are one block in [`shared/common.js`](../shared/common.js), between the lines `shared by every overlay in this set` and `end of the shared primitives`. Every overlay carries a copy, `overlay-kit sync-presets` keeps the copies identical, and `check-presets` fails if one has drifted, so a fix to a helper is made once and spread. Each overlay's own code goes outside the block.

### Checking it

`overlay-kit check-settings` runs on every overlay as part of `npm test`. An overlay need not have every setting above, but one that has a setting with a standard name must give it the standard type and default, every setting must be in a group, and a second command word is refused (there is one `command` and verbs after it), and the older names for the same ideas (`animations`, `soundsEnabled`, `colorText`, `colorAccent`, `colorTrack`, `colorBg` and `boxOpacity`) are refused, with a message that says what replaced them.

An overlay can keep a deliberate difference by naming it in its `package.json`, with the reason:

```json
"overlay-kit": { "exceptions": { "debug": "Why this overlay differs." } }
```

An exception with no reason is itself an error, so a difference is always explained. The Subathon has one, a second command word, because it is two widgets in one (goals and clock). The Rage Bar has another: its `debug` starts on, because channel point redemptions are not documented for custom widgets and the first real one needs capturing.

### A blank is a blank

StreamElements sends an empty string for a field the streamer has cleared. A wording field where empty is a real choice, such as a tag, a currency symbol, a suffix or a title, must treat `""` as empty and use the default only when the setting is missing. The helper is `txt()`. A command word or a reward title is the opposite: blank cannot mean anything, so it falls back to its default.

## Commands

- One base word with verbs after it: `!reminder 15m clean room`, `!hype add 50`, `!leaderboard reset bits`.
- The bare base word is safe for anyone and does something harmless, such as making the title pop. Everything else needs `whoCanManage`.
- The base word matches whole words only, so `!sax` is not `!sa`.
- Anything unreadable changes nothing and says nothing.
- A widget cannot write to chat, so it never pretends to. Where chat should see something, the README says how to add a chatbot command.

## Events

- A gift bomb is counted once, at its real size. StreamElements sends one announcement with `bulkGifted` and the real `amount`, then one follow-up per recipient with `isCommunityGift` whose `amount` is a streak figure such as 170. Only the announcement counts, credited to the gifter.
- A single gifted sub counts one, whatever its `amount` says. Someone subscribing for themselves is not a gift.
- Anonymous gifters and cheerers are left out, or counted together under a name, by a setting.
- Empty and negative amounts count for nothing.

## State

- State is saved with `SE_API.store` under a key like `reminder_v1`, so a change in its shape can move to `_v2` without reading old data wrongly.
- Reading it back must tolerate anything: missing fields, the wrong types, an old shape. A bad save never breaks the widget.
- Anything that depends on time is saved as a point in time and not as a number of seconds left, so a refresh, or the overlay being closed, does the right thing.

## Look

- A widget fills the box it is given and sizes its text in container query units (`cqw`) from a **size** setting, so it looks the same at any box size. The container is an outer root, because a container's own `cqw` resolves against its parent.
- Colours reach the CSS through custom properties set from the settings: `--w-bg`, `--w-text`, `--w-accent`, `--w-track`, `--w-alarm`, `--w-bgimg`, `--w-flag` and `--w-edge`.
- The **animate** switch adds a `no-motion` class that removes every animation and transition.
- A widget fits the box it is given, at any size and shape. The text scales with the box's width, and the **fit** switch covers the height: when the card is taller than the box it is shrunk until it fits, with CSS `zoom` so that it stays full width and its text, padding and corners shrink together, and it is never enlarged. The zoom is searched for and not calculated, because the height does not shrink in step with it as the text wraps differently. The shared `fitToBox` and `watchFit` do this, and re-fit when the box is resized, when the content changes and when the font has loaded. A card that shares its box with something else gives `watchFit` a `share` of the box, and a function to call when the zoom changes. CSS `zoom` is supported by Chromium, which OBS and StreamElements use, and by current Firefox; a browser without it simply does not shrink the card. A card that already fills its box (a chat feed) has nothing to shrink, and a widget with its own fitting (the poll, the sub goals, the wheel) keeps it.

## Tests

Each overlay's tests run its real `widget/widget.js` headlessly against a small mock of the page and StreamElements, with a clock the test controls, and drive it through `onWidgetLoad` and `onEventReceived`. The shared mock is [`shared/mock.js`](../shared/mock.js). A newer overlay's test checks, as well as its own behaviour:

- every preset's label, panel, text, accent, font, flag and background image against the shared table, and that Custom uses the colour pickers;
- that every setting is read by the widget and every button is handled;
- that every setting is in a group;
- that the licence notice is present and the docs use no em or en dashes.

### Time in tests

A test never waits on the real clock. A suite that sleeps through a widget's timers takes minutes, and one that waits a fixed time can fail on a slow machine when the wait turns out to be a little short. The shared [`shared/clock.js`](../shared/clock.js) is a pretend clock: the widget's `setTimeout` and `setInterval` run on it, and `await clock.advance(ms)` runs every timer that falls due in that time, in order, and returns at once. Promises settle between timers, so the store and the pretend network answer as they would have.

- A suite that gives the widget a still date and moves it by hand (a countdown, a day number) keeps its own `Date` and uses the clock only for timers.
- A suite whose widget measures elapsed time with `Date.now()` gives it `clock.Date`, whose time is the clock's.
- A test that needs something to have happened waits for it with `advance` in a short loop, and never for a fixed time that is merely long enough.

The kit copies `clock.js` into each overlay's `test/` folder with `sync-presets`, next to the mock, so a copy that differs is reported.

`scripts/check-scaling.js` draws every overlay in headless Chromium in boxes of four shapes and fails if any of what is visible runs outside its box. It is its own job in CI, because it needs a browser. A box of 400 by 90 is left out on purpose: it cannot hold a clock and a list of goals together, whatever the widget does.

One exception is a test that needs a real browser. The Chat Poll's layout test measures real layout in headless Chromium, so it runs its scenarios side by side and waits for the browsers, not for time.

## The dev harness

Each overlay has a harness for trying it without going live: it fires the events StreamElements would send, including the per-recipient follow-ups of a gift bomb, sends chat commands as a viewer, moderator or broadcaster, shows the saved state, and generates an **Every setting** panel from `fields.json`. Where time matters it has a time machine. At the top, **Look and export** switches the style preset on the live widget and downloads or copies a `fields.json` with the current settings as its defaults. The template is in [`shared/`](../shared).

Every dev page also loads [`shared/copy-panel.js`](../shared/copy-panel.js), which adds a panel of four buttons at the top, one for each tab of StreamElements' custom widget editor: `widget.html`, `widget.css`, `widget.js` and `fields.json` with the settings as they are configured on the page, preset included. The page's own script offers its settings to the panel as `window.__exportFields`, which is its existing export, and the panel fetches the other three files from the widget folder. The kit copies the panel into each overlay's `dev/` folder, and a test checks that every dev page loads it.

The look of the page is shared in the same way. [`shared/dev.css`](../shared/dev.css) styles the stage on its transparency check and the controls beside it, including the older class names (`.field`, `.alt`, `.go`), so every dev page looks alike, and a page adds only the width and height of its own stage in one short style block. [`shared/box-size.js`](../shared/box-size.js) adds the box-size bar at the bottom of the stage pane: width and height in pixels, a list of common sizes that includes the ones the scaling check uses, and a reset, remembered per overlay. It only changes the size of the box the widget is drawn in, as dragging the widget's handles does in StreamElements, so no harness needs a stage-size control of its own. A page that scales its stage to fit the pane listens for the window's `resize` event, which the bar sends after each change. The kit copies both files into each overlay's `dev/` folder, and tests check that every dev page loads them and has no panel styles or stage-size control of its own.

## The website

GitHub Pages serves each overlay's dev page and widget files, so nobody has to download the repository: `scripts/build-site.js` copies `widget/` and `dev/` from each overlay, adds a landing page with a card for each, and the Pages workflow publishes it whenever `main` changes. A card's picture is `docs/card.png`, drawn from the overlay's `docs/gallery.json` scene with `overlay-kit gallery <dir> --card`, and every overlay needs one. Text on a card comes from the overlay's `package.json` and README title and is escaped, never run as markup.

## Releases

- The repository has one version, and a release is a git tag on it. Each overlay's `package.json` carries the same version.
- A change anyone pasting a widget into StreamElements would care about gets a line in the root `CHANGELOG.md`, because they decide by that whether to update.
- The Subathon is built from the Sub Goals overlay next to it, so a fix to the goals reaches the subathon the next time it is built.

## Known differences

The standards above came from the newer overlays, and the older ones have been brought towards them. These differences remain, and are deliberate or not yet done:

- **Richer colour settings.** The Spin Wheel, Chat Poll, Rage Bar, Squat Tracker and Sub Goals overlays let you set the colour of each part separately (the wheel alone has about thirty), as well as the standard `colorPanel`, `cText`, `cAccent` and `cTrack`. Those extra settings are additions, not conflicts, and they are not in the standard.
- **The wheel's pills** carry the flag as a background but are small, so a flag shows only as colour on them.
