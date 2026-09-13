# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 3% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-13
- Runtime: bun 1.4.0 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  20.02 ms |  29.45 ms |       26.39 ms | 🟢 1.47x faster       | 🟢 1.32x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.65 ms |   3.66 ms |        4.36 ms | 🟢 1.38x faster       | 🟢 1.65x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  56.70 ms |  69.68 ms |       75.24 ms | 🟢 1.23x faster       | 🟢 1.33x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.24 ms |   4.31 ms |        4.98 ms | 🟢 1.33x faster       | 🟢 1.54x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.69 ms |   5.43 ms |        5.49 ms | 🟢 1.47x faster       | 🟢 1.48x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.65 ms |   0.88 ms |        1.09 ms | 🟢 1.35x faster       | 🟢 1.68x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  44.00 ms |  58.88 ms |       75.70 ms | 🟢 1.34x faster       | 🟢 1.72x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.78 ms |   2.39 ms |        2.68 ms | 🟢 1.34x faster       | 🟢 1.50x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.25 ms |   3.12 ms |        3.27 ms | 🟢 1.38x faster       | 🟢 1.45x faster   |
| `kira.glb`                        |    43 |  51,601 |   6.79 ms |   9.11 ms |       11.06 ms | 🟢 1.34x faster       | 🟢 1.63x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.05 ms |   2.61 ms |        2.99 ms | 🟢 1.27x faster       | 🟢 1.46x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  92.84 ms | 129.44 ms |      137.37 ms | 🟢 1.39x faster       | 🟢 1.48x faster   |
| `pool.glb`                        |     2 |  22,280 |   4.12 ms |   4.92 ms |        3.92 ms | 🟢 1.19x faster       | 🔴 1.05x slower   |
| `rolex.glb`                       |    24 | 120,336 |  28.97 ms |  36.97 ms |       40.55 ms | 🟢 1.28x faster       | 🟢 1.40x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  49.68 ms |  74.89 ms |       78.94 ms | 🟢 1.51x faster       | 🟢 1.59x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.86 ms |   8.22 ms |        4.30 ms | 🟢 1.40x faster       | 🔴 1.36x slower   |
| `car.drc`                         |     1 |   1,744 |   0.05 ms |   1.65 ms |        0.12 ms | 🟢 32.39x faster      | 🟢 2.39x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.67 ms |   1.04 ms |        1.10 ms | 🟢 1.55x faster       | 🟢 1.65x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-13
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  22.30 ms |  33.10 ms |       26.90 ms | 🟢 1.48x faster       | 🟢 1.21x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.20 ms |   4.90 ms |        4.40 ms | 🟢 1.53x faster       | 🟢 1.38x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  64.60 ms |  82.00 ms |       75.20 ms | 🟢 1.27x faster       | 🟢 1.16x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.80 ms |   5.30 ms |        4.80 ms | 🟢 1.39x faster       | 🟢 1.26x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.40 ms |   6.50 ms |        5.60 ms | 🟢 1.48x faster       | 🟢 1.27x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.70 ms |   1.10 ms |        1.10 ms | 🟢 1.57x faster       | 🟢 1.57x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  54.70 ms |  76.80 ms |       76.20 ms | 🟢 1.40x faster       | 🟢 1.39x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.10 ms |   3.20 ms |        2.80 ms | 🟢 1.52x faster       | 🟢 1.33x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.90 ms |   3.90 ms |        3.40 ms | 🟢 1.34x faster       | 🟢 1.17x faster   |
| `kira.glb`                        |    43 |  51,601 |   8.50 ms |  12.20 ms |       11.20 ms | 🟢 1.44x faster       | 🟢 1.32x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.50 ms |   3.40 ms |        3.20 ms | 🟢 1.36x faster       | 🟢 1.28x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 112.60 ms | 155.20 ms |      136.60 ms | 🟢 1.38x faster       | 🟢 1.21x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.40 ms |   5.00 ms |        3.90 ms | 🟢 1.47x faster       | 🟢 1.15x faster   |
| `rolex.glb`                       |    24 | 120,336 |  33.70 ms |  43.10 ms |       39.40 ms | 🟢 1.28x faster       | 🟢 1.17x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  62.90 ms |  88.80 ms |       77.90 ms | 🟢 1.41x faster       | 🟢 1.24x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.10 ms |   5.50 ms |        4.10 ms | 🟢 1.34x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   1.80 ms |        0.20 ms | 🟢 36.00x faster      | 🟢 4.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.00 ms | 🟢 1.38x faster       | 🟢 1.25x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-13
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  16.60 ms |  41.90 ms |       16.80 ms | 🟢 2.52x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  48.00 ms |  51.80 ms |       46.40 ms | 🟢 1.08x faster       | 🔴 1.03x slower   |
| `LittlestTokyo.glb`               |  62.80 ms | 145.90 ms |       64.90 ms | 🟢 2.32x faster       | 🟢 1.03x faster   |
| `ShaderBall2.glb`                 |  12.10 ms |  17.60 ms |       12.00 ms | 🟢 1.45x faster       | ⚪ even           |
| `bath_day.glb`                    |  32.70 ms |  39.20 ms |       32.50 ms | 🟢 1.20x faster       | ⚪ even           |
| `duck.glb`                        |   1.40 ms |   2.20 ms |        1.50 ms | 🟢 1.57x faster       | 🟢 1.07x faster   |
| `ferrari.glb`                     |  18.70 ms |  78.80 ms |       24.10 ms | 🟢 4.21x faster       | 🟢 1.29x faster   |
| `forest_house.glb`                |  19.70 ms |  22.50 ms |       22.30 ms | 🟢 1.14x faster       | 🟢 1.13x faster   |
| `gears.glb`                       |   1.70 ms |   4.40 ms |        1.90 ms | 🟢 2.59x faster       | 🟢 1.12x faster   |
| `kira.glb`                        | 191.80 ms | 200.40 ms |      190.00 ms | 🟢 1.04x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.00 ms |  27.50 ms |       24.10 ms | 🟢 1.15x faster       | ⚪ even           |
| `nemetona.glb`                    | 130.00 ms | 185.40 ms |      136.80 ms | 🟢 1.43x faster       | 🟢 1.05x faster   |
| `pool.glb`                        |  34.70 ms |  40.60 ms |       36.90 ms | 🟢 1.17x faster       | 🟢 1.06x faster   |
| `rolex.glb`                       |  15.30 ms |  56.50 ms |       19.80 ms | 🟢 3.69x faster       | 🟢 1.29x faster   |
| `venice_mask.glb`                 |  53.70 ms | 136.30 ms |       54.70 ms | 🟢 2.54x faster       | ⚪ even           |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-13
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  55.70 ms |  73.40 ms |       57.60 ms | 🟢 1.32x faster       | 🟢 1.03x faster   |
| `IridescentDishWithOlives.glb`    |  59.10 ms |  81.10 ms |       81.90 ms | 🟢 1.37x faster       | 🟢 1.39x faster   |
| `LittlestTokyo.glb`               | 103.40 ms | 176.60 ms |       94.30 ms | 🟢 1.71x faster       | 🔴 1.10x slower   |
| `ShaderBall2.glb`                 |  25.20 ms |  43.20 ms |       34.90 ms | 🟢 1.71x faster       | 🟢 1.38x faster   |
| `bath_day.glb`                    |  46.50 ms |  67.30 ms |       57.20 ms | 🟢 1.45x faster       | 🟢 1.23x faster   |
| `duck.glb`                        |  10.60 ms |  10.80 ms |       28.00 ms | ⚪ even               | 🟢 2.64x faster   |
| `ferrari.glb`                     |  65.50 ms | 114.50 ms |       58.10 ms | 🟢 1.75x faster       | 🔴 1.13x slower   |
| `forest_house.glb`                |  35.00 ms |  46.20 ms |       50.70 ms | 🟢 1.32x faster       | 🟢 1.45x faster   |
| `gears.glb`                       |  10.10 ms |  13.60 ms |       27.30 ms | 🟢 1.35x faster       | 🟢 2.70x faster   |
| `kira.glb`                        | 207.90 ms | 229.90 ms |      226.90 ms | 🟢 1.11x faster       | 🟢 1.09x faster   |
| `minimalistic_modern_bedroom.glb` |  36.10 ms |  53.60 ms |       55.80 ms | 🟢 1.48x faster       | 🟢 1.55x faster   |
| `nemetona.glb`                    | 175.60 ms | 216.70 ms |      211.40 ms | 🟢 1.23x faster       | 🟢 1.20x faster   |
| `pool.glb`                        |  48.50 ms |  68.90 ms |       65.20 ms | 🟢 1.42x faster       | 🟢 1.34x faster   |
| `rolex.glb`                       |  61.20 ms |  89.80 ms |       62.50 ms | 🟢 1.47x faster       | ⚪ even           |
| `venice_mask.glb`                 | 124.30 ms | 169.80 ms |      118.20 ms | 🟢 1.37x faster       | 🔴 1.05x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
