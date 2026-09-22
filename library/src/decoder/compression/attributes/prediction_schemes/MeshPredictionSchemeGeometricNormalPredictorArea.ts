// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeGeometricNormalPredictorArea.js (MIT)
// (which was ported from mesh_prediction_scheme_geometric_normal_predictor_area.h
// and mesh_prediction_scheme_geometric_normal_predictor_base.h)

import { scratchInt32 } from '../../../core/ScratchArena'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'

const UPPER_BOUND = 1 << 29

// Copies every entry's integer position into the flat Int32Array `cache` (the
// JS-port form of the C++ predictors' per-call GetPositionForDataId()). Shared
// with the portable tex-coord predictor; the caller owns the cache allocation.
// The position attribute is the positions' portable attribute: three int32
// components per value, packed from byte 0 (see
// SequentialIntegerAttributeDecoder.getPortableAttribute).
function fillInt32PositionCache(cache: Int32Array, att: PointAttribute, map: Int32Array, numEntries: number): void {
  const bytes = att.buffer!.data
  const src = new Int32Array(bytes.buffer, bytes.byteOffset, bytes.length >> 2)
  if (att.isMappingIdentity) {
    for (let d = 0, o = 0; d < numEntries; ++d, o += 3) {
      const s = map[d] * 3
      cache[o] = src[s]
      cache[o + 1] = src[s + 1]
      cache[o + 2] = src[s + 2]
    }
  } else {
    const indicesMap = att.indicesMap
    for (let d = 0, o = 0; d < numEntries; ++d, o += 3) {
      const s = indicesMap[map[d]] * 3
      cache[o] = src[s]
      cache[o + 1] = src[s + 1]
      cache[o + 2] = src[s + 2]
    }
  }
}

/**
 * Predictor that estimates the normal via the surrounding triangles of a
 * given corner, weighted by triangle area.
 *
 * The C++ predictor walks the corners around the value's vertex (in the
 * attribute's own corner table, so seams bound the walk) and sums, per
 * corner, the cross product of the two edges leaving it: twice the area
 * vector of that corner's face. That vector is the same from whichever
 * corner of the face it is taken, so instead of one ring walk per value
 * (every face visited once per corner, three times in all, each step a
 * dependent chase through the opposite corners) every face's vector is
 * computed once and added to the sums of its three corners' vertices: each
 * vertex then holds the sum over exactly the corners its walk would visit.
 * The sums are exact integers either way (the products stay below 2^53 for
 * any real position quantization, as the per-corner form already needs), so
 * the order they are added in does not matter.
 */
class MeshPredictionSchemeGeometricNormalPredictorArea {
  _posAttribute: PointAttribute | null = null
  _entryToPointIdMap: Int32Array | null = null
  _meshData: MeshPredictionSchemeData
  // Per value: the area-weighted normal sum of its vertex's faces.
  _normalSums: Float64Array | null = null

  constructor(meshData: MeshPredictionSchemeData) {
    this._meshData = meshData
  }

  setPositionAttribute(positionAttribute: PointAttribute): void {
    this._posAttribute = positionAttribute
  }

  setEntryToPointIdMap(map: Int32Array): void {
    this._entryToPointIdMap = map
  }

  // Sums every face's area vector into its corners' values (see above).
  computeNormalSums(numEntries: number): boolean {
    // Decode-scoped scratch, read by the face pass below only.
    const pos = scratchInt32(numEntries * 3)
    fillInt32PositionCache(pos, this._posAttribute!, this._entryToPointIdMap!, numEntries)
    const cornerToVertex = this._meshData.cornerTable.cornerToVertexArray()
    const vertexToDataMap = this._meshData.vertexToDataMap
    const sums = new Float64Array(numEntries * 3)
    const numCorners = cornerToVertex.length
    for (let c = 0; c < numCorners; c += 3) {
      const v0 = cornerToVertex[c]
      const v1 = cornerToVertex[c + 1]
      const v2 = cornerToVertex[c + 2]
      if ((v0 | v1 | v2) < 0) return false
      const o0 = vertexToDataMap[v0] * 3
      const o1 = vertexToDataMap[v1] * 3
      const o2 = vertexToDataMap[v2] * 3
      const x0 = pos[o0]
      const y0 = pos[o0 + 1]
      const z0 = pos[o0 + 2]
      const ax = pos[o1] - x0
      const ay = pos[o1 + 1] - y0
      const az = pos[o1 + 2] - z0
      const bx = pos[o2] - x0
      const by = pos[o2 + 1] - y0
      const bz = pos[o2 + 2] - z0
      const nx = ay * bz - az * by
      const ny = az * bx - ax * bz
      const nz = ax * by - ay * bx
      sums[o0] += nx
      sums[o0 + 1] += ny
      sums[o0 + 2] += nz
      sums[o1] += nx
      sums[o1 + 1] += ny
      sums[o1 + 2] += nz
      sums[o2] += nx
      sums[o2 + 1] += ny
      sums[o2 + 2] += nz
    }
    this._normalSums = sums
    return true
  }

  computePredictedValue(dataId: number, prediction: Int32Array): void {
    const sums = this._normalSums!
    let normalX = sums[dataId * 3]
    let normalY = sums[dataId * 3 + 1]
    let normalZ = sums[dataId * 3 + 2]
    // Clamp to int32 with int64 INTEGER division like C++: quotient floored,
    // each component truncated toward zero. Naive float division diverges for
    // UPPER_BOUND < absSum < 2*UPPER_BOUND, where C++ quotient is 1 (no change).
    const absSum = Math.abs(normalX) + Math.abs(normalY) + Math.abs(normalZ)
    if (absSum > UPPER_BOUND) {
      const quotient = Math.floor(absSum / UPPER_BOUND)
      normalX = Math.trunc(normalX / quotient)
      normalY = Math.trunc(normalY / quotient)
      normalZ = Math.trunc(normalZ / quotient)
    }

    prediction[0] = Math.trunc(normalX)
    prediction[1] = Math.trunc(normalY)
    prediction[2] = Math.trunc(normalZ)
  }
}

export { MeshPredictionSchemeGeometricNormalPredictorArea, fillInt32PositionCache }
