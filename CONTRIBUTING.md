# Contributing

Thank you for taking an interest. Bug reports, fixes and ideas are all welcome.

## Getting set up

You need Node.js 18 or newer for the tests, and Python 3 (or any static file server) for the dev harnesses. There is nothing to install.

```sh
npm test                          # every check in the repo
node scripts/test-all.js counter  # just one overlay (the kit's checks always run)
TEST_JOBS=1 npm test              # one suite at a time, if you want quieter output while debugging
node scripts/stress.js 20 counter   # one suite 20 times at once, to look for a test that fails only sometimes (heavy: CI does this)
cd overlays/counter && npm run dev   # an overlay's dev harness, at http://localhost:8000/dev/
```

## Making a change

1. Open an issue first for anything large.
2. Keep an overlay's `widget/widget.js` in plain ES5 (`var`, function expressions, no modules or arrow functions). It is pasted straight into the StreamElements editor.
3. Keep widgets free of run-time dependencies.
4. When you add a setting, add it to `widget/fields.json` and read it in `widget/widget.js`.
5. Add or update tests, and make sure `npm test` passes.
6. If behaviour changes, update that overlay's README.
7. A new overlay needs a picture for its card on the website: `node kit/bin/overlay-kit.js gallery overlays/<name> --card` (it needs Chromium). `npm test` checks that every overlay has one.

## Changing a style preset

The presets are defined once, in [`kit/src/presets.js`](kit/src/presets.js), and every preset has to pass the contrast standards in [`kit/docs/STANDARDS.md`](kit/docs/STANDARDS.md). After changing one, run `node kit/bin/overlay-kit.js sync-presets overlays/<name>` for each overlay, regenerate its picture with `node kit/bin/overlay-kit.js gallery overlays/<name>` (it needs Chromium), and commit. `npm test` fails for an overlay that is out of step.

## Pull requests

Every pull request runs `npm test` on Node 18, 20 and 22, which is the same command you run locally, so a green check means the whole repository still passes. If a check fails, the log shows which overlay and which test, and `node scripts/test-all.js <overlay>` reproduces it on its own. A change to a style preset also needs `npm run check-contrast` to pass, and that is part of `npm test`.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
