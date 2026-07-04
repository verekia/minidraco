// Ported from draco.js src/compression/mesh/MeshSequentialDecoder.js (MIT)

import { decodeVarint } from '../../core/VarintDecoding'
import { LinearSequencer } from '../attributes/LinearSequencer'
import { SequentialAttributeDecodersController } from '../attributes/SequentialAttributeDecodersController'
import { decodeSymbols } from '../entropy/SymbolDecoding'
import { MeshDecoder } from './MeshDecoder'

class MeshSequentialDecoder extends MeshDecoder {
  constructor() {
    super()
  }

  override decodeConnectivity(): boolean {
    let numFaces: number | undefined
    let numPoints: number | undefined

    numFaces = decodeVarint(this.buffer()!)
    if (numFaces === undefined) return false
    numPoints = decodeVarint(this.buffer()!)
    if (numPoints === undefined) return false

    // Compressed sequential encoding can only handle (2^32 - 1) / 3 indices.
    if (numFaces > 0xffffffff / 3) {
      return false
    }
    if (numFaces > this.buffer()!.remainingSize / 3) {
      return false
    }

    const connectivityMethod = this.buffer()!.decodeUint8()
    if (connectivityMethod === undefined) {
      return false
    }

    if (connectivityMethod === 0) {
      if (!this._decodeAndDecompressIndices(numFaces)) {
        return false
      }
    } else {
      // numFaces is known up front (and bounded by the buffer size checks
      // above), so size the face buffer once and write indices straight into
      // it instead of a per-face array allocation + addFace call.
      const mesh = this.mesh()!
      mesh.setNumFaces(numFaces)
      const faces = mesh.faces_
      const numIndices = numFaces * 3
      const buffer = this.buffer()!

      if (numPoints < 256) {
        const src = buffer.decodeBytesView(numIndices)
        if (src === undefined) return false
        for (let i = 0; i < numIndices; ++i) faces[i] = src[i]
      } else if (numPoints < 1 << 16) {
        const src = buffer.decodeBytesView(numIndices * 2)
        if (src === undefined) return false
        for (let i = 0; i < numIndices; ++i) faces[i] = src[i * 2] | (src[i * 2 + 1] << 8)
      } else if (numPoints < 1 << 21) {
        for (let i = 0; i < numIndices; ++i) {
          const val = decodeVarint(buffer)
          if (val === undefined) return false
          faces[i] = val
        }
      } else {
        const src = buffer.decodeBytesView(numIndices * 4)
        if (src === undefined) return false
        for (let i = 0; i < numIndices; ++i) {
          faces[i] = src[i * 4] | (src[i * 4 + 1] << 8) | (src[i * 4 + 2] << 16) | (src[i * 4 + 3] << 24)
        }
      }
    }

    this.pointCloud()!.setNumPoints(numPoints)
    return true
  }

  override createAttributesDecoder(attDecoderId: number): boolean {
    // Sequential meshes store attribute values directly in point order, so a
    // LinearSequencer drives the SequentialAttributeDecodersController.
    return this.setAttributesDecoder(
      attDecoderId,
      new SequentialAttributeDecodersController(new LinearSequencer(this.pointCloud()!.numPoints())),
    )
  }

  _decodeAndDecompressIndices(numFaces: number): boolean {
    const numIndices = numFaces * 3
    const indicesBuffer = new Uint32Array(numIndices)
    if (!decodeSymbols(numIndices, 1, this.buffer()!, indicesBuffer)) {
      return false
    }
    // Reconstruct the indices from the differences, writing straight into the
    // preallocated face buffer (no per-face array + addFace).
    // See MeshSequentialEncoder::CompressAndEncodeIndices() for more details.
    const mesh = this.mesh()!
    mesh.setNumFaces(numFaces)
    const faces = mesh.faces_
    let lastIndexValue = 0 // This will always be >= 0.
    for (let i = 0; i < numIndices; ++i) {
      const encodedVal = indicesBuffer[i]
      let indexDiff = encodedVal >>> 1
      if (encodedVal & 1) {
        if (indexDiff > lastIndexValue) {
          // Subtracting indexDiff would result in a negative index.
          return false
        }
        indexDiff = -indexDiff
      } else {
        if (indexDiff > 0x7fffffff - lastIndexValue) {
          // Adding indexDiff to lastIndexValue would overflow.
          return false
        }
      }
      const indexValue = (indexDiff + lastIndexValue) | 0
      faces[i] = indexValue
      lastIndexValue = indexValue
    }
    return true
  }
}

export { MeshSequentialDecoder }
