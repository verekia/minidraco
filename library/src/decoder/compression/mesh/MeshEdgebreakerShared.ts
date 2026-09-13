// Ported from draco.js src/compression/mesh/MeshEdgebreakerShared.js (MIT)

// Edgebreaker topology bit patterns (variable-length codes; trailing comment is
// the bit sequence as stored in the bitstream).
export const TOPOLOGY_C = 0x0 // 0
export const TOPOLOGY_S = 0x1 // 1 0 0
export const TOPOLOGY_L = 0x3 // 1 1 0
export const TOPOLOGY_R = 0x5 // 1 0 1
export const TOPOLOGY_E = 0x7 // 1 1 1
export const TOPOLOGY_INVALID = 9

export const edgeBreakerSymbolToTopologyId: number[] = [TOPOLOGY_C, TOPOLOGY_S, TOPOLOGY_L, TOPOLOGY_R, TOPOLOGY_E]

// Edge relative to the tip vertex of a visited triangle (the other is the left edge).
export const RIGHT_FACE_EDGE = 1

// Data about a source face connecting to an already-traversed face that was
// either the initial face or one encoded with the topology S (split) symbol.
export class TopologySplitEventData {
  splitSymbolId = 0
  sourceSymbolId = 0
  sourceEdge = 0 // 0 = LEFT_FACE_EDGE, 1 = RIGHT_FACE_EDGE
}
