// Ported from draco.js src/attributes/AttributeTransformData.js (MIT)

import { AttributeTransformType } from './AttributeTransformType'

// Initial parameter-buffer capacity: a quantization transform appends
// 1 + numComponents + 1 values of 4 bytes, so 32 bytes covers every attribute
// the decoder produces without a single grow.
const INITIAL_CAPACITY = 32

class AttributeTransformData {
  _transformType: number
  // Parameter bytes, little-endian, appended in transform-defined order.
  // Capacity grows geometrically and the DataView is cached alongside it: the
  // previous DataBuffer-backed version reallocated the buffer and built a
  // fresh DataView on *every* appended value, which on primitive-heavy files
  // cost more than the dequantization it describes.
  _bytes: Uint8Array
  _view: DataView
  _size: number

  constructor() {
    this._transformType = AttributeTransformType.INVALID
    this._bytes = new Uint8Array(INITIAL_CAPACITY)
    this._view = new DataView(this._bytes.buffer)
    this._size = 0
  }

  get transformType(): number {
    return this._transformType
  }

  set transformType(type: number) {
    this._transformType = type
  }

  // Number of parameter bytes written so far (the next append offset).
  get dataSize(): number {
    return this._size
  }

  get data(): Uint8Array {
    return this._bytes.subarray(0, this._size)
  }

  _reserve(sizeNeeded: number): void {
    if (sizeNeeded <= this._bytes.length) return
    let capacity = this._bytes.length * 2
    if (capacity < sizeNeeded) capacity = sizeNeeded
    const grown = new Uint8Array(capacity)
    grown.set(this._bytes)
    this._bytes = grown
    this._view = new DataView(grown.buffer)
  }

  setParameterValue(byteOffset: number, value: number, type: string): void {
    const sizeNeeded = byteOffset + this._typeSize(type)
    this._reserve(sizeNeeded)
    if (sizeNeeded > this._size) {
      this._size = sizeNeeded
    }
    const view = this._view
    switch (type) {
      case 'int32':
        view.setInt32(byteOffset, value, true)
        break
      case 'uint32':
        view.setUint32(byteOffset, value, true)
        break
      case 'float32':
        view.setFloat32(byteOffset, value, true)
        break
      case 'float64':
        view.setFloat64(byteOffset, value, true)
        break
      case 'int8':
        view.setInt8(byteOffset, value)
        break
      case 'uint8':
        view.setUint8(byteOffset, value)
        break
      case 'int16':
        view.setInt16(byteOffset, value, true)
        break
      case 'uint16':
        view.setUint16(byteOffset, value, true)
        break
      default:
        view.setInt32(byteOffset, value, true)
        break
    }
  }

  appendParameterValue(value: number, type: string): void {
    this.setParameterValue(this._size, value, type)
  }

  _typeSize(type: string): number {
    switch (type) {
      case 'int8':
      case 'uint8':
        return 1
      case 'int16':
      case 'uint16':
        return 2
      case 'int32':
      case 'uint32':
      case 'float32':
        return 4
      case 'float64':
        return 8
      default:
        return 4
    }
  }
}

export { AttributeTransformData }
