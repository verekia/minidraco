// Decode-scoped scratch arena for allocations whose lifetime is a single
// decode (traversal flags, seam-patched opposite tables, connectivity stacks,
// attribute corner tables, ...): typed-array views carved out of one reusable
// ArrayBuffer by bumping an offset, all returned at once by releaseScratch(),
// called at the end of decodeMeshFromBuffer — decodes are synchronous and
// never interleave, so a module-level arena is safe (each worker has its own
// module instance).
//
// A primitive-heavy file borrows a couple of dozen buffers per primitive, most
// of them small, so a borrow is a bump and a view, and the release a reset:
// no free lists, no per-buffer bookkeeping. Views come back with arbitrary
// contents; use the *Zeroed / *Filled variants when the algorithm relies on
// initialization. Nothing may reinterpret a scratch view's underlying buffer
// (it is shared).
let arena = new ArrayBuffer(1 << 16)
// Next free byte of the current arena, and the bytes borrowed by this decode
// from arenas it has already outgrown.
let top = 0
let outgrown = 0

// Byte offset of a new 8-byte-aligned block of `bytes` bytes. When the arena
// is full, the decode continues in a fresh one (views into the old one stay
// valid; it is dropped once they are), and the release sizes the arena to
// the decode's whole need so a like decode fits next time.
const carve = (bytes: number): number => {
  const size = (bytes + 7) & ~7
  if (top + size > arena.byteLength) {
    outgrown += top
    arena = new ArrayBuffer(Math.max(arena.byteLength * 2, size))
    top = 0
  }
  const offset = top
  top += size
  return offset
}

// (carve first: it may replace the arena the view is taken of.)
export const scratchInt32 = (size: number): Int32Array => {
  const offset = carve(size * 4)
  return new Int32Array(arena, offset, size)
}

export const scratchUint32 = (size: number): Uint32Array => {
  const offset = carve(size * 4)
  return new Uint32Array(arena, offset, size)
}

export const scratchUint8 = (size: number): Uint8Array => {
  const offset = carve(size)
  return new Uint8Array(arena, offset, size)
}

// With every entry set to `value`.
export const scratchInt32Filled = (size: number, value: number): Int32Array => scratchInt32(size).fill(value)

// Cleared to 0.
export const scratchUint32Zeroed = (size: number): Uint32Array => scratchUint32(size).fill(0)

// Cleared to 0.
export const scratchUint8Zeroed = (size: number): Uint8Array => scratchUint8(size).fill(0)

// With every byte set to `value`.
export const scratchUint8Filled = (size: number, value: number): Uint8Array => scratchUint8(size).fill(value)

// Placeholders for decode-internal typed-array fields until their real
// (scratch) arrays are assigned: one shared instance of each type instead of
// a fresh empty array per field per primitive. Never for anything that can
// reach the caller (which might transfer its buffer).
export const EMPTY_INT32 = new Int32Array(0)
export const EMPTY_UINT8 = new Uint8Array(0)

// Returns every borrowed view to the arena. Nothing may hold on to a scratch
// view past this point — it runs when the decode's result mesh no longer
// references any of them (result data lives in attribute buffers / faces_).
export const releaseScratch = (): void => {
  if (outgrown > 0) {
    arena = new ArrayBuffer(outgrown + top)
    outgrown = 0
  }
  top = 0
}
