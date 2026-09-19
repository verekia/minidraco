// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeData.js (MIT)

import { scratchInt32 } from '../../../core/ScratchArena'

import type { MeshAttributeCornerTable } from '../../../mesh/MeshAttributeCornerTable'
import type { CornerTable, MeshAttributeIndicesEncodingData } from '../../mesh/MeshEdgebreakerDecoderImpl'

/**
 * Stores mesh connectivity data and how it was encoded/decoded: the corner
 * table an attribute was traversed on and the traversal's encoding maps.
 */
class MeshPredictionSchemeData {
  cornerTable: CornerTable | MeshAttributeCornerTable
  _encodingData: MeshAttributeIndicesEncodingData

  constructor(cornerTable: CornerTable | MeshAttributeCornerTable, encodingData: MeshAttributeIndicesEncodingData) {
    this.cornerTable = cornerTable
    this._encodingData = encodingData
  }

  get vertexToDataMap(): Int32Array {
    return this._encodingData.vertexToEncodedAttributeValueIndexMap
  }

  get dataToCornerMap(): Int32Array {
    return this._encodingData.encodedAttributeValueIndexToCornerMap
  }

  // The parallelogram parents of every value: for value p, the data ids of
  // the opposite corner's vertex and of that face's next and prev vertices
  // (parents[3p .. 3p+2]), or -1 in parents[3p] when the value is not
  // parallelogram-predictable (no opposite face, or a parent decoded after
  // it). The scheme's per-value walk -- corner, opposite corner, three
  // vertices, three data ids: four dependent random reads -- is thus done
  // once per traversal and shared by every attribute predicted over it (a
  // position, a texture coordinate and a colour on one connectivity all use
  // it), and the prediction loops read it sequentially. Decode-scoped
  // scratch, cached on the traversal entry.
  parallelogramParents(): Int32Array {
    const entry = this._encodingData.cacheEntry
    if (entry !== null && entry.parents !== null) {
      return entry.parents
    }
    const table = this.cornerTable
    const oppositeCorners = table.oppositeCornerArray()
    const cornerToVertex = table.cornerToVertexArray()
    const vertexToDataMap = this.vertexToDataMap
    const dataToCornerMap = this.dataToCornerMap
    const numValues = dataToCornerMap.length
    const parents = scratchInt32(numValues * 3)
    if (numValues > 0) parents[0] = -1 // the first value is predicted from zero
    for (let p = 1, o = 3; p < numValues; ++p, o += 3) {
      const oci = oppositeCorners[dataToCornerMap[p]]
      if (oci < 0) {
        parents[o] = -1
        continue
      }
      const rem = oci - ((oci / 3) | 0) * 3
      const vertOpp = vertexToDataMap[cornerToVertex[oci]]
      const vertNext = vertexToDataMap[cornerToVertex[rem === 2 ? oci - 2 : oci + 1]]
      const vertPrev = vertexToDataMap[cornerToVertex[rem === 0 ? oci + 2 : oci - 1]]
      if (vertOpp < p && vertNext < p && vertPrev < p) {
        parents[o] = vertOpp
        parents[o + 1] = vertNext
        parents[o + 2] = vertPrev
      } else {
        parents[o] = -1
      }
    }
    if (entry !== null) entry.parents = parents
    return parents
  }
}

export { MeshPredictionSchemeData }
