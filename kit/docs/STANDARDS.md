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

The eight pride presets (rainbow, progress, trans, bi, pan, non-binary, lesbian and ace) are designed from the stripes of their flags, taken from each flag's published design.

- The panel's background is the flag as a soft gradient, with a scrim over it. The scrim is the weakest one that keeps the text at 4.6 or better against every stripe, worked out in `designPanel`, in white or dark text as the flag needs. Trans, bi and pan need no scrim. A flag with a black stripe, such as ace and non-binary, needs a lighter wash.
- A plain solid colour stays as the fallback, so anything that only understands a colour is unaffected.
- A bar is striped like the flag, with a thin dark outline so a pale stripe keeps its edge, and only the pride presets get either.
- A wheel's slices and a poll's options take their colours from the stripes in order.
- The progress flag's bars are its six rainbow stripes, because its chevron is a separate shape and not stripes.

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
| `colorPanel`, `panelOpacity`, `cText`, `cAccent`, `cTrack`, `cWarn` | The Custom colours. |
| `mute` | Silences every sound. |
| `debug` | Logs every event to the browser-source console. |

Groups are named **Commands**, then the overlay's own groups, then **Look**, **Custom colours**, **Manual controls**, **Sounds** and **Troubleshooting**.

Every setting has a plain label that says what it does, and a Custom colour's label says that it applies only when the preset is Custom. Every button has a **Test** or **Manual controls** home, and every button does something.

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

## Tests

Each overlay's tests run its real `widget/widget.js` headlessly against a small mock of the page and StreamElements, with a clock the test controls, and drive it through `onWidgetLoad` and `onEventReceived`. The shared mock is [`shared/mock.js`](../shared/mock.js). A newer overlay's test checks, as well as its own behaviour:

- every preset's label, panel, text, accent, font, flag and background image against the shared table, and that Custom uses the colour pickers;
- that every setting is read by the widget and every button is handled;
- that every setting is in a group;
- that the licence notice is present and the docs use no em or en dashes.

A test that needs time passes a pretend clock forward and does not wait.

## The dev harness

Each overlay has a harness for trying it without going live: it fires the events StreamElements would send, including the per-recipient follow-ups of a gift bomb, sends chat commands as a viewer, moderator or broadcaster, shows the saved state, and generates an **Every setting** panel from `fields.json`. Where time matters it has a time machine. At the top, **Look and export** switches the style preset on the live widget and downloads or copies a `fields.json` with the current settings as its defaults. The template is in [`shared/`](../shared).

## Releases

Going forward:

- A release is a git tag, and the package version moves with it.
- Anything people paste into StreamElements gets a line in a changelog, because they decide by that whether to update.
- An overlay built on another by composition, as the Subathon Overlay is on the Sub Goals Overlay, pins it by tag. This one is already true.

## Known differences

The standards above came from the newer overlays and then the older ones were brought towards them. These differences are known and deliberate, or not yet done:

- **Older overlays' setting names.** The Sub Goals, Spin Wheel, Chat Poll, Squat Tracker and Rage Bar overlays use their own names for some Custom colours and have groups called Theme or Panel. Renaming a setting would reset the saved settings of anyone using it, so it needs a migration, not a rename.
- **Command words.** The Spin Wheel, Chat Poll and Rage Bar overlays use a separate word for each action (`!spinopen`, `!voteend`, `!barlock`) and not one word with verbs. Changing it would break people's chat habits.
- **Helpers.** The older overlays each carry their own copy of the small helper functions. The newer ones share one block, kept as [`shared/common.js`](../shared/common.js).
- **Releases.** Only the Sub Goals Overlay, which the Subathon Overlay depends on, has tags. The others are still at version 1.0.0 with no changelog.
- **The wheel's pills** carry the flag as a background but are small, so a flag shows only as colour on them.
