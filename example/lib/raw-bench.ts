// Raw single-threaded decode benchmark: extracts the Draco bitstreams from a
// GLB (or takes a whole .drc file) and decodes them with each decoder
// synchronously on the main thread — no worker pools, no GLTFLoader overhead,
// no wasm transfer tricks. The browser (V8) counterpart of `bun run bench`.
import { decodeDracoMesh } from 'minidraco'

import { Decoder as DracoJsDecoder } from 'draco.js/src/compression/Decode.js'
import { DecoderBuffer as DracoJsDecoderBuffer } from 'draco.js/src/core/DecoderBuffer.js'

export interface RawPrimitive {
  data: Uint8Array
  // glTF attribute semantic → Draco unique attribute id
  attributes: Record<string, number>
}

const parseGlb = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Not a GLB file')

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

  if (!json || !bin) throw new Error('GLB is missing a JSON or BIN chunk')
  return { json, bin }
}

export const extractPrimitives = (name: string, bytes: Uint8Array): RawPrimitive[] => {
  if (name.endsWith('.drc')) {
    // A raw .drc has no glTF attribute map — enumerate ids from a throwaway decode
    const mesh = decodeDracoMesh(bytes)
    const attributes: Record<string, number> = {}
    for (const attribute of mesh.attributes_) {
      if (attribute) attributes[`ATTR_${attribute.uniqueId}`] = attribute.uniqueId
    }
    return [{ data: bytes, attributes }]
  }

  const { json, bin } = parseGlb(bytes)
  const primitives: RawPrimitive[] = []

  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives) {
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (!draco) continue
      const bufferView = json.bufferViews[draco.bufferView]
      const start = bufferView.byteOffset ?? 0
      primitives.push({
        // Copy so each primitive owns an aligned, independent buffer
        data: bin.slice(start, start + bufferView.byteLength),
        attributes: draco.attributes,
      })
    }
  }

  return primitives
}

// Draco DataType enum values (shared by draco3d, draco.js, and minidraco)
const DT = { INT8: 1, UINT8: 2, INT16: 3, UINT16: 4, INT32: 5, UINT32: 6, FLOAT32: 9 } as const

const dracoDataTypeToArray = (dataType: number) => {
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

// Every decoder does the same full job as the node bench harness: decode,
// copy out the indices, and extract every glTF-mapped attribute to a fresh
// typed array.

export const decodeRawWithMinidraco = (primitive: RawPrimitive) => {
  const mesh = decodeDracoMesh(primitive.data)
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()

  const indices = new Uint32Array(numFaces * 3)
  indices.set(mesh.faces_.subarray(0, numFaces * 3))

  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = mesh.getAttributeByUniqueId(uniqueId)
    if (!attribute) throw new Error(`minidraco: missing attribute ${uniqueId}`)
    attribute.extractTo(dracoDataTypeToArray(attribute.dataType), numPoints)
  }

  return { numPoints, numFaces }
}

export const decodeRawWithDracoJs = (primitive: RawPrimitive) => {
  const buffer = new DracoJsDecoderBuffer()
  buffer.init(primitive.data, primitive.data.length)

  const decoder = new DracoJsDecoder()
  const result = decoder.decodeMeshFromBuffer(buffer)
  if (!result.ok) throw new Error(`draco.js: ${result.message}`)

  const mesh = result.mesh
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()

  const indices = new Uint32Array(numFaces * 3)
  indices.set(mesh.faces_.subarray(0, numFaces * 3))

  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = mesh.getAttributeByUniqueId(uniqueId)
    if (!attribute) throw new Error(`draco.js: missing attribute ${uniqueId}`)
    attribute.extractTo(dracoDataTypeToArray(attribute.dataType), numPoints)
  }

  return { numPoints, numFaces }
}

// --- draco3d wasm on the main thread ---
// Loads the same wrapper + wasm binary the DRACOLoader workers use, but
// instantiates the module in the page so decoding runs synchronously here.

let draco3dModulePromise: Promise<any> | null = null

export const getMainThreadDraco3d = (): Promise<any> => {
  draco3dModulePromise ??= (async () => {
    const [, wasmBinary] = await Promise.all([
      new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = '/draco/draco_wasm_wrapper.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('failed to load /draco/draco_wasm_wrapper.js'))
        document.head.appendChild(script)
      }),
      fetch('/draco/draco_decoder.wasm').then(r => r.arrayBuffer()),
    ])
    return await new Promise(resolve => {
      ;(window as any).DracoDecoderModule({ wasmBinary, onModuleLoaded: (m: any) => resolve(m) })
    })
  })()
  return draco3dModulePromise
}

export const decodeRawWithDraco3d = (m: any, primitive: RawPrimitive) => {
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
  const indexPtr = m._malloc(indices.byteLength)
  decoder.GetTrianglesUInt32Array(mesh, indices.byteLength, indexPtr)
  indices.set(new Uint32Array(m.HEAPU32.buffer, indexPtr, numFaces * 3))
  m._free(indexPtr)

  for (const uniqueId of Object.values(primitive.attributes)) {
    const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId)
    const dataType = attribute.data_type()
    const numValues = numPoints * attribute.num_components()
    const Ctor = dracoDataTypeToArray(dataType)
    const array = new Ctor(numValues)
    const ptr = m._malloc(array.byteLength)
    decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataType, array.byteLength, ptr)
    array.set(new Ctor(m.HEAPU8.buffer, ptr, numValues) as never)
    m._free(ptr)
  }

  m.destroy(mesh)
  m.destroy(decoder)
  m.destroy(buffer)

  return { numPoints, numFaces }
}
