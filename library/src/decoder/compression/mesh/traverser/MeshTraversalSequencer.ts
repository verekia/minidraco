// Ported from draco.js src/compression/mesh/traverser/MeshTraversalSequencer.js (MIT)

import { scratchInt32 } from '../../../core/ScratchArena'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { Mesh } from '../../../mesh/Mesh'
import type { MeshAttributeIndicesEncodingData } from '../MeshEdgebreakerDecoderImpl'
import type { DepthFirstTraverser } from './DepthFirstTraverser'
import type { MaxPredictionDegreeTraverser } from './MaxPredictionDegreeTraverser'

// Cached result of one traversal (see generateSequence below). indicesMap is
// filled in lazily by updatePointToAttributeIndexMapping: every attribute
// whose traversal resolved to this entry gets an identical point-to-value
// map, so the first one computed is shared by the rest (read-only downstream).
export type TraversalCacheEntry = {
  pointIds: Int32Array
  vertexMap: Int32Array
  cornerMap: Int32Array
  numValues: number
  indicesMap: Uint32Array | null
  // Filled in lazily by the first parallelogram-predicted attribute over
  // this traversal (see MeshPredictionSchemeData.parallelogramParents).
  parents: Int32Array | null
}

// Per-decode cache: corner-to-vertex array -> traversal method id -> result.
export type TraversalCache = Map<Int32Array | number[], Map<number, TraversalCacheEntry>>

// Sequencer that generates point sequence in an order given by a deterministic
// traversal on the mesh surface.
class MeshTraversalSequencer {
  _mesh: Mesh
  _encodingData: MeshAttributeIndicesEncodingData
  _traverser: DepthFirstTraverser | MaxPredictionDegreeTraverser | null = null
  _outPointIds: Int32Array = new Int32Array(0)
  _numOutPoints = 0
  // Per-decode cache, keyed by corner table, shared across the attribute
  // decoders of one mesh (see MeshEdgebreakerDecoderImpl).
  _traversalCache: TraversalCache
  // The cache entry the last generateSequence resolved to (hit or store);
  // carries the shared indicesMap.
  _cacheEntry: TraversalCacheEntry | null = null
  // One representative corner per point id, when the connectivity decoder
  // recorded them (see MeshEdgebreakerDecoderImpl._assignAttributeVerticesAndPoints).
  _pointCorner: Int32Array | null

  constructor(
    mesh: Mesh,
    encodingData: MeshAttributeIndicesEncodingData,
    traversalCache: TraversalCache,
    pointCorner: Int32Array | null,
  ) {
    this._mesh = mesh
    this._encodingData = encodingData
    this._traversalCache = traversalCache
    this._pointCorner = pointCorner
  }

  setTraverser(traverser: DepthFirstTraverser | MaxPredictionDegreeTraverser): void {
    this._traverser = traverser
  }

  generateSequence(): boolean {
    // A traversal's output (point order + encoding maps) depends only on the
    // corner table's connectivity AND the traversal method, not on the
    // attribute being decoded. Meshes with several vertex-mapped attributes
    // share one corner table, so reuse a previously computed result instead of
    // repeating the O(faces) traversal — but only for the same traversal
    // method, since different methods produce different orders.
    const cornerTable = this._traverser!.cornerTable()!
    const methodId = this._traverser!._traversalMethodId
    // Key the cache by the flat cornerToVertex array, not the corner-table
    // instance: attributes with identical seams share these arrays (via
    // adoptVertexRecompute) so they produce the same traversal, and within a
    // prim all attributes share faces_ -- so the cached point order/maps apply.
    const cacheKey = cornerTable.cornerToVertexArray()
    const encodingData = this._encodingData
    let byMethod = this._traversalCache.get(cacheKey)
    const cached = byMethod && byMethod.get(methodId)
    if (cached !== undefined) {
      this._outPointIds = cached.pointIds
      encodingData.adoptTraversalResult(cached)
      this._cacheEntry = cached
      return true
    }

    if (!this._generateSequenceInternal()) {
      return false
    }

    const numValues = encodingData.numValues
    if (numValues < encodingData.encodedAttributeValueIndexToCornerMap.length) {
      encodingData.encodedAttributeValueIndexToCornerMap = encodingData.encodedAttributeValueIndexToCornerMap.subarray(
        0,
        numValues,
      )
    }

    if (byMethod === undefined) {
      byMethod = new Map()
      this._traversalCache.set(cacheKey, byMethod)
    }
    const entry: TraversalCacheEntry = {
      pointIds: this._outPointIds,
      vertexMap: encodingData.vertexToEncodedAttributeValueIndexMap,
      cornerMap: encodingData.encodedAttributeValueIndexToCornerMap,
      numValues,
      indicesMap: null,
      parents: null,
    }
    byMethod.set(methodId, entry)
    encodingData.cacheEntry = entry
    this._cacheEntry = entry
    return true
  }

  getOutputPointIds(): Int32Array {
    return this._outPointIds
  }

  addPointId(pointId: number): void {
    this._outPointIds[this._numOutPoints++] = pointId
  }

  updatePointToAttributeIndexMapping(attribute: PointAttribute): boolean {
    // The map is a pure function of (faces_, cornerToVertex, vertexToAttEntry),
    // all fixed within one traversal-cache entry — every attribute that
    // resolved to the same entry gets an identical map, so share the first one
    // computed instead of re-walking every corner per attribute. The map is
    // read-only downstream (extractTo).
    const entry = this._cacheEntry
    if (entry !== null && entry.indicesMap !== null) {
      attribute.setExplicitMappingShared(entry.indicesMap)
      return true
    }

    const cornerTable = this._traverser!.cornerTable()!
    const numFaces = this._mesh.numFaces()
    const numPoints = this._mesh.numPoints()
    // Every point id appears in faces_ (points are created per-corner during
    // the connectivity decoder's point assignment), so the loops below write
    // every map entry.
    attribute.setExplicitMappingUnfilled(numPoints)
    const cornerToVertex = cornerTable.cornerToVertexArray()
    const vertexToAttEntry = this._encodingData.vertexToEncodedAttributeValueIndexMap
    const indicesMap = attribute.indicesMap
    const pointCorner = this._pointCorner
    if (pointCorner !== null) {
      // All corners of a point share its attribute vertex (that is what makes
      // them one point), so one representative corner per point gives the
      // same map as visiting every corner -- in a loop over the points
      // (typically a third to a half as many as there are corners), with
      // sequential writes.
      for (let p = 0; p < numPoints; ++p) {
        const vertId = cornerToVertex[pointCorner[p]]
        if (vertId < 0) {
          return false
        }
        const attEntryId = vertexToAttEntry[vertId]
        if (attEntryId >= numPoints) {
          return false
        }
        indicesMap[p] = attEntryId
      }
    } else {
      // Iterate corners directly over the flat connectivity arrays: the corner
      // table is one of two classes, so vertex()/cornerToPointId()/setPointMapEntry()
      // would all be polymorphic per corner. faces_[ci] is the corner's point id
      // and cornerToVertex[ci] its vertex; write straight into the indices map.
      const numCorners = numFaces * 3
      const faces = this._mesh.faces_
      for (let ci = 0; ci < numCorners; ++ci) {
        const vertId = cornerToVertex[ci]
        if (vertId < 0) {
          return false
        }
        const attEntryId = vertexToAttEntry[vertId]
        const pointId = faces[ci]
        if (pointId >= numPoints || attEntryId >= numPoints) {
          return false
        }
        indicesMap[pointId] = attEntryId
      }
    }
    if (entry !== null) {
      entry.indicesMap = attribute.indicesMap as Uint32Array
    }
    return true
  }

  _generateSequenceInternal(): boolean {
    this._numOutPoints = 0
    // Decode-scoped scratch: the point sequence feeds this primitive's
    // attribute decoders (and the per-decode traversal cache) and is dropped
    // when the decode ends. Entries are written before they are read, so the
    // pooled buffer's stale contents are never observed.
    this._outPointIds = scratchInt32(this._mesh.numPoints())

    const traverser = this._traverser!
    traverser.onTraversalStart()
    if (!traverser.traverseAll()) {
      return false
    }

    if (!traverser.emitsPointIds) {
      // The depth-first traverser records only the corner of each new vertex;
      // the point id at that corner is faces_[corner]. Gathering them here
      // gives the same sequence the observer would have appended, one entry
      // per value in encoding order.
      const numValues = this._encodingData.numValues
      const cornerMap = this._encodingData.encodedAttributeValueIndexToCornerMap
      const faces = this._mesh.faces_
      const outPointIds = this._outPointIds
      for (let i = 0; i < numValues; ++i) {
        outPointIds[i] = faces[cornerMap[i]]
      }
      this._numOutPoints = numValues
    }

    if (this._numOutPoints < this._outPointIds.length) {
      this._outPointIds = this._outPointIds.subarray(0, this._numOutPoints)
    }
    return true
  }
}

export { MeshTraversalSequencer }
