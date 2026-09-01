// Ported from draco.js src/attributes/AttributeOctahedronTransform.js (MIT)

// Reuse the shared OctahedronToolBox (decode math is identical) instead of a hand-synced inline copy.
import { OctahedronToolBox } from '../compression/attributes/NormalCompressionUtils'
import { DataType } from '../core/DracoTypes'
import { AttributeTransform } from './AttributeTransform'
import { AttributeTransformType } from './AttributeTransformType'

import type { DecoderBuffer } from '../core/DecoderBuffer'
import type { AttributeTransformData } from './AttributeTransformData'
import type { PointAttribute } from './PointAttribute'

class AttributeOctahedronTransform extends AttributeTransform {
  _quantizationBits: number

  constructor() {
    super()
    this._quantizationBits = -1
  }

  override copyToAttributeTransformData(outData: AttributeTransformData): void {
    outData.transformType = AttributeTransformType.OCTAHEDRON_TRANSFORM
    outData.appendParameterValue(this._quantizationBits, 'int32')
  }

  override decodeParameters(attribute: PointAttribute, decoderBuffer: DecoderBuffer): boolean {
    const qBits = decoderBuffer.decodeUint8()
    if (qBits === undefined) return false
    this._quantizationBits = qBits
    return true
  }

  override inverseTransformAttribute(attribute: PointAttribute, targetAttribute: PointAttribute): boolean {
    if (targetAttribute.dataType !== DataType.FLOAT32) {
      return false
    }

    const numPoints = targetAttribute.size
    const numComponents = targetAttribute.numComponents
    if (numComponents !== 3) {
      return false
    }

    const toolBox = new OctahedronToolBox()
    if (!toolBox.setQuantizationBits(this._quantizationBits)) {
      return false
    }

    // Source holds native-endian int32 octahedral coords (2 per point); target
    // holds float32 unit vectors (3 per point). Attribute buffers start at
    // byteOffset 0, so typed-array views are aligned -- read/write directly,
    // avoiding a per-point DataView dispatch and per-entry buffer copy.
    const srcAddr = attribute.getAddress(0)
    const srcI32 = new Int32Array(srcAddr.buffer, srcAddr.byteOffset, numPoints * 2)
    const dstAddr = targetAttribute.getAddress(0)
    const dstF32 = new Float32Array(dstAddr.buffer, dstAddr.byteOffset, numPoints * 3)

    // OctahedronToolBox.quantizedOctahedralCoordsToUnitVector inlined (keep in
    // sync): one loop writing straight into the float32 view instead of two
    // calls and a 3-element temp per point. Every Math.fround is kept exactly
    // where the toolbox has it -- that float32 rounding sequence is what makes
    // the normals bit-identical to the WASM decoder.
    const fround = Math.fround
    const scale = toolBox._dequantizationScale
    let si = 0
    let di = 0
    for (let i = 0; i < numPoints; i++) {
      let y = fround(fround(fround(srcI32[si]) * scale) - 1.0)
      let z = fround(fround(fround(srcI32[si + 1]) * scale) - 1.0)
      si += 2
      const x = fround(fround(1.0 - Math.abs(y)) - Math.abs(z))

      let xOffset = -x
      if (xOffset < 0) xOffset = 0

      y = fround(y + (y < 0 ? xOffset : -xOffset))
      z = fround(z + (z < 0 ? xOffset : -xOffset))

      const normSquared = fround(fround(fround(x * x) + fround(y * y)) + fround(z * z))
      if (normSquared < 1e-6) {
        dstF32[di] = 0
        dstF32[di + 1] = 0
        dstF32[di + 2] = 0
      } else {
        const d = fround(1.0 / fround(Math.sqrt(normSquared)))
        dstF32[di] = fround(x * d)
        dstF32[di + 1] = fround(y * d)
        dstF32[di + 2] = fround(z * d)
      }
      di += 3
    }
    return true
  }
}

export { AttributeOctahedronTransform }
