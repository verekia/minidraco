// Ported from draco.js src/compression/attributes/SequentialIntegerAttributeDecoder.js (MIT)

import { GeometryAttribute } from '../../attributes/GeometryAttribute'
import { PointAttribute } from '../../attributes/PointAttribute'
import { convertSymbolsToSignedInts } from '../../core/BitUtils'
import { DataType, dataTypeLength } from '../../core/DracoTypes'
import { PredictionSchemeMethod, PredictionSchemeTransformType, SymbolCodingMethod } from '../config/CompressionShared'
import { decodeTaggedSymbols, parseRawSymbolStream } from '../entropy/SymbolDecoding'
import { createPredictionSchemeForDecoder } from './prediction_schemes/PredictionSchemeDecoderFactory'
import { PredictionSchemeWrapDecodingTransform } from './prediction_schemes/PredictionSchemeWrapDecodingTransform'
import { SequentialAttributeDecoder } from './SequentialAttributeDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { RAnsSymbolDecoder } from '../entropy/RAnsSymbolDecoder'
import type { PredictionSchemeDecoderInterface } from './prediction_schemes/PredictionSchemeDecoderInterface'
import type { PendingSymbolStream } from './SequentialAttributeDecoder'

// Decoder for attributes encoded with the SequentialIntegerAttributeEncoder.
class SequentialIntegerAttributeDecoder extends SequentialAttributeDecoder {
  _predictionScheme: PredictionSchemeDecoderInterface | null = null
  // Two-phase decode state (see SequentialAttributeDecoder): the parse phase
  // stashes the primed raw-symbol stream here so the controller can batch and
  // pair several attributes' decodes; the finish phase consumes it.
  _pendingSymbolDecoder: RAnsSymbolDecoder | null = null
  _pendingNumValues = 0
  _finishPointIds: Int32Array | null = null
  // The decoded (portable) values, numComponents per entry (see
  // preparePortableAttribute).
  _portableData: Int32Array | null = null
  _portableComponents = 0

  // --- Two-phase decode (parse headers / batch symbol decode / finish) ---

  override pendingSymbolStream(): PendingSymbolStream | null {
    if (this._pendingSymbolDecoder === null) {
      return null
    }
    const portableData = this._portableData!
    return {
      ans: this._pendingSymbolDecoder.ans_,
      out: new Uint32Array(portableData.buffer, portableData.byteOffset, this._pendingNumValues),
      count: this._pendingNumValues,
    }
  }

  override decodePortableAttributeFinish(): boolean {
    if (this._pendingSymbolDecoder !== null) {
      this._pendingSymbolDecoder.endDecoding()
      this._pendingSymbolDecoder = null
    }
    return this._finishIntegerValues(this._finishPointIds!)
  }

  // The parse phase of the integer decode: prediction scheme, portable
  // attribute, the symbol stream (raw streams are deferred to the finish
  // phase) and the prediction data.
  override decodeValues(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    this._finishPointIds = pointIds

    // int8 in the bitstream.
    let predictionSchemeMethod = buffer.decodeUint8()
    if (predictionSchemeMethod !== undefined) predictionSchemeMethod = (predictionSchemeMethod << 24) >> 24
    if (predictionSchemeMethod === undefined) return false

    if (
      predictionSchemeMethod < PredictionSchemeMethod.PREDICTION_NONE ||
      predictionSchemeMethod >= PredictionSchemeMethod.NUM_PREDICTION_SCHEMES
    ) {
      return false
    }

    if (predictionSchemeMethod !== PredictionSchemeMethod.PREDICTION_NONE) {
      let predictionTransformType = buffer.decodeUint8()
      if (predictionTransformType !== undefined) predictionTransformType = (predictionTransformType << 24) >> 24
      if (predictionTransformType === undefined) return false

      if (
        predictionTransformType < PredictionSchemeTransformType.PREDICTION_TRANSFORM_NONE ||
        predictionTransformType >= PredictionSchemeTransformType.NUM_PREDICTION_SCHEME_TRANSFORM_TYPES
      ) {
        return false
      }

      this._predictionScheme = this.createIntPredictionScheme(predictionSchemeMethod, predictionTransformType)
    }

    if (this._predictionScheme) {
      if (!this.initPredictionScheme(this._predictionScheme)) {
        return false
      }
    }

    const numComponents = this.getNumValueComponents()
    if (numComponents <= 0) {
      return false
    }
    const numEntries = pointIds.length
    const numValues = numEntries * numComponents
    this.preparePortableAttribute(numEntries, numComponents)
    const portableAttributeData = this._portableData
    if (portableAttributeData === null) {
      return false
    }

    const compressed = buffer.decodeUint8()
    if (compressed === undefined) return false

    if (compressed > 0) {
      if (numValues > 0) {
        const scheme = buffer.decodeUint8()
        if (scheme === SymbolCodingMethod.SYMBOL_CODING_RAW) {
          // Defer the actual rANS decode: the headers fix the byte range, so
          // the cursor moves on and the controller pairs this stream with a
          // sibling attribute's for a lockstep decode.
          const decoder = parseRawSymbolStream(numValues, buffer)
          if (decoder === null) {
            return false
          }
          this._pendingSymbolDecoder = decoder
          this._pendingNumValues = numValues
        } else if (scheme === SymbolCodingMethod.SYMBOL_CODING_TAGGED) {
          // A tagged stream's cursor advance depends on the decoded tags, so
          // it cannot be deferred -- decode it on the spot.
          const outUint32 = new Uint32Array(portableAttributeData.buffer, portableAttributeData.byteOffset, numValues)
          if (!decodeTaggedSymbols(numValues, numComponents, buffer, outUint32)) {
            return false
          }
        } else {
          return false
        }
      }
    } else {
      // Uncompressed little-endian integers of numBytes each.
      const numBytes = buffer.decodeUint8()
      if (numBytes === undefined) return false
      const bytes = buffer.decodeBytesView(numBytes * numValues)
      if (bytes === undefined) return false
      for (let i = 0; i < numValues; i++) {
        // |= with << sign-extends into a 32-bit int (for 4 bytes this is
        // exactly DataView.getInt32 little-endian).
        let val = 0
        const valueOffset = i * numBytes
        for (let b = 0; b < numBytes; b++) {
          val |= bytes[valueOffset + b] << (b * 8)
        }
        portableAttributeData[i] = val
      }
    }

    // Prediction data sits after the symbol stream and its parse is
    // size-driven, so it too runs ahead of the deferred symbol decode.
    if (this._predictionScheme) {
      if (!this._predictionScheme.decodePredictionData(buffer)) {
        return false
      }
    }
    return true
  }

  // The post-symbol tail of the decode: zigzag unpacking and prediction.
  _finishIntegerValues(pointIds: Int32Array): boolean {
    const numComponents = this.getNumValueComponents()
    const numValues = pointIds.length * numComponents
    const data = this._portableData
    if (data === null) {
      return false
    }
    if (numValues === 0) {
      return true
    }
    const ps = this._predictionScheme
    if (ps === null) {
      // Reinterpret the Int32Array as Uint32 for the signed conversion.
      convertSymbolsToSignedInts(new Uint32Array(data.buffer, data.byteOffset, numValues), numValues, data)
      return true
    }
    if (!ps.areCorrectionsPositive()) {
      // Prefer the zigzag-fused decode: it unpacks each correction inline
      // instead of paying a separate whole-array conversion pass first.
      const fused = ps.computeOriginalValuesZigzag(data, data, numValues, numComponents, pointIds)
      if (fused !== undefined) {
        return fused
      }
      convertSymbolsToSignedInts(new Uint32Array(data.buffer, data.byteOffset, numValues), numValues, data)
    }
    return ps.computeOriginalValues(data, data, numValues, numComponents, pointIds)
  }

  override transformAttributeToOriginalFormat(pointIds: Int32Array): boolean {
    return this._storeValues(pointIds.length)
  }

  // Prediction scheme for decoding integer values; subclasses override for others.
  createIntPredictionScheme(method: number, transformType: number): PredictionSchemeDecoderInterface | null {
    if (transformType !== PredictionSchemeTransformType.PREDICTION_TRANSFORM_WRAP) {
      return null // For now we support only wrap transform.
    }
    const transform = new PredictionSchemeWrapDecodingTransform()
    return createPredictionSchemeForDecoder(method, this.attributeId, this.decoder!, transform)
  }

  getNumValueComponents(): number {
    return this.attribute!.numComponents
  }

  // Whether the decoded values are known to lie below 2^24 in magnitude (the
  // range in which the float extraction needs no per-value float32 rounding,
  // see PointAttribute._lazyFloatValues): true when a prediction transform
  // clamps them into such a range. Unpredicted values are unbounded.
  _valuesBounded(): boolean {
    return this._predictionScheme !== null && this._predictionScheme.boundsValues(0x1000000)
  }

  // The decoded values stay in the portable attribute; the final attribute
  // only takes its size (see PointAttribute.setLazyInteger and the overrides
  // in the quantization / normal decoders).
  override _resetAttribute(numValues: number): boolean {
    this.attribute!.resetLazy(numValues)
    return true
  }

  // Hands the decoded integer values to the attribute, converted to its
  // integer type on extraction.
  _storeValues(_numValues: number): boolean {
    const dt = this.attribute!.dataType
    if (dt < DataType.INT8 || dt > DataType.UINT32) {
      return false
    }
    this.attribute!.setLazyInteger(this._portableData)
    return true
  }

  // Heap-backed: the decoded values are what the final attribute hands out
  // (see _storeValues), so they outlive the decode. The portable
  // PointAttribute around them is only built if a dependent attribute's
  // predictor asks for it (see getPortableAttribute).
  preparePortableAttribute(numEntries: number, numComponents: number): void {
    this._portableComponents = numComponents
    this._portableData = numEntries === 0 ? null : new Int32Array(numEntries * numComponents)
  }

  override getPortableAttribute(): PointAttribute | null {
    const numComponents = this._portableComponents
    if (this._portableAttribute === null && numComponents > 0) {
      const ga = new GeometryAttribute()
      ga.init(
        this.attribute!.attributeType,
        null,
        numComponents,
        DataType.INT32,
        false,
        numComponents * dataTypeLength(DataType.INT32),
        0,
      )
      const portAtt = new PointAttribute(ga)
      portAtt.setIdentityMapping()
      const data = this._portableData
      if (data === null) portAtt.reset(0)
      else
        portAtt.resetWithData(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
          data.length / numComponents,
        )
      portAtt.uniqueId = this.attribute!.uniqueId
      this._portableAttribute = portAtt
    }
    return super.getPortableAttribute()
  }
}

export { SequentialIntegerAttributeDecoder }
