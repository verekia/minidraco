// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeTexCoordsPortableDecoder.js (MIT)

import { RAnsBitDecoder } from '../../bit_coders/RAnsBitDecoder'
import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'
import { MeshPredictionSchemeTexCoordsPortablePredictor } from './MeshPredictionSchemeTexCoordsPortablePredictor'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../../core/DecoderBuffer'
import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'
import type { PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'

const GEOMETRY_ATTRIBUTE_POSITION = 0

/**
 * Decoder for UV coordinate predictions using the portable predictor; preferred
 * over the deprecated MeshPredictionSchemeTexCoordsDecoder.
 */
class MeshPredictionSchemeTexCoordsPortableDecoder extends MeshPredictionSchemeDecoder {
  _predictor: MeshPredictionSchemeTexCoordsPortablePredictor

  constructor(transform: PredictionSchemeDecodingTransform, meshData: MeshPredictionSchemeData) {
    super(transform, meshData)
    this._predictor = new MeshPredictionSchemeTexCoordsPortablePredictor(meshData)
  }

  override getNumParentAttributes(): number {
    return 1
  }

  override getParentAttributeType(_i: number): number {
    return GEOMETRY_ATTRIBUTE_POSITION
  }

  override setParentAttribute(att: PointAttribute): boolean {
    if (att.attributeType !== GEOMETRY_ATTRIBUTE_POSITION) return false
    if (att.numComponents !== 3) return false
    this._predictor.setPositionAttribute(att)
    return true
  }

  override decodePredictionData(buffer: DecoderBuffer): boolean {
    const numOrientations = buffer.decodeInt32()
    if (numOrientations === undefined || numOrientations < 0) return false

    this._predictor.resizeOrientations(numOrientations)
    let lastOrientation = true
    const decoder = new RAnsBitDecoder()
    if (!decoder.startDecoding(buffer)) return false
    for (let i = 0; i < numOrientations; ++i) {
      if (!decoder.decodeNextBit()) {
        lastOrientation = !lastOrientation
      }
      this._predictor.setOrientation(i, lastOrientation)
    }
    decoder.endDecoding()
    return super.decodePredictionData(buffer)
  }

  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    numComponents: number,
    entryToPointIdMap: Int32Array,
  ): boolean {
    // The portable predictor only handles 2-component UVs.
    if (numComponents !== 2) {
      return false
    }
    this._predictor.setEntryToPointIdMap(entryToPointIdMap)
    this._transform.init(numComponents)

    const cornerMapSize = this._meshData.dataToCornerMap.length
    // Cache integer positions once to avoid per-fetch mappedIndex + convertValue.
    this._predictor.buildPositionCache(cornerMapSize)
    for (let p = 0; p < cornerMapSize; ++p) {
      const cornerId = this._meshData.dataToCornerMap[p]
      if (!this._predictor.computePredictedValue(cornerId, outData, p)) {
        return false
      }

      const dstOffset = p * numComponents
      this._transform.computeOriginalValue(this._predictor.predictedValue, 0, inCorr, dstOffset, outData, dstOffset)
    }
    return true
  }
}

export { MeshPredictionSchemeTexCoordsPortableDecoder }
