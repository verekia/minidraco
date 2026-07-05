import { Decoder as DracoJsDecoder } from 'draco.js/src/compression/Decode.js'
import { DecoderBuffer as DracoJsDecoderBuffer } from 'draco.js/src/core/DecoderBuffer.js'
import { MinidracoLoader } from 'minidraco/three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import type { BufferGeometry } from 'three'

export type DecoderKind = 'minidraco' | 'draco3d' | 'draco.js'

export const DECODER_KINDS: DecoderKind[] = ['minidraco', 'draco3d', 'draco.js']

// draco.js (mrdoob) decoded meshes expose the same shape minidraco's
// _buildGeometry consumes (numPoints/numFaces/faces_/getAttributeByUniqueId/
// extractTo), so reuse the whole three.js glue layer and swap the decoder.
// Importing only draco.js's pure decoder modules (never its DRACOLoader)
// avoids pulling a second copy of three into the bundle.
class DracoJsLoader extends MinidracoLoader {
  constructor() {
    super()
    // The worker pool decodes with minidraco; this loader must stay on the
    // synchronous _decodeBuffer path so it actually measures draco.js.
    this.setWorkerLimit(0)
  }

  override _decodeBuffer(
    buffer: ArrayBuffer,
    taskConfig: Parameters<MinidracoLoader['_decodeBuffer']>[1],
  ): BufferGeometry {
    const byteArray = new Uint8Array(buffer)
    const decoderBuffer = new DracoJsDecoderBuffer()
    decoderBuffer.init(byteArray, byteArray.length)

    const decoder = new DracoJsDecoder()
    const result = decoder.decodeMeshFromBuffer(decoderBuffer)
    if (!result.ok) throw new Error(`draco.js: ${result.message}`)

    return this._buildGeometry(result.mesh, taskConfig)
  }
}

export const createDracoLoader = (kind: DecoderKind) => {
  if (kind === 'minidraco') return new MinidracoLoader()
  if (kind === 'draco.js') return new DracoJsLoader()

  const loader = new DRACOLoader()
  loader.setDecoderPath('/draco/')
  return loader
}

// Long-lived loader per decoder, the way a real app would hold one: worker
// pools (minidraco) and wasm modules (draco3d) stay warm across model loads.
const loaderCache = new Map<DecoderKind, ReturnType<typeof createDracoLoader>>()

export const getDracoLoader = (kind: DecoderKind) => {
  let loader = loaderCache.get(kind)
  if (!loader) {
    loader = createDracoLoader(kind)
    loader.preload()
    loaderCache.set(kind, loader)
  }
  return loader
}
