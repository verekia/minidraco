// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeDecoder.js (MIT)

import { PredictionSchemeDecoder, type PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'

import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'

/**
 * Base class for mesh prediction scheme decoders that use mesh connectivity.
 * C++ templates this on MeshDataT; here meshData is a constructor param.
 */
class MeshPredictionSchemeDecoder extends PredictionSchemeDecoder {
  _meshData: MeshPredictionSchemeData

  constructor(transform: PredictionSchemeDecodingTransform, meshData: MeshPredictionSchemeData) {
    super(transform)
    this._meshData = meshData
  }
}

export { MeshPredictionSchemeDecoder }
