# Contributing

Thank you for taking an interest. Bug reports, fixes and ideas are all welcome.

## Getting set up

You need Node.js 18 or newer for the tests, and Python 3 (or any static file server) for the dev harnesses. There is nothing to install.

```sh
npm test                          # every check in the repo
node scripts/test-all.js counter  # just one overlay (the kit's checks always run)
cd overlays/counter && npm run dev   # an overlay's dev harness, at http://localhost:8000/dev/
```

## Making a change

1. Open an issue first for anything large.
2. Keep an overlay's `widget/widget.js` in plain ES5 (`var`, function expressions, no modules or arrow functions). It is pasted straight into the StreamElements editor.
3. Keep widgets free of run-time dependencies.
4. When you add a setting, add it to `widget/fields.json` and read it in `widget/widget.js`.
5. Add or update tests, and make sure `npm test` passes.
6. If behaviour changes, update that overlay's README.

## Changing a style preset

The presets are defined once, in [`kit/src/presets.js`](kit/src/presets.js), and every preset has to pass the contrast standards in [`kit/docs/STANDARDS.md`](kit/docs/STANDARDS.md). After changing one, run `node kit/bin/overlay-kit.js sync-presets overlays/<name>` for each overlay, regenerate its picture with `node kit/bin/overlay-kit.js gallery overlays/<name>` (it needs Chromium), and commit. `npm test` fails for an overlay that is out of step.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
