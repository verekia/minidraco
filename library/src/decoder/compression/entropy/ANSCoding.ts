// Ported from draco.js src/compression/entropy/ANSCoding.js (MIT)
// Asymmetric Numeral Systems (rANS), decode-only. http://arxiv.org/abs/1311.2540v2

export const ANS_P8_PRECISION = 256
export const ANS_L_BASE = 4096
const ANS_IO_BASE = 256

// Short-stream decoding (see RAnsDecoder.ransBuildLookUpTable): a stream whose
// symbol count times this factor is below the rANS precision skips the full
// lut for a bucket table of at most 2^COARSE_BUCKET_BITS entries.
const COARSE_STREAM_FACTOR = 8
const COARSE_BUCKET_BITS = 8

// Stream state of the bit decoder (RAnsBitDecoder). RAnsDecoder carries the
// same four fields inline, so ansReadInit serves both.
export class AnsDecoder {
  buf: Uint8Array | null = null
  bufOffset = 0
  // First valid byte of this decoder's slice within buf: init is passed
  // absolute offsets into the source buffer to avoid a subarray allocation.
  bufStart = 0
  state = 0
}

// Parses the stream trailer: the top two bits of the last encoded byte give
// the width of the little-endian initial state (1-4 bytes, tag bits masked
// off; the 8-bit-precision bit decoder allows at most 3, as in the source).
// offset is the absolute end of the encoded bytes within buf and base
// the absolute start (offset - base = encoded length); absolute offsets avoid
// a subarray allocation per init. Returns false on malformed input.
export function ansReadInit(
  ans: AnsDecoder,
  buf: Uint8Array,
  offset: number,
  base: number,
  lRansBase: number,
  maxBytes: number,
): boolean {
  const length = offset - base
  if (length < 1) {
    return false
  }
  const numBytes = (buf[offset - 1] >> 6) + 1
  if (numBytes > maxBytes || length < numBytes) {
    return false
  }
  // Straight-line per width (as in the source): this runs once per rANS
  // stream, thousands of times on a primitive-heavy file.
  let state: number
  if (numBytes === 1) {
    state = buf[offset - 1] & 0x3f
  } else if (numBytes === 2) {
    state = (buf[offset - 2] | (buf[offset - 1] << 8)) & 0x3fff
  } else if (numBytes === 3) {
    state = (buf[offset - 3] | (buf[offset - 2] << 8) | (buf[offset - 1] << 16)) & 0x3fffff
  } else {
    state = (buf[offset - 4] | (buf[offset - 3] << 8) | (buf[offset - 2] << 16) | (buf[offset - 1] << 24)) & 0x3fffffff
  }
  state += lRansBase
  if (state >= lRansBase * ANS_IO_BASE) {
    return false
  }
  ans.buf = buf
  ans.bufStart = base
  ans.bufOffset = offset - numBytes
  ans.state = state
  return true
}

// Freelists for the rANS decoding tables. Symbol decoders run strictly
// sequentially (create → decode → readEnd), and decoding a large GLB creates
// thousands of them (one per attribute / traversal context per primitive), so
// reusing the buffers avoids most of the alloc+zero cost. Buffers are handed
// out in ransBuildLookUpTable and returned on readEnd(); an early error path
// simply never returns its buffers (they are GC'd with the decoder) — safe,
// just unpooled.
const tablePool: (Uint16Array | Uint32Array)[] = []

const acquirePooled = <T extends Uint16Array | Uint32Array>(Ctor: new (length: number) => T, size: number): T => {
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
  lutTable: Uint16Array | null = null
  probTable: Uint32Array | null = null // flat
  cumProbTable: Uint32Array | null = null // flat
  // Coarse mode (see ransBuildLookUpTable): no full-precision lut; a
  // 256-entry bucket table narrows each lookup to a symbol range that a short
  // cumProb scan finishes. cumProbTable then carries one extra trailing entry
  // (== ransPrecision) so the scan needs no bounds check.
  coarse = false
  bucketShift = 0
  // Uint16 unless the alphabet needs wider ids, so real streams keep one table type.
  bucketTable: Uint16Array | Uint32Array | null = null
  // Stream state inlined (not a nested AnsDecoder) so the ransRead() hot loop
  // touches own props; initialized by ansReadInit.
  buf: Uint8Array | null = null
  bufOffset = 0
  // First valid byte of this decoder's slice within buf (absolute offsets,
  // see AnsDecoder.bufStart).
  bufStart = 0
  state = 0

  constructor(ransPrecisionBits: number) {
    this.ransPrecisionBits = ransPrecisionBits
    this.ransPrecision = 1 << ransPrecisionBits
    this.ransPrecisionMask = this.ransPrecision - 1
    this.lRansBase = this.ransPrecision * 4
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
    if (this.bucketTable !== null) {
      tablePool.push(this.bucketTable)
      this.bucketTable = null
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
    let symbol: number
    if (this.coarse) {
      const cumProbTable = this.cumProbTable!
      symbol = this.bucketTable![rem >> this.bucketShift]
      while (cumProbTable[symbol + 1] <= rem) symbol++
    } else {
      symbol = this.lutTable![rem]
    }
    this.state = quo * this.probTable![symbol] + rem - this.cumProbTable![symbol]
    this.bufOffset = bufOffset
    return symbol
  }

  // Batch ransRead() into out[0..count): all fields hoisted to locals, state
  // written back once. Removes per-symbol property reads and call indirection.
  decodeSymbols(out: Uint32Array, count: number): void {
    if (this.coarse) {
      this._decodeSymbolsCoarse(out, count)
      return
    }
    this._decodeSymbolsU16(out, count, this.lutTable!)
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

  // Short-stream loop: bucket table + cumProb scan instead of the full lut.
  // Same state arithmetic as the lut loops, so the output is identical.
  _decodeSymbolsCoarse(out: Uint32Array, count: number): void {
    const buf = this.buf!
    const lRansBase = this.lRansBase
    const ransPrecisionBits = this.ransPrecisionBits
    const ransPrecisionMask = this.ransPrecisionMask
    const probTable = this.probTable!
    const cumProbTable = this.cumProbTable!
    const bucketTable = this.bucketTable!
    const bucketShift = this.bucketShift
    let state = this.state
    let bufOffset = this.bufOffset
    const bufStart = this.bufStart
    for (let i = 0; i < count; ++i) {
      while (state < lRansBase && bufOffset > bufStart) {
        state = (state << 8) | buf[--bufOffset]
      }
      const rem = state & ransPrecisionMask
      let symbol = bucketTable[rem >> bucketShift]
      while (cumProbTable[symbol + 1] <= rem) symbol++
      out[i] = symbol
      state = (state >>> ransPrecisionBits) * probTable[symbol] + rem - cumProbTable[symbol]
    }
    this.state = state
    this.bufOffset = bufOffset
  }

  // Builds the decoding tables. Returns false on bad input data.
  //
  // expectedCount is how many symbols the caller will decode from this stream.
  // The full lut has ransPrecision (>= 4096) entries, and a primitive-heavy
  // file builds thousands of them to decode a few dozen symbols each -- on such
  // files the table builds cost more than the decodes. Short streams therefore
  // get a coarse 256-entry bucket table (symbol at the start of each
  // precision/256-wide bucket) and finish each lookup with a scan of the
  // cumulative probabilities; long streams keep the exact lut, whose per-symbol
  // cost is lower. The coarse tables also serve an alphabet wider than a
  // Uint16 lut entry (raw symbol coding allows 2^18 symbols; no real file
  // has been seen past 2^14), rather than keeping a Uint32 copy of every
  // lut loop for it.
  ransBuildLookUpTable(tokenProbs: Uint32Array, numSymbols: number, expectedCount: number = 0x7fffffff): boolean {
    const ransPrecision = this.ransPrecision
    const coarse = numSymbols > 65536 || expectedCount * COARSE_STREAM_FACTOR < ransPrecision
    this.coarse = coarse
    // Pooled buffers may be oversized; every slot in the used range is written
    // below (cumProb must land exactly on ransPrecision), so no clearing needed.
    const probTable = acquirePooled(Uint32Array, numSymbols)
    // One trailing entry (== ransPrecision) so the coarse scan needs no bound.
    const cumProbTable = acquirePooled(Uint32Array, numSymbols + 1)
    this.probTable = probTable
    this.cumProbTable = cumProbTable
    let cumProb = 0
    if (coarse) {
      this.lutTable = null
      for (let i = 0; i < numSymbols; ++i) {
        const prob = tokenProbs[i]
        probTable[i] = prob
        cumProbTable[i] = cumProb
        cumProb += prob
        if (cumProb > ransPrecision) {
          return false
        }
      }
      if (cumProb !== ransPrecision) {
        return false
      }
      cumProbTable[numSymbols] = ransPrecision
      // About two buckets per symbol, at most 2^COARSE_BUCKET_BITS: a dozen
      // symbols over a fifteen-symbol alphabet is not worth 256 bucket writes.
      let bucketBits = 33 - Math.clz32(numSymbols)
      if (bucketBits > COARSE_BUCKET_BITS) bucketBits = COARSE_BUCKET_BITS
      const numBuckets = 1 << bucketBits
      const bucketShift = this.ransPrecisionBits - bucketBits
      const bucketTable =
        numSymbols > 65536 ? acquirePooled(Uint32Array, numBuckets) : acquirePooled(Uint16Array, numBuckets)
      this.bucketShift = bucketShift
      this.bucketTable = bucketTable
      let symbol = 0
      for (let b = 0; b < numBuckets; ++b) {
        const rem = b << bucketShift
        while (cumProbTable[symbol + 1] <= rem) symbol++
        bucketTable[b] = symbol
      }
      return true
    }

    // lutTable is indexed by `rem` (random in [0, ransPrecision)), so it's the
    // hottest random read in decodeSymbols()/ransRead(). Its values are symbol
    // ids (< numSymbols <= 65536). A Uint8 table for the smallest alphabets
    // measured no faster -- those have the smallest precision, so either table
    // sits in L1 -- and would double the lockstep loop variants below.
    const lutTable = acquirePooled(Uint16Array, ransPrecision)
    this.lutTable = lutTable
    let actProb = 0
    for (let i = 0; i < numSymbols; ++i) {
      const prob = tokenProbs[i]
      probTable[i] = prob
      cumProbTable[i] = cumProb
      cumProb += prob
      if (cumProb > ransPrecision) {
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
    if (cumProb !== ransPrecision) {
      return false
    }
    cumProbTable[numSymbols] = ransPrecision
    return true
  }
}

// A primed, not-yet-decoded raw rANS symbol stream.
export interface RansStream {
  ans: RAnsDecoder
  out: Uint32Array
  count: number
}

// Decodes several independent streams, overlapping their serial per-symbol
// dependency chains in the CPU pipeline: the longest three in lockstep for
// as long as the third lasts, then the longest two, then the last one alone
// -- re-ranking after each step, so a long stream's tail is interleaved with
// the next longest instead of finishing on its own. Short streams on the
// coarse tables (see ransBuildLookUpTable) decode alone: they are cheap
// either way and the lockstep loops want lut streams. Output is identical to
// decoding each stream on its own.
export function ransDecodeStreams(streams: RansStream[]): void {
  const live: RansStream[] = []
  for (const stream of streams) {
    if (stream.count === 0) continue
    if (stream.ans.coarse) stream.ans.decodeSymbols(stream.out, stream.count)
    else live.push({ ans: stream.ans, out: stream.out, count: stream.count })
  }
  const byLength = (x: RansStream, y: RansStream): number => y.count - x.count
  live.sort(byLength)
  while (live.length >= 3) {
    const a = live[0]
    const b = live[1]
    const c = live[2]
    const shared = c.count
    ransDecodeSymbolsTrioU16(a.ans, a.out, shared, b.ans, b.out, shared, c.ans, c.out, shared)
    live.splice(2, 1)
    a.out = a.out.subarray(shared)
    a.count -= shared
    b.out = b.out.subarray(shared)
    b.count -= shared
    if (a.count === 0) live.shift()
    if (b.count === 0) live.splice(live.indexOf(b), 1)
    live.sort(byLength)
  }
  if (live.length === 2) {
    const a = live[0]
    const b = live[1]
    ransDecodeSymbolsPairU16(a.ans, a.out, a.count, b.ans, b.out, b.count)
  } else if (live.length === 1) {
    live[0].ans.decodeSymbols(live[0].out, live[0].count)
  }
}

// Decodes two independent rANS streams in lockstep, countA symbols into outA
// and countB into outB. The two dependency chains overlap in the CPU pipeline,
// hiding most of the per-symbol load-multiply latency that serializes a single
// stream (measured 1.2x on V8 and 1.4x+ on JSC for the same total symbols).
// Both decoders must have Uint16Array luts. Outputs are identical to decoding
// each stream alone. Uneven tails finish through the single-stream path.
export function ransDecodeSymbolsPairU16(
  a: RAnsDecoder,
  outA: Uint32Array,
  countA: number,
  b: RAnsDecoder,
  outB: Uint32Array,
  countB: number,
): void {
  const lutA = a.lutTable as Uint16Array
  const lutB = b.lutTable as Uint16Array
  const bufA = a.buf!
  const bufB = b.buf!
  const probA = a.probTable!
  const probB = b.probTable!
  const cumA = a.cumProbTable!
  const cumB = b.cumProbTable!
  const lBaseA = a.lRansBase
  const lBaseB = b.lRansBase
  const bitsA = a.ransPrecisionBits
  const bitsB = b.ransPrecisionBits
  const maskA = a.ransPrecisionMask
  const maskB = b.ransPrecisionMask
  const startA = a.bufStart
  const startB = b.bufStart
  let stateA = a.state
  let stateB = b.state
  let offA = a.bufOffset
  let offB = b.bufOffset

  const shared = countA < countB ? countA : countB
  for (let i = 0; i < shared; ++i) {
    while (stateA < lBaseA && offA > startA) {
      stateA = (stateA << 8) | bufA[--offA]
    }
    while (stateB < lBaseB && offB > startB) {
      stateB = (stateB << 8) | bufB[--offB]
    }
    const remA = stateA & maskA
    const remB = stateB & maskB
    const symA = lutA[remA]
    const symB = lutB[remB]
    outA[i] = symA
    outB[i] = symB
    stateA = (stateA >>> bitsA) * probA[symA] + remA - cumA[symA]
    stateB = (stateB >>> bitsB) * probB[symB] + remB - cumB[symB]
  }

  a.state = stateA
  a.bufOffset = offA
  b.state = stateB
  b.bufOffset = offB
  if (shared < countA) {
    a.decodeSymbols(outA.subarray(shared), countA - shared)
  }
  if (shared < countB) {
    b.decodeSymbols(outB.subarray(shared), countB - shared)
  }
}

// Three-stream lockstep variant (Uint16 luts, as the pair loop; used for the
// valence context streams). A third independent chain extracts another ~15%
// per symbol over the pair loop on wide cores.
export function ransDecodeSymbolsTrioU16(
  a: RAnsDecoder,
  outA: Uint32Array,
  countA: number,
  b: RAnsDecoder,
  outB: Uint32Array,
  countB: number,
  c: RAnsDecoder,
  outC: Uint32Array,
  countC: number,
): void {
  const lutA = a.lutTable as Uint16Array
  const lutB = b.lutTable as Uint16Array
  const lutC = c.lutTable as Uint16Array
  const bufA = a.buf!
  const bufB = b.buf!
  const bufC = c.buf!
  const probA = a.probTable!
  const probB = b.probTable!
  const probC = c.probTable!
  const cumA = a.cumProbTable!
  const cumB = b.cumProbTable!
  const cumC = c.cumProbTable!
  const lBaseA = a.lRansBase
  const lBaseB = b.lRansBase
  const lBaseC = c.lRansBase
  const bitsA = a.ransPrecisionBits
  const bitsB = b.ransPrecisionBits
  const bitsC = c.ransPrecisionBits
  const maskA = a.ransPrecisionMask
  const maskB = b.ransPrecisionMask
  const maskC = c.ransPrecisionMask
  const startA = a.bufStart
  const startB = b.bufStart
  const startC = c.bufStart
  let stateA = a.state
  let stateB = b.state
  let stateC = c.state
  let offA = a.bufOffset
  let offB = b.bufOffset
  let offC = c.bufOffset

  let shared = countA < countB ? countA : countB
  if (countC < shared) shared = countC
  for (let i = 0; i < shared; ++i) {
    while (stateA < lBaseA && offA > startA) {
      stateA = (stateA << 8) | bufA[--offA]
    }
    while (stateB < lBaseB && offB > startB) {
      stateB = (stateB << 8) | bufB[--offB]
    }
    while (stateC < lBaseC && offC > startC) {
      stateC = (stateC << 8) | bufC[--offC]
    }
    const remA = stateA & maskA
    const remB = stateB & maskB
    const remC = stateC & maskC
    const symA = lutA[remA]
    const symB = lutB[remB]
    const symC = lutC[remC]
    outA[i] = symA
    outB[i] = symB
    outC[i] = symC
    stateA = (stateA >>> bitsA) * probA[symA] + remA - cumA[symA]
    stateB = (stateB >>> bitsB) * probB[symB] + remB - cumB[symB]
    stateC = (stateC >>> bitsC) * probC[symC] + remC - cumC[symC]
  }

  a.state = stateA
  a.bufOffset = offA
  b.state = stateB
  b.bufOffset = offB
  c.state = stateC
  c.bufOffset = offC
  // Uneven tails: finish the two longer streams as a pair, or singly.
  const restA = countA - shared
  const restB = countB - shared
  const restC = countC - shared
  const tails: [RAnsDecoder, Uint32Array, number][] = []
  if (restA > 0) tails.push([a, outA.subarray(shared), restA])
  if (restB > 0) tails.push([b, outB.subarray(shared), restB])
  if (restC > 0) tails.push([c, outC.subarray(shared), restC])
  if (tails.length === 2) {
    ransDecodeSymbolsPairU16(tails[0][0], tails[0][1], tails[0][2], tails[1][0], tails[1][1], tails[1][2])
  } else {
    for (const [decoder, out, count] of tails) {
      decoder.decodeSymbols(out, count)
    }
  }
}
