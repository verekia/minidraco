// Ported from draco.js src/attributes/PointAttribute.js (MIT)

import { DataBuffer } from '../core/DataBuffer'
import { DataType, dataTypeLength } from '../core/DracoTypes'
import { scratchUint32 } from '../core/ScratchArena'
import { GeometryAttribute } from './GeometryAttribute'

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

// Deferred inverse transforms (see PointAttribute._lazyKind).
const LAZY_NONE = 0
const LAZY_INTEGER = 1
const LAZY_QUANTIZED = 2
const LAZY_OCTAHEDRON = 3

class PointAttribute extends GeometryAttribute {
  _identityMapping = false
  _numUniqueEntries = 0
  _indicesMap: number[] | Uint32Array = []
  _attributeBuffer: DataBuffer | null = null

  // Lazily-created cached typed-array view over the attribute buffer, keyed
  // on (constructor, underlying ArrayBuffer). An attribute only ever reads
  // through the one view type its data type dictates.
  _cachedViewCtor: ViewCtor | null = null
  _cachedViewBuffer: ArrayBufferLike | null = null
  _cachedView: ExtractTypedArray | null = null

  // Deferred inverse transform. The integer attribute decoders leave their
  // decoded values here as int32 -- quantized floats, octahedral normals or
  // plain integers -- with the transform's parameters, and extractTo applies
  // the transform while gathering the values into point order: one pass over
  // the points instead of an inverse-transform pass into a per-value buffer
  // followed by a gather from it, and no such buffer at all.
  _lazyKind = LAZY_NONE
  _lazyValues: Int32Array | null = null
  _lazyMin: number[] = []
  _lazyScale = 0

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

  // Sizes the attribute without allocating storage, for the deferred
  // transforms below (the values live in the decoder's portable attribute).
  resetLazy(numAttributeValues: number): void {
    this._numUniqueEntries = numAttributeValues
  }

  // numValues decoded integers of the attribute's own integer type, stored as
  // int32; extractTo converts them to the requested output type.
  setLazyInteger(values: Int32Array | null): void {
    this._lazyKind = LAZY_INTEGER
    this._lazyValues = values
  }

  // Quantized float values: value * delta + min per component (float32
  // arithmetic, see _extractQuantized), as the C++ Dequantizer computes them.
  setLazyQuantized(values: Int32Array | null, minValues: number[], delta: number): void {
    this._lazyKind = LAZY_QUANTIZED
    this._lazyValues = values
    this._lazyMin = minValues
    this._lazyScale = delta
  }

  // Octahedral normals: two quantized coordinates per value, dequantized by
  // `scale` and turned into unit vectors (see _extractOctahedron).
  setLazyOctahedron(values: Int32Array | null, scale: number): void {
    this._lazyKind = LAZY_OCTAHEDRON
    this._lazyValues = values
    this._lazyScale = scale
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

  // Cached typed-array view of the given type over the attribute buffer.
  _view(Ctor: ViewCtor, bufData: Uint8Array): ExtractTypedArray {
    if (this._cachedViewCtor !== Ctor || this._cachedViewBuffer !== bufData.buffer) {
      this._cachedViewCtor = Ctor
      this._cachedViewBuffer = bufData.buffer
      this._cachedView = new Ctor(bufData.buffer)
    }
    return this._cachedView!
  }

  // Mirrors C++ PointAttribute::ConvertValue<T>() for buffer-backed
  // attributes. Attribute buffers start at byteOffset 0 and entries are
  // naturally aligned, so every type reads through a typed-array view instead
  // of a per-component DataView dispatch.
  convertValue(attIndex: number, outVal: number[] | Int32Array | Uint32Array | Float32Array | Float64Array): void {
    const bufData = this._buffer!.data
    const nc = this._numComponents
    const Ctor = viewCtorFor(this._dataType)
    if (Ctor === null) {
      for (let i = 0; i < nc; ++i) outVal[i] = 0
      return
    }
    const view = this._view(Ctor, bufData)
    const baseIndex = (bufData.byteOffset + this._byteOffset + this._byteStride * attIndex) / Ctor.BYTES_PER_ELEMENT
    for (let i = 0; i < nc; ++i) outVal[i] = view[baseIndex + i]
  }

  // Flat-array extraction of all values into one output typed array, in point
  // order (applying the deferred transform, if any, on the way).
  extractTo<C extends new (length: number) => ExtractTypedArray>(
    OutputTypedArray: C,
    numPoints: number,
  ): InstanceType<C> {
    const numComponents = this._numComponents
    const array = new OutputTypedArray(numPoints * numComponents) as InstanceType<C>
    if (numPoints === 0) {
      return array
    }
    const kind = this._lazyKind
    if (kind !== LAZY_NONE) {
      if (this._lazyValues !== null) {
        if (kind === LAZY_QUANTIZED) this._extractQuantized(array, numPoints)
        else if (kind === LAZY_OCTAHEDRON) this._extractOctahedron(array, numPoints)
        else this._extractInteger(array, numPoints)
      }
      return array
    }
    const Ctor = viewCtorFor(this._dataType)
    // Types without a typed-array view (INT64 / UINT64 / BOOL) extract as zeros.
    if (this._buffer === null || Ctor === null) {
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

    let dst = 0
    for (let i = 0; i < numPoints; i++) {
      const srcOffset = srcStart + (isIdentity ? i : indicesMap[i]) * strideElements
      for (let j = 0; j < numComponents; j++) {
        array[dst + j] = srcView[srcOffset + j]
      }
      dst += numComponents
    }
    return array
  }

  // The deferred transforms, each fused with the point-order gather. One
  // function per transform so the engine tiers each up on its own complete
  // type feedback (a single body for all three deoptimized once per newly
  // seen kind, which made the first decodes of a session measurably slower).
  // Every float step is rounded to float32 exactly where the C++ decoder's
  // float arithmetic rounds (Dequantizer, OctahedronToolBox), so the values
  // are bit-identical to the reference decoder whatever the output array type.

  // Point -> value index; the identity mapping (sequential meshes) gets a
  // plain iota so the loops carry no per-point branch.
  _lazyMap(numPoints: number): Uint32Array {
    if (!this._identityMapping) return this._indicesMap as Uint32Array
    const map = new Uint32Array(numPoints)
    for (let p = 0; p < numPoints; ++p) map[p] = p
    return map
  }

  // The C++ starts from static_cast<float>(value). An integer below 2^24 is
  // exact as a float32 and its product with a float32 is exact as a double,
  // so for such values `fround(value * scale)` is that float32 product
  // without the (measurably costly) int-to-float32-to-double round trip per
  // component. Larger values (quantization above 24 bits, never seen in
  // practice) are rounded in place once here, after which the same holds.
  _lazyFloatValues(): Int32Array {
    const values = this._lazyValues!
    for (let i = 0; i < values.length; ++i) {
      if (values[i] >= 0x1000000 || values[i] <= -0x1000000) {
        for (let j = 0; j < values.length; ++j) values[j] = Math.fround(values[j])
        break
      }
    }
    return values
  }

  // C++ Dequantizer: float(value) * delta + min, all in float32.
  _extractQuantized(out: ExtractTypedArray, numPoints: number): void {
    const values = this._lazyFloatValues()
    const map = this._lazyMap(numPoints)
    const numComponents = this._numComponents
    const fround = Math.fround
    const delta = this._lazyScale
    const min = this._lazyMin
    if (numComponents === 3) {
      const m0 = min[0]
      const m1 = min[1]
      const m2 = min[2]
      for (let p = 0, d = 0; p < numPoints; ++p, d += 3) {
        const s = map[p] * 3
        out[d] = fround(fround(values[s] * delta) + m0)
        out[d + 1] = fround(fround(values[s + 1] * delta) + m1)
        out[d + 2] = fround(fround(values[s + 2] * delta) + m2)
      }
      return
    }
    if (numComponents === 2) {
      const m0 = min[0]
      const m1 = min[1]
      for (let p = 0, d = 0; p < numPoints; ++p, d += 2) {
        const s = map[p] * 2
        out[d] = fround(fround(values[s] * delta) + m0)
        out[d + 1] = fround(fround(values[s + 1] * delta) + m1)
      }
      return
    }
    for (let p = 0, d = 0; p < numPoints; ++p) {
      const s = map[p] * numComponents
      for (let c = 0; c < numComponents; ++c) {
        out[d++] = fround(fround(values[s + c] * delta) + min[c])
      }
    }
  }

  // OctahedronToolBox.QuantizedOctahedralCoordsToUnitVector, two quantized
  // coordinates per value to one unit vector per point.
  _extractOctahedron(out: ExtractTypedArray, numPoints: number): void {
    const values = this._lazyFloatValues()
    const map = this._lazyMap(numPoints)
    const fround = Math.fround
    const scale = this._lazyScale
    for (let p = 0, d = 0; p < numPoints; ++p, d += 3) {
      const s = map[p] * 2
      let y = fround(fround(values[s] * scale) - 1.0)
      let z = fround(fround(values[s + 1] * scale) - 1.0)
      const x = fround(fround(1.0 - Math.abs(y)) - Math.abs(z))

      let xOffset = -x
      if (xOffset < 0) xOffset = 0

      y = fround(y + (y < 0 ? xOffset : -xOffset))
      z = fround(z + (z < 0 ? xOffset : -xOffset))

      const normSquared = fround(fround(fround(x * x) + fround(y * y)) + fround(z * z))
      if (normSquared < 1e-6) {
        out[d] = 0
        out[d + 1] = 0
        out[d + 2] = 0
      } else {
        const k = fround(1.0 / fround(Math.sqrt(normSquared)))
        out[d] = fround(x * k)
        out[d + 1] = fround(y * k)
        out[d + 2] = fround(z * k)
      }
    }
  }

  // The int32 values wrap to the attribute's own integer type (as storing
  // them into it would) before the output store converts them.
  _extractInteger(out: ExtractTypedArray, numPoints: number): void {
    const values = this._lazyValues!
    const map = this._lazyMap(numPoints)
    const numComponents = this._numComponents
    const dt = this._dataType
    const shift = 32 - 8 * dataTypeLength(dt)
    const signed = dt === DataType.INT8 || dt === DataType.INT16 || dt === DataType.INT32
    for (let p = 0, d = 0; p < numPoints; ++p) {
      const s = map[p] * numComponents
      for (let c = 0; c < numComponents; ++c) {
        const v = values[s + c] << shift
        out[d++] = signed ? v >> shift : v >>> shift
      }
    }
  }
}

export { PointAttribute }
