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
| `manablade-characters.glb`        |     7 |   2,544 |   3.52 ms |   3.98 ms |        2.88 ms | 🟢 1.13x faster       | 🔴 1.22x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  65.11 ms |  74.51 ms |       66.35 ms | 🟢 1.14x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   4.39 ms |   5.70 ms |        6.61 ms | 🟢 1.30x faster       | 🟢 1.51x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  90.24 ms | 100.75 ms |      101.65 ms | 🟢 1.12x faster       | 🟢 1.13x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.85 ms |   5.65 ms |        6.66 ms | 🟢 1.17x faster       | 🟢 1.37x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   6.41 ms |   7.63 ms |        7.79 ms | 🟢 1.19x faster       | 🟢 1.21x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.03 ms |   1.22 ms |        1.52 ms | 🟢 1.19x faster       | 🟢 1.48x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  71.95 ms |  83.68 ms |       99.95 ms | 🟢 1.16x faster       | 🟢 1.39x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.66 ms |   3.51 ms |        3.47 ms | 🟢 1.32x faster       | 🟢 1.31x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.38 ms |   4.04 ms |        4.41 ms | 🟢 1.20x faster       | 🟢 1.30x faster   |
| `kira.glb`                        |    43 |  51,601 |  10.37 ms |  12.61 ms |       15.13 ms | 🟢 1.22x faster       | 🟢 1.46x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.25 ms |   3.44 ms |        3.90 ms | 🟢 1.06x faster       | 🟢 1.20x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 150.79 ms | 170.16 ms |      179.07 ms | 🟢 1.13x faster       | 🟢 1.19x faster   |
| `pool.glb`                        |     2 |  22,280 |   6.16 ms |   7.78 ms |        5.04 ms | 🟢 1.26x faster       | 🔴 1.22x slower   |
| `rolex.glb`                       |    24 | 120,336 |  44.88 ms |  50.59 ms |       51.59 ms | 🟢 1.13x faster       | 🟢 1.15x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  84.05 ms |  99.63 ms |      100.61 ms | 🟢 1.19x faster       | 🟢 1.20x faster   |
| `bunny.drc`                       |     1 |  69,451 |   9.45 ms |  10.78 ms |        5.49 ms | 🟢 1.14x faster       | 🔴 1.72x slower   |
| `car.drc`                         |     1 |   1,744 |   0.09 ms |   4.18 ms |        0.22 ms | 🟢 48.65x faster      | 🟢 2.58x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.00 ms |   1.26 ms |        1.35 ms | 🟢 1.26x faster       | 🟢 1.36x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   2.80 ms |   3.50 ms |        1.90 ms | 🟢 1.25x faster       | 🔴 1.47x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  77.30 ms |  95.40 ms |       74.10 ms | 🟢 1.23x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   6.00 ms |   7.60 ms |        6.80 ms | 🟢 1.27x faster       | 🟢 1.13x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 | 117.70 ms | 131.60 ms |      109.90 ms | 🟢 1.12x faster       | 🔴 1.07x slower   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   6.90 ms |   8.00 ms |        7.40 ms | 🟢 1.16x faster       | 🟢 1.07x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   8.10 ms |  10.40 ms |        8.70 ms | 🟢 1.28x faster       | 🟢 1.07x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.30 ms |   1.80 ms |        1.60 ms | 🟢 1.38x faster       | 🟢 1.23x faster   |
| `ferrari.glb`                     |    51 | 358,788 | 103.70 ms | 116.10 ms |      114.50 ms | 🟢 1.12x faster       | 🟢 1.10x faster   |
| `forest_house.glb`                |    12 |  10,956 |   5.60 ms |   5.80 ms |        4.40 ms | ⚪ even               | 🔴 1.27x slower   |
| `gears.glb`                       |     3 |  21,696 |   5.60 ms |   6.40 ms |        5.20 ms | 🟢 1.14x faster       | 🔴 1.08x slower   |
| `kira.glb`                        |    43 |  51,601 |  16.50 ms |  20.20 ms |       17.80 ms | 🟢 1.22x faster       | 🟢 1.08x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   4.40 ms |   5.20 ms |        4.50 ms | 🟢 1.18x faster       | ⚪ even           |
| `nemetona.glb`                    |     1 | 320,352 | 183.80 ms | 222.60 ms |      213.10 ms | 🟢 1.21x faster       | 🟢 1.16x faster   |
| `pool.glb`                        |     2 |  22,280 |   6.60 ms |   8.50 ms |        6.10 ms | 🟢 1.29x faster       | 🔴 1.08x slower   |
| `rolex.glb`                       |    24 | 120,336 |  57.00 ms |  60.70 ms |       54.60 ms | 🟢 1.06x faster       | ⚪ even           |
| `venice_mask.glb`                 |     5 | 295,600 | 105.60 ms | 122.80 ms |      103.40 ms | 🟢 1.16x faster       | ⚪ even           |
| `bunny.drc`                       |     1 |  69,451 |  13.70 ms |   7.80 ms |        5.70 ms | 🔴 1.76x slower       | 🔴 2.40x slower   |
| `car.drc`                         |     1 |   1,744 |   0.10 ms |   3.80 ms |        0.20 ms | 🟢 38.00x faster      | 🟢 2.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.20 ms |   1.50 ms |        1.40 ms | 🟢 1.25x faster       | 🟢 1.17x faster   |

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
| `manablade-characters.glb`        |   6.00 ms |  10.80 ms |        3.30 ms | 🟢 1.80x faster       | 🔴 1.82x slower   |
| `manablade-static.glb`            |  48.90 ms | 108.80 ms |       35.50 ms | 🟢 2.22x faster       | 🔴 1.38x slower   |
| `IridescentDishWithOlives.glb`    |  80.40 ms |  81.70 ms |       73.00 ms | ⚪ even               | 🔴 1.10x slower   |
| `LittlestTokyo.glb`               | 118.50 ms | 234.10 ms |      141.10 ms | 🟢 1.98x faster       | 🟢 1.19x faster   |
| `ShaderBall2.glb`                 |  21.10 ms |  30.10 ms |       22.60 ms | 🟢 1.43x faster       | 🟢 1.07x faster   |
| `bath_day.glb`                    |  51.30 ms |  65.50 ms |       54.10 ms | 🟢 1.28x faster       | 🟢 1.05x faster   |
| `duck.glb`                        |   2.60 ms |   3.90 ms |        2.80 ms | 🟢 1.50x faster       | 🟢 1.08x faster   |
| `ferrari.glb`                     |  40.70 ms | 137.10 ms |       40.60 ms | 🟢 3.37x faster       | ⚪ even           |
| `forest_house.glb`                |  36.60 ms |  45.00 ms |       37.10 ms | 🟢 1.23x faster       | ⚪ even           |
| `gears.glb`                       |   3.50 ms |   6.90 ms |        3.00 ms | 🟢 1.97x faster       | 🔴 1.17x slower   |
| `kira.glb`                        | 292.90 ms | 281.10 ms |      266.70 ms | ⚪ even               | 🔴 1.10x slower   |
| `minimalistic_modern_bedroom.glb` |  36.40 ms |  41.90 ms |       35.00 ms | 🟢 1.15x faster       | ⚪ even           |
| `nemetona.glb`                    | 248.40 ms | 260.10 ms |      221.90 ms | ⚪ even               | 🔴 1.12x slower   |
| `pool.glb`                        | 111.80 ms |  77.90 ms |      101.20 ms | 🔴 1.44x slower       | 🔴 1.10x slower   |
| `rolex.glb`                       |  45.30 ms | 122.70 ms |       40.80 ms | 🟢 2.71x faster       | 🔴 1.11x slower   |
| `venice_mask.glb`                 | 138.30 ms | 258.60 ms |      148.10 ms | 🟢 1.87x faster       | 🟢 1.07x faster   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
