import { defineConfig } from 'tsup'

// JS and d.ts build separately. JS uses shared chunks so the Three loader shell
// can stay separate from the decoder core; d.ts stays per-entry because tsup's
// declaration bundler otherwise hoists shared public types into hashed files.
export default defineConfig([
  {
    entry: { index: 'src/index.ts', three: 'src/three/index.ts', 'three/vite': 'src/three/vite.ts' },
    clean: true,
    format: ['esm'],
    dts: false,
    splitting: true,
    external: ['three'],
  },
  {
    // Default worker remains self-contained for bundlers that emit worker URLs
    // as static assets and do not deploy sibling chunks with those assets.
    entry: { worker: 'src/worker.ts' },
    format: ['esm'],
    dts: false,
    splitting: false,
  },
  {
    // Vite owns worker graphs, so this worker can import the shared decoder
    // entry instead of embedding a second copy of it.
    entry: { 'worker-vite': 'src/worker.ts' },
    format: ['esm'],
    dts: false,
    splitting: false,
    external: ['./index', './index.js'],
  },
  {
    entry: { index: 'src/index.ts', worker: 'src/worker.ts' },
    format: ['esm'],
    dts: { only: true },
    splitting: false,
  },
  {
    entry: { three: 'src/three/index.ts' },
    format: ['esm'],
    dts: { only: true },
    splitting: false,
    external: ['three'],
  },
  {
    entry: { 'three/vite': 'src/three/vite.ts' },
    format: ['esm'],
    dts: { only: true },
    splitting: false,
    external: ['three'],
  },
])
