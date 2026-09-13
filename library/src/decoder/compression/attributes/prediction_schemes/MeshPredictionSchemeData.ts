// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeData.js (MIT)

import type { MeshAttributeCornerTable } from '../../../mesh/MeshAttributeCornerTable'
import type { CornerTable } from '../../mesh/MeshEdgebreakerDecoderImpl'

/**
 * Stores mesh connectivity data and how it was encoded/decoded.
 */
class MeshPredictionSchemeData {
  cornerTable: CornerTable | MeshAttributeCornerTable
  vertexToDataMap: Int32Array
  dataToCornerMap: Int32Array

  constructor(
    cornerTable: CornerTable | MeshAttributeCornerTable,
    dataToCornerMap: Int32Array,
    vertexToDataMap: Int32Array,
  ) {
    this.cornerTable = cornerTable
    this.vertexToDataMap = vertexToDataMap
    this.dataToCornerMap = dataToCornerMap
  }
}

export { MeshPredictionSchemeData }
