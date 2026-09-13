// Ported from draco.js src/point_cloud/PointCloud.js (MIT)

import type { PointAttribute } from '../attributes/PointAttribute'

// Must match the C++ GeometryAttribute::Type enum count (and the list count below).
const NAMED_ATTRIBUTES_COUNT = 8

class PointCloud {
  num_points_ = 0
  attributes_: (PointAttribute | null)[] = []
  // named_attribute_index_[type] = [att_id, ...], one list per named type.
  named_attribute_index_: number[][] = [[], [], [], [], [], [], [], []]

  numNamedAttributes(type: number): number {
    if (type < 0 || type >= NAMED_ATTRIBUTES_COUNT) {
      return 0
    }
    return this.named_attribute_index_[type].length
  }

  getNamedAttributeId(type: number, i?: number): number {
    if (i === undefined) i = 0
    if (this.numNamedAttributes(type) <= i) {
      return -1
    }
    return this.named_attribute_index_[type][i]
  }

  getNamedAttribute(type: number, i?: number): PointAttribute | null {
    if (i === undefined) i = 0
    const attId = this.getNamedAttributeId(type, i)
    if (attId === -1) {
      return null
    }
    return this.attributes_[attId]
  }

  getAttributeByUniqueId(uniqueId: number): PointAttribute | null {
    const attId = this.getAttributeIdByUniqueId(uniqueId)
    if (attId === -1) {
      return null
    }
    return this.attributes_[attId]
  }

  getAttributeIdByUniqueId(uniqueId: number): number {
    for (let i = 0; i < this.attributes_.length; ++i) {
      if (this.attributes_[i]!.uniqueId === uniqueId) {
        return i
      }
    }
    return -1
  }

  numAttributes(): number {
    return this.attributes_.length
  }

  attribute(attId: number): PointAttribute {
    return this.attributes_[attId]!
  }

  addAttribute(pa: PointAttribute): number {
    this.setAttribute(this.attributes_.length, pa)
    return this.attributes_.length - 1
  }

  setAttribute(attId: number, pa: PointAttribute): void {
    while (this.attributes_.length <= attId) {
      this.attributes_.push(null)
    }

    if (pa.attributeType < NAMED_ATTRIBUTES_COUNT) {
      this.named_attribute_index_[pa.attributeType].push(attId)
    }

    pa.uniqueId = attId
    this.attributes_[attId] = pa
  }

  numPoints(): number {
    return this.num_points_
  }

  setNumPoints(num: number): void {
    this.num_points_ = num
  }
}

export { PointCloud }
