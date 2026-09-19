// Ported from draco.js src/compression/point_cloud/PointCloudDecoder.js (MIT)

import { MetadataDecoder } from '../../metadata/MetadataDecoder'
import { METADATA_FLAG_MASK } from '../config/CompressionShared'
import { ransDecodeStreams } from '../entropy/ANSCoding'

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloud } from '../../point_cloud/PointCloud'
import type { AttributesDecoderInterface } from '../attributes/AttributesDecoderInterface'
import type { PendingSymbolStream } from '../attributes/SequentialAttributeDecoder'
import type { DracoHeader } from '../config/CompressionShared'

// Abstract base for the mesh decoders; holds shared logic. (No point cloud
// decoder is instantiated: Decode.ts only accepts triangular meshes.)
class PointCloudDecoder {
  _pointCloud: PointCloud | null = null
  _buffer: DecoderBuffer | null = null
  _attributesDecoders: (AttributesDecoderInterface | null)[] = []
  _attributeToDecoderMap: number[] = []

  // Returns an error message, or '' on success (outHeader is then populated).
  static decodeHeader(buffer: DecoderBuffer, outHeader: DracoHeader): string {
    const kIoErrorMsg = 'Failed to parse Draco header.'
    const bytes = buffer.decodeBytesView(5)
    if (bytes === undefined) {
      return kIoErrorMsg
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4])
    if (magic !== 'DRACO') {
      return 'Not a Draco file.'
    }
    const versionMajor = buffer.decodeUint8()
    const versionMinor = buffer.decodeUint8()
    const encoderType = buffer.decodeUint8()
    const encoderMethod = buffer.decodeUint8()
    const flags = buffer.decodeUint16()
    if (
      versionMajor === undefined ||
      versionMinor === undefined ||
      encoderType === undefined ||
      encoderMethod === undefined ||
      flags === undefined
    ) {
      return kIoErrorMsg
    }
    outHeader.versionMajor = versionMajor
    outHeader.versionMinor = versionMinor
    outHeader.encoderType = encoderType
    outHeader.encoderMethod = encoderMethod
    outHeader.flags = flags
    return ''
  }

  // Main entry point, given the already-parsed header (see Decode.ts).
  decode(header: DracoHeader, inBuffer: DecoderBuffer, outPointCloud: PointCloud): string {
    this._buffer = inBuffer
    this._pointCloud = outPointCloud

    // Only the current Draco 2.2 mesh bitstream is supported; pre-2.2 decode
    // paths were removed, so older meshes are rejected rather than mis-decoded.
    if (header.versionMajor !== 2 || header.versionMinor !== 2) {
      return 'Unsupported bitstream version (Draco 2.2 meshes only).'
    }

    // Skip (not surface) the geometry metadata so its bytes are consumed and the
    // bitstream stays aligned; otherwise a metadata-bearing file decodes to empty.
    if (header.flags & METADATA_FLAG_MASK && !new MetadataDecoder(this._buffer).skipGeometryMetadata()) {
      return 'Failed to decode metadata.'
    }

    if (!this.initializeDecoder()) {
      return 'Failed to initialize the decoder.'
    }
    if (!this.decodeGeometryData()) {
      return 'Failed to decode geometry data.'
    }
    if (!this.decodePointAttributes()) {
      return 'Failed to decode point attributes.'
    }
    return ''
  }

  setAttributesDecoder(attDecoderId: number, decoder: AttributesDecoderInterface): boolean {
    if (attDecoderId < 0) {
      return false
    }
    while (this._attributesDecoders.length <= attDecoderId) {
      this._attributesDecoders.push(null)
    }
    this._attributesDecoders[attDecoderId] = decoder
    return true
  }

  getPortableAttribute(parentAttId: number): PointAttribute | null {
    if (parentAttId < 0 || parentAttId >= this._pointCloud!.numAttributes()) {
      return null
    }
    const parentAttDecoderId = this._attributeToDecoderMap[parentAttId]
    return this._attributesDecoders[parentAttDecoderId]!.getPortableAttribute(parentAttId)
  }

  attributesDecoder(decId: number): AttributesDecoderInterface | null {
    return this._attributesDecoders[decId]
  }

  numAttributesDecoders(): number {
    return this._attributesDecoders.length
  }

  pointCloud(): PointCloud | null {
    return this._pointCloud
  }

  buffer(): DecoderBuffer | null {
    return this._buffer
  }

  // -- Protected virtual methods (override in subclasses) --

  initializeDecoder(): boolean {
    return true
  }

  // Must be implemented by derived classes.
  createAttributesDecoder(_attDecoderId: number): boolean {
    return false
  }

  decodeGeometryData(): boolean {
    return true
  }

  decodePointAttributes(): boolean {
    const numAttributesDecoders = this._buffer!.decodeUint8()
    if (numAttributesDecoders === undefined) {
      return false
    }
    for (let i = 0; i < numAttributesDecoders; ++i) {
      if (!this.createAttributesDecoder(i)) {
        return false
      }
    }
    for (let i = 0; i < this._attributesDecoders.length; ++i) {
      if (!this._attributesDecoders[i]!.init(this, this._pointCloud!)) {
        return false
      }
    }
    for (let i = 0; i < numAttributesDecoders; ++i) {
      if (!this._attributesDecoders[i]!.decodeAttributesDecoderData(this._buffer!)) {
        return false
      }
    }
    // Map each attribute id to its decoder id.
    for (let i = 0; i < numAttributesDecoders; ++i) {
      const numAttributes = this._attributesDecoders[i]!.getNumAttributes()
      for (let j = 0; j < numAttributes; ++j) {
        const attId = this._attributesDecoders[i]!.getAttributeId(j)
        while (this._attributeToDecoderMap.length <= attId) {
          this._attributeToDecoderMap.push(0)
        }
        this._attributeToDecoderMap[attId] = i
      }
    }
    return this.decodeAllAttributes()
  }

  decodeAllAttributes(): boolean {
    // Three phases instead of running each attributes decoder to completion:
    // parse everything (all cursor movement is size-driven, so the raw rANS
    // symbol decodes can be deferred), decode the deferred streams together
    // -- independent streams interleaved in one lockstep loop overlap their
    // serial per-symbol dependency chains, which is where a lone rANS decode
    // is latency-bound (see ransDecodeStreams) -- then finish each decoder in
    // order. Output is bit-identical to the sequential decode.
    const decoders = this._attributesDecoders
    for (let i = 0; i < decoders.length; i++) {
      if (!decoders[i]!.decodeAttributesParse(this._buffer!)) {
        return false
      }
    }

    const pending: PendingSymbolStream[] = []
    for (let i = 0; i < decoders.length; i++) {
      decoders[i]!.collectPendingSymbolStreams(pending)
    }
    ransDecodeStreams(pending)

    for (let k = 0; k < decoders.length; k++) {
      if (!decoders[k]!.decodeAttributesFinish()) {
        return false
      }
    }
    return true
  }
}

export { PointCloudDecoder }
