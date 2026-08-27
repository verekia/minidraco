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
| `manablade-bundle.glb`            |   493 |  77,544 |  35.02 ms |  45.10 ms |       37.66 ms | 🟢 1.29x faster       | 🟢 1.08x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   4.92 ms |   5.40 ms |        6.02 ms | 🟢 1.10x faster       | 🟢 1.22x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  83.11 ms |  94.70 ms |       99.00 ms | 🟢 1.14x faster       | 🟢 1.19x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.96 ms |   6.05 ms |        6.56 ms | 🟢 1.22x faster       | 🟢 1.32x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   7.10 ms |   7.49 ms |        7.15 ms | 🟢 1.05x faster       | ⚪ even           |
| `duck.glb`                        |     1 |   4,212 |   0.87 ms |   1.12 ms |        3.37 ms | 🟢 1.30x faster       | 🟢 3.89x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  68.19 ms |  80.11 ms |      100.41 ms | 🟢 1.17x faster       | 🟢 1.47x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.59 ms |   3.21 ms |        3.79 ms | 🟢 1.24x faster       | 🟢 1.46x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.37 ms |   3.80 ms |        4.47 ms | 🟢 1.13x faster       | 🟢 1.33x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.00 ms |  11.40 ms |       14.15 ms | 🟢 1.27x faster       | 🟢 1.57x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.86 ms |   3.23 ms |        3.73 ms | 🟢 1.13x faster       | 🟢 1.31x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 141.12 ms | 164.83 ms |      179.04 ms | 🟢 1.17x faster       | 🟢 1.27x faster   |
| `pool.glb`                        |     2 |  22,280 |   5.36 ms |   6.89 ms |        5.22 ms | 🟢 1.28x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  39.36 ms |  50.90 ms |       53.11 ms | 🟢 1.29x faster       | 🟢 1.35x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  80.64 ms |  97.92 ms |      101.64 ms | 🟢 1.21x faster       | 🟢 1.26x faster   |
| `bunny.drc`                       |     1 |  69,451 |   5.49 ms |  10.75 ms |        5.30 ms | 🟢 1.96x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.08 ms |   4.54 ms |        0.19 ms | 🟢 55.35x faster      | 🟢 2.34x faster   |
| `duck.drc`                        |     1 |   4,212 |   0.92 ms |   1.31 ms |        1.33 ms | 🟢 1.42x faster       | 🟢 1.45x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-bundle.glb`            |   493 |  77,544 |  35.30 ms |  45.40 ms |       35.40 ms | 🟢 1.29x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   4.80 ms |   6.30 ms |        5.70 ms | 🟢 1.31x faster       | 🟢 1.19x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  94.90 ms | 105.60 ms |       95.80 ms | 🟢 1.11x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |     3 |  13,388 |   5.70 ms |   6.70 ms |        6.10 ms | 🟢 1.18x faster       | 🟢 1.07x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   6.50 ms |   8.30 ms |        7.00 ms | 🟢 1.28x faster       | 🟢 1.08x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.10 ms |   1.40 ms |        1.40 ms | 🟢 1.27x faster       | 🟢 1.27x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  82.00 ms |  99.80 ms |       97.50 ms | 🟢 1.22x faster       | 🟢 1.19x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.10 ms |   3.90 ms |        3.40 ms | 🟢 1.26x faster       | 🟢 1.10x faster   |
| `gears.glb`                       |     3 |  21,696 |   4.00 ms |   5.20 ms |        4.20 ms | 🟢 1.30x faster       | 🟢 1.05x faster   |
| `kira.glb`                        |    43 |  51,601 |  12.70 ms |  16.40 ms |       14.70 ms | 🟢 1.29x faster       | 🟢 1.16x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.90 ms |   4.30 ms |        3.90 ms | 🟢 1.10x faster       | ⚪ even           |
| `nemetona.glb`                    |     1 | 320,352 | 178.20 ms | 201.00 ms |      175.70 ms | 🟢 1.13x faster       | ⚪ even           |
| `pool.glb`                        |     2 |  22,280 |   5.50 ms |   6.90 ms |        5.10 ms | 🟢 1.25x faster       | 🔴 1.08x slower   |
| `rolex.glb`                       |    24 | 120,336 |  49.30 ms |  58.20 ms |       50.50 ms | 🟢 1.18x faster       | ⚪ even           |
| `venice_mask.glb`                 |     5 | 295,600 |  98.00 ms | 116.80 ms |       99.40 ms | 🟢 1.19x faster       | ⚪ even           |
| `bunny.drc`                       |     1 |  69,451 |   6.00 ms |   7.90 ms |        5.40 ms | 🟢 1.32x faster       | 🔴 1.11x slower   |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   3.00 ms |        0.20 ms | 🟢 60.00x faster      | 🟢 4.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.20 ms |   1.40 ms |        1.30 ms | 🟢 1.17x faster       | 🟢 1.08x faster   |

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
| `manablade-bundle.glb`            |  34.50 ms |  66.00 ms |       23.10 ms | 🟢 1.91x faster       | 🔴 1.49x slower   |
| `IridescentDishWithOlives.glb`    |  83.90 ms |  76.60 ms |       69.20 ms | 🔴 1.10x slower       | 🔴 1.21x slower   |
| `LittlestTokyo.glb`               | 107.20 ms | 209.20 ms |       96.40 ms | 🟢 1.95x faster       | 🔴 1.11x slower   |
| `ShaderBall2.glb`                 |  17.10 ms |  24.90 ms |       16.40 ms | 🟢 1.46x faster       | ⚪ even           |
| `bath_day.glb`                    |  46.30 ms |  59.10 ms |       47.10 ms | 🟢 1.28x faster       | ⚪ even           |
| `duck.glb`                        |   2.00 ms |   3.80 ms |        2.10 ms | 🟢 1.90x faster       | 🟢 1.05x faster   |
| `ferrari.glb`                     |  34.80 ms | 111.30 ms |       33.80 ms | 🟢 3.20x faster       | ⚪ even           |
| `forest_house.glb`                |  35.10 ms |  35.70 ms |       27.00 ms | ⚪ even               | 🔴 1.30x slower   |
| `gears.glb`                       |   2.70 ms |   6.30 ms |        2.40 ms | 🟢 2.33x faster       | 🔴 1.13x slower   |
| `kira.glb`                        | 272.40 ms | 278.00 ms |      258.50 ms | ⚪ even               | 🔴 1.05x slower   |
| `minimalistic_modern_bedroom.glb` |  32.80 ms |  37.70 ms |       33.50 ms | 🟢 1.15x faster       | ⚪ even           |
| `nemetona.glb`                    | 210.40 ms | 247.90 ms |      183.00 ms | 🟢 1.18x faster       | 🔴 1.15x slower   |
| `pool.glb`                        |  92.70 ms |  67.00 ms |       53.80 ms | 🔴 1.38x slower       | 🔴 1.72x slower   |
| `rolex.glb`                       |  26.00 ms |  80.60 ms |       28.80 ms | 🟢 3.10x faster       | 🟢 1.11x faster   |
| `venice_mask.glb`                 |  83.90 ms | 192.20 ms |       94.10 ms | 🟢 2.29x faster       | 🟢 1.12x faster   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
