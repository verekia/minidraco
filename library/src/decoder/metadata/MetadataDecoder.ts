// Ported from draco.js src/metadata/MetadataDecoder.js (MIT)
// Metadata is never surfaced, so this only parses far enough to consume the exact
// bytes it occupies, keeping the bitstream aligned. (Full port lives in git history.)

import { decodeVarint } from '../core/VarintDecoding'

import type { DecoderBuffer } from '../core/DecoderBuffer'

// Nesting-depth cap to avoid stack overflow.
const kMaxSubmetadataLevel = 1000

class MetadataDecoder {
  constructor(readonly buffer_: DecoderBuffer) {}

  // Skips per-attribute metadata followed by the geometry-level metadata.
  skipGeometryMetadata(): boolean {
    const numAttMetadata = decodeVarint(this.buffer_)
    if (numAttMetadata === undefined) {
      return false
    }

    for (let i = 0; i < numAttMetadata; ++i) {
      // Attribute unique id, then its metadata block.
      if (decodeVarint(this.buffer_) === undefined) {
        return false
      }
      if (!this._skipMetadata(0)) {
        return false
      }
    }

    return this._skipMetadata(0)
  }

  // Discards one metadata block (key-value entries plus nested sub-metadata).
  // Sub-blocks read depth-first in stream order, matching the C++ stack traversal.
  _skipMetadata(level: number): boolean {
    if (level > kMaxSubmetadataLevel) {
      return false
    }

    const numEntries = decodeVarint(this.buffer_)
    if (numEntries === undefined) {
      return false
    }
    for (let i = 0; i < numEntries; ++i) {
      // Key-value entry: name then a length-prefixed value.
      const nameSkipped = this._skipName()
      const dataSize = nameSkipped ? decodeVarint(this.buffer_) : undefined
      if (dataSize === undefined || dataSize === 0 || !this._skipBytes(dataSize)) {
        return false
      }
    }

    const numSubMetadata = decodeVarint(this.buffer_)
    if (numSubMetadata === undefined || numSubMetadata > this.buffer_.remainingSize) {
      return false
    }
    for (let i = 0; i < numSubMetadata; ++i) {
      // Sub-metadata name, then its block.
      if (!this._skipName() || !this._skipMetadata(level + 1)) {
        return false
      }
    }

    return true
  }

  // Skips a name (uint8 length prefix followed by that many bytes).
  _skipName(): boolean {
    const nameLen = this.buffer_.decodeUint8()
    if (nameLen === undefined) {
      return false
    }
    return this._skipBytes(nameLen)
  }

  _skipBytes(size: number): boolean {
    if (size > this.buffer_.remainingSize) {
      return false
    }
    this.buffer_.advance(size)
    return true
  }
}

export { MetadataDecoder }
