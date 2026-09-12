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
| `manablade-bundle.glb`            |   493 |  77,544 |  22.75 ms |  31.11 ms |       26.79 ms | 🟢 1.37x faster       | 🟢 1.18x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   2.79 ms |   3.96 ms |        4.40 ms | 🟢 1.42x faster       | 🟢 1.58x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  58.58 ms |  73.24 ms |       75.88 ms | 🟢 1.25x faster       | 🟢 1.30x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   3.43 ms |   4.33 ms |        4.87 ms | 🟢 1.26x faster       | 🟢 1.42x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   3.63 ms |   5.42 ms |        5.46 ms | 🟢 1.49x faster       | 🟢 1.50x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.64 ms |   0.87 ms |        1.05 ms | 🟢 1.36x faster       | 🟢 1.65x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  45.02 ms |  60.68 ms |       77.21 ms | 🟢 1.35x faster       | 🟢 1.72x faster   |
| `forest_house.glb`                |    12 |  10,956 |   1.85 ms |   2.46 ms |        2.63 ms | 🟢 1.33x faster       | 🟢 1.42x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.25 ms |   2.92 ms |        3.26 ms | 🟢 1.30x faster       | 🟢 1.45x faster   |
| `kira.glb`                        |    43 |  51,601 |   6.83 ms |   9.37 ms |       11.04 ms | 🟢 1.37x faster       | 🟢 1.62x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.02 ms |   2.71 ms |        3.00 ms | 🟢 1.34x faster       | 🟢 1.49x faster   |
| `nemetona.glb`                    |     1 | 320,352 |  97.08 ms | 133.70 ms |      139.49 ms | 🟢 1.38x faster       | 🟢 1.44x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.99 ms |   5.22 ms |        3.90 ms | 🟢 1.31x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  29.67 ms |  37.87 ms |       41.49 ms | 🟢 1.28x faster       | 🟢 1.40x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  50.37 ms |  78.72 ms |       80.28 ms | 🟢 1.56x faster       | 🟢 1.59x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.93 ms |   7.72 ms |        4.18 ms | 🟢 1.30x faster       | 🔴 1.42x slower   |
| `car.drc`                         |     1 |   1,744 |   0.06 ms |   1.76 ms |        0.13 ms | 🟢 30.82x faster      | 🟢 2.19x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.67 ms |   0.88 ms |        1.06 ms | 🟢 1.32x faster       | 🟢 1.60x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-09-12
- Browser: Chrome/152.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  24.80 ms |  34.70 ms |       27.40 ms | 🟢 1.40x faster       | 🟢 1.10x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.40 ms |   4.90 ms |        4.40 ms | 🟢 1.44x faster       | 🟢 1.29x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  68.60 ms |  83.70 ms |       76.30 ms | 🟢 1.22x faster       | 🟢 1.11x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.00 ms |   5.20 ms |        4.80 ms | 🟢 1.30x faster       | 🟢 1.20x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   4.70 ms |   6.70 ms |        5.60 ms | 🟢 1.43x faster       | 🟢 1.19x faster   |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   1.10 ms |        1.10 ms | 🟢 1.38x faster       | 🟢 1.38x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  58.00 ms |  77.70 ms |       76.30 ms | 🟢 1.34x faster       | 🟢 1.32x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.20 ms |   3.10 ms |        2.70 ms | 🟢 1.41x faster       | 🟢 1.23x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.00 ms |   4.10 ms |        3.40 ms | 🟢 1.37x faster       | 🟢 1.13x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.00 ms |  12.50 ms |       11.20 ms | 🟢 1.39x faster       | 🟢 1.24x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.50 ms |   3.40 ms |        3.10 ms | 🟢 1.36x faster       | 🟢 1.24x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 117.90 ms | 155.80 ms |      133.40 ms | 🟢 1.32x faster       | 🟢 1.13x faster   |
| `pool.glb`                        |     2 |  22,280 |   3.50 ms |   5.10 ms |        3.90 ms | 🟢 1.46x faster       | 🟢 1.11x faster   |
| `rolex.glb`                       |    24 | 120,336 |  34.70 ms |  42.90 ms |       39.20 ms | 🟢 1.24x faster       | 🟢 1.13x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  66.60 ms |  88.60 ms |       77.20 ms | 🟢 1.33x faster       | 🟢 1.16x faster   |
| `bunny.drc`                       |     1 |  69,451 |   4.40 ms |   5.40 ms |        4.00 ms | 🟢 1.23x faster       | 🔴 1.10x slower   |
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
| `manablade-bundle.glb`            |  17.10 ms |  41.60 ms |       15.60 ms | 🟢 2.43x faster       | 🔴 1.10x slower   |
| `IridescentDishWithOlives.glb`    |  49.30 ms |  50.20 ms |       44.10 ms | ⚪ even               | 🔴 1.12x slower   |
| `LittlestTokyo.glb`               |  68.00 ms | 143.10 ms |       63.50 ms | 🟢 2.10x faster       | 🔴 1.07x slower   |
| `ShaderBall2.glb`                 |  12.40 ms |  17.50 ms |       12.10 ms | 🟢 1.41x faster       | ⚪ even           |
| `bath_day.glb`                    |  33.10 ms |  39.30 ms |       32.80 ms | 🟢 1.19x faster       | ⚪ even           |
| `duck.glb`                        |   1.30 ms |   2.10 ms |        1.50 ms | 🟢 1.62x faster       | 🟢 1.15x faster   |
| `ferrari.glb`                     |  20.10 ms |  76.80 ms |       24.30 ms | 🟢 3.82x faster       | 🟢 1.21x faster   |
| `forest_house.glb`                |  20.70 ms |  22.80 ms |       19.30 ms | 🟢 1.10x faster       | 🔴 1.07x slower   |
| `gears.glb`                       |   1.70 ms |   4.10 ms |        1.90 ms | 🟢 2.41x faster       | 🟢 1.12x faster   |
| `kira.glb`                        | 192.80 ms | 201.40 ms |      192.70 ms | ⚪ even               | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  24.40 ms |  27.60 ms |       24.50 ms | 🟢 1.13x faster       | ⚪ even           |
| `nemetona.glb`                    | 126.40 ms | 182.50 ms |      138.60 ms | 🟢 1.44x faster       | 🟢 1.10x faster   |
| `pool.glb`                        |  35.50 ms |  40.30 ms |       35.60 ms | 🟢 1.14x faster       | ⚪ even           |
| `rolex.glb`                       |  17.50 ms |  55.40 ms |       20.20 ms | 🟢 3.17x faster       | 🟢 1.15x faster   |
| `venice_mask.glb`                 |  54.50 ms | 138.20 ms |       60.30 ms | 🟢 2.54x faster       | 🟢 1.11x faster   |

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
| `manablade-bundle.glb`            |  56.90 ms |  75.40 ms |       56.80 ms | 🟢 1.33x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |  57.40 ms |  84.20 ms |       80.50 ms | 🟢 1.47x faster       | 🟢 1.40x faster   |
| `LittlestTokyo.glb`               | 103.90 ms | 185.90 ms |      100.90 ms | 🟢 1.79x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  26.80 ms |  43.50 ms |       29.80 ms | 🟢 1.62x faster       | 🟢 1.11x faster   |
| `bath_day.glb`                    |  46.90 ms |  71.40 ms |       64.10 ms | 🟢 1.52x faster       | 🟢 1.37x faster   |
| `duck.glb`                        |  12.10 ms |  10.30 ms |       29.20 ms | 🔴 1.17x slower       | 🟢 2.41x faster   |
| `ferrari.glb`                     |  71.60 ms | 136.30 ms |       66.90 ms | 🟢 1.90x faster       | 🔴 1.07x slower   |
| `forest_house.glb`                |  38.40 ms |  73.50 ms |       53.60 ms | 🟢 1.91x faster       | 🟢 1.40x faster   |
| `gears.glb`                       |  28.40 ms |  52.30 ms |       29.40 ms | 🟢 1.84x faster       | ⚪ even           |
| `kira.glb`                        | 239.20 ms | 257.70 ms |      236.40 ms | 🟢 1.08x faster       | ⚪ even           |
| `minimalistic_modern_bedroom.glb` |  44.90 ms |  79.90 ms |       52.80 ms | 🟢 1.78x faster       | 🟢 1.18x faster   |
| `nemetona.glb`                    | 278.90 ms | 312.50 ms |      220.10 ms | 🟢 1.12x faster       | 🔴 1.27x slower   |
| `pool.glb`                        |  67.40 ms | 100.90 ms |       70.30 ms | 🟢 1.50x faster       | ⚪ even           |
| `rolex.glb`                       |  87.00 ms | 139.60 ms |       69.70 ms | 🟢 1.60x faster       | 🔴 1.25x slower   |
| `venice_mask.glb`                 | 155.10 ms | 257.50 ms |      128.40 ms | 🟢 1.66x faster       | 🔴 1.21x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
