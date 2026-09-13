// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeConstrainedMultiParallelogramDecoder.js (MIT)

import { decodeVarint } from '../../../core/VarintDecoding'
import { RAnsBitDecoder } from '../../bit_coders/RAnsBitDecoder'
import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'
import { computeParallelogramPrediction } from './MeshPredictionSchemeParallelogramShared'

import type { DecoderBuffer } from '../../../core/DecoderBuffer'

const kInvalidCornerIndex = -1

const MAX_NUM_PARALLELOGRAMS = 4

/**
 * Decoder for the constrained multi-parallelogram encoder. Crease edge flags
 * determine which parallelograms to use.
 */
class MeshPredictionSchemeConstrainedMultiParallelogramDecoder extends MeshPredictionSchemeDecoder {
  // Crease edges stored per context (number of available parallelograms),
  // one list per context up to MAX_NUM_PARALLELOGRAMS.
  _isCreaseEdge: boolean[][] = [[], [], [], []]

  override decodePredictionData(buffer: DecoderBuffer): boolean {
    // Decode crease edge flags via rANS bit coder, one context per parallelogram count.
    for (let i = 0; i < MAX_NUM_PARALLELOGRAMS; ++i) {
      const numFlags = decodeVarint(buffer)
      if (numFlags === undefined) return false
      if (numFlags > this._meshData.cornerTable.numCorners()) return false
      if (numFlags > 0) {
        this._isCreaseEdge[i] = new Array<boolean>(numFlags)
        const decoder = new RAnsBitDecoder()
        if (!decoder.startDecoding(buffer)) return false
        for (let j = 0; j < numFlags; ++j) {
          this._isCreaseEdge[i][j] = decoder.decodeNextBit()
        }
        decoder.endDecoding()
      }
    }
    return super.decodePredictionData(buffer)
  }

  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean {
    this._transform.init(numComponents)

    // Predicted values for all simple parallelograms.
    const predVals: Int32Array[] = []
    for (let i = 0; i < MAX_NUM_PARALLELOGRAMS; ++i) {
      predVals.push(new Int32Array(numComponents))
    }

    this._transform.computeOriginalValue(predVals[0], 0, inCorr, 0, outData, 0)

    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array

    const isCreaseEdgePos = new Int32Array(MAX_NUM_PARALLELOGRAMS)
    const multiPredVals = new Int32Array(numComponents)

    const cornerMapSize = this._meshData.dataToCornerMap.length
    for (let p = 1; p < cornerMapSize; ++p) {
      const startCornerId = this._meshData.dataToCornerMap[p]
      let cornerId = startCornerId
      let numParallelograms = 0
      let firstPass = true

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
            predVals[numParallelograms],
          )
        ) {
          ++numParallelograms
          if (numParallelograms === MAX_NUM_PARALLELOGRAMS) break
        }

        // First swing left, then swing right from start if boundary hit.
        if (firstPass) {
          cornerId = table.swingLeft(cornerId)
        } else {
          cornerId = table.swingRight(cornerId)
        }
        if (cornerId === startCornerId) break
        if (cornerId === kInvalidCornerIndex && firstPass) {
          firstPass = false
          cornerId = table.swingRight(startCornerId)
        }
      }

      // Crease edge flags select which parallelograms contribute.
      let numUsedParallelograms = 0
      if (numParallelograms > 0) {
        for (let i = 0; i < numComponents; ++i) {
          multiPredVals[i] = 0
        }
        for (let i = 0; i < numParallelograms; ++i) {
          const context = numParallelograms - 1
          const pos = isCreaseEdgePos[context]++
          if (this._isCreaseEdge[context].length <= pos) return false
          const isCrease = this._isCreaseEdge[context][pos]
          if (!isCrease) {
            ++numUsedParallelograms
            for (let j = 0; j < numComponents; ++j) {
              multiPredVals[j] = (multiPredVals[j] + predVals[i][j]) | 0
            }
          }
        }
      }

      const dstOffset = p * numComponents
      if (numUsedParallelograms === 0) {
        const srcOffset = (p - 1) * numComponents
        this._transform.computeOriginalValue(outData, srcOffset, inCorr, dstOffset, outData, dstOffset)
      } else {
        for (let c = 0; c < numComponents; ++c) {
          multiPredVals[c] = (multiPredVals[c] / numUsedParallelograms) | 0
        }
        this._transform.computeOriginalValue(multiPredVals, 0, inCorr, dstOffset, outData, dstOffset)
      }
    }
    return true
  }
}

export { MeshPredictionSchemeConstrainedMultiParallelogramDecoder }
