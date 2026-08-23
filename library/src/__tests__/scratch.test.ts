// The decoder borrows most of its per-primitive working memory from a pooled,
// decode-scoped arena (see core/ScratchArena) that is recycled as soon as a
// decode returns. Nothing a decode hands back may point into that memory, so
// this suite decodes the whole local corpus keeping every Mesh alive, churns
// the pool with further decodes, and only then reads the results back — a
// buffer that escaped the decode would come back corrupted.
//
// Self-contained on purpose: this compares minidraco against itself, so unlike
// the fidelity suites it needs neither reference decoder, and it keeps working
// (and keeps guarding the arena) when only the bundle GLBs are at hand.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

import { decodeDracoMesh } from '../index'

import type { Mesh } from '../index'

const parseGlb = (bytes: Uint8Array): { json: GltfJson; bin: Uint8Array } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  let json: GltfJson | null = null
  let bin: Uint8Array | null = null
  while (offset < bytes.byteLength) {
    const chunkLength = view.getUint32(offset, true)
    const chunkType = view.getUint32(offset + 4, true)
    const chunk = bytes.subarray(offset + 8, offset + 8 + chunkLength)
    if (chunkType === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk))
    else if (chunkType === 0x004e4942) bin = chunk
    offset += 8 + chunkLength
  }
  if (!json || !bin) throw new Error('GLB is missing a JSON or BIN chunk')
  return { json, bin }
}

interface GltfJson {
  meshes?: {
    primitives: { extensions?: { KHR_draco_mesh_compression?: { bufferView: number } } }[]
  }[]
  bufferViews?: { byteOffset?: number; byteLength: number }[]
}

const bitstreams = (path: string): Uint8Array[] => {
  if (!path.endsWith('.glb')) return [new Uint8Array(readFileSync(path))]
  const { json, bin } = parseGlb(new Uint8Array(readFileSync(path)))
  const out: Uint8Array[] = []
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (!draco) continue
      const bufferView = json.bufferViews![draco.bufferView]
      const start = bufferView.byteOffset ?? 0
      out.push(bin.slice(start, start + bufferView.byteLength))
    }
  }
  return out
}

const dracoDataTypeToArray = (dataType: number) => {
  switch (dataType) {
    case 1:
      return Int8Array
    case 2:
      return Uint8Array
    case 3:
      return Int16Array
    case 4:
      return Uint16Array
    case 5:
      return Int32Array
    case 6:
      return Uint32Array
    case 9:
      return Float32Array
    default:
      throw new Error(`Unsupported Draco data type ${dataType}`)
  }
}

// Everything a caller can read back out of a decoded mesh, flattened.
const snapshot = (mesh: Mesh): number[] => {
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()
  const values: number[] = [numPoints, numFaces]
  for (let i = 0; i < numFaces * 3; i++) values.push(mesh.faces_[i])
  for (const attribute of mesh.attributes_) {
    if (!attribute) continue
    values.push(attribute.uniqueId, attribute.dataType, attribute.numComponents)
    const data = attribute.extractTo(dracoDataTypeToArray(attribute.dataType), numPoints)
    for (let i = 0; i < data.length; i++) values.push(data[i])
  }
  return values
}

const fixturesDir = `${import.meta.dir}/fixtures`
const corpus = [
  `${import.meta.dir}/../../../example/public/models/manablade-characters.glb`,
  `${import.meta.dir}/../../../example/public/models/manablade-static.glb`,
  ...readdirSync(fixturesDir)
    .filter(name => name.endsWith('.drc'))
    .toSorted()
    .map(name => `${fixturesDir}/${name}`),
].flatMap(bitstreams)

describe('decode results outlive the scratch arena', () => {
  test('every retained mesh is unchanged after further decodes recycle the pool', () => {
    expect(corpus.length).toBeGreaterThan(100)

    // Baseline: read each mesh back before anything else can recycle the pool.
    const expected = corpus.map(data => snapshot(decodeDracoMesh(data)))

    // Now hold every mesh at once, and keep decoding so the pool hands the same
    // buffers out again and again.
    const retained = corpus.map(data => decodeDracoMesh(data))
    for (let round = 0; round < 2; round++) for (const data of corpus) decodeDracoMesh(data)

    retained.forEach((mesh, index) => {
      expect({ index, values: snapshot(mesh) }).toEqual({ index, values: expected[index] })
    })
  })
})
