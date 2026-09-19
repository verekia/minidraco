// Ported from draco.js src/compression/attributes/SequentialQuantizationAttributeDecoder.js (MIT)
// (with the AttributeQuantizationTransform parameters folded in)

import { DataType } from '../../core/DracoTypes'
import { SequentialIntegerAttributeDecoder } from './SequentialIntegerAttributeDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'

// Decoder for attribute values encoded with the
// SequentialQuantizationAttributeEncoder.
class SequentialQuantizationAttributeDecoder extends SequentialIntegerAttributeDecoder {
  _quantizationBits = -1
  _minValues: number[] = []
  _range = 0

  override init(decoder: PointCloudDecoder, attributeId: number): boolean {
    if (!super.init(decoder, attributeId)) {
      return false
    }
    // Only floating point attributes can be quantized.
    return this.attribute!.dataType === DataType.FLOAT32
  }

  // The quantization parameters (AttributeQuantizationTransform::DecodeParameters).
  override decodeDataNeededByPortableTransform(_pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    const numComponents = this.attribute!.numComponents
    this._minValues = new Array<number>(numComponents)
    for (let i = 0; i < numComponents; i++) {
      const val = buffer.decodeFloat32()
      if (val === undefined) return false
      this._minValues[i] = val
    }

    const range = buffer.decodeFloat32()
    if (range === undefined) return false
    this._range = range

    const qBits = buffer.decodeUint8()
    if (qBits === undefined || qBits < 1 || qBits > 30) return false
    this._quantizationBits = qBits
    return true
  }

  // Dequantization is deferred to extractTo (see PointAttribute.setLazyQuantized).
  override _storeValues(_numValues: number): boolean {
    const maxQuantizedValue = ((1 << this._quantizationBits) >>> 0) - 1
    if (maxQuantizedValue <= 0) return false
    // C++ Dequantizer: delta = range / static_cast<float>(max_quantized_value).
    const delta = Math.fround(this._range / Math.fround(maxQuantizedValue))
    this.attribute!.setLazyQuantized(this._portableData, this._minValues, delta, this._valuesBounded())
    return true
  }
}

export { SequentialQuantizationAttributeDecoder }
