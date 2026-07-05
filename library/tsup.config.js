import { defineConfig } from 'tsup'

// Two separate builds instead of one multi-entry build: when entries share
// modules (the decoder core), tsup's dts bundler hoists the shared types into
// a content-hashed chunk (Mesh-<hash>.d.ts). Building `three` on its own makes
// each d.ts self-contained — the types are duplicated structurally, which TS
// treats as identical.
export default defineConfig([
  {
    // `minidraco` (pure decoder, no `three` import) and the self-contained
    // module worker spawned by MiniDRACOLoader's pool.
    entry: { index: 'src/index.ts', worker: 'src/worker.ts' },
    clean: true,
    format: ['esm'],
    dts: true,
    splitting: false,
  },
  {
    // `minidraco/three` — the DRACOLoader drop-in built on top of the core.
    entry: { three: 'src/three/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
  },
])
