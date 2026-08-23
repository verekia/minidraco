// Decode-scoped scratch arena: pooled typed-array buffers for allocations
// whose lifetime is a single decode (traversal flags, seam-patched opposite
// tables, connectivity stacks, attribute corner tables, ...). Buffers are
// borrowed during a decode and returned all at once by releaseScratch(),
// called at the end of decodeMeshFromBuffer — decodes are synchronous and
// never interleave, so a module-level pool is safe (each worker has its own
// module instance).
//
// Borrowed buffers may be larger than requested, so callers either must not
// read .length or must use the exact-size subarray the acquire functions
// return. Buffers come back with arbitrary contents; use the *Zeroed / *Filled
// variants when the algorithm relies on initialization.

// Buffers are pooled by power-of-two size class, so a request is O(1): pick
// the class, pop. A linear best-fit scan over one flat free list showed up in
// profiles once a decode started borrowing a dozen buffers per primitive.
//
// The first buffer in a class is allocated at exactly the requested size, so a
// homogeneous workload (the same model, or same-shaped primitives) wastes
// nothing. Only when a later request in the same class does not fit is the
// buffer replaced by a full class-sized one, after which every request in the
// class fits. Requests too large to pool are served by a plain allocation.
const MAX_CLASS = 28
const freeInt32: Int32Array[][] = []
const freeUint32: Uint32Array[][] = []
const freeUint8: Uint8Array[][] = []
for (let i = 0; i <= MAX_CLASS; ++i) {
  freeInt32.push([])
  freeUint32.push([])
  freeUint8.push([])
}
const borrowedInt32: Int32Array[] = []
const borrowedUint32: Uint32Array[] = []
const borrowedUint8: Uint8Array[] = []

// Smallest k with (1 << k) >= size.
const sizeClass = (size: number): number => (size <= 1 ? 0 : 32 - Math.clz32(size - 1))

const takeInt32 = (size: number): Int32Array => {
  const k = sizeClass(size)
  if (k > MAX_CLASS) return new Int32Array(size)
  const bucket = freeInt32[k]
  let pooled = bucket.length > 0 ? bucket.pop()! : new Int32Array(size)
  if (pooled.length < size) pooled = new Int32Array(1 << k)
  borrowedInt32.push(pooled)
  return pooled.length === size ? pooled : pooled.subarray(0, size)
}

const takeUint32 = (size: number): Uint32Array => {
  const k = sizeClass(size)
  if (k > MAX_CLASS) return new Uint32Array(size)
  const bucket = freeUint32[k]
  let pooled = bucket.length > 0 ? bucket.pop()! : new Uint32Array(size)
  if (pooled.length < size) pooled = new Uint32Array(1 << k)
  borrowedUint32.push(pooled)
  return pooled.length === size ? pooled : pooled.subarray(0, size)
}

const takeUint8 = (size: number): Uint8Array => {
  const k = sizeClass(size)
  if (k > MAX_CLASS) return new Uint8Array(size)
  const bucket = freeUint8[k]
  let pooled = bucket.length > 0 ? bucket.pop()! : new Uint8Array(size)
  if (pooled.length < size) pooled = new Uint8Array(1 << k)
  borrowedUint8.push(pooled)
  return pooled.length === size ? pooled : pooled.subarray(0, size)
}

// Exact-size view over a pooled buffer; contents are arbitrary.
export const scratchInt32 = (size: number): Int32Array => takeInt32(size)

// Exact-size view over a pooled buffer, with every entry set to `value`.
export const scratchInt32Filled = (size: number, value: number): Int32Array => {
  const view = takeInt32(size)
  view.fill(value)
  return view
}

// Exact-size view over a pooled buffer; contents are arbitrary.
export const scratchUint32 = (size: number): Uint32Array => takeUint32(size)

// Exact-size view over a pooled buffer; contents are arbitrary.
export const scratchUint8 = (size: number): Uint8Array => takeUint8(size)

// Exact-size view over a pooled buffer, cleared to 0.
export const scratchUint8Zeroed = (size: number): Uint8Array => {
  const view = takeUint8(size)
  view.fill(0)
  return view
}

// Exact-size view over a pooled buffer, with every byte set to `value`.
export const scratchUint8Filled = (size: number, value: number): Uint8Array => {
  const view = takeUint8(size)
  view.fill(value)
  return view
}

// Returns every borrowed buffer to the pool. Nothing may hold on to a scratch
// buffer past this point — it runs when the decode's result mesh no longer
// references any of them (result data lives in attribute buffers / faces_).
export const releaseScratch = (): void => {
  for (let i = 0; i < borrowedInt32.length; ++i) {
    const buffer = borrowedInt32[i]
    freeInt32[sizeClass(buffer.length)].push(buffer)
  }
  for (let i = 0; i < borrowedUint32.length; ++i) {
    const buffer = borrowedUint32[i]
    freeUint32[sizeClass(buffer.length)].push(buffer)
  }
  for (let i = 0; i < borrowedUint8.length; ++i) {
    const buffer = borrowedUint8[i]
    freeUint8[sizeClass(buffer.length)].push(buffer)
  }
  borrowedInt32.length = 0
  borrowedUint32.length = 0
  borrowedUint8.length = 0
}
