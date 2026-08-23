// Ported from draco.js src/compression/mesh/MeshEdgebreakerTraversalDecoder.js (MIT)

import { DecoderBuffer } from '../../core/DecoderBuffer'
import { RAnsBitDecoder } from '../bit_coders/RAnsBitDecoder'
import { TOPOLOGY_C } from './MeshEdgebreakerShared'

import type { BitDecoder } from '../../core/DecoderBuffer'
import type { MeshEdgebreakerDecoderImpl } from './MeshEdgebreakerDecoderImpl'

// Default traversal decoder: reads traversal data directly from a buffer.
class MeshEdgebreakerTraversalDecoder {
  _buffer: DecoderBuffer
  _symbolBuffer: DecoderBuffer
  _startFaceDecoder: RAnsBitDecoder | null
  _attributeConnectivityDecoders: RAnsBitDecoder[] | null
  _numAttributeData: number
  _decoderImpl: MeshEdgebreakerDecoderImpl | null
  // _symbolBuffer's bit cursor, captured once bit decoding starts: decodeSymbol
  // runs per decoded face and would otherwise reach it through two property
  // loads and a method call per read.
  _symbolBits: BitDecoder | null

  constructor() {
    this._buffer = new DecoderBuffer()
    this._symbolBuffer = new DecoderBuffer()
    this._startFaceDecoder = null // RAnsBitDecoder
    this._attributeConnectivityDecoders = null // Array of RAnsBitDecoder
    this._numAttributeData = 0
    this._decoderImpl = null
    this._symbolBits = null
  }

  init(decoder: MeshEdgebreakerDecoderImpl): void {
    this._decoderImpl = decoder
    const srcBuffer = decoder.getDecoder()!.buffer()!
    this._buffer.init(srcBuffer.dataHead, srcBuffer.remainingSize, srcBuffer.bitstreamVersion)
  }

  bitstreamVersion(): number {
    return this._decoderImpl!.getDecoder()!.bitstreamVersion()
  }

  // Ignored by default; overridden by predictive/valence decoders.
  setNumEncodedVertices(_numVertices: number): void {}

  setNumAttributeData(numData: number): void {
    this._numAttributeData = numData
  }

  // Sets outBuffer to the data encoded after the traversal section.
  start(outBuffer: DecoderBuffer): boolean {
    if (!this.decodeTraversalSymbols()) {
      return false
    }
    if (!this.decodeStartFaces()) {
      return false
    }
    if (!this.decodeAttributeSeams()) {
      return false
    }
    outBuffer.init(this._buffer.dataHead, this._buffer.remainingSize, this._buffer.bitstreamVersion)
    return true
  }

  decodeStartFaceConfiguration(): boolean {
    if (this._startFaceDecoder === null) return false
    return this._startFaceDecoder.decodeNextBit() ? true : false
  }

  decodeSymbol(): number {
    // A symbol is one bit, plus two more unless it is C -- three bits that
    // always sit inside the same 32-bit window that getBits' fast path builds,
    // so read them in one go when that path's five-byte margin is available.
    const bd = this._symbolBits
    if (bd !== null) {
      const buf = bd._bitBuffer!
      const off = bd._bitOffset
      const byteOffset = off >> 3
      if (byteOffset + 4 < bd._byteLength) {
        const bits =
          ((buf[byteOffset] |
            (buf[byteOffset + 1] << 8) |
            (buf[byteOffset + 2] << 16) |
            (buf[byteOffset + 3] << 24)) >>>
            (off & 7)) &
          7
        if ((bits & 1) === TOPOLOGY_C) {
          bd._bitOffset = off + 1
          return TOPOLOGY_C
        }
        bd._bitOffset = off + 3
        return bits
      }
    }
    let symbol = this._symbolBuffer.decodeLeastSignificantBits32(1)!
    if (symbol === TOPOLOGY_C) {
      return symbol
    }
    // Non-C symbols carry two additional bits.
    const symbolSuffix = this._symbolBuffer.decodeLeastSignificantBits32(2)!
    symbol |= symbolSuffix << 1
    return symbol
  }

  newActiveCornerReached(_corner: number): void {}

  mergeVertices(_dest: number, _source: number): void {}

  done(): void {
    if (this._symbolBuffer.bitDecoderActive) {
      this._symbolBuffer.endBitDecoding()
    }
    if (this._startFaceDecoder !== null) {
      this._startFaceDecoder.endDecoding()
    }
  }

  get buffer(): DecoderBuffer {
    return this._buffer
  }

  decodeTraversalSymbols(): boolean {
    this._symbolBuffer.init(this._buffer.dataHead, this._buffer.remainingSize, this._buffer.bitstreamVersion)
    const traversalSize = this._symbolBuffer.startBitDecoding(true)
    if (traversalSize === undefined) {
      return false
    }
    this._symbolBits = this._symbolBuffer._bitDecoder
    // Advance the main buffer past the symbol data.
    this._buffer.init(
      this._symbolBuffer.dataHead,
      this._symbolBuffer.remainingSize,
      this._symbolBuffer.bitstreamVersion,
    )
    if (traversalSize > this._buffer.remainingSize) {
      return false
    }
    this._buffer.advance(traversalSize)
    return true
  }

  decodeStartFaces(): boolean {
    // Start faces are coded with an RAnsBitDecoder.
    try {
      this._startFaceDecoder = this._createRAnsBitDecoder()
      if (this._startFaceDecoder === null) {
        return false
      }
      return this._startFaceDecoder.startDecoding(this._buffer)
    } catch {
      return false
    }
  }

  decodeAttributeSeams(): boolean {
    if (this._numAttributeData > 0) {
      this._attributeConnectivityDecoders = []
      for (let i = 0; i < this._numAttributeData; ++i) {
        const decoder = this._createRAnsBitDecoder()
        if (decoder === null) {
          return false
        }
        if (!decoder.startDecoding(this._buffer)) {
          return false
        }
        this._attributeConnectivityDecoders.push(decoder)
      }
    }
    return true
  }

  _createRAnsBitDecoder(): RAnsBitDecoder | null {
    return new RAnsBitDecoder()
  }
}

export { MeshEdgebreakerTraversalDecoder }
