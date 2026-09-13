import { defineConfig } from 'tsup'

// Properties named with a leading underscore are internal by convention and
// get mangled in the dist output (about 5% off the brotli size). The only
// underscore members meant for subclasses — `_decodeBuffer` / `_buildGeometry`,
// the synchronous decode hooks a custom loader may override — keep their names.
// The .d.ts files still describe the unmangled internals; treat everything
// else with an underscore as private.
const mangleInternals = options => {
  options.mangleProps = /^_/
  options.reserveProps = /^_(decodeBuffer|buildGeometry)$/
}

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
    esbuildOptions: mangleInternals,
  },
  {
    // `minidraco/three` — the DRACOLoader drop-in built on top of the core —
    // and its worker pool, a separate chunk that three.js imports on first
    // use (splitting keeps the `import('./pool.js')` a real dynamic import;
    // the two share no runtime modules, so no other chunks appear). Only
    // three gets a d.ts: the pool's types are inlined into it.
    entry: { three: 'src/three/index.ts', pool: 'src/three/pool.ts' },
    format: ['esm'],
    dts: { entry: { three: 'src/three/index.ts' } },
    splitting: true,
    esbuildOptions: mangleInternals,
  },
])
