// Ported from draco.js src/attributes/PointAttribute.js (MIT)

import { DataBuffer } from '../core/DataBuffer'
import { DataType, dataTypeLength } from '../core/DracoTypes'
import { scratchUint32 } from '../core/ScratchArena'
import { GeometryAttribute } from './GeometryAttribute'

import type { AttributeTransformData } from './AttributeTransformData'

type ExtractTypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array

type ViewCtor = (new (buffer: ArrayBufferLike) => ExtractTypedArray) & { BYTES_PER_ELEMENT: number }

// Typed-array view constructor matching a DataType, or null for the types
// without one (INT64 / UINT64 / BOOL / INVALID).
function viewCtorFor(dt: number): ViewCtor | null {
  switch (dt) {
    case DataType.INT8:
      return Int8Array
    case DataType.UINT8:
      return Uint8Array
    case DataType.INT16:
      return Int16Array
    case DataType.UINT16:
      return Uint16Array
    case DataType.INT32:
      return Int32Array
    case DataType.UINT32:
      return Uint32Array
    case DataType.FLOAT32:
      return Float32Array
    case DataType.FLOAT64:
      return Float64Array
    default:
      return null
  }
}

class PointAttribute extends GeometryAttribute {
  _identityMapping = false
  _numUniqueEntries = 0
  _indicesMap: number[] | Uint32Array = []
  _attributeBuffer: DataBuffer | null = null
  _attributeTransformData: AttributeTransformData | null = null

  // Lazily-created cached typed-array view over the attribute buffer, keyed
  // on (constructor, underlying ArrayBuffer). An attribute only ever reads
  // through the one view type its data type dictates.
  _cachedViewCtor: ViewCtor | null = null
  _cachedViewBuffer: ArrayBufferLike | null = null
  _cachedView: ExtractTypedArray | null = null

  constructor(geometryAttribute?: GeometryAttribute) {
    super()
    if (geometryAttribute instanceof GeometryAttribute) {
      this._buffer = geometryAttribute._buffer
      this._numComponents = geometryAttribute._numComponents
      this._dataType = geometryAttribute._dataType
      this._normalized = geometryAttribute._normalized
      this._byteStride = geometryAttribute._byteStride
      this._byteOffset = geometryAttribute._byteOffset
      this._attributeType = geometryAttribute._attributeType
      this._uniqueId = geometryAttribute._uniqueId
    }
  }

  // Intentionally shadows GeometryAttribute.init with a different signature (matches draco.js / C++ source).
  // @ts-expect-error -- signature intentionally differs from the base class, as in the source.
  override init(
    attributeType: number,
    numComponents: number,
    dataType: number,
    normalized: boolean,
    numAttributeValues: number,
  ): void {
    this._attributeBuffer = new DataBuffer()
    const byteStride = dataTypeLength(dataType) * numComponents
    super.init(attributeType, this._attributeBuffer, numComponents, dataType, normalized, byteStride, 0)
    this.reset(numAttributeValues)
    this.setIdentityMapping()
  }

  reset(numAttributeValues: number): boolean {
    if (this._attributeBuffer === null) {
      this._attributeBuffer = new DataBuffer()
    }
    const entrySize = dataTypeLength(this.dataType) * this.numComponents
    this._attributeBuffer.update(null, numAttributeValues * entrySize)
    this.resetBuffer(this._attributeBuffer, entrySize, 0)
    this._numUniqueEntries = numAttributeValues
    return true
  }

  // Like reset(), but backs the attribute with decode-scoped scratch memory.
  // Only valid for attributes that never escape the decode and whose every
  // byte is written before it is read (see DataBuffer.adoptScratch).
  resetScratch(numAttributeValues: number): boolean {
    if (this._attributeBuffer === null) {
      this._attributeBuffer = new DataBuffer()
    }
    const entrySize = dataTypeLength(this.dataType) * this.numComponents
    this._attributeBuffer.adoptScratch(numAttributeValues * entrySize)
    this.resetBuffer(this._attributeBuffer, entrySize, 0)
    this._numUniqueEntries = numAttributeValues
    return true
  }

  get size(): number {
    return this._numUniqueEntries
  }

  mappedIndex(pointIndex: number): number {
    if (this._identityMapping) {
      return pointIndex
    }
    return this._indicesMap[pointIndex]
  }

  get isMappingIdentity(): boolean {
    return this._identityMapping
  }

  get indicesMapSize(): number {
    if (this._identityMapping) {
      return 0
    }
    return this._indicesMap.length
  }

  // Direct access to the explicit point->value index map (a Uint32Array after
  // any of the setExplicitMapping* calls). Lets hot mapping loops write
  // entries without a per-entry dispatch.
  get indicesMap(): number[] | Uint32Array {
    return this._indicesMap
  }

  // Implicit mapping: point index equals attribute entry index.
  setIdentityMapping(): void {
    this._identityMapping = true
    this._indicesMap = []
  }

  // Explicit mapping without an invalid-index fill. Only for callers that
  // provably write every entry right away (the fill was ~4% of decode time on
  // primitive-heavy files). The array still starts zeroed by the engine, so a
  // buggy caller reads valid-looking zeros — hence opt-in.
  // Uint32Array (rather than a plain Array) keeps mappedIndex() monomorphic
  // and avoids boxed-number storage; it is read once per point per attribute.
  // Must be UNSIGNED so the 0xFFFFFFFF invalid sentinel round-trips intact.
  setExplicitMappingUnfilled(numPoints: number): void {
    this._identityMapping = false
    this._indicesMap = new Uint32Array(numPoints)
  }

  // Adopts an already-computed map, shared with other attributes of the same
  // mesh. The map must be treated as read-only from here on (reads go through
  // mappedIndex/extractTo).
  setExplicitMappingShared(map: Uint32Array): void {
    this._identityMapping = false
    this._indicesMap = map
  }

  // Like setExplicitMappingUnfilled, but from decode-scoped scratch. Only for
  // attributes that never escape the decode (see ScratchArena) -- the portable
  // attributes the sequential decoders build and discard.
  setExplicitMappingScratch(numPoints: number): void {
    this._identityMapping = false
    this._indicesMap = scratchUint32(numPoints)
  }

  setAttributeTransformData(transformData: AttributeTransformData): void {
    this._attributeTransformData = transformData
  }

  // Cached typed-array view of the given type over the attribute buffer.
  _view(Ctor: ViewCtor, bufData: Uint8Array): ExtractTypedArray {
    if (this._cachedViewCtor !== Ctor || this._cachedViewBuffer !== bufData.buffer) {
      this._cachedViewCtor = Ctor
      this._cachedViewBuffer = bufData.buffer
      this._cachedView = new Ctor(bufData.buffer)
    }
    return this._cachedView!
  }

  // Mirrors C++ PointAttribute::ConvertValue<T>(). Attribute buffers start at
  // byteOffset 0 and entries are naturally aligned, so every type reads
  // through a typed-array view instead of a per-component DataView dispatch.
  convertValue(attIndex: number, outVal: number[] | Int32Array | Uint32Array | Float32Array | Float64Array): void {
    const bytePos = this._byteOffset + this._byteStride * attIndex
    const bufData = this._buffer!.data
    const dt = this._dataType
    const nc = this._numComponents

    // INT32 fast path: portable attrs are INT32, read per-corner by the
    // geometric-normal / texcoords predictors.
    if (dt === DataType.INT32) {
      const view = this._view(Int32Array, bufData)
      const baseIndex = (bufData.byteOffset + bytePos) >> 2
      for (let i = 0; i < nc; ++i) {
        outVal[i] = view[baseIndex + i]
      }
      return
    }

    const Ctor = viewCtorFor(dt)
    if (Ctor === null) {
      for (let i = 0; i < nc; ++i) {
        outVal[i] = 0
      }
      return
    }
    const view = this._view(Ctor, bufData)
    const baseIndex = (bufData.byteOffset + bytePos) / Ctor.BYTES_PER_ELEMENT
    for (let i = 0; i < nc; ++i) {
      outVal[i] = view[baseIndex + i]
    }
  }

  // Flat-array extraction of all values into one output typed array (avoids the
  // per-point temp-array copy via cached typed-array views over the buffer).
  extractTo<C extends new (length: number) => ExtractTypedArray>(
    OutputTypedArray: C,
    numPoints: number,
  ): InstanceType<C> {
    const numComponents = this._numComponents
    const array = new OutputTypedArray(numPoints * numComponents) as InstanceType<C>
    const Ctor = viewCtorFor(this._dataType)
    // Types without a typed-array view (INT64 / UINT64 / BOOL) extract as zeros.
    if (this._buffer === null || numPoints === 0 || Ctor === null) {
      return array
    }
    const bufData = this._buffer.data
    const isIdentity = this._identityMapping
    const indicesMap = this._indicesMap
    const srcView = this._view(Ctor, bufData)
    const shift = 31 - Math.clz32(Ctor.BYTES_PER_ELEMENT)
    const srcStart = (bufData.byteOffset + this._byteOffset) >> shift
    const strideElements = this._byteStride >> shift

    // Contiguous: single block copy when source and output types match.
    if (isIdentity && strideElements === numComponents) {
      const srcEnd = srcStart + numPoints * numComponents
      if (srcView.constructor === OutputTypedArray) {
        array.set(srcView.subarray(srcStart, srcEnd))
        return array
      }
    }

    // Branch the loop-invariant isIdentity once; unroll the nc=2/3 gather.
    if (isIdentity) {
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        const srcOffset = srcStart + i * strideElements
        for (let j = 0; j < numComponents; j++) {
          array[dst + j] = srcView[srcOffset + j]
        }
        dst += numComponents
      }
    } else if (numComponents === 3) {
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        const srcOffset = srcStart + indicesMap[i] * strideElements
        array[dst] = srcView[srcOffset]
        array[dst + 1] = srcView[srcOffset + 1]
        array[dst + 2] = srcView[srcOffset + 2]
        dst += 3
      }
    } else if (numComponents === 2) {
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        const srcOffset = srcStart + indicesMap[i] * strideElements
        array[dst] = srcView[srcOffset]
        array[dst + 1] = srcView[srcOffset + 1]
        dst += 2
      }
    } else if (numComponents === 4) {
      // Skinning attributes (JOINTS_0 / WEIGHTS_0) and RGBA colors.
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        const srcOffset = srcStart + indicesMap[i] * strideElements
        array[dst] = srcView[srcOffset]
        array[dst + 1] = srcView[srcOffset + 1]
        array[dst + 2] = srcView[srcOffset + 2]
        array[dst + 3] = srcView[srcOffset + 3]
        dst += 4
      }
    } else if (numComponents === 1) {
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        array[dst++] = srcView[srcStart + indicesMap[i] * strideElements]
      }
    } else {
      let dst = 0
      for (let i = 0; i < numPoints; i++) {
        const srcOffset = srcStart + indicesMap[i] * strideElements
        for (let j = 0; j < numComponents; j++) {
          array[dst + j] = srcView[srcOffset + j]
        }
        dst += numComponents
      }
    }
    return array
  }
}

export { PointAttribute }
