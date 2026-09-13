// Download-size comparison: what each decoder adds to an app bundle and what it
// fetches on the first decode, minified + brotli. Prints the README table.
//
//   bun run build && bun scripts/sizes.ts     (or `bun run sizes` at the root)
//
// minidraco is measured from dist (the build mangles internal property names,
// so src would overstate it): `minidraco/three` alone, and with the pool chunk
// and worker chunk `workers: true` fetches on the first decode. draco.js: its
// DRACOLoader with the decoder bundled in. draco3d wasm: three's DRACOLoader in
// the bundle, then the wrapper and the wasm module from
// three/examples/jsm/libs/draco.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { brotliCompressSync, constants } from 'node:zlib'

const libraryRoot = resolve(import.meta.dir, '..')
const nodeModules = resolve(libraryRoot, 'node_modules')
const dist = resolve(libraryRoot, 'dist')

if (!existsSync(resolve(dist, 'pool.js'))) {
  console.error('dist/ is missing or stale: run `bun run build` in library/ first.')
  process.exit(1)
}

const brotli = (bytes: Uint8Array): number =>
  brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length

// Minified + brotli size of one module bundled on its own (three external;
// the module's own dynamic imports stay separate).
const bundle = async (entry: string): Promise<number> => {
  const result = await Bun.build({
    entrypoints: [entry],
    minify: true,
    target: 'browser',
    format: 'esm',
    splitting: true,
    outdir: resolve(libraryRoot, 'node_modules/.sizes'),
    external: ['three'],
  })
  if (!result.success) throw new Error(`bundle failed for ${entry}: ${result.logs.join('\n')}`)
  const output = result.outputs.find(o => o.kind === 'entry-point')!
  return brotli(new Uint8Array(await output.arrayBuffer()))
}

const file = async (path: string): Promise<number> => brotli(new Uint8Array(await Bun.file(path).arrayBuffer()))

const dracoLibs = resolve(nodeModules, 'three/examples/jsm/libs/draco')

const minidracoThree = await bundle(resolve(dist, 'three.js'))
const minidracoPool = await bundle(resolve(dist, 'pool.js'))
const minidracoWorker = await bundle(resolve(dist, 'worker.js'))
const dracoJs = await bundle(resolve(nodeModules, 'draco.js/src/DRACOLoader.js'))
const threeLoader = await bundle(resolve(nodeModules, 'three/examples/jsm/loaders/DRACOLoader.js'))
const wasmWrapper = await bundle(resolve(dracoLibs, 'draco_wasm_wrapper.js'))
const wasmModule = await file(resolve(dracoLibs, 'draco_decoder.wasm'))

const kb = (bytes: number): string => `${Math.round(bytes / 1000)} KB`

// Verdict on minidraco's size against another decoder's, in the style of the
// benchmark table; within 3% is called even. `shown` overrides the label when
// the other side is a sum of separately rounded downloads.
const versus = (mini: number, other: number, shown: string = kb(other)): string => {
  const ratio = other / mini
  if (ratio >= 1.03) return `🟢 ${ratio.toFixed(1)}× smaller (${shown})`
  if (ratio <= 1 / 1.03) return `🔴 ${(1 / ratio).toFixed(1)}× larger (${shown})`
  return `⚪ even (${shown})`
}

// The wasm path downloads three's DRACOLoader in the bundle plus the wrapper
// and module on the first decode; shown as the sum of those rounded parts.
const wasmTotal = threeLoader + wasmWrapper + wasmModule
const wasmShown = `${Math.round(threeLoader / 1000) + Math.round((wasmWrapper + wasmModule) / 1000)} KB`
const pooled = minidracoThree + minidracoPool + minidracoWorker

// draco.js has no worker pool, so that row carries a note instead of a ratio.
const rows: [string, number, string, string][] = [
  [
    'single-threaded (default)',
    minidracoThree,
    versus(minidracoThree, dracoJs),
    versus(minidracoThree, wasmTotal, wasmShown),
  ],
  ['worker pool (`workers: true`)', pooled, '🟢 not supported', versus(pooled, wasmTotal, wasmShown)],
]

const lines = [
  '| download (brotli) | minidraco | vs draco.js | vs draco3d wasm |',
  '| --- | --- | --- | --- |',
  ...rows.map(([label, mini, jsCell, wasmCell]) => `| ${label} | ${kb(mini)} | ${jsCell} | ${wasmCell} |`),
]

console.log(lines.join('\n'))
console.log()
console.log(
  [
    `minidraco/three ${minidracoThree} B, pool ${minidracoPool} B, worker ${minidracoWorker} B`,
    `draco.js DRACOLoader ${dracoJs} B`,
    `three DRACOLoader ${threeLoader} B, draco_wasm_wrapper.js ${wasmWrapper} B, draco_decoder.wasm ${wasmModule} B`,
  ].join('\n'),
)
