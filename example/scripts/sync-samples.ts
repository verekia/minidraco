// Copies the draco.js sample models from the installed dependency into
// public/models/samples so the /bench raw-decode benchmark can fetch them in
// local dev. The directory is gitignored and dockerignored — deployments never
// ship the ~35 MB of sample models; the bench page degrades to the bundles.
//
// Runs automatically before `bun dev` (see the example package.json).
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const samplesDir = fileURLToPath(new URL('samples/', import.meta.resolve('draco.js/package.json')))
const outDir = fileURLToPath(new URL('../public/models/samples/', import.meta.url))

mkdirSync(outDir, { recursive: true })

const files = [
  ...readdirSync(samplesDir)
    .filter(name => name.endsWith('.glb'))
    .toSorted(),
  // Standalone Draco bitstreams (the tiny cube/test .drc files are test
  // fixtures, not benchmark models)
  'bunny.drc',
  'car.drc',
  'duck.drc',
]

for (const file of files) copyFileSync(samplesDir + file, outDir + file)
writeFileSync(`${outDir}manifest.json`, `${JSON.stringify(files, null, 2)}\n`)

console.log(`Synced ${files.length} draco.js sample models to example/public/models/samples`)
