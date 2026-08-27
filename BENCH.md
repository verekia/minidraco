# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 5% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-08-27
- Runtime: bun 1.3.14 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   3.03 ms |   4.33 ms |        2.67 ms | 🟢 1.43x faster       | 🔴 1.13x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  72.44 ms |  80.46 ms |       74.83 ms | 🟢 1.11x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   5.20 ms |   6.01 ms |        6.68 ms | 🟢 1.16x faster       | 🟢 1.29x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  98.67 ms | 109.72 ms |      114.18 ms | 🟢 1.11x faster       | 🟢 1.16x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   5.04 ms |   6.26 ms |        7.48 ms | 🟢 1.24x faster       | 🟢 1.48x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   6.92 ms |   9.10 ms |        8.53 ms | 🟢 1.31x faster       | 🟢 1.23x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.04 ms |   1.34 ms |        1.64 ms | 🟢 1.28x faster       | 🟢 1.57x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  74.51 ms |  90.39 ms |      113.24 ms | 🟢 1.21x faster       | 🟢 1.52x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.03 ms |   3.70 ms |        3.96 ms | 🟢 1.22x faster       | 🟢 1.30x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.76 ms |   4.93 ms |        5.32 ms | 🟢 1.31x faster       | 🟢 1.42x faster   |
| `kira.glb`                        |    43 |  51,601 |  11.06 ms |  13.40 ms |       16.47 ms | 🟢 1.21x faster       | 🟢 1.49x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.27 ms |   3.83 ms |        4.36 ms | 🟢 1.17x faster       | 🟢 1.33x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 167.43 ms | 194.01 ms |      210.78 ms | 🟢 1.16x faster       | 🟢 1.26x faster   |
| `pool.glb`                        |     2 |  22,280 |   6.51 ms |   8.15 ms |        5.97 ms | 🟢 1.25x faster       | 🔴 1.09x slower   |
| `rolex.glb`                       |    24 | 120,336 |  46.75 ms |  58.36 ms |       61.01 ms | 🟢 1.25x faster       | 🟢 1.30x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  93.63 ms | 113.53 ms |      118.55 ms | 🟢 1.21x faster       | 🟢 1.27x faster   |
| `bunny.drc`                       |     1 |  69,451 |   6.58 ms |   8.33 ms |        6.38 ms | 🟢 1.27x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.09 ms |   4.51 ms |        0.27 ms | 🟢 49.53x faster      | 🟢 2.98x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.13 ms |   1.39 ms |        1.65 ms | 🟢 1.23x faster       | 🟢 1.45x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   2.70 ms |   3.70 ms |        2.10 ms | 🟢 1.37x faster       | 🔴 1.29x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  77.10 ms |  93.50 ms |       77.60 ms | 🟢 1.21x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   6.40 ms |   8.40 ms |        7.60 ms | 🟢 1.31x faster       | 🟢 1.19x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 | 117.30 ms | 127.40 ms |      113.60 ms | 🟢 1.09x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |     3 |  13,388 |   6.80 ms |   8.10 ms |        7.50 ms | 🟢 1.19x faster       | 🟢 1.10x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   8.10 ms |  10.40 ms |        8.60 ms | 🟢 1.28x faster       | 🟢 1.06x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.30 ms |   1.60 ms |        1.60 ms | 🟢 1.23x faster       | 🟢 1.23x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  98.80 ms | 118.50 ms |      114.00 ms | 🟢 1.20x faster       | 🟢 1.15x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.60 ms |   5.10 ms |        4.30 ms | 🟢 1.42x faster       | 🟢 1.19x faster   |
| `gears.glb`                       |     3 |  21,696 |   5.10 ms |   6.00 ms |        5.20 ms | 🟢 1.18x faster       | ⚪ even           |
| `kira.glb`                        |    43 |  51,601 |  15.10 ms |  18.40 ms |       17.50 ms | 🟢 1.22x faster       | 🟢 1.16x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   4.50 ms |   5.30 ms |        4.70 ms | 🟢 1.18x faster       | ⚪ even           |
| `nemetona.glb`                    |     1 | 320,352 | 211.80 ms | 239.00 ms |      204.40 ms | 🟢 1.13x faster       | ⚪ even           |
| `pool.glb`                        |     2 |  22,280 |   6.40 ms |   8.10 ms |        6.20 ms | 🟢 1.27x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  58.50 ms |  66.80 ms |       60.00 ms | 🟢 1.14x faster       | ⚪ even           |
| `venice_mask.glb`                 |     5 | 295,600 | 117.90 ms | 135.80 ms |      117.90 ms | 🟢 1.15x faster       | ⚪ even           |
| `bunny.drc`                       |     1 |  69,451 |   7.20 ms |   8.60 ms |        6.50 ms | 🟢 1.19x faster       | 🔴 1.11x slower   |
| `car.drc`                         |     1 |   1,744 |   0.10 ms |   3.80 ms |        0.30 ms | 🟢 38.00x faster      | 🟢 3.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.40 ms |   1.80 ms |        1.70 ms | 🟢 1.29x faster       | 🟢 1.21x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 1 warmup, GLBs only
(raw `.drc` files have no glTF container).

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |   4.40 ms |  10.80 ms |        3.30 ms | 🟢 2.45x faster       | 🔴 1.33x slower   |
| `manablade-static.glb`            |  50.60 ms | 118.80 ms |       37.60 ms | 🟢 2.35x faster       | 🔴 1.35x slower   |
| `IridescentDishWithOlives.glb`    |  86.00 ms |  86.10 ms |       82.70 ms | ⚪ even               | ⚪ even           |
| `LittlestTokyo.glb`               | 118.10 ms | 251.40 ms |      113.60 ms | 🟢 2.13x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  21.00 ms |  31.80 ms |       19.70 ms | 🟢 1.51x faster       | 🔴 1.07x slower   |
| `bath_day.glb`                    |  57.50 ms |  66.00 ms |       56.90 ms | 🟢 1.15x faster       | ⚪ even           |
| `duck.glb`                        |   2.60 ms |   3.90 ms |        2.50 ms | 🟢 1.50x faster       | ⚪ even           |
| `ferrari.glb`                     |  41.10 ms | 133.00 ms |       41.60 ms | 🟢 3.24x faster       | ⚪ even           |
| `forest_house.glb`                |  32.80 ms |  41.90 ms |       33.40 ms | 🟢 1.28x faster       | ⚪ even           |
| `gears.glb`                       |   3.50 ms |   7.60 ms |        3.10 ms | 🟢 2.17x faster       | 🔴 1.13x slower   |
| `kira.glb`                        | 326.80 ms | 316.70 ms |      296.90 ms | ⚪ even               | 🔴 1.10x slower   |
| `minimalistic_modern_bedroom.glb` |  40.20 ms |  47.50 ms |       39.50 ms | 🟢 1.18x faster       | ⚪ even           |
| `nemetona.glb`                    | 249.30 ms | 286.30 ms |      211.70 ms | 🟢 1.15x faster       | 🔴 1.18x slower   |
| `pool.glb`                        |  67.80 ms |  69.00 ms |       60.20 ms | ⚪ even               | 🔴 1.13x slower   |
| `rolex.glb`                       |  35.70 ms |  96.30 ms |       33.70 ms | 🟢 2.70x faster       | 🔴 1.06x slower   |
| `venice_mask.glb`                 |  98.80 ms | 225.30 ms |       92.00 ms | 🟢 2.28x faster       | 🔴 1.07x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
