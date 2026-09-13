# 🐲 minidraco

A fast, pure-TypeScript [Draco](https://google.github.io/draco/) mesh decoder with a drop-in
`DRACOLoader` for [Three.js](https://threejs.org/) — no wasm to host or fetch, and an optional
worker pool so decoding never blocks the main thread.

## Usage

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MinidracoLoader } from 'minidraco/three'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new MinidracoLoader())
gltfLoader.load('model.glb', gltf => scene.add(gltf.scene))
```

A drop-in for `THREE.DRACOLoader`, no cast needed. Decoding runs on the main thread by default;
opt into a worker pool (with a main-thread fallback) to keep it free:

```ts
new MinidracoLoader({ workers: true }) // decode in a pool of 4 workers
new MinidracoLoader({ workerLimit: 8 }) // pool of 8
```

Or decode a raw bitstream without Three.js:

```ts
import { decodeDracoMesh } from 'minidraco'

const mesh = decodeDracoMesh(new Uint8Array(bytes))
```

## Features

- Every Draco triangle mesh — all encodings, prediction schemes, and attribute types.
- Bit-identical to the official wasm decoder, verified in the tests.
- No point clouds (glTF Draco is always meshes).

## Performance

Median across an 18-model corpus vs [draco.js](https://github.com/mrdoob/draco.js) and the official
[draco3d](https://www.npmjs.com/package/draco3d) wasm decoder (full results in
[BENCH.md](https://github.com/verekia/minidraco/blob/main/BENCH.md)):

| benchmark                                          | vs draco.js     | vs draco3d wasm |
| -------------------------------------------------- | --------------- | --------------- |
| single-threaded decode — bun (JSC)                 | 🟢 1.37× faster | 🟢 1.49× faster |
| single-threaded decode — Chrome (V8)               | 🟢 1.41× faster | 🟢 1.26× faster |
| `GLTFLoader.parse`, warm worker pool — Chrome (V8) | 🟢 1.45× faster | 🟢 1.03× faster |
| `GLTFLoader.parse`, cold first load — Chrome (V8)  | 🟢 1.37× faster | 🟢 1.23× faster |

Faster than draco.js across the corpus, ahead of the wasm decoder single-threaded, and level with
it in a real `GLTFLoader.parse` with `workers: true` and the main thread left free — warm, and
level to ahead on the first load of a session (cold numbers swing run to run), where minidraco's
worker pool is still JIT-warming while the wasm decoder is fetching and compiling its module (no
`draco_decoder.wasm` to host or download here).

## Download size

Minified + brotli, vs the same two decoders (regenerate with `bun run sizes`):

| download (brotli)             | minidraco | vs draco.js      | vs draco3d wasm         |
| ----------------------------- | --------- | ---------------- | ----------------------- |
| single-threaded (default)     | 22 KB     | ⚪ even (22 KB)  | 🟢 3.7× smaller (81 KB) |
| worker pool (`workers: true`) | 45 KB     | 🟢 not supported | 🟢 1.8× smaller (81 KB) |

With `workers: true` the browser also fetches the pool module and a worker chunk holding a second
copy of the decoder on the first decode. draco.js has no worker pool. The wasm path ships three's
`DRACOLoader` in your bundle and fetches the wrapper and `draco_decoder.wasm`, which you must
host, before the first decode.

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
