// Ported from draco.js src/attributes/AttributeTransform.js (MIT)

import { AttributeTransformData } from './AttributeTransformData'

import type { DecoderBuffer } from '../core/DecoderBuffer'
import type { PointAttribute } from './PointAttribute'

abstract class AttributeTransform {
  abstract copyToAttributeTransformData(outData: AttributeTransformData): void

  transferToAttribute(attribute: PointAttribute): boolean {
    const transformData = new AttributeTransformData()
    this.copyToAttributeTransformData(transformData)
    attribute.setAttributeTransformData(transformData)
    return true
  }

  abstract inverseTransformAttribute(attribute: PointAttribute, targetAttribute: PointAttribute): boolean

  abstract decodeParameters(attribute: PointAttribute, decoderBuffer: DecoderBuffer): boolean
}

export { AttributeTransform }
