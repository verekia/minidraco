// Ported from draco.js src/mesh/MeshAttributeCornerTable.js (MIT)

import { EMPTY_INT32, EMPTY_UINT8, scratchInt32, scratchUint8Zeroed } from '../core/ScratchArena'

import type { CornerTable } from '../compression/mesh/MeshEdgebreakerDecoderImpl'

const kInvalidCornerIndex = -1

// The connectivity of one attribute: the base corner table with every
// attribute seam cut open. Attribute vertices are numbered by the edgebreaker
// decoder's ring pass (see MeshEdgebreakerDecoderImpl
// ._assignAttributeVerticesAndPoints): a vertex on no seam of this table
// keeps its base id, and a seam vertex keeps it for the first of its
// sub-vertices and takes fresh ids past the base count for the rest. The
// C++ numbers them compactly instead, but only their identity matters -- the
// traversals and predictions never compare ids for order -- so the base
// numbering is copied and patched rather than rebuilt corner by corner.
class MeshAttributeCornerTable {
  // Base vertices touched by a seam edge of this table.
  is_vertex_on_seam_: Uint8Array = EMPTY_UINT8
  corner_to_vertex_map_: Int32Array = EMPTY_INT32
  // Attribute vertex -> 1 when its fan is open in this table (see
  // CornerTable._vertexOnBoundary). The C++ also keeps each attribute
  // vertex's left-most corner, but the decoder only ever asked it whether
  // that corner sits on a boundary, which this answers directly.
  _vertexOnBoundary: Uint8Array = EMPTY_UINT8
  // Attribute-vertex count. C++ keeps a vertex -> attribute-entry map here, but
  // the decoder only ever reads its size, so track the count directly instead
  // of allocating an Int32Array per attribute corner table.
  num_attribute_vertices_ = 0
  corner_table_: CornerTable | null = null
  // The base table's opposite corners with both corners of every seam edge
  // set to -1: what opposite() answers, and what the traversals read.
  _opposite: Int32Array = EMPTY_INT32

  // Starts the table as a copy of the base connectivity; addSeamEdge then
  // cuts the seams and the ring pass numbers the vertices. Decode-scoped
  // scratch throughout: the table lives only until the decode finishes (the
  // result mesh keeps no reference to it), so pooling keeps a primitive-heavy
  // file from allocating a fresh set per attribute per prim.
  initEmpty(table: CornerTable): void {
    const numCorners = table.numCorners()
    this.corner_table_ = table
    this.is_vertex_on_seam_ = scratchUint8Zeroed(table.numVertices())
    this._opposite = scratchInt32(numCorners)
    this._opposite.set(table.oppositeCornerArray())
    this.corner_to_vertex_map_ = scratchInt32(numCorners)
    this.corner_to_vertex_map_.set(table.cornerToVertexArray())
    this.num_attribute_vertices_ = 0
  }

  // Cuts the interior edge opposite corner c (and its twin) and flags its two
  // vertices. (Boundary edges are open in the base table already, and flagging
  // their vertices would only send them through the ring walk to come out
  // unsplit.)
  addSeamEdge(c: number): void {
    const cornerToVertex = this.corner_table_!.cornerToVertexArray()
    const opposite = this._opposite
    const isVert = this.is_vertex_on_seam_

    const oppCorner = opposite[c]
    opposite[c] = kInvalidCornerIndex
    opposite[oppCorner] = kInvalidCornerIndex
    // Inlined next(c)/previous(c); the twin edge has the same two vertices.
    const rem = c - ((c / 3) | 0) * 3
    isVert[cornerToVertex[rem === 2 ? c - 2 : c + 1]] = 1
    isVert[cornerToVertex[rem === 0 ? c + 2 : c - 1]] = 1
  }

  // Installs the vertex numbering computed by the edgebreaker decoder's ring
  // pass, which fills corner_to_vertex_map_ directly and hands over the
  // per-vertex boundary flags here (decode-scoped scratch sized for at
  // least numVertices entries).
  setRecomputedVertices(onBoundary: Uint8Array, numVertices: number): void {
    this.num_attribute_vertices_ = numVertices
    this._vertexOnBoundary = onBoundary
  }

  // A table without interior seams is the base connectivity itself: every
  // vertex ring is one attribute vertex, and the boundary edges are already
  // open in the base opposite table. Shares the base arrays (read-only from
  // here on), so its traversal also resolves to the base table's cached one.
  initAsBase(table: CornerTable): void {
    this.corner_table_ = table
    this._opposite = table.oppositeCornerArray()
    this.corner_to_vertex_map_ = table.cornerToVertexArray()
    this.setRecomputedVertices(table.vertexOnBoundaryArray(), table.numVertices())
  }

  opposite(corner: number): number {
    if (corner === kInvalidCornerIndex) {
      return kInvalidCornerIndex
    }
    return this._opposite[corner]
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

  cornerToVertexArray(): Int32Array {
    return this.corner_to_vertex_map_
  }

  // Seam-aware opposite corners (seam edges -> -1), matching opposite().
  oppositeCornerArray(): Int32Array {
    return this._opposite
  }

  vertexOnBoundaryArray(): Uint8Array {
    return this._vertexOnBoundary
  }

  // Takes over another table's state wholesale. Only valid when both tables
  // were built from the same corner table and the same seam edges, in which
  // case every one of these is identical and read-only from here on.
  adoptFrom(other: MeshAttributeCornerTable): void {
    this.corner_table_ = other.corner_table_
    this.is_vertex_on_seam_ = other.is_vertex_on_seam_
    this.corner_to_vertex_map_ = other.corner_to_vertex_map_
    this.num_attribute_vertices_ = other.num_attribute_vertices_
    this._vertexOnBoundary = other._vertexOnBoundary
    this._opposite = other._opposite
  }
}

export { MeshAttributeCornerTable }
