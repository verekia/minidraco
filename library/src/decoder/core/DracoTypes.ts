// Ported from draco.js src/core/DracoTypes.js (MIT)

export const enum DataType {
  INVALID = 0,
  INT8 = 1,
  UINT8 = 2,
  INT16 = 3,
  UINT16 = 4,
  INT32 = 5,
  UINT32 = 6,
  INT64 = 7,
  UINT64 = 8,
  FLOAT32 = 9,
  FLOAT64 = 10,
  BOOL = 11,
  TYPES_COUNT = 12,
}

export function dataTypeLength(dt: number): number {
  switch (dt) {
    case DataType.INT8:
    case DataType.UINT8:
    case DataType.BOOL:
      return 1
    case DataType.INT16:
    case DataType.UINT16:
      return 2
    case DataType.INT32:
    case DataType.UINT32:
    case DataType.FLOAT32:
      return 4
    case DataType.INT64:
    case DataType.UINT64:
    case DataType.FLOAT64:
      return 8
    default:
      return -1
  }
}
