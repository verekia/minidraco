// Ported from draco.js src/mesh/Mesh.js (MIT)

import { PointCloud } from '../point_cloud/PointCloud'

export const enum MeshAttributeElementType {
  MESH_VERTEX_ATTRIBUTE = 0,
  MESH_CORNER_ATTRIBUTE = 1,
  MESH_FACE_ATTRIBUTE = 2,
}

class Mesh extends PointCloud {
  // Flat Int32Array, 3 point indices per face, for cache locality and to avoid
  // a per-face allocation. faces_[3*f + c] is corner c of face f; corner index
  // ci maps directly to faces_[ci].
  faces_ = new Int32Array(0)
  numFaces_ = 0

  // Sizes faces_ to hold numFaces faces. Called once per decode, before any
  // face index is written (edgebreaker: _assignPointsToCorners; sequential:
  // decodeConnectivity), so the buffer is allocated exactly here — the
  // decoders fill faces_ directly rather than appending face-by-face.
  setNumFaces(numFaces: number): void {
    const needed = numFaces * 3
    if (this.faces_.length < needed) {
      const grown = new Int32Array(needed)
      grown.set(this.faces_)
      this.faces_ = grown
    }
    this.numFaces_ = numFaces
  }

  numFaces(): number {
    return this.numFaces_
  }
}

export { Mesh }
