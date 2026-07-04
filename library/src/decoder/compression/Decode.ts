// Ported from draco.js src/compression/Decode.js (MIT)

import { DecoderBuffer } from '../core/DecoderBuffer'
import { releaseScratch } from '../core/ScratchArena'
import { Mesh } from '../mesh/Mesh'
import { EncodedGeometryType, MeshEncoderMethod, DracoHeader } from './config/CompressionShared'
import { DecoderOptions } from './config/DecoderOptions'
import { MeshEdgebreakerDecoder } from './mesh/MeshEdgebreakerDecoder'
import { MeshSequentialDecoder } from './mesh/MeshSequentialDecoder'
import { PointCloudDecoder } from './point_cloud/PointCloudDecoder'

// Reads the Draco header from a copy of inBuffer without advancing the original,
// so the geometry type can be checked before picking a decoder.
// Returns { ok, header, message }.
function peekHeader(inBuffer: DecoderBuffer): { ok: boolean; header: DracoHeader; message: string } {
  const tempBuffer = new DecoderBuffer()
  tempBuffer.init(inBuffer.data!, inBuffer.data!.length)
  tempBuffer.bitstreamVersion = inBuffer.bitstreamVersion
  tempBuffer.advance(inBuffer.decodedSize) // match the original's position

  const header = new DracoHeader()
  const status = PointCloudDecoder.decodeHeader(tempBuffer, header)
  return { ok: status.ok(), header, message: status.errorMsg }
}

function createMeshDecoder(method: number): MeshSequentialDecoder | MeshEdgebreakerDecoder {
  if (method === MeshEncoderMethod.MESH_SEQUENTIAL_ENCODING) {
    return new MeshSequentialDecoder()
  } else if (method === MeshEncoderMethod.MESH_EDGEBREAKER_ENCODING) {
    return new MeshEdgebreakerDecoder()
  }

  throw new Error('Unsupported mesh encoding method.')
}

// Decodes Draco-compressed meshes and point clouds.
class Decoder {
  options_: DecoderOptions

  constructor() {
    this.options_ = new DecoderOptions()
  }

  // Returns an EncodedGeometryType value, or INVALID_GEOMETRY_TYPE on error.
  static getEncodedGeometryType(inBuffer: DecoderBuffer): number {
    const result = peekHeader(inBuffer)
    if (!result.ok) {
      return EncodedGeometryType.INVALID_GEOMETRY_TYPE
    }

    if (result.header.encoderType >= EncodedGeometryType.NUM_ENCODED_GEOMETRY_TYPES) {
      return EncodedGeometryType.INVALID_GEOMETRY_TYPE
    }

    return result.header.encoderType
  }

  // Returns { mesh, ok, message }.
  decodeMeshFromBuffer(inBuffer: DecoderBuffer): { mesh: Mesh | null; ok: boolean; message: string } {
    const mesh = new Mesh()
    const status = this.decodeBufferToMesh(inBuffer, mesh)
    if (!status.ok) {
      return { mesh: null, ok: false, message: status.message }
    }

    return { mesh, ok: true, message: '' }
  }

  // Returns { ok, message }.
  decodeBufferToMesh(inBuffer: DecoderBuffer, outGeometry: Mesh): { ok: boolean; message: string } {
    const result = peekHeader(inBuffer)
    if (!result.ok) {
      return { ok: false, message: result.message }
    }

    if (result.header.encoderType !== EncodedGeometryType.TRIANGULAR_MESH) {
      return { ok: false, message: 'Input is not a mesh.' }
    }

    const decoder = createMeshDecoder(result.header.encoderMethod)
    try {
      const status = decoder.decodeMesh(this.options_, inBuffer, outGeometry)
      return { ok: status.ok(), message: status.errorMsg }
    } finally {
      // The result mesh only references attribute buffers and faces_, never
      // scratch — everything borrowed during the decode goes back to the pool.
      releaseScratch()
    }
  }

  options(): DecoderOptions {
    return this.options_
  }
}

export { Decoder }
