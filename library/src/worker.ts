// Web Worker entry for MiniDRACOLoader's worker pool. Bundled self-contained
// (no imports) by tsup, so it can be spawned as a module worker via
// `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`
// from the library dist, or inlined into an app bundle by webpack/turbopack.
import { decodeDracoMesh } from './index'

interface DecodeTask {
  id: number
  buffer: ArrayBuffer
  attributeIDs: Record<string, number | string>
  attributeTypes: Record<string, string>
  useUniqueIDs: boolean
}

// Tasks arrive batched (one message per worker per decode burst — see
// MiniDRACOLoader._flushBatch) and results go back in one message, with all
// decoded buffers in a single transfer list.
interface DecodeRequest {
  tasks: DecodeTask[]
}

interface AttributeResult {
  name: string
  array: ArrayBufferView
  itemSize: number
}

const typedArrayMap: Record<string, new (length: number) => any> = {
  Float32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
}

// Draco GeometryAttribute type ids (POSITION..GENERIC), matching
// GeometryAttributeType in the decoder.
const attributeTypeMap: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  COLOR: 2,
  TEX_COORD: 3,
  GENERIC: 4,
}

// --- JIT warmup -------------------------------------------------------------
// A fresh worker runs the decoder in the engine's interpreter/baseline tier;
// the first real decodes pay a multi-x penalty until the JIT tiers up
// (measured: rolex.glb cold pool decode 125 ms vs 19 ms warm). Decode two tiny
// embedded Draco meshes — together they exercise edgebreaker valence
// connectivity, parallelogram + octahedron-normal + tex-coord prediction, and
// quantized attribute dequantization — in a small time budget at spawn, so the
// hot paths are tiered before the first real mesh arrives. preload() spawns
// the pool early, so in a real app this overlaps the model download.
//
// The blobs are Draco test-corpus fixtures (see src/__tests__/fixtures):
// cube_att.obj.edgebreaker.cl10.2.2.drc and test_nm.obj.edgebreaker.cl10.2.2.drc.
const WARMUP_MESHES = [
  'RFJBQ08CAgEBAAAACAwCCwAAA19LFQEBEFUEiqykRlUEiqykRgP/AAEAAQABAQABAAkDAAACAQMJAgABAgEBCQMAAgMBAQEAAwMBMAEQAwAolo4IBAAAAAAA//8PAAAAAAAAAAAAAAAAAAAAgD8UBQEBAA0DVQ2tEgcBCBcBGAiNgnLDtzyDjQa8/L+/5fu/v/zLv7qB/Ms/mvzL//u/fwL2+8s/Lv/v//7yDwwAAAABAsBAAAAAAP8PAAAAAAAAAAAAAAAAgD8MBgMBAQMBAUABAP8PAAD/BwAA/wKhQQw=',
  'RFJBQ08CAgEBAAAAY6oBAaoBEQIjIhInAy9v27bd8zba1qOlpaXFw6NtoUW17HnQ0uLh0dLuS0G1xRutB0/x8GhpaWmjpbV2Af8BEf8CtFkC/wABAAAAAQAJAwAAAgEBCQMAAQMEAQEAFTOVAqRJDAPREGkIpRakHv/TeMFX2IhVKbvYFJI4bRbT6wPZYPOX8VGBuPevgP//DwAA////RUXlm3hR8XgqAIBC/q/LNL+bIX9el6l8E0P+QN0BAED2la/LNL9bIX9OygAAAED53bBhCgCA12Uq36SQP4b8AQAcTy3kj/ndXpf5uToAANhzXs8JG6bXc7IcAgDgeGohf5Rv8rpM7CsBAIC6w5A/5nd7XSYAAABwUgYAADZMy+92PBUAgOWQ12WCukP5Job8Ub7J6zKRpwIAMOQPu0zzuxXy53pOAAA+V/9cXR636zmRpwIAsByy4wbUnYhCAAAAdq8AgAAAyjd33DSAVG3xdAcAANhXwi7T/G6G/EEpAwAAAOZ3w4YpAAAqhwAAOJ6afBNQd7wuE6UMALAcot8tAADWMEUpAwAsh8dTwYYpFM123DSAPG1RyB8AAPJUQ/6Y3w12mYZHAIDh8XN1edyw56wcAgAAeeqHQlB3O254LwAAAMk3AwAIAOC9AACg7k80w4Yp8lSu5wQA4HP10xYNIHfcZF8JAMDTHYX8Mb8b7DIBAAAAlDIAALBhan435KkAACqH7LgBdfehEKUMAKgcDh4BAIbH6znlcftc/XgqAIDKIa/LBHVH8k0AAADgvQIAAgAk37QcAgAAeaqIQlB3O24shwAAlLI1TAMAgH43qDsAgPeCPBVsmD7R7HN1AACu57yeEwCAz9UthwAAlLKIQqg7OW4shwAAQJ5qDVNsmAYAwHIIAIDjqVA0AwDA6zKVb9LpjtdlHkMAcAyh7gCA3QvyVLBhCkUz5hcAYH4BAAAAy+HxVAAAlUMCAIAN02qYPt0BALwX2GUCAOCJZtdzwobp9Zw+V4cN08/V8V4AAE/3yiEAAACwewEAPN2Vb2I4/LpM9LsFAKAaphpPBfCaJo+IjAGUE0jhW5B2r4hR4XvTN3D0n1mXRmEAAAAAAAD//w8AAACAvwAAgL8AAIC/AAAAQBQGAwEBCP8fIQZtBz0DA6RFAgP4A30FTQETTQFNAU0BJ5UCQ00BV1QjVAuk11T//0dUS1T///////////////////////////////////////////////////////////////////////8fVDNU////Y00BG00BH1THlQILTQEHpBdFAlSNA00BRQIDVAPxAXUGcot7RoVBQr8ZjqClIaqZW9oaEFDFPmm2QibrbUNpDRafleMbvVqsHsl3xiPwAnnFKq1Fk0Oem9LUc/XVks27dDwVsAeuvUm/cgFFkEka2dFDtSuMiiXvrwxcgsk3CjsD1yMKeKrIMPIWOKILWSg5qVAhjP8PAAD/BwAA/wLPRww=',
].map(base64 => Uint8Array.from(atob(base64), c => c.charCodeAt(0)))

// Warm in ~5 ms chunks that yield to the event loop, so a decode request
// arriving mid-warmup is served after at most one chunk; stop once real work
// arrives (real decodes continue the tiering on actual data).
let realWorkArrived = false
{
  const warmupDeadline = performance.now() + 150
  const warmupChunk = () => {
    if (realWorkArrived) return
    const chunkEnd = performance.now() + 5
    while (performance.now() < chunkEnd) {
      for (const mesh of WARMUP_MESHES) decodeDracoMesh(mesh)
    }
    if (performance.now() < warmupDeadline) setTimeout(warmupChunk, 0)
  }
  warmupChunk()
}

const decodeTask = (task: DecodeTask, transfer: ArrayBuffer[]) => {
  const { id, buffer, attributeIDs, attributeTypes, useUniqueIDs } = task

  const mesh = decodeDracoMesh(new Uint8Array(buffer))
  const numPoints = mesh.numPoints()
  const numFaces = mesh.numFaces()

  const indices = new Uint32Array(mesh.faces_.buffer, mesh.faces_.byteOffset, numFaces * 3)

  const attributes: AttributeResult[] = []
  transfer.push(indices.buffer as ArrayBuffer)

  for (const attributeName in attributeIDs) {
    const OutputTypedArray = typedArrayMap[attributeTypes[attributeName]]
    if (!OutputTypedArray) continue

    let attribute
    if (useUniqueIDs) {
      attribute = mesh.getAttributeByUniqueId(attributeIDs[attributeName] as number)
    } else {
      const typeEnum = attributeTypeMap[attributeIDs[attributeName] as string]
      if (typeEnum === undefined) continue
      attribute = mesh.getNamedAttribute(typeEnum)
    }
    if (!attribute) continue

    const array = attribute.extractTo(OutputTypedArray, numPoints)
    attributes.push({ name: attributeName, array, itemSize: attribute.numComponents })
    transfer.push(array.buffer as ArrayBuffer)
  }

  return { id, ok: true, indices, attributes }
}

self.onmessage = (event: MessageEvent<DecodeRequest>) => {
  realWorkArrived = true

  const transfer: ArrayBuffer[] = []
  // Decode errors are isolated per task: one malformed primitive fails alone.
  const results = event.data.tasks.map(task => {
    try {
      return decodeTask(task, transfer)
    } catch (error) {
      return { id: task.id, ok: false, error: String(error) }
    }
  })

  ;(self as unknown as Worker).postMessage({ results }, transfer)
}
