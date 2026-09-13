// Ported from draco.js src/mesh/MeshAttributeCornerTable.js (MIT)

import { scratchInt32, scratchInt32Filled, scratchUint8Zeroed } from '../core/ScratchArena'

import type { CornerTable } from '../compression/mesh/MeshEdgebreakerDecoderImpl'

const kInvalidCornerIndex = -1
const kInvalidVertexIndex = -1

class MeshAttributeCornerTable {
  is_edge_on_seam_: Uint8Array | number[] = []
  is_vertex_on_seam_: Uint8Array | number[] = []
  corner_to_vertex_map_: Int32Array | number[] = []
  vertex_to_left_most_corner_map_: Int32Array | number[] = []
  // Attribute-vertex count. C++ keeps a vertex -> attribute-entry map here, but
  // the decoder only ever reads its size, so track the count directly instead
  // of allocating an Int32Array per attribute corner table.
  num_attribute_vertices_ = 0
  corner_table_: CornerTable | null = null
  // Lazily built; see oppositeCornerArray.
  _effectiveOpposite: Int32Array | null = null
  // Every corner passed to addSeamEdge (may contain duplicates); lets
  // oppositeCornerArray patch seams without scanning every corner's flag.
  // Preallocated to its exact upper bound (2 per seam edge) by the caller via
  // reserveSeamEdges -- a plain array grown by push() was measurable on
  // seam-heavy files.
  _seamCorners: Int32Array | number[] = []
  _numSeamCorners = 0

  initEmpty(table: CornerTable | null): boolean {
    if (table === null) {
      return false
    }
    // Typed arrays keep the per-corner hot accessors monomorphic. Uint8Array
    // defaults to 0 (== false); corner_to_vertex_map_ uses a signed -1 sentinel.
    // Decode-scoped scratch: these live only until the decode finishes (the
    // result mesh keeps no reference to them), so pooling them keeps a
    // primitive-heavy file from allocating a fresh set per attribute per prim.
    this.is_edge_on_seam_ = scratchUint8Zeroed(table.numCorners())
    this.is_vertex_on_seam_ = scratchUint8Zeroed(table.numVertices())
    this.corner_to_vertex_map_ = scratchInt32Filled(table.numCorners(), kInvalidVertexIndex)
    this.num_attribute_vertices_ = 0
    this.vertex_to_left_most_corner_map_ = []
    // Lazily built; see oppositeCornerArray.
    this._effectiveOpposite = null
    this._seamCorners = []
    this._numSeamCorners = 0
    this.corner_table_ = table
    return true
  }

  // Sizes the seam-corner list for numSeamEdges upcoming addSeamEdge calls
  // (each adds at most two corners). Decode-scoped scratch.
  reserveSeamEdges(numSeamEdges: number): void {
    this._seamCorners = scratchInt32(numSeamEdges * 2)
    this._numSeamCorners = 0
  }

  addSeamEdge(c: number): void {
    const cornerToVertex = this.corner_table_!.cornerToVertexArray()
    const oppositeCorners = this.corner_table_!.oppositeCornerArray()
    const isEdge = this.is_edge_on_seam_
    const isVert = this.is_vertex_on_seam_
    const seamCorners = this._seamCorners

    isEdge[c] = 1
    seamCorners[this._numSeamCorners++] = c
    // Inlined next(c)/previous(c).
    let rem = c - ((c / 3) | 0) * 3
    isVert[cornerToVertex[rem === 2 ? c - 2 : c + 1]] = 1
    isVert[cornerToVertex[rem === 0 ? c + 2 : c - 1]] = 1

    const oppCorner = oppositeCorners[c]
    if (oppCorner !== kInvalidCornerIndex) {
      isEdge[oppCorner] = 1
      seamCorners[this._numSeamCorners++] = oppCorner
      rem = oppCorner - ((oppCorner / 3) | 0) * 3
      isVert[cornerToVertex[rem === 2 ? oppCorner - 2 : oppCorner + 1]] = 1
      isVert[cornerToVertex[rem === 0 ? oppCorner + 2 : oppCorner - 1]] = 1
    }
  }

  // Installs attribute-vertex numbering computed externally (the edgebreaker
  // decoder's fused ring pass fills corner_to_vertex_map_ directly and hands
  // over the per-vertex left-most corners here). leftMostMap is decode-scoped
  // scratch sized for at least numNewVertices entries.
  setRecomputedVertices(leftMostMap: Int32Array, numNewVertices: number): void {
    this.num_attribute_vertices_ = numNewVertices
    this.vertex_to_left_most_corner_map_ =
      leftMostMap.length === numNewVertices ? leftMostMap : leftMostMap.subarray(0, numNewVertices)
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
    return this.num_attribute_vertices_
  }

  numFaces(): number {
    return this.corner_table_!.numFaces()
  }

  numCorners(): number {
    return this.corner_table_!.numCorners()
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
      const numSeamCorners = this._numSeamCorners
      if (numSeamCorners === 0) {
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
        for (let i = 0; i < numSeamCorners; ++i) {
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

  // Takes over another table's state wholesale. Only valid when both tables
  // were built from the same corner table and the same seam edges, in which
  // case every one of these is identical and read-only from here on.
  adoptFrom(other: MeshAttributeCornerTable): void {
    this.corner_table_ = other.corner_table_
    this.is_edge_on_seam_ = other.is_edge_on_seam_
    this.is_vertex_on_seam_ = other.is_vertex_on_seam_
    this.corner_to_vertex_map_ = other.corner_to_vertex_map_
    this.num_attribute_vertices_ = other.num_attribute_vertices_
    this.vertex_to_left_most_corner_map_ = other.vertex_to_left_most_corner_map_
    this._effectiveOpposite = other._effectiveOpposite
    this._seamCorners = other._seamCorners
    this._numSeamCorners = other._numSeamCorners
  }
}

export { MeshAttributeCornerTable }
