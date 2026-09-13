// Ported from draco.js src/compression/bit_coders/RAnsBitDecoder.js (MIT)

import { decodeVarint } from '../../core/VarintDecoding'
import { AnsDecoder, ansReadInit, ANS_L_BASE, ANS_P8_PRECISION } from '../entropy/ANSCoding'

import type { DecoderBuffer } from '../../core/DecoderBuffer'

// Decodes bits encoded with RAnsBitEncoder. MeshEdgebreakerDecoderImpl inlines
// decodeNextBit() over ansDecoder_ and p_ directly, so keep those names.
export class RAnsBitDecoder {
  ansDecoder_ = new AnsDecoder()
  p_ = 0 // ANS_P8_PRECISION - probZero, precomputed

  // Returns false when the data is invalid.
  startDecoding(sourceBuffer: DecoderBuffer): boolean {
    const probZero = sourceBuffer.decodeUint8()
    if (probZero === undefined) {
      return false
    }
    this.p_ = ANS_P8_PRECISION - probZero

    const sizeInBytes = decodeVarint(sourceBuffer)
    if (sizeInBytes === undefined || sizeInBytes > sourceBuffer.remainingSize) {
      return false
    }

    // Absolute offsets into the source buffer — avoids a dataHead subarray
    // allocation per bit decoder.
    const base = sourceBuffer.decodedSize
    if (!ansReadInit(this.ansDecoder_, sourceBuffer.data, base + sizeInBytes, base, ANS_L_BASE, 3)) {
      return false
    }
    sourceBuffer.advance(sizeInBytes)
    return true
  }

  decodeNextBit(): boolean {
    const ans = this.ansDecoder_
    const p = this.p_
    if (ans.state < ANS_L_BASE && ans.bufOffset > ans.bufStart) {
      ans.state = (ans.state << 8) | ans.buf![--ans.bufOffset]
    }
    const x = ans.state
    const quot = x >>> 8
    const rem = x & 0xff
    const xn = quot * p
    if (rem < p) {
      ans.state = xn + rem
      return true
    }
    ans.state = x - xn - p
    return false
  }

  endDecoding(): void {}
}
