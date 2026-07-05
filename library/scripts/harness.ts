// Shared harness for the fidelity tests and the benchmark: extracts the raw
// Draco bitstreams from KHR_draco_mesh_compression GLBs and decodes them with
// each of the three decoders under comparison (minidraco, draco.js, draco3d
// wasm), normalizing the results to plain typed arrays so they can be diffed.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { decodeDracoMesh } from '../src/index'

export interface DracoPrimitive {
  file: string
  meshName: string
  meshIndex: number
  primitiveIndex: number
  data: Uint8Array
  // glTF attribute semantic (e.g. POSITION, _MATERIALINDEX) → Draco unique attribute id
  attributes: Record<string, number>
}

export interface DecodedPrimitive {
  numPoints: number
  indices: Uint32Array
  // Draco unique attribute id → raw decoded values (numPoints * numComponents)
  attributes: Map<
    number,
    {
      data: Float32Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array
      numComponents: number
    }
  >
}

interface GltfJson {
  meshes?: { name?: string; primitives: GltfPrimitive[] }[]
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number }[]
}

interface GltfPrimitive {
  attributes: Record<string, number>
  extensions?: { KHR_draco_mesh_compression?: { bufferView: number; attributes: Record<string, number> } }
}

export const parseGlb = (bytes: Uint8Array): { json: GltfJson; bin: Uint8Array } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file')

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

export const extractDracoPrimitives = (glbPath: string): DracoPrimitive[] => {
  const { json, bin } = parseGlb(new Uint8Array(readFileSync(glbPath)))
  const primitives: DracoPrimitive[] = []

  json.meshes?.forEach((mesh, meshIndex) => {
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (!draco) return

      const bufferView = json.bufferViews![draco.bufferView]
      const start = bufferView.byteOffset ?? 0
      primitives.push({
        file: glbPath,
        meshName: mesh.name ?? `mesh_${meshIndex}`,
        meshIndex,
        primitiveIndex,
        // Copy so each primitive owns an aligned, independent buffer
        data: bin.slice(start, start + bufferView.byteLength),
        attributes: draco.attributes,
      })
    })
  })

  return primitives
}

// --- minidraco ---

export const decodeWithMinidraco = (primitive: DracoPrimitive): DecodedPrimitive => {
  const mesh = decodeDracoMesh(primitive.data)
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()

  const indices = new Uint32Array(numFaces * 3)
  indices.set(mesh.faces_.subarray(0, numFaces * 3))

  const attributes: DecodedPrimitive['attributes'] = new Map()
  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = mesh.getAttributeByUniqueId(uniqueId)
    if (!attribute) throw new Error(`minidraco: missing attribute with unique id ${uniqueId}`)
    const Ctor = dracoDataTypeToArray(attribute.dataType)
    attributes.set(uniqueId, {
      data: attribute.extractTo(Ctor, numPoints),
      numComponents: attribute.numComponents,
    })
  }

  return { numPoints, indices, attributes }
}

// --- draco.js (mrdoob) ---

export const decodeWithDracoJs = async (primitive: DracoPrimitive): Promise<DecodedPrimitive> => {
  const [{ Decoder }, { DecoderBuffer }] = await Promise.all([
    import('draco.js/src/compression/Decode.js'),
    import('draco.js/src/core/DecoderBuffer.js'),
  ])

  const buffer = new DecoderBuffer()
  buffer.init(primitive.data, primitive.data.length)

  const decoder = new Decoder()
  const result = decoder.decodeMeshFromBuffer(buffer)
  if (!result.ok) throw new Error(`draco.js: ${result.message}`)

  const mesh = result.mesh
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()

  const indices = new Uint32Array(numFaces * 3)
  indices.set(mesh.faces_.subarray(0, numFaces * 3))

  const attributes: DecodedPrimitive['attributes'] = new Map()
  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = mesh.getAttributeByUniqueId(uniqueId)
    if (!attribute) throw new Error(`draco.js: missing attribute with unique id ${uniqueId}`)
    const Ctor = dracoDataTypeToArray(attribute.dataType)
    attributes.set(uniqueId, {
      data: attribute.extractTo(Ctor, numPoints),
      numComponents: attribute.numComponents,
    })
  }

  return { numPoints, indices, attributes }
}

// --- draco3d (official wasm) ---

// Emscripten module: created once, reused across calls
let draco3dModule: any = null

export const getDraco3dModule = async (): Promise<any> => {
  if (!draco3dModule) {
    const draco3d = (await import('draco3d')).default
    draco3dModule = await draco3d.createDecoderModule({})
  }
  return draco3dModule
}

export const decodeWithDraco3d = async (primitive: DracoPrimitive): Promise<DecodedPrimitive> => {
  const m = await getDraco3dModule()

  const buffer = new m.DecoderBuffer()
  buffer.Init(primitive.data, primitive.data.length)

  const decoder = new m.Decoder()
  const mesh = new m.Mesh()
  const status = decoder.DecodeBufferToMesh(buffer, mesh)
  if (!status.ok()) {
    m.destroy(mesh)
    m.destroy(decoder)
    m.destroy(buffer)
    throw new Error(`draco3d: ${status.error_msg()}`)
  }

  const numPoints = mesh.num_points()
  const numFaces = mesh.num_faces()

  const indices = new Uint32Array(numFaces * 3)
  const indexByteLength = indices.byteLength
  const indexPtr = m._malloc(indexByteLength)
  decoder.GetTrianglesUInt32Array(mesh, indexByteLength, indexPtr)
  indices.set(new Uint32Array(m.HEAPU32.buffer, indexPtr, numFaces * 3))
  m._free(indexPtr)

  const attributes: DecodedPrimitive['attributes'] = new Map()
  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId)
    const dataType = attribute.data_type()
    const numComponents = attribute.num_components()
    const numValues = numPoints * numComponents
    const { array, heap } = draco3dTypeInfo(m, dataType, numValues)
    const ptr = m._malloc(array.byteLength)
    decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataType, array.byteLength, ptr)
    array.set(heap(ptr, numValues))
    m._free(ptr)
    attributes.set(uniqueId, { data: array, numComponents })
  }

  m.destroy(mesh)
  m.destroy(decoder)
  m.destroy(buffer)

  return { numPoints, indices, attributes }
}

// Draco DataType enum values (shared by draco3d, draco.js, and minidraco)
export const DT = {
  INT8: 1,
  UINT8: 2,
  INT16: 3,
  UINT16: 4,
  INT32: 5,
  UINT32: 6,
  FLOAT32: 9,
} as const

export const dracoDataTypeToArray = (dataType: number) => {
  switch (dataType) {
    case DT.INT8:
      return Int8Array
    case DT.UINT8:
      return Uint8Array
    case DT.INT16:
      return Int16Array
    case DT.UINT16:
      return Uint16Array
    case DT.INT32:
      return Int32Array
    case DT.UINT32:
      return Uint32Array
    case DT.FLOAT32:
      return Float32Array
    default:
      throw new Error(`Unsupported Draco data type ${dataType}`)
  }
}

const draco3dTypeInfo = (m: any, dataType: number, numValues: number) => {
  switch (dataType) {
    case DT.INT8:
      return { array: new Int8Array(numValues), heap: (p: number, n: number) => new Int8Array(m.HEAP8.buffer, p, n) }
    case DT.UINT8:
      return { array: new Uint8Array(numValues), heap: (p: number, n: number) => new Uint8Array(m.HEAPU8.buffer, p, n) }
    case DT.INT16:
      return { array: new Int16Array(numValues), heap: (p: number, n: number) => new Int16Array(m.HEAP16.buffer, p, n) }
    case DT.UINT16:
      return {
        array: new Uint16Array(numValues),
        heap: (p: number, n: number) => new Uint16Array(m.HEAPU16.buffer, p, n),
      }
    case DT.INT32:
      return { array: new Int32Array(numValues), heap: (p: number, n: number) => new Int32Array(m.HEAP32.buffer, p, n) }
    case DT.UINT32:
      return {
        array: new Uint32Array(numValues),
        heap: (p: number, n: number) => new Uint32Array(m.HEAPU32.buffer, p, n),
      }
    case DT.FLOAT32:
      return {
        array: new Float32Array(numValues),
        heap: (p: number, n: number) => new Float32Array(m.HEAPF32.buffer, p, n),
      }
    default:
      throw new Error(`Unsupported Draco data type ${dataType}`)
  }
}

export const BUNDLE_GLBS = [
  `${import.meta.dir}/../../example/public/models/manablade-characters.glb`,
  `${import.meta.dir}/../../example/public/models/manablade-static.glb`,
]

// draco.js ships its sample models inside the package (pinned by commit in
// package.json), so they are used straight from node_modules instead of being
// vendored into the repo.
export const DRACO_JS_SAMPLES_DIR = fileURLToPath(new URL('samples/', import.meta.resolve('draco.js/package.json')))

export const SAMPLE_GLBS = readdirSync(DRACO_JS_SAMPLES_DIR)
  .filter(name => name.endsWith('.glb'))
  .toSorted()
  .map(name => DRACO_JS_SAMPLES_DIR + name)

// Standalone Draco bitstreams (real models only — the tiny cube/test .drc
// files live in the fidelity test fixtures instead)
export const SAMPLE_DRCS = ['bunny.drc', 'car.drc', 'duck.drc'].map(name => DRACO_JS_SAMPLES_DIR + name)

// A raw .drc file is a single Draco bitstream with no glTF attribute map, so
// the unique attribute ids are enumerated from a throwaway decode.
export const extractDrcPrimitive = (drcPath: string): DracoPrimitive => {
  const data = new Uint8Array(readFileSync(drcPath))
  const mesh = decodeDracoMesh(data)
  const attributes: Record<string, number> = {}
  for (const attribute of mesh.attributes_) {
    if (attribute) attributes[`ATTR_${attribute.uniqueId}`] = attribute.uniqueId
  }
  return {
    file: drcPath,
    meshName: drcPath.split('/').pop()!,
    meshIndex: 0,
    primitiveIndex: 0,
    data,
    attributes,
  }
}

export const extractPrimitives = (path: string): DracoPrimitive[] =>
  path.endsWith('.drc') ? [extractDrcPrimitive(path)] : extractDracoPrimitives(path)
