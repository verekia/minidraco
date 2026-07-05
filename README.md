# minidraco

A fast, pure-TypeScript [Draco](https://google.github.io/draco/) mesh decoder with a drop-in
`DRACOLoader` for [Three.js](https://threejs.org/) — no wasm to host or fetch, and a built-in
worker pool so decoding never blocks the main thread.

## Usage

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MiniDRACOLoader } from 'minidraco/three'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new MiniDRACOLoader())
gltfLoader.load('model.glb', gltf => scene.add(gltf.scene))
```

It's a drop-in for `THREE.DRACOLoader` — type-compatible on any three version, no cast. Decoding
runs in a worker pool by default, falling back to the main thread if workers can't be spawned
(SSR, exotic bundlers). CDN-hosted bundles (Next.js `assetPrefix`, etc.) work out of the box. A
couple of options:

```ts
new MiniDRACOLoader({ workers: false }) // decode on the main thread
new MiniDRACOLoader({ workerLimit: 8 }) // pool size (default 4)
```

Or decode a raw Draco bitstream without Three.js:

```ts
import { decodeDracoMesh } from 'minidraco'

const mesh = decodeDracoMesh(new Uint8Array(bytes))
```

## Features

- All Draco triangle meshes: edgebreaker + sequential encodings, every prediction scheme, and
  quantized / integer / octahedron-normal / custom attributes, skinning, colors, and UVs.
- Output is bit-identical to the official wasm decoder (≤ 1 ulp on floats), verified in the tests.
- Point clouds aren't supported (glTF Draco only ever contains meshes).

## Performance

Benchmarked against [draco.js](https://github.com/mrdoob/draco.js) (pure JS) and the official
[draco3d](https://www.npmjs.com/package/draco3d) wasm decoder across a 19-model corpus. Median
(Apple Silicon; full per-model results in
[BENCH.md](https://github.com/verekia/minidraco/blob/main/BENCH.md)):

| benchmark                                     | vs draco.js     | vs draco3d wasm |
| --------------------------------------------- | --------------- | --------------- |
| single-threaded decode — bun (JSC)            | ⚪ even         | 🟢 1.13× faster |
| single-threaded decode — Chrome (V8)          | ⚪ even         | 🟢 1.50× faster |
| `GLTFLoader.parse`, worker pool — Chrome (V8) | 🟢 1.23× faster | 🔴 1.10× slower |

Roughly on par with draco.js and ahead of the wasm decoder single-threaded. In a real
`GLTFLoader.parse` the worker pool beats main-thread draco.js and runs close to the wasm pool,
with the main thread left free.

🟢 **The real win is cold start, which warm medians can't show.** The wasm decoder has to fetch
and compile `draco_decoder.wasm` (~50–70 ms) before the first mesh decodes; minidraco has nothing
to fetch, and its workers warm up at spawn — so the first model on screen appears much sooner.

## Download size

Over the wire (brotli): **minidraco ~45 KB** (or ~23 KB with `workers: false`),
**draco.js ~22 KB**, **draco3d wasm ~76 KB** — and the wasm is a separate fetch you must host on
the first decode's critical path, while the JS decoders ship inside your existing bundle.

## Monorepo

- `library/` — the `minidraco` package
- `example/` — Next.js + React Three Fiber demo with an in-browser benchmark at `/bench`

```sh
bun install
bun dev        # watch build + demo
bun run all    # format, lint, typecheck, tests
bun run bench  # cross-decoder benchmark
```

## License

MIT — derived from [mrdoob/draco.js](https://github.com/mrdoob/draco.js) (MIT), implementing
Google's [Draco](https://github.com/google/draco) bitstream (Apache-2.0).
