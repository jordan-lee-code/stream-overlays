# overlay-kit

The standards shared by a set of StreamElements overlays: one table of style presets, the contrast rules every preset has to meet, and a tool that keeps each overlay in step with them.

The overlays are plain widgets that you paste into StreamElements, so each carries its own copy of the shared parts and has nothing to install. That made it easy to use and easy to let drift. This repo is where the shared parts live, and where drift gets noticed.

## What is in it

- **The style presets** ([`src/presets.js`](src/presets.js)): twenty-two of them, from Soft black to eight pride flags, as one table, with a generator for the shape each overlay's code uses.
- **The contrast standards** ([`src/contrast.js`](src/contrast.js)): text 4.5 or better against its panel and accent 3.5 or better, tried over both a dark and a light backdrop, with their own measure for the pride presets.
- **The sync tool** ([`bin/overlay-kit.js`](bin/overlay-kit.js)): brings an overlay's palette table, dropdown, expected test data and shared test mock in line with the kit, or reports where it has drifted.
- **The shared sources** ([`shared/`](shared)): the helper code, card styles, test mock and dev harness template the newer overlays were made from.
- **The standards** ([`docs/STANDARDS.md`](docs/STANDARDS.md)): setting names, commands, how events are read, state, look, tests and releases, written down.

## Using it

You need Node.js 18 or newer. There is nothing to install.

```sh
git clone https://github.com/jordan-lee-code/overlay-kit.git
node overlay-kit/bin/overlay-kit.js list                          # the presets
node overlay-kit/bin/overlay-kit.js check-contrast                # every preset against the standards
node overlay-kit/bin/overlay-kit.js check-presets path/to/overlay # does this overlay match? (exit 1 if not)
node overlay-kit/bin/overlay-kit.js sync-presets path/to/overlay  # bring it in line
```

`sync-presets` rewrites only what it owns: the `PRESETS` table in the widget, the `themePreset` dropdown in `widget/fields.json`, the palette the tests expect, and `test/mock.js`. Code around the table is left alone. It works out the shape an overlay needs from the folder's name, and anything it does not know is treated as a clock-shaped overlay. `--kind` and `--file` override that.

## How the overlays use it

Each overlay's CI clones a tagged release of this repo and runs `check-presets` on itself, so an overlay whose table differs from the kit's fails the build until it is synced. The check is pinned to a tag, so the kit can move on without breaking an overlay that has not caught up.

## Changing a palette

See [CONTRIBUTING.md](CONTRIBUTING.md). The short version: change it in `src/presets.js`, make `npm run check-contrast` pass, tag a release, then sync each overlay.

## The overlays

- [Sub Goals Overlay](https://github.com/jordan-lee-code/sub-goals-overlay)
- [Subathon Overlay](https://github.com/jordan-lee-code/subathon-overlay)
- [Spin Wheel Overlay](https://github.com/jordan-lee-code/spin-wheel-overlay)
- [Chat Poll Overlay](https://github.com/jordan-lee-code/chat-poll-overlay)
- [Squat Tracker Overlay](https://github.com/jordan-lee-code/squat-tracker-overlay)
- [Rage Bar Overlay](https://github.com/jordan-lee-code/rage-bar-overlay)
- [Chat Counter Overlay](https://github.com/jordan-lee-code/counter-overlay)
- [Leaderboard Overlay](https://github.com/jordan-lee-code/leaderboard-overlay)
- [Hype Meter Overlay](https://github.com/jordan-lee-code/hype-meter-overlay)
- [Recent Activity Overlay](https://github.com/jordan-lee-code/recent-activity-overlay)
- [Stream Goals Overlay](https://github.com/jordan-lee-code/stream-goals-overlay)
- [Reminder Overlay](https://github.com/jordan-lee-code/reminder-overlay)

## Testing

```sh
npm test
```

The tests check the table and the pride flags, the contrast standards, every generated table as real JavaScript, and a full sync of a temporary overlay: that check mode writes nothing, that a sync brings it in line, and that a second sync changes nothing.

## Support

If this saves you time, you can support its development on Ko-fi:

[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-ff38b8?logo=ko-fi&logoColor=white)](https://ko-fi.com/journeyingjordan)

Thanks for using it.

## License

[MIT](LICENSE). The copyright notice, including the Ko-fi link, must be kept in copies and substantial portions of the code.
