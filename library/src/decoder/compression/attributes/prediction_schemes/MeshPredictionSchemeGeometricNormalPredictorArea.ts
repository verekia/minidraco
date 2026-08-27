// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeGeometricNormalPredictorArea.js (MIT)
// (which was ported from mesh_prediction_scheme_geometric_normal_predictor_area.h
// and mesh_prediction_scheme_geometric_normal_predictor_base.h)

import { DataType } from '../../../core/DracoTypes'
import { scratchInt32 } from '../../../core/ScratchArena'
import { NormalPredictionMode } from '../../config/CompressionShared'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'

const UPPER_BOUND = 1 << 29

// Precompute every entry's integer position into a flat Int32Array (the JS-port
// form of the C++ predictor's per-call GetPositionForDataId()).
function buildInt32PositionCache(
  att: PointAttribute,
  map: Int32Array,
  numEntries: number,
  tempPos: number[],
): Int32Array {
  // Decode-scoped scratch: consumed by this attribute's prediction pass.
  const cache = scratchInt32(numEntries * 3)
  const bufData = att.buffer && att.buffer.data

  if (att.dataType === DataType.INT32 && att.numComponents === 3 && bufData) {
    const src = new Int32Array(bufData.buffer)
    const srcStart = (bufData.byteOffset + att.byteOffset) >> 2
    const stride = att.byteStride >> 2
    const isIdentity = att.isMappingIdentity
    const indicesMap = att.indicesMap
    if (isIdentity) {
      for (let d = 0; d < numEntries; ++d) {
        const srcOffset = srcStart + map[d] * stride
        const o = d * 3
        cache[o] = src[srcOffset]
        cache[o + 1] = src[srcOffset + 1]
        cache[o + 2] = src[srcOffset + 2]
      }
    } else {
      for (let d = 0; d < numEntries; ++d) {
        const srcOffset = srcStart + indicesMap[map[d]] * stride
        const o = d * 3
        cache[o] = src[srcOffset]
        cache[o + 1] = src[srcOffset + 1]
        cache[o + 2] = src[srcOffset + 2]
      }
    }
  } else {
    for (let d = 0; d < numEntries; ++d) {
      att.convertValue(att.mappedIndex(map[d]), tempPos)
      const o = d * 3
      cache[o] = tempPos[0]
      cache[o + 1] = tempPos[1]
      cache[o + 2] = tempPos[2]
    }
  }
  return cache
}

/**
 * Predictor that estimates the normal via the surrounding triangles of a
 * given corner, weighted by triangle area.
 */
class MeshPredictionSchemeGeometricNormalPredictorArea {
  _posAttribute: PointAttribute | null
  _entryToPointIdMap: Int32Array | null
  _meshData: MeshPredictionSchemeData
  _normalPredictionMode: number
  _tempPos: number[]
  _posCache: Int32Array | null
  _cornerToVertex: Int32Array | null
  _oppositeCorners: Int32Array | null
  _cornerToOffset: Int32Array | null

  constructor(meshData: MeshPredictionSchemeData) {
    this._posAttribute = null
    this._entryToPointIdMap = null
    this._meshData = meshData
    this._normalPredictionMode = NormalPredictionMode.TRIANGLE_AREA
    this._tempPos = new Array(3)
    this._posCache = null // flat Int32 positions, indexed by data id
    this._cornerToVertex = null
    this._oppositeCorners = null
    this._cornerToOffset = null // corner -> posCache offset, precomputed
  }

  setPositionAttribute(positionAttribute: PointAttribute): void {
    this._posAttribute = positionAttribute
  }

  setEntryToPointIdMap(map: Int32Array): void {
    this._entryToPointIdMap = map
  }

  isInitialized(): boolean {
    return this._posAttribute !== null && this._entryToPointIdMap !== null
  }

  setNormalPredictionMode(mode: number): boolean {
    if (mode === NormalPredictionMode.ONE_TRIANGLE || mode === NormalPredictionMode.TRIANGLE_AREA) {
      this._normalPredictionMode = mode
      return true
    }
    return false
  }

  buildPositionCache(numEntries: number): void {
    this._posCache = buildInt32PositionCache(this._posAttribute!, this._entryToPointIdMap!, numEntries, this._tempPos)
    const table = this._meshData.cornerTable
    this._cornerToVertex = table.cornerToVertexArray() as Int32Array
    this._oppositeCorners = table.oppositeCornerArray() as Int32Array
    // Precompute corner -> posCache offset once so the ring walk folds the
    // vertexToDataMap[cornerToVertex[c]]*3 double indirection into one load.
    const cornerToVertex = this._cornerToVertex
    const vertexToDataMap = this._meshData.vertexToDataMap
    const nc = cornerToVertex.length
    const c2o = scratchInt32(nc)
    for (let c = 0; c < nc; ++c) {
      const v = cornerToVertex[c]
      c2o[c] = v < 0 ? -1 : vertexToDataMap[v] * 3
    }
    this._cornerToOffset = c2o
  }

  computePredictedValue(cornerId: number, prediction: Int32Array): void {
    const oppositeCorners = this._oppositeCorners!
    const cornerToOffset = this._cornerToOffset!
    const posCache = this._posCache!
    const centerOffset = cornerToOffset[cornerId]
    const centX = posCache[centerOffset]
    const centY = posCache[centerOffset + 1]
    const centZ = posCache[centerOffset + 2]

    let normalX = 0,
      normalY = 0,
      normalZ = 0

    if (this._normalPredictionMode === NormalPredictionMode.ONE_TRIANGLE) {
      const rem = cornerId - ((cornerId / 3) | 0) * 3
      const cNext = rem === 2 ? cornerId - 2 : cornerId + 1
      const cPrev = rem === 0 ? cornerId + 2 : cornerId - 1
      let posOffset = cornerToOffset[cNext]
      const nextX = posCache[posOffset]
      const nextY = posCache[posOffset + 1]
      const nextZ = posCache[posOffset + 2]
      posOffset = cornerToOffset[cPrev]
      const prevX = posCache[posOffset]
      const prevY = posCache[posOffset + 1]
      const prevZ = posCache[posOffset + 2]

      const dNextX = nextX - centX
      const dNextY = nextY - centY
      const dNextZ = nextZ - centZ
      const dPrevX = prevX - centX
      const dPrevY = prevY - centY
      const dPrevZ = prevZ - centZ

      normalX = dNextY * dPrevZ - dNextZ * dPrevY
      normalY = dNextZ * dPrevX - dNextX * dPrevZ
      normalZ = dNextX * dPrevY - dNextY * dPrevX
    } else {
      // TRIANGLE_AREA: visit every corner around the vertex like C++
      // VertexCornersIterator -- swing LEFT to a boundary/full loop, then (only
      // if an open boundary was hit) swing RIGHT for the other side. Right-only
      // would drop triangles left of the start corner on boundary vertices.
      let currentCorner = cornerId
      let leftTraversal = true

      while (currentCorner >= 0) {
        const rem = currentCorner - ((currentCorner / 3) | 0) * 3
        const cNext = rem === 2 ? currentCorner - 2 : currentCorner + 1
        const cPrev = rem === 0 ? currentCorner + 2 : currentCorner - 1
        let posOffset = cornerToOffset[cNext]
        const nextX = posCache[posOffset]
        const nextY = posCache[posOffset + 1]
        const nextZ = posCache[posOffset + 2]
        posOffset = cornerToOffset[cPrev]
        const prevX = posCache[posOffset]
        const prevY = posCache[posOffset + 1]
        const prevZ = posCache[posOffset + 2]

        const dNextX = nextX - centX
        const dNextY = nextY - centY
        const dNextZ = nextZ - centZ
        const dPrevX = prevX - centX
        const dPrevY = prevY - centY
        const dPrevZ = prevZ - centZ

        normalX += dNextY * dPrevZ - dNextZ * dPrevY
        normalY += dNextZ * dPrevX - dNextX * dPrevZ
        normalZ += dNextX * dPrevY - dNextY * dPrevX

        // Advance like VertexCornersIterator::Next().
        if (leftTraversal) {
          const opp = oppositeCorners[cNext]
          if (opp < 0) {
            currentCorner = -1
          } else {
            const oppRem = opp - ((opp / 3) | 0) * 3
            currentCorner = oppRem === 2 ? opp - 2 : opp + 1
          }
          if (currentCorner < 0) {
            // Open boundary reached; cover the other side from the start.
            const startRem = cornerId - ((cornerId / 3) | 0) * 3
            const startPrev = startRem === 0 ? cornerId + 2 : cornerId - 1
            const startOpp = oppositeCorners[startPrev]
            if (startOpp < 0) {
              currentCorner = -1
            } else {
              const startOppRem = startOpp - ((startOpp / 3) | 0) * 3
              currentCorner = startOppRem === 0 ? startOpp + 2 : startOpp - 1
            }
            leftTraversal = false
          } else if (currentCorner === cornerId) {
            // Returned to the start: full ring visited.
            currentCorner = -1
          }
        } else {
          const opp = oppositeCorners[cPrev]
          if (opp < 0) {
            currentCorner = -1
          } else {
            const oppRem = opp - ((opp / 3) | 0) * 3
            currentCorner = oppRem === 0 ? opp + 2 : opp - 1
          }
        }
      }
    }

    // Clamp to int32 with int64 INTEGER division like C++: quotient floored,
    // each component truncated toward zero. Naive float division diverges for
    // UPPER_BOUND < absSum < 2*UPPER_BOUND, where C++ quotient is 1 (no change).
    let absSum
    if (this._normalPredictionMode === NormalPredictionMode.ONE_TRIANGLE) {
      // C++ casts AbsSum() to int32_t before the comparison in this branch.
      absSum = (Math.abs(normalX) + Math.abs(normalY) + Math.abs(normalZ)) | 0
    } else {
      absSum = Math.abs(normalX) + Math.abs(normalY) + Math.abs(normalZ)
    }
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

export { MeshPredictionSchemeGeometricNormalPredictorArea }
