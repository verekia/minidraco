// Ported from draco.js src/compression/point_cloud/PointCloudDecoder.js (MIT)

import { Status, StatusCode, okStatus } from '../../core/Status'
import { MetadataDecoder } from '../../metadata/MetadataDecoder'
import {
  DracoHeader,
  EncodedGeometryType,
  DRACO_BITSTREAM_VERSION,
  METADATA_FLAG_MASK,
  kDracoPointCloudBitstreamVersionMajor,
  kDracoPointCloudBitstreamVersionMinor,
  kDracoMeshBitstreamVersionMajor,
  kDracoMeshBitstreamVersionMinor,
} from '../config/CompressionShared'
import { ransDecodeSymbolsPair } from '../entropy/ANSCoding'

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloud } from '../../point_cloud/PointCloud'
import type { AttributesDecoderInterface } from '../attributes/AttributesDecoderInterface'
import type { PendingSymbolStream } from '../attributes/SequentialAttributeDecoder'
import type { DecoderOptions } from '../config/DecoderOptions'

// Abstract base for all point cloud and mesh decoders; holds shared logic.
class PointCloudDecoder {
  _pointCloud: PointCloud | null
  _buffer: DecoderBuffer | null
  _versionMajor: number
  _versionMinor: number
  _options: DecoderOptions | null
  _attributesDecoders: (AttributesDecoderInterface | null)[]
  _attributeToDecoderMap: number[]

  constructor() {
    this._pointCloud = null
    this._buffer = null
    this._versionMajor = 0
    this._versionMinor = 0
    this._options = null
    this._attributesDecoders = []
    this._attributeToDecoderMap = []
  }

  getGeometryType(): number {
    return EncodedGeometryType.POINT_CLOUD
  }

  // Returns a Status; on success outHeader is populated.
  static decodeHeader(buffer: DecoderBuffer, outHeader: DracoHeader): Status {
    const kIoErrorMsg = 'Failed to parse Draco header.'
    const bytes = buffer.decodeBytes(5)
    if (bytes === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    for (let i = 0; i < 5; i++) {
      outHeader.dracoString[i] = bytes[i]
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4])
    if (magic !== 'DRACO') {
      return new Status(StatusCode.DRACO_ERROR, 'Not a Draco file.')
    }
    const versionMajor = buffer.decodeUint8()
    if (versionMajor === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    outHeader.versionMajor = versionMajor
    const versionMinor = buffer.decodeUint8()
    if (versionMinor === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    outHeader.versionMinor = versionMinor
    const encoderType = buffer.decodeUint8()
    if (encoderType === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    outHeader.encoderType = encoderType
    const encoderMethod = buffer.decodeUint8()
    if (encoderMethod === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    outHeader.encoderMethod = encoderMethod
    const flags = buffer.decodeUint16()
    if (flags === undefined) {
      return new Status(StatusCode.IO_ERROR, kIoErrorMsg)
    }
    outHeader.flags = flags
    return okStatus()
  }

  // Main entry point for point cloud decoding.
  decode(options: DecoderOptions, inBuffer: DecoderBuffer, outPointCloud: PointCloud): Status {
    this._options = options
    this._buffer = inBuffer
    this._pointCloud = outPointCloud

    const header = new DracoHeader()
    const headerStatus = PointCloudDecoder.decodeHeader(this._buffer, header)
    if (!headerStatus.ok()) {
      return headerStatus
    }

    if (header.encoderType !== this.getGeometryType()) {
      return new Status(StatusCode.DRACO_ERROR, 'Using incompatible decoder for the input geometry.')
    }

    this._versionMajor = header.versionMajor
    this._versionMinor = header.versionMinor

    const maxSupportedMajorVersion =
      header.encoderType === EncodedGeometryType.POINT_CLOUD
        ? kDracoPointCloudBitstreamVersionMajor
        : kDracoMeshBitstreamVersionMajor
    const maxSupportedMinorVersion =
      header.encoderType === EncodedGeometryType.POINT_CLOUD
        ? kDracoPointCloudBitstreamVersionMinor
        : kDracoMeshBitstreamVersionMinor

    // Version compatibility check.
    if (this._versionMajor < 1 || this._versionMajor > maxSupportedMajorVersion) {
      return new Status(StatusCode.UNKNOWN_VERSION, 'Unknown major version.')
    }
    if (this._versionMajor === maxSupportedMajorVersion && this._versionMinor > maxSupportedMinorVersion) {
      return new Status(StatusCode.UNKNOWN_VERSION, 'Unknown minor version.')
    }

    this._buffer.bitstreamVersion = DRACO_BITSTREAM_VERSION(this._versionMajor, this._versionMinor)

    // Only the current Draco 2.2 mesh bitstream is supported; pre-2.2 decode
    // paths were removed, so older meshes are rejected rather than mis-decoded.
    if (
      header.encoderType === EncodedGeometryType.TRIANGULAR_MESH &&
      this._buffer.bitstreamVersion < DRACO_BITSTREAM_VERSION(2, 2)
    ) {
      return new Status(
        StatusCode.UNKNOWN_VERSION,
        'Unsupported bitstream version (only Draco 2.2 meshes are supported).',
      )
    }

    if (header.flags & METADATA_FLAG_MASK) {
      const metadataStatus = this._decodeMetadata()
      if (!metadataStatus.ok()) {
        return metadataStatus
      }
    }

    if (!this.initializeDecoder()) {
      return new Status(StatusCode.DRACO_ERROR, 'Failed to initialize the decoder.')
    }
    if (!this.decodeGeometryData()) {
      return new Status(StatusCode.DRACO_ERROR, 'Failed to decode geometry data.')
    }
    if (!this.decodePointAttributes()) {
      return new Status(StatusCode.DRACO_ERROR, 'Failed to decode point attributes.')
    }
    return okStatus()
  }

  bitstreamVersion(): number {
    return DRACO_BITSTREAM_VERSION(this._versionMajor, this._versionMinor)
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

  options(): DecoderOptions | null {
    return this._options
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
    if (!this.decodeAllAttributes()) {
      return false
    }
    if (!this.onAttributesDecoded()) {
      return false
    }
    return true
  }

  decodeAllAttributes(): boolean {
    // Three phases instead of running each attributes decoder to completion:
    // parse everything (all cursor movement is size-driven, so the raw rANS
    // symbol decodes can be deferred), decode the deferred streams two at a
    // time -- independent streams interleaved in one lockstep loop overlap
    // their serial per-symbol dependency chains, which is where a lone rANS
    // decode is latency-bound -- then finish each decoder in order. Output is
    // bit-identical to the sequential decode.
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
    let i = 0
    for (; i + 1 < pending.length; i += 2) {
      const a = pending[i]
      const b = pending[i + 1]
      ransDecodeSymbolsPair(a.ans, a.out, a.count, b.ans, b.out, b.count)
    }
    if (i < pending.length) {
      pending[i].ans.decodeSymbols(pending[i].out, pending[i].count)
    }

    for (let k = 0; k < decoders.length; k++) {
      if (!decoders[k]!.decodeAttributesFinish()) {
        return false
      }
    }
    return true
  }

  onAttributesDecoded(): boolean {
    return true
  }

  _decodeMetadata(): Status {
    // Skip (not surface) the geometry metadata so its bytes are consumed and the
    // bitstream stays aligned; otherwise a metadata-bearing file decodes to empty.
    const metadataDecoder = new MetadataDecoder()
    if (!metadataDecoder.skipGeometryMetadata(this._buffer!)) {
      return new Status(StatusCode.DRACO_ERROR, 'Failed to decode metadata.')
    }
    return okStatus()
  }
}

export { PointCloudDecoder }
