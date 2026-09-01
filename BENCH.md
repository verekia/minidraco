# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 5% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-09-02
- Runtime: bun 1.4.0 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  23.02 ms |  31.63 ms |       26.52 ms | 🟢 1.37x faster       | 🟢 1.15x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.06 ms |   4.06 ms |        4.30 ms | 🟢 1.33x faster       | 🟢 1.40x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  62.52 ms |  71.37 ms |       75.63 ms | 🟢 1.14x faster       | 🟢 1.21x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.52 ms |   4.25 ms |        4.92 ms | 🟢 1.21x faster       | 🟢 1.40x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.00 ms |   5.53 ms |        5.51 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.66 ms |   0.81 ms |        1.08 ms | 🟢 1.23x faster       | 🟢 1.63x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  47.11 ms |  59.25 ms |       75.58 ms | 🟢 1.26x faster       | 🟢 1.60x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.92 ms |   2.44 ms |        2.65 ms | 🟢 1.27x faster       | 🟢 1.39x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.19 ms |   2.97 ms |        3.32 ms | 🟢 1.35x faster       | 🟢 1.52x faster   |
| `kira.glb`                        |    43 |  51,601 |   6.83 ms |   8.99 ms |       10.99 ms | 🟢 1.32x faster       | 🟢 1.61x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.27 ms |   2.60 ms |        2.94 ms | 🟢 1.14x faster       | 🟢 1.29x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 109.79 ms | 131.88 ms |      136.80 ms | 🟢 1.20x faster       | 🟢 1.25x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.94 ms |   4.86 ms |        3.97 ms | 🟢 1.23x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  31.58 ms |  37.34 ms |       40.33 ms | 🟢 1.18x faster       | 🟢 1.28x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  57.88 ms |  78.39 ms |       79.68 ms | 🟢 1.35x faster       | 🟢 1.38x faster   |
| `bunny.drc`                       |     1 |  69,451 |   6.75 ms |   8.30 ms |        4.30 ms | 🟢 1.23x faster       | 🔴 1.57x slower   |
| `car.drc`                         |     1 |   1,744 |   0.06 ms |   1.59 ms |        0.13 ms | 🟢 27.98x faster      | 🟢 2.32x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.73 ms |   1.05 ms |        1.05 ms | 🟢 1.44x faster       | 🟢 1.45x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-02
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  26.50 ms |  35.20 ms |       27.10 ms | 🟢 1.33x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.80 ms |   5.20 ms |        4.70 ms | 🟢 1.37x faster       | 🟢 1.24x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  75.00 ms |  86.10 ms |       75.40 ms | 🟢 1.15x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.40 ms |   5.40 ms |        4.90 ms | 🟢 1.23x faster       | 🟢 1.11x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   5.10 ms |   6.60 ms |        5.60 ms | 🟢 1.29x faster       | 🟢 1.10x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  61.70 ms |  79.00 ms |       76.10 ms | 🟢 1.28x faster       | 🟢 1.23x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.40 ms |   3.20 ms |        2.70 ms | 🟢 1.33x faster       | 🟢 1.13x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.00 ms |   4.00 ms |        3.40 ms | 🟢 1.33x faster       | 🟢 1.13x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.20 ms |  12.70 ms |       11.20 ms | 🟢 1.38x faster       | 🟢 1.22x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.80 ms |   3.40 ms |        3.10 ms | 🟢 1.21x faster       | 🟢 1.11x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 136.40 ms | 159.10 ms |      136.40 ms | 🟢 1.17x faster       | ⚪ even           |
| `pool.glb`                        |     2 |  22,280 |   4.10 ms |   5.10 ms |        3.90 ms | 🟢 1.24x faster       | 🔴 1.05x slower   |
| `rolex.glb`                       |    24 | 120,336 |  38.00 ms |  44.20 ms |       39.90 ms | 🟢 1.16x faster       | 🟢 1.05x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  78.40 ms |  92.70 ms |       78.70 ms | 🟢 1.18x faster       | ⚪ even           |
| `bunny.drc`                       |     1 |  69,451 |   4.50 ms |   5.60 ms |        4.10 ms | 🟢 1.24x faster       | 🔴 1.10x slower   |
| `car.drc`                         |     1 |   1,744 |   0.10 ms |   2.70 ms |        0.20 ms | 🟢 27.00x faster      | 🟢 2.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.90 ms |   1.20 ms |        1.10 ms | 🟢 1.33x faster       | 🟢 1.22x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 5 warmups
(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the
first load), GLBs only (raw `.drc` files have no glTF container).

- Date: 2026-09-02
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  17.50 ms |  46.60 ms |       17.10 ms | 🟢 2.66x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  47.50 ms |  52.10 ms |       48.00 ms | 🟢 1.10x faster       | ⚪ even           |
| `LittlestTokyo.glb`               |  65.80 ms | 154.80 ms |       65.30 ms | 🟢 2.35x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  12.50 ms |  20.30 ms |       12.30 ms | 🟢 1.62x faster       | ⚪ even           |
| `bath_day.glb`                    |  34.00 ms |  41.90 ms |       33.50 ms | 🟢 1.23x faster       | ⚪ even           |
| `duck.glb`                        |   1.60 ms |   2.30 ms |        1.50 ms | 🟢 1.44x faster       | 🔴 1.07x slower   |
| `ferrari.glb`                     |  22.10 ms |  83.10 ms |       24.40 ms | 🟢 3.76x faster       | 🟢 1.10x faster   |
| `forest_house.glb`                |  21.10 ms |  24.20 ms |       20.00 ms | 🟢 1.15x faster       | 🔴 1.06x slower   |
| `gears.glb`                       |   1.70 ms |   4.80 ms |        1.80 ms | 🟢 2.82x faster       | 🟢 1.06x faster   |
| `kira.glb`                        | 199.40 ms | 212.60 ms |      200.50 ms | 🟢 1.07x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  25.70 ms |  29.60 ms |       25.50 ms | 🟢 1.15x faster       | ⚪ even           |
| `nemetona.glb`                    | 146.30 ms | 281.10 ms |      140.40 ms | 🟢 1.92x faster       | ⚪ even           |
| `pool.glb`                        |  37.70 ms |  41.60 ms |       39.90 ms | 🟢 1.10x faster       | 🟢 1.06x faster   |
| `rolex.glb`                       |  16.10 ms |  59.70 ms |       22.40 ms | 🟢 3.71x faster       | 🟢 1.39x faster   |
| `venice_mask.glb`                 |  58.00 ms | 145.50 ms |       57.30 ms | 🟢 2.51x faster       | ⚪ even           |

## Browser — GLTFLoader cold first load (V8)

The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its
worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a
single `GLTFLoader.parse`. Median of 3 trials. draco.js has no pool or wasm to warm,
so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle
worker thread also restarts on a slow core on Apple Silicon.

- Date: 2026-09-02
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |  56.50 ms |  88.30 ms |       38.40 ms | 🟢 1.56x faster       | 🔴 1.47x slower   |
| `IridescentDishWithOlives.glb`    |  59.90 ms |  80.80 ms |       79.60 ms | 🟢 1.35x faster       | 🟢 1.33x faster   |
| `LittlestTokyo.glb`               | 112.40 ms | 187.80 ms |       99.30 ms | 🟢 1.67x faster       | 🔴 1.13x slower   |
| `ShaderBall2.glb`                 |  25.60 ms |  40.50 ms |       30.00 ms | 🟢 1.58x faster       | 🟢 1.17x faster   |
| `bath_day.glb`                    |  48.40 ms |  55.50 ms |       58.60 ms | 🟢 1.15x faster       | 🟢 1.21x faster   |
| `duck.glb`                        |  10.00 ms |   8.10 ms |       12.60 ms | 🔴 1.23x slower       | 🟢 1.26x faster   |
| `ferrari.glb`                     |  75.10 ms | 110.10 ms |       48.50 ms | 🟢 1.47x faster       | 🔴 1.55x slower   |
| `forest_house.glb`                |  36.50 ms |  39.20 ms |       56.60 ms | 🟢 1.07x faster       | 🟢 1.55x faster   |
| `gears.glb`                       |  10.40 ms |  12.20 ms |       15.20 ms | 🟢 1.17x faster       | 🟢 1.46x faster   |
| `kira.glb`                        | 243.00 ms | 262.40 ms |      233.70 ms | 🟢 1.08x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  32.80 ms |  53.30 ms |       53.10 ms | 🟢 1.63x faster       | 🟢 1.62x faster   |
| `nemetona.glb`                    | 196.20 ms | 214.90 ms |      179.00 ms | 🟢 1.10x faster       | 🔴 1.10x slower   |
| `pool.glb`                        |  73.20 ms |  67.50 ms |       60.60 ms | 🔴 1.08x slower       | 🔴 1.21x slower   |
| `rolex.glb`                       |  67.10 ms |  91.80 ms |       47.20 ms | 🟢 1.37x faster       | 🔴 1.42x slower   |
| `venice_mask.glb`                 | 128.70 ms | 169.10 ms |      114.30 ms | 🟢 1.31x faster       | 🔴 1.13x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
