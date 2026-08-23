// Ported from draco.js src/compression/mesh/MeshEdgebreakerTraversalValenceDecoder.js (MIT)

import { scratchInt32Filled, scratchUint32 } from '../../core/ScratchArena'
import { decodeVarint } from '../../core/VarintDecoding'
import { decodeSymbols } from '../entropy/SymbolDecoding'
import {
  TOPOLOGY_C,
  TOPOLOGY_S,
  TOPOLOGY_L,
  TOPOLOGY_R,
  TOPOLOGY_E,
  TOPOLOGY_INVALID,
  edgeBreakerSymbolToTopologyId,
} from './MeshEdgebreakerShared'
import { MeshEdgebreakerTraversalDecoder } from './MeshEdgebreakerTraversalDecoder'

import type { DecoderBuffer } from '../../core/DecoderBuffer'
import type { CornerTable, MeshEdgebreakerDecoderImpl } from './MeshEdgebreakerDecoderImpl'

// Decoder for traversal encoded with MeshEdgebreakerTraversalValenceEncoder.
// The decoder maintains valences of the decoded portion of the traversed mesh
// and it uses them to select entropy context used for decoding of the actual
// symbols.
class MeshEdgebreakerTraversalValenceDecoder extends MeshEdgebreakerTraversalDecoder {
  _cornerTable: CornerTable | null
  _numVertices: number
  _lastSymbol: number
  _activeContext: number
  _minValence: number
  _maxValence: number
  _vertexValences: Int32Array
  _contextSymbols: Uint32Array[]
  // Int32Array, not number[]: read and written once per decoded symbol.
  _contextCounters: Int32Array
  // corner -> vertex of _cornerTable, cached at init(); the array is created
  // once by CornerTable.reset() before the traversal decoder is initialized and
  // never replaced, so the per-symbol hot path can read it without two property
  // loads.
  _cornerToVertex: Int32Array

  constructor() {
    super()
    this._cornerTable = null
    this._numVertices = 0
    this._lastSymbol = -1
    this._activeContext = -1
    this._minValence = 2
    this._maxValence = 7
    this._vertexValences = new Int32Array(0)
    this._contextSymbols = []
    this._contextCounters = new Int32Array(0)
    this._cornerToVertex = new Int32Array(0)
  }

  override init(decoder: MeshEdgebreakerDecoderImpl): void {
    super.init(decoder)
    this._cornerTable = decoder.getCornerTable()
    this._cornerToVertex = this._cornerTable!._cornerToVertex!
  }

  override setNumEncodedVertices(numVertices: number): void {
    this._numVertices = numVertices
  }

  override start(outBuffer: DecoderBuffer): boolean {
    if (!this.decodeStartFaces()) {
      return false
    }
    if (!this.decodeAttributeSeams()) {
      return false
    }
    outBuffer.init(this.buffer.dataHead, this.buffer.remainingSize, this.buffer.bitstreamVersion)

    this._minValence = 2
    this._maxValence = 7

    if (this._numVertices < 0) {
      return false
    }
    // Int32Array: read/written for every decoded symbol; typed access keeps
    // the newActiveCornerReached hot path monomorphic. Decode-scoped scratch,
    // zeroed because valences accumulate from 0.
    this._vertexValences = scratchInt32Filled(this._numVertices, 0)

    const numUniqueValences = this._maxValence - this._minValence + 1

    this._contextSymbols = new Array<Uint32Array>(numUniqueValences)
    this._contextCounters = new Int32Array(numUniqueValences)

    for (let i = 0; i < numUniqueValences; ++i) {
      const numSymbols = decodeVarint(outBuffer)
      if (numSymbols === undefined) {
        return false
      }
      if (numSymbols > this._cornerTable!.numFaces()) {
        return false
      }
      if (numSymbols > 0) {
        // Decode-scoped scratch; decodeSymbols writes every entry.
        this._contextSymbols[i] = scratchUint32(numSymbols)
        if (!decodeSymbols(numSymbols, 1, outBuffer, this._contextSymbols[i])) {
          return false
        }
        // All symbols are going to be processed from the back.
        this._contextCounters[i] = numSymbols
      } else {
        this._contextSymbols[i] = new Uint32Array(0)
        this._contextCounters[i] = 0
      }
    }
    return true
  }

  override decodeSymbol(): number {
    if (this._activeContext !== -1) {
      const contextCounter = --this._contextCounters[this._activeContext]
      if (contextCounter < 0) {
        return TOPOLOGY_INVALID
      }
      const symbolId = this._contextSymbols[this._activeContext][contextCounter]
      if (symbolId > 4) {
        return TOPOLOGY_INVALID
      }
      this._lastSymbol = edgeBreakerSymbolToTopologyId[symbolId]
    } else {
      // The first symbol is always E.
      this._lastSymbol = TOPOLOGY_E
    }
    return this._lastSymbol
  }

  override newActiveCornerReached(corner: number): void {
    // Called once per decoded symbol from _decodeConnectivity's hot loop with
    // a fresh, valid corner, so inline next/previous/vertex as flat-array
    // reads instead of paying the corner-table method dispatch 6-8x per call.
    const cornerToVertex = this._cornerToVertex
    const valences = this._vertexValences
    const next = corner % 3 === 2 ? corner - 2 : corner + 1
    const prev = corner % 3 === 0 ? corner + 2 : corner - 1
    const vertNext = cornerToVertex[next]
    const vertPrev = cornerToVertex[prev]

    switch (this._lastSymbol) {
      case TOPOLOGY_C:
      case TOPOLOGY_S:
        valences[vertNext] += 1
        valences[vertPrev] += 1
        break
      case TOPOLOGY_R:
        valences[cornerToVertex[corner]] += 1
        valences[vertNext] += 1
        valences[vertPrev] += 2
        break
      case TOPOLOGY_L:
        valences[cornerToVertex[corner]] += 1
        valences[vertNext] += 2
        valences[vertPrev] += 1
        break
      case TOPOLOGY_E:
        valences[cornerToVertex[corner]] += 2
        valences[vertNext] += 2
        valences[vertPrev] += 2
        break
      default:
        break
    }

    // The clamped valence of the next vertex selects the entropy context.
    const activeValence = valences[vertNext]
    let clampedValence: number
    if (activeValence < this._minValence) {
      clampedValence = this._minValence
    } else if (activeValence > this._maxValence) {
      clampedValence = this._maxValence
    } else {
      clampedValence = activeValence
    }
    this._activeContext = clampedValence - this._minValence
  }

  override mergeVertices(dest: number, source: number): void {
    this._vertexValences[dest] += this._vertexValences[source]
  }
}

export { MeshEdgebreakerTraversalValenceDecoder }
