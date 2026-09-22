// Ported from draco.js src/core/DecoderBuffer.js (MIT)

import { decodeVarint } from './VarintDecoding'

// Bit reader over bytes [start, end) of a buffer; offsets are absolute.
export class BitDecoder {
  _bitBuffer: Uint8Array | null = null
  _bitOffset = 0
  _byteLength = 0

  reset(uint8Array: Uint8Array, start: number, end: number): void {
    this._bitBuffer = uint8Array
    this._byteLength = end
    this._bitOffset = start * 8
  }

  getBits(nbits: number): number | undefined {
    if (nbits > 32) return undefined
    const buf = this._bitBuffer!
    let off = this._bitOffset
    const byteOffset = off >> 3
    const bitShift = off & 7

    // Fast path: enough bytes remain to read 32 bits safely.
    if (byteOffset + 4 < this._byteLength) {
      const val =
        (buf[byteOffset] | (buf[byteOffset + 1] << 8) | (buf[byteOffset + 2] << 16) | (buf[byteOffset + 3] << 24)) >>> 0
      let result
      if (nbits > 32 - bitShift) {
        const val2 = buf[byteOffset + 4]
        const low = val >>> bitShift
        const high = val2 << (32 - bitShift)
        result = (low | high) >>> 0
      } else {
        result = val >>> bitShift
      }

      this._bitOffset = off + nbits
      return nbits === 32 ? result : result & ((1 << nbits) - 1)
    }

    // Safe fallback path near the end of the buffer.
    let value = 0
    let bitsRead = 0
    let currOff = off
    while (bitsRead < nbits) {
      const bOff = currOff >> 3
      if (bOff >= this._byteLength) return undefined
      const bShift = currOff & 7
      const bitsAvail = 8 - bShift
      const bitsNeeded = nbits - bitsRead
      const bitsToRead = bitsAvail < bitsNeeded ? bitsAvail : bitsNeeded
      const mask = (1 << bitsToRead) - 1
      value |= ((buf[bOff] >> bShift) & mask) << bitsRead
      bitsRead += bitsToRead
      currOff += bitsToRead
    }
    this._bitOffset = currOff
    return value
  }
}

// Reinterprets four little-endian bytes as a float32 (decodeFloat32): one
// small DataView for all buffers instead of one per buffer.
const floatBytes = new Uint8Array(4)
const floatView = new DataView(floatBytes.buffer)

export class DecoderBuffer {
  _data: Uint8Array | null = null
  _dataSize = 0
  _pos = 0
  _bitDecoder = new BitDecoder()
  _bitMode = false

  init(data: Uint8Array, dataSize = data.length): void {
    this._data = data
    this._dataSize = dataSize
    this._pos = 0
  }

  // Continues where `other` stands: same bytes, same position (offsets stay
  // absolute, so no view of the remaining bytes is made).
  initFrom(other: DecoderBuffer): void {
    this._data = other._data
    this._dataSize = other._dataSize
    this._pos = other._pos
  }

  // Typed little-endian reads.
  decodeUint8(): number | undefined {
    if (this._pos + 1 > this._dataSize) return undefined
    const val = this._data![this._pos]
    this._pos += 1
    return val
  }

  decodeUint16(): number | undefined {
    const pos = this._pos
    if (pos + 2 > this._dataSize) return undefined
    const data = this._data!
    this._pos = pos + 2
    return data[pos] | (data[pos + 1] << 8)
  }

  decodeInt32(): number | undefined {
    const pos = this._pos
    if (pos + 4 > this._dataSize) return undefined
    const data = this._data!
    this._pos = pos + 4
    return data[pos] | (data[pos + 1] << 8) | (data[pos + 2] << 16) | (data[pos + 3] << 24)
  }

  decodeFloat32(): number | undefined {
    const pos = this._pos
    if (pos + 4 > this._dataSize) return undefined
    const data = this._data!
    this._pos = pos + 4
    floatBytes[0] = data[pos]
    floatBytes[1] = data[pos + 1]
    floatBytes[2] = data[pos + 2]
    floatBytes[3] = data[pos + 3]
    return floatView.getFloat32(0, true)
  }

  // A view into the stream (no copy), only valid until the caller's next
  // chance to mutate the buffer — copy out before keeping it.
  decodeBytesView(size: number): Uint8Array | undefined {
    if (this._pos + size > this._dataSize) return undefined
    const result = this._data!.subarray(this._pos, this._pos + size)
    this._pos += size
    return result
  }

  // Only the 2.2+ layout (varint size prefix): older bitstreams are rejected
  // before any bit decoding starts.
  startBitDecoding(decodeSize: boolean): number | undefined {
    let outSize = 0
    if (decodeSize) {
      const size = decodeVarint(this)
      if (size === undefined) return undefined
      outSize = size
    }
    this._bitMode = true
    this._bitDecoder.reset(this._data!, this._pos, this._dataSize)
    return outSize
  }

  endBitDecoding(): void {
    this._bitMode = false
    this._pos = Math.ceil(this._bitDecoder._bitOffset / 8)
  }

  decodeLeastSignificantBits32(nbits: number): number | undefined {
    if (!this._bitMode) return undefined
    return this._bitDecoder.getBits(nbits)
  }

  advance(bytes: number): void {
    this._pos += bytes
  }

  get data(): Uint8Array {
    return this._data!
  }
  get remainingSize(): number {
    return this._dataSize - this._pos
  }
  get decodedSize(): number {
    return this._pos
  }
  get bitDecoderActive(): boolean {
    return this._bitMode
  }
}
