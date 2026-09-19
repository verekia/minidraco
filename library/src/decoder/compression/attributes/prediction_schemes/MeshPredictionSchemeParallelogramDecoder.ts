// Ported from draco.js src/compression/attributes/prediction_schemes/MeshPredictionSchemeParallelogramDecoder.js (MIT)

import { MeshPredictionSchemeDecoder } from './MeshPredictionSchemeDecoder'

import type { PredictionSchemeWrapDecodingTransform } from './PredictionSchemeWrapDecodingTransform'

/**
 * Decoder for the standard parallelogram prediction: the parallelogram formed
 * by the triangle opposite the current corner predicts the attribute value.
 *
 * The factory only ever pairs this scheme with the wrap transform, whose
 * corrections are zigzag-coded and never "positive", so the sequential decoder
 * always takes the fused zigzag path below; there is no generic per-value
 * transform path.
 *
 * The parallelogram's three parent values per entry come precomputed from the
 * traversal (see MeshPredictionSchemeData.parallelogramParents), so the loops
 * below only gather the parent values and apply the transform.
 */
class MeshPredictionSchemeParallelogramDecoder extends MeshPredictionSchemeDecoder {
  // Zigzag-fused variant: decodes corrections that are still in their unsigned
  // zigzag form, unpacking each one inline.
  override computeOriginalValuesZigzag(
    inCorr: Int32Array,
    outData: Int32Array,
    _size: number,
    numComponents: number,
    _entryToPointIdMap: Int32Array,
  ): boolean | undefined {
    this._transform.init(numComponents)
    return this._computeOriginalValuesWrap(inCorr, outData, numComponents, true)
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
    if (numComponents === 4) {
      return this._computeOriginalValuesWrap4(inCorr, outData, zigzag)
    }

    const parents = this._meshData.parallelogramParents()
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

    const numValues = this._meshData.dataToCornerMap.length
    for (let p = 1, o = 3; p < numValues; ++p, o += 3) {
      const dstOffset = p * numComponents
      const vertOpp = parents[o]

      if (vertOpp >= 0) {
        const vOppOff = vertOpp * numComponents
        const vNextOff = parents[o + 1] * numComponents
        const vPrevOff = parents[o + 2] * numComponents
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
        const srcOffset = dstOffset - numComponents
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
    const parents = this._meshData.parallelogramParents()
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

    const numValues = this._meshData.dataToCornerMap.length
    for (let p = 1, o = 3; p < numValues; ++p, o += 3) {
      const dstOffset = p * 2
      const vertOpp = parents[o]
      if (vertOpp >= 0) {
        const vOppOff = vertOpp * 2
        const vNextOff = parents[o + 1] * 2
        const vPrevOff = parents[o + 2] * 2
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
    const parents = this._meshData.parallelogramParents()
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

    const numValues = this._meshData.dataToCornerMap.length
    for (let p = 1, o = 3; p < numValues; ++p, o += 3) {
      const dstOffset = p * 3
      const vertOpp = parents[o]
      if (vertOpp >= 0) {
        const vOppOff = vertOpp * 3
        const vNextOff = parents[o + 1] * 3
        const vPrevOff = parents[o + 2] * 3
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

  // Four components: tangents, RGBA colors, skin joints/weights. Same
  // structure as the 2/3-component loops.
  _computeOriginalValuesWrap4(inCorr: Int32Array, outData: Int32Array, zigzag: boolean): boolean {
    const parents = this._meshData.parallelogramParents()
    const transform = this._transform as PredictionSchemeWrapDecodingTransform
    const minValue = transform._minValue
    const maxValue = transform._maxValue
    const maxDif = transform._maxDif
    // The first value is predicted from zero (clamped into [min, max]).
    let pred0 = 0
    if (pred0 > maxValue) {
      pred0 = maxValue
    } else if (pred0 < minValue) {
      pred0 = minValue
    }
    let pred1 = pred0
    let pred2 = pred0
    let pred3 = pred0
    const numValues = this._meshData.dataToCornerMap.length
    for (let p = 0, o = 0; p < numValues; ++p, o += 3) {
      const dstOffset = p * 4
      if (p > 0) {
        const vertOpp = parents[o]
        if (vertOpp >= 0) {
          const vOppOff = vertOpp * 4
          const vNextOff = parents[o + 1] * 4
          const vPrevOff = parents[o + 2] * 4
          pred0 = (outData[vNextOff] + outData[vPrevOff] - outData[vOppOff]) | 0
          pred1 = (outData[vNextOff + 1] + outData[vPrevOff + 1] - outData[vOppOff + 1]) | 0
          pred2 = (outData[vNextOff + 2] + outData[vPrevOff + 2] - outData[vOppOff + 2]) | 0
          pred3 = (outData[vNextOff + 3] + outData[vPrevOff + 3] - outData[vOppOff + 3]) | 0
        } else {
          const srcOffset = dstOffset - 4
          pred0 = outData[srcOffset]
          pred1 = outData[srcOffset + 1]
          pred2 = outData[srcOffset + 2]
          pred3 = outData[srcOffset + 3]
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
        if (pred3 > maxValue) {
          pred3 = maxValue
        } else if (pred3 < minValue) {
          pred3 = minValue
        }
      }
      const rawA = inCorr[dstOffset]
      const rawB = inCorr[dstOffset + 1]
      const rawC = inCorr[dstOffset + 2]
      const rawD = inCorr[dstOffset + 3]
      let orig0 = (pred0 + (zigzag ? (rawA >>> 1) ^ -(rawA & 1) : rawA)) | 0
      let orig1 = (pred1 + (zigzag ? (rawB >>> 1) ^ -(rawB & 1) : rawB)) | 0
      let orig2 = (pred2 + (zigzag ? (rawC >>> 1) ^ -(rawC & 1) : rawC)) | 0
      let orig3 = (pred3 + (zigzag ? (rawD >>> 1) ^ -(rawD & 1) : rawD)) | 0
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
      if (orig3 > maxValue) {
        orig3 -= maxDif
      } else if (orig3 < minValue) {
        orig3 += maxDif
      }
      outData[dstOffset] = orig0
      outData[dstOffset + 1] = orig1
      outData[dstOffset + 2] = orig2
      outData[dstOffset + 3] = orig3
    }

    return true
  }
}

export { MeshPredictionSchemeParallelogramDecoder }
