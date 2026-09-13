// Ported from draco.js src/core/VarintDecoding.js (MIT)

import type { DecoderBuffer } from './DecoderBuffer'

// Unsigned varint, MSB continuation coding, at most 10 bytes. Returns
// undefined on error. (The decoder never reads signed varints.)
export function decodeVarint(buffer: DecoderBuffer): number | undefined {
  let result = 0
  let multiplier = 1
  for (let i = 0; i < 10; i++) {
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
