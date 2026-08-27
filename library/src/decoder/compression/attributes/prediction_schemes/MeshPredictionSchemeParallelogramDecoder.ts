// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeParallelogramDecoder.js (MIT)

import { PredictionSchemeTransformType } from '../../config/CompressionShared'
import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'

import type { PointAttribute } from '../../../attributes/PointAttribute'
import type { MeshPredictionSchemeData } from './MeshPredictionSchemeData'
import type { PredictionSchemeDecodingTransform } from './PredictionSchemeDecoder'
import type { PredictionSchemeWrapDecodingTransform } from './PredictionSchemeWrapDecodingTransform'

/**
 * Decoder for the standard parallelogram prediction: the parallelogram formed
 * by the triangle opposite the current corner predicts the attribute value.
 */
class MeshPredictionSchemeParallelogramDecoder extends MeshPredictionSchemeDecoder {
  constructor(
    attribute: PointAttribute,
    transform: PredictionSchemeDecodingTransform,
    meshData: MeshPredictionSchemeData,
  ) {
    super(attribute, transform, meshData)
  }

  override isInitialized(): boolean {
    return this._meshData.isInitialized()
  }

  // Zigzag-fused variant: decodes corrections that are still in their unsigned
  // zigzag form, unpacking each one inline. Only offered for the wrap
  // transform (whose corrections are the only zigzag-coded ones this scheme
  // sees); callers fall back to the standalone conversion pass otherwise.
  override computeOriginalValuesZigzag(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean | undefined {
    this._transform.init(numComponents)
    if (
      !this._transform.getType ||
      this._transform.getType() !== PredictionSchemeTransformType.PREDICTION_TRANSFORM_WRAP
    ) {
      return undefined // Not fusable; caller uses the two-pass path.
    }
    return this._computeOriginalValuesWrap(inCorr, outData, numComponents, true)
  }

  override computeOriginalValues(
    inCorr: Int32Array,
    outData: Int32Array,
    size: number,
    numComponents: number,
    entryToPointIdMap: Int32Array,
  ): boolean {
    this._transform.init(numComponents)

    if (
      this._transform.getType &&
      this._transform.getType() === PredictionSchemeTransformType.PREDICTION_TRANSFORM_WRAP
    ) {
      return this._computeOriginalValuesWrap(inCorr, outData, numComponents, false)
    }

    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    // Flat connectivity arrays (Int32Array) for the per-value prediction loop.
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array
    const dataToCornerMap = this._meshData.dataToCornerMap

    const predVals = new Int32Array(numComponents)

    this._transform.computeOriginalValue(predVals, 0, inCorr, 0, outData, 0)

    const cornerMapSize = dataToCornerMap.length
    for (let p = 1; p < cornerMapSize; ++p) {
      const cornerId = dataToCornerMap[p]
      const dstOffset = p * numComponents

      const oci = oppositeCorners[cornerId]
      let hasPrediction = false
      if (oci >= 0) {
        const rem = oci - ((oci / 3) | 0) * 3
        const nextOci = rem === 2 ? oci - 2 : oci + 1
        const prevOci = rem === 0 ? oci + 2 : oci - 1

        const vertOpp = vertexToDataMap[cornerToVertex[oci]]
        const vertNext = vertexToDataMap[cornerToVertex[nextOci]]
        const vertPrev = vertexToDataMap[cornerToVertex[prevOci]]

        if (vertOpp < p && vertNext < p && vertPrev < p) {
          const vOppOff = vertOpp * numComponents
          const vNextOff = vertNext * numComponents
          const vPrevOff = vertPrev * numComponents
          for (let c = 0; c < numComponents; ++c) {
            predVals[c] = outData[vNextOff + c] + outData[vPrevOff + c] - outData[vOppOff + c]
          }
          hasPrediction = true
        }
      }

      if (!hasPrediction) {
        // No parallelogram: fall back to delta from previous value.
        const srcOffset = (p - 1) * numComponents
        this._transform.computeOriginalValue(outData, srcOffset, inCorr, dstOffset, outData, dstOffset)
      } else {
        this._transform.computeOriginalValue(predVals, 0, inCorr, dstOffset, outData, dstOffset)
      }
    }
    return true
  }

  // The wrap transform's corrections are zigzag-coded; with `zigzag` set the
  // decode folds the (val >>> 1) ^ -(val & 1) unpacking into each correction
  // read, replacing the standalone convertSymbolsToSignedInts pass over the
  // whole array (see computeOriginalValuesZigzag). Every correction is read
  // exactly once before its slot is overwritten, so the in-place aliasing of
  // inCorr and outData is preserved.
  _computeOriginalValuesWrap(inCorr: Int32Array, outData: Int32Array, numComponents: number, zigzag: boolean): boolean {
    if (numComponents === 2) {
      return this._computeOriginalValuesWrap2(inCorr, outData, zigzag)
    }
    if (numComponents === 3) {
      return this._computeOriginalValuesWrap3(inCorr, outData, zigzag)
    }

    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array
    const dataToCornerMap = this._meshData.dataToCornerMap
    const transform = this._transform as PredictionSchemeWrapDecodingTransform
    const minValue = transform._minValue
    const maxValue = transform._maxValue
    const maxDif = transform._maxDif

    for (let c = 0; c < numComponents; ++c) {
      let pred = 0
      if (pred > maxValue) {
        pred = maxValue
      } else if (pred < minValue) {
        pred = minValue
      }
      const raw = inCorr[c]
      let orig = (pred + (zigzag ? (raw >>> 1) ^ -(raw & 1) : raw)) | 0
      if (orig > maxValue) {
        orig -= maxDif
      } else if (orig < minValue) {
        orig += maxDif
      }
      outData[c] = orig
    }

    const cornerMapSize = dataToCornerMap.length
    for (let p = 1; p < cornerMapSize; ++p) {
      const cornerId = dataToCornerMap[p]
      const dstOffset = p * numComponents

      const oci = oppositeCorners[cornerId]
      let hasPrediction = false
      let vOppOff = 0
      let vNextOff = 0
      let vPrevOff = 0
      if (oci >= 0) {
        const rem = oci - ((oci / 3) | 0) * 3
        const nextOci = rem === 2 ? oci - 2 : oci + 1
        const prevOci = rem === 0 ? oci + 2 : oci - 1

        const vertOpp = vertexToDataMap[cornerToVertex[oci]]
        const vertNext = vertexToDataMap[cornerToVertex[nextOci]]
        const vertPrev = vertexToDataMap[cornerToVertex[prevOci]]

        if (vertOpp < p && vertNext < p && vertPrev < p) {
          vOppOff = vertOpp * numComponents
          vNextOff = vertNext * numComponents
          vPrevOff = vertPrev * numComponents
          hasPrediction = true
        }
      }

      if (hasPrediction) {
        for (let c = 0; c < numComponents; ++c) {
          let pred = (outData[vNextOff + c] + outData[vPrevOff + c] - outData[vOppOff + c]) | 0
          if (pred > maxValue) {
            pred = maxValue
          } else if (pred < minValue) {
            pred = minValue
          }
          const raw = inCorr[dstOffset + c]
          let orig = (pred + (zigzag ? (raw >>> 1) ^ -(raw & 1) : raw)) | 0
          if (orig > maxValue) {
            orig -= maxDif
          } else if (orig < minValue) {
            orig += maxDif
          }
          outData[dstOffset + c] = orig
        }
      } else {
        const srcOffset = (p - 1) * numComponents
        for (let c = 0; c < numComponents; ++c) {
          let pred = outData[srcOffset + c]
          if (pred > maxValue) {
            pred = maxValue
          } else if (pred < minValue) {
            pred = minValue
          }
          const raw = inCorr[dstOffset + c]
          let orig = (pred + (zigzag ? (raw >>> 1) ^ -(raw & 1) : raw)) | 0
          if (orig > maxValue) {
            orig -= maxDif
          } else if (orig < minValue) {
            orig += maxDif
          }
          outData[dstOffset + c] = orig
        }
      }
    }

    return true
  }

  _computeOriginalValuesWrap2(inCorr: Int32Array, outData: Int32Array, zigzag: boolean): boolean {
    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array
    const dataToCornerMap = this._meshData.dataToCornerMap
    const transform = this._transform as PredictionSchemeWrapDecodingTransform
    const minValue = transform._minValue
    const maxValue = transform._maxValue
    const maxDif = transform._maxDif
    let pred0 = 0
    let pred1 = 0
    if (pred0 > maxValue) {
      pred0 = maxValue
    } else if (pred0 < minValue) {
      pred0 = minValue
    }
    if (pred1 > maxValue) {
      pred1 = maxValue
    } else if (pred1 < minValue) {
      pred1 = minValue
    }
    const raw0 = inCorr[0]
    const raw1 = inCorr[1]
    let orig0 = (pred0 + (zigzag ? (raw0 >>> 1) ^ -(raw0 & 1) : raw0)) | 0
    let orig1 = (pred1 + (zigzag ? (raw1 >>> 1) ^ -(raw1 & 1) : raw1)) | 0
    if (orig0 > maxValue) {
      orig0 -= maxDif
    } else if (orig0 < minValue) {
      orig0 += maxDif
    }
    if (orig1 > maxValue) {
      orig1 -= maxDif
    } else if (orig1 < minValue) {
      orig1 += maxDif
    }
    outData[0] = orig0
    outData[1] = orig1

    const cornerMapSize = dataToCornerMap.length
    for (let p = 1; p < cornerMapSize; ++p) {
      const cornerId = dataToCornerMap[p]
      const dstOffset = p * 2
      const oci = oppositeCorners[cornerId]
      let hasPrediction = false
      let vOppOff = 0
      let vNextOff = 0
      let vPrevOff = 0
      if (oci >= 0) {
        const rem = oci - ((oci / 3) | 0) * 3
        const nextOci = rem === 2 ? oci - 2 : oci + 1
        const prevOci = rem === 0 ? oci + 2 : oci - 1
        const vertOpp = vertexToDataMap[cornerToVertex[oci]]
        const vertNext = vertexToDataMap[cornerToVertex[nextOci]]
        const vertPrev = vertexToDataMap[cornerToVertex[prevOci]]
        if (vertOpp < p && vertNext < p && vertPrev < p) {
          vOppOff = vertOpp * 2
          vNextOff = vertNext * 2
          vPrevOff = vertPrev * 2
          hasPrediction = true
        }
      }

      if (hasPrediction) {
        pred0 = (outData[vNextOff] + outData[vPrevOff] - outData[vOppOff]) | 0
        pred1 = (outData[vNextOff + 1] + outData[vPrevOff + 1] - outData[vOppOff + 1]) | 0
      } else {
        const srcOffset = dstOffset - 2
        pred0 = outData[srcOffset]
        pred1 = outData[srcOffset + 1]
      }
      if (pred0 > maxValue) {
        pred0 = maxValue
      } else if (pred0 < minValue) {
        pred0 = minValue
      }
      if (pred1 > maxValue) {
        pred1 = maxValue
      } else if (pred1 < minValue) {
        pred1 = minValue
      }
      const rawA = inCorr[dstOffset]
      const rawB = inCorr[dstOffset + 1]
      orig0 = (pred0 + (zigzag ? (rawA >>> 1) ^ -(rawA & 1) : rawA)) | 0
      orig1 = (pred1 + (zigzag ? (rawB >>> 1) ^ -(rawB & 1) : rawB)) | 0
      if (orig0 > maxValue) {
        orig0 -= maxDif
      } else if (orig0 < minValue) {
        orig0 += maxDif
      }
      if (orig1 > maxValue) {
        orig1 -= maxDif
      } else if (orig1 < minValue) {
        orig1 += maxDif
      }
      outData[dstOffset] = orig0
      outData[dstOffset + 1] = orig1
    }

    return true
  }

  _computeOriginalValuesWrap3(inCorr: Int32Array, outData: Int32Array, zigzag: boolean): boolean {
    const table = this._meshData.cornerTable
    const vertexToDataMap = this._meshData.vertexToDataMap
    const oppositeCorners = table.oppositeCornerArray() as Int32Array
    const cornerToVertex = table.cornerToVertexArray() as Int32Array
    const dataToCornerMap = this._meshData.dataToCornerMap
    const transform = this._transform as PredictionSchemeWrapDecodingTransform
    const minValue = transform._minValue
    const maxValue = transform._maxValue
    const maxDif = transform._maxDif
    let pred0 = 0
    let pred1 = 0
    let pred2 = 0
    if (pred0 > maxValue) {
      pred0 = maxValue
    } else if (pred0 < minValue) {
      pred0 = minValue
    }
    if (pred1 > maxValue) {
      pred1 = maxValue
    } else if (pred1 < minValue) {
      pred1 = minValue
    }
    if (pred2 > maxValue) {
      pred2 = maxValue
    } else if (pred2 < minValue) {
      pred2 = minValue
    }
    const raw0 = inCorr[0]
    const raw1 = inCorr[1]
    const raw2 = inCorr[2]
    let orig0 = (pred0 + (zigzag ? (raw0 >>> 1) ^ -(raw0 & 1) : raw0)) | 0
    let orig1 = (pred1 + (zigzag ? (raw1 >>> 1) ^ -(raw1 & 1) : raw1)) | 0
    let orig2 = (pred2 + (zigzag ? (raw2 >>> 1) ^ -(raw2 & 1) : raw2)) | 0
    if (orig0 > maxValue) {
      orig0 -= maxDif
    } else if (orig0 < minValue) {
      orig0 += maxDif
    }
    if (orig1 > maxValue) {
      orig1 -= maxDif
    } else if (orig1 < minValue) {
      orig1 += maxDif
    }
    if (orig2 > maxValue) {
      orig2 -= maxDif
    } else if (orig2 < minValue) {
      orig2 += maxDif
    }
    outData[0] = orig0
    outData[1] = orig1
    outData[2] = orig2

    const cornerMapSize = dataToCornerMap.length
    for (let p = 1; p < cornerMapSize; ++p) {
      const cornerId = dataToCornerMap[p]
      const dstOffset = p * 3
      const oci = oppositeCorners[cornerId]
      let hasPrediction = false
      let vOppOff = 0
      let vNextOff = 0
      let vPrevOff = 0
      if (oci >= 0) {
        const rem = oci - ((oci / 3) | 0) * 3
        const nextOci = rem === 2 ? oci - 2 : oci + 1
        const prevOci = rem === 0 ? oci + 2 : oci - 1
        const vertOpp = vertexToDataMap[cornerToVertex[oci]]
        const vertNext = vertexToDataMap[cornerToVertex[nextOci]]
        const vertPrev = vertexToDataMap[cornerToVertex[prevOci]]
        if (vertOpp < p && vertNext < p && vertPrev < p) {
          vOppOff = vertOpp * 3
          vNextOff = vertNext * 3
          vPrevOff = vertPrev * 3
          hasPrediction = true
        }
      }

      if (hasPrediction) {
        pred0 = (outData[vNextOff] + outData[vPrevOff] - outData[vOppOff]) | 0
        pred1 = (outData[vNextOff + 1] + outData[vPrevOff + 1] - outData[vOppOff + 1]) | 0
        pred2 = (outData[vNextOff + 2] + outData[vPrevOff + 2] - outData[vOppOff + 2]) | 0
      } else {
        const srcOffset = dstOffset - 3
        pred0 = outData[srcOffset]
        pred1 = outData[srcOffset + 1]
        pred2 = outData[srcOffset + 2]
      }
      if (pred0 > maxValue) {
        pred0 = maxValue
      } else if (pred0 < minValue) {
        pred0 = minValue
      }
      if (pred1 > maxValue) {
        pred1 = maxValue
      } else if (pred1 < minValue) {
        pred1 = minValue
      }
      if (pred2 > maxValue) {
        pred2 = maxValue
      } else if (pred2 < minValue) {
        pred2 = minValue
      }
      const rawA = inCorr[dstOffset]
      const rawB = inCorr[dstOffset + 1]
      const rawC = inCorr[dstOffset + 2]
      orig0 = (pred0 + (zigzag ? (rawA >>> 1) ^ -(rawA & 1) : rawA)) | 0
      orig1 = (pred1 + (zigzag ? (rawB >>> 1) ^ -(rawB & 1) : rawB)) | 0
      orig2 = (pred2 + (zigzag ? (rawC >>> 1) ^ -(rawC & 1) : rawC)) | 0
      if (orig0 > maxValue) {
        orig0 -= maxDif
      } else if (orig0 < minValue) {
        orig0 += maxDif
      }
      if (orig1 > maxValue) {
        orig1 -= maxDif
      } else if (orig1 < minValue) {
        orig1 += maxDif
      }
      if (orig2 > maxValue) {
        orig2 -= maxDif
      } else if (orig2 < minValue) {
        orig2 += maxDif
      }
      outData[dstOffset] = orig0
      outData[dstOffset + 1] = orig1
      outData[dstOffset + 2] = orig2
    }

    return true
  }
}

export { MeshPredictionSchemeParallelogramDecoder }
