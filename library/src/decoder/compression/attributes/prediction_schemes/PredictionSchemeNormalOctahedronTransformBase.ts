// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeNormalOctahedronTransformBase.js (MIT)
//
// Shared base for the octahedral-normal decoding transforms. Holds the
// OctahedronToolBox and the quantization-bit plumbing; each subclass supplies
// its own getType / decodeTransformData / computeOriginalValue.

import { OctahedronToolBox } from '../NormalCompressionUtils'

class PredictionSchemeNormalOctahedronTransformBase {
  _octahedronToolBox = new OctahedronToolBox()

  areCorrectionsPositive(): boolean {
    return true
  }

  /** No-op to fulfill the transform interface. */
  init(_numComponents: number): void {}

  quantizationBits(): number {
    return this._octahedronToolBox.quantizationBits()
  }

  _setMaxQuantizedValue(maxQuantizedValue: number): boolean {
    if (maxQuantizedValue % 2 === 0) return false
    let q = 0
    let v = maxQuantizedValue
    while (v > 0) {
      v >>>= 1
      q++
    }
    return this._octahedronToolBox.setQuantizationBits(q)
  }
}

export { PredictionSchemeNormalOctahedronTransformBase }
