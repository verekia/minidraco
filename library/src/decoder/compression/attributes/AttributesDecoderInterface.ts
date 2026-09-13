// Ported from draco.js src/compression/attributes/AttributesDecoderInterface.js (MIT)

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloud } from '../../point_cloud/PointCloud'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'
import type { PendingSymbolStream } from './SequentialAttributeDecoder'

// Interface used by PointCloudDecoder; SequentialAttributeDecodersController is
// the only implementation (type-only, no runtime base class).
export interface AttributesDecoderInterface {
  init(decoder: PointCloudDecoder, pointCloud: PointCloud): boolean

  decodeAttributesDecoderData(buffer: DecoderBuffer): boolean

  // --- Two-phase decode across attributes decoders ---
  // PointCloudDecoder parses every decoder first (all buffer reads are
  // size-driven, so parsing runs ahead of the deferred rANS symbol decodes),
  // then decodes the collected streams two at a time, then finishes each
  // decoder in order (so parent attributes complete before dependents).
  decodeAttributesParse(buffer: DecoderBuffer): boolean

  collectPendingSymbolStreams(out: PendingSymbolStream[]): void

  decodeAttributesFinish(): boolean

  getAttributeId(i: number): number

  getNumAttributes(): number

  getDecoder(): PointCloudDecoder | null

  // Attribute data in portable (post-transform) format; identical on encoder
  // and decoder, so usable by predictors.
  getPortableAttribute(pointAttributeId: number): PointAttribute | null
}
