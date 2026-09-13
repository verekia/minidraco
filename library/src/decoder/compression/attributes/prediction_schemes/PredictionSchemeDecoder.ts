// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeDecoder.js (MIT)
// and PredictionSchemeDecoderInterface.js: every scheme extends this class, so
// the separate interface layer was only boilerplate and is folded in here.

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../../core/DecoderBuffer'

// Structural type describing the decoding transforms (wrap / normal octahedron /
// normal octahedron canonicalized). C++ templates on TransformT; here the
// transform is a constructor param typed by this interface.
interface PredictionSchemeDecodingTransform {
  getType(): number
  init(numComponents: number): void
  areCorrectionsPositive(): boolean
  decodeTransformData(buffer: DecoderBuffer): boolean
  computeOriginalValue(
    predictedVals: Int32Array,
    predictedOffset: number,
    corrVals: Int32Array,
    corrOffset: number,
    outOriginalVals: Int32Array,
    outOffset: number,
  ): void
  // Octahedral transforms only (the geometric normal scheme needs it).
  quantizationBits?(): number
  // Optional fused delta loop (value[i] = original(value[i-1], corr[i]) over
  // the whole attribute). PredictionSchemeDeltaDecoder uses it when present so
  // hot transforms avoid one virtual call per value; inCorr and outData may
  // alias, so each correction must be read before its slot is written.
  computeOriginalValuesDelta?(inCorr: Int32Array, outData: Int32Array, size: number, numComponents: number): void
}

/**
 * Base class for prediction scheme decoders. C++ templates this on
 * <DataTypeT, TransformT>; here the transform is a constructor param.
 */
class PredictionSchemeDecoder {
  _transform: PredictionSchemeDecodingTransform

  constructor(transform: PredictionSchemeDecodingTransform) {
    this._transform = transform
  }

  /** True if all correction values are guaranteed to be positive. */
  areCorrectionsPositive(): boolean {
    return this._transform.areCorrectionsPositive()
  }

  getNumParentAttributes(): number {
    return 0
  }

  getParentAttributeType(_i: number): number {
    return -1 // INVALID
  }

  setParentAttribute(_att: PointAttribute): boolean {
    return false
  }

  decodePredictionData(buffer: DecoderBuffer): boolean {
    return this._transform.decodeTransformData(buffer)
  }

  /**
   * Like computeOriginalValues, but inCorr still holds unsigned zigzag-coded
   * corrections; the implementation unpacks each one inline, replacing the
   * standalone convertSymbolsToSignedInts pass. Returns undefined when the
   * scheme/transform combination cannot fuse (the caller then falls back to
   * the two-pass path). Base implementation: never fusable.
   */
  computeOriginalValuesZigzag(
    _inCorr: Int32Array,
    _outData: Int32Array,
    _size: number,
    _numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean | undefined {
    return undefined
  }

  /** Reverts the prediction applied during encoding, writing original values to outData. */
  computeOriginalValues(
    _inCorr: Int32Array,
    _outData: Int32Array,
    _size: number,
    _numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean {
    return false
  }
}

export { PredictionSchemeDecoder }
export type { PredictionSchemeDecodingTransform }
