// Decode-scoped scratch arena: pooled typed-array buffers for allocations
// whose lifetime is a single decode (traversal flags, seam-patched opposite
// tables, connectivity stacks, ...). Buffers are borrowed during a decode and
// returned all at once by releaseScratch(), called at the end of
// decodeMeshFromBuffer — decodes are synchronous and never interleave, so a
// module-level pool is safe (each worker has its own module instance).
//
// Borrowed buffers may be larger than requested, so callers either must not
// read .length or must use the exact-size subarray the acquire functions
// return. Buffers come back with arbitrary contents; use the *Zeroed variants
// when the algorithm relies on zero-initialization.

const freeInt32: Int32Array[] = []
const freeUint8: Uint8Array[] = []
const borrowedInt32: Int32Array[] = []
const borrowedUint8: Uint8Array[] = []

const acquire = <T extends Int32Array | Uint8Array>(free: T[], borrowed: T[], size: number): T | null => {
  for (let i = free.length - 1; i >= 0; --i) {
    const buffer = free[i]
    if (buffer.length >= size) {
      free[i] = free[free.length - 1]
      free.pop()
      borrowed.push(buffer)
      return buffer
    }
  }
  return null
}

// Exact-size view over a pooled buffer; contents are arbitrary.
export const scratchInt32 = (size: number): Int32Array => {
  const pooled = acquire(freeInt32, borrowedInt32, size)
  if (pooled !== null) return pooled.subarray(0, size)
  const fresh = new Int32Array(size)
  borrowedInt32.push(fresh)
  return fresh
}

// Exact-size view over a pooled buffer, cleared to 0.
export const scratchUint8Zeroed = (size: number): Uint8Array => {
  const pooled = acquire(freeUint8, borrowedUint8, size)
  if (pooled !== null) {
    const view = pooled.subarray(0, size)
    view.fill(0)
    return view
  }
  const fresh = new Uint8Array(size)
  borrowedUint8.push(fresh)
  return fresh
}

// Returns every borrowed buffer to the pool. Nothing may hold on to a scratch
// buffer past this point — it runs when the decode's result mesh no longer
// references any of them (result data lives in attribute buffers / faces_).
export const releaseScratch = (): void => {
  for (const buffer of borrowedInt32) freeInt32.push(buffer)
  for (const buffer of borrowedUint8) freeUint8.push(buffer)
  borrowedInt32.length = 0
  borrowedUint8.length = 0
}
