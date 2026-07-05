// Ported from draco.js src/core/VarintDecoding.js (MIT)

import { convertSymbolToSignedInt } from './BitUtils'

import type { DecoderBuffer } from './DecoderBuffer'

// Unsigned varint, MSB continuation coding. Returns undefined on error.
function decodeVarintUnsigned(buffer: DecoderBuffer, maxBytes: number): number | undefined {
  let result = 0
  let multiplier = 1
  for (let i = 0; i < maxBytes; i++) {
    const byte = buffer.decodeUint8()
    if (byte === undefined) return undefined
    if (byte & 0x80) {
      result += (byte & 0x7f) * multiplier
      multiplier *= 128
    } else {
      return result + byte * multiplier
    }
  }
  return undefined
}

// signed applies zigzag decoding. Returns undefined on error.
export function decodeVarint(buffer: DecoderBuffer, signed = false): number | undefined {
  const maxBytes = 10
  const value = decodeVarintUnsigned(buffer, maxBytes)
  if (value === undefined) return undefined
  if (signed) {
    return convertSymbolToSignedInt(value)
  }
  return value
}
