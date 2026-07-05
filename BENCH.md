# Benchmark results

<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->

Median decode time per file (every Draco primitive decoded sequentially per run). The corpus
is the production bundle GLBs from `example/public/models` plus the sample models shipped in
[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the
installed dependency). The last two columns say how minidraco compares to each other decoder:
🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 5% (run noise).

## Bun — single-threaded (JavaScriptCore)

Raw decode via `bun run bench`, median of 10 runs after 3 warmups.

- Date: 2026-07-05
- Runtime: bun 1.3.14 (JavaScriptCore)
- CPU: Apple M3

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   1.89 ms |   2.31 ms |        3.08 ms | 🟢 1.22x faster       | 🟢 1.63x faster   |
| `manablade-static.glb`            |   488 | 220,879 |  47.89 ms |  51.03 ms |       50.21 ms | 🟢 1.07x faster       | ⚪ even           |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   3.74 ms |   3.66 ms |        4.53 ms | ⚪ even               | 🟢 1.21x faster   |
| `LittlestTokyo.glb`               |    71 | 141,802 |  69.91 ms |  74.47 ms |       76.19 ms | 🟢 1.07x faster       | 🟢 1.09x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   4.17 ms |   4.45 ms |        5.10 ms | 🟢 1.07x faster       | 🟢 1.22x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   5.99 ms |   5.99 ms |        5.81 ms | ⚪ even               | ⚪ even           |
| `duck.glb`                        |     1 |   4,212 |   0.80 ms |   0.90 ms |        1.08 ms | 🟢 1.12x faster       | 🟢 1.35x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  61.34 ms |  62.04 ms |       77.00 ms | ⚪ even               | 🟢 1.26x faster   |
| `forest_house.glb`                |    12 |  10,956 |   2.48 ms |   2.60 ms |        2.77 ms | ⚪ even               | 🟢 1.12x faster   |
| `gears.glb`                       |     3 |  21,696 |   2.95 ms |   2.98 ms |        3.35 ms | ⚪ even               | 🟢 1.13x faster   |
| `kira.glb`                        |    43 |  51,601 |   9.51 ms |   9.39 ms |       11.26 ms | ⚪ even               | 🟢 1.18x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   2.57 ms |   2.61 ms |        3.20 ms | ⚪ even               | 🟢 1.25x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 128.99 ms | 133.70 ms |      139.53 ms | ⚪ even               | 🟢 1.08x faster   |
| `pool.glb`                        |     2 |  22,280 |   5.00 ms |   5.02 ms |        4.02 ms | ⚪ even               | 🔴 1.24x slower   |
| `rolex.glb`                       |    24 | 120,336 |  35.70 ms |  37.61 ms |       40.78 ms | 🟢 1.05x faster       | 🟢 1.14x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  75.99 ms |  77.39 ms |       80.40 ms | ⚪ even               | 🟢 1.06x faster   |
| `bunny.drc`                       |     1 |  69,451 |   7.94 ms |   8.68 ms |        4.24 ms | 🟢 1.09x faster       | 🔴 1.87x slower   |
| `car.drc`                         |     1 |   1,744 |   0.06 ms |   2.98 ms |        0.13 ms | 🟢 46.64x faster      | 🟢 2.06x faster   |
| `duck.drc`                        |     1 |   4,212 |   1.14 ms |   1.14 ms |        1.16 ms | ⚪ even               | ⚪ even           |

## Browser — single-threaded raw decode (V8)

All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader
overhead. Median of 10 runs after 3 warmups, saved from the example's `/bench` page.

- Date: 2026-07-05
- Browser: Chrome/149.0.0.0 on Macintosh

| file                              | prims |   faces | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | ----: | ------: | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |     7 |   2,544 |   2.10 ms |   2.20 ms |        2.00 ms | ⚪ even               | 🔴 1.05x slower   |
| `manablade-static.glb`            |   488 | 220,879 |  63.40 ms |  64.90 ms |       83.00 ms | ⚪ even               | 🟢 1.31x faster   |
| `IridescentDishWithOlives.glb`    |     4 |  24,448 |   8.10 ms |   5.60 ms |        8.00 ms | 🔴 1.45x slower       | ⚪ even           |
| `LittlestTokyo.glb`               |    71 | 141,802 |  90.70 ms |  92.90 ms |      136.90 ms | ⚪ even               | 🟢 1.51x faster   |
| `ShaderBall2.glb`                 |     3 |  13,388 |   5.50 ms |   5.70 ms |        9.30 ms | ⚪ even               | 🟢 1.69x faster   |
| `bath_day.glb`                    |    22 |  32,158 |   7.40 ms |   7.60 ms |       10.40 ms | ⚪ even               | 🟢 1.41x faster   |
| `duck.glb`                        |     1 |   4,212 |   1.10 ms |   1.20 ms |        2.00 ms | 🟢 1.09x faster       | 🟢 1.82x faster   |
| `ferrari.glb`                     |    51 | 358,788 |  86.30 ms |  84.80 ms |      137.10 ms | ⚪ even               | 🟢 1.59x faster   |
| `forest_house.glb`                |    12 |  10,956 |   3.40 ms |   3.60 ms |        5.10 ms | 🟢 1.06x faster       | 🟢 1.50x faster   |
| `gears.glb`                       |     3 |  21,696 |   4.40 ms |   4.30 ms |        6.00 ms | ⚪ even               | 🟢 1.36x faster   |
| `kira.glb`                        |    43 |  51,601 |  13.40 ms |  14.00 ms |       20.80 ms | ⚪ even               | 🟢 1.55x faster   |
| `minimalistic_modern_bedroom.glb` |     4 |  10,457 |   3.70 ms |   3.90 ms |        5.50 ms | 🟢 1.05x faster       | 🟢 1.49x faster   |
| `nemetona.glb`                    |     1 | 320,352 | 164.70 ms | 168.50 ms |      224.80 ms | ⚪ even               | 🟢 1.36x faster   |
| `pool.glb`                        |     2 |  22,280 |   4.90 ms |   4.70 ms |        7.10 ms | ⚪ even               | 🟢 1.45x faster   |
| `rolex.glb`                       |    24 | 120,336 |  41.90 ms |  43.40 ms |       71.90 ms | ⚪ even               | 🟢 1.72x faster   |
| `venice_mask.glb`                 |     5 | 295,600 |  90.90 ms |  93.90 ms |      136.00 ms | ⚪ even               | 🟢 1.50x faster   |
| `bunny.drc`                       |     1 |  69,451 |  12.20 ms |   5.80 ms |        6.80 ms | 🔴 2.10x slower       | 🔴 1.79x slower   |
| `car.drc`                         |     1 |   1,744 |   0.00 ms |   2.50 ms |        0.50 ms | 🟢 50.00x faster      | 🟢 10.00x faster  |
| `duck.drc`                        |     1 |   4,212 |   1.10 ms |   1.20 ms |        2.00 ms | 🟢 1.09x faster       | 🟢 1.82x faster   |

## Browser — GLTFLoader wall clock (V8)

Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder
comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js
decodes on the main thread — this measures what an app actually experiences, including
texture decode and scene-graph setup. Median of 5 runs after 1 warmup, GLBs only
(raw `.drc` files have no glTF container).

- Date: 2026-07-05
- Browser: Chrome/149.0.0.0 on Macintosh

| file                              | minidraco |  draco.js | draco3d (wasm) | minidraco vs draco.js | minidraco vs wasm |
| --------------------------------- | --------: | --------: | -------------: | --------------------- | ----------------- |
| `manablade-characters.glb`        |  11.40 ms |   9.90 ms |        7.50 ms | 🔴 1.15x slower       | 🔴 1.52x slower   |
| `manablade-static.glb`            |  56.60 ms |  93.60 ms |       51.30 ms | 🟢 1.65x faster       | 🔴 1.10x slower   |
| `IridescentDishWithOlives.glb`    |  63.00 ms |  72.20 ms |       58.80 ms | 🟢 1.15x faster       | 🔴 1.07x slower   |
| `LittlestTokyo.glb`               |  89.80 ms | 182.00 ms |       92.20 ms | 🟢 2.03x faster       | ⚪ even           |
| `ShaderBall2.glb`                 |  16.30 ms |  20.10 ms |       13.60 ms | 🟢 1.23x faster       | 🔴 1.20x slower   |
| `bath_day.glb`                    |  39.80 ms |  50.20 ms |       43.60 ms | 🟢 1.26x faster       | 🟢 1.10x faster   |
| `duck.glb`                        |   3.20 ms |   3.00 ms |        1.90 ms | 🔴 1.07x slower       | 🔴 1.68x slower   |
| `ferrari.glb`                     |  31.90 ms |  90.10 ms |       29.40 ms | 🟢 2.82x faster       | 🔴 1.09x slower   |
| `forest_house.glb`                |  27.30 ms |  27.30 ms |       24.50 ms | ⚪ even               | 🔴 1.11x slower   |
| `gears.glb`                       |   2.60 ms |   4.80 ms |        2.10 ms | 🟢 1.85x faster       | 🔴 1.24x slower   |
| `kira.glb`                        | 259.20 ms | 251.90 ms |      226.80 ms | ⚪ even               | 🔴 1.14x slower   |
| `minimalistic_modern_bedroom.glb` |  33.90 ms |  40.00 ms |       33.00 ms | 🟢 1.18x faster       | ⚪ even           |
| `nemetona.glb`                    | 172.30 ms | 201.80 ms |      145.80 ms | 🟢 1.17x faster       | 🔴 1.18x slower   |
| `pool.glb`                        |  49.10 ms |  48.40 ms |       42.70 ms | ⚪ even               | 🔴 1.15x slower   |
| `rolex.glb`                       |  23.50 ms |  64.60 ms |       23.20 ms | 🟢 2.75x faster       | ⚪ even           |
| `venice_mask.glb`                 |  73.70 ms | 166.30 ms |       77.30 ms | 🟢 2.26x faster       | ⚪ even           |

Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall
clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.
