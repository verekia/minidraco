// Ported from draco.js src/compression/attributes/AttributesDecoderInterface.js (MIT)

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloud } from '../../point_cloud/PointCloud'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'
import type { PendingSymbolStream } from './SequentialAttributeDecoder'

// Abstract interface used by PointCloudDecoder; methods must be overridden.
class AttributesDecoderInterface {
  constructor() {}

  init(_decoder: PointCloudDecoder, _pointCloud: PointCloud): boolean {
    return false
  }

  decodeAttributesDecoderData(_buffer: DecoderBuffer): boolean {
    return false
  }

  // --- Optional two-phase decode across attributes decoders ---
  // PointCloudDecoder parses every decoder first (all buffer reads are
  // size-driven, so parsing runs ahead of the deferred rANS symbol decodes),
  // then decodes the collected streams two at a time, then finishes each
  // decoder in order (so parent attributes complete before dependents).
  // Defaults keep the original single-phase behavior for decoders that do not
  // split.

  decodeAttributesParse(buffer: DecoderBuffer): boolean {
    return this.decodeAttributes(buffer)
  }

  collectPendingSymbolStreams(_out: PendingSymbolStream[]): void {}

  decodeAttributesFinish(): boolean {
    return true
  }

  decodeAttributes(_buffer: DecoderBuffer): boolean {
    return false
  }

  getAttributeId(_i: number): number {
    return -1
  }

  getNumAttributes(): number {
    return 0
  }

  getDecoder(): PointCloudDecoder | null {
    return null
  }

  // Attribute data in portable (post-transform) format; identical on encoder
  // and decoder, so usable by predictors.
  getPortableAttribute(_pointAttributeId: number): PointAttribute | null {
    return null
  }
}

export { AttributesDecoderInterface }
