# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 3% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-14
- Runtime: bun 1.4.0 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  19.60 ms |  30.16 ms |       26.64 ms | 🟢 1.54x faster       | 🟢 1.36x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.51 ms |   4.00 ms |        4.36 ms | 🟢 1.60x faster       | 🟢 1.74x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  57.15 ms |  71.39 ms |       76.31 ms | 🟢 1.25x faster       | 🟢 1.34x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.23 ms |   4.28 ms |        4.88 ms | 🟢 1.33x faster       | 🟢 1.51x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.60 ms |   5.57 ms |        5.49 ms | 🟢 1.55x faster       | 🟢 1.53x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.64 ms |   0.89 ms |        1.08 ms | 🟢 1.39x faster       | 🟢 1.68x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  39.28 ms |  59.91 ms |       75.47 ms | 🟢 1.53x faster       | 🟢 1.92x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.76 ms |   2.40 ms |        2.65 ms | 🟢 1.36x faster       | 🟢 1.50x faster   |
| `gears.glb`                       |     3 |  21,696 |   1.97 ms |   3.10 ms |        3.31 ms | 🟢 1.57x faster       | 🟢 1.68x faster   |
| `kira.glb`                        |    43 |  51,601 |   5.95 ms |   9.18 ms |       10.91 ms | 🟢 1.54x faster       | 🟢 1.83x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.07 ms |   2.74 ms |        3.04 ms | 🟢 1.32x faster       | 🟢 1.47x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  95.56 ms | 130.44 ms |      137.08 ms | 🟢 1.37x faster       | 🟢 1.43x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.64 ms |   4.86 ms |        3.85 ms | 🟢 1.33x faster       | 🟢 1.06x faster   |
| `rolex.glb`                       |    24 | 120,336 |  28.28 ms |  36.82 ms |       40.54 ms | 🟢 1.30x faster       | 🟢 1.43x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  49.53 ms |  76.15 ms |       78.85 ms | 🟢 1.54x faster       | 🟢 1.59x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.91 ms |   8.24 ms |        4.21 ms | 🟢 1.39x faster       | 🔴 1.40x slower   |
| `car.drc`                         |     1 |   1,744 |   0.05 ms |   1.71 ms |        0.13 ms | 🟢 31.69x faster      | 🟢 2.39x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.67 ms |   1.05 ms |        1.05 ms | 🟢 1.55x faster       | 🟢 1.57x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-14
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  23.00 ms |  33.50 ms |       27.10 ms | 🟢 1.46x faster       | 🟢 1.18x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.90 ms |   4.80 ms |        4.40 ms | 🟢 1.66x faster       | 🟢 1.52x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  67.70 ms |  82.50 ms |       75.80 ms | 🟢 1.22x faster       | 🟢 1.12x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.70 ms |   5.20 ms |        4.80 ms | 🟢 1.41x faster       | 🟢 1.30x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.20 ms |   6.60 ms |        5.60 ms | 🟢 1.57x faster       | 🟢 1.33x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  50.20 ms |  77.70 ms |       76.60 ms | 🟢 1.55x faster       | 🟢 1.53x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.20 ms |   3.20 ms |        2.80 ms | 🟢 1.45x faster       | 🟢 1.27x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.70 ms |   3.90 ms |        3.30 ms | 🟢 1.44x faster       | 🟢 1.22x faster   |
| `kira.glb`                        |    43 |  51,601 |   8.00 ms |  12.10 ms |       11.30 ms | 🟢 1.51x faster       | 🟢 1.41x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.60 ms |   3.50 ms |        3.20 ms | 🟢 1.35x faster       | 🟢 1.23x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 114.40 ms | 153.80 ms |      133.30 ms | 🟢 1.34x faster       | 🟢 1.17x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.30 ms |   5.10 ms |        3.90 ms | 🟢 1.55x faster       | 🟢 1.18x faster   |
| `rolex.glb`                       |    24 | 120,336 |  34.00 ms |  43.70 ms |       39.60 ms | 🟢 1.29x faster       | 🟢 1.16x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  63.30 ms |  91.00 ms |       78.70 ms | 🟢 1.44x faster       | 🟢 1.24x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.20 ms |   5.60 ms |        4.20 ms | 🟢 1.33x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   2.30 ms |        0.10 ms | 🟢 46.00x faster      | 🟢 2.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-14
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  16.50 ms |  41.40 ms |       18.10 ms | 🟢 2.51x faster       | 🟢 1.10x faster   |
| `IridescentDishWithOlives.glb`    |  45.20 ms |  51.60 ms |       45.30 ms | 🟢 1.14x faster       | ⚪ even           |
| `LittlestTokyo.glb`               |  66.30 ms | 142.90 ms |       62.80 ms | 🟢 2.16x faster       | 🔴 1.06x slower   |
| `ShaderBall2.glb`                 |  11.70 ms |  17.20 ms |       11.70 ms | 🟢 1.47x faster       | ⚪ even           |
| `bath_day.glb`                    |  32.50 ms |  39.10 ms |       32.20 ms | 🟢 1.20x faster       | ⚪ even           |
| `duck.glb`                        |   1.20 ms |   2.10 ms |        1.40 ms | 🟢 1.75x faster       | 🟢 1.17x faster   |
| `ferrari.glb`                     |  19.00 ms |  77.50 ms |       23.90 ms | 🟢 4.08x faster       | 🟢 1.26x faster   |
| `forest_house.glb`                |  18.60 ms |  22.30 ms |       19.10 ms | 🟢 1.20x faster       | ⚪ even           |
| `gears.glb`                       |   1.50 ms |   4.00 ms |        1.80 ms | 🟢 2.67x faster       | 🟢 1.20x faster   |
| `kira.glb`                        | 187.30 ms | 196.40 ms |      185.50 ms | 🟢 1.05x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.00 ms |  27.40 ms |       23.60 ms | 🟢 1.14x faster       | ⚪ even           |
| `nemetona.glb`                    | 127.90 ms | 181.50 ms |      138.80 ms | 🟢 1.42x faster       | 🟢 1.09x faster   |
| `pool.glb`                        |  34.90 ms |  40.00 ms |       36.00 ms | 🟢 1.15x faster       | 🟢 1.03x faster   |
| `rolex.glb`                       |  14.40 ms |  55.50 ms |       20.00 ms | 🟢 3.85x faster       | 🟢 1.39x faster   |
| `venice_mask.glb`                 |  52.70 ms | 139.10 ms |       59.80 ms | 🟢 2.64x faster       | 🟢 1.13x faster   |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-14
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  57.70 ms |  51.40 ms |       59.50 ms | 🔴 1.12x slower       | 🟢 1.03x faster   |
| `IridescentDishWithOlives.glb`    |  59.30 ms |  82.00 ms |       72.60 ms | 🟢 1.38x faster       | 🟢 1.22x faster   |
| `LittlestTokyo.glb`               |  97.00 ms | 177.70 ms |       95.90 ms | 🟢 1.83x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  24.30 ms |  43.20 ms |       35.80 ms | 🟢 1.78x faster       | 🟢 1.47x faster   |
| `bath_day.glb`                    |  45.20 ms |  70.10 ms |       62.20 ms | 🟢 1.55x faster       | 🟢 1.38x faster   |
| `duck.glb`                        |  10.10 ms |  10.90 ms |       28.40 ms | 🟢 1.08x faster       | 🟢 2.81x faster   |
| `ferrari.glb`                     |  60.60 ms | 114.80 ms |       62.50 ms | 🟢 1.89x faster       | 🟢 1.03x faster   |
| `forest_house.glb`                |  33.10 ms |  45.30 ms |       43.80 ms | 🟢 1.37x faster       | 🟢 1.32x faster   |
| `gears.glb`                       |   8.20 ms |  15.30 ms |       23.80 ms | 🟢 1.87x faster       | 🟢 2.90x faster   |
| `kira.glb`                        | 199.20 ms | 227.20 ms |      226.50 ms | 🟢 1.14x faster       | 🟢 1.14x faster   |
| `minimalistic_modern_bedroom.glb` |  35.50 ms |  56.50 ms |       55.50 ms | 🟢 1.59x faster       | 🟢 1.56x faster   |
| `nemetona.glb`                    | 166.40 ms | 212.70 ms |      210.40 ms | 🟢 1.28x faster       | 🟢 1.26x faster   |
| `pool.glb`                        |  48.10 ms |  68.40 ms |       64.10 ms | 🟢 1.42x faster       | 🟢 1.33x faster   |
| `rolex.glb`                       |  57.90 ms |  87.40 ms |       57.40 ms | 🟢 1.51x faster       | ⚪ even           |
| `venice_mask.glb`                 | 119.30 ms | 168.30 ms |      117.40 ms | 🟢 1.41x faster       | ⚪ even           |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
