# Overlay kit

The standards shared by the overlays in this repository: one table of style presets, the contrast rules every preset has to meet, and a tool that keeps each overlay in step with them.

The overlays are plain widgets that you paste into StreamElements, so each carries its own copy of the shared parts and has nothing to install. That made them easy to use and easy to let drift. This folder is where the shared parts live, and where drift gets noticed.

## What is in it

- **The style presets** ([`src/presets.js`](src/presets.js)): twenty-one of them, from Soft black to seven pride flags, as one table, with a generator for the shape each overlay's code uses.
- **The contrast standards** ([`src/contrast.js`](src/contrast.js)): text 4.5 or better against its panel and accent 3.5 or better, tried over both a dark and a light backdrop, with their own measure for the pride presets.
- **The tool** ([`bin/overlay-kit.js`](bin/overlay-kit.js)): brings an overlay's palette table, dropdown, expected test data and shared test mock in line with the kit, reports where it has drifted, checks the contrast, and renders each overlay's preset gallery.
- **The shared sources** ([`shared/`](shared)): the helper code, card styles, test mock and dev harness template the newer overlays were made from.
- **The standards** ([`docs/STANDARDS.md`](docs/STANDARDS.md)): setting names, commands, how events are read, state, look, tests and releases, written down.

## Using it

You need Node.js 18 or newer. There is nothing to install. From the root of the repository:

```sh
node kit/bin/overlay-kit.js list                              # the presets
node kit/bin/overlay-kit.js check-contrast                    # every preset against the standards
node kit/bin/overlay-kit.js check-settings overlays/counter   # do its settings follow the standard?
node kit/bin/overlay-kit.js check-presets overlays/counter    # does this overlay match? (exit 1 if not)
node kit/bin/overlay-kit.js sync-presets overlays/counter     # bring it in line
node kit/bin/overlay-kit.js gallery overlays/counter          # redraw docs/presets.png (needs Chromium)
```

`sync-presets` rewrites only what it owns: the `PRESETS` table in the widget, the `themePreset` dropdown in `widget/fields.json`, the palette the tests expect, and `test/mock.js`. Code around the table is left alone. It works out the shape an overlay needs from the folder's name, and anything it does not know is treated as a clock-shaped overlay. `--kind` and `--file` override that.

`gallery` reads `docs/gallery.json` in the overlay's folder, which says what to draw: a width and height, settings to override, and a short script that fires a few events. It renders the overlay once in every preset and lays them out as the picture in its README.

## How the overlays use it

`npm test` at the root runs `check-presets` on every overlay, so an overlay whose table differs from the kit's fails until it is synced.

## Changing a palette

See [CONTRIBUTING.md](../CONTRIBUTING.md). The short version: change it in `src/presets.js`, make `npm run check-contrast` pass, sync each overlay, and regenerate its gallery.

## The overlays

- [Sub Goals Overlay](../overlays/sub-goals)
- [Subathon Overlay](../overlays/subathon)
- [Spin Wheel Overlay](../overlays/spin-wheel)
- [Chat Poll Overlay](../overlays/chat-poll)
- [Squat Tracker Overlay](../overlays/squat-tracker)
- [Rage Bar Overlay](../overlays/rage-bar)
- [Chat Counter Overlay](../overlays/counter)
- [Leaderboard Overlay](../overlays/leaderboard)
- [Hype Meter Overlay](../overlays/hype-meter)
- [Recent Activity Overlay](../overlays/recent-activity)
- [Stream Goals Overlay](../overlays/stream-goals)
- [Reminder Overlay](../overlays/reminder)

## Testing

```sh
npm test
```

The tests check the table and the pride flags, the contrast standards, every generated table as real JavaScript, and a full sync of a temporary overlay: that check mode writes nothing, that a sync brings it in line, and that a second sync changes nothing.

## License

[MIT](../LICENSE). The copyright notice, including the Ko-fi link, must be kept in copies and substantial portions of the code.
