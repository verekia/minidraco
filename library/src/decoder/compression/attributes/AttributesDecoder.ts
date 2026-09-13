// Ported from draco.js src/compression/attributes/AttributesDecoder.js (MIT)

import { GeometryAttribute, GeometryAttributeType } from '../../attributes/GeometryAttribute'
import { PointAttribute } from '../../attributes/PointAttribute'
import { DataType, dataTypeLength } from '../../core/DracoTypes'
import { decodeVarint } from '../../core/VarintDecoding'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloud } from '../../point_cloud/PointCloud'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'

// Base class for AttributesDecoders; shared functionality for all of them.
class AttributesDecoder {
  _pointAttributeIds: number[] = []
  // Inverse of _pointAttributeIds: point attribute id -> local id.
  _pointAttributeToLocalIdMap: number[] = []
  _pointCloudDecoder: PointCloudDecoder | null = null
  _pointCloud: PointCloud | null = null

  init(decoder: PointCloudDecoder, pointCloud: PointCloud): boolean {
    this._pointCloudDecoder = decoder
    this._pointCloud = pointCloud
    return true
  }

  decodeAttributesDecoderData(buffer: DecoderBuffer): boolean {
    const numAttributes = decodeVarint(buffer)
    // Zero attributes is invalid; more than the buffer could hold is rejected.
    if (numAttributes === undefined || numAttributes === 0 || numAttributes > 5 * buffer.remainingSize) {
      return false
    }

    this._pointAttributeIds.length = numAttributes
    const pc = this._pointCloud!

    for (let i = 0; i < numAttributes; i++) {
      const attType = buffer.decodeUint8()
      if (attType === undefined) return false

      const dataType = buffer.decodeUint8()
      if (dataType === undefined) return false

      const numComponents = buffer.decodeUint8()
      if (numComponents === undefined) return false

      const normalized = buffer.decodeUint8()
      if (normalized === undefined) return false

      if (attType >= GeometryAttributeType.NAMED_ATTRIBUTES_COUNT) {
        return false
      }
      if (dataType === DataType.INVALID || dataType >= DataType.TYPES_COUNT) {
        return false
      }

      if (numComponents === 0) {
        return false
      }

      const ga = new GeometryAttribute()
      ga.init(attType, null, numComponents, dataType, normalized > 0, dataTypeLength(dataType) * numComponents, 0)

      const uniqueId = decodeVarint(buffer)
      if (uniqueId === undefined) return false
      ga.uniqueId = uniqueId

      const attId = pc.addAttribute(new PointAttribute(ga))
      pc.attribute(attId)!.uniqueId = uniqueId
      this._pointAttributeIds[i] = attId

      while (this._pointAttributeToLocalIdMap.length <= attId) {
        this._pointAttributeToLocalIdMap.push(-1)
      }
      this._pointAttributeToLocalIdMap[attId] = i
    }
    return true
  }

  getAttributeId(i: number): number {
    return this._pointAttributeIds[i]
  }

  getNumAttributes(): number {
    return this._pointAttributeIds.length
  }

  getDecoder(): PointCloudDecoder | null {
    return this._pointCloudDecoder
  }

  getLocalIdForPointAttribute(pointAttributeId: number): number {
    if (pointAttributeId >= this._pointAttributeToLocalIdMap.length) {
      return -1
    }
    return this._pointAttributeToLocalIdMap[pointAttributeId]
  }
}

export { AttributesDecoder }
