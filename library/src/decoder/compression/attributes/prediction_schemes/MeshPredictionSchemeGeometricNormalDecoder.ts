// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeGeometricNormalDecoder.js (MIT)

import { RAnsBitDecoder } from '../../bit_coders/RAnsBitDecoder'
import { OctahedronToolBox } from '../NormalCompressionUtils'
import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'
import { MeshPredictionSchemeGeometricNormalPredictorArea } from './MeshPredictionSchemeGeometricNormalPredictorArea'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../../core/DecoderBuffer'
import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'
import type { PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'

const GEOMETRY_ATTRIBUTE_POSITION = 0

/**
 * Decoder for geometric normal prediction. Predicts normals using the
 * surrounding triangle geometry, then converts to octahedral coordinates.
 */
class MeshPredictionSchemeGeometricNormalDecoder extends MeshPredictionSchemeDecoder {
  _predictor: MeshPredictionSchemeGeometricNormalPredictorArea
  _octahedronToolBox = new OctahedronToolBox()
  _flipNormalBitDecoder = new RAnsBitDecoder()

  constructor(transform: PredictionSchemeDecodingTransform, meshData: MeshPredictionSchemeData) {
    super(transform, meshData)
    this._predictor = new MeshPredictionSchemeGeometricNormalPredictorArea(meshData)
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
    if (!this._transform.decodeTransformData(buffer)) return false

    return this._flipNormalBitDecoder.startDecoding(buffer)
  }

  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    _numComponents: number,
    entryToPointIdMap: Int32Array,
  ): boolean {
    // Only the octahedral transforms reach this scheme (see the factory).
    this._octahedronToolBox.setQuantizationBits(this._transform.quantizationBits!())
    this._predictor.setEntryToPointIdMap(entryToPointIdMap)

    const cornerMapSize = this._meshData.dataToCornerMap.length

    // Every value's area-weighted normal, in one pass over the faces.
    if (!this._predictor.computeNormalSums(cornerMapSize)) return false

    const predNormal3D = new Int32Array(3)
    const predNormalOct = new Int32Array(2)

    for (let dataId = 0; dataId < cornerMapSize; ++dataId) {
      this._predictor.computePredictedValue(dataId, predNormal3D)

      this._octahedronToolBox.canonicalizeIntegerVector(predNormal3D)

      if (this._flipNormalBitDecoder.decodeNextBit()) {
        predNormal3D[0] = -predNormal3D[0]
        predNormal3D[1] = -predNormal3D[1]
        predNormal3D[2] = -predNormal3D[2]
      }

      this._octahedronToolBox.integerVectorToQuantizedOctahedralCoords(predNormal3D, predNormalOct)

      const dataOffset = dataId * 2
      this._transform.computeOriginalValue(predNormalOct, 0, inCorr, dataOffset, outData, dataOffset)
    }

    this._flipNormalBitDecoder.endDecoding()
    return true
  }
}

export { MeshPredictionSchemeGeometricNormalDecoder }
