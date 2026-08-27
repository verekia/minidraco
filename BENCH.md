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
| `manablade-characters.glb`        |     7 |   2,544 |   2.68 ms |   3.36 ms |        2.62 ms | 🟢 1.25x faster       | ⚪ even           |
| `manablade-static.glb`            |   488 | 220,879 |  68.33 ms |  77.53 ms |       73.37 ms | 🟢 1.13x faster       | 🟢 1.07x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   4.44 ms |   6.23 ms |        6.94 ms | 🟢 1.40x faster       | 🟢 1.56x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  96.56 ms | 109.36 ms |      108.90 ms | 🟢 1.13x faster       | 🟢 1.13x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   5.90 ms |   6.55 ms |        7.16 ms | 🟢 1.11x faster       | 🟢 1.21x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   6.22 ms |   8.11 ms |        7.88 ms | 🟢 1.30x faster       | 🟢 1.27x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.00 ms |   1.22 ms |        1.51 ms | 🟢 1.22x faster       | 🟢 1.52x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  71.57 ms |  88.77 ms |      112.06 ms | 🟢 1.24x faster       | 🟢 1.57x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.34 ms |   3.95 ms |        4.24 ms | 🟢 1.18x faster       | 🟢 1.27x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.64 ms |   4.13 ms |        4.67 ms | 🟢 1.13x faster       | 🟢 1.28x faster   |
| `kira.glb`                        |    43 |  51,601 |  10.77 ms |  13.38 ms |       15.89 ms | 🟢 1.24x faster       | 🟢 1.48x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.73 ms |   4.03 ms |        4.50 ms | 🟢 1.08x faster       | 🟢 1.21x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 164.32 ms | 193.41 ms |      197.37 ms | 🟢 1.18x faster       | 🟢 1.20x faster   |
| `pool.glb`                        |     2 |  22,280 |   6.51 ms |   9.17 ms |        6.25 ms | 🟢 1.41x faster       | ⚪ even           |
| `rolex.glb`                       |    24 | 120,336 |  47.44 ms |  55.25 ms |       59.85 ms | 🟢 1.16x faster       | 🟢 1.26x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  90.98 ms | 112.18 ms |      113.88 ms | 🟢 1.23x faster       | 🟢 1.25x faster   |
| `bunny.drc`                       |     1 |  69,451 |  10.58 ms |  12.07 ms |        6.07 ms | 🟢 1.14x faster       | 🔴 1.74x slower   |
| `car.drc`                         |     1 |   1,744 |   0.08 ms |   4.94 ms |        0.33 ms | 🟢 58.77x faster      | 🟢 3.89x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.44 ms |   1.52 ms |        1.66 ms | 🟢 1.05x faster       | 🟢 1.15x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   2.50 ms |   3.50 ms |        2.00 ms | 🟢 1.40x faster       | 🔴 1.25x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  75.10 ms |  90.80 ms |       73.40 ms | 🟢 1.21x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   6.00 ms |   8.00 ms |        7.10 ms | 🟢 1.33x faster       | 🟢 1.18x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 | 110.70 ms | 121.70 ms |      114.60 ms | 🟢 1.10x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |     3 |  13,388 |   6.70 ms |   8.00 ms |        7.30 ms | 🟢 1.19x faster       | 🟢 1.09x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   8.10 ms |   9.80 ms |        8.60 ms | 🟢 1.21x faster       | 🟢 1.06x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.40 ms |   1.80 ms |        1.60 ms | 🟢 1.29x faster       | 🟢 1.14x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  96.90 ms | 114.90 ms |      112.40 ms | 🟢 1.19x faster       | 🟢 1.16x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.80 ms |   4.70 ms |        4.00 ms | 🟢 1.24x faster       | 🟢 1.05x faster   |
| `gears.glb`                       |     3 |  21,696 |   5.10 ms |   6.20 ms |        5.10 ms | 🟢 1.22x faster       | ⚪ even           |
| `kira.glb`                        |    43 |  51,601 |  14.70 ms |  18.40 ms |       17.10 ms | 🟢 1.25x faster       | 🟢 1.16x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   4.20 ms |   5.00 ms |        4.50 ms | 🟢 1.19x faster       | 🟢 1.07x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 207.00 ms | 231.90 ms |      196.80 ms | 🟢 1.12x faster       | 🔴 1.05x slower   |
| `pool.glb`                        |     2 |  22,280 |   6.50 ms |   7.90 ms |        5.70 ms | 🟢 1.22x faster       | 🔴 1.14x slower   |
| `rolex.glb`                       |    24 | 120,336 |  57.30 ms |  65.20 ms |       59.40 ms | 🟢 1.14x faster       | ⚪ even           |
| `venice_mask.glb`                 |     5 | 295,600 | 116.90 ms | 134.90 ms |      115.90 ms | 🟢 1.15x faster       | ⚪ even           |
| `bunny.drc`                       |     1 |  69,451 |  15.30 ms |   8.80 ms |        6.20 ms | 🔴 1.74x slower       | 🔴 2.47x slower   |
| `car.drc`                         |     1 |   1,744 |   0.10 ms |   3.30 ms |        0.20 ms | 🟢 33.00x faster      | 🟢 2.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.40 ms |   1.70 ms |        1.50 ms | 🟢 1.21x faster       | 🟢 1.07x faster   |

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
| `manablade-characters.glb`        |   4.80 ms |  10.00 ms |        3.30 ms | 🟢 2.08x faster       | 🔴 1.45x slower   |
| `manablade-static.glb`            |  47.10 ms | 115.80 ms |       36.40 ms | 🟢 2.46x faster       | 🔴 1.29x slower   |
| `IridescentDishWithOlives.glb`    |  87.50 ms |  82.50 ms |       77.60 ms | 🔴 1.06x slower       | 🔴 1.13x slower   |
| `LittlestTokyo.glb`               | 113.30 ms | 237.80 ms |      113.50 ms | 🟢 2.10x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  19.30 ms |  27.90 ms |       21.10 ms | 🟢 1.45x faster       | 🟢 1.09x faster   |
| `bath_day.glb`                    |  56.80 ms |  65.30 ms |       53.40 ms | 🟢 1.15x faster       | 🔴 1.06x slower   |
| `duck.glb`                        |   2.50 ms |   4.30 ms |        2.70 ms | 🟢 1.72x faster       | 🟢 1.08x faster   |
| `ferrari.glb`                     |  40.70 ms | 126.30 ms |       42.00 ms | 🟢 3.10x faster       | ⚪ even           |
| `forest_house.glb`                |  35.90 ms |  45.10 ms |       34.90 ms | 🟢 1.26x faster       | ⚪ even           |
| `gears.glb`                       |   3.60 ms |   7.60 ms |        3.20 ms | 🟢 2.11x faster       | 🔴 1.13x slower   |
| `kira.glb`                        | 317.30 ms | 314.70 ms |      290.80 ms | ⚪ even               | 🔴 1.09x slower   |
| `minimalistic_modern_bedroom.glb` |  38.00 ms |  46.60 ms |       39.30 ms | 🟢 1.23x faster       | ⚪ even           |
| `nemetona.glb`                    | 249.70 ms | 279.80 ms |      210.80 ms | 🟢 1.12x faster       | 🔴 1.18x slower   |
| `pool.glb`                        |  72.70 ms |  67.50 ms |       76.40 ms | 🔴 1.08x slower       | 🟢 1.05x faster   |
| `rolex.glb`                       |  34.10 ms |  99.40 ms |       33.70 ms | 🟢 2.91x faster       | ⚪ even           |
| `venice_mask.glb`                 | 103.40 ms | 233.70 ms |       97.90 ms | 🟢 2.26x faster       | 🔴 1.06x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
