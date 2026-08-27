// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeDecoderInterface.js (MIT)

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { DecoderBuffer } from '../../../core/DecoderBuffer'

/**
 * Abstract interface for prediction schemes used during attribute decoding.
 */
class PredictionSchemeDecoderInterface {
  isInitialized(): boolean {
    return false
  }

  /** True if all correction values are guaranteed to be positive. */
  areCorrectionsPositive(): boolean {
    return false
  }

  getNumParentAttributes(): number {
    return 0
  }

  getParentAttributeType(_i: number): number {
    return -1 // INVALID
  }

  setParentAttribute(_att: PointAttribute): boolean {
    return false
  }

  decodePredictionData(_buffer: DecoderBuffer): boolean {
    return true
  }

  /**
   * Like computeOriginalValues, but inCorr still holds unsigned zigzag-coded
   * corrections; the implementation unpacks each one inline, replacing the
   * standalone convertSymbolsToSignedInts pass. Returns undefined when the
   * scheme/transform combination cannot fuse (the caller then falls back to
   * the two-pass path). Base implementation: never fusable.
   */
  computeOriginalValuesZigzag(
    _inCorr: Int32Array,
    _outData: Int32Array,
    _size: number,
    _numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean | undefined {
    return undefined
  }

  /** Reverts the prediction applied during encoding, writing original values to outData. */
  computeOriginalValues(
    _inCorr: Int32Array,
    _outData: Int32Array,
    _size: number,
    _numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean {
    return false
  }
}

export { PredictionSchemeDecoderInterface }
