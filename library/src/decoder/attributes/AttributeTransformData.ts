// Ported from draco.js src/attributes/AttributeTransformData.js (MIT)

import { AttributeTransformType } from './AttributeTransformType'

// Parameters are kept as (value, type) pairs in append order and never
// serialized: every attribute of every primitive appends a handful of values
// here, building a byte buffer plus a DataView per attribute up front was
// measurable on primitive-heavy files, and nothing in the decoder reads the
// bytes back.
class AttributeTransformData {
  transformType: number = AttributeTransformType.INVALID
  _values: number[] = []
  _types: string[] = []

  appendParameterValue(value: number, type: string): void {
    this._values.push(value)
    this._types.push(type)
  }
}

export { AttributeTransformData }
