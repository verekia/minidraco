// Single-threaded core of the DRACOLoader drop-in: everything except the
// worker pool. It decodes on the main thread and has NO reference to the
// worker (no `new Worker(new URL('./worker.js', ...))`), so importing it via
// `minidraco/three/single` never makes a bundler emit the worker chunk. The
// worker-pool loader in ./index.ts extends this and adds the pool.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ColorManagement,
  FileLoader,
  LinearSRGBColorSpace,
  Loader,
  SRGBColorSpace,
} from 'three'

// Import shared decoder symbols via the public entry (not deep decoder
// paths): it keeps the dts build free of hashed shared-type chunks.
import { decodeDracoMesh, GeometryAttributeType } from '../index'

import type { LoadingManager } from 'three'

import type { Mesh, PointAttribute } from '../index'

export type AttributeIDs = Record<string, number | string>
export type AttributeTypes = Record<string, string>

export interface MiniDRACOLoaderOptions {
  // three.js LoadingManager, as with any loader.
  manager?: LoadingManager
  // false → decode on the main thread (no worker pool). Default true. Ignored
  // by the `minidraco/three/single` entry, which is always single-threaded.
  workers?: boolean
  // Worker pool size when workers are enabled (default 4).
  workerLimit?: number
  // See the syncByteThreshold field on the worker-pool loader.
  syncByteThreshold?: number
}

export interface TaskConfig {
  attributeIDs: AttributeIDs
  attributeTypes: AttributeTypes
  useUniqueIDs: boolean
  vertexColorSpace: string
}

type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor

// Shared across every loader instance (and both entry points), keyed by the
// input ArrayBuffer — mirrors THREE.DRACOLoader's per-buffer decode cache.
const _taskCache = new WeakMap<ArrayBuffer, { key: string; promise: Promise<BufferGeometry> }>()

const _attributeTypeMap: Record<string, number> = {
  POSITION: GeometryAttributeType.POSITION,
  NORMAL: GeometryAttributeType.NORMAL,
  COLOR: GeometryAttributeType.COLOR,
  TEX_COORD: GeometryAttributeType.TEX_COORD,
  GENERIC: GeometryAttributeType.GENERIC,
}

const _typedArrayMap: Record<string, TypedArrayConstructor> = {
  Float32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
}

// LoadingManager instances expose itemStart(); an options bag does not. Lets
// the constructor keep the three-compatible `new Loader(manager)` form while
// also accepting `new MiniDRACOLoader({ workers: false })`.
const isLoadingManager = (value: unknown): value is LoadingManager =>
  typeof (value as { itemStart?: unknown } | null | undefined)?.itemStart === 'function'

class MiniDRACOLoader extends Loader<BufferGeometry> {
  defaultAttributeIDs: AttributeIDs
  defaultAttributeTypes: AttributeTypes
  workerLimit: number
  // Opt-in (0 = disabled): with the worker pool, buffers at or below this size
  // decode on the main thread instead of paying the ~0.5 ms message roundtrip.
  // Ignored by the single-threaded loader (already main-thread).
  syncByteThreshold: number

  // Accepts either a LoadingManager (three-compatible form) or an options bag.
  constructor(managerOrOptions?: LoadingManager | MiniDRACOLoaderOptions) {
    const options: MiniDRACOLoaderOptions = isLoadingManager(managerOrOptions)
      ? { manager: managerOrOptions }
      : (managerOrOptions ?? {})
    super(options.manager)

    this.defaultAttributeIDs = {
      position: 'POSITION',
      normal: 'NORMAL',
      color: 'COLOR',
      uv: 'TEX_COORD',
    }

    this.defaultAttributeTypes = {
      position: 'Float32Array',
      normal: 'Float32Array',
      color: 'Float32Array',
      uv: 'Float32Array',
    }

    this.workerLimit = options.workers === false ? 0 : (options.workerLimit ?? 4)
    this.syncByteThreshold = options.syncByteThreshold ?? 0
  }

  // No-ops kept for API compatibility with THREE.DRACOLoader — minidraco has
  // no external decoder files to configure. The params are `unknown` (not
  // `string`/`object`) so the signatures stay assignable to THREE.DRACOLoader
  // across three versions, whose setDecoderPath has grown to accept a
  // `string | DecoderPaths` — letting the loader be passed to
  // GLTFLoader.setDRACOLoader() with no cast.
  setDecoderPath(_path?: unknown): this {
    return this
  }

  setDecoderConfig(_config?: unknown): this {
    return this
  }

  setWorkerLimit(limit: number): this {
    this.workerLimit = limit
    return this
  }

  // The worker-pool loader overrides these; on the single-threaded loader they
  // are no-ops.
  preload(): this {
    return this
  }

  dispose(): this {
    return this
  }

  override load(
    url: string,
    onLoad: (geometry: BufferGeometry) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    const loader = new FileLoader(this.manager)

    loader.setPath(this.path)
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      buffer => {
        this.parse(buffer as ArrayBuffer, onLoad, onError)
      },
      onProgress,
      onError,
    )
  }

  parse(
    buffer: ArrayBuffer,
    onLoad: (geometry: BufferGeometry) => void,
    onError: (err: unknown) => void = () => {},
  ): void {
    this.decodeDracoFile(buffer, onLoad, null, null, SRGBColorSpace, onError).catch(onError)
  }

  decodeDracoFile(
    buffer: ArrayBuffer,
    callback?: (geometry: BufferGeometry) => void,
    attributeIDs?: AttributeIDs | null,
    attributeTypes?: AttributeTypes | null,
    vertexColorSpace: string = LinearSRGBColorSpace,
    onError: (err: unknown) => void = () => {},
  ): Promise<BufferGeometry | void> {
    const taskConfig: TaskConfig = {
      attributeIDs: attributeIDs || this.defaultAttributeIDs,
      attributeTypes: attributeTypes || this.defaultAttributeTypes,
      useUniqueIDs: !!attributeIDs,
      vertexColorSpace,
    }

    return this.decodeGeometry(buffer, taskConfig).then(callback).catch(onError)
  }

  decodeGeometry(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<BufferGeometry> {
    const taskKey = JSON.stringify(taskConfig)

    if (_taskCache.has(buffer)) {
      const cachedTask = _taskCache.get(buffer)!
      if (cachedTask.key === taskKey) {
        return cachedTask.promise
      }
      // Same buffer, different settings: fall through and re-decode. (The input
      // is copied to the worker, never transferred, so it's still intact.)
    }

    const geometryPending = this._runTask(buffer, taskConfig)

    _taskCache.set(buffer, { key: taskKey, promise: geometryPending })

    return geometryPending
  }

  // Single-threaded loader: always decode on the main thread. The worker-pool
  // loader overrides this to route through the pool with a main-thread fallback.
  async _runTask(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<BufferGeometry> {
    return this._decodeBuffer(buffer, taskConfig)
  }

  // Main-thread decode (also the worker fallback and the DracoJs-style
  // subclass reuse point).
  _decodeBuffer(buffer: ArrayBuffer, taskConfig: TaskConfig): BufferGeometry {
    const mesh = decodeDracoMesh(new Uint8Array(buffer))
    return this._buildGeometry(mesh, taskConfig)
  }

  _buildGeometry(dracoGeometry: Mesh, taskConfig: TaskConfig): BufferGeometry {
    const attributeIDs = taskConfig.attributeIDs
    const attributeTypes = taskConfig.attributeTypes

    const geometry = new BufferGeometry()
    const numPoints = dracoGeometry.numPoints()

    for (const attributeName in attributeIDs) {
      const OutputTypedArray = _typedArrayMap[attributeTypes[attributeName]]
      if (!OutputTypedArray) continue

      let attribute: PointAttribute | null

      if (taskConfig.useUniqueIDs) {
        const uniqueId = attributeIDs[attributeName] as number
        attribute = dracoGeometry.getAttributeByUniqueId(uniqueId)
      } else {
        const typeEnum = _attributeTypeMap[attributeIDs[attributeName] as string]
        if (typeEnum === undefined) continue
        attribute = dracoGeometry.getNamedAttribute(typeEnum)
      }

      if (!attribute) continue

      const itemSize = attribute.numComponents
      const array = attribute.extractTo(OutputTypedArray, numPoints)

      const bufferAttribute = new BufferAttribute(array, itemSize)

      if (attributeName === 'color') {
        this._assignVertexColorSpace(bufferAttribute, taskConfig.vertexColorSpace)
        bufferAttribute.normalized = !(array instanceof Float32Array)
      }

      geometry.setAttribute(attributeName, bufferAttribute)
    }

    const numFaces = dracoGeometry.numFaces()
    const index = new Uint32Array(numFaces * 3)
    index.set(dracoGeometry.faces_.subarray(0, numFaces * 3))

    geometry.setIndex(new BufferAttribute(index, 1))

    return geometry
  }

  _assignVertexColorSpace(attribute: BufferAttribute, inputColorSpace: string): void {
    if (inputColorSpace !== SRGBColorSpace) return

    const _color = new Color()

    for (let i = 0, il = attribute.count; i < il; i++) {
      _color.fromBufferAttribute(attribute, i)
      ColorManagement.colorSpaceToWorking(_color, SRGBColorSpace)
      attribute.setXYZ(i, _color.r, _color.g, _color.b)
    }
  }
}

export { MiniDRACOLoader, MiniDRACOLoader as DRACOLoader }

// --- Compile-time guard: the loader must stay assignable to a
// THREE.DRACOLoader-shaped type so it can be passed to
// GLTFLoader.setDRACOLoader() with no cast on any three version. Newer three
// types setDecoderPath as `string | DecoderPaths`, so the no-op setters must
// accept a widened param. Purely type-level — emits no runtime code. Covers
// the worker-pool subclass too, which inherits this surface.
type _DracoLoaderShape = {
  setDecoderPath(path: string | Record<string, string>): unknown
  setDecoderConfig(config: object): unknown
  setWorkerLimit(limit: number): unknown
  preload(): unknown
  dispose(): unknown
}
type _Expect<T extends true> = T
type _LoaderAssignabilityGuard = _Expect<MiniDRACOLoader extends _DracoLoaderShape ? true : false>
