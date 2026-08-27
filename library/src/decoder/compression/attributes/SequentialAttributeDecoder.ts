// Ported from draco.js src/compression/attributes/SequentialAttributeDecoder.js (MIT)

import type { PointAttribute } from '../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'
import type { PredictionSchemeDecoderInterface } from './prediction_schemes/PredictionSchemeDecoderInterface'

// A base class for decoding attribute values encoded by the
// SequentialAttributeEncoder.
class SequentialAttributeDecoder {
  _decoder: PointCloudDecoder | null
  _attribute: PointAttribute | null
  _attributeId: number
  // Decoded portable attribute (after lossless decoding).
  _portableAttribute: PointAttribute | null

  constructor() {
    this._decoder = null
    this._attribute = null
    this._attributeId = -1
    this._portableAttribute = null
  }

  init(decoder: PointCloudDecoder, attributeId: number): boolean {
    this._decoder = decoder
    this._attribute = decoder.pointCloud()!.attribute(attributeId)!
    this._attributeId = attributeId
    return true
  }

  decodePortableAttribute(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    if (this._attribute!.numComponents <= 0) {
      return false
    }
    if (!this._attribute!.reset(pointIds.length)) {
      return false
    }
    return this.decodeValues(pointIds, buffer)
  }

  // No-op by default; subclasses with a transform override this.
  decodeDataNeededByPortableTransform(_pointIds: Int32Array, _buffer: DecoderBuffer): boolean {
    return true
  }

  // No-op by default; subclasses with a transform override this.
  transformAttributeToOriginalFormat(_pointIds: Int32Array): boolean {
    return true
  }

  getPortableAttribute(): PointAttribute | null {
    // Copy point->value index mapping from the final attribute to the portable
    // one. Both maps are Uint32Array, so copy in one shot instead of per-entry
    // mappedIndex()/setPointMapEntry() calls.
    if (!this._attribute!.isMappingIdentity && this._portableAttribute && this._portableAttribute.isMappingIdentity) {
      const size = this._attribute!.indicesMapSize
      this._portableAttribute.setExplicitMappingScratch(size) // dst.set() below writes every entry
      const src = this._attribute!.indicesMap as Uint32Array
      const dst = this._portableAttribute.indicesMap as Uint32Array
      if (src.length === size) {
        dst.set(src)
      } else {
        dst.set(src.subarray(0, size))
      }
    }
    return this._portableAttribute
  }

  get attribute(): PointAttribute | null {
    return this._attribute
  }

  get attributeId(): number {
    return this._attributeId
  }

  get decoder(): PointCloudDecoder | null {
    return this._decoder
  }

  initPredictionScheme(ps: PredictionSchemeDecoderInterface): boolean {
    for (let i = 0; i < ps.getNumParentAttributes(); i++) {
      const attId = this._decoder!.pointCloud()!.getNamedAttributeId(ps.getParentAttributeType(i))
      if (attId === -1) {
        return false // Requested attribute does not exist.
      }
      const pa = this._decoder!.getPortableAttribute(attId)
      if (pa === null || !ps.setParentAttribute(pa)) {
        return false
      }
    }
    return true
  }

  // Decodes raw attribute values in their original format.
  decodeValues(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    const numValues = pointIds.length
    const entrySize = this._attribute!.byteStride
    // Raw values sit contiguously in the stream in the exact layout the
    // attribute buffer uses, so copy them in one block instead of allocating
    // a slice per value (that loop dominated raw sequential decode time).
    const totalSize = numValues * entrySize
    const valueData = buffer.decodeBytesView(totalSize)
    if (valueData === undefined) {
      return false
    }
    this._attribute!.buffer!.write(0, valueData, totalSize)
    return true
  }

  setPortableAttribute(att: PointAttribute): void {
    this._portableAttribute = att
  }

  get portableAttribute(): PointAttribute | null {
    return this._portableAttribute
  }
}

export { SequentialAttributeDecoder }
