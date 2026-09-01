// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeDecoder.js (MIT)

import { PredictionSchemeDecoderInterface } from './PredictionSchemeDecoderInterface'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../../core/DecoderBuffer'

// Structural type describing the decoding transforms (wrap / normal octahedron /
// normal octahedron canonicalized). C++ templates on TransformT; here the
// transform is a constructor param typed by this interface. getType and
// quantizationBits are optional because callers feature-test them.
interface PredictionSchemeDecodingTransform {
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
  getType?(): number
  quantizationBits?(): number
  // Optional fused delta loop (value[i] = original(value[i-1], corr[i]) over
  // the whole attribute). PredictionSchemeDeltaDecoder uses it when present so
  // hot transforms avoid one virtual call per value; inCorr and outData may
  // alias, so each correction must be read before its slot is written.
  computeOriginalValuesDelta?(inCorr: Int32Array, outData: Int32Array, size: number, numComponents: number): void
}

/**
 * Base class for typed prediction scheme decoders. C++ templates this on
 * <DataTypeT, TransformT>; here the transform is a constructor param.
 */
class PredictionSchemeDecoder extends PredictionSchemeDecoderInterface {
  _attribute: PointAttribute
  _transform: PredictionSchemeDecodingTransform

  constructor(attribute: PointAttribute, transform: PredictionSchemeDecodingTransform) {
    super()
    this._attribute = attribute
    this._transform = transform
  }

  override decodePredictionData(buffer: DecoderBuffer): boolean {
    if (!this._transform.decodeTransformData(buffer)) {
      return false
    }
    return true
  }

  override getNumParentAttributes(): number {
    return 0
  }

  override getParentAttributeType(i: number): number {
    return -1 // INVALID
  }

  override setParentAttribute(att: PointAttribute): boolean {
    return false
  }

  override areCorrectionsPositive(): boolean {
    return this._transform.areCorrectionsPositive()
  }
}

export { PredictionSchemeDecoder }
export type { PredictionSchemeDecodingTransform }
