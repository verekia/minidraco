// Ported from draco.js src/compression/entropy/ANSCoding.js (MIT)
// Asymmetric Numeral Systems (rANS), decode-only. http://arxiv.org/abs/1311.2540v2

export const ANS_P8_PRECISION = 256
export const ANS_L_BASE = 4096
const ANS_IO_BASE = 256

function memGetLe16(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8)
}

function memGetLe24(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16)
}

function memGetLe32(buf: Uint8Array, offset: number): number {
  return (
    buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | ((buf[offset + 3] << 24) >>> 0) // >>> 0 to stay unsigned
  )
}

export class AnsDecoder {
  buf: Uint8Array | null
  bufOffset: number
  // First valid byte of this decoder's slice within buf: init is passed
  // absolute offsets into the source buffer to avoid a subarray allocation.
  bufStart: number
  state: number

  constructor() {
    this.buf = null // Uint8Array
    this.bufOffset = 0
    this.bufStart = 0
    this.state = 0
  }
}

// offset is the number of encoded bytes. Returns 0 on success, 1 on error.
export function ansReadInit(ans: AnsDecoder, buf: Uint8Array, offset: number, base: number = 0): number {
  if (offset - base < 1) {
    return 1
  }
  ans.buf = buf
  ans.bufStart = base
  const x = buf[offset - 1] >> 6
  if (x === 0) {
    ans.bufOffset = offset - 1
    ans.state = buf[offset - 1] & 0x3f
  } else if (x === 1) {
    if (offset - base < 2) {
      return 1
    }
    ans.bufOffset = offset - 2
    ans.state = memGetLe16(buf, offset - 2) & 0x3fff
  } else if (x === 2) {
    if (offset - base < 3) {
      return 1
    }
    ans.bufOffset = offset - 3
    ans.state = memGetLe24(buf, offset - 3) & 0x3fffff
  } else {
    return 1
  }
  ans.state += ANS_L_BASE
  if (ans.state >= ANS_L_BASE * ANS_IO_BASE) {
    return 1
  }
  return 0
}

export function ansReadEnd(ans: AnsDecoder): boolean {
  return ans.state === ANS_L_BASE
}

// Freelists for the rANS decoding tables. Symbol decoders run strictly
// sequentially (create → decode → readEnd), and decoding a large GLB creates
// thousands of them (one per attribute / traversal context per primitive), so
// reusing the buffers avoids most of the alloc+zero cost. Buffers are handed
// out in ransBuildLookUpTable and returned on readEnd(); an early error path
// simply never returns its buffers (they are GC'd with the decoder) — safe,
// just unpooled.
const tablePool: (Uint8Array | Uint16Array | Uint32Array)[] = []

const acquirePooled = <T extends Uint8Array | Uint16Array | Uint32Array>(
  Ctor: new (length: number) => T,
  size: number,
): T => {
  for (let i = tablePool.length - 1; i >= 0; --i) {
    const buf = tablePool[i]
    if (buf.constructor === Ctor && buf.length >= size) {
      tablePool[i] = tablePool[tablePool.length - 1]
      tablePool.pop()
      return buf as T
    }
  }
  return new Ctor(size)
}

export class RAnsDecoder {
  ransPrecisionBits: number
  ransPrecision: number
  ransPrecisionMask: number
  lRansBase: number
  lutTable: Uint8Array | Uint16Array | Uint32Array | null
  probTable: Uint32Array | null
  cumProbTable: Uint32Array | null
  buf: Uint8Array | null
  bufOffset: number
  // First valid byte of this decoder's slice within buf (absolute offsets,
  // see AnsDecoder.bufStart).
  bufStart: number
  state: number

  constructor(ransPrecisionBits: number) {
    this.ransPrecisionBits = ransPrecisionBits
    this.ransPrecision = 1 << ransPrecisionBits
    this.ransPrecisionMask = this.ransPrecision - 1
    this.lRansBase = this.ransPrecision * 4
    this.lutTable = null // Uint32Array
    this.probTable = null // Uint32Array, flat
    this.cumProbTable = null // Uint32Array, flat
    // State inlined (not a nested AnsDecoder) so the ransRead() hot loop touches own props.
    this.buf = null
    this.bufOffset = 0
    this.bufStart = 0
    this.state = 0
  }

  // offset is the absolute end of the encoded bytes within buf and base the
  // absolute start (offset - base = encoded length). Passing the source
  // buffer with absolute offsets avoids a subarray allocation per init.
  // Returns 0 on success, non-zero on error.
  readInit(buf: Uint8Array, offset: number, base: number = 0): number {
    if (offset - base < 1) {
      return 1
    }
    this.buf = buf
    this.bufStart = base
    const x = buf[offset - 1] >> 6
    if (x === 0) {
      this.bufOffset = offset - 1
      this.state = buf[offset - 1] & 0x3f
    } else if (x === 1) {
      if (offset - base < 2) {
        return 1
      }
      this.bufOffset = offset - 2
      this.state = memGetLe16(buf, offset - 2) & 0x3fff
    } else if (x === 2) {
      if (offset - base < 3) {
        return 1
      }
      this.bufOffset = offset - 3
      this.state = memGetLe24(buf, offset - 3) & 0x3fffff
    } else if (x === 3) {
      this.bufOffset = offset - 4
      this.state = memGetLe32(buf, offset - 4) & 0x3fffffff
    } else {
      return 1
    }
    this.state += this.lRansBase
    if (this.state >= this.lRansBase * ANS_IO_BASE) {
      return 1
    }
    return 0
  }

  readEnd(): boolean {
    // Return the decoding tables to the pool (see acquirePooled).
    if (this.lutTable !== null) {
      tablePool.push(this.lutTable)
      this.lutTable = null
    }
    if (this.probTable !== null) {
      tablePool.push(this.probTable)
      this.probTable = null
    }
    if (this.cumProbTable !== null) {
      tablePool.push(this.cumProbTable)
      this.cumProbTable = null
    }
    return this.state === this.lRansBase
  }

  ransRead(): number {
    // Cache state in locals for the renormalization loop: read once, write back once.
    const buf = this.buf!
    const lRansBase = this.lRansBase
    let state = this.state
    let bufOffset = this.bufOffset
    const bufStart = this.bufStart
    while (state < lRansBase && bufOffset > bufStart) {
      state = (state << 8) | buf[--bufOffset]
    }
    const quo = state >>> this.ransPrecisionBits
    const rem = state & this.ransPrecisionMask
    const symbol = this.lutTable![rem]
    this.state = quo * this.probTable![symbol] + rem - this.cumProbTable![symbol]
    this.bufOffset = bufOffset
    return symbol
  }

  // Batch ransRead() into out[0..count): all fields hoisted to locals, state
  // written back once. Removes per-symbol property reads and call indirection.
  // lutTable's element type varies per decoder (Uint8/16/32 by symbol count),
  // which would make the hot lutTable[rem] access site polymorphic — dispatch
  // once here so each loop body stays monomorphic on its concrete type. The
  // three bodies are intentionally identical copies.
  decodeSymbols(out: Uint32Array, count: number): void {
    const lutTable = this.lutTable!
    if (lutTable instanceof Uint8Array) {
      this._decodeSymbolsU8(out, count, lutTable)
    } else if (lutTable instanceof Uint16Array) {
      this._decodeSymbolsU16(out, count, lutTable)
    } else {
      this._decodeSymbolsU32(out, count, lutTable)
    }
  }

  _decodeSymbolsU8(out: Uint32Array, count: number, lutTable: Uint8Array): void {
    const buf = this.buf!
    const lRansBase = this.lRansBase
    const ransPrecisionBits = this.ransPrecisionBits
    const ransPrecisionMask = this.ransPrecisionMask
    const probTable = this.probTable!
    const cumProbTable = this.cumProbTable!
    let state = this.state
    let bufOffset = this.bufOffset
    const bufStart = this.bufStart
    for (let i = 0; i < count; ++i) {
      while (state < lRansBase && bufOffset > bufStart) {
        state = (state << 8) | buf[--bufOffset]
      }
      const rem = state & ransPrecisionMask
      const symbol = lutTable[rem]
      out[i] = symbol
      state = (state >>> ransPrecisionBits) * probTable[symbol] + rem - cumProbTable[symbol]
    }
    this.state = state
    this.bufOffset = bufOffset
  }

  _decodeSymbolsU16(out: Uint32Array, count: number, lutTable: Uint16Array): void {
    const buf = this.buf!
    const lRansBase = this.lRansBase
    const ransPrecisionBits = this.ransPrecisionBits
    const ransPrecisionMask = this.ransPrecisionMask
    const probTable = this.probTable!
    const cumProbTable = this.cumProbTable!
    let state = this.state
    let bufOffset = this.bufOffset
    const bufStart = this.bufStart
    for (let i = 0; i < count; ++i) {
      while (state < lRansBase && bufOffset > bufStart) {
        state = (state << 8) | buf[--bufOffset]
      }
      const rem = state & ransPrecisionMask
      const symbol = lutTable[rem]
      out[i] = symbol
      state = (state >>> ransPrecisionBits) * probTable[symbol] + rem - cumProbTable[symbol]
    }
    this.state = state
    this.bufOffset = bufOffset
  }

  _decodeSymbolsU32(out: Uint32Array, count: number, lutTable: Uint32Array): void {
    const buf = this.buf!
    const lRansBase = this.lRansBase
    const ransPrecisionBits = this.ransPrecisionBits
    const ransPrecisionMask = this.ransPrecisionMask
    const probTable = this.probTable!
    const cumProbTable = this.cumProbTable!
    let state = this.state
    let bufOffset = this.bufOffset
    const bufStart = this.bufStart
    for (let i = 0; i < count; ++i) {
      while (state < lRansBase && bufOffset > bufStart) {
        state = (state << 8) | buf[--bufOffset]
      }
      const rem = state & ransPrecisionMask
      const symbol = lutTable[rem]
      out[i] = symbol
      state = (state >>> ransPrecisionBits) * probTable[symbol] + rem - cumProbTable[symbol]
    }
    this.state = state
    this.bufOffset = bufOffset
  }

  // Builds the ransPrecision-entry lookup table. Returns false on bad input data.
  ransBuildLookUpTable(tokenProbs: Uint32Array, numSymbols: number): boolean {
    // lutTable is indexed by `rem` (random in [0, ransPrecision)), so it's the
    // hottest random read in decodeSymbols()/ransRead(). Its values are symbol
    // ids (< numSymbols), so pick the narrowest element type that holds them:
    // shrinking the table (up to 4x) keeps that random access closer to cache.
    const LutArray = numSymbols <= 256 ? Uint8Array : numSymbols <= 65536 ? Uint16Array : Uint32Array
    // Pooled buffers may be oversized; every slot in the used range is written
    // below (cumProb must land exactly on ransPrecision), so no clearing needed.
    const lutTable = acquirePooled(LutArray as new (length: number) => Uint8Array, this.ransPrecision)
    const probTable = acquirePooled(Uint32Array, numSymbols)
    const cumProbTable = acquirePooled(Uint32Array, numSymbols)
    this.lutTable = lutTable
    this.probTable = probTable
    this.cumProbTable = cumProbTable
    let cumProb = 0
    let actProb = 0
    for (let i = 0; i < numSymbols; ++i) {
      const prob = tokenProbs[i]
      probTable[i] = prob
      cumProbTable[i] = cumProb
      cumProb += prob
      if (cumProb > this.ransPrecision) {
        return false
      }
      // Manual loop for short runs: fill()'s per-call overhead dominates them.
      if (prob < 32) {
        for (let j = actProb; j < cumProb; ++j) {
          lutTable[j] = i
        }
      } else {
        lutTable.fill(i, actProb, cumProb)
      }
      actProb = cumProb
    }
    if (cumProb !== this.ransPrecision) {
      return false
    }
    return true
  }
}
