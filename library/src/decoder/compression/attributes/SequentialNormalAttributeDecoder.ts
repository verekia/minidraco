// Ported from draco.js src/compression/attributes/SequentialNormalAttributeDecoder.js (MIT)
// (with the AttributeOctahedronTransform parameters folded in)

import { DataType } from '../../core/DracoTypes'
import { PredictionSchemeTransformType } from '../config/CompressionShared'
import { createPredictionSchemeForDecoder } from './prediction_schemes/PredictionSchemeDecoderFactory'
import { PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform } from './prediction_schemes/PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform'
import { PredictionSchemeNormalOctahedronDecodingTransform } from './prediction_schemes/PredictionSchemeNormalOctahedronDecodingTransform'
import { SequentialIntegerAttributeDecoder } from './SequentialIntegerAttributeDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { PointCloudDecoder } from '../point_cloud/PointCloudDecoder'
import type { PredictionSchemeDecoderInterface } from './prediction_schemes/PredictionSchemeDecoderInterface'

// Decoder for attributes encoded with SequentialNormalAttributeEncoder.
class SequentialNormalAttributeDecoder extends SequentialIntegerAttributeDecoder {
  _quantizationBits = -1

  override init(decoder: PointCloudDecoder, attributeId: number): boolean {
    if (!super.init(decoder, attributeId)) {
      return false
    }
    // Only 3-component FLOAT32 normals are supported.
    return this.attribute!.numComponents === 3 && this.attribute!.dataType === DataType.FLOAT32
  }

  // Normals quantize into two octahedral components.
  override getNumValueComponents(): number {
    return 2
  }

  // The octahedral quantization bits (AttributeOctahedronTransform::DecodeParameters).
  override decodeDataNeededByPortableTransform(_pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    const qBits = buffer.decodeUint8()
    if (qBits === undefined) return false
    this._quantizationBits = qBits
    return true
  }

  // The octahedral-to-unit-vector transform is deferred to extractTo (see
  // PointAttribute.setLazyOctahedron).
  override _storeValues(_numPoints: number): boolean {
    const q = this._quantizationBits
    if (q < 2 || q > 30) return false
    // OctahedronToolBox: max_value = 2^q - 2, scale = 2 / float(max_value).
    this.attribute!.setLazyOctahedron(this._portableData, Math.fround(2.0 / Math.fround((1 << q) - 2)))
    return true
  }

  override createIntPredictionScheme(method: number, transformType: number): PredictionSchemeDecoderInterface | null {
    const transform =
      transformType === PredictionSchemeTransformType.PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON
        ? new PredictionSchemeNormalOctahedronDecodingTransform()
        : transformType === PredictionSchemeTransformType.PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED
          ? new PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform()
          : null
    if (transform === null) {
      return null
    }
    return createPredictionSchemeForDecoder(method, this.attributeId, this.decoder!, transform)
  }
}

export { SequentialNormalAttributeDecoder }
