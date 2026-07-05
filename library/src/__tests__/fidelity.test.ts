// Fidelity suite: minidraco must reproduce the official draco3d wasm decoder's
// output on the production bundle GLBs and the draco.js sample models —
// identical connectivity, identical integer attributes, and float attributes
// within 1 ulp (the wasm decoder dequantizes in 32-bit floats; JS computes in
// doubles before rounding to float32, which can differ in the last bit).
import { describe, expect, test } from 'bun:test'

import {
  BUNDLE_GLBS,
  SAMPLE_GLBS,
  decodeWithDraco3d,
  decodeWithMinidraco,
  extractDracoPrimitives,
} from '../../scripts/harness'

import type { DecodedPrimitive } from '../../scripts/harness'

const FLOAT_ULP_TOLERANCE = 1

const ulpDiff = (a: number, b: number): number => {
  if (a === b) return 0
  if (Number.isNaN(a) || Number.isNaN(b)) return Infinity
  const bufA = new Int32Array(new Float32Array([a]).buffer)[0]
  const bufB = new Int32Array(new Float32Array([b]).buffer)[0]
  return Math.abs(bufA - bufB)
}

const compare = (actual: DecodedPrimitive, expected: DecodedPrimitive, label: string) => {
  expect(actual.numPoints).toBe(expected.numPoints)
  expect(actual.indices.length).toBe(expected.indices.length)
  expect(actual.indices).toEqual(expected.indices)

  for (const [uniqueId, expectedAttribute] of expected.attributes) {
    const actualAttribute = actual.attributes.get(uniqueId)
    if (!actualAttribute) throw new Error(`${label}: missing attribute ${uniqueId}`)

    expect(actualAttribute.numComponents).toBe(expectedAttribute.numComponents)
    expect(actualAttribute.data.length).toBe(expectedAttribute.data.length)
    expect(actualAttribute.data.constructor).toBe(expectedAttribute.data.constructor)

    const isFloat = expectedAttribute.data instanceof Float32Array
    let maxUlp = 0
    let firstMismatch = -1

    for (let i = 0; i < expectedAttribute.data.length; i++) {
      const a = actualAttribute.data[i]
      const e = expectedAttribute.data[i]
      if (a === e) continue
      if (isFloat) {
        const ulp = ulpDiff(a, e)
        if (ulp > maxUlp) maxUlp = ulp
        if (ulp > FLOAT_ULP_TOLERANCE && firstMismatch === -1) firstMismatch = i
      } else if (firstMismatch === -1) {
        firstMismatch = i
      }
    }

    if (firstMismatch !== -1) {
      throw new Error(
        `${label}: attribute ${uniqueId} differs at index ${firstMismatch}: ` +
          `${actualAttribute.data[firstMismatch]} !== ${expectedAttribute.data[firstMismatch]} (max ulp ${maxUlp})`,
      )
    }
  }
}

for (const glbPath of [...BUNDLE_GLBS, ...SAMPLE_GLBS]) {
  const fileName = glbPath.split('/').pop()!
  const primitives = extractDracoPrimitives(glbPath)

  describe(fileName, () => {
    test('contains Draco-compressed primitives', () => {
      expect(primitives.length).toBeGreaterThan(0)
    })

    // manablade-static has 488 primitives — testing each one individually would
    // spam the reporter, so batch per file but report precise labels on failure.
    test(`all ${primitives.length} primitives match draco3d output`, async () => {
      for (const primitive of primitives) {
        const label = `${fileName}#${primitive.meshIndex}/${primitive.primitiveIndex} (${primitive.meshName})`
        const expected = await decodeWithDraco3d(primitive)
        const actual = decodeWithMinidraco(primitive)
        compare(actual, expected, label)
      }
    }, 120000)
  })
}
