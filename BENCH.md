# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 3% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-22
- Runtime: bun 1.4.2 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  15.50 ms |  29.68 ms |       26.18 ms | 🟢 1.91x faster       | 🟢 1.69x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.09 ms |   3.75 ms |        4.34 ms | 🟢 1.80x faster       | 🟢 2.08x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  44.95 ms |  70.67 ms |       75.70 ms | 🟢 1.57x faster       | 🟢 1.68x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   2.36 ms |   4.29 ms |        4.89 ms | 🟢 1.82x faster       | 🟢 2.07x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   2.88 ms |   5.96 ms |        5.48 ms | 🟢 2.07x faster       | 🟢 1.90x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.49 ms |   0.91 ms |        1.06 ms | 🟢 1.86x faster       | 🟢 2.18x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  31.02 ms |  58.28 ms |       75.96 ms | 🟢 1.88x faster       | 🟢 2.45x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.38 ms |   2.39 ms |        2.63 ms | 🟢 1.74x faster       | 🟢 1.91x faster   |
| `gears.glb`                       |     3 |  21,696 |   1.61 ms |   2.99 ms |        3.26 ms | 🟢 1.86x faster       | 🟢 2.03x faster   |
| `kira.glb`                        |    43 |  51,601 |   5.07 ms |   8.90 ms |       11.09 ms | 🟢 1.75x faster       | 🟢 2.19x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   1.62 ms |   3.40 ms |        3.05 ms | 🟢 2.10x faster       | 🟢 1.88x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  81.25 ms | 127.71 ms |      136.51 ms | 🟢 1.57x faster       | 🟢 1.68x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.36 ms |   5.32 ms |        3.93 ms | 🟢 1.58x faster       | 🟢 1.17x faster   |
| `rolex.glb`                       |    24 | 120,336 |  24.68 ms |  38.43 ms |       40.62 ms | 🟢 1.56x faster       | 🟢 1.65x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  40.16 ms |  75.36 ms |       79.04 ms | 🟢 1.88x faster       | 🟢 1.97x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.84 ms |   8.38 ms |        4.18 ms | 🟢 1.44x faster       | 🔴 1.40x slower   |
| `car.drc`                         |     1 |   1,744 |   0.05 ms |   1.58 ms |        0.13 ms | 🟢 30.37x faster      | 🟢 2.44x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.53 ms |   0.87 ms |        1.06 ms | 🟢 1.64x faster       | 🟢 2.01x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-22
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  19.00 ms |  34.60 ms |       27.40 ms | 🟢 1.82x faster       | 🟢 1.44x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.50 ms |   5.10 ms |        4.60 ms | 🟢 2.04x faster       | 🟢 1.84x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  58.60 ms |  84.50 ms |       75.00 ms | 🟢 1.44x faster       | 🟢 1.28x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   2.90 ms |   5.30 ms |        4.90 ms | 🟢 1.83x faster       | 🟢 1.69x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.40 ms |   6.60 ms |        5.50 ms | 🟢 1.94x faster       | 🟢 1.62x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.60 ms |   1.10 ms |        1.00 ms | 🟢 1.83x faster       | 🟢 1.67x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  41.20 ms |  79.00 ms |       75.50 ms | 🟢 1.92x faster       | 🟢 1.83x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.80 ms |   3.20 ms |        2.60 ms | 🟢 1.78x faster       | 🟢 1.44x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.30 ms |   4.10 ms |        3.30 ms | 🟢 1.78x faster       | 🟢 1.43x faster   |
| `kira.glb`                        |    43 |  51,601 |   7.00 ms |  12.40 ms |       11.00 ms | 🟢 1.77x faster       | 🟢 1.57x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.10 ms |   3.40 ms |        3.00 ms | 🟢 1.62x faster       | 🟢 1.43x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  99.40 ms | 155.10 ms |      135.70 ms | 🟢 1.56x faster       | 🟢 1.37x faster   |
| `pool.glb`                        |     2 |  22,280 |   2.80 ms |   5.00 ms |        3.90 ms | 🟢 1.79x faster       | 🟢 1.39x faster   |
| `rolex.glb`                       |    24 | 120,336 |  27.30 ms |  42.60 ms |       39.20 ms | 🟢 1.56x faster       | 🟢 1.44x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  51.90 ms |  88.90 ms |       76.90 ms | 🟢 1.71x faster       | 🟢 1.48x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.10 ms |   5.30 ms |        4.00 ms | 🟢 1.29x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   2.10 ms |        0.10 ms | 🟢 42.00x faster      | 🟢 2.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.60 ms |   1.10 ms |        1.00 ms | 🟢 1.83x faster       | 🟢 1.67x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-22
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  15.80 ms |  41.40 ms |       17.90 ms | 🟢 2.62x faster       | 🟢 1.13x faster   |
| `IridescentDishWithOlives.glb`    |  49.40 ms |  55.90 ms |       46.70 ms | 🟢 1.13x faster       | 🔴 1.06x slower   |
| `LittlestTokyo.glb`               |  63.80 ms | 144.50 ms |       65.10 ms | 🟢 2.26x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  12.20 ms |  17.20 ms |       12.00 ms | 🟢 1.41x faster       | ⚪ even           |
| `bath_day.glb`                    |  33.80 ms |  39.50 ms |       32.60 ms | 🟢 1.17x faster       | 🔴 1.04x slower   |
| `duck.glb`                        |   1.00 ms |   2.00 ms |        1.50 ms | 🟢 2.00x faster       | 🟢 1.50x faster   |
| `ferrari.glb`                     |  14.60 ms |  78.10 ms |       24.00 ms | 🟢 5.35x faster       | 🟢 1.64x faster   |
| `forest_house.glb`                |  19.60 ms |  22.70 ms |       19.00 ms | 🟢 1.16x faster       | 🔴 1.03x slower   |
| `gears.glb`                       |   1.40 ms |   4.00 ms |        1.80 ms | 🟢 2.86x faster       | 🟢 1.29x faster   |
| `kira.glb`                        | 190.80 ms | 198.10 ms |      187.50 ms | 🟢 1.04x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  23.90 ms |  28.00 ms |       23.80 ms | 🟢 1.17x faster       | ⚪ even           |
| `nemetona.glb`                    | 102.70 ms | 181.40 ms |      138.60 ms | 🟢 1.77x faster       | 🟢 1.35x faster   |
| `pool.glb`                        |  37.40 ms |  39.30 ms |       36.40 ms | 🟢 1.05x faster       | ⚪ even           |
| `rolex.glb`                       |  15.00 ms |  56.60 ms |       19.40 ms | 🟢 3.77x faster       | 🟢 1.29x faster   |
| `venice_mask.glb`                 |  52.80 ms | 140.30 ms |       57.00 ms | 🟢 2.66x faster       | 🟢 1.08x faster   |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-22
- Browser: Chrome/153.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  54.60 ms |  60.10 ms |       59.50 ms | 🟢 1.10x faster       | 🟢 1.09x faster   |
| `IridescentDishWithOlives.glb`    |  66.80 ms |  84.00 ms |       89.10 ms | 🟢 1.26x faster       | 🟢 1.33x faster   |
| `LittlestTokyo.glb`               |  95.60 ms | 179.30 ms |       99.60 ms | 🟢 1.88x faster       | 🟢 1.04x faster   |
| `ShaderBall2.glb`                 |  21.00 ms |  43.60 ms |       37.70 ms | 🟢 2.08x faster       | 🟢 1.80x faster   |
| `bath_day.glb`                    |  47.20 ms |  76.20 ms |       65.30 ms | 🟢 1.61x faster       | 🟢 1.38x faster   |
| `duck.glb`                        |   8.70 ms |  13.90 ms |       30.20 ms | 🟢 1.60x faster       | 🟢 3.47x faster   |
| `ferrari.glb`                     |  59.10 ms | 117.80 ms |       61.40 ms | 🟢 1.99x faster       | 🟢 1.04x faster   |
| `forest_house.glb`                |  33.60 ms |  47.80 ms |       54.10 ms | 🟢 1.42x faster       | 🟢 1.61x faster   |
| `gears.glb`                       |   9.10 ms |  14.20 ms |       28.20 ms | 🟢 1.56x faster       | 🟢 3.10x faster   |
| `kira.glb`                        | 221.60 ms | 232.20 ms |      238.30 ms | 🟢 1.05x faster       | 🟢 1.08x faster   |
| `minimalistic_modern_bedroom.glb` |  35.00 ms |  57.20 ms |       55.60 ms | 🟢 1.63x faster       | 🟢 1.59x faster   |
| `nemetona.glb`                    | 149.50 ms | 215.50 ms |      211.30 ms | 🟢 1.44x faster       | 🟢 1.41x faster   |
| `pool.glb`                        |  48.80 ms |  71.20 ms |       67.30 ms | 🟢 1.46x faster       | 🟢 1.38x faster   |
| `rolex.glb`                       |  54.10 ms |  89.40 ms |       60.70 ms | 🟢 1.65x faster       | 🟢 1.12x faster   |
| `venice_mask.glb`                 | 103.90 ms | 174.00 ms |      113.90 ms | 🟢 1.67x faster       | 🟢 1.10x faster   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
