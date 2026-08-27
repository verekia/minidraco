// Ported from draco.js src/compression/attributes/SequentialAttributeDecodersController.js (MIT)

import { SequentialAttributeEncoderType } from '../config/CompressionShared'
import { AttributesDecoder } from './AttributesDecoder'
import { SequentialAttributeDecoder } from './SequentialAttributeDecoder'
import { SequentialIntegerAttributeDecoder } from './SequentialIntegerAttributeDecoder'
import { SequentialNormalAttributeDecoder } from './SequentialNormalAttributeDecoder'
import { SequentialQuantizationAttributeDecoder } from './SequentialQuantizationAttributeDecoder'

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PendingSymbolStream } from './SequentialAttributeDecoder'

// Structural interface satisfied by LinearSequencer and MeshTraversalSequencer.
export interface PointsSequencer {
  generateSequence(): boolean
  getOutputPointIds(): Int32Array
  updatePointToAttributeIndexMapping(attribute: PointAttribute): boolean
}

// Creates one SequentialAttributeDecoder per attribute; the decoder type is
// chosen from the id encoded by the matching encoder.
class SequentialAttributeDecodersController extends AttributesDecoder {
  _sequentialDecoders: (SequentialAttributeDecoder | null)[]
  _pointIds: Int32Array
  _sequencer: PointsSequencer

  constructor(sequencer: PointsSequencer) {
    super()
    this._sequentialDecoders = []
    // Source initializes this to []; it is only ever passed to (and ignored by)
    // generateSequence() before being replaced by getOutputPointIds().
    this._pointIds = new Int32Array(0)
    this._sequencer = sequencer
  }

  override decodeAttributesDecoderData(buffer: DecoderBuffer): boolean {
    if (!super.decodeAttributesDecoderData(buffer)) {
      return false
    }
    const numAttributes = this.getNumAttributes()
    this._sequentialDecoders.length = numAttributes
    for (let i = 0; i < numAttributes; i++) {
      const decoderType = buffer.decodeUint8()
      if (decoderType === undefined) return false

      this._sequentialDecoders[i] = this.createSequentialDecoder(decoderType)
      if (!this._sequentialDecoders[i]) {
        return false
      }
      if (!this._sequentialDecoders[i]!.init(this.getDecoder()!, this.getAttributeId(i))) {
        return false
      }
    }
    return true
  }

  override decodeAttributes(buffer: DecoderBuffer): boolean {
    if (!this._prepareSequence()) {
      return false
    }
    return super.decodeAttributes(buffer)
  }

  _prepareSequence(): boolean {
    if (!this._sequencer) {
      return false
    }
    if (!this._sequencer.generateSequence()) {
      return false
    }
    this._pointIds = this._sequencer.getOutputPointIds()

    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      const pa = this.getDecoder()!.pointCloud()!.attribute(this.getAttributeId(i))!
      if (!this._sequencer.updatePointToAttributeIndexMapping(pa)) {
        return false
      }
    }
    return true
  }

  // Two-phase decode (see AttributesDecoder): parse everything that reads the
  // buffer -- sequence, portable headers (deferring raw rANS symbol decodes),
  // and the transform parameters -- so the deferred streams of ALL attributes
  // decoders can then be paired, and finish (zigzag, prediction, inverse
  // transform) runs per decoder in the original order afterwards. None of the
  // finish work reads the buffer, and dependents only read parent portable
  // VALUES in finish, so ordering and output stay identical.
  override decodeAttributesParse(buffer: DecoderBuffer): boolean {
    if (!this._prepareSequence()) {
      return false
    }
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      if (!this._sequentialDecoders[i]!.decodePortableAttributeParse(this._pointIds, buffer)) {
        return false
      }
    }
    return this.decodeDataNeededByPortableTransforms(buffer)
  }

  override collectPendingSymbolStreams(out: PendingSymbolStream[]): void {
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      const pending = this._sequentialDecoders[i]!.pendingSymbolStream()
      if (pending !== null) {
        out.push(pending)
      }
    }
  }

  override decodeAttributesFinish(): boolean {
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      if (!this._sequentialDecoders[i]!.decodePortableAttributeFinish()) {
        return false
      }
    }
    return this.transformAttributesToOriginalFormat()
  }

  override getPortableAttribute(pointAttributeId: number): PointAttribute | null {
    const locId = this.getLocalIdForPointAttribute(pointAttributeId)
    if (locId < 0) {
      return null
    }
    return this._sequentialDecoders[locId]!.getPortableAttribute()
  }

  override decodePortableAttributes(buffer: DecoderBuffer): boolean {
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      if (!this._sequentialDecoders[i]!.decodePortableAttribute(this._pointIds, buffer)) {
        return false
      }
    }
    return true
  }

  override decodeDataNeededByPortableTransforms(buffer: DecoderBuffer): boolean {
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      if (!this._sequentialDecoders[i]!.decodeDataNeededByPortableTransform(this._pointIds, buffer)) {
        return false
      }
    }
    return true
  }

  override transformAttributesToOriginalFormat(): boolean {
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      if (this.getDecoder()!.options()) {
        const attribute = this._sequentialDecoders[i]!.attribute
        const portableAttribute = this._sequentialDecoders[i]!.getPortableAttribute()
        if (
          portableAttribute &&
          this.getDecoder()!.options()!.getAttributeBool(attribute!.attributeType, 'skip_attribute_transform', false)
        ) {
          // Skip the transform: use the portable attribute as the output.
          this._sequentialDecoders[i]!.attribute!.copyFrom(portableAttribute)
          continue
        }
      }
      if (!this._sequentialDecoders[i]!.transformAttributeToOriginalFormat(this._pointIds)) {
        return false
      }
    }
    return true
  }

  createSequentialDecoder(decoderType: number): SequentialAttributeDecoder | null {
    switch (decoderType) {
      case SequentialAttributeEncoderType.SEQUENTIAL_ATTRIBUTE_ENCODER_GENERIC:
        return new SequentialAttributeDecoder()

      case SequentialAttributeEncoderType.SEQUENTIAL_ATTRIBUTE_ENCODER_INTEGER:
        return new SequentialIntegerAttributeDecoder()

      case SequentialAttributeEncoderType.SEQUENTIAL_ATTRIBUTE_ENCODER_QUANTIZATION:
        return new SequentialQuantizationAttributeDecoder()

      case SequentialAttributeEncoderType.SEQUENTIAL_ATTRIBUTE_ENCODER_NORMALS:
        return new SequentialNormalAttributeDecoder()

      default:
        break
    }
    return null
  }
}

export { SequentialAttributeDecodersController }
