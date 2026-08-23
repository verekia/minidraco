// Correctness check against the official draco3d wasm decoder, without the
// draco.js dev dependency: same comparison the fidelity/drc suites make
// (identical connectivity + integer attributes, floats within 1 ulp) over the
// bundle GLBs and every checked-in .drc fixture.
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

const DT: Record<number, any> = {
  1: Int8Array,
  2: Uint8Array,
  3: Int16Array,
  4: Uint16Array,
  5: Int32Array,
  6: Uint32Array,
  9: Float32Array,
}
const heapOf = (m: any, dataType: number, ptr: number, n: number) => {
  switch (dataType) {
    case 1:
      return new Int8Array(m.HEAP8.buffer, ptr, n)
    case 2:
      return new Uint8Array(m.HEAPU8.buffer, ptr, n)
    case 3:
      return new Int16Array(m.HEAP16.buffer, ptr, n)
    case 4:
      return new Uint16Array(m.HEAPU16.buffer, ptr, n)
    case 5:
      return new Int32Array(m.HEAP32.buffer, ptr, n)
    case 6:
      return new Uint32Array(m.HEAPU32.buffer, ptr, n)
    case 9:
      return new Float32Array(m.HEAPF32.buffer, ptr, n)
    default:
      throw new Error(`unsupported data type ${dataType}`)
  }
}

const ulpDiff = (a: number, b: number): number => {
  if (a === b) return 0
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  const x = new Int32Array(new Float32Array([a]).buffer)[0]
  const y = new Int32Array(new Float32Array([b]).buffer)[0]
  return Math.abs(x - y)
}

const draco3d = (await import('draco3d')).default
const m = await draco3d.createDecoderModule({})

const decodeReference = (data: Uint8Array) => {
  const buffer = new m.DecoderBuffer()
  buffer.Init(data, data.length)
  const decoder = new m.Decoder()
  const mesh = new m.Mesh()
  const status = decoder.DecodeBufferToMesh(buffer, mesh)
  if (!status.ok()) {
    m.destroy(mesh)
    m.destroy(decoder)
    m.destroy(buffer)
    throw new Error(status.error_msg())
  }
  const numPoints = mesh.num_points()
  const numFaces = mesh.num_faces()
  const indices = new Uint32Array(numFaces * 3)
  const indexPtr = m._malloc(indices.byteLength)
  decoder.GetTrianglesUInt32Array(mesh, indices.byteLength, indexPtr)
  indices.set(new Uint32Array(m.HEAPU32.buffer, indexPtr, numFaces * 3))
  m._free(indexPtr)

  const attributes = new Map<number, { data: ArrayLike<number>; numComponents: number; dataType: number }>()
  for (let i = 0; i < mesh.num_attributes(); i++) {
    const attribute = decoder.GetAttribute(mesh, i)
    const dataType = attribute.data_type()
    const numComponents = attribute.num_components()
    const numValues = numPoints * numComponents
    const array = new DT[dataType](numValues)
    const ptr = m._malloc(array.byteLength)
    decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataType, array.byteLength, ptr)
    array.set(heapOf(m, dataType, ptr, numValues))
    m._free(ptr)
    attributes.set(attribute.unique_id(), { data: array, numComponents, dataType })
  }
  m.destroy(mesh)
  m.destroy(decoder)
  m.destroy(buffer)
  return { numPoints, indices, attributes }
}

const root = `${import.meta.dir}/../..`
const fixturesDir = `${root}/library/src/__tests__/fixtures`
const models = [
  `${root}/example/public/models/manablade-characters.glb`,
  `${root}/example/public/models/manablade-static.glb`,
  ...readdirSync(fixturesDir).toSorted().map(n => `${fixturesDir}/${n}`),
]

let failures = 0
let checkedPrims = 0
let checkedValues = 0

for (const model of models) {
  const name = model.split('/').pop()!
  let modelFailures = 0
  extract(model).forEach((data, index) => {
    const expected = decodeReference(data)
    const mesh = decodeDracoMesh(data)
    const label = `${name}#${index}`
    const fail = (message: string) => {
      if (modelFailures++ < 3) console.error(`FAIL ${label}: ${message}`)
      failures++
    }

    if (mesh.numPoints() !== expected.numPoints) fail(`numPoints ${mesh.numPoints()} != ${expected.numPoints}`)
    if (mesh.numFaces() * 3 !== expected.indices.length) {
      fail(`indices ${mesh.numFaces() * 3} != ${expected.indices.length}`)
      return
    }
    for (let i = 0; i < expected.indices.length; i++) {
      if (mesh.faces_[i] !== expected.indices[i]) {
        fail(`index[${i}] ${mesh.faces_[i]} != ${expected.indices[i]}`)
        break
      }
    }
    for (const [uniqueId, ref] of expected.attributes) {
      const attribute = mesh.getAttributeByUniqueId(uniqueId)
      if (!attribute) {
        fail(`missing attribute ${uniqueId}`)
        continue
      }
      if (attribute.numComponents !== ref.numComponents) {
        fail(`attribute ${uniqueId} numComponents ${attribute.numComponents} != ${ref.numComponents}`)
        continue
      }
      const actual = attribute.extractTo(DT[attribute.dataType], expected.numPoints)
      if (actual.length !== ref.data.length) {
        fail(`attribute ${uniqueId} length ${actual.length} != ${ref.data.length}`)
        continue
      }
      const isFloat = ref.dataType === 9
      for (let i = 0; i < actual.length; i++) {
        const ok = isFloat ? ulpDiff(actual[i], ref.data[i]) <= 1 : actual[i] === ref.data[i]
        if (!ok) {
          fail(`attribute ${uniqueId} value[${i}] ${actual[i]} != ${ref.data[i]}`)
          break
        }
      }
      checkedValues += actual.length
    }
    checkedPrims++
  })
  console.log(`${modelFailures === 0 ? 'ok  ' : 'FAIL'} ${name}`)
}

console.log(`\n${checkedPrims} primitives, ${checkedValues.toLocaleString()} attribute values checked vs draco3d wasm`)
if (failures > 0) {
  console.error(`${failures} mismatches`)
  process.exit(1)
}
console.log('all match')
