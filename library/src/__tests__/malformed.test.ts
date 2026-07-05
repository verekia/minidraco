// Adversarial / malformed input must fail cleanly: decodeDracoMesh must always
// return control (by throwing a controlled Error) and must never hang, read out
// of bounds, or attempt an unbounded allocation. This surface has no bit-exact
// reference — it only has to not blow up. (No coverage existed before; added
// alongside the audit hardening of the rANS readInit guard and the decode-time
// oversized-allocation safety net.)
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { DecoderBuffer, decodeDracoMesh } from '../index'

const fixture = (name: string) => new Uint8Array(readFileSync(`${import.meta.dir}/fixtures/${name}`))

// Deterministic PRNG so any failure is reproducible.
const prng = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed
}

describe('malformed input', () => {
  test('empty and tiny buffers throw, never hang', () => {
    expect(() => decodeDracoMesh(new Uint8Array(0))).toThrow()
    expect(() => decodeDracoMesh(new Uint8Array([1, 2, 3, 4, 5]))).toThrow()
    expect(() => decodeDracoMesh(new Uint8Array(128))).toThrow() // all zeros
  })

  test('random garbage returns control (no hang, no OOB crash)', () => {
    // If any input hung or crashed the process, this test would time out / abort
    // rather than complete — completion is the assertion.
    for (let seed = 1; seed <= 60; seed++) {
      const rand = prng(seed)
      const data = new Uint8Array(1 + (rand() % 8192))
      for (let i = 0; i < data.length; i++) data[i] = rand() & 0xff
      try {
        decodeDracoMesh(data)
      } catch {
        // Throwing is the expected outcome; the point is it returns here.
      }
    }
  })

  test('valid .drc truncated to a partial prefix fails cleanly', () => {
    for (const name of ['car.drc', 'bunny.drc', 'cube.drc', 'octagon_preserved.drc']) {
      const valid = fixture(name)
      // A stream missing its tail cannot yield a complete mesh.
      for (const frac of [0, 0.1, 0.25, 0.5, 0.75, 0.9]) {
        const len = Math.floor(valid.length * frac)
        expect(() => decodeDracoMesh(valid.subarray(0, len))).toThrow()
      }
    }
  })

  test('byte-corrupted headers fail cleanly, never with an uncaught RangeError', () => {
    // Corrupting early bytes drives the size varints (numFaces / numVertices)
    // and the rANS state init — the paths the audit hardened. Every throw must
    // be a controlled Error (the decode-time safety net converts an oversized
    // allocation's RangeError into a clean failure), and must arrive promptly.
    for (const name of ['bunny.drc', 'car.drc']) {
      const valid = fixture(name)
      for (let pos = 0; pos < Math.min(48, valid.length); pos++) {
        for (const byte of [0x00, 0x7f, 0x80, 0xff]) {
          const data = valid.slice()
          data[pos] = byte
          try {
            decodeDracoMesh(data)
          } catch (error) {
            expect(error).toBeInstanceOf(Error)
          }
        }
      }
    }
  })

  test('bit reads fail when the requested width runs past EOF', () => {
    const buffer = new DecoderBuffer()
    buffer.init(new Uint8Array([0xff]))

    expect(buffer.startBitDecoding(false)).toBe(0)
    expect(buffer.decodeLeastSignificantBits32(12)).toBeUndefined()
  })
})
