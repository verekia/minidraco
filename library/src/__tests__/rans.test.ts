// Round-trips symbol streams through RAnsDecoder against a reference rANS
// encoder (draco/core/ans.h, RAnsEncoder), for each table mode: the exact
// lookup table, the coarse tables a short stream picks, and the coarse tables
// an alphabet wider than 65536 symbols is routed to (raw symbol coding allows
// 2^18 symbols; the official encoder never picks it for such an alphabet, so
// no corpus file exercises this path).
import { describe, expect, test } from 'bun:test'

import { ansReadInit, RAnsDecoder, ransDecodeSymbolsPair } from '../decoder/compression/entropy/ANSCoding'

const encode = (symbols: number[], probs: Uint32Array, precisionBits: number): Uint8Array => {
  const precision = 1 << precisionBits
  const lRansBase = precision * 4
  const cum = new Uint32Array(probs.length)
  for (let i = 1; i < probs.length; ++i) cum[i] = cum[i - 1] + probs[i - 1]
  const buf = new Uint8Array(symbols.length * 4 + 4)
  let offset = 0
  let state = lRansBase
  // The decoder reads the stream backwards, so the encoder takes the symbols
  // in reverse.
  for (let i = symbols.length - 1; i >= 0; --i) {
    const p = probs[symbols[i]]
    while (state >= (lRansBase / precision) * 256 * p) {
      buf[offset++] = state % 256
      state = Math.floor(state / 256)
    }
    state = Math.floor(state / p) * precision + (state % p) + cum[symbols[i]]
  }
  state -= lRansBase
  if (state < 1 << 6) {
    buf[offset++] = state
  } else if (state < 1 << 14) {
    const v = (1 << 14) + state
    buf[offset++] = v & 0xff
    buf[offset++] = v >> 8
  } else if (state < 1 << 22) {
    const v = (2 << 22) + state
    buf[offset++] = v & 0xff
    buf[offset++] = (v >> 8) & 0xff
    buf[offset++] = v >> 16
  } else {
    const v = (3 << 30) + state
    buf[offset++] = v & 0xff
    buf[offset++] = (v >> 8) & 0xff
    buf[offset++] = (v >> 16) & 0xff
    buf[offset++] = v >>> 24
  }
  return buf.subarray(0, offset)
}

// Probabilities summing to exactly 2^precisionBits, every symbol reachable.
const makeProbs = (numSymbols: number, precisionBits: number): Uint32Array => {
  const precision = 1 << precisionBits
  const probs = new Uint32Array(numSymbols)
  const base = Math.floor(precision / numSymbols)
  probs.fill(base)
  probs[0] += precision - base * numSymbols
  return probs
}

let seed = 4242
const random = (n: number): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed % n
}

const roundTrip = (numSymbols: number, precisionBits: number, count: number, expectedCount?: number) => {
  const probs = makeProbs(numSymbols, precisionBits)
  const symbols = Array.from({ length: count }, () => random(numSymbols))
  const encoded = encode(symbols, probs, precisionBits)

  const decoder = new RAnsDecoder(precisionBits)
  expect(decoder.ransBuildLookUpTable(probs, numSymbols, expectedCount)).toBe(true)
  expect(ansReadInit(decoder, encoded, encoded.length, 0, decoder.lRansBase, 4)).toBe(true)
  const out = new Uint32Array(count)
  decoder.decodeSymbols(out, count)
  decoder.readEnd()
  expect(Array.from(out)).toEqual(symbols)
  return decoder
}

describe('rANS symbol decoding', () => {
  test('exact lookup table', () => {
    const decoder = roundTrip(300, 12, 5000)
    expect(decoder.coarse).toBe(false)
  })

  test('coarse tables for a short stream', () => {
    const decoder = roundTrip(300, 12, 20, 20)
    expect(decoder.coarse).toBe(true)
  })

  test('coarse tables for an alphabet wider than a Uint16 lut entry', () => {
    const decoder = roundTrip(70000, 20, 3000)
    expect(decoder.coarse).toBe(true)
  })

  test('lockstep pair decode falls back per stream when one is coarse', () => {
    const probsA = makeProbs(500, 13)
    const probsB = makeProbs(70000, 20)
    const symbolsA = Array.from({ length: 1000 }, () => random(500))
    const symbolsB = Array.from({ length: 1000 }, () => random(70000))
    const a = new RAnsDecoder(13)
    const b = new RAnsDecoder(20)
    const encodedA = encode(symbolsA, probsA, 13)
    const encodedB = encode(symbolsB, probsB, 20)
    expect(a.ransBuildLookUpTable(probsA, 500)).toBe(true)
    expect(b.ransBuildLookUpTable(probsB, 70000)).toBe(true)
    expect(ansReadInit(a, encodedA, encodedA.length, 0, a.lRansBase, 4)).toBe(true)
    expect(ansReadInit(b, encodedB, encodedB.length, 0, b.lRansBase, 4)).toBe(true)
    const outA = new Uint32Array(1000)
    const outB = new Uint32Array(1000)
    ransDecodeSymbolsPair(a, outA, 1000, b, outB, 1000)
    a.readEnd()
    b.readEnd()
    expect(Array.from(outA)).toEqual(symbolsA)
    expect(Array.from(outB)).toEqual(symbolsB)
  })
})
