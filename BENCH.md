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
| `manablade-bundle.glb`            |   493 |  77,544 |  21.60 ms |  31.91 ms |       26.89 ms | 🟢 1.48x faster       | 🟢 1.24x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.79 ms |   4.04 ms |        4.39 ms | 🟢 1.45x faster       | 🟢 1.57x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  60.01 ms |  74.09 ms |       76.11 ms | 🟢 1.23x faster       | 🟢 1.27x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.29 ms |   4.54 ms |        5.06 ms | 🟢 1.38x faster       | 🟢 1.54x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.82 ms |   5.63 ms |        5.51 ms | 🟢 1.47x faster       | 🟢 1.44x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.64 ms |   0.86 ms |        1.12 ms | 🟢 1.34x faster       | 🟢 1.75x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  45.10 ms |  60.13 ms |       77.01 ms | 🟢 1.33x faster       | 🟢 1.71x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.83 ms |   2.47 ms |        2.62 ms | 🟢 1.35x faster       | 🟢 1.43x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.23 ms |   2.98 ms |        3.30 ms | 🟢 1.33x faster       | 🟢 1.48x faster   |
| `kira.glb`                        |    43 |  51,601 |   7.72 ms |   9.19 ms |       12.97 ms | 🟢 1.19x faster       | 🟢 1.68x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.19 ms |   2.89 ms |        3.20 ms | 🟢 1.32x faster       | 🟢 1.46x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  99.94 ms | 137.06 ms |      140.97 ms | 🟢 1.37x faster       | 🟢 1.41x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.92 ms |   4.77 ms |        3.90 ms | 🟢 1.22x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  29.31 ms |  41.15 ms |       42.16 ms | 🟢 1.40x faster       | 🟢 1.44x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  53.50 ms |  82.87 ms |       80.03 ms | 🟢 1.55x faster       | 🟢 1.50x faster   |
| `bunny.drc`                       |     1 |  69,451 |   6.05 ms |   9.57 ms |        4.29 ms | 🟢 1.58x faster       | 🔴 1.41x slower   |
| `car.drc`                         |     1 |   1,744 |   0.07 ms |   3.06 ms |        0.12 ms | 🟢 44.93x faster      | 🟢 1.81x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.75 ms |   1.11 ms |        1.11 ms | 🟢 1.48x faster       | 🟢 1.48x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-12
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  24.60 ms |  33.90 ms |       27.30 ms | 🟢 1.38x faster       | 🟢 1.11x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.40 ms |   5.10 ms |        4.50 ms | 🟢 1.50x faster       | 🟢 1.32x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  71.60 ms |  83.20 ms |       75.20 ms | 🟢 1.16x faster       | 🟢 1.05x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.00 ms |   5.20 ms |        4.80 ms | 🟢 1.30x faster       | 🟢 1.20x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.70 ms |   6.50 ms |        5.60 ms | 🟢 1.38x faster       | 🟢 1.19x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  57.60 ms |  77.60 ms |       76.20 ms | 🟢 1.35x faster       | 🟢 1.32x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.20 ms |   3.30 ms |        2.80 ms | 🟢 1.50x faster       | 🟢 1.27x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.00 ms |   4.00 ms |        3.40 ms | 🟢 1.33x faster       | 🟢 1.13x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.00 ms |  12.30 ms |       11.30 ms | 🟢 1.37x faster       | 🟢 1.26x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.60 ms |   3.50 ms |        3.10 ms | 🟢 1.35x faster       | 🟢 1.19x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 119.40 ms | 156.10 ms |      133.50 ms | 🟢 1.31x faster       | 🟢 1.12x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.60 ms |   5.20 ms |        4.00 ms | 🟢 1.44x faster       | 🟢 1.11x faster   |
| `rolex.glb`                       |    24 | 120,336 |  34.80 ms |  44.20 ms |       40.00 ms | 🟢 1.27x faster       | 🟢 1.15x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  66.70 ms |  92.60 ms |       78.60 ms | 🟢 1.39x faster       | 🟢 1.18x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.40 ms |   5.50 ms |        4.20 ms | 🟢 1.25x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   2.80 ms |        0.20 ms | 🟢 56.00x faster      | 🟢 4.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.90 ms |   1.20 ms |        1.10 ms | 🟢 1.33x faster       | 🟢 1.22x faster   |

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
| `manablade-bundle.glb`            |  17.80 ms |  41.70 ms |       17.50 ms | 🟢 2.34x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  50.40 ms |  57.20 ms |       52.40 ms | 🟢 1.13x faster       | ⚪ even           |
| `LittlestTokyo.glb`               |  63.30 ms | 156.20 ms |       72.00 ms | 🟢 2.47x faster       | 🟢 1.14x faster   |
| `ShaderBall2.glb`                 |  13.20 ms |  19.50 ms |       13.40 ms | 🟢 1.48x faster       | ⚪ even           |
| `bath_day.glb`                    |  32.70 ms |  39.00 ms |       32.40 ms | 🟢 1.19x faster       | ⚪ even           |
| `duck.glb`                        |   1.30 ms |   2.00 ms |        1.50 ms | 🟢 1.54x faster       | 🟢 1.15x faster   |
| `ferrari.glb`                     |  19.60 ms |  75.80 ms |       23.80 ms | 🟢 3.87x faster       | 🟢 1.21x faster   |
| `forest_house.glb`                |  19.00 ms |  23.00 ms |       20.00 ms | 🟢 1.21x faster       | 🟢 1.05x faster   |
| `gears.glb`                       |   1.80 ms |   4.10 ms |        1.80 ms | 🟢 2.28x faster       | ⚪ even           |
| `kira.glb`                        | 191.10 ms | 202.80 ms |      192.30 ms | 🟢 1.06x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.00 ms |  27.80 ms |       23.90 ms | 🟢 1.16x faster       | ⚪ even           |
| `nemetona.glb`                    | 131.20 ms | 182.20 ms |      137.30 ms | 🟢 1.39x faster       | ⚪ even           |
| `pool.glb`                        |  36.10 ms |  39.50 ms |       38.20 ms | 🟢 1.09x faster       | 🟢 1.06x faster   |
| `rolex.glb`                       |  15.20 ms |  55.40 ms |       19.70 ms | 🟢 3.64x faster       | 🟢 1.30x faster   |
| `venice_mask.glb`                 |  60.40 ms | 139.60 ms |       56.80 ms | 🟢 2.31x faster       | 🔴 1.06x slower   |

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
| `manablade-bundle.glb`            |  57.70 ms |  76.30 ms |       58.10 ms | 🟢 1.32x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  58.90 ms |  80.60 ms |       82.90 ms | 🟢 1.37x faster       | 🟢 1.41x faster   |
| `LittlestTokyo.glb`               | 109.10 ms | 181.80 ms |      101.60 ms | 🟢 1.67x faster       | 🔴 1.07x slower   |
| `ShaderBall2.glb`                 |  26.30 ms |  38.60 ms |       31.20 ms | 🟢 1.47x faster       | 🟢 1.19x faster   |
| `bath_day.glb`                    |  46.20 ms |  73.30 ms |       64.20 ms | 🟢 1.59x faster       | 🟢 1.39x faster   |
| `duck.glb`                        |  11.10 ms |  10.50 ms |       27.20 ms | 🔴 1.06x slower       | 🟢 2.45x faster   |
| `ferrari.glb`                     |  63.40 ms | 116.20 ms |       58.20 ms | 🟢 1.83x faster       | 🔴 1.09x slower   |
| `forest_house.glb`                |  37.70 ms |  46.50 ms |       50.40 ms | 🟢 1.23x faster       | 🟢 1.34x faster   |
| `gears.glb`                       |  11.10 ms |  13.60 ms |       24.50 ms | 🟢 1.23x faster       | 🟢 2.21x faster   |
| `kira.glb`                        | 234.60 ms | 240.00 ms |      244.30 ms | ⚪ even               | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  36.40 ms |  57.90 ms |       53.50 ms | 🟢 1.59x faster       | 🟢 1.47x faster   |
| `nemetona.glb`                    | 181.00 ms | 213.80 ms |      212.60 ms | 🟢 1.18x faster       | 🟢 1.17x faster   |
| `pool.glb`                        |  60.00 ms |  68.90 ms |       67.40 ms | 🟢 1.15x faster       | 🟢 1.12x faster   |
| `rolex.glb`                       |  67.50 ms |  89.80 ms |       57.80 ms | 🟢 1.33x faster       | 🔴 1.17x slower   |
| `venice_mask.glb`                 | 124.50 ms | 172.90 ms |      119.40 ms | 🟢 1.39x faster       | ⚪ even           |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
