# Contributing

Thank you for taking an interest. Fixes, new palettes and ideas for further standards are all welcome.

## Getting set up

You need Node.js 18 or newer. There are no dependencies.

```sh
npm test              # the tests
npm run check-contrast   # every preset against the contrast standards
```

## Changing a palette

1. Change the preset in `src/presets.js`.
2. Run `npm run check-contrast`. A palette that fails the standards will not be accepted, because the standards are the point.
3. Run `npm test`.
4. Run `node bin/overlay-kit.js sync-presets ../some-overlay` in each overlay, then regenerate its `docs/presets.png` and commit. Each overlay's CI checks that its table matches the kit's tagged version, so an overlay that is not synced will fail until it is.
5. Add a line to `CHANGELOG.md`, and tag a release.

## Changing a standard

The standards are written down in [docs/STANDARDS.md](docs/STANDARDS.md). If a change to one would break an existing overlay or its users' saved settings, say so in the pull request and in the changelog.

## Licence

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
