// Ported from draco.js src/compression/attributes/SequentialQuantizationAttributeDecoder.js (MIT)

import { AttributeQuantizationTransform } from '../../attributes/AttributeQuantizationTransform'
import { DataType } from '../../core/DracoTypes'
import { SequentialIntegerAttributeDecoder } from './SequentialIntegerAttributeDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'

// Decoder for attribute values encoded with the
// SequentialQuantizationAttributeEncoder.
class SequentialQuantizationAttributeDecoder extends SequentialIntegerAttributeDecoder {
  _quantizationTransform = new AttributeQuantizationTransform()

  override init(decoder: PointCloudDecoder, attributeId: number): boolean {
    if (!super.init(decoder, attributeId)) {
      return false
    }
    // Only floating point attributes can be quantized.
    return this.attribute!.dataType === DataType.FLOAT32
  }

  override decodeDataNeededByPortableTransform(_pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    // The portable attribute is null only in backward-compatibility mode; fall
    // back to the raw attribute.
    const att = this.getPortableAttribute() ?? this.attribute!
    if (!this._quantizationTransform.decodeParameters(att, buffer)) {
      return false
    }
    return this._quantizationTransform.transferToAttribute(this._portableAttribute!)
  }

  // Dequantize the values instead of a generic integer store.
  override _storeValues(_numValues: number): boolean {
    return this._quantizationTransform.inverseTransformAttribute(this.getPortableAttribute()!, this.attribute!)
  }
}

export { SequentialQuantizationAttributeDecoder }
