// Ported from draco.js src/compression/attributes/NormalCompressionUtils.js (MIT)

// Converts unit vectors to/from octahedral coordinates for normal compression.
// Invariants: maxQuantizedValue = 2^q - 1 (odd); maxValue = maxQuantizedValue - 1
// (even); centerValue = maxValue / 2.
class OctahedronToolBox {
  _quantizationBits = -1
  _maxQuantizedValue = -1
  _maxValue = -1
  _dequantizationScale = 1.0
  _centerValue = -1

  // q: quantization bits, valid range 2..30.
  setQuantizationBits(q: number): boolean {
    if (q < 2 || q > 30) return false
    this._quantizationBits = q
    this._maxQuantizedValue = (1 << q) - 1
    this._maxValue = this._maxQuantizedValue - 1
    this._dequantizationScale = Math.fround(2.0 / Math.fround(this._maxValue))
    this._centerValue = (this._maxValue / 2) | 0
    return true
  }

  quantizationBits(): number {
    return this._quantizationBits
  }

  // Canonicalizes edge points into consistent quadrants. Writes result into
  // out[0], out[1] (caller-owned reusable 2-element array).
  canonicalizeOctahedralCoords(s: number, t: number, out: Int32Array): void {
    if ((s === 0 && t === 0) || (s === 0 && t === this._maxValue) || (s === this._maxValue && t === 0)) {
      s = this._maxValue
      t = this._maxValue
    } else if (s === 0 && t > this._centerValue) {
      t = this._centerValue - (t - this._centerValue)
    } else if (s === this._maxValue && t < this._centerValue) {
      t = this._centerValue + (this._centerValue - t)
    } else if (t === this._maxValue && s < this._centerValue) {
      s = this._centerValue + (this._centerValue - s)
    } else if (t === 0 && s > this._centerValue) {
      s = this._centerValue - (s - this._centerValue)
    }
    out[0] = s
    out[1] = t
  }

  // Precondition: abs sum of intVec ([x,y,z]) must equal centerValue.
  // Writes result to out[0], out[1].
  integerVectorToQuantizedOctahedralCoords(intVec: Int32Array, out: Int32Array): void {
    let s: number, t: number
    if (intVec[0] >= 0) {
      s = intVec[1] + this._centerValue
      t = intVec[2] + this._centerValue
    } else {
      if (intVec[1] < 0) {
        s = Math.abs(intVec[2])
      } else {
        s = this._maxValue - Math.abs(intVec[2])
      }
      if (intVec[2] < 0) {
        t = Math.abs(intVec[1])
      } else {
        t = this._maxValue - Math.abs(intVec[1])
      }
    }
    this.canonicalizeOctahedralCoords(s, t, out)
  }

  // Normalizes vec ([x,y,z], modified in place) so its abs sum equals centerValue.
  canonicalizeIntegerVector(vec: Int32Array): void {
    const absSum = Math.abs(vec[0]) + Math.abs(vec[1]) + Math.abs(vec[2])
    if (absSum === 0) {
      vec[0] = this._centerValue
      // vec[1] and vec[2] remain 0.
    } else {
      vec[0] = Math.trunc((vec[0] * this._centerValue) / absSum)
      vec[1] = Math.trunc((vec[1] * this._centerValue) / absSum)
      if (vec[2] >= 0) {
        vec[2] = this._centerValue - Math.abs(vec[0]) - Math.abs(vec[1])
      } else {
        vec[2] = -(this._centerValue - Math.abs(vec[0]) - Math.abs(vec[1]))
      }
    }
  }

  // The octahedral -> unit vector direction (quantizedOctahedralCoordsToUnitVector
  // in the source) lives inlined in PointAttribute._extractLazy.
}

export { OctahedronToolBox }
