# Changelog

## 1.0.0

The first release. It holds what the twelve overlays had been sharing without anywhere to keep it, and now lives in the same repository as they do.

- The twenty-two style presets, as one table, with a generator for the shape each overlay's code uses.
- The eight pride presets, designed from the stripes of their flags, with the weakest scrim that keeps the text readable worked out and not chosen by eye.
- Contrast standards for every preset: text 4.5 or better, accent 3.5 or better, and 4.6 and 3.0 for a pride preset against every stripe of its own flag. Four accents that fell short are corrected: Midnight blue, Rose, Cosy summer pastel and Pastel pink.
- `sync-presets` and `check-presets`, which bring an overlay's table, dropdown, expected test data and shared test mock in line with the kit, or report where it has drifted.
- The shared sources the newer overlays were made from: the helper code, the card styles, the test mock and the dev harness template.
