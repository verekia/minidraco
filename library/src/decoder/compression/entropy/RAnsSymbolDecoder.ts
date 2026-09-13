// Ported from draco.js src/compression/entropy/RAnsSymbolDecoder.js (MIT)

import { scratchUint32Zeroed } from '../../core/ScratchArena'
import { decodeVarint } from '../../core/VarintDecoding'
import { ansReadInit, RAnsDecoder } from './ANSCoding'

import type { DecoderBuffer } from '../../core/DecoderBuffer'

// Decodes symbols using rANS. uniqueSymbolsBitLength must match the encoder's.
export class RAnsSymbolDecoder {
  numSymbols_ = 0
  ans_: RAnsDecoder

  constructor(uniqueSymbolsBitLength: number) {
    // rANS precision for the unique-symbols bit length, clamped to [12, 20].
    const unclamped = Math.trunc((3 * uniqueSymbolsBitLength) / 2)
    this.ans_ = new RAnsDecoder(unclamped < 12 ? 12 : unclamped > 20 ? 20 : unclamped)
  }

  get numSymbols(): number {
    return this.numSymbols_
  }

  // Initialize the decoder and decode the probability table. expectedCount is
  // the number of symbols the caller will decode (lets short streams skip the
  // full lookup table; see RAnsDecoder.ransBuildLookUpTable).
  create(buffer: DecoderBuffer, expectedCount: number = 0x7fffffff): boolean {
    const numSymbols = decodeVarint(buffer)
    if (numSymbols === undefined) return false
    this.numSymbols_ = numSymbols

    // Reject an unreasonably high symbol count.
    if (Math.trunc(numSymbols / 64) > buffer.remainingSize) {
      return false
    }

    // Decode-scoped scratch: this table only feeds ransBuildLookUpTable below,
    // and a primitive-heavy file builds thousands of symbol decoders. Zeroed
    // because run-length tokens leave their entries untouched.
    const probabilityTable = scratchUint32Zeroed(numSymbols)
    if (numSymbols === 0) {
      return true
    }

    // Read via a local cursor instead of a decodeUint8() call per byte.
    const data = buffer.data!
    const startPos = buffer.decodedSize
    const endPos = startPos + buffer.remainingSize
    let pos = startPos
    for (let i = 0; i < numSymbols; ++i) {
      if (pos >= endPos) return false
      const probData = data[pos++]

      // Low 2 bits = token: 0-2 is the extra-byte count, 3 is run-length of zero-prob entries.
      const token = probData & 3
      if (token === 3) {
        const offset = probData >> 2
        if (i + offset >= numSymbols) {
          return false
        }
        // The run's probabilities stay 0; the freshly allocated table already is.
        i += offset
      } else {
        const extraBytes = token
        let prob = probData >> 2
        for (let b = 0; b < extraBytes; ++b) {
          if (pos >= endPos) return false
          // Shift 8 bits per extra byte, minus 2 for the two token bits.
          prob |= data[pos++] << (8 * (b + 1) - 2)
        }
        probabilityTable[i] = prob
      }
    }
    buffer.advance(pos - startPos)

    return this.ans_.ransBuildLookUpTable(probabilityTable, numSymbols, expectedCount)
  }

  // Starts decoding, advancing buffer past the encoded data.
  startDecoding(buffer: DecoderBuffer): boolean {
    const bytesEncoded = decodeVarint(buffer)
    if (bytesEncoded === undefined) return false

    if (bytesEncoded > buffer.remainingSize) {
      return false
    }

    // Absolute offsets into the source buffer — avoids a dataHead subarray
    // allocation per symbol decoder (thousands per primitive-heavy GLB).
    const base = buffer.decodedSize
    buffer.advance(Number(bytesEncoded))
    return ansReadInit(this.ans_, buffer.data, base + Number(bytesEncoded), base, this.ans_.lRansBase, 4)
  }

  endDecoding(): void {
    this.ans_.readEnd()
  }
}
