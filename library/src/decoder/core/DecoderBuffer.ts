// Ported from draco.js src/core/DecoderBuffer.js (MIT)

import { bitstreamVersion } from './Macros'
import { decodeVarint } from './VarintDecoding'

class BitDecoder {
  _bitBuffer: Uint8Array | null
  _bitOffset: number
  _byteLength: number

  constructor() {
    this._bitBuffer = null
    this._bitOffset = 0
    this._byteLength = 0
  }

  reset(uint8Array: Uint8Array, byteLength: number): void {
    this._bitBuffer = uint8Array
    this._byteLength = byteLength
    this._bitOffset = 0
  }

  bitsDecoded(): number {
    return this._bitOffset
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

export class DecoderBuffer {
  _data: Uint8Array | null
  _dataView: DataView | null
  _dataSize: number
  _pos: number
  _bitDecoder: BitDecoder
  _bitMode: boolean
  _bitstreamVersion: number

  constructor() {
    this._data = null
    this._dataView = null
    this._dataSize = 0
    this._pos = 0
    this._bitDecoder = new BitDecoder()
    this._bitMode = false
    this._bitstreamVersion = 0
  }

  init(data: ArrayBuffer | Uint8Array | ArrayLike<number>, dataSize?: number, version?: number): void {
    if (data instanceof ArrayBuffer) {
      this._data = new Uint8Array(data)
    } else if (data instanceof Uint8Array) {
      this._data = data
    } else {
      this._data = new Uint8Array(data)
    }
    this._dataView = new DataView(this._data.buffer, this._data.byteOffset, this._data.byteLength)
    this._dataSize = dataSize !== undefined ? dataSize : this._data.length
    this._pos = 0
    if (version !== undefined) {
      this._bitstreamVersion = version
    }
  }

  // Typed little-endian reads.
  decodeUint8(): number | undefined {
    if (this._pos + 1 > this._dataSize) return undefined
    const val = this._data![this._pos]
    this._pos += 1
    return val
  }

  decodeInt8(): number | undefined {
    if (this._pos + 1 > this._dataSize) return undefined
    const val = this._dataView!.getInt8(this._pos)
    this._pos += 1
    return val
  }

  decodeUint16(): number | undefined {
    if (this._pos + 2 > this._dataSize) return undefined
    const val = this._dataView!.getUint16(this._pos, true)
    this._pos += 2
    return val
  }

  decodeUint32(): number | undefined {
    if (this._pos + 4 > this._dataSize) return undefined
    const val = this._dataView!.getUint32(this._pos, true)
    this._pos += 4
    return val
  }

  decodeInt32(): number | undefined {
    if (this._pos + 4 > this._dataSize) return undefined
    const val = this._dataView!.getInt32(this._pos, true)
    this._pos += 4
    return val
  }

  decodeFloat32(): number | undefined {
    if (this._pos + 4 > this._dataSize) return undefined
    const val = this._dataView!.getFloat32(this._pos, true)
    this._pos += 4
    return val
  }

  decodeUint64(): number | undefined {
    if (this._pos + 8 > this._dataSize) return undefined
    const lo = this._dataView!.getUint32(this._pos, true)
    const hi = this._dataView!.getUint32(this._pos + 4, true)
    this._pos += 8
    // BigInt-free number, safe up to 2^53.
    return hi * 0x100000000 + lo
  }

  decodeBytes(size: number): Uint8Array | undefined {
    if (this._pos + size > this._dataSize) return undefined
    const result = this._data!.slice(this._pos, this._pos + size)
    this._pos += size
    return result
  }

  // Zero-copy variant of decodeBytes: a view into the stream, only valid until
  // the caller's next chance to mutate the buffer — copy out before keeping it.
  decodeBytesView(size: number): Uint8Array | undefined {
    if (this._pos + size > this._dataSize) return undefined
    const result = this._data!.subarray(this._pos, this._pos + size)
    this._pos += size
    return result
  }

  startBitDecoding(decodeSize: boolean): number | undefined {
    let outSize: number | undefined = 0
    if (decodeSize) {
      if (this._bitstreamVersion < bitstreamVersion(2, 2)) {
        outSize = this.decodeUint64()
        if (outSize === undefined) return undefined
      } else {
        outSize = decodeVarint(this, false)
        if (outSize === undefined) return undefined
      }
    }
    this._bitMode = true
    this._bitDecoder.reset(this._data!.subarray(this._pos), this._dataSize - this._pos)
    return outSize
  }

  endBitDecoding(): void {
    this._bitMode = false
    const bitsDecoded = this._bitDecoder.bitsDecoded()
    const bytesDecoded = Math.ceil(bitsDecoded / 8)
    this._pos += bytesDecoded
  }

  decodeLeastSignificantBits32(nbits: number): number | undefined {
    if (!this._bitMode) return undefined
    return this._bitDecoder.getBits(nbits)
  }

  decodeVarintUint32(): number | undefined {
    return decodeVarint(this, false)
  }

  decodeVarintUint64(): number | undefined {
    return decodeVarint(this, false)
  }

  advance(bytes: number): void {
    this._pos += bytes
  }

  get bitstreamVersion(): number {
    return this._bitstreamVersion
  }
  set bitstreamVersion(v: number) {
    this._bitstreamVersion = v
  }

  get data(): Uint8Array {
    return this._data!
  }
  get dataHead(): Uint8Array {
    return this._data!.subarray(this._pos)
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
