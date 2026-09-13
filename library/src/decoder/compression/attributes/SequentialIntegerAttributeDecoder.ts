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

type IntTypedArray = Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array

type IntTypedArrayConstructor = new (buffer: ArrayBufferLike, byteOffset: number, length: number) => IntTypedArray

// Decoder for attributes encoded with the SequentialIntegerAttributeEncoder.
class SequentialIntegerAttributeDecoder extends SequentialAttributeDecoder {
  _predictionScheme: PredictionSchemeDecoderInterface | null = null
  // Two-phase decode state (see SequentialAttributeDecoder): the parse phase
  // stashes the primed raw-symbol stream here so the controller can batch and
  // pair several attributes' decodes; the finish phase consumes it.
  _pendingSymbolDecoder: RAnsSymbolDecoder | null = null
  _pendingNumValues = 0
  _finishPointIds: Int32Array | null = null
  // Int32 view over the portable attribute's storage (see preparePortableAttribute).
  _portableData: Int32Array | null = null

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

    const predictionSchemeMethod = buffer.decodeInt8()
    if (predictionSchemeMethod === undefined) return false

    if (
      predictionSchemeMethod < PredictionSchemeMethod.PREDICTION_NONE ||
      predictionSchemeMethod >= PredictionSchemeMethod.NUM_PREDICTION_SCHEMES
    ) {
      return false
    }

    if (predictionSchemeMethod !== PredictionSchemeMethod.PREDICTION_NONE) {
      const predictionTransformType = buffer.decodeInt8()
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

  // Stores decoded integer values into the attribute.
  _storeValues(numValues: number): boolean {
    const attribute = this.attribute!
    const dt = attribute.dataType
    const IntArray: IntTypedArrayConstructor | null =
      dt === DataType.UINT8
        ? Uint8Array
        : dt === DataType.INT8
          ? Int8Array
          : dt === DataType.UINT16
            ? Uint16Array
            : dt === DataType.INT16
              ? Int16Array
              : dt === DataType.UINT32
                ? Uint32Array
                : dt === DataType.INT32
                  ? Int32Array
                  : null
    if (IntArray === null) {
      return false
    }
    const total = numValues * attribute.numComponents
    if (total > 0) {
      // TypedArray.set coerces per element to the target type -- same result as the
      // per-entry byte copy, without per-value buffer.write() dispatch. dstAddr has
      // byteOffset 0, so the typed view is aligned.
      const dstData = attribute.buffer!.data
      new IntArray(dstData.buffer, dstData.byteOffset + attribute.byteOffset, total).set(this._portableData!)
    }
    return true
  }

  preparePortableAttribute(numEntries: number, numComponents: number): void {
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
    // Scratch-backed: the portable attribute is consumed by
    // transformAttributeToOriginalFormat and dropped with the decode, and
    // decodeValues writes every one of its entries.
    portAtt.resetScratch(numEntries)
    portAtt.uniqueId = this.attribute!.uniqueId
    this._portableAttribute = portAtt
    // One Int32 view over the portable storage for the whole decode (the
    // storage is fixed here); the per-call subarray + view pair it replaces
    // was allocated several times per attribute.
    const data = portAtt.buffer!.data
    this._portableData =
      numEntries === 0
        ? null
        : new Int32Array(data.buffer, data.byteOffset + portAtt.byteOffset, numEntries * numComponents)
  }
}

export { SequentialIntegerAttributeDecoder }
