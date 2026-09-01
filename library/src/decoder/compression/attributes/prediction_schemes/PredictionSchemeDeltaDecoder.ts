// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeDeltaDecoder.js (MIT)

import { PredictionSchemeDecoder, type PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'

import type { PointAttribute } from '../../../attributes/PointAttribute'

/**
 * Decoder for delta coding: value[i] = value[i-1] + correction[i].
 */
class PredictionSchemeDeltaDecoder extends PredictionSchemeDecoder {
  constructor(attribute: PointAttribute, transform: PredictionSchemeDecodingTransform) {
    super(attribute, transform)
  }

  override isInitialized(): boolean {
    return true
  }

  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    size: number,
    numComponents: number,
    entryToPointIdMap: Int32Array,
  ): boolean {
    const transform = this._transform
    transform.init(numComponents)

    // Transforms that provide a fused loop (the canonicalized octahedral one,
    // hot for normals) run the whole delta chain in one call instead of one
    // virtual computeOriginalValue call per value.
    if (transform.computeOriginalValuesDelta) {
      transform.computeOriginalValuesDelta(inCorr, outData, size, numComponents)
      return true
    }

    // First element has an all-zero "predicted" value.
    const zeroVals = new Int32Array(numComponents)
    transform.computeOriginalValue(zeroVals, 0, inCorr, 0, outData, 0)

    // D(i) = D(i-1) + correction(i).
    for (let i = numComponents; i < size; i += numComponents) {
      transform.computeOriginalValue(outData, i - numComponents, inCorr, i, outData, i)
    }

    return true
  }
}

export { PredictionSchemeDeltaDecoder }
