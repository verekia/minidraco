# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 3% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-19
- Runtime: bun 1.4.0 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  19.92 ms |  31.35 ms |       26.82 ms | 🟢 1.57x faster       | 🟢 1.35x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.46 ms |   4.33 ms |        4.40 ms | 🟢 1.76x faster       | 🟢 1.79x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  56.03 ms |  73.36 ms |       76.41 ms | 🟢 1.31x faster       | 🟢 1.36x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.05 ms |   4.59 ms |        4.92 ms | 🟢 1.51x faster       | 🟢 1.61x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.16 ms |   5.68 ms |        5.53 ms | 🟢 1.80x faster       | 🟢 1.75x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.57 ms |   0.90 ms |        1.16 ms | 🟢 1.59x faster       | 🟢 2.04x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  34.86 ms |  62.54 ms |       76.26 ms | 🟢 1.79x faster       | 🟢 2.19x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.60 ms |   2.46 ms |        2.66 ms | 🟢 1.54x faster       | 🟢 1.66x faster   |
| `gears.glb`                       |     3 |  21,696 |   1.76 ms |   3.25 ms |        3.39 ms | 🟢 1.85x faster       | 🟢 1.92x faster   |
| `kira.glb`                        |    43 |  51,601 |   5.61 ms |   9.10 ms |       11.02 ms | 🟢 1.62x faster       | 🟢 1.97x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.08 ms |   2.96 ms |        3.19 ms | 🟢 1.42x faster       | 🟢 1.53x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  91.26 ms | 142.77 ms |      142.80 ms | 🟢 1.56x faster       | 🟢 1.56x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.48 ms |   5.56 ms |        4.07 ms | 🟢 1.60x faster       | 🟢 1.17x faster   |
| `rolex.glb`                       |    24 | 120,336 |  26.30 ms |  39.99 ms |       40.85 ms | 🟢 1.52x faster       | 🟢 1.55x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  43.06 ms |  80.30 ms |       80.36 ms | 🟢 1.86x faster       | 🟢 1.87x faster   |
| `bunny.drc`                       |     1 |  69,451 |   6.12 ms |   8.32 ms |        4.20 ms | 🟢 1.36x faster       | 🔴 1.46x slower   |
| `car.drc`                         |     1 |   1,744 |   0.06 ms |   1.99 ms |        0.12 ms | 🟢 32.06x faster      | 🟢 1.95x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.64 ms |   1.05 ms |        1.08 ms | 🟢 1.65x faster       | 🟢 1.69x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-19
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  21.60 ms |  33.50 ms |       26.90 ms | 🟢 1.55x faster       | 🟢 1.25x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.60 ms |   4.60 ms |        4.30 ms | 🟢 1.77x faster       | 🟢 1.65x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  63.70 ms |  83.30 ms |       74.50 ms | 🟢 1.31x faster       | 🟢 1.17x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.30 ms |   5.10 ms |        4.90 ms | 🟢 1.55x faster       | 🟢 1.48x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.70 ms |   6.60 ms |        5.50 ms | 🟢 1.78x faster       | 🟢 1.49x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.70 ms |   1.10 ms |        1.10 ms | 🟢 1.57x faster       | 🟢 1.57x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  44.20 ms |  77.30 ms |       74.90 ms | 🟢 1.75x faster       | 🟢 1.69x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.00 ms |   3.10 ms |        2.70 ms | 🟢 1.55x faster       | 🟢 1.35x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.30 ms |   4.10 ms |        3.40 ms | 🟢 1.78x faster       | 🟢 1.48x faster   |
| `kira.glb`                        |    43 |  51,601 |   7.70 ms |  12.30 ms |       11.00 ms | 🟢 1.60x faster       | 🟢 1.43x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.50 ms |   3.40 ms |        3.10 ms | 🟢 1.36x faster       | 🟢 1.24x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 106.40 ms | 156.90 ms |      135.10 ms | 🟢 1.47x faster       | 🟢 1.27x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.00 ms |   5.00 ms |        3.90 ms | 🟢 1.67x faster       | 🟢 1.30x faster   |
| `rolex.glb`                       |    24 | 120,336 |  31.70 ms |  44.00 ms |       39.10 ms | 🟢 1.39x faster       | 🟢 1.23x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  56.40 ms |  92.60 ms |       76.80 ms | 🟢 1.64x faster       | 🟢 1.36x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.20 ms |   5.40 ms |        4.00 ms | 🟢 1.29x faster       | 🔴 1.05x slower   |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   2.40 ms |        0.20 ms | 🟢 48.00x faster      | 🟢 4.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.70 ms |   1.10 ms |        1.00 ms | 🟢 1.57x faster       | 🟢 1.43x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-19
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  16.80 ms |  41.30 ms |       17.50 ms | 🟢 2.46x faster       | 🟢 1.04x faster   |
| `IridescentDishWithOlives.glb`    |  44.70 ms |  56.30 ms |       51.10 ms | 🟢 1.26x faster       | 🟢 1.14x faster   |
| `LittlestTokyo.glb`               |  63.40 ms | 142.80 ms |       63.30 ms | 🟢 2.25x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  12.00 ms |  17.50 ms |       13.40 ms | 🟢 1.46x faster       | 🟢 1.12x faster   |
| `bath_day.glb`                    |  33.20 ms |  42.10 ms |       32.50 ms | 🟢 1.27x faster       | ⚪ even           |
| `duck.glb`                        |   1.30 ms |   2.20 ms |        1.40 ms | 🟢 1.69x faster       | 🟢 1.08x faster   |
| `ferrari.glb`                     |  15.30 ms |  76.20 ms |       23.70 ms | 🟢 4.98x faster       | 🟢 1.55x faster   |
| `forest_house.glb`                |  19.60 ms |  22.40 ms |       19.70 ms | 🟢 1.14x faster       | ⚪ even           |
| `gears.glb`                       |   1.60 ms |   3.90 ms |        1.80 ms | 🟢 2.44x faster       | 🟢 1.13x faster   |
| `kira.glb`                        | 193.30 ms | 201.70 ms |      195.20 ms | 🟢 1.04x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.50 ms |  27.60 ms |       24.90 ms | 🟢 1.13x faster       | ⚪ even           |
| `nemetona.glb`                    | 117.00 ms | 183.90 ms |      139.50 ms | 🟢 1.57x faster       | 🟢 1.19x faster   |
| `pool.glb`                        |  37.30 ms |  41.90 ms |       36.60 ms | 🟢 1.12x faster       | ⚪ even           |
| `rolex.glb`                       |  15.40 ms |  55.30 ms |       19.70 ms | 🟢 3.59x faster       | 🟢 1.28x faster   |
| `venice_mask.glb`                 |  52.50 ms | 138.20 ms |       55.50 ms | 🟢 2.63x faster       | 🟢 1.06x faster   |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-19
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  56.50 ms |  74.60 ms |       58.40 ms | 🟢 1.32x faster       | 🟢 1.03x faster   |
| `IridescentDishWithOlives.glb`    |  60.00 ms |  86.20 ms |       85.20 ms | 🟢 1.44x faster       | 🟢 1.42x faster   |
| `LittlestTokyo.glb`               |  97.30 ms | 186.00 ms |      107.00 ms | 🟢 1.91x faster       | 🟢 1.10x faster   |
| `ShaderBall2.glb`                 |  23.20 ms |  45.40 ms |       33.10 ms | 🟢 1.96x faster       | 🟢 1.43x faster   |
| `bath_day.glb`                    |  53.00 ms |  70.90 ms |       67.80 ms | 🟢 1.34x faster       | 🟢 1.28x faster   |
| `duck.glb`                        |   9.60 ms |   6.50 ms |       28.70 ms | 🔴 1.48x slower       | 🟢 2.99x faster   |
| `ferrari.glb`                     |  62.00 ms | 115.90 ms |       61.30 ms | 🟢 1.87x faster       | ⚪ even           |
| `forest_house.glb`                |  40.30 ms |  48.40 ms |       49.20 ms | 🟢 1.20x faster       | 🟢 1.22x faster   |
| `gears.glb`                       |   8.80 ms |   9.80 ms |       24.30 ms | 🟢 1.11x faster       | 🟢 2.76x faster   |
| `kira.glb`                        | 219.10 ms | 235.00 ms |      241.60 ms | 🟢 1.07x faster       | 🟢 1.10x faster   |
| `minimalistic_modern_bedroom.glb` |  36.10 ms |  53.10 ms |       51.50 ms | 🟢 1.47x faster       | 🟢 1.43x faster   |
| `nemetona.glb`                    | 163.50 ms | 211.80 ms |      210.30 ms | 🟢 1.30x faster       | 🟢 1.29x faster   |
| `pool.glb`                        |  50.90 ms |  72.20 ms |       65.90 ms | 🟢 1.42x faster       | 🟢 1.29x faster   |
| `rolex.glb`                       |  59.40 ms |  89.20 ms |       60.60 ms | 🟢 1.50x faster       | ⚪ even           |
| `venice_mask.glb`                 | 114.40 ms | 170.10 ms |      118.30 ms | 🟢 1.49x faster       | 🟢 1.03x faster   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
