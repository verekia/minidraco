// Correctness guard for perf work: decodes the whole local corpus and prints a
// digest of every decoded array. Run before and after a change — the output
// must be byte-identical.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'

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
  if (!path.endsWith('.glb')) return [new Uint8Array(readFileSync(path))]
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

const DT: Record<number, any> = { 1: Int8Array, 2: Uint8Array, 3: Int16Array, 4: Uint16Array, 5: Int32Array, 6: Uint32Array, 9: Float32Array }

const root = `${import.meta.dir}/../..`
const fixturesDir = `${root}/library/src/__tests__/fixtures`
const models = [
  `${root}/example/public/models/manablade-characters.glb`,
  `${root}/example/public/models/manablade-static.glb`,
  ...readdirSync(fixturesDir).toSorted().map(n => `${fixturesDir}/${n}`),
]

for (const model of models) {
  const name = model.split('/').pop()!
  const h = createHash('sha256')
  let prims = 0
  for (const data of extract(model)) {
    const mesh = decodeDracoMesh(data)
    const numPoints = mesh.numPoints()
    const numFaces = mesh.numFaces()
    h.update(`p${numPoints}f${numFaces}|`)
    h.update(new Uint8Array(mesh.faces_.buffer, mesh.faces_.byteOffset, numFaces * 3 * 4))
    for (const attribute of mesh.attributes_) {
      if (!attribute) continue
      const Ctor = DT[attribute.dataType]
      if (!Ctor) throw new Error(`unsupported dtype ${attribute.dataType}`)
      const values = attribute.extractTo(Ctor, numPoints)
      h.update(`a${attribute.uniqueId}t${attribute.dataType}c${attribute.numComponents}|`)
      h.update(new Uint8Array(values.buffer, values.byteOffset, values.byteLength))
    }
    prims++
  }
  console.log(`${name.padEnd(42)} prims=${String(prims).padStart(4)} ${h.digest('hex')}`)
}
