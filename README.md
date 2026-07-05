# minidraco

A fast, pure-TypeScript [Draco](https://google.github.io/draco/) mesh decoder with a drop-in
`DRACOLoader` for [Three.js](https://threejs.org/) — no wasm to host or fetch, and a worker pool
so decoding never blocks the main thread.

## Usage

```ts
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MiniDRACOLoader } from 'minidraco/three'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new MiniDRACOLoader())
gltfLoader.load('model.glb', gltf => scene.add(gltf.scene))
```

A drop-in for `THREE.DRACOLoader`, no cast needed. Decoding runs in a worker pool by default, with
a main-thread fallback. Options:

```ts
new MiniDRACOLoader({ workers: false }) // decode on the main thread
new MiniDRACOLoader({ workerLimit: 8 }) // pool size (default 4)
```

If you _only_ ever decode on the main thread, import from `minidraco/three/single` instead — same
API, but with no worker code so the bundler never emits the worker chunk.

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

Median across a 19-model corpus vs [draco.js](https://github.com/mrdoob/draco.js) and the official
[draco3d](https://www.npmjs.com/package/draco3d) wasm decoder (full results in
[BENCH.md](https://github.com/verekia/minidraco/blob/main/BENCH.md)):

| benchmark                                     | vs draco.js     | vs draco3d wasm |
| --------------------------------------------- | --------------- | --------------- |
| single-threaded decode — bun (JSC)            | ⚪ even         | 🟢 1.13× faster |
| single-threaded decode — Chrome (V8)          | ⚪ even         | 🟢 1.50× faster |
| `GLTFLoader.parse`, worker pool — Chrome (V8) | 🟢 1.23× faster | 🔴 1.10× slower |

On par with draco.js, faster than the wasm decoder single-threaded, and competitive in a real
`GLTFLoader.parse` with the main thread left free. And with no wasm to fetch and compile, the
first load is faster than any warm benchmark shows.

## Download size

Over the wire (brotli): **minidraco ~45 KB**, **draco.js ~22 KB**, **draco3d wasm ~76 KB** — and
the wasm is a separate fetch you must host, while the JS decoders ship in your bundle.

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
