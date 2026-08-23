// Local dev benchmark that does not depend on the draco.js github dependency.
// Uses the two bundle GLBs plus the checked-in .drc fixtures.
import { readFileSync } from 'node:fs'

import { decodeDracoMesh } from '../src/index'

const parseGlb = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  let json: any = null
  let bin: Uint8Array | null = null
  while (offset < bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunk = bytes.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk))
    else if (chunkType === 0x004e4942) bin = chunk
    offset += 8 + chunkLength
  }
  return { json, bin: bin! }
}

const extract = (path: string): Uint8Array[] => {
  if (path.endsWith('.drc')) return [new Uint8Array(readFileSync(path))]
  const { json, bin } = parseGlb(new Uint8Array(readFileSync(path)))
  const out: Uint8Array[] = []
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (!draco) continue
      const bv = json.bufferViews[draco.bufferView]
      const start = bv.byteOffset ?? 0
      out.push(bin.slice(start, start + bv.byteLength))
    }
  }
  return out
}

const root = `${import.meta.dir}/../..`
const models = [
  `${root}/example/public/models/manablade-characters.glb`,
  `${root}/example/public/models/manablade-static.glb`,
  `${root}/library/src/__tests__/fixtures/bunny.drc`,
  `${root}/library/src/__tests__/fixtures/car.drc`,
]

// Touch decoded output so nothing gets optimized away.
const decodeAll = (prims: Uint8Array[]) => {
  let sink = 0
  for (const p of prims) {
    const mesh = decodeDracoMesh(p)
    sink += mesh.numFaces() + mesh.numPoints()
  }
  return sink
}

const RUNS = Number(process.env.RUNS ?? 30)
for (const model of models) {
  const name = model.split('/').pop()!
  const prims = extract(model)
  for (let i = 0; i < 5; i++) decodeAll(prims)
  const times: number[] = []
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now()
    decodeAll(prims)
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  const q = (f: number) => times[Math.min(times.length - 1, Math.floor(times.length * f))]
  console.log(`${name.padEnd(28)} min: ${times[0].toFixed(3)}  p25: ${q(0.25).toFixed(3)}  median: ${q(0.5).toFixed(3)}`)
}
