// Ported from draco.js src/mesh/MeshAttributeCornerTable.js (MIT)

import { scratchInt32 } from '../core/ScratchArena'

import type { CornerTable } from '../compression/mesh/MeshEdgebreakerDecoderImpl'

const kInvalidCornerIndex = -1
const kInvalidVertexIndex = -1

class MeshAttributeCornerTable {
  is_edge_on_seam_: Uint8Array | number[]
  is_vertex_on_seam_: Uint8Array | number[]
  no_interior_seams_: boolean
  corner_to_vertex_map_: Int32Array | number[]
  vertex_to_left_most_corner_map_: Int32Array | number[]
  vertex_to_attribute_entry_id_map_: Int32Array | number[]
  corner_table_: CornerTable | null
  // Lazily built; see oppositeCornerArray.
  _effectiveOpposite: Int32Array | null
  // Every corner passed to addSeamEdge (may contain duplicates); lets
  // oppositeCornerArray patch seams without scanning every corner's flag.
  _seamCorners: number[]

  constructor() {
    this.is_edge_on_seam_ = []
    this.is_vertex_on_seam_ = []
    this.no_interior_seams_ = true
    this.corner_to_vertex_map_ = []
    this.vertex_to_left_most_corner_map_ = []
    this.vertex_to_attribute_entry_id_map_ = []
    this.corner_table_ = null
    this._effectiveOpposite = null
    this._seamCorners = []
  }

  initEmpty(table: CornerTable | null): boolean {
    if (table === null) {
      return false
    }
    // Typed arrays keep the per-corner hot accessors monomorphic. Uint8Array
    // defaults to 0 (== false); corner_to_vertex_map_ uses a signed -1 sentinel.
    this.is_edge_on_seam_ = new Uint8Array(table.numCorners())
    this.is_vertex_on_seam_ = new Uint8Array(table.numVertices())
    this.corner_to_vertex_map_ = new Int32Array(table.numCorners()).fill(kInvalidVertexIndex)
    this.vertex_to_attribute_entry_id_map_ = []
    this.vertex_to_left_most_corner_map_ = []
    // Lazily built; see oppositeCornerArray.
    this._effectiveOpposite = null
    this._seamCorners = []
    this.corner_table_ = table
    this.no_interior_seams_ = true
    return true
  }

  addSeamEdge(c: number): void {
    const cornerToVertex = this.corner_table_!.cornerToVertexArray()
    const oppositeCorners = this.corner_table_!.oppositeCornerArray()
    const isEdge = this.is_edge_on_seam_
    const isVert = this.is_vertex_on_seam_

    isEdge[c] = 1
    this._seamCorners.push(c)
    // Inlined next(c)/previous(c).
    let rem = c - ((c / 3) | 0) * 3
    isVert[cornerToVertex[rem === 2 ? c - 2 : c + 1]] = 1
    isVert[cornerToVertex[rem === 0 ? c + 2 : c - 1]] = 1

    const oppCorner = oppositeCorners[c]
    if (oppCorner !== kInvalidCornerIndex) {
      this.no_interior_seams_ = false
      isEdge[oppCorner] = 1
      this._seamCorners.push(oppCorner)
      rem = oppCorner - ((oppCorner / 3) | 0) * 3
      isVert[cornerToVertex[rem === 2 ? oppCorner - 2 : oppCorner + 1]] = 1
      isVert[cornerToVertex[rem === 0 ? oppCorner + 2 : oppCorner - 1]] = 1
    }
  }

  recomputeVertices(_cornerTable?: unknown, _vertexIds?: unknown): boolean {
    return this._recomputeVerticesInternal()
  }

  // Only the C++ RecomputeVertices(nullptr, nullptr) path: the decoder always
  // rebuilds the attribute-vertex maps from connectivity alone.
  _recomputeVerticesInternal(): boolean {
    const ct = this.corner_table_!
    const numCorners = ct.numCorners()
    const numBaseVertices = ct.numVertices()
    // Preallocate leftMostMap by new-vertex id (new-vertex count <= numCorners).
    const leftMostMap = new Int32Array(numCorners)
    const cornerToVertex = this.corner_to_vertex_map_
    const isVertexOnSeam = this.is_vertex_on_seam_
    const isEdgeOnSeam = this.is_edge_on_seam_
    // Flat connectivity arrays so the per-corner swings inline to typed-array
    // arithmetic instead of polymorphic dispatch.
    //   - seamOpp: seam-aware opposite (== this.opposite), used by swingLeft.
    //   - baseOpp: raw opposite of the underlying table, used by swingRight
    //     (matches corner_table_.swingRight, which is NOT seam-aware here).
    // Both are final: all seams were added before recomputeVertices() runs.
    const seamOpp = this.oppositeCornerArray()
    const baseOpp = ct.oppositeCornerArray()
    const vertexLeftmost = ct.vertexLeftmostCornerArray()
    let numNewVertices = 0

    for (let v = 0; v < numBaseVertices; ++v) {
      const c = vertexLeftmost[v]
      if (c === kInvalidCornerIndex) continue

      if (!isVertexOnSeam[v]) {
        const firstVertId = numNewVertices++
        leftMostMap[firstVertId] = c
        cornerToVertex[c] = firstVertId

        let pv = c % 3 === 0 ? c + 2 : c - 1
        let bopp = baseOpp[pv]
        let actC = bopp < 0 ? kInvalidCornerIndex : bopp % 3 === 0 ? bopp + 2 : bopp - 1
        while (actC !== kInvalidCornerIndex && actC !== c) {
          cornerToVertex[actC] = firstVertId
          pv = actC % 3 === 0 ? actC + 2 : actC - 1
          bopp = baseOpp[pv]
          actC = bopp < 0 ? kInvalidCornerIndex : bopp % 3 === 0 ? bopp + 2 : bopp - 1
        }
      } else {
        let firstVertId = numNewVertices++

        let firstC = c
        let actC: number

        let nx = firstC % 3 === 2 ? firstC - 2 : firstC + 1
        let opp = seamOpp[nx]
        actC = opp < 0 ? kInvalidCornerIndex : opp % 3 === 2 ? opp - 2 : opp + 1
        while (actC !== kInvalidCornerIndex) {
          firstC = actC
          nx = firstC % 3 === 2 ? firstC - 2 : firstC + 1
          opp = seamOpp[nx]
          actC = opp < 0 ? kInvalidCornerIndex : opp % 3 === 2 ? opp - 2 : opp + 1
          if (actC === c) return false
        }

        cornerToVertex[firstC] = firstVertId
        leftMostMap[firstVertId] = firstC

        let pv = firstC % 3 === 0 ? firstC + 2 : firstC - 1
        let bopp = baseOpp[pv]
        actC = bopp < 0 ? kInvalidCornerIndex : bopp % 3 === 0 ? bopp + 2 : bopp - 1
        while (actC !== kInvalidCornerIndex && actC !== firstC) {
          const nAct = actC % 3 === 2 ? actC - 2 : actC + 1
          if (isEdgeOnSeam[nAct]) {
            firstVertId = numNewVertices++
            leftMostMap[firstVertId] = actC
          }
          cornerToVertex[actC] = firstVertId
          pv = actC % 3 === 0 ? actC + 2 : actC - 1
          bopp = baseOpp[pv]
          actC = bopp < 0 ? kInvalidCornerIndex : bopp % 3 === 0 ? bopp + 2 : bopp - 1
        }
      }
    }

    // vertex_to_attribute_entry_id_map_ is only read for its length (numVertices()).
    this.vertex_to_attribute_entry_id_map_ = new Int32Array(numNewVertices)
    // subarray, not copy: exact-length view so accessors see the right length.
    this.vertex_to_left_most_corner_map_ = leftMostMap.subarray(0, numNewVertices)

    return true
  }

  isCornerOppositeToSeamEdge(corner: number): number {
    return this.is_edge_on_seam_[corner]
  }

  opposite(corner: number): number {
    if (corner === kInvalidCornerIndex || this.isCornerOppositeToSeamEdge(corner)) {
      return kInvalidCornerIndex
    }
    return this.corner_table_!.opposite(corner)
  }

  next(corner: number): number {
    return this.corner_table_!.next(corner)
  }

  previous(corner: number): number {
    return this.corner_table_!.previous(corner)
  }

  swingRight(corner: number): number {
    return this.previous(this.opposite(this.previous(corner)))
  }

  swingLeft(corner: number): number {
    return this.next(this.opposite(this.next(corner)))
  }

  numVertices(): number {
    return this.vertex_to_attribute_entry_id_map_.length
  }

  numFaces(): number {
    return this.corner_table_!.numFaces()
  }

  numCorners(): number {
    return this.corner_table_!.numCorners()
  }

  vertex(corner: number): number {
    return this.confidentVertex(corner)
  }

  confidentVertex(corner: number): number {
    return this.corner_to_vertex_map_[corner]
  }

  leftMostCorner(v: number): number {
    return this.vertex_to_left_most_corner_map_[v]
  }

  face(corner: number): number {
    // The minimal decoder CornerTable does not implement face(); this delegating
    // method is kept (unused by the decoder) exactly like the source.
    return (this.corner_table_ as unknown as { face(corner: number): number }).face(corner)
  }

  firstCorner(faceIndex: number): number {
    return (this.corner_table_ as unknown as { firstCorner(faceIndex: number): number }).firstCorner(faceIndex)
  }

  allCorners(faceIndex: number): number[] {
    return (this.corner_table_ as unknown as { allCorners(faceIndex: number): number[] }).allCorners(faceIndex)
  }

  // --- Flat-array accessors: let DepthFirstTraverser avoid per-corner dispatch. ---

  cornerToVertexArray(): Int32Array | number[] {
    return this.corner_to_vertex_map_
  }

  // Seam-aware opposite corners (seam edges -> -1), matching opposite(). Cached on
  // first use; seams and connectivity are finalized before traversal, so it's stable.
  oppositeCornerArray(): Int32Array {
    if (this._effectiveOpposite === null) {
      const nc = this.corner_table_!.numCorners()
      const base = this.corner_table_!.oppositeCornerArray()
      const seamCorners = this._seamCorners
      if (seamCorners.length === 0) {
        // No seams: the base connectivity is already correct, share it.
        // (It is read-only after connectivity decoding.)
        this._effectiveOpposite = base
      } else {
        // Bulk-copy the base opposites, then punch out only the seam edges: a
        // memcpy plus a sparse fix-up beats a per-corner ct.opposite()
        // dispatch loop (this build was ~10% of total decode time). The copy
        // lives in decode-scoped scratch — this table (and the traversal
        // cache entries that may share it) never outlives the decode.
        const eff = scratchInt32(nc)
        eff.set(base.length === nc ? base : base.subarray(0, nc))
        for (let i = 0, l = seamCorners.length; i < l; ++i) {
          eff[seamCorners[i]] = kInvalidCornerIndex
        }
        this._effectiveOpposite = eff
      }
    }
    return this._effectiveOpposite
  }

  vertexLeftmostCornerArray(): Int32Array | number[] {
    return this.vertex_to_left_most_corner_map_
  }

  // Per-base-vertex seam flag (Uint8Array); exposed so hot dedup loops inline the lookup.
  vertexOnSeamArray(): Uint8Array | number[] {
    return this.is_vertex_on_seam_
  }

  hasSameSeams(other: MeshAttributeCornerTable | null | undefined): boolean {
    if (other === null || other === undefined) return false
    const seamA = this.is_edge_on_seam_
    const seamB = other.is_edge_on_seam_
    if (seamA.length !== seamB.length) return false
    for (let i = 0, l = seamA.length; i < l; ++i) {
      if (seamA[i] !== seamB[i]) return false
    }
    return true
  }

  adoptVertexRecompute(other: MeshAttributeCornerTable): void {
    this.corner_to_vertex_map_ = other.corner_to_vertex_map_
    this.vertex_to_attribute_entry_id_map_ = other.vertex_to_attribute_entry_id_map_
    this.vertex_to_left_most_corner_map_ = other.vertex_to_left_most_corner_map_
    this.no_interior_seams_ = other.no_interior_seams_
    this._effectiveOpposite = other._effectiveOpposite
    this._seamCorners = other._seamCorners
  }

  isDegenerated(faceIndex: number): boolean {
    return (this.corner_table_ as unknown as { isDegenerated(faceIndex: number): boolean }).isDegenerated(faceIndex)
  }
}

export { MeshAttributeCornerTable }
