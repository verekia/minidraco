// Ported from draco.js src/compression/config/CompressionShared.js (MIT)

export const EncodedGeometryType = {
  POINT_CLOUD: 0,
  TRIANGULAR_MESH: 1,
} as const

export const MeshEncoderMethod = {
  MESH_SEQUENTIAL_ENCODING: 0,
  MESH_EDGEBREAKER_ENCODING: 1,
} as const

export const SequentialAttributeEncoderType = {
  SEQUENTIAL_ATTRIBUTE_ENCODER_GENERIC: 0,
  SEQUENTIAL_ATTRIBUTE_ENCODER_INTEGER: 1,
  SEQUENTIAL_ATTRIBUTE_ENCODER_QUANTIZATION: 2,
  SEQUENTIAL_ATTRIBUTE_ENCODER_NORMALS: 3,
} as const

// Members the decoder never references (PREDICTION_UNDEFINED = -1,
// PREDICTION_DIFFERENCE = 0, MESH_PREDICTION_TEX_COORDS_DEPRECATED = 3) are
// omitted; the values are the bitstream's.
export const PredictionSchemeMethod = {
  PREDICTION_NONE: -2,
  MESH_PREDICTION_PARALLELOGRAM: 1,
  MESH_PREDICTION_MULTI_PARALLELOGRAM: 2,
  MESH_PREDICTION_CONSTRAINED_MULTI_PARALLELOGRAM: 4,
  MESH_PREDICTION_TEX_COORDS_PORTABLE: 5,
  MESH_PREDICTION_GEOMETRIC_NORMAL: 6,
  NUM_PREDICTION_SCHEMES: 7,
} as const

// PREDICTION_TRANSFORM_DELTA = 0 is never referenced.
export const PredictionSchemeTransformType = {
  PREDICTION_TRANSFORM_NONE: -1,
  PREDICTION_TRANSFORM_WRAP: 1,
  PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON: 2,
  PREDICTION_TRANSFORM_NORMAL_OCTAHEDRON_CANONICALIZED: 3,
  NUM_PREDICTION_SCHEME_TRANSFORM_TYPES: 4,
} as const

export const MeshTraversalMethod = {
  MESH_TRAVERSAL_DEPTH_FIRST: 0,
  MESH_TRAVERSAL_PREDICTION_DEGREE: 1,
  NUM_TRAVERSAL_METHODS: 2,
} as const

export const MeshEdgebreakerConnectivityEncodingMethod = {
  MESH_EDGEBREAKER_STANDARD_ENCODING: 0,
  MESH_EDGEBREAKER_PREDICTIVE_ENCODING: 1, // Deprecated.
  MESH_EDGEBREAKER_VALENCE_ENCODING: 2,
} as const

// Draco header V1 (the five "DRACO" magic bytes are checked, not stored).
export class DracoHeader {
  versionMajor = 0
  versionMinor = 0
  encoderType = 0
  encoderMethod = 0
  flags = 0
}

export const SymbolCodingMethod = {
  SYMBOL_CODING_TAGGED: 0,
  SYMBOL_CODING_RAW: 1,
} as const

// Mask for setting and getting the bit for metadata in |flags| of header.
export const METADATA_FLAG_MASK = 0x8000
