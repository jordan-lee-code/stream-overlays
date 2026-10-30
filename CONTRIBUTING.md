# Contributing

Thank you for taking an interest in this project. Bug reports, fixes and ideas are all welcome.

## Getting set up

You need Node.js 18 or newer for the build and the tests, and Python 3 (or any static file server) for the dev harness.

```sh
npm install       # fetches the Sub Incentives module this widget is built on
npm test          # builds widget/ and runs the automated tests
npm run dev       # serve the project, then open http://localhost:8000/dev/
```

The dev harness stands in for StreamElements, and has a time machine, so you can try changes without going live or waiting out a long subathon.

## How the pieces fit

The clock lives in `src/`. The goals come from the [Sub Incentives module](https://github.com/jordan-lee-code/sub-goals-overlay), which is installed from GitHub at a fixed version. `npm run build` composes the two into `widget/`, which is what gets pasted into StreamElements. `widget/` is generated and committed, so please change `src/` and rebuild rather than editing it by hand. CI fails if the two disagree.

Anything about the goals themselves (how subs are counted, the panel, the commands under `!incentive`) belongs in the module, so every overlay that uses it benefits. To move to a newer version of it, change the version in `package.json`, run `npm install` and `npm run build`, and commit the result.

## Making a change

1. Open an issue first for anything large, so the direction can be agreed before you spend time on it.
2. Keep `src/clock.js` in plain ES5 style (`var`, function expressions, no modules or arrow functions). It is pasted straight into the StreamElements editor, so there is no transpile step.
3. Keep the widget free of run-time dependencies.
4. When you add a clock setting, add it to `src/fields.json` with a `tm` prefix and a "Clock: " group, and read it in `src/clock.js`.
5. Add or update tests in `test/`, and make sure `npm test` passes.
6. If behaviour changes, update the README.
7. The twelve style presets are shared by every overlay in this set, with identical colours, so they look cohesive on one stream. If you change a palette, make the same change in the other overlays and regenerate the gallery in `docs/presets.png`.

## Reporting a bug

Please include what you expected, what happened, and your widget settings if they are relevant. If the problem involves subs, bits or other events not being handled correctly, tick the debug option under Clock: Troubleshooting and include the logged events from the browser-source console, with any usernames removed.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
