// Ported from draco.js src/attributes/AttributeTransformData.js (MIT)

import { AttributeTransformType } from './AttributeTransformType'

// Parameters are kept as (value, type) pairs and serialized to their
// little-endian byte layout only when `data` is read: every attribute of
// every primitive appends a handful of values here, and building a byte
// buffer plus a DataView per attribute up front was measurable on
// primitive-heavy files while nothing in the decoder reads the bytes back.
class AttributeTransformData {
  _transformType: number
  _values: number[]
  _types: string[]
  _size: number
  _bytes: Uint8Array | null

  constructor() {
    this._transformType = AttributeTransformType.INVALID
    this._values = []
    this._types = []
    this._size = 0
    this._bytes = null
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

  // Parameter bytes, little-endian, in append order.
  get data(): Uint8Array {
    if (this._bytes === null) {
      const bytes = new Uint8Array(this._size)
      const view = new DataView(bytes.buffer)
      let offset = 0
      for (let i = 0; i < this._values.length; ++i) {
        const type = this._types[i]
        AttributeTransformData._write(view, offset, this._values[i], type)
        offset += AttributeTransformData._typeSize(type)
      }
      this._bytes = bytes
    }
    return this._bytes
  }

  static _write(view: DataView, byteOffset: number, value: number, type: string): void {
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

  // Writes a value at a byte offset. Appends (the decoder's only use) are
  // recorded as pairs; a write anywhere else materializes the bytes first.
  setParameterValue(byteOffset: number, value: number, type: string): void {
    if (byteOffset === this._size && this._bytes === null) {
      this._values.push(value)
      this._types.push(type)
      this._size += AttributeTransformData._typeSize(type)
      return
    }
    const sizeNeeded = byteOffset + AttributeTransformData._typeSize(type)
    const current = this.data
    let bytes = current
    if (sizeNeeded > current.length) {
      bytes = new Uint8Array(sizeNeeded)
      bytes.set(current)
    }
    AttributeTransformData._write(new DataView(bytes.buffer), byteOffset, value, type)
    this._bytes = bytes
    if (sizeNeeded > this._size) {
      this._size = sizeNeeded
    }
  }

  appendParameterValue(value: number, type: string): void {
    this.setParameterValue(this._size, value, type)
  }

  static _typeSize(type: string): number {
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

  _typeSize(type: string): number {
    return AttributeTransformData._typeSize(type)
  }
}

export { AttributeTransformData }
