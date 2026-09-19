// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeDecoderFactory.js (MIT)

import { PredictionSchemeMethod, PredictionSchemeTransformType } from '../../config/CompressionShared'
import { MeshPredictionSchemeConstrainedMultiParallelogramDecoder } from './MeshPredictionSchemeConstrainedMultiParallelogramDecoder'
import { MeshPredictionSchemeData } from './MeshPredictionSchemeData'
import { MeshPredictionSchemeGeometricNormalDecoder } from './MeshPredictionSchemeGeometricNormalDecoder'
import { MeshPredictionSchemeMultiParallelogramDecoder } from './MeshPredictionSchemeMultiParallelogramDecoder'
import { MeshPredictionSchemeParallelogramDecoder } from './MeshPredictionSchemeParallelogramDecoder'
import { MeshPredictionSchemeTexCoordsPortableDecoder } from './MeshPredictionSchemeTexCoordsPortableDecoder'
import { PredictionSchemeDeltaDecoder } from './PredictionSchemeDeltaDecoder'

import type { MeshDecoder } from '../../mesh/MeshDecoder'
import type { PointCloudDecoder } from '../../point_cloud/PointCloudDecoder'
import type { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'
import type { PredictionSchemeDecoder, PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'

function createMeshPredictionSchemeDecoder(
  method: number,
  transform: PredictionSchemeDecodingTransform,
  meshData: MeshPredictionSchemeData,
): MeshPredictionSchemeDecoder | null {
  const transformType = transform.getType()

  // Normal octahedron transforms only support geometric normal prediction.
  if (
    transformType === PredictionSchemeTransformType.PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED ||
    transformType === PredictionSchemeTransformType.PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON
  ) {
    if (method === PredictionSchemeMethod.MESH_PREDICTION_GEOMETRIC_NORMAL) {
      return new MeshPredictionSchemeGeometricNormalDecoder(transform, meshData)
    }
    return null
  }

  // The wrap transform pairs with the parallelogram and tex-coord schemes.
  // Geometric normal prediction needs the octahedral transform's quantization
  // bits, so (as in the C++ wrap dispatch) it is not offered here.
  switch (method) {
    case PredictionSchemeMethod.MESH_PREDICTION_PARALLELOGRAM:
      return new MeshPredictionSchemeParallelogramDecoder(transform, meshData)

    case PredictionSchemeMethod.MESH_PREDICTION_MULTI_PARALLELOGRAM:
      return new MeshPredictionSchemeMultiParallelogramDecoder(transform, meshData)

    case PredictionSchemeMethod.MESH_PREDICTION_CONSTRAINED_MULTI_PARALLELOGRAM:
      return new MeshPredictionSchemeConstrainedMultiParallelogramDecoder(transform, meshData)

    case PredictionSchemeMethod.MESH_PREDICTION_TEX_COORDS_PORTABLE:
      return new MeshPredictionSchemeTexCoordsPortableDecoder(transform, meshData)

    default:
      return null
  }
}

/**
 * Creates a prediction scheme for a decoder and method. If the method is
 * mesh-based and mesh data is available, builds the matching mesh scheme;
 * otherwise falls back to a delta decoder.
 */
function createPredictionSchemeForDecoder(
  method: number,
  attId: number,
  decoder: PointCloudDecoder,
  transform: PredictionSchemeDecodingTransform,
): PredictionSchemeDecoder | null {
  if (method === PredictionSchemeMethod.PREDICTION_NONE) {
    return null
  }

  // Only mesh decoders exist (Decode.ts accepts triangular meshes only).
  const meshDecoder = decoder as MeshDecoder
  const cornerTable = meshDecoder.getCornerTable()
  const encodingData = meshDecoder.getAttributeEncodingData(attId)

  if (cornerTable !== null && encodingData !== null) {
    // Attributes with their own seams use their attribute corner table.
    const attCornerTable = meshDecoder.getAttributeCornerTable(attId)
    const meshData = new MeshPredictionSchemeData(attCornerTable !== null ? attCornerTable : cornerTable, encodingData)
    const ret = createMeshPredictionSchemeDecoder(method, transform, meshData)
    if (ret !== null) return ret
  }
  return new PredictionSchemeDeltaDecoder(transform)
}

export { createPredictionSchemeForDecoder }
