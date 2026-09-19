// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeWrapDecodingTransform.js (MIT)

import { PredictionSchemeTransformType } from '../../config/CompressionShared'

import type { DecoderBuffer } from '../../../core/DecoderBuffer'

// Unwraps values encoded with the wrap transform: the encoder stored a
// correction wrapped into the data range; decoding adds it to the prediction
// and wraps the result back into [min, max].
class PredictionSchemeWrapDecodingTransform {
  _numComponents = 0
  _minValue = 0
  _maxValue = 0
  _maxDif = 0

  getType(): number {
    return PredictionSchemeTransformType.PREDICTION_TRANSFORM_WRAP
  }

  init(numComponents: number): void {
    this._numComponents = numComponents
  }

  areCorrectionsPositive(): boolean {
    return false
  }

  boundsValues(limit: number): boolean {
    return this._maxValue < limit && this._minValue > -limit
  }

  computeOriginalValue(
    predictedVals: Int32Array,
    predictedOffset: number,
    corrVals: Int32Array,
    corrOffset: number,
    outOriginalVals: Int32Array,
    outOffset: number,
  ): void {
    const nc = this._numComponents
    const minValue = this._minValue
    const maxValue = this._maxValue
    const maxDif = this._maxDif
    for (let i = 0; i < nc; ++i) {
      let pred = predictedVals[predictedOffset + i]
      if (pred > maxValue) {
        pred = maxValue
      } else if (pred < minValue) {
        pred = minValue
      }
      // 32-bit (| 0) arithmetic to avoid signed overflow.
      let orig = (pred + corrVals[corrOffset + i]) | 0
      if (orig > maxValue) {
        orig -= maxDif
      } else if (orig < minValue) {
        orig += maxDif
      }
      outOriginalVals[outOffset + i] = orig
    }
  }

  decodeTransformData(buffer: DecoderBuffer): boolean {
    const minValue = buffer.decodeInt32()
    if (minValue === undefined) return false
    const maxValue = buffer.decodeInt32()
    if (maxValue === undefined) return false

    // The range is computed at full precision (C++ int64), so it must fit the
    // int32 data type.
    const dif = maxValue - minValue
    if (dif < 0 || dif >= 0x7fffffff) return false

    this._minValue = minValue
    this._maxValue = maxValue
    this._maxDif = 1 + dif
    return true
  }
}

export { PredictionSchemeWrapDecodingTransform }
