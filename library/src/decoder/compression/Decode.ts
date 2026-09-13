// Ported from draco.js src/compression/Decode.js (MIT)

import { DecoderBuffer } from '../core/DecoderBuffer'
import { releaseScratch } from '../core/ScratchArena'
import { Mesh } from '../mesh/Mesh'
import { EncodedGeometryType, MeshEncoderMethod, DracoHeader } from './config/CompressionShared'
import { MeshEdgebreakerDecoder } from './mesh/MeshEdgebreakerDecoder'
import { MeshSequentialDecoder } from './mesh/MeshSequentialDecoder'
import { PointCloudDecoder } from './point_cloud/PointCloudDecoder'

function createMeshDecoder(method: number): MeshSequentialDecoder | MeshEdgebreakerDecoder {
  if (method === MeshEncoderMethod.MESH_SEQUENTIAL_ENCODING) {
    return new MeshSequentialDecoder()
  } else if (method === MeshEncoderMethod.MESH_EDGEBREAKER_ENCODING) {
    return new MeshEdgebreakerDecoder()
  }

  throw new Error('Unsupported mesh encoding method.')
}

// Decodes Draco-compressed meshes.
class Decoder {
  // Returns { mesh, ok, message }.
  decodeMeshFromBuffer(inBuffer: DecoderBuffer): { mesh: Mesh | null; ok: boolean; message: string } {
    const header = new DracoHeader()
    const headerError = PointCloudDecoder.decodeHeader(inBuffer, header)
    if (headerError !== '') {
      return { mesh: null, ok: false, message: headerError }
    }
    if (header.encoderType !== EncodedGeometryType.TRIANGULAR_MESH) {
      return { mesh: null, ok: false, message: 'Input is not a Draco triangular mesh.' }
    }

    try {
      const mesh = new Mesh()
      const message = createMeshDecoder(header.encoderMethod).decodeMesh(header, inBuffer, mesh)
      return message === '' ? { mesh, ok: true, message } : { mesh: null, ok: false, message }
    } catch (error) {
      // Safety net for hostile input: a malformed header can declare a size
      // that drives an oversized typed-array allocation (RangeError), or hit an
      // unsupported encoding — convert any throw into a clean decode failure
      // instead of letting it escape as an uncaught exception.
      return { mesh: null, ok: false, message: error instanceof Error ? error.message : String(error) }
    } finally {
      // The result mesh only references attribute buffers and faces_, never
      // scratch — everything borrowed during the decode goes back to the pool.
      releaseScratch()
    }
  }
}

export { Decoder }
