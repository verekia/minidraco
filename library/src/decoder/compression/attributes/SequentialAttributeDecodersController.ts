// Ported from draco.js src/compression/attributes/SequentialAttributeDecodersController.js (MIT)

import { SequentialAttributeEncoderType } from '../config/CompressionShared'
import { AttributesDecoder } from './AttributesDecoder'
import { SequentialAttributeDecoder } from './SequentialAttributeDecoder'
import { SequentialIntegerAttributeDecoder } from './SequentialIntegerAttributeDecoder'
import { SequentialNormalAttributeDecoder } from './SequentialNormalAttributeDecoder'
import { SequentialQuantizationAttributeDecoder } from './SequentialQuantizationAttributeDecoder'

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { AttributesDecoderInterface } from './AttributesDecoderInterface'
import type { PendingSymbolStream } from './SequentialAttributeDecoder'

// Structural interface satisfied by LinearSequencer and MeshTraversalSequencer.
export interface PointsSequencer {
  generateSequence(): boolean
  getOutputPointIds(): Int32Array
  updatePointToAttributeIndexMapping(attribute: PointAttribute): boolean
}

// Creates one SequentialAttributeDecoder per attribute; the decoder type is
// chosen from the id encoded by the matching encoder.
class SequentialAttributeDecodersController extends AttributesDecoder implements AttributesDecoderInterface {
  _sequentialDecoders: SequentialAttributeDecoder[] = []
  // Replaced by the sequencer's output in _prepareSequence.
  _pointIds: Int32Array = new Int32Array(0)
  _sequencer: PointsSequencer

  constructor(sequencer: PointsSequencer) {
    super()
    this._sequencer = sequencer
  }

  override decodeAttributesDecoderData(buffer: DecoderBuffer): boolean {
    if (!super.decodeAttributesDecoderData(buffer)) {
      return false
    }
    const numAttributes = this.getNumAttributes()
    for (let i = 0; i < numAttributes; i++) {
      const decoderType = buffer.decodeUint8()
      if (decoderType === undefined) return false

      const decoder = this.createSequentialDecoder(decoderType)
      if (decoder === null || !decoder.init(this.getDecoder()!, this.getAttributeId(i))) {
        return false
      }
      this._sequentialDecoders[i] = decoder
    }
    return true
  }

  _prepareSequence(): boolean {
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

  // Two-phase decode (see AttributesDecoderInterface): parse everything that
  // reads the buffer -- sequence, portable headers (deferring raw rANS symbol
  // decodes), and the transform parameters -- so the deferred streams of ALL
  // attributes decoders can then be paired, and finish (zigzag, prediction,
  // inverse transform) runs per decoder in the original order afterwards. None
  // of the finish work reads the buffer, and dependents only read parent
  // portable VALUES in finish, so ordering and output stay identical.
  decodeAttributesParse(buffer: DecoderBuffer): boolean {
    if (!this._prepareSequence()) {
      return false
    }
    const decoders = this._sequentialDecoders
    for (let i = 0; i < decoders.length; i++) {
      if (!decoders[i].decodePortableAttributeParse(this._pointIds, buffer)) {
        return false
      }
    }
    for (let i = 0; i < decoders.length; i++) {
      if (!decoders[i].decodeDataNeededByPortableTransform(this._pointIds, buffer)) {
        return false
      }
    }
    return true
  }

  collectPendingSymbolStreams(out: PendingSymbolStream[]): void {
    const decoders = this._sequentialDecoders
    for (let i = 0; i < decoders.length; i++) {
      const pending = decoders[i].pendingSymbolStream()
      if (pending !== null) {
        out.push(pending)
      }
    }
  }

  decodeAttributesFinish(): boolean {
    const decoders = this._sequentialDecoders
    for (let i = 0; i < decoders.length; i++) {
      if (!decoders[i].decodePortableAttributeFinish()) {
        return false
      }
    }
    for (let i = 0; i < decoders.length; i++) {
      if (!decoders[i].transformAttributeToOriginalFormat(this._pointIds)) {
        return false
      }
    }
    return true
  }

  getPortableAttribute(pointAttributeId: number): PointAttribute | null {
    const locId = this.getLocalIdForPointAttribute(pointAttributeId)
    if (locId < 0) {
      return null
    }
    return this._sequentialDecoders[locId].getPortableAttribute()
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
    }
    return null
  }
}

export { SequentialAttributeDecodersController }
