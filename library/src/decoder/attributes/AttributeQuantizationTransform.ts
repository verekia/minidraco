// Ported from draco.js src/attributes/AttributeQuantizationTransform.js (MIT)

import { DataType } from '../core/DracoTypes'
import { AttributeTransform } from './AttributeTransform'
import { AttributeTransformType } from './AttributeTransformType'

import type { DecoderBuffer } from '../core/DecoderBuffer'
import type { AttributeTransformData } from './AttributeTransformData'
import type { PointAttribute } from './PointAttribute'

class AttributeQuantizationTransform extends AttributeTransform {
  _quantizationBits = -1
  _minValues: number[] = []
  _range = 0

  override copyToAttributeTransformData(outData: AttributeTransformData): void {
    outData.transformType = AttributeTransformType.QUANTIZATION_TRANSFORM
    outData.appendParameterValue(this._quantizationBits, 'int32')
    for (let i = 0; i < this._minValues.length; i++) {
      outData.appendParameterValue(this._minValues[i], 'float32')
    }
    outData.appendParameterValue(this._range, 'float32')
  }

  override decodeParameters(attribute: PointAttribute, decoderBuffer: DecoderBuffer): boolean {
    const numComponents = attribute.numComponents
    this._minValues = new Array<number>(numComponents)

    for (let i = 0; i < numComponents; i++) {
      const val = decoderBuffer.decodeFloat32()
      if (val === undefined) return false
      this._minValues[i] = val
    }

    const range = decoderBuffer.decodeFloat32()
    if (range === undefined) return false
    this._range = range

    const qBits = decoderBuffer.decodeUint8()
    if (qBits === undefined || qBits < 1 || qBits > 30) return false
    this._quantizationBits = qBits
    return true
  }

  override inverseTransformAttribute(attribute: PointAttribute, targetAttribute: PointAttribute): boolean {
    if (targetAttribute.dataType !== DataType.FLOAT32) {
      return false
    }

    const maxQuantizedValue = ((1 << this._quantizationBits) >>> 0) - 1
    if (maxQuantizedValue <= 0) return false
    // C++ Dequantizer computes delta_ as `range / static_cast<float>(max_quantized_value)`
    // in float32. JS double division is 1-2 ULP off the WASM decoder, so fround every step.
    const delta = Math.fround(this._range / Math.fround(maxQuantizedValue))
    const numComponents = targetAttribute.numComponents
    const numValues = targetAttribute.size
    const total = numValues * numComponents
    const minValues = this._minValues

    // The portable (source) attribute holds native-endian int32; the target
    // holds float32. Attribute buffers start at byteOffset 0, so typed-array
    // views are aligned -- read/write through them directly to avoid a
    // per-component DataView dispatch and a per-entry buffer copy.
    const srcData = attribute.buffer!.data
    const srcI32 = new Int32Array(srcData.buffer, srcData.byteOffset + attribute.byteOffset, total)
    const dstData = targetAttribute.buffer!.data
    const dstF32 = new Float32Array(dstData.buffer, dstData.byteOffset + targetAttribute.byteOffset, total)

    // Mirror Draco C++ float32 arithmetic so the result is bit-identical to the
    // WASM decoder: `value` (int) is converted to float, multiplied by the
    // float `delta` (both rounded to float32), then added to the float32 min.
    // The Float32Array store performs the final round of the addition.
    const fround = Math.fround

    // Specialize nc=3/2 (positions/texcoords) with minValues hoisted to locals;
    // same operands/order as the generic path below, so bit-identical.
    if (numComponents === 3) {
      const m0 = minValues[0],
        m1 = minValues[1],
        m2 = minValues[2]
      for (let o = 0; o < total; o += 3) {
        dstF32[o] = fround(fround(srcI32[o]) * delta) + m0
        dstF32[o + 1] = fround(fround(srcI32[o + 1]) * delta) + m1
        dstF32[o + 2] = fround(fround(srcI32[o + 2]) * delta) + m2
      }
      return true
    }
    if (numComponents === 2) {
      const m0 = minValues[0],
        m1 = minValues[1]
      for (let o = 0; o < total; o += 2) {
        dstF32[o] = fround(fround(srcI32[o]) * delta) + m0
        dstF32[o + 1] = fround(fround(srcI32[o + 1]) * delta) + m1
      }
      return true
    }

    let o = 0
    for (let i = 0; i < numValues; i++) {
      for (let c = 0; c < numComponents; c++) {
        dstF32[o] = fround(fround(srcI32[o]) * delta) + minValues[c]
        o++
      }
    }
    return true
  }
}

export { AttributeQuantizationTransform }
