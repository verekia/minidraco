// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeMultiParallelogramDecoder.js (MIT)

import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'
import { computeParallelogramPrediction } from './MeshPredictionSchemeParallelogramShared'

const kInvalidCornerIndex = -1

/**
 * Decoder for the multi-parallelogram scheme: parallelogram predictions around
 * a vertex are averaged to produce the final prediction.
 */
class MeshPredictionSchemeMultiParallelogramDecoder extends MeshPredictionSchemeDecoder {
  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean {
    this._transform.init(numComponents)

    const predVals = new Int32Array(numComponents)
    const parallelogramPredVals = new Int32Array(numComponents)

    // First value: predicted = 0.
    this._transform.computeOriginalValue(predVals, 0, inCorr, 0, outData, 0)

    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array
    const cornerMapSize = this._meshData.dataToCornerMap.length

    for (let p = 1; p < cornerMapSize; ++p) {
      const startCornerId = this._meshData.dataToCornerMap[p]
      let cornerId = startCornerId
      let numParallelograms = 0

      for (let i = 0; i < numComponents; ++i) {
        predVals[i] = 0
      }

      while (cornerId !== kInvalidCornerIndex) {
        if (
          computeParallelogramPrediction(
            p,
            cornerId,
            oppositeCorners,
            cornerToVertex,
            vertexToDataMap,
            outData,
            numComponents,
            parallelogramPredVals,
          )
        ) {
          for (let c = 0; c < numComponents; ++c) {
            predVals[c] = (predVals[c] + parallelogramPredVals[c]) | 0
          }
          ++numParallelograms
        }

        cornerId = table.swingRight(cornerId)
        if (cornerId === startCornerId) {
          cornerId = kInvalidCornerIndex
        }
      }

      const dstOffset = p * numComponents
      if (numParallelograms === 0) {
        // No valid parallelogram. Use delta from previous point.
        const srcOffset = (p - 1) * numComponents
        this._transform.computeOriginalValue(outData, srcOffset, inCorr, dstOffset, outData, dstOffset)
      } else {
        // Average the parallelogram predictions.
        for (let c = 0; c < numComponents; ++c) {
          predVals[c] = (predVals[c] / numParallelograms) | 0
        }
        this._transform.computeOriginalValue(predVals, 0, inCorr, dstOffset, outData, dstOffset)
      }
    }
    return true
  }
}

export { MeshPredictionSchemeMultiParallelogramDecoder }
