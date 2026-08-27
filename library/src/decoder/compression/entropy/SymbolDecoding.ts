// Ported from draco.js src/compression/entropy/SymbolDecoding.js (MIT)

import { SymbolCodingMethod } from '../config/CompressionShared'
import { RAnsSymbolDecoder } from './RAnsSymbolDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'

// Decodes numValues entropy-coded symbols into outValues (Uint32Array).
// numComponents is used for tagged coding. Returns false on error.
export function decodeSymbols(
  numValues: number,
  numComponents: number,
  srcBuffer: DecoderBuffer,
  outValues: Uint32Array,
): boolean {
  if (numValues === 0) {
    return true
  }
  const scheme = srcBuffer.decodeUint8()
  if (scheme === undefined) {
    return false
  }
  if (scheme === SymbolCodingMethod.SYMBOL_CODING_TAGGED) {
    return decodeTaggedSymbols(numValues, numComponents, srcBuffer, outValues)
  } else if (scheme === SymbolCodingMethod.SYMBOL_CODING_RAW) {
    return decodeRawSymbols(numValues, srcBuffer, outValues)
  }
  return false
}

export function decodeTaggedSymbols(
  numValues: number,
  numComponents: number,
  srcBuffer: DecoderBuffer,
  outValues: Uint32Array,
): boolean {
  const tagDecoder = new RAnsSymbolDecoder(5)
  if (!tagDecoder.create(srcBuffer)) {
    return false
  }

  if (!tagDecoder.startDecoding(srcBuffer)) {
    return false
  }

  if (numValues > 0 && tagDecoder.numSymbols === 0) {
    return false
  }

  const tagAns = tagDecoder.ans_

  srcBuffer.startBitDecoding(false)
  // After startBitDecoding(false) the buffer is in bit mode; read the bits
  // straight out of the bit decoder's state rather than through getBits(),
  // which reloads all three of its fields per component.
  const bd = srcBuffer._bitDecoder
  const buf = bd._bitBuffer!
  const byteLength = bd._byteLength
  let bitOffset = bd._bitOffset
  let valueId = 0
  for (let i = 0; i < numValues; i += numComponents) {
    const bitLength = tagAns.ransRead()
    // getBits' fast path needs 5 readable bytes and a mask that fits in 31
    // bits; anything else (a wide or out-of-range tag, the tail of the buffer)
    // falls back to it, which also produces the undefined that ends the decode.
    if (bitLength < 32) {
      const mask = (1 << bitLength) - 1
      let j = 0
      for (; j < numComponents; ++j) {
        const byteOffset = bitOffset >> 3
        if (byteOffset + 4 >= byteLength) break
        const bitShift = bitOffset & 7
        let value =
          (buf[byteOffset] | (buf[byteOffset + 1] << 8) | (buf[byteOffset + 2] << 16) | (buf[byteOffset + 3] << 24)) >>>
          bitShift
        if (bitLength > 32 - bitShift) {
          value = (value | (buf[byteOffset + 4] << (32 - bitShift))) >>> 0
        }
        bitOffset += bitLength
        outValues[valueId++] = value & mask
      }
      if (j === numComponents) continue
      bd._bitOffset = bitOffset
      for (; j < numComponents; ++j) {
        const val = bd.getBits(bitLength)
        if (val === undefined) {
          return false
        }
        outValues[valueId++] = val
      }
      bitOffset = bd._bitOffset
    } else {
      bd._bitOffset = bitOffset
      for (let j = 0; j < numComponents; ++j) {
        const val = bd.getBits(bitLength)
        if (val === undefined) {
          return false
        }
        outValues[valueId++] = val
      }
      bitOffset = bd._bitOffset
    }
  }
  bd._bitOffset = bitOffset
  tagDecoder.endDecoding()
  srcBuffer.endBitDecoding()
  return true
}

function decodeRawSymbolsInternal(
  uniqueSymbolsBitLength: number,
  numValues: number,
  srcBuffer: DecoderBuffer,
  outValues: Uint32Array,
): boolean {
  const decoder = new RAnsSymbolDecoder(uniqueSymbolsBitLength)
  if (!decoder.create(srcBuffer)) {
    return false
  }

  if (numValues > 0 && decoder.numSymbols === 0) {
    return false
  }

  if (!decoder.startDecoding(srcBuffer)) {
    return false
  }
  decoder.ans_.decodeSymbols(outValues, numValues)
  decoder.endDecoding()
  return true
}

function decodeRawSymbols(numValues: number, srcBuffer: DecoderBuffer, outValues: Uint32Array): boolean {
  const maxBitLength = srcBuffer.decodeUint8()
  if (maxBitLength === undefined) {
    return false
  }
  if (maxBitLength < 1 || maxBitLength > 18) {
    return false
  }
  return decodeRawSymbolsInternal(maxBitLength, numValues, srcBuffer, outValues)
}
