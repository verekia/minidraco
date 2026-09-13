// Ported from draco.js src/compression/mesh/MeshDecoder.js (MIT)

import { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { Mesh } from '../../mesh/Mesh'
import type { MeshAttributeCornerTable } from '../../mesh/MeshAttributeCornerTable'
import type { DracoHeader } from '../config/CompressionShared'
import type { CornerTable, MeshAttributeIndicesEncodingData } from './MeshEdgebreakerDecoderImpl'

abstract class MeshDecoder extends PointCloudDecoder {
  _mesh: Mesh | null = null

  // Returns an error message, or '' on success.
  decodeMesh(header: DracoHeader, inBuffer: DecoderBuffer, outMesh: Mesh): string {
    this._mesh = outMesh
    return this.decode(header, inBuffer, outMesh)
  }

  // Connectivity accessors used by the mesh prediction schemes; the sequential
  // decoder has none, so its attributes fall back to delta prediction.
  getCornerTable(): CornerTable | null {
    return null
  }

  getAttributeCornerTable(_attId: number): MeshAttributeCornerTable | null {
    return null
  }

  getAttributeEncodingData(_attId: number): MeshAttributeIndicesEncodingData | null {
    return null
  }

  mesh(): Mesh | null {
    return this._mesh
  }

  override decodeGeometryData(): boolean {
    return this.decodeConnectivity() && super.decodeGeometryData()
  }

  abstract decodeConnectivity(): boolean
}

export { MeshDecoder }
