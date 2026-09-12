# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 5% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-12
- Runtime: bun 1.4.0 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  21.99 ms |  30.67 ms |       26.70 ms | 🟢 1.39x faster       | 🟢 1.21x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.77 ms |   3.75 ms |        4.38 ms | 🟢 1.35x faster       | 🟢 1.58x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  58.20 ms |  71.86 ms |       76.07 ms | 🟢 1.23x faster       | 🟢 1.31x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.22 ms |   4.21 ms |        4.89 ms | 🟢 1.31x faster       | 🟢 1.52x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.67 ms |   5.45 ms |        5.49 ms | 🟢 1.49x faster       | 🟢 1.50x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.65 ms |   0.85 ms |        1.08 ms | 🟢 1.31x faster       | 🟢 1.67x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  44.61 ms |  60.88 ms |       76.27 ms | 🟢 1.36x faster       | 🟢 1.71x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.77 ms |   2.46 ms |        2.63 ms | 🟢 1.39x faster       | 🟢 1.49x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.32 ms |   2.90 ms |        3.36 ms | 🟢 1.25x faster       | 🟢 1.45x faster   |
| `kira.glb`                        |    43 |  51,601 |   6.87 ms |   8.96 ms |       11.27 ms | 🟢 1.30x faster       | 🟢 1.64x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.04 ms |   2.66 ms |        3.08 ms | 🟢 1.31x faster       | 🟢 1.51x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  95.55 ms | 134.73 ms |      137.90 ms | 🟢 1.41x faster       | 🟢 1.44x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.98 ms |   4.88 ms |        3.88 ms | 🟢 1.23x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  29.55 ms |  37.83 ms |       40.74 ms | 🟢 1.28x faster       | 🟢 1.38x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  50.31 ms |  78.03 ms |       79.35 ms | 🟢 1.55x faster       | 🟢 1.58x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.89 ms |   8.41 ms |        4.09 ms | 🟢 1.43x faster       | 🔴 1.44x slower   |
| `car.drc`                         |     1 |   1,744 |   0.06 ms |   1.93 ms |        0.14 ms | 🟢 35.04x faster      | 🟢 2.53x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.67 ms |   1.04 ms |        1.07 ms | 🟢 1.55x faster       | 🟢 1.60x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-12
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  24.70 ms |  34.30 ms |       27.10 ms | 🟢 1.39x faster       | 🟢 1.10x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.40 ms |   4.80 ms |        4.30 ms | 🟢 1.41x faster       | 🟢 1.26x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  67.70 ms |  82.80 ms |       75.40 ms | 🟢 1.22x faster       | 🟢 1.11x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.00 ms |   5.20 ms |        4.80 ms | 🟢 1.30x faster       | 🟢 1.20x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.60 ms |   6.70 ms |        5.60 ms | 🟢 1.46x faster       | 🟢 1.22x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  57.40 ms |  76.50 ms |       76.00 ms | 🟢 1.33x faster       | 🟢 1.32x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.20 ms |   3.20 ms |        2.70 ms | 🟢 1.45x faster       | 🟢 1.23x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.00 ms |   4.00 ms |        3.40 ms | 🟢 1.33x faster       | 🟢 1.13x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.10 ms |  12.40 ms |       11.20 ms | 🟢 1.36x faster       | 🟢 1.23x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.60 ms |   3.40 ms |        3.10 ms | 🟢 1.31x faster       | 🟢 1.19x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 119.80 ms | 157.50 ms |      135.70 ms | 🟢 1.31x faster       | 🟢 1.13x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.50 ms |   5.00 ms |        3.90 ms | 🟢 1.43x faster       | 🟢 1.11x faster   |
| `rolex.glb`                       |    24 | 120,336 |  34.90 ms |  42.70 ms |       39.20 ms | 🟢 1.22x faster       | 🟢 1.12x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  66.60 ms |  89.50 ms |       78.30 ms | 🟢 1.34x faster       | 🟢 1.18x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.40 ms |   5.60 ms |        4.10 ms | 🟢 1.27x faster       | 🔴 1.07x slower   |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   1.80 ms |        0.20 ms | 🟢 36.00x faster      | 🟢 4.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.90 ms |   1.10 ms |        1.10 ms | 🟢 1.22x faster       | 🟢 1.22x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-12
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  16.70 ms |  39.30 ms |       16.20 ms | 🟢 2.35x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  44.40 ms |  48.50 ms |       43.80 ms | 🟢 1.09x faster       | ⚪ even           |
| `LittlestTokyo.glb`               |  64.60 ms | 140.80 ms |       64.90 ms | 🟢 2.18x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  12.20 ms |  18.90 ms |       14.60 ms | 🟢 1.55x faster       | 🟢 1.20x faster   |
| `bath_day.glb`                    |  34.10 ms |  39.40 ms |       33.20 ms | 🟢 1.16x faster       | ⚪ even           |
| `duck.glb`                        |   1.30 ms |   1.90 ms |        1.40 ms | 🟢 1.46x faster       | 🟢 1.08x faster   |
| `ferrari.glb`                     |  19.70 ms |  75.90 ms |       23.80 ms | 🟢 3.85x faster       | 🟢 1.21x faster   |
| `forest_house.glb`                |  19.60 ms |  23.00 ms |       19.10 ms | 🟢 1.17x faster       | ⚪ even           |
| `gears.glb`                       |   1.80 ms |   4.00 ms |        1.70 ms | 🟢 2.22x faster       | 🔴 1.06x slower   |
| `kira.glb`                        | 191.10 ms | 199.20 ms |      189.30 ms | ⚪ even               | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.00 ms |  27.50 ms |       24.20 ms | 🟢 1.15x faster       | ⚪ even           |
| `nemetona.glb`                    | 127.60 ms | 182.90 ms |      139.20 ms | 🟢 1.43x faster       | 🟢 1.09x faster   |
| `pool.glb`                        |  37.00 ms |  39.80 ms |       34.80 ms | 🟢 1.08x faster       | 🔴 1.06x slower   |
| `rolex.glb`                       |  16.60 ms |  56.00 ms |       19.50 ms | 🟢 3.37x faster       | 🟢 1.17x faster   |
| `venice_mask.glb`                 |  56.60 ms | 137.80 ms |       56.80 ms | 🟢 2.43x faster       | ⚪ even           |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-12
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  60.60 ms |  78.20 ms |       54.10 ms | 🟢 1.29x faster       | 🔴 1.12x slower   |
| `IridescentDishWithOlives.glb`    |  70.90 ms |  77.40 ms |       78.80 ms | 🟢 1.09x faster       | 🟢 1.11x faster   |
| `LittlestTokyo.glb`               | 113.30 ms | 184.00 ms |      113.20 ms | 🟢 1.62x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  26.80 ms |  45.60 ms |       31.00 ms | 🟢 1.70x faster       | 🟢 1.16x faster   |
| `bath_day.glb`                    |  48.00 ms |  71.60 ms |       66.80 ms | 🟢 1.49x faster       | 🟢 1.39x faster   |
| `duck.glb`                        |  11.70 ms |  10.40 ms |       27.80 ms | 🔴 1.13x slower       | 🟢 2.38x faster   |
| `ferrari.glb`                     |  67.70 ms | 118.80 ms |       60.50 ms | 🟢 1.75x faster       | 🔴 1.12x slower   |
| `forest_house.glb`                |  39.70 ms |  42.30 ms |       58.10 ms | 🟢 1.07x faster       | 🟢 1.46x faster   |
| `gears.glb`                       |  11.50 ms |  14.90 ms |       29.00 ms | 🟢 1.30x faster       | 🟢 2.52x faster   |
| `kira.glb`                        | 222.80 ms | 243.30 ms |      275.60 ms | 🟢 1.09x faster       | 🟢 1.24x faster   |
| `minimalistic_modern_bedroom.glb` |  37.10 ms |  56.40 ms |       50.40 ms | 🟢 1.52x faster       | 🟢 1.36x faster   |
| `nemetona.glb`                    | 181.80 ms | 213.30 ms |      212.20 ms | 🟢 1.17x faster       | 🟢 1.17x faster   |
| `pool.glb`                        |  54.20 ms |  69.30 ms |       65.10 ms | 🟢 1.28x faster       | 🟢 1.20x faster   |
| `rolex.glb`                       |  63.30 ms |  90.70 ms |       61.10 ms | 🟢 1.43x faster       | ⚪ even           |
| `venice_mask.glb`                 | 127.50 ms | 171.20 ms |      120.60 ms | 🟢 1.34x faster       | 🔴 1.06x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
