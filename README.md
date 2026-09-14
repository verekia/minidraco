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

A drop-in for `THREE.DRACOLoader`. Decoding runs on the main thread by default. Opt into a worker pool if you prefer to keep it free:

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

Median across 18 models vs [draco.js](https://github.com/mrdoob/draco.js) and the official
[draco3d](https://www.npmjs.com/package/draco3d) wasm decoder (full results in
[BENCH.md](https://github.com/verekia/minidraco/blob/main/BENCH.md)):

| benchmark                                          | vs draco.js     | vs draco3d wasm |
| -------------------------------------------------- | --------------- | --------------- |
| single-threaded decode — bun (JSC)                 | 🟢 1.53× faster | 🟢 1.53× faster |
| single-threaded decode — Chrome (V8)               | 🟢 1.44× faster | 🟢 1.27× faster |
| `GLTFLoader.parse`, warm worker pool — Chrome (V8) | 🟢 1.47× faster | 🟢 1.03× faster |
| `GLTFLoader.parse`, cold first load — Chrome (V8)  | 🟢 1.42× faster | 🟢 1.26× faster |

## Download size

| download (brotli)             | minidraco | vs draco.js              | vs draco3d wasm          |
| ----------------------------- | --------- | ------------------------ | ------------------------ |
| single-threaded (default)     | 21 KB     | 🟢 1.04× smaller (22 KB) | 🟢 3.82× smaller (81 KB) |
| worker pool (`workers: true`) | 44 KB     | 🟢 not supported         | 🟢 1.84× smaller (81 KB) |

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

MIT — initially derived from [mrdoob/draco.js](https://github.com/mrdoob/draco.js) (MIT), implementing
Google's [Draco](https://github.com/google/draco) bitstream (Apache-2.0).
