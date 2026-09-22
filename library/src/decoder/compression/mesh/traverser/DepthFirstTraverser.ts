// Ported from draco.js src/compression/mesh/traverser/DepthFirstTraverser.js (MIT)

import { scratchInt32, scratchUint8Zeroed } from '../../../core/ScratchArena'

import type { MeshAttributeCornerTable } from '../../../mesh/MeshAttributeCornerTable'
import type { CornerTable } from '../MeshEdgebreakerDecoderImpl'
import type { MeshAttributeIndicesEncodingObserver } from './MeshAttributeIndicesEncodingObserver'

const kInvalidCornerIndex = -1
const kInvalidFaceIndex = -1
const kInvalidVertexIndex = -1

// DFS traversal of a mesh over the CornerTable.
class DepthFirstTraverser {
  _cornerTable: CornerTable | MeshAttributeCornerTable | null = null
  _observer: MeshAttributeIndicesEncodingObserver | null = null
  _isFaceVisited: Uint8Array | null = null
  _cornerTraversalStack: Int32Array | number[] = []
  _numVisitedFaces = 0
  // Identifies the traversal order for the shared traversal cache
  // (MESH_TRAVERSAL_DEPTH_FIRST). See MeshTraversalSequencer.
  _traversalMethodId = 0
  // The sequencer derives the point id sequence from the corner map after
  // the traversal (see traverseAll).
  emitsPointIds = false
  _cornerToVertex: Int32Array | number[] | null = null
  _oppositeCorners: Int32Array | number[] | null = null
  _vertexOnBoundary: Uint8Array | null = null
  _numCorners = 0
  // When set (see MeshTraversalSequencer.generateSequence), each new value's
  // parallelogram parents are recorded here as it is numbered: parents[3p ..
  // 3p+2] are the value ids of the vertices of the face opposite its corner,
  // or parents[3p] is -1 when that face is missing or has a vertex not
  // numbered yet -- exactly MeshPredictionSchemeData.parallelogramParents'
  // "parent decoded after it" test, since values are numbered in order.
  // The traversal has just touched those corners, so they are read hot.
  _parents: Int32Array | null = null

  init(cornerTable: CornerTable | MeshAttributeCornerTable, observer: MeshAttributeIndicesEncodingObserver): void {
    this._cornerTable = cornerTable
    this._observer = observer
    // Extract the corner table's connectivity as flat arrays once, so the
    // traversal reads them directly (via the monomorphic _* helpers below)
    // instead of dispatching through the corner table on every corner. The
    // corner table is one of two classes, so direct ct.vertex()/opposite()
    // calls in the hot loop are polymorphic and not inlined by the JIT.
    this._cornerToVertex = cornerTable.cornerToVertexArray()
    this._oppositeCorners = cornerTable.oppositeCornerArray()
    this._vertexOnBoundary = cornerTable.vertexOnBoundaryArray()
    this._numCorners = cornerTable.numCorners()
  }

  cornerTable(): CornerTable | MeshAttributeCornerTable | null {
    return this._cornerTable
  }

  // Scratch buffers are set up here rather than in init() so a shared-traversal
  // -cache hit — where generateSequence returns before any traversal — skips
  // this entirely, including the visited-flag zero-fill (worth ~0.5% on the
  // ~500-primitive manablade bundle, which shares attribute corner tables across
  // primitives). Uint8Array (0/1) instead of Array(bool): these flags are read
  // and written on every corner of the hottest decode loop (traverseAll).
  // Decode-scoped scratch: released in bulk at the end of the decode.
  onTraversalStart(): void {
    const cornerTable = this._cornerTable!
    this._isFaceVisited = scratchUint8Zeroed(cornerTable.numFaces())
    // No separate vertex-visited flags: the observer's vertexToEncodedMap is
    // -1-filled by MeshAttributeIndicesEncodingData.init and every visit
    // assigns a value index >= 0, so its sign doubles as the visited flag --
    // one fewer random-access array in the hottest loop.
    this._cornerTraversalStack = scratchInt32(this._numCorners)
  }

  // Traverses every face, seeding a new traversal at the first corner of each
  // face not yet reached. One function for the seeds and the walks they
  // start: a mesh cut into many pieces (small parts, or UV islands in an
  // attribute table) seeds a new walk every few faces, and a call per seed
  // would reload the whole traversal state each time.
  traverseAll(): boolean {
    const numFaces = this._cornerTable!.numFaces()
    const isFaceVisited = this._isFaceVisited!
    const observer = this._observer!
    const cornerToVertex = this._cornerToVertex!
    const oppositeCorners = this._oppositeCorners!
    const vertexOnBoundary = this._vertexOnBoundary!
    const stack = this._cornerTraversalStack
    let numVisitedFaces = this._numVisitedFaces

    // Inline observer.onNewVertexVisited: the two encoding-map writes per new
    // vertex, in the hottest decode loop; the counter is hoisted to a local and
    // written back on every return path below. The point id sequence is NOT
    // produced here: it is a pure function of the corner map (faces_ at each
    // recorded corner), so the sequencer gathers it afterwards in a plain loop
    // whose loads overlap, instead of one dependent faces_ read per new vertex
    // inside this traversal (see emitsPointIds / _generateSequenceInternal).
    const encodingData = observer._encodingData
    const encodedToCornerMap = observer._encodedToCornerMap
    const vertexToEncodedMap = observer._vertexToEncodedMap
    const parents = this._parents
    let numValues = encodingData.numValues

    for (let f = 0; f < numFaces && numVisitedFaces < numFaces; ++f) {
      if (isFaceVisited[f] !== 0) continue
      let cornerId = 3 * f
      let stackSize = 0
      stack[stackSize++] = cornerId

      // For the first face the other two corners may not be processed yet.
      const nextCorner = cornerId + 1
      const prevCorner = cornerId + 2
      const nextVert = cornerToVertex[nextCorner]
      const prevVert = cornerToVertex[prevCorner]
      if (nextVert === kInvalidVertexIndex || prevVert === kInvalidVertexIndex) {
        encodingData.numValues = numValues
        return false
      }
      if (vertexToEncodedMap[nextVert] < 0) {
        encodedToCornerMap[numValues] = nextCorner
        if (parents !== null)
          recordParents(parents, numValues, nextCorner, oppositeCorners, cornerToVertex, vertexToEncodedMap)
        vertexToEncodedMap[nextVert] = numValues++
      }
      if (vertexToEncodedMap[prevVert] < 0) {
        encodedToCornerMap[numValues] = prevCorner
        if (parents !== null)
          recordParents(parents, numValues, prevCorner, oppositeCorners, cornerToVertex, vertexToEncodedMap)
        vertexToEncodedMap[prevVert] = numValues++
      }

      // faceId and the corner's position within its face are carried together
      // through the loop: every corner reached below arrives with its face id
      // already computed, so `cornerId - 3 * faceId` replaces the `% 3` the
      // next/prev arithmetic would otherwise need on each of the loop's three
      // corner steps (integer division and modulus by 3 are several
      // instructions each, and this is the single hottest loop in the decoder).
      while (stackSize > 0) {
        cornerId = stack[stackSize - 1]
        let faceId = (cornerId / 3) | 0

        if (cornerId === kInvalidCornerIndex || isFaceVisited[faceId]) {
          stackSize--
          continue
        }

        while (true) {
          isFaceVisited[faceId] = 1
          numVisitedFaces++

          const vertId = cornerToVertex[cornerId]
          if (vertId === kInvalidVertexIndex) {
            encodingData.numValues = numValues
            return false
          }
          const faceBase = faceId * 3
          const nextCornerId = cornerId === faceBase + 2 ? faceBase : cornerId + 1
          if (vertexToEncodedMap[vertId] < 0) {
            encodedToCornerMap[numValues] = cornerId
            if (parents !== null)
              recordParents(parents, numValues, cornerId, oppositeCorners, cornerToVertex, vertexToEncodedMap)
            vertexToEncodedMap[vertId] = numValues++
            // C++ IsOnBoundary, precomputed per vertex (see
            // CornerTable._vertexOnBoundary). An out-of-range vertex yields
            // undefined here, which counts as a boundary, so the range check
            // needs no separate guard.
            if (vertexOnBoundary[vertId] === 0) {
              // Move to the right corner: opposite(next(cornerId)).
              cornerId = oppositeCorners[nextCornerId]
              faceId = (cornerId / 3) | 0
              continue
            }
          }

          // The current vertex has been already visited or it was on a boundary.
          const rightCornerId = oppositeCorners[nextCornerId]

          const prevCornerId = cornerId === faceBase ? faceBase + 2 : cornerId - 1
          const leftCornerId = oppositeCorners[prevCornerId]

          const rightFaceId = rightCornerId === kInvalidCornerIndex ? kInvalidFaceIndex : (rightCornerId / 3) | 0
          const leftFaceId = leftCornerId === kInvalidCornerIndex ? kInvalidFaceIndex : (leftCornerId / 3) | 0

          const isRightVisited = rightFaceId === kInvalidFaceIndex || isFaceVisited[rightFaceId]
          const isLeftVisited = leftFaceId === kInvalidFaceIndex || isFaceVisited[leftFaceId]

          if (isRightVisited) {
            if (isLeftVisited) {
              // Both neighbors visited: this branch ends.
              stackSize--
              break
            } else {
              cornerId = leftCornerId
              faceId = leftFaceId
            }
          } else {
            if (isLeftVisited) {
              cornerId = rightCornerId
              faceId = rightFaceId
            } else {
              // Both neighbors unvisited: continue left, push right to resume later.
              stack[stackSize - 1] = leftCornerId
              stack[stackSize++] = rightCornerId
              break
            }
          }
        }
      }
    }
    this._numVisitedFaces = numVisitedFaces
    encodingData.numValues = numValues
    return true
  }
}

// Records a new value's parallelogram parents (see DepthFirstTraverser._parents).
function recordParents(
  parents: Int32Array,
  value: number,
  corner: number,
  oppositeCorners: Int32Array | number[],
  cornerToVertex: Int32Array | number[],
  vertexToEncodedMap: Int32Array,
): void {
  const o = value * 3
  const oci = oppositeCorners[corner]
  if (oci < 0) {
    parents[o] = -1
    return
  }
  const rem = oci - ((oci / 3) | 0) * 3
  const a = vertexToEncodedMap[cornerToVertex[oci]]
  const b = vertexToEncodedMap[cornerToVertex[rem === 2 ? oci - 2 : oci + 1]]
  const c = vertexToEncodedMap[cornerToVertex[rem === 0 ? oci + 2 : oci - 1]]
  if ((a | b | c) < 0) {
    parents[o] = -1
  } else {
    parents[o] = a
    parents[o + 1] = b
    parents[o + 2] = c
  }
}

export { DepthFirstTraverser }
