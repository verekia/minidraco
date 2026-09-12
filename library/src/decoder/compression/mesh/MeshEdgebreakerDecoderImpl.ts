// Ported from draco.js src/compression/mesh/MeshEdgebreakerDecoderImpl.js (MIT)

import { DecoderBuffer } from '../../core/DecoderBuffer'
import { scratchInt32, scratchInt32Filled, scratchUint8Filled } from '../../core/ScratchArena'
import { decodeVarint } from '../../core/VarintDecoding'
import { MeshAttributeElementType } from '../../mesh/Mesh'
import { MeshAttributeCornerTable } from '../../mesh/MeshAttributeCornerTable'
import { SequentialAttributeDecodersController } from '../attributes/SequentialAttributeDecodersController'
import { MeshTraversalMethod } from '../config/CompressionShared'
import { ANS_L_BASE } from '../entropy/ANSCoding'
import {
  TopologySplitEventData,
  TOPOLOGY_C,
  TOPOLOGY_S,
  TOPOLOGY_L,
  TOPOLOGY_R,
  TOPOLOGY_E,
  RIGHT_FACE_EDGE,
} from './MeshEdgebreakerShared'
import { DepthFirstTraverser } from './traverser/DepthFirstTraverser'
import { MaxPredictionDegreeTraverser } from './traverser/MaxPredictionDegreeTraverser'
import { MeshAttributeIndicesEncodingObserver } from './traverser/MeshAttributeIndicesEncodingObserver'
import { MeshTraversalSequencer } from './traverser/MeshTraversalSequencer'

import type { Mesh } from '../../mesh/Mesh'
import type { MeshEdgebreakerDecoder } from './MeshEdgebreakerDecoder'
import type { MeshEdgebreakerTraversalDecoder } from './MeshEdgebreakerTraversalDecoder'
import type { TraversalCache } from './traverser/MeshTraversalSequencer'

const kInvalidCornerIndex = -1

interface TopologySplitResult {
  faceEdge: number
  encoderSplitSymbolId: number
}

// Edgebreaker decoder; based on Isenburg et al'02 "Spirale Reversi: Reverse
// decoding of the Edgebreaker encoding".
class MeshEdgebreakerDecoderImpl {
  _decoder: MeshEdgebreakerDecoder | null
  _cornerTable: CornerTable | null
  _cornerTraversalStack: number[]
  _topologySplitData: TopologySplitEventData[]
  _initFaceConfigurations: boolean[]
  _initCorners: number[]
  _isVertHole: Uint8Array | number[]
  _numEncodedVertices: number
  _posEncodingData: MeshAttributeIndicesEncodingData
  _posDataDecoderId: number
  _vertexTraversalCache: TraversalCache
  _attributeData: AttributeData[]
  _traversalDecoder: MeshEdgebreakerTraversalDecoder
  // One corner per point id (decode-scoped scratch), filled by
  // _assignAttributeVerticesAndPoints; null when points are the base vertices.
  _pointCorner: Int32Array | null

  constructor(TraversalDecoderClass: new () => MeshEdgebreakerTraversalDecoder) {
    this._decoder = null
    this._cornerTable = null
    this._cornerTraversalStack = []
    this._topologySplitData = []
    this._initFaceConfigurations = []
    this._initCorners = []
    this._isVertHole = []
    this._numEncodedVertices = 0
    this._posEncodingData = new MeshAttributeIndicesEncodingData()
    this._posDataDecoderId = -1
    // Cache of vertex-traversal results keyed by corner table, so attributes
    // sharing connectivity traverse once.
    this._vertexTraversalCache = new Map()
    this._attributeData = []
    this._traversalDecoder = new TraversalDecoderClass()
    this._pointCorner = null
  }

  init(decoder: MeshEdgebreakerDecoder): boolean {
    this._decoder = decoder
    return true
  }

  getDecoder(): MeshEdgebreakerDecoder | null {
    return this._decoder
  }

  getCornerTable(): CornerTable | null {
    return this._cornerTable
  }

  getAttributeCornerTable(attId: number): MeshAttributeCornerTable | null {
    for (let i = 0; i < this._attributeData.length; ++i) {
      const decoderId = this._attributeData[i].decoderId
      if (decoderId < 0 || decoderId >= this._decoder!.numAttributesDecoders()) {
        continue
      }
      const dec = this._decoder!.attributesDecoder(decoderId)!
      for (let j = 0; j < dec.getNumAttributes(); ++j) {
        if (dec.getAttributeId(j) === attId) {
          if (this._attributeData[i].isConnectivityUsed) {
            return this._attributeData[i].connectivityData
          }
          return null
        }
      }
    }
    return null
  }

  getAttributeEncodingData(attId: number): MeshAttributeIndicesEncodingData {
    for (let i = 0; i < this._attributeData.length; ++i) {
      const decoderId = this._attributeData[i].decoderId
      if (decoderId < 0 || decoderId >= this._decoder!.numAttributesDecoders()) {
        continue
      }
      const dec = this._decoder!.attributesDecoder(decoderId)!
      for (let j = 0; j < dec.getNumAttributes(); ++j) {
        if (dec.getAttributeId(j) === attId) {
          return this._attributeData[i].encodingData
        }
      }
    }
    return this._posEncodingData
  }

  createAttributesDecoder(attDecoderId: number): boolean {
    const attDataId = this._decoder!.buffer()!.decodeInt8()
    if (attDataId === undefined) return false

    const decoderType = this._decoder!.buffer()!.decodeUint8()
    if (decoderType === undefined) return false

    if (attDataId >= 0) {
      if (attDataId >= this._attributeData.length) {
        return false // Unexpected attribute data.
      }
      if (this._attributeData[attDataId].decoderId >= 0) {
        return false
      }
      this._attributeData[attDataId].decoderId = attDecoderId
    } else {
      if (this._posDataDecoderId >= 0) {
        return false
      }
      this._posDataDecoderId = attDecoderId
    }

    const traversalMethod = this._decoder!.buffer()!.decodeUint8()
    if (traversalMethod === undefined) return false
    if (traversalMethod >= MeshTraversalMethod.NUM_TRAVERSAL_METHODS) {
      return false
    }

    const mesh = this._decoder!.mesh()!
    let sequencer: MeshTraversalSequencer | null = null

    if (decoderType === MeshAttributeElementType.MESH_VERTEX_ATTRIBUTE) {
      let encodingData: MeshAttributeIndicesEncodingData | null = null
      if (attDataId < 0) {
        encodingData = this._posEncodingData
      } else {
        encodingData = this._attributeData[attDataId].encodingData
        this._attributeData[attDataId].isConnectivityUsed = false
      }

      sequencer = this._createVertexTraversalSequencer(encodingData, this._cornerTable!, mesh, traversalMethod)
    } else {
      // Per-corner attribute decoder.
      if (traversalMethod !== MeshTraversalMethod.MESH_TRAVERSAL_DEPTH_FIRST) {
        return false
      }
      if (attDataId < 0) {
        return false
      }

      const encodingData = this._attributeData[attDataId].encodingData
      const attCornerTable = this._attributeData[attDataId].connectivityData

      sequencer = this._createVertexTraversalSequencer(encodingData, attCornerTable, mesh, traversalMethod)
    }

    if (!sequencer) {
      return false
    }

    const attController = new SequentialAttributeDecodersController(sequencer)
    return this._decoder!.setAttributesDecoder(attDecoderId, attController)
  }

  _createVertexTraversalSequencer(
    encodingData: MeshAttributeIndicesEncodingData,
    cornerTable: CornerTable | MeshAttributeCornerTable,
    mesh: Mesh,
    traversalMethod: number,
  ): MeshTraversalSequencer {
    const traversalSequencer = new MeshTraversalSequencer(
      mesh,
      encodingData,
      this._vertexTraversalCache,
      this._pointCorner,
    )

    const observer = new MeshAttributeIndicesEncodingObserver(cornerTable, mesh, traversalSequencer, encodingData)

    const traverser =
      traversalMethod === MeshTraversalMethod.MESH_TRAVERSAL_PREDICTION_DEGREE
        ? new MaxPredictionDegreeTraverser()
        : new DepthFirstTraverser()
    traverser.init(cornerTable, observer)

    traversalSequencer.setTraverser(traverser)
    return traversalSequencer
  }

  decodeConnectivity(): boolean {
    const numEncodedVertices = decodeVarint(this._decoder!.buffer()!)
    if (numEncodedVertices === undefined) return false
    this._numEncodedVertices = numEncodedVertices

    const numFaces = decodeVarint(this._decoder!.buffer()!)
    if (numFaces === undefined) return false

    if (numFaces > 0x7fffffff / 3) {
      return false // Draco cannot handle this many faces.
    }
    if (this._numEncodedVertices > numFaces * 3) {
      return false
    }

    // Min edges assuming each is shared by two faces vs max edges between the
    // vertices; if max < min a manifold mesh is impossible.
    const minNumFaceEdges = Math.floor((3 * numFaces) / 2)
    const maxNumVertexEdges = (this._numEncodedVertices * (this._numEncodedVertices - 1)) / 2
    if (maxNumVertexEdges < minNumFaceEdges) {
      return false
    }

    const numAttributeData = this._decoder!.buffer()!.decodeUint8()
    if (numAttributeData === undefined) return false

    const numEncodedSymbols = decodeVarint(this._decoder!.buffer()!)
    if (numEncodedSymbols === undefined) return false

    if (numFaces < numEncodedSymbols) {
      return false
    }
    const maxEncodedFaces = numEncodedSymbols + Math.floor(numEncodedSymbols / 3)
    if (numFaces > maxEncodedFaces) {
      return false
    }

    const numEncodedSplitSymbols = decodeVarint(this._decoder!.buffer()!)
    if (numEncodedSplitSymbols === undefined) return false

    if (numEncodedSplitSymbols > numEncodedSymbols) {
      return false // Split symbols are a sub-set of all symbols.
    }
    this._cornerTable = new CornerTable()
    this._vertexTraversalCache = new Map()
    this._topologySplitData = []
    this._initFaceConfigurations = []
    this._initCorners = []

    this._attributeData = []
    for (let i = 0; i < numAttributeData; ++i) {
      const ad = new AttributeData()
      // Decode-scoped: consumed a few lines below, before the decode returns.
      ad.attributeSeamCorners = scratchInt32(numFaces * 3)
      ad.numSeamCorners = 0
      this._attributeData.push(ad)
    }

    if (!this._cornerTable.reset(numFaces, this._numEncodedVertices + numEncodedSplitSymbols)) {
      return false
    }

    // All vertices start as holes (boundaries). Uint8Array (1=hole) keeps the
    // per-vertex reads/writes monomorphic; vertex count never exceeds this
    // length (enforced via maxNumVertices), so fixed-size storage is safe.
    this._isVertHole = scratchUint8Filled(this._numEncodedVertices + numEncodedSplitSymbols, 1)

    if (this._decodeHoleAndTopologySplitEvents(this._decoder!.buffer()!) === -1) {
      return false
    }

    this._traversalDecoder.init(this)
    // One extra vertex per split symbol.
    this._traversalDecoder.setNumEncodedVertices(this._numEncodedVertices + numEncodedSplitSymbols)
    this._traversalDecoder.setNumAttributeData(numAttributeData)

    const traversalEndBuffer = new DecoderBuffer()
    if (!this._traversalDecoder.start(traversalEndBuffer)) {
      return false
    }

    const numConnectivityVerts = this._decodeConnectivity(numEncodedSymbols)
    if (numConnectivityVerts === -1) {
      return false
    }

    this._decoder!.buffer()!.init(
      traversalEndBuffer.dataHead,
      traversalEndBuffer.remainingSize,
      this._decoder!.buffer()!.bitstreamVersion,
    )

    if (this._attributeData.length > 0) {
      this._decodeAttributeConnectivities()
    }
    this._traversalDecoder.done()

    // _decodeAttributeConnectivities lists each seam edge exactly once, at its
    // lower-face corner, in increasing corner order -- so two attribute data
    // sets have the same seams exactly when their seam-corner lists match.
    // Comparing those lists (a few entries per seam) instead of the derived
    // per-corner seam flags lets a matching set skip building its flags and
    // vertex maps entirely, rather than building them and then discovering they
    // were redundant.
    //
    // The distinct sets' attribute-vertex maps are then built together with the
    // point assignment in one fused pass over the vertex rings (see
    // _assignAttributeVerticesAndPoints); a set that matches its predecessor
    // adopts that predecessor's finished maps afterwards.
    const distinctTables: MeshAttributeCornerTable[] = []
    const adoptions: MeshAttributeCornerTable[] = []
    let previousConnectivityData: MeshAttributeCornerTable | null = null
    let previousSeamCorners: Int32Array | null = null
    let previousSeamCount = 0
    for (let i = 0; i < this._attributeData.length; ++i) {
      const connectivityData = this._attributeData[i].connectivityData
      // Indexed loop avoids a for..of iterator per seam.
      const seamCorners = this._attributeData[i].attributeSeamCorners
      const seamCount = this._attributeData[i].numSeamCorners

      let sameAsPrevious = previousConnectivityData !== null && seamCount === previousSeamCount
      if (sameAsPrevious) {
        const previous = previousSeamCorners!
        for (let s = 0; s < seamCount; ++s) {
          if (seamCorners[s] !== previous[s]) {
            sameAsPrevious = false
            break
          }
        }
      }

      if (sameAsPrevious) {
        adoptions.push(connectivityData, previousConnectivityData!)
      } else {
        connectivityData.initEmpty(this._cornerTable)
        connectivityData.reserveSeamEdges(seamCount)
        for (let s = 0; s < seamCount; ++s) {
          connectivityData.addSeamEdge(seamCorners[s])
        }
        distinctTables.push(connectivityData)
      }
      previousConnectivityData = connectivityData
      previousSeamCorners = seamCorners
      previousSeamCount = seamCount
    }

    if (this._attributeData.length === 0) {
      this._assignPointsToVertices(numConnectivityVerts)
    } else if (!this._assignAttributeVerticesAndPoints(distinctTables)) {
      return false
    }
    // Adoption chains run forward (a set only ever matches its predecessor),
    // so each adopter's source is finished by the time it is reached.
    for (let i = 0; i < adoptions.length; i += 2) {
      adoptions[i].adoptFrom(adoptions[i + 1])
    }

    this._posEncodingData.init(this._cornerTable.numVertices())
    for (let i = 0; i < this._attributeData.length; ++i) {
      let attConnectivityVerts = this._attributeData[i].connectivityData.numVertices()
      if (attConnectivityVerts < this._cornerTable.numVertices()) {
        attConnectivityVerts = this._cornerTable.numVertices()
      }
      this._attributeData[i].encodingData.init(attConnectivityVerts)
    }
    return true
  }

  onAttributesDecoded(): boolean {
    return true
  }

  _isTopologySplit(encoderSymbolId: number, outResult: TopologySplitResult): boolean {
    if (this._topologySplitData.length === 0) {
      return false
    }
    const back = this._topologySplitData[this._topologySplitData.length - 1]
    if (back.sourceSymbolId > encoderSymbolId) {
      // Malformed: source symbol is greater than the current encoder_symbol_id.
      outResult.encoderSplitSymbolId = -1
      return true
    }
    if (back.sourceSymbolId !== encoderSymbolId) {
      return false
    }
    outResult.faceEdge = back.sourceEdge
    outResult.encoderSplitSymbolId = back.splitSymbolId
    this._topologySplitData.pop()
    return true
  }

  _decodeConnectivity(numSymbols: number): number {
    // Reverse decoding of the edgebreaker-encoded symbols.
    // Decode-scoped scratch; entries are always written before being read.
    const activeCornerStack = scratchInt32(numSymbols + this._topologySplitData.length + 16)
    let activeCornerStackSize = 0
    const topologySplitActiveCorners = new Map<number, number>()
    // Reused across symbols: R/L/E symbols check for topology splits, and a
    // fresh result object per check was an allocation in the hot loop.
    const splitResult: TopologySplitResult = { faceEdge: 0, encoderSplitSymbolId: 0 }
    const invalidVertices: number[] = []
    const removeInvalidVertices = this._attributeData.length === 0

    let maxNumVertices = this._isVertHole.length
    let numFacesDecoded = 0

    // Hoist the two corner-indexed flat arrays. Unlike _vertexCorners (grown by
    // addNewVertex), these are sized once in reset() and never reallocated, so
    // direct indexed writes are safe and skip the per-call method dispatch that
    // showed up in profiles. All corners written below are fresh (>= 0).
    const cornerToVertex = this._cornerTable!._cornerToVertex!
    const oppositeCorners = this._cornerTable!._oppositeCorners!

    // Hot loop: accessors are inlined as flat-array reads + corner-triple
    // arithmetic rather than calling the helpers above. _decodeConnectivity
    // exceeds V8's inlining budget, so those helpers stayed real monomorphic
    // calls costing ~15% of decode in profiles. All corners reached here in a
    // well-formed stream are valid (>= 0, < numCorners) and the flat arrays are
    // -1-initialized, so the helpers' guards are unneeded -- except the swing-
    // left boundary terminator below. Helpers remain for the cold post-loop code.
    const vc = this._cornerTable!
    // vertexCorners tracks vc._vertexCorners, which addNewVertex reallocates
    // only when the stream declares fewer vertices than it uses (reset()
    // preallocates the declared count); the local is refreshed there and vc
    // always keeps the authoritative reference for the cold code after the loop.
    let vertexCorners = vc._vertexCorners!
    const isVertHole = this._isVertHole
    const traversalDecoder = this._traversalDecoder
    for (let symbolId = 0; symbolId < numSymbols; ++symbolId) {
      const faceIndex = numFacesDecoded++
      let checkTopologySplit = false
      const symbol = traversalDecoder.decodeSymbol()

      if (symbol === TOPOLOGY_C) {
        // Create a new face between two edges on the open boundary.
        if (activeCornerStackSize === 0) return -1

        const cornerA = activeCornerStack[activeCornerStackSize - 1]
        const nA = cornerA % 3 === 2 ? cornerA - 2 : cornerA + 1 // next(cornerA)
        const vertexX = cornerToVertex[nA]
        const lmcX = vertexCorners[vertexX] // leftMostCorner(vertexX)
        const cornerB = lmcX % 3 === 2 ? lmcX - 2 : lmcX + 1 // next(lmcX)

        if (cornerA === cornerB) return -1
        if (oppositeCorners[cornerA] !== kInvalidCornerIndex || oppositeCorners[cornerB] !== kInvalidCornerIndex) {
          return -1
        }

        const corner = 3 * faceIndex
        oppositeCorners[cornerA] = corner + 1
        oppositeCorners[corner + 1] = cornerA
        oppositeCorners[cornerB] = corner + 2
        oppositeCorners[corner + 2] = cornerB

        const pA = cornerA % 3 === 0 ? cornerA + 2 : cornerA - 1 // prev(cornerA)
        const nB = cornerB % 3 === 2 ? cornerB - 2 : cornerB + 1 // next(cornerB)
        const vertAPrev = cornerToVertex[pA]
        const vertBNext = cornerToVertex[nB]

        if (vertexX === vertAPrev || vertexX === vertBNext) return -1

        cornerToVertex[corner] = vertexX
        cornerToVertex[corner + 1] = vertBNext
        cornerToVertex[corner + 2] = vertAPrev
        vertexCorners[vertAPrev] = corner + 2
        isVertHole[vertexX] = 0 // mark vertex x interior
        activeCornerStack[activeCornerStackSize - 1] = corner
      } else if (symbol === TOPOLOGY_R || symbol === TOPOLOGY_L) {
        // Create a new face extending from the open boundary edge.
        if (activeCornerStackSize === 0) return -1

        const cornerA = activeCornerStack[activeCornerStackSize - 1]
        if (oppositeCorners[cornerA] !== kInvalidCornerIndex) {
          return -1
        }

        const corner = 3 * faceIndex
        let oppCorner: number, cornerL: number, cornerR: number
        if (symbol === TOPOLOGY_R) {
          oppCorner = corner + 2
          cornerL = corner + 1
          cornerR = corner
        } else {
          oppCorner = corner + 1
          cornerL = corner
          cornerR = corner + 2
        }
        oppositeCorners[oppCorner] = cornerA
        oppositeCorners[cornerA] = oppCorner

        // Inlined CornerTable.addNewVertex(); see vertexCorners above.
        let newVertIndex: number
        if (vc._numVertices < vertexCorners.length) {
          newVertIndex = vc._numVertices++
        } else {
          newVertIndex = vc.addNewVertex()
          vertexCorners = vc._vertexCorners!
        }
        if (vc._numVertices > maxNumVertices) return -1

        cornerToVertex[oppCorner] = newVertIndex
        vertexCorners[newVertIndex] = oppCorner

        const pA = cornerA % 3 === 0 ? cornerA + 2 : cornerA - 1 // prev(cornerA)
        const vertexR = cornerToVertex[pA]
        cornerToVertex[cornerR] = vertexR
        vertexCorners[vertexR] = cornerR

        const nA = cornerA % 3 === 2 ? cornerA - 2 : cornerA + 1 // next(cornerA)
        cornerToVertex[cornerL] = cornerToVertex[nA]

        activeCornerStack[activeCornerStackSize - 1] = corner
        checkTopologySplit = true
      } else if (symbol === TOPOLOGY_S) {
        // Merge the two last active edges from the active stack into a new face.
        if (activeCornerStackSize === 0) return -1

        const cornerB = activeCornerStack[activeCornerStackSize - 1]
        activeCornerStackSize--

        // Corner "a" may be a normal active edge or one from a topology split event.
        const splitCorner = topologySplitActiveCorners.get(symbolId)
        if (splitCorner !== undefined) {
          activeCornerStack[activeCornerStackSize++] = splitCorner
        }
        if (activeCornerStackSize === 0) return -1

        const cornerA = activeCornerStack[activeCornerStackSize - 1]
        if (cornerA === cornerB) return -1
        if (oppositeCorners[cornerA] !== kInvalidCornerIndex || oppositeCorners[cornerB] !== kInvalidCornerIndex) {
          return -1
        }

        const corner = 3 * faceIndex
        oppositeCorners[cornerA] = corner + 2
        oppositeCorners[corner + 2] = cornerA
        oppositeCorners[cornerB] = corner + 1
        oppositeCorners[corner + 1] = cornerB

        const pA = cornerA % 3 === 0 ? cornerA + 2 : cornerA - 1 // prev(cornerA)
        const vertexP = cornerToVertex[pA]
        cornerToVertex[corner] = vertexP
        const nA = cornerA % 3 === 2 ? cornerA - 2 : cornerA + 1 // next(cornerA)
        cornerToVertex[corner + 1] = cornerToVertex[nA]

        const pB = cornerB % 3 === 0 ? cornerB + 2 : cornerB - 1 // prev(cornerB)
        const vertBPrev = cornerToVertex[pB]
        cornerToVertex[corner + 2] = vertBPrev
        vertexCorners[vertBPrev] = corner + 2

        let cornerN = cornerB % 3 === 2 ? cornerB - 2 : cornerB + 1 // next(cornerB)
        const vertexN = cornerToVertex[cornerN]
        traversalDecoder.mergeVertices(vertexP, vertexN)
        // Update the left-most corner on the newly merged vertex.
        vertexCorners[vertexP] = vertexCorners[vertexN] // leftMostCorner(vertexN)

        // Update vertex id at corner "n" and all corners CCW from it.
        // swingLeft(c) = next(opposite(next(c))).
        const firstCorner = cornerN
        while (cornerN !== kInvalidCornerIndex) {
          cornerToVertex[cornerN] = vertexP
          const sn = cornerN % 3 === 2 ? cornerN - 2 : cornerN + 1 // next(cornerN)
          const so = oppositeCorners[sn] // opposite(sn)
          cornerN = so < 0 ? -1 : so % 3 === 2 ? so - 2 : so + 1 // next(so) or boundary
          if (cornerN === firstCorner) {
            return -1 // back at start: should not happen for split symbols
          }
        }
        // Isolate the old vertex n.
        vertexCorners[vertexN] = -1
        if (removeInvalidVertices) {
          invalidVertices.push(vertexN)
        }
        activeCornerStack[activeCornerStackSize - 1] = corner
      } else if (symbol === TOPOLOGY_E) {
        const corner = 3 * faceIndex
        // Three new vertices at the corners of the new face (inlined
        // addNewVertex; see vertexCorners above).
        let firstVertIndex: number
        if (vc._numVertices + 3 <= vertexCorners.length) {
          firstVertIndex = vc._numVertices
          vc._numVertices += 3
        } else {
          firstVertIndex = vc.addNewVertex()
          vc.addNewVertex()
          vc.addNewVertex()
          vertexCorners = vc._vertexCorners!
        }

        if (vc._numVertices > maxNumVertices) return -1

        cornerToVertex[corner] = firstVertIndex
        cornerToVertex[corner + 1] = firstVertIndex + 1
        cornerToVertex[corner + 2] = firstVertIndex + 2

        vertexCorners[firstVertIndex] = corner
        vertexCorners[firstVertIndex + 1] = corner + 1
        vertexCorners[firstVertIndex + 2] = corner + 2
        activeCornerStack[activeCornerStackSize++] = corner // push the tip corner
        checkTopologySplit = true
      } else {
        return -1 // unknown symbol
      }

      traversalDecoder.newActiveCornerReached(activeCornerStack[activeCornerStackSize - 1])

      if (checkTopologySplit && this._topologySplitData.length > 0) {
        const encoderSymbolId = numSymbols - symbolId - 1
        while (this._isTopologySplit(encoderSymbolId, splitResult)) {
          if (splitResult.encoderSplitSymbolId < 0) return -1

          const actTopCorner = activeCornerStack[activeCornerStackSize - 1]
          let newActiveCorner: number
          if (splitResult.faceEdge === RIGHT_FACE_EDGE) {
            // next(actTopCorner)
            newActiveCorner = actTopCorner % 3 === 2 ? actTopCorner - 2 : actTopCorner + 1
          } else {
            // prev(actTopCorner)
            newActiveCorner = actTopCorner % 3 === 0 ? actTopCorner + 2 : actTopCorner - 1
          }
          // Encoder split symbol id -> decoder symbol id.
          const decoderSplitSymbolId = numSymbols - splitResult.encoderSplitSymbolId - 1
          topologySplitActiveCorners.set(decoderSplitSymbolId, newActiveCorner)
        }
      }
    }

    if (vc._numVertices > maxNumVertices) {
      return -1
    }

    // The start-face reconstruction and invalid-vertex cleanup run once per
    // primitive over a handful of entries — cold next to the symbol loop
    // above. They live in their own methods so this function's bytecode stays
    // small enough for the engines' optimizing tiers (JavaScriptCore refuses
    // to fully optimize oversized functions; see the round-2 valence-inline
    // revert), which also leaves the JITs room to inline the traversal
    // decoder's per-symbol calls here.
    numFacesDecoded = this._decodeStartFaces(activeCornerStack, activeCornerStackSize, numFacesDecoded)
    if (numFacesDecoded === -1) {
      return -1
    }

    if (numFacesDecoded !== this._cornerTable!.numFaces()) {
      return -1
    }

    return this._removeInvalidVertices(invalidVertices)
  }

  // Connects the remaining active-stack corners to newly decoded start faces.
  // Returns the updated decoded-face count, or -1 on malformed input.
  _decodeStartFaces(activeCornerStack: Int32Array, activeCornerStackSize: number, numFacesDecoded: number): number {
    const ct = this._cornerTable!
    const cornerToVertex = ct._cornerToVertex!
    const oppositeCorners = ct._oppositeCorners!
    const vertexCorners = ct._vertexCorners!
    const isVertHole = this._isVertHole
    const traversalDecoder = this._traversalDecoder
    const numCorners = ct.numCorners()
    const numFaces = ct.numFaces()

    const next = (c: number): number => (c < 0 ? -1 : c % 3 === 2 ? c - 2 : c + 1)
    const vertex = (c: number): number => (c < 0 || c >= numCorners ? -1 : cornerToVertex[c])
    const opposite = (c: number): number => (c < 0 || c >= numCorners ? -1 : oppositeCorners[c])
    const leftMostCorner = (v: number): number => (v < 0 || v >= vertexCorners.length ? -1 : vertexCorners[v])

    // Decode start faces and connect them to the faces from the active stack.
    while (activeCornerStackSize > 0) {
      const corner = activeCornerStack[activeCornerStackSize - 1]
      activeCornerStackSize--

      const interiorFace = traversalDecoder.decodeStartFaceConfiguration()

      if (interiorFace) {
        if (numFacesDecoded >= numFaces) {
          return -1
        }

        const cornerA = corner
        const vertN = vertex(next(cornerA))
        const cornerB = next(leftMostCorner(vertN))

        const vertX = vertex(next(cornerB))
        const cornerC = next(leftMostCorner(vertX))

        if (corner === cornerB || corner === cornerC || cornerB === cornerC) {
          return -1
        }
        if (
          opposite(corner) !== kInvalidCornerIndex ||
          opposite(cornerB) !== kInvalidCornerIndex ||
          opposite(cornerC) !== kInvalidCornerIndex
        ) {
          return -1
        }

        const vertP = vertex(next(cornerC))

        const faceIndex = numFacesDecoded++
        const newCorner = 3 * faceIndex
        oppositeCorners[newCorner] = corner
        oppositeCorners[corner] = newCorner
        oppositeCorners[newCorner + 1] = cornerB
        oppositeCorners[cornerB] = newCorner + 1
        oppositeCorners[newCorner + 2] = cornerC
        oppositeCorners[cornerC] = newCorner + 2

        cornerToVertex[newCorner] = vertX
        cornerToVertex[newCorner + 1] = vertP
        cornerToVertex[newCorner + 2] = vertN

        // Mark all three vertices interior.
        isVertHole[vertX] = 0
        isVertHole[vertP] = 0
        isVertHole[vertN] = 0

        this._initFaceConfigurations.push(true)
        this._initCorners.push(newCorner)
      } else {
        // The initial face wasn't interior.
        this._initFaceConfigurations.push(false)
        this._initCorners.push(corner)
      }
    }

    return numFacesDecoded
  }

  // Removes invalid (isolated) vertices by swapping them with the last valid
  // vertex in the table, matching C++ mesh_edgebreaker_decoder_impl.cc (the
  // forward iteration order matters). Returns the final vertex count, or -1.
  _removeInvalidVertices(invalidVertices: number[]): number {
    const ct = this._cornerTable!
    const cornerToVertex = ct._cornerToVertex!
    const oppositeCorners = ct._oppositeCorners!
    const vertexCorners = ct._vertexCorners!
    const isVertHole = this._isVertHole
    const numCorners = ct.numCorners()

    const next = (c: number): number => (c < 0 ? -1 : c % 3 === 2 ? c - 2 : c + 1)
    const prev = (c: number): number => (c < 0 ? -1 : c % 3 === 0 ? c + 2 : c - 1)
    const vertex = (c: number): number => (c < 0 || c >= numCorners ? -1 : cornerToVertex[c])
    const opposite = (c: number): number => (c < 0 || c >= numCorners ? -1 : oppositeCorners[c])
    const leftMostCorner = (v: number): number => (v < 0 || v >= vertexCorners.length ? -1 : vertexCorners[v])
    const swingLeft = (c: number): number => {
      const n = next(c)
      const o = opposite(n)
      return o < 0 ? -1 : next(o)
    }
    const swingRight = (c: number): number => {
      const p = prev(c)
      const o = opposite(p)
      return o < 0 ? -1 : prev(o)
    }

    let numVertices = ct.numVertices()
    for (let ivIdx = 0; ivIdx < invalidVertices.length; ++ivIdx) {
      const invalidVert = invalidVertices[ivIdx]
      let srcVert = numVertices - 1
      while (leftMostCorner(srcVert) === kInvalidCornerIndex) {
        srcVert = --numVertices - 1
      }
      if (srcVert < invalidVert) continue

      // Remap all corners of srcVert to invalidVert. VertexCornersIterator
      // logic: swing left first, then swing right on boundary.
      const startCid = leftMostCorner(srcVert)
      let cid = startCid
      let leftTraversal = true
      while (cid !== kInvalidCornerIndex) {
        if (vertex(cid) !== srcVert) {
          return -1
        }
        cornerToVertex[cid] = invalidVert
        if (leftTraversal) {
          const nextC = swingLeft(cid)
          if (nextC === kInvalidCornerIndex) {
            // Open boundary reached; switch to right traversal from start.
            leftTraversal = false
            cid = swingRight(startCid)
          } else if (nextC === startCid) {
            break // closed fan
          } else {
            cid = nextC
          }
        } else {
          cid = swingRight(cid)
        }
      }

      vertexCorners[invalidVert] = leftMostCorner(srcVert)
      vertexCorners[srcVert] = -1
      isVertHole[invalidVert] = isVertHole[srcVert]
      isVertHole[srcVert] = 0
      numVertices--
    }
    return numVertices
  }

  // Hole events were removed from the bitstream in 2.1; for 2.2 this only
  // decodes the inline topology-split events.
  _decodeHoleAndTopologySplitEvents(decoderBuffer: DecoderBuffer): number {
    const numTopologySplits = decodeVarint(decoderBuffer)
    if (numTopologySplits === undefined) return -1

    if (numTopologySplits > 0) {
      if (numTopologySplits > this._cornerTable!.numFaces()) {
        return -1
      }
      // Source and split symbol ids use delta + varint coding.
      let lastSourceSymbolId = 0
      for (let i = 0; i < numTopologySplits; ++i) {
        const eventData = new TopologySplitEventData()
        const delta = decodeVarint(decoderBuffer)
        if (delta === undefined) return -1
        eventData.sourceSymbolId = delta + lastSourceSymbolId
        const delta2 = decodeVarint(decoderBuffer)
        if (delta2 === undefined) return -1
        if (delta2 > eventData.sourceSymbolId) return -1
        eventData.splitSymbolId = eventData.sourceSymbolId - delta2
        lastSourceSymbolId = eventData.sourceSymbolId
        this._topologySplitData.push(eventData)
      }
      // Split edges come from a direct bit decoder.
      decoderBuffer.startBitDecoding(false)
      for (let i = 0; i < numTopologySplits; ++i) {
        const edgeData = decoderBuffer.decodeLeastSignificantBits32(1)!
        this._topologySplitData[i].sourceEdge = edgeData & 1
      }
      decoderBuffer.endBitDecoding()
    }
    return decoderBuffer.decodedSize
  }

  // Decode every face's attribute seam connectivity in one flat pass over
  // corners (bitstream >= 2.1). The per-face entry point this replaces re-read
  // the opposite-corner array, attribute-data list and connectivity decoders on
  // each of its numFaces calls; hoisting them here leaves only the irreducible
  // per-corner decodeNextBit work. Within each face the three corners are
  // visited in encoder edge order [base, next, prev] = [c, c+1, c+2] (the
  // caller always starts a face at its base corner, so next/prev need no wrap).
  //
  // The face comparison the C++ makes -- floor(oppCorner/3) >= floor(cc/3) for
  // the face's base corner -- is just `oppCorner >= faceBaseCorner`, since the
  // base corner is a multiple of 3. That removes the per-corner division; the
  // invalid-corner case (-1) is still handled by the branch above it.
  _decodeAttributeConnectivities(): void {
    const oppositeCorners = this._cornerTable!.oppositeCornerArray()
    const attributeData = this._attributeData
    const numAttrData = attributeData.length
    const connectivityDecoders = this._traversalDecoder._attributeConnectivityDecoders!
    const numCorners = this._cornerTable!.numCorners()

    // Overwhelmingly common case (one attribute data set): run a specialized
    // loop with the seam list, its counter and the whole rANS bit-decoder state
    // in locals. The generic loop below pays a property load per corner for
    // each of those, and a real call per decoded bit.
    if (numAttrData === 1) {
      const ad = attributeData[0]
      const seamCorners = ad.attributeSeamCorners
      let numSeamCorners = ad.numSeamCorners
      const decoder = connectivityDecoders[0]
      const ans = decoder.ansDecoder_
      const p = decoder.p_
      const buf = ans.buf!
      const bufStart = ans.bufStart
      let state = ans.state
      let bufOffset = ans.bufOffset

      for (let corner = 0; corner < numCorners; corner += 3) {
        for (let k = 0; k < 3; ++k) {
          const cc = corner + k
          const oppCorner = oppositeCorners[cc]
          if (oppCorner === kInvalidCornerIndex) {
            seamCorners[numSeamCorners++] = cc
          } else if (oppCorner >= corner) {
            // Inlined RAnsBitDecoder.decodeNextBit().
            if (state < ANS_L_BASE && bufOffset > bufStart) {
              state = (state << 8) | buf[--bufOffset]
            }
            const rem = state & 0xff
            const xn = (state >>> 8) * p
            if (rem < p) {
              state = xn + rem
              seamCorners[numSeamCorners++] = cc
            } else {
              state = state - xn - p
            }
          }
        }
      }

      ans.state = state
      ans.bufOffset = bufOffset
      ad.numSeamCorners = numSeamCorners
      return
    }

    // Several attribute data sets: list the corners that carry a decision
    // once (boundary corners, always seams, stored bit-inverted; interior
    // edges at their lower-face corner), then run each set's rANS bit stream
    // over that list with the decoder state in locals -- the same per-corner
    // decisions in the same order, without a real decodeNextBit() call per
    // set per corner. Decode-scoped scratch, written before it is read.
    const candidates = scratchInt32(numCorners)
    let numCandidates = 0
    for (let corner = 0; corner < numCorners; corner += 3) {
      for (let k = 0; k < 3; ++k) {
        const cc = corner + k
        const oppCorner = oppositeCorners[cc]
        if (oppCorner === kInvalidCornerIndex) {
          candidates[numCandidates++] = ~cc
        } else if (oppCorner >= corner) {
          candidates[numCandidates++] = cc
        }
      }
    }
    for (let i = 0; i < numAttrData; ++i) {
      const ad = attributeData[i]
      const seamCorners = ad.attributeSeamCorners
      let numSeamCorners = ad.numSeamCorners
      const decoder = connectivityDecoders[i]
      const ans = decoder.ansDecoder_
      const p = decoder.p_
      const buf = ans.buf!
      const bufStart = ans.bufStart
      let state = ans.state
      let bufOffset = ans.bufOffset
      for (let n = 0; n < numCandidates; ++n) {
        const cc = candidates[n]
        if (cc < 0) {
          seamCorners[numSeamCorners++] = ~cc
          continue
        }
        // Inlined RAnsBitDecoder.decodeNextBit().
        if (state < ANS_L_BASE && bufOffset > bufStart) {
          state = (state << 8) | buf[--bufOffset]
        }
        const rem = state & 0xff
        const xn = (state >>> 8) * p
        if (rem < p) {
          state = xn + rem
          seamCorners[numSeamCorners++] = cc
        } else {
          state = state - xn - p
        }
      }
      ans.state = state
      ans.bufOffset = bufOffset
      ad.numSeamCorners = numSeamCorners
    }
  }

  // Position-only connectivity: vertex indices equal point indices.
  _assignPointsToVertices(numConnectivityVerts: number): void {
    const mesh = this._decoder!.mesh()!
    const ct = this._cornerTable!
    mesh.setNumFaces(ct.numFaces())
    const numCorners = ct.numCorners()
    const faces = mesh.faces_
    const baseCornerToVertex = ct.cornerToVertexArray()
    for (let c = 0; c < numCorners; ++c) {
      faces[c] = baseCornerToVertex[c]
    }
    this._pointCorner = null
    this._decoder!.pointCloud()!.setNumPoints(numConnectivityVerts)
  }

  // One walk around every vertex ring that (a) numbers the attribute vertices
  // of every distinct attribute corner table (C++ MeshAttributeCornerTable::
  // RecomputeVertices, one per table) and (b) assigns the mesh's point ids
  // (C++ AssignPointsToCorners). Each of those is a per-vertex procedure that
  // only reads the ring's own corners and its table's running counter, so
  // running them side by side on one buffered ring produces exactly the ids
  // the separate passes would -- while the ring's corner chain (a serial,
  // cache-missing pointer chase through swingRight) is followed once instead
  // of once per table plus once for the points. Also records one corner per
  // point (_pointCorner) so point-to-value maps can be built per point rather
  // than per corner (see MeshTraversalSequencer).
  //
  // The buffered ring makes the swing-left prefix of the seam-vertex recompute
  // an index walk: swingLeft(ring[j]) is ring[j - 1] (the opposite table is
  // symmetric), and for a closed ring ring[k - 1] when j is 0. An open ring
  // whose leftmost corner still has a left neighbor (never the case for the
  // corner table the edgebreaker decoder builds, which keeps the left-most
  // corner of every boundary vertex, but allowed for by the C++ code) is
  // extended leftwards first, so the walk covers exactly the corners the
  // separate passes would have reached.
  _assignAttributeVerticesAndPoints(tables: MeshAttributeCornerTable[]): boolean {
    const mesh = this._decoder!.mesh()!
    const ct = this._cornerTable!
    mesh.setNumFaces(ct.numFaces())
    const numCorners = ct.numCorners()
    const numVertices = ct.numVertices()
    const faces = mesh.faces_
    const vertexLeftmost = ct.vertexLeftmostCornerArray()
    const swingRight = ct.swingRightArray()
    const baseOpposite = ct.oppositeCornerArray()
    const isVertHole = this._isVertHole as Uint8Array

    const numTables = tables.length
    const attCornerToVertex = new Array<Int32Array>(numTables)
    const edgeOnSeam = new Array<Uint8Array>(numTables)
    const vertexOnSeam = new Array<Uint8Array>(numTables)
    const leftMostMaps = new Array<Int32Array>(numTables)
    // Per-table attribute-vertex counters.
    const numAttVertices = new Int32Array(numTables)
    for (let t = 0; t < numTables; ++t) {
      attCornerToVertex[t] = tables[t].corner_to_vertex_map_ as Int32Array
      edgeOnSeam[t] = tables[t].is_edge_on_seam_ as Uint8Array
      vertexOnSeam[t] = tables[t].is_vertex_on_seam_ as Uint8Array
      // New-vertex count never exceeds the corner count.
      leftMostMaps[t] = scratchInt32(numCorners)
    }
    // Decode-scoped scratch: the ring buffer (each corner alongside its next
    // corner, whose opposite edge is the one crossed when swinging left onto
    // it -- computed once here instead of once per table), and one corner per
    // point (a point's corners all share every attribute vertex, so any one
    // stands for it). All written before they are read.
    const ring = scratchInt32(numCorners)
    const ringNext = scratchInt32(numCorners)
    const pointCorner = scratchInt32(numCorners)
    let numPoints = 0

    for (let v = 0; v < numVertices; ++v) {
      const c = vertexLeftmost[v]
      if (c === kInvalidCornerIndex) continue // isolated vertex

      // Collect the ring: ring[start] is the leftmost corner c, followed by
      // its CW (swingRight) successors; `closed` when they wrap back to c.
      let start = 0
      let k = 0
      ring[k] = c
      ringNext[k++] = c % 3 === 2 ? c - 2 : c + 1
      let actC = swingRight[c]
      while (actC !== kInvalidCornerIndex && actC !== c) {
        if (k === numCorners) return false // cannot happen on a symmetric opposite table
        ring[k] = actC
        ringNext[k++] = actC % 3 === 2 ? actC - 2 : actC + 1
        actC = swingRight[actC]
      }
      const closed = actC === c
      if (!closed) {
        // swingLeft(c) = next(opposite(next(c))); an open ring is expected to
        // begin at a boundary. When it does not, prepend the CCW side so the
        // seam-vertex walk below can still reach it.
        const o = baseOpposite[ringNext[0]]
        let left = o < 0 ? kInvalidCornerIndex : o % 3 === 2 ? o - 2 : o + 1
        if (left !== kInvalidCornerIndex) {
          // Count the CCW corners, shift the CW part up to make room, then
          // write the CCW corners in front so that ring[0] is the far left
          // end. Cold path; the second walk keeps it allocation-free.
          let m = 0
          let cur = left
          while (cur !== kInvalidCornerIndex && cur !== c) {
            if (k + ++m > numCorners) return false
            const ln = cur % 3 === 2 ? cur - 2 : cur + 1
            const lo = baseOpposite[ln]
            cur = lo < 0 ? kInvalidCornerIndex : lo % 3 === 2 ? lo - 2 : lo + 1
          }
          for (let j = k - 1; j >= 0; --j) {
            ring[j + m] = ring[j]
            ringNext[j + m] = ringNext[j]
          }
          cur = left
          for (let i = 1; i <= m; ++i) {
            const ln = cur % 3 === 2 ? cur - 2 : cur + 1
            ring[m - i] = cur
            ringNext[m - i] = ln
            const lo = baseOpposite[ln]
            cur = lo < 0 ? kInvalidCornerIndex : lo % 3 === 2 ? lo - 2 : lo + 1
          }
          start = m
          k += m
        }
      }
      const end = k // one past the last ring index

      // (a) Attribute vertices, per distinct table.
      for (let t = 0; t < numTables; ++t) {
        const c2v = attCornerToVertex[t]
        const leftMostMap = leftMostMaps[t]
        let vertId = numAttVertices[t]
        if (vertexOnSeam[t][v] === 0) {
          // Whole ring (from c CW) is one attribute vertex.
          leftMostMap[vertId] = c
          for (let j = start; j < end; ++j) c2v[ring[j]] = vertId
          numAttVertices[t] = vertId + 1
          continue
        }
        const isEdgeOnSeam = edgeOnSeam[t]
        // Swing left from c until a seam (or the boundary) blocks the way.
        let j = start
        for (;;) {
          const rn = ringNext[j]
          if (isEdgeOnSeam[rn] !== 0 || baseOpposite[rn] < 0) break
          if (j > 0) {
            --j
          } else if (closed) {
            j = end - 1
          } else {
            break // far left end of an open ring
          }
          if (j === start) return false // full circle without a seam
        }
        // Number the sub-vertices CW from there, splitting at seam edges.
        const first = ring[j]
        c2v[first] = vertId
        leftMostMap[vertId] = first
        const steps = closed ? end - 1 : end - 1 - j
        for (let s = 0; s < steps; ++s) {
          if (++j === end) j = 0
          const rc = ring[j]
          if (isEdgeOnSeam[ringNext[j]] !== 0) {
            leftMostMap[++vertId] = rc
          }
          c2v[rc] = vertId
        }
        numAttVertices[t] = vertId + 1
      }

      // (b) Point ids.
      const hole = isVertHole[v] !== 0
      let anySeam = false
      for (let t = 0; t < numTables; ++t) {
        if (vertexOnSeam[t][v] !== 0) {
          anySeam = true
          break
        }
      }
      if (!hole && !anySeam) {
        // Every corner in this ring gets the same point id.
        const pointId = numPoints++
        pointCorner[pointId] = c
        for (let j = start; j < end; ++j) faces[ring[j]] = pointId
        continue
      }
      // Interior seam vertex: start the deduplication at the first attribute
      // vertex change CW from c, taking the seamed tables in order until one
      // shows a change (a table whose only seam edge at this vertex is the
      // one its numbering started after shows none).
      let j = start
      if (!hole) {
        for (let t = 0; t < numTables; ++t) {
          if (vertexOnSeam[t][v] === 0) continue
          const c2v = attCornerToVertex[t]
          const vertId = c2v[c]
          let jj = start
          let found = false
          for (;;) {
            if (++jj === end) {
              if (!closed) return false
              jj = 0
            }
            if (jj === start) break
            if (c2v[ring[jj]] !== vertId) {
              found = true
              break
            }
          }
          if (found) {
            j = jj
            break
          }
        }
      }
      let prevC = ring[j]
      let pointId = numPoints++
      pointCorner[pointId] = prevC
      faces[prevC] = pointId
      const steps = closed ? end - 1 : end - 1 - j
      for (let s = 0; s < steps; ++s) {
        if (++j === end) j = 0
        const rc = ring[j]
        let attributeSeam = false
        for (let t = 0; t < numTables; ++t) {
          const c2v = attCornerToVertex[t]
          if (c2v[rc] !== c2v[prevC]) {
            attributeSeam = true
            break
          }
        }
        if (attributeSeam) {
          pointId = numPoints++
          pointCorner[pointId] = rc
        }
        faces[rc] = pointId
        prevC = rc
      }
    }

    for (let t = 0; t < numTables; ++t) {
      tables[t].setRecomputedVertices(leftMostMaps[t], numAttVertices[t])
    }
    this._pointCorner = pointCorner
    this._decoder!.pointCloud()!.setNumPoints(numPoints)
    return true
  }
}

// Helper class for mesh attribute indices encoding data.
class MeshAttributeIndicesEncodingData {
  _vertexToEncodedAttributeValueIndexMap: Int32Array
  _encodedAttributeValueIndexToCornerMap: Int32Array
  _numValues: number

  constructor() {
    this._vertexToEncodedAttributeValueIndexMap = new Int32Array(0)
    this._encodedAttributeValueIndexToCornerMap = new Int32Array(0)
    this._numValues = 0
  }

  init(numVertices: number): void {
    // Int32Array (non-negative data indices) keeps the hot prediction-lookup
    // reads monomorphic. Decode-scoped scratch: both maps are consumed by the
    // attribute decoders of this primitive and never escape into the result.
    // The vertex map is filled with -1 so the depth-first traverser can use
    // the sign as its vertex-visited flag (assigned entries are always >= 0);
    // vertices no face reaches keep -1, and are never read back on well-formed
    // input (the traversal covers every face corner's vertex).
    this._vertexToEncodedAttributeValueIndexMap = scratchInt32Filled(numVertices, -1)
    this._encodedAttributeValueIndexToCornerMap = scratchInt32(numVertices)
    this._numValues = 0
  }

  // Adopts a traversal result from an identical corner table, avoiding a
  // redundant traversal. The maps depend only on connectivity and are read-only
  // downstream, so sharing is safe.
  adoptTraversalResult(vertexToEncodedMap: Int32Array, encodedToCornerMap: Int32Array, numValues: number): void {
    this._vertexToEncodedAttributeValueIndexMap = vertexToEncodedMap
    this._encodedAttributeValueIndexToCornerMap = encodedToCornerMap
    this._numValues = numValues
  }

  get vertexToEncodedAttributeValueIndexMap(): Int32Array {
    return this._vertexToEncodedAttributeValueIndexMap
  }

  get encodedAttributeValueIndexToCornerMap(): Int32Array {
    return this._encodedAttributeValueIndexToCornerMap
  }

  get numValues(): number {
    return this._numValues
  }

  set numValues(val: number) {
    this._numValues = val
  }
}

// Per-attribute data used by the edgebreaker decoder.
class AttributeData {
  decoderId: number
  connectivityData: MeshAttributeCornerTable
  isConnectivityUsed: boolean
  encodingData: MeshAttributeIndicesEncodingData
  attributeSeamCorners: Int32Array
  numSeamCorners: number

  constructor() {
    this.decoderId = -1
    this.connectivityData = new MeshAttributeCornerTable()
    this.isConnectivityUsed = true
    this.encodingData = new MeshAttributeIndicesEncodingData()
    this.attributeSeamCorners = new Int32Array(0)
    this.numSeamCorners = 0
  }
}

// Minimal CornerTable for the decoder (the full one lives in the mesh module).
class CornerTable {
  _numFaces: number
  _numCorners: number
  _numVertices: number
  _cornerToVertex: Int32Array | null // corner -> vertex
  _oppositeCorners: Int32Array | null // corner -> opposite corner
  _vertexCorners: Int32Array | null // vertex -> left-most corner
  _swingRight: Int32Array | null // corner -> next corner around its vertex, CW

  constructor() {
    this._numFaces = 0
    this._numCorners = 0
    this._numVertices = 0
    this._cornerToVertex = null
    this._oppositeCorners = null
    this._vertexCorners = null
    this._swingRight = null
  }

  reset(numFaces: number, numVertices: number): boolean {
    this._numFaces = numFaces
    this._numCorners = numFaces * 3
    // C++ reserve() allocates capacity but keeps size 0; vertices are added
    // incrementally via addNewVertex().
    this._numVertices = 0
    // Decode-scoped scratch: the result mesh copies what it needs out of these
    // (faces_ in _assignPointsToCorners), so they never outlive the decode.
    this._cornerToVertex = scratchInt32Filled(this._numCorners, -1)
    this._oppositeCorners = scratchInt32Filled(this._numCorners, -1)
    this._vertexCorners = scratchInt32Filled(numVertices, -1)
    this._swingRight = null
    return true
  }

  // swingRight(c) = previous(opposite(previous(c))) for every corner. Walking
  // the corner ring of a vertex is the inner loop of both the attribute-vertex
  // recompute and the point assignment, and each of those passes otherwise
  // pays two modulus-by-3 chains per step on top of the opposite lookup. Built
  // lazily -- callers only reach it once connectivity is final -- from
  // decode-scoped scratch, and dropped by reset().
  swingRightArray(): Int32Array {
    let table = this._swingRight
    if (table === null) {
      const numCorners = this._numCorners
      const opposite = this._oppositeCorners!
      table = scratchInt32(numCorners)
      // Unrolled per face: previous() of a face's corners is [c+2, c, c+1].
      for (let c = 0; c < numCorners; c += 3) {
        let o = opposite[c + 2]
        table[c] = o < 0 ? kInvalidCornerIndex : o % 3 === 0 ? o + 2 : o - 1
        o = opposite[c]
        table[c + 1] = o < 0 ? kInvalidCornerIndex : o % 3 === 0 ? o + 2 : o - 1
        o = opposite[c + 1]
        table[c + 2] = o < 0 ? kInvalidCornerIndex : o % 3 === 0 ? o + 2 : o - 1
      }
      this._swingRight = table
    }
    return table
  }

  numFaces(): number {
    return this._numFaces
  }

  numCorners(): number {
    return this._numCorners
  }

  numVertices(): number {
    return this._numVertices
  }

  next(corner: number): number {
    if (corner < 0) return -1
    const rem = corner - ((corner / 3) | 0) * 3
    return rem === 2 ? corner - 2 : corner + 1
  }

  previous(corner: number): number {
    if (corner < 0) return -1
    const rem = corner - ((corner / 3) | 0) * 3
    return rem === 0 ? corner + 2 : corner - 1
  }

  vertex(corner: number): number {
    if (corner < 0 || corner >= this._numCorners) return -1
    return this._cornerToVertex![corner]
  }

  opposite(corner: number): number {
    if (corner < 0 || corner >= this._numCorners) return -1
    return this._oppositeCorners![corner]
  }

  // Flat-array accessors; let callers avoid polymorphic per-corner dispatch.
  cornerToVertexArray(): Int32Array {
    return this._cornerToVertex!
  }
  oppositeCornerArray(): Int32Array {
    return this._oppositeCorners!
  }
  vertexLeftmostCornerArray(): Int32Array {
    return this._vertexCorners!
  }

  // Mirrors C++ CornerTable::AddNewVertex() (push_back(kInvalidCornerIndex)).
  addNewVertex(): number {
    const newVertex = this._numVertices
    this._numVertices++
    // Array pre-allocated in reset(); extend only when capacity is exceeded.
    if (newVertex >= this._vertexCorners!.length) {
      const newCapacity = Math.max(newVertex + 1, this._vertexCorners!.length * 2, 64)
      const newArr = scratchInt32Filled(newCapacity, -1)
      newArr.set(this._vertexCorners!)
      this._vertexCorners = newArr
    }
    this._vertexCorners![newVertex] = -1
    return newVertex
  }

  // Next corner around a vertex, CCW. SwingLeft(c) = Next(Opposite(Next(c))).
  swingLeft(corner: number): number {
    const nextCorner = this.next(corner)
    const oppCorner = this.opposite(nextCorner)
    if (oppCorner < 0) return -1
    return this.next(oppCorner)
  }

  // Next corner around a vertex, CW. SwingRight(c) = Previous(Opposite(Previous(c))).
  swingRight(corner: number): number {
    const prevCorner = this.previous(corner)
    const oppCorner = this.opposite(prevCorner)
    if (oppCorner < 0) return -1
    return this.previous(oppCorner)
  }
}

export { MeshEdgebreakerDecoderImpl, AttributeData, CornerTable, MeshAttributeIndicesEncodingData }
