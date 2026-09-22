// Ported from draco.js src/compression/attributes/LinearSequencer.js (MIT)

import type { PointAttribute } from '../../attributes/PointAttribute'

// Sequencer that preserves point order: generates the sequence [0, numPoints-1].
// Used by the mesh sequential decoder. Implements the PointsSequencer interface
// driven by SequentialAttributeDecodersController.
class LinearSequencer {
  _numPoints: number
  _outPointIds = new Int32Array(0)

  constructor(numPoints: number) {
    this._numPoints = numPoints
  }

  generateSequence(_parallelogramParents: boolean): boolean {
    if (this._numPoints < 0) {
      return false
    }
    const ids = new Int32Array(this._numPoints)
    for (let i = 0; i < this._numPoints; ++i) {
      ids[i] = i
    }
    this._outPointIds = ids
    return true
  }

  getOutputPointIds(): Int32Array {
    return this._outPointIds
  }

  updatePointToAttributeIndexMapping(attribute: PointAttribute): boolean {
    attribute.setIdentityMapping()
    return true
  }
}

export { LinearSequencer }
