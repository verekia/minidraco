// A drop-in replacement for three.js's DRACOLoader backed by the minidraco
// pure-TypeScript decoder — no wasm files to host, no async decoder bootstrap.
// Structurally compatible with THREE.DRACOLoader so it can be passed straight
// to GLTFLoader.setDRACOLoader() with no cast, on any three version.
//
// By default decoding runs synchronously on the main thread. Pass
// `{ workers: true }` (or setWorkers(true) / setWorkerLimit(n)) to decode in a
// pool of module workers instead (parallel across primitives, main thread
// stays free), with a transparent synchronous fallback when workers are
// unavailable (SSR, worker bundling unsupported). The pool code lives in
// pool.ts and is imported on first use, so it is not part of this module's
// download.
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
// paths): it keeps the dts build free of hashed shared-type chunks — three.d.ts
// simply imports from index.d.ts.
import { decodeDracoMesh, GeometryAttributeType } from '../index'

import type { LoadingManager } from 'three'

import type { Mesh, PointAttribute } from '../index'
import type { RawAttribute, RawGeometry, TaskConfig, WorkerPool } from './pool'

export type AttributeIDs = Record<string, number | string>
export type AttributeTypes = Record<string, string>

export interface MinidracoLoaderOptions {
  // three.js LoadingManager, as with any loader.
  manager?: LoadingManager
  // true → decode in a worker pool. Default false (synchronous on the main
  // thread). Equivalent to setWorkers(true).
  workers?: boolean
  // Worker pool size (default 4). Setting it also enables the pool.
  workerLimit?: number
  // See the mainThreadByteThreshold field (default 0 = always use the pool).
  mainThreadByteThreshold?: number
}

// LoadingManager instances expose itemStart(); an options bag does not. Lets
// the constructor keep the three-compatible `new Loader(manager)` form while
// also accepting `new MinidracoLoader({ workers: true })`.
const isLoadingManager = (value: unknown): value is LoadingManager =>
  typeof (value as { itemStart?: unknown } | null | undefined)?.itemStart === 'function'

type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor

const _taskCache = new WeakMap<ArrayBuffer, { key: string; promise: Promise<BufferGeometry> }>()

// Named attribute ids (POSITION..GENERIC) looked up by the string the caller
// passes in attributeIDs.
const _attributeTypeMap: Record<string, number | undefined> = GeometryAttributeType

const _typedArrayMap: Record<string, TypedArrayConstructor> = {
  Float32Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
}

class MinidracoLoader extends Loader<BufferGeometry> {
  defaultAttributeIDs: AttributeIDs = {
    position: 'POSITION',
    normal: 'NORMAL',
    color: 'COLOR',
    uv: 'TEX_COORD',
  }
  defaultAttributeTypes: AttributeTypes = {
    position: 'Float32Array',
    normal: 'Float32Array',
    color: 'Float32Array',
    uv: 'Float32Array',
  }
  workerLimit: number
  // Opt-in (0 = disabled): buffers at or below this size decode on the main
  // thread instead of paying the ~0.5 ms worker message roundtrip.
  // Worth enabling (e.g. 4096) when the main thread is otherwise idle during
  // loads — in a full GLTFLoader parse the main thread is already busy
  // building geometries, and measurements show the pool wins there even for
  // tiny primitives.
  mainThreadByteThreshold: number

  // The pool, once its module has loaded; null again after dispose() so a
  // later decode spawns a fresh one.
  _pool: WorkerPool | null = null
  _poolPromise: Promise<WorkerPool | null> | null = null
  // Set when the pool module fails to load or the pool breaks: decoding
  // transparently falls back to the main thread.
  _workersBroken = false
  _workerUrl: string | URL | null = null

  // Accepts either a LoadingManager (three-compatible form) or an options bag.
  constructor(managerOrOptions?: LoadingManager | MinidracoLoaderOptions) {
    const options: MinidracoLoaderOptions = isLoadingManager(managerOrOptions)
      ? { manager: managerOrOptions }
      : (managerOrOptions ?? {})
    super(options.manager)
    const workers = options.workers ?? options.workerLimit !== undefined
    this.workerLimit = workers ? (options.workerLimit ?? 4) : 0
    this.mainThreadByteThreshold = options.mainThreadByteThreshold ?? 0
  }

  // Overrides where the decode worker is loaded from. Normally unnecessary:
  // the worker resolves through `new URL('./worker.js', import.meta.url)`
  // (bundlers emit it as a hashed asset), and CDN origins are handled by the
  // blob bootstrap in the pool. Takes effect for the next pool spawned.
  setWorkerUrl(url: string | URL | null): this {
    this._workerUrl = url
    return this
  }

  // No-ops kept for API compatibility with THREE.DRACOLoader — minidraco has
  // no external decoder files to configure. The params are `unknown` (not
  // `string`/`object`) so the signatures stay assignable to THREE.DRACOLoader
  // across three versions, whose setDecoderPath has grown to accept a
  // `string | DecoderPaths` — letting `new MinidracoLoader()` be passed to
  // GLTFLoader.setDRACOLoader() with no cast.
  setDecoderPath(_path?: unknown): this {
    return this
  }

  setDecoderConfig(_config?: unknown): this {
    return this
  }

  setWorkerLimit(limit: number): this {
    this.workerLimit = limit
    if (this._pool !== null) this._pool.limit = limit
    return this
  }

  // Toggle the worker pool on/off. true enables the pool, keeping the current
  // size or falling back to 4 if it was off; false decodes synchronously on the
  // main thread (the default). For a specific pool size use setWorkerLimit(n).
  setWorkers(enabled: boolean): this {
    return this.setWorkerLimit(enabled ? this.workerLimit || 4 : 0)
  }

  // Loads the pool module and spawns the whole pool now, so the workers' JIT
  // warmup overlaps the model download instead of the first decode burst.
  preload(): this {
    if (this._workersAvailable()) {
      this._getPool().then(pool => pool?.spawnAll())
    }
    return this
  }

  dispose(): this {
    // Outstanding pooled decodes reject (as decode errors, so they are not
    // retried on the main thread). The loader stays reusable: a later decode
    // spawns a fresh pool.
    if (this._pool !== null) this._pool.dispose()
    this._pool = null
    this._poolPromise = null
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

  async _runTask(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<BufferGeometry> {
    if (this._workersAvailable()) {
      if (buffer.byteLength > this.mainThreadByteThreshold) {
        const pool = await this._getPool()
        if (pool !== null) {
          try {
            const raw = await pool.decode(buffer, taskConfig)
            return this._buildGeometryFromRaw(raw, taskConfig)
          } catch (error) {
            // Decode errors (malformed data) carry `isDecodeError`; anything
            // else is worker infrastructure failing — fall back to the sync
            // path.
            if ((error as { isDecodeError?: boolean })?.isDecodeError) throw error
            this._workersBroken = true
          }
        }
      } else {
        // Tiny buffer: decode on the main thread, but yield one microtask
        // first so a caller looping over many primitives finishes posting the
        // large ones to the workers before we start doing sync work.
        await Promise.resolve()
      }
    }
    return this._decodeBuffer(buffer, taskConfig)
  }

  _workersAvailable(): boolean {
    return this.workerLimit > 0 && typeof Worker !== 'undefined' && !this._workersBroken
  }

  // The pool, loading its module on first use. Resolves null (and marks the
  // workers broken) when the module cannot be loaded, e.g. a bundler that does
  // not split dynamic imports out of dependencies.
  _getPool(): Promise<WorkerPool | null> {
    this._poolPromise ??= import('./pool.js').then(
      module => (this._pool = new module.WorkerPool(this.workerLimit, this._workerUrl)),
      () => {
        this._workersBroken = true
        return null
      },
    )
    return this._poolPromise
  }

  _buildGeometryFromRaw(raw: RawGeometry, taskConfig: TaskConfig): BufferGeometry {
    const geometry = new BufferGeometry()

    for (const attribute of raw.attributes) {
      const bufferAttribute = new BufferAttribute(attribute.array, attribute.itemSize)
      if (attribute.name === 'color') {
        this._assignVertexColorSpace(bufferAttribute, taskConfig.vertexColorSpace)
        bufferAttribute.normalized = !(attribute.array instanceof Float32Array)
      }
      geometry.setAttribute(attribute.name, bufferAttribute)
    }

    geometry.setIndex(new BufferAttribute(raw.indices, 1))
    return geometry
  }

  // Synchronous main-thread decode (worker fallback and DracoJs-style reuse).
  _decodeBuffer(buffer: ArrayBuffer, taskConfig: TaskConfig): BufferGeometry {
    const mesh = decodeDracoMesh(new Uint8Array(buffer))
    return this._buildGeometry(mesh, taskConfig)
  }

  // Gathers the requested attributes off a decoded mesh into the same raw shape
  // the worker posts back, then builds the geometry from it.
  _buildGeometry(dracoGeometry: Mesh, taskConfig: TaskConfig): BufferGeometry {
    const attributeIDs = taskConfig.attributeIDs
    const attributeTypes = taskConfig.attributeTypes
    const numPoints = dracoGeometry.numPoints()
    const attributes: RawAttribute[] = []

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

      attributes.push({
        name: attributeName,
        array: attribute.extractTo(OutputTypedArray, numPoints),
        itemSize: attribute.numComponents,
      })
    }

    // The face buffer is fresh per decode and holds non-negative point ids,
    // so its bytes are handed over as the Uint32 index array (as the worker
    // does) rather than copied.
    const faces = dracoGeometry.faces_
    const indices = new Uint32Array(faces.buffer, faces.byteOffset, dracoGeometry.numFaces() * 3)

    return this._buildGeometryFromRaw({ indices, attributes }, taskConfig)
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

export { MinidracoLoader, MinidracoLoader as DRACOLoader }

// --- Compile-time guard: MinidracoLoader must stay assignable to a
// THREE.DRACOLoader-shaped type so it can be passed to
// GLTFLoader.setDRACOLoader() with no cast on any three version. Newer three
// types setDecoderPath as `string | DecoderPaths`, so the no-op setters must
// accept a widened param (see setDecoderPath/setDecoderConfig above). This is
// purely type-level — it emits no runtime code. If the surface regresses,
// `_LoaderAssignabilityGuard` resolves to a non-`true` type and errors here.
type _DracoLoaderShape = {
  setDecoderPath(path: string | Record<string, string>): unknown
  setDecoderConfig(config: object): unknown
  setWorkerLimit(limit: number): unknown
  preload(): unknown
  dispose(): unknown
}
type _Expect<T extends true> = T
type _LoaderAssignabilityGuard = _Expect<MinidracoLoader extends _DracoLoaderShape ? true : false>
