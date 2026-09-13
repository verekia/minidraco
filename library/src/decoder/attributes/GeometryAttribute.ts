// Ported from draco.js src/attributes/GeometryAttribute.js (MIT)

import { DataType } from '../core/DracoTypes'

import type { DataBuffer } from '../core/DataBuffer'

const Type = {
  INVALID: -1,
  POSITION: 0,
  NORMAL: 1,
  COLOR: 2,
  TEX_COORD: 3,
  GENERIC: 4,
  NAMED_ATTRIBUTES_COUNT: 5,
} as const

class GeometryAttribute {
  _buffer: DataBuffer | null = null
  _numComponents = 1
  _dataType: number = DataType.FLOAT32
  _normalized = false
  _byteStride = 0
  _byteOffset = 0
  _attributeType: number = Type.INVALID
  _uniqueId = 0

  init(
    attributeType: number,
    buffer: DataBuffer | null,
    numComponents: number,
    dataType: number,
    normalized: boolean,
    byteStride: number,
    byteOffset: number,
  ): void {
    this._buffer = buffer
    this._numComponents = numComponents
    this._dataType = dataType
    this._normalized = normalized
    this._byteStride = byteStride
    this._byteOffset = byteOffset
    this._attributeType = attributeType
  }

  resetBuffer(buffer: DataBuffer, byteStride: number, byteOffset: number): void {
    this._buffer = buffer
    this._byteStride = byteStride
    this._byteOffset = byteOffset
  }

  get attributeType(): number {
    return this._attributeType
  }

  get dataType(): number {
    return this._dataType
  }

  get numComponents(): number {
    return this._numComponents
  }

  get buffer(): DataBuffer | null {
    return this._buffer
  }

  get byteStride(): number {
    return this._byteStride
  }

  get byteOffset(): number {
    return this._byteOffset
  }

  get uniqueId(): number {
    return this._uniqueId
  }
  set uniqueId(id: number) {
    this._uniqueId = id
  }
}

export { GeometryAttribute, Type as GeometryAttributeType }
