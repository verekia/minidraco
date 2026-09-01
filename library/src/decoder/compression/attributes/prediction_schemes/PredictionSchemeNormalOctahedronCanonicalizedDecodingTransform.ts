// Ported from draco.js src/compression/attributes/prediction_schemes/PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform.js (MIT)

import { PredictionSchemeTransformType } from '../../config/CompressionShared'
import { PredictionSchemeNormalOctahedronTransformBase } from './PredictionSchemeNormalOctahedronTransformBase'

import type { DecoderBuffer } from '../../../core/DecoderBuffer'

/**
 * Decodes correction values that were transformed using the canonicalized
 * octahedral normal transform back to original values.
 */
class PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform extends PredictionSchemeNormalOctahedronTransformBase {
  getType(): number {
    return PredictionSchemeTransformType.PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED
  }

  decodeTransformData(buffer: DecoderBuffer): boolean {
    const maxQuantizedValue = buffer.decodeInt32()
    if (maxQuantizedValue === undefined) return false
    // center_value is read but ignored.
    const centerValue = buffer.decodeInt32()
    if (centerValue === undefined) return false

    if (!this._setMaxQuantizedValue(maxQuantizedValue)) return false

    if (this._octahedronToolBox.quantizationBits() < 2) return false
    if (this._octahedronToolBox.quantizationBits() > 30) return false

    return true
  }

  computeOriginalValue(
    predVals: Int32Array,
    predOffset: number,
    corrVals: Int32Array,
    corrOffset: number,
    outOrigVals: Int32Array,
    outOffset: number,
  ): void {
    const toolBox = this._octahedronToolBox
    const center = toolBox._centerValue
    const maxQuantizedValue = toolBox._maxQuantizedValue
    const corrS = corrVals[corrOffset]
    const corrT = corrVals[corrOffset + 1]

    let predS = predVals[predOffset] - center
    let predT = predVals[predOffset + 1] - center

    const predIsInDiamond = Math.abs(predS) + Math.abs(predT) <= center
    if (!predIsInDiamond) {
      let signS = 0
      let signT = 0
      if (predS >= 0 && predT >= 0) {
        signS = 1
        signT = 1
      } else if (predS <= 0 && predT <= 0) {
        signS = -1
        signT = -1
      } else {
        signS = predS > 0 ? 1 : -1
        signT = predT > 0 ? 1 : -1
      }
      const cornerPointS = signS * center
      const cornerPointT = signT * center
      let us = (predS * 2 - cornerPointS) | 0
      let ut = (predT * 2 - cornerPointT) | 0
      if (signS * signT >= 0) {
        const temp = us
        us = -ut
        ut = -temp
      } else {
        const temp = us
        us = ut
        ut = temp
      }
      predS = ((us + cornerPointS) / 2) | 0
      predT = ((ut + cornerPointT) / 2) | 0
    }

    const predIsInBottomLeft = (predS === 0 && predT === 0) || (predS < 0 && predT <= 0)

    let rotationCount = 0
    if (predS === 0) {
      if (predT > 0) rotationCount = 3
      else if (predT < 0) rotationCount = 1
    } else if (predS > 0) {
      if (predT >= 0) rotationCount = 2
      else rotationCount = 1
    } else {
      if (predT > 0) rotationCount = 3
    }

    if (!predIsInBottomLeft) {
      const s = predS,
        t = predT
      // `(-x) | 0` normalises -0 (from negating 0) to +0 so V8 keeps the Smi
      // fast path instead of deopting; bit-exact for these int32 values.
      switch (rotationCount) {
        case 1:
          predS = t
          predT = -s | 0
          break
        case 2:
          predS = -s | 0
          predT = -t | 0
          break
        case 3:
          predS = -t | 0
          predT = s
          break
      }
    }

    // Unsigned addition to avoid signed overflow, then modMax (inlined).
    let origS = (predS + corrS) | 0
    if (origS > center) origS -= maxQuantizedValue
    else if (origS < -center) origS += maxQuantizedValue
    let origT = (predT + corrT) | 0
    if (origT > center) origT -= maxQuantizedValue
    else if (origT < -center) origT += maxQuantizedValue

    if (!predIsInBottomLeft) {
      const s = origS,
        t = origT
      switch ((4 - rotationCount) & 3) {
        case 1:
          origS = t
          origT = -s | 0
          break
        case 2:
          origS = -s | 0
          origT = -t | 0
          break
        case 3:
          origS = -t | 0
          origT = s
          break
      }
    }

    if (!predIsInDiamond) {
      let signS = 0
      let signT = 0
      if (origS >= 0 && origT >= 0) {
        signS = 1
        signT = 1
      } else if (origS <= 0 && origT <= 0) {
        signS = -1
        signT = -1
      } else {
        signS = origS > 0 ? 1 : -1
        signT = origT > 0 ? 1 : -1
      }
      const cornerPointS = signS * center
      const cornerPointT = signT * center
      let us = (origS * 2 - cornerPointS) | 0
      let ut = (origT * 2 - cornerPointT) | 0
      if (signS * signT >= 0) {
        const temp = us
        us = -ut
        ut = -temp
      } else {
        const temp = us
        us = ut
        ut = temp
      }
      origS = ((us + cornerPointS) / 2) | 0
      origT = ((ut + cornerPointT) / 2) | 0
    }

    outOrigVals[outOffset] = origS + center
    outOrigVals[outOffset + 1] = origT + center
  }

  // Fused delta loop for PredictionSchemeDeltaDecoder: the whole
  // value[i] = original(value[i-1], corr[i]) chain in one call, with the
  // toolbox fields hoisted to locals and the previous output carried in
  // locals. This is the hot path for PREDICTION_DIFFERENCE normals (one call
  // per value through the interface was ~8% of decode time on the bundles).
  // The arithmetic is computeOriginalValue above verbatim -- keep them in
  // sync; only the plumbing differs.
  computeOriginalValuesDelta(inCorr: Int32Array, outData: Int32Array, size: number, numComponents: number): void {
    const toolBox = this._octahedronToolBox
    const center = toolBox._centerValue
    const maxQuantizedValue = toolBox._maxQuantizedValue

    // The first element is predicted from an all-zero value. inCorr and
    // outData alias in practice, so each correction is read before its slot
    // is written (same order as the per-value calls it replaces).
    let prevS = 0
    let prevT = 0
    for (let i = 0; i < size; i += numComponents) {
      const corrS = inCorr[i]
      const corrT = inCorr[i + 1]

      let predS = prevS - center
      let predT = prevT - center

      const predIsInDiamond = Math.abs(predS) + Math.abs(predT) <= center
      if (!predIsInDiamond) {
        let signS = 0
        let signT = 0
        if (predS >= 0 && predT >= 0) {
          signS = 1
          signT = 1
        } else if (predS <= 0 && predT <= 0) {
          signS = -1
          signT = -1
        } else {
          signS = predS > 0 ? 1 : -1
          signT = predT > 0 ? 1 : -1
        }
        const cornerPointS = signS * center
        const cornerPointT = signT * center
        let us = (predS * 2 - cornerPointS) | 0
        let ut = (predT * 2 - cornerPointT) | 0
        if (signS * signT >= 0) {
          const temp = us
          us = -ut
          ut = -temp
        } else {
          const temp = us
          us = ut
          ut = temp
        }
        predS = ((us + cornerPointS) / 2) | 0
        predT = ((ut + cornerPointT) / 2) | 0
      }

      const predIsInBottomLeft = (predS === 0 && predT === 0) || (predS < 0 && predT <= 0)

      let rotationCount = 0
      if (predS === 0) {
        if (predT > 0) rotationCount = 3
        else if (predT < 0) rotationCount = 1
      } else if (predS > 0) {
        if (predT >= 0) rotationCount = 2
        else rotationCount = 1
      } else {
        if (predT > 0) rotationCount = 3
      }

      if (!predIsInBottomLeft) {
        const s = predS,
          t = predT
        // `(-x) | 0` normalises -0 to +0 so V8 keeps the Smi fast path.
        switch (rotationCount) {
          case 1:
            predS = t
            predT = -s | 0
            break
          case 2:
            predS = -s | 0
            predT = -t | 0
            break
          case 3:
            predS = -t | 0
            predT = s
            break
        }
      }

      // Unsigned addition to avoid signed overflow, then modMax (inlined).
      let origS = (predS + corrS) | 0
      if (origS > center) origS -= maxQuantizedValue
      else if (origS < -center) origS += maxQuantizedValue
      let origT = (predT + corrT) | 0
      if (origT > center) origT -= maxQuantizedValue
      else if (origT < -center) origT += maxQuantizedValue

      if (!predIsInBottomLeft) {
        const s = origS,
          t = origT
        switch ((4 - rotationCount) & 3) {
          case 1:
            origS = t
            origT = -s | 0
            break
          case 2:
            origS = -s | 0
            origT = -t | 0
            break
          case 3:
            origS = -t | 0
            origT = s
            break
        }
      }

      if (!predIsInDiamond) {
        let signS = 0
        let signT = 0
        if (origS >= 0 && origT >= 0) {
          signS = 1
          signT = 1
        } else if (origS <= 0 && origT <= 0) {
          signS = -1
          signT = -1
        } else {
          signS = origS > 0 ? 1 : -1
          signT = origT > 0 ? 1 : -1
        }
        const cornerPointS = signS * center
        const cornerPointT = signT * center
        let us = (origS * 2 - cornerPointS) | 0
        let ut = (origT * 2 - cornerPointT) | 0
        if (signS * signT >= 0) {
          const temp = us
          us = -ut
          ut = -temp
        } else {
          const temp = us
          us = ut
          ut = temp
        }
        origS = ((us + cornerPointS) / 2) | 0
        origT = ((ut + cornerPointT) / 2) | 0
      }

      // An Int32Array store applies ToInt32, which `| 0` reproduces exactly, so
      // carrying the stored value in a local matches re-reading outData.
      prevS = (origS + center) | 0
      prevT = (origT + center) | 0
      outData[i] = prevS
      outData[i + 1] = prevT
    }
  }
}

export { PredictionSchemeNormalOctahedronCanonicalizedDecodingTransform }
