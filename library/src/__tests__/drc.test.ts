// Raw .drc fidelity: fixtures from Google Draco's test data (via mrdoob/draco.js
// samples) covering sequential + edgebreaker (standard and valence) encodings,
// several compression levels, and octahedron-normal attributes. Each decode is
// compared attribute-by-attribute against the official draco3d wasm decoder.
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

import { dracoDataTypeToArray, getDraco3dModule } from '../../scripts/harness'
import { decodeDracoMesh } from '../index'

const fixturesDir = `${import.meta.dir}/fixtures`
const fixtures = readdirSync(fixturesDir).filter(name => name.endsWith('.drc'))

const decodeReference = async (data: Uint8Array) => {
  const m = await getDraco3dModule()

  const buffer = new m.DecoderBuffer()
  buffer.Init(data, data.length)
  const decoder = new m.Decoder()
  const mesh = new m.Mesh()
  const status = decoder.DecodeBufferToMesh(buffer, mesh)
  if (!status.ok()) {
    m.destroy(mesh)
    m.destroy(decoder)
    m.destroy(buffer)
    throw new Error(status.error_msg())
  }

  const numPoints = mesh.num_points()
  const numFaces = mesh.num_faces()

  const indices = new Uint32Array(numFaces * 3)
  const indexPtr = m._malloc(indices.byteLength)
  decoder.GetTrianglesUInt32Array(mesh, indices.byteLength, indexPtr)
  indices.set(new Uint32Array(m.HEAPU32.buffer, indexPtr, numFaces * 3))
  m._free(indexPtr)

  const attributes: { uniqueId: number; numComponents: number; data: ArrayLike<number> }[] = []
  for (let i = 0; i < mesh.num_attributes(); i++) {
    const attribute = decoder.GetAttribute(mesh, i)
    const dataType = attribute.data_type()
    const numComponents = attribute.num_components()
    const numValues = numPoints * numComponents
    const Ctor = dracoDataTypeToArray(dataType)
    const array = new Ctor(numValues)
    const ptr = m._malloc(array.byteLength)
    decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataType, array.byteLength, ptr)
    array.set(new Ctor(m.HEAPU8.buffer, ptr, numValues) as never)
    m._free(ptr)
    attributes.push({ uniqueId: attribute.unique_id(), numComponents, data: array })
  }

  m.destroy(mesh)
  m.destroy(decoder)
  m.destroy(buffer)

  return { numPoints, numFaces, indices, attributes }
}

describe('raw .drc fixtures', () => {
  for (const fixture of fixtures) {
    test(
      fixture,
      async () => {
        const data = new Uint8Array(readFileSync(`${fixturesDir}/${fixture}`))

        let expected: Awaited<ReturnType<typeof decodeReference>>
        try {
          expected = await decodeReference(data)
        } catch {
          // Not decodable as a mesh by the reference decoder (e.g. a point
          // cloud) — minidraco should reject it too, not crash.
          expect(() => decodeDracoMesh(data)).toThrow()
          return
        }
        const mesh = decodeDracoMesh(data)

        expect(mesh.numPoints()).toBe(expected.numPoints)
        expect(mesh.numFaces()).toBe(expected.numFaces)

        const indices = new Uint32Array(expected.numFaces * 3)
        indices.set(mesh.faces_.subarray(0, expected.numFaces * 3))
        expect(indices).toEqual(expected.indices)

        for (const expectedAttribute of expected.attributes) {
          const attribute = mesh.getAttributeByUniqueId(expectedAttribute.uniqueId)
          if (!attribute) throw new Error(`missing attribute ${expectedAttribute.uniqueId}`)

          expect(attribute.numComponents).toBe(expectedAttribute.numComponents)

          const Ctor = expectedAttribute.data.constructor as new (n: number) => never
          const actual = attribute.extractTo(Ctor as never, expected.numPoints) as ArrayLike<number>
          expect(actual.length).toBe(expectedAttribute.data.length)

          for (let i = 0; i < actual.length; i++) {
            const a = actual[i]
            const e = expectedAttribute.data[i]
            // Bit-exact, floats included: every float path mirrors the wasm
            // decoder's float32 arithmetic via Math.fround (=== also treats
            // +0/-0 as equal, matching the fidelity suite's ulp convention).
            if (a === e) continue
            throw new Error(`${fixture}: attribute ${expectedAttribute.uniqueId} differs at ${i}: ${a} !== ${e}`)
          }
        }
      },
      30000,
    )
  }
})
