# minidraco

A fast, pure-TypeScript [Draco](https://google.github.io/draco/) mesh decoder with a drop-in
`DRACOLoader` replacement for [Three.js](https://threejs.org/) — no wasm files to host, no
external decoder to fetch and compile, and a built-in worker pool so decoding never blocks the
main thread.

minidraco started as a TypeScript port of [mrdoob/draco.js](https://github.com/mrdoob/draco.js)
(MIT), then restructured and optimized (rANS table pooling, seam-list corner tables, allocation
elimination in the entropy decoders, specialized attribute extraction) to close the gap with the
official [draco3d](https://www.npmjs.com/package/draco3d) wasm decoder.

## Usage

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MiniDRACOLoader } from 'minidraco/three'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new MiniDRACOLoader())
gltfLoader.load('model.glb', gltf => scene.add(gltf.scene))
```

`MiniDRACOLoader` is API-compatible with `THREE.DRACOLoader` (`setDecoderPath` and friends are
no-ops). Decoding runs in a pool of module workers (default 4, `setWorkerLimit(n)` to change,
`0` to force synchronous main-thread decoding). If workers can't be spawned (SSR, exotic
bundlers), it falls back to synchronous decoding automatically.

**Serving JS from a CDN origin** (Next.js `assetPrefix`, etc.) works out of the box: browsers
refuse to construct a Worker from a cross-origin script, so minidraco bootstraps the worker
through a same-origin blob module that imports the hashed CDN asset (a CORS request — your CDN
must send `Access-Control-Allow-Origin`, which it already does if you load models or fonts from
it). If even that fails, decoding falls back to the main thread rather than erroring.
`setWorkerUrl(url)` exists as a manual override for exotic setups.

Or decode a raw Draco bitstream without Three.js:

```ts
import { decodeDracoMesh } from 'minidraco'

const mesh = decodeDracoMesh(new Uint8Array(bytes))
```

## Feature support

- Triangular meshes: edgebreaker (standard + valence) and sequential encodings, all bitstream
  prediction schemes (delta, parallelogram, multi-parallelogram, constrained multi-parallelogram,
  portable tex-coords, geometric octahedron normals)
- Quantized, integer, and octahedron-normal attributes
- Custom / generic attributes (glTF `_*` semantics), skinning attributes (`JOINTS_0` /
  `WEIGHTS_0`), vertex colors, multiple UV sets
- Output is verified bit-identical to the official wasm decoder (≤ 1 ulp on dequantized floats)
  in the test suite, on both real production GLBs and Draco's own test corpus
- Point clouds are not supported (glTF `KHR_draco_mesh_compression` only ever contains meshes)

## Performance

Decoding the three production bundle GLBs in `example/public/models` (Apple Silicon, medians;
`bun run bench` for the harness). Raw single-threaded decode, bun/JSC:

| file (points / faces)                | minidraco | draco.js | draco3d wasm |
| ------------------------------------ | --------- | -------- | ------------ |
| canine (1.1k / 0.5k)                 | 0.6 ms    | 0.6 ms   | 0.4 ms       |
| player (5.1k / 2.5k)                 | 1.9 ms    | 1.7 ms   | 1.2 ms       |
| static (291k / 221k, 488 primitives) | **50 ms** | 55 ms    | 51 ms        |

In the browser the worker pool changes the story for real scenes — wall-clock
`GLTFLoader.parse` of the 488-primitive static bundle (Chromium, warm loaders, `/bench` page of
the example):

| decoder                  | static bundle | main thread |
| ------------------------ | ------------- | ----------- |
| minidraco (4 workers)    | ~51 ms        | free        |
| draco.js (main thread)   | ~72 ms        | blocked     |
| draco3d wasm (4 workers) | ~23 ms        | free        |

And unlike the wasm decoder there is nothing to host or fetch: the first decode doesn't pay the
~50–70 ms wasm download + compile + worker bootstrap, which typically makes minidraco the fastest
option for the first model on screen.

## Download size

What the browser actually downloads per decoder (minified with esbuild, `three` external since
it's shared; gzip -9 / brotli -q 11):

| payload                                               | plain  | gzip    | brotli  |
| ----------------------------------------------------- | ------ | ------- | ------- |
| minidraco — `minidraco/three` in the app bundle       | 102 KB | 26.6 KB | 23.1 KB |
| minidraco — `worker.js` chunk (fetched on 1st decode) | 99 KB  | 25.5 KB | 22.1 KB |
| draco.js — loader + decoder in the app bundle         | 96 KB  | 24.8 KB | 21.5 KB |
| draco3d — `draco_wasm_wrapper.js` (runtime fetch)     | 78 KB  | 13.1 KB | 11.0 KB |
| draco3d — `draco_decoder.wasm` (runtime fetch)        | 279 KB | 86.1 KB | 64.6 KB |

Totals over the wire (brotli): **minidraco ~45 KB** (23 KB in the app bundle + 22 KB worker
chunk, or just 23 KB with `setWorkerLimit(0)`), **draco.js ~22 KB**, **draco3d wasm ~76 KB** —
and the wasm files are separate runtime fetches you must host, on the critical path of the first
decode, while the JS decoders ship inside your existing bundle chunks.

## Monorepo

- `library/` — the `minidraco` package
- `example/` — Next.js + React Three Fiber demo (model/decoder switcher, per-mesh filter,
  animation playback, in-browser benchmark at `/bench`)

```sh
bun install
bun dev        # library watch build + example dev server
bun run all    # format check, lint, typecheck, warden, tests
bun run bench  # decoder comparison benchmark (bun)
```

The test suite decodes every Draco primitive of the bundle GLBs with minidraco and the official
draco3d wasm decoder and compares indices and every attribute value, plus 13 raw `.drc` fixtures
from Draco's test corpus covering the encodings the bundles don't hit.

## License

MIT — includes code derived from [mrdoob/draco.js](https://github.com/mrdoob/draco.js) (MIT),
implementing Google's [Draco](https://github.com/google/draco) bitstream (Apache-2.0).
