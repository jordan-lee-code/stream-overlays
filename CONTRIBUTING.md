# Contributing

Thank you for taking an interest in this project. Bug reports, fixes and ideas are all welcome.

## Getting set up

There are no dependencies to install. You need Node.js 18 or newer for the tests and the build, and Python 3 (or any static file server) for the dev harness.

```sh
npm test          # run the automated tests
npm run build     # build the optional overlay import file into dist/
npm run dev       # serve the project, then open http://localhost:8000/dev/
```

The dev harness stands in for StreamElements, so you can try changes without going live.

## Making a change

1. Open an issue first for anything large, so the direction can be agreed before you spend time on it.
2. Keep `widget/widget.js` in plain ES5 style (`var`, function expressions, no modules or arrow functions). It is pasted straight into the StreamElements editor, so there is no build or transpile step.
3. Keep the widget free of dependencies.
4. When you add a setting, add it to `widget/fields.json` and read it in `widget/widget.js`.
5. Add or update tests in `test/`, and make sure `npm test` passes.
6. If behaviour changes, update the README.
7. The fourteen style presets are shared by every overlay in this set, with identical colours, so they look cohesive on one stream. They live in the `PRESETS` table in `widget/widget.js`, and a test checks each against the shared values. If you change a palette, make the same change in the other overlays and regenerate the gallery in `docs/presets.png`.

## Reporting a bug

Please include what you expected, what happened, and your widget settings if they are relevant. If the problem involves subs, bits or other events not being handled correctly, turn on the debug option if the widget has one and include the logged events from the browser-source console, with any usernames removed.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
