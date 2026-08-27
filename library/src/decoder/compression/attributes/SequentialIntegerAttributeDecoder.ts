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
  _predictionScheme: PredictionSchemeDecoderInterface | null
  // Two-phase decode state (see SequentialAttributeDecoder): the parse phase
  // stashes the primed raw-symbol stream here so the controller can batch and
  // pair several attributes' decodes; the finish phase consumes it.
  _pendingSymbolDecoder: RAnsSymbolDecoder | null
  _pendingNumValues: number
  _finishPointIds: Int32Array | null

  constructor() {
    super()
    this._predictionScheme = null
    this._pendingSymbolDecoder = null
    this._pendingNumValues = 0
    this._finishPointIds = null
  }

  // --- Two-phase decode (parse headers / batch symbol decode / finish) ---

  override decodePortableAttributeParse(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    if (this.attribute!.numComponents <= 0) {
      return false
    }
    if (!this.attribute!.reset(pointIds.length)) {
      return false
    }
    this._finishPointIds = pointIds
    return this._decodeValuesParse(pointIds, buffer)
  }

  override pendingSymbolStream(): PendingSymbolStream | null {
    if (this._pendingSymbolDecoder === null) {
      return null
    }
    const portableAttributeData = this.getPortableAttributeData()!
    return {
      ans: this._pendingSymbolDecoder.ans_,
      out: new Uint32Array(portableAttributeData.buffer, portableAttributeData.byteOffset, this._pendingNumValues),
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

  _decodeValuesParse(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
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
    const portableAttributeData = this.getPortableAttributeData()
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
      const numBytes = buffer.decodeUint8()
      if (numBytes === undefined) return false

      if (numBytes === dataTypeLength(DataType.INT32)) {
        if (portableAttributeData.byteLength < 4 * numValues) {
          return false
        }
        const bytes = buffer.decodeBytesView(4 * numValues)
        if (bytes === undefined) return false
        const srcView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        for (let i = 0; i < numValues; i++) {
          portableAttributeData[i] = srcView.getInt32(i * 4, true)
        }
      } else {
        if (buffer.remainingSize < numBytes * numValues) {
          return false
        }
        const bytes = buffer.decodeBytesView(numBytes * numValues)
        if (bytes === undefined) return false
        for (let i = 0; i < numValues; i++) {
          // Little-endian; |= with << sign-extends into a 32-bit int.
          let val = 0
          const valueOffset = i * numBytes
          for (let b = 0; b < numBytes; b++) {
            val |= bytes[valueOffset + b] << (b * 8)
          }
          portableAttributeData[i] = val
        }
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
    const portableAttributeData = this.getPortableAttributeData()
    if (portableAttributeData === null) {
      return false
    }

    const needsZigzag =
      numValues > 0 && (this._predictionScheme === null || !this._predictionScheme.areCorrectionsPositive())

    if (this._predictionScheme) {
      if (numValues > 0) {
        // Prefer the zigzag-fused decode: it unpacks each correction inline
        // instead of paying a separate whole-array conversion pass first.
        if (needsZigzag) {
          const fused = this._predictionScheme.computeOriginalValuesZigzag(
            portableAttributeData,
            portableAttributeData,
            numValues,
            numComponents,
            pointIds,
          )
          if (fused !== undefined) {
            return fused
          }
        }
        if (needsZigzag) {
          const asUint32 = new Uint32Array(portableAttributeData.buffer, portableAttributeData.byteOffset, numValues)
          convertSymbolsToSignedInts(asUint32, numValues, portableAttributeData)
        }
        if (
          !this._predictionScheme.computeOriginalValues(
            portableAttributeData,
            portableAttributeData,
            numValues,
            numComponents,
            pointIds,
          )
        ) {
          return false
        }
      }
    } else if (needsZigzag) {
      // Reinterpret the Int32Array as Uint32 for the signed conversion.
      const asUint32 = new Uint32Array(portableAttributeData.buffer, portableAttributeData.byteOffset, numValues)
      convertSymbolsToSignedInts(asUint32, numValues, portableAttributeData)
    }
    return true
  }

  override transformAttributeToOriginalFormat(pointIds: Int32Array): boolean {
    return this._storeValues(pointIds.length)
  }

  // Single-phase entry (base-class decodePortableAttribute path): parse,
  // decode any deferred symbol stream immediately, finish.
  override decodeValues(pointIds: Int32Array, buffer: DecoderBuffer): boolean {
    this._finishPointIds = pointIds
    if (!this._decodeValuesParse(pointIds, buffer)) {
      return false
    }
    const pending = this._pendingSymbolDecoder
    if (pending !== null) {
      const portableAttributeData = this.getPortableAttributeData()!
      const outUint32 = new Uint32Array(
        portableAttributeData.buffer,
        portableAttributeData.byteOffset,
        this._pendingNumValues,
      )
      pending.ans_.decodeSymbols(outUint32, this._pendingNumValues)
    }
    return this.decodePortableAttributeFinish()
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
    const dt = this.attribute!.dataType
    switch (dt) {
      case DataType.UINT8:
        this._storeTypedValues(numValues, Uint8Array)
        break
      case DataType.INT8:
        this._storeTypedValues(numValues, Int8Array)
        break
      case DataType.UINT16:
        this._storeTypedValues(numValues, Uint16Array)
        break
      case DataType.INT16:
        this._storeTypedValues(numValues, Int16Array)
        break
      case DataType.UINT32:
        this._storeTypedValues(numValues, Uint32Array)
        break
      case DataType.INT32:
        this._storeTypedValues(numValues, Int32Array)
        break
      default:
        return false
    }
    return true
  }

  _storeTypedValues(numValues: number, TypedArrayClass: IntTypedArrayConstructor): void {
    const numComponents = this.attribute!.numComponents
    const total = numValues * numComponents
    if (total === 0) {
      return
    }
    const src = this.getPortableAttributeData()! // Int32Array of the decoded values.
    // TypedArray.set coerces per element to the target type -- same result as the
    // per-entry byte copy, without per-value buffer.write() dispatch. dstAddr has
    // byteOffset 0, so the typed view is aligned.
    const dstAddr = this.attribute!.getAddress(0)
    const dst = new TypedArrayClass(dstAddr.buffer, dstAddr.byteOffset, total)
    dst.set(src)
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
    // decodeIntegerValues writes every one of its entries below.
    portAtt.resetScratch(numEntries)
    portAtt.uniqueId = this.attribute!.uniqueId
    this.setPortableAttribute(portAtt)
  }

  getPortableAttributeData(): Int32Array | null {
    if (this.portableAttribute!.size === 0) {
      return null
    }
    const addr = this.portableAttribute!.getAddress(0)
    return new Int32Array(
      addr.buffer,
      addr.byteOffset,
      this.portableAttribute!.size * this.portableAttribute!.numComponents,
    )
  }
}

export { SequentialIntegerAttributeDecoder }
