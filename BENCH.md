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
| `manablade-characters.glb`        |     7 |   2,544 |   3.44 ms |   4.02 ms |        2.72 ms | 🟢 1.17x faster       | 🔴 1.27x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  72.52 ms |  83.26 ms |       75.24 ms | 🟢 1.15x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   5.37 ms |   6.50 ms |        7.62 ms | 🟢 1.21x faster       | 🟢 1.42x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  97.24 ms | 111.08 ms |      114.74 ms | 🟢 1.14x faster       | 🟢 1.18x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   5.53 ms |   6.50 ms |        7.51 ms | 🟢 1.18x faster       | 🟢 1.36x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   6.49 ms |   8.64 ms |        9.42 ms | 🟢 1.33x faster       | 🟢 1.45x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.28 ms |   1.51 ms |        1.68 ms | 🟢 1.18x faster       | 🟢 1.31x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  73.22 ms |  91.26 ms |      114.13 ms | 🟢 1.25x faster       | 🟢 1.56x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.72 ms |   3.87 ms |        3.93 ms | 🟢 1.43x faster       | 🟢 1.45x faster   |
| `gears.glb`                       |     3 |  21,696 |   3.32 ms |   4.45 ms |        4.76 ms | 🟢 1.34x faster       | 🟢 1.44x faster   |
| `kira.glb`                        |    43 |  51,601 |  10.76 ms |  14.97 ms |       16.59 ms | 🟢 1.39x faster       | 🟢 1.54x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.44 ms |   3.91 ms |        4.44 ms | 🟢 1.13x faster       | 🟢 1.29x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 163.62 ms | 192.14 ms |      207.19 ms | 🟢 1.17x faster       | 🟢 1.27x faster   |
| `pool.glb`                        |     2 |  22,280 |   6.67 ms |   8.53 ms |        6.01 ms | 🟢 1.28x faster       | 🔴 1.11x slower   |
| `rolex.glb`                       |    24 | 120,336 |  46.98 ms |  60.52 ms |       60.93 ms | 🟢 1.29x faster       | 🟢 1.30x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  93.75 ms | 114.86 ms |      118.05 ms | 🟢 1.23x faster       | 🟢 1.26x faster   |
| `bunny.drc`                       |     1 |  69,451 |   6.42 ms |   8.67 ms |        6.36 ms | 🟢 1.35x faster       | ⚪ even           |
| `car.drc`                         |     1 |   1,744 |   0.09 ms |   4.28 ms |        0.20 ms | 🟢 46.48x faster      | 🟢 2.12x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.07 ms |   1.32 ms |        1.64 ms | 🟢 1.23x faster       | 🟢 1.53x faster   |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-08-27
- Browser: Chrome/151.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   2.50 ms |   4.10 ms |        2.00 ms | 🟢 1.64x faster       | 🔴 1.25x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  76.20 ms | 101.90 ms |       75.30 ms | 🟢 1.34x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   5.50 ms |   7.50 ms |        6.70 ms | 🟢 1.36x faster       | 🟢 1.22x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 | 110.10 ms | 125.30 ms |      115.20 ms | 🟢 1.14x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |     3 |  13,388 |   6.50 ms |   8.00 ms |        7.60 ms | 🟢 1.23x faster       | 🟢 1.17x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   8.00 ms |  10.50 ms |        8.70 ms | 🟢 1.31x faster       | 🟢 1.09x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.30 ms |   1.70 ms |        1.60 ms | 🟢 1.31x faster       | 🟢 1.23x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  96.90 ms | 118.10 ms |      123.60 ms | 🟢 1.22x faster       | 🟢 1.28x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.90 ms |   4.70 ms |        4.20 ms | 🟢 1.21x faster       | 🟢 1.08x faster   |
| `gears.glb`                       |     3 |  21,696 |   4.90 ms |   6.10 ms |        5.20 ms | 🟢 1.24x faster       | 🟢 1.06x faster   |
| `kira.glb`                        |    43 |  51,601 |  15.50 ms |  18.90 ms |       17.50 ms | 🟢 1.22x faster       | 🟢 1.13x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   4.50 ms |   5.30 ms |        4.90 ms | 🟢 1.18x faster       | 🟢 1.09x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 206.50 ms | 241.80 ms |      206.70 ms | 🟢 1.17x faster       | ⚪ even           |
| `pool.glb`                        |     2 |  22,280 |   6.90 ms |   8.10 ms |        6.20 ms | 🟢 1.17x faster       | 🔴 1.11x slower   |
| `rolex.glb`                       |    24 | 120,336 |  60.20 ms |  68.40 ms |       63.50 ms | 🟢 1.14x faster       | 🟢 1.05x faster   |
| `venice_mask.glb`                 |     5 | 295,600 | 118.70 ms | 139.70 ms |      128.80 ms | 🟢 1.18x faster       | 🟢 1.09x faster   |
| `bunny.drc`                       |     1 |  69,451 |   7.00 ms |   9.00 ms |        6.40 ms | 🟢 1.29x faster       | 🔴 1.09x slower   |
| `car.drc`                         |     1 |   1,744 |   0.10 ms |   5.50 ms |        0.30 ms | 🟢 55.00x faster      | 🟢 3.00x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.60 ms |   2.00 ms |        1.80 ms | 🟢 1.25x faster       | 🟢 1.13x faster   |

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
| `manablade-characters.glb`        |   5.50 ms |  10.80 ms |        3.50 ms | 🟢 1.96x faster       | 🔴 1.57x slower   |
| `manablade-static.glb`            |  47.40 ms | 117.40 ms |       37.20 ms | 🟢 2.48x faster       | 🔴 1.27x slower   |
| `IridescentDishWithOlives.glb`    |  88.40 ms |  87.70 ms |       78.80 ms | ⚪ even               | 🔴 1.12x slower   |
| `LittlestTokyo.glb`               | 117.30 ms | 247.40 ms |      113.90 ms | 🟢 2.11x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  22.00 ms |  28.30 ms |       20.00 ms | 🟢 1.29x faster       | 🔴 1.10x slower   |
| `bath_day.glb`                    |  58.20 ms |  68.20 ms |       59.40 ms | 🟢 1.17x faster       | ⚪ even           |
| `duck.glb`                        |   2.90 ms |   4.00 ms |        2.60 ms | 🟢 1.38x faster       | 🔴 1.12x slower   |
| `ferrari.glb`                     |  40.90 ms | 133.80 ms |       42.30 ms | 🟢 3.27x faster       | ⚪ even           |
| `forest_house.glb`                |  35.00 ms |  46.40 ms |       33.60 ms | 🟢 1.33x faster       | ⚪ even           |
| `gears.glb`                       |   3.30 ms |   7.60 ms |        3.10 ms | 🟢 2.30x faster       | 🔴 1.06x slower   |
| `kira.glb`                        | 342.40 ms | 326.60 ms |      307.60 ms | ⚪ even               | 🔴 1.11x slower   |
| `minimalistic_modern_bedroom.glb` |  38.40 ms |  46.20 ms |       41.40 ms | 🟢 1.20x faster       | 🟢 1.08x faster   |
| `nemetona.glb`                    | 258.00 ms | 289.00 ms |      221.00 ms | 🟢 1.12x faster       | 🔴 1.17x slower   |
| `pool.glb`                        |  67.70 ms |  71.00 ms |       62.00 ms | ⚪ even               | 🔴 1.09x slower   |
| `rolex.glb`                       |  35.10 ms |  96.50 ms |       36.90 ms | 🟢 2.75x faster       | 🟢 1.05x faster   |
| `venice_mask.glb`                 | 101.80 ms | 230.30 ms |       95.00 ms | 🟢 2.26x faster       | 🔴 1.07x slower   |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
