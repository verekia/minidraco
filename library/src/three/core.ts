// A drop-in replacement for three.js's DRACOLoader backed by the minidraco
// pure-TypeScript decoder — no wasm files to host, no async decoder bootstrap.
// Structurally compatible with THREE.DRACOLoader so it can be passed straight
// to GLTFLoader.setDRACOLoader() with no cast, on any three version.
//
// By default decoding runs in a pool of module workers (parallel across
// primitives, main thread stays free), with a transparent synchronous fallback
// when workers are unavailable (SSR, worker bundling unsupported). Pass
// `{ workers: false }` (or setWorkers(false) / setWorkerLimit(0)) to decode
// synchronously on the main thread instead.
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

import type { LoadingManager } from 'three'

import type { Mesh, PointAttribute } from '../index'

export type AttributeIDs = Record<string, number | string>
export type AttributeTypes = Record<string, string>

export interface MiniDRACOLoaderOptions {
  // three.js LoadingManager, as with any loader.
  manager?: LoadingManager
  // false → decode synchronously on the main thread (no worker pool).
  // Default true. Equivalent to workerLimit: 0 / setWorkers(false).
  workers?: boolean
  // Worker pool size when workers are enabled (default 4).
  workerLimit?: number
  // See the syncByteThreshold field (default 0 = always use the pool).
  syncByteThreshold?: number
}

// LoadingManager instances expose itemStart(); an options bag does not. Lets
// the constructor keep the three-compatible `new Loader(manager)` form while
// also accepting `new MiniDRACOLoader({ workers: false })`.
const isLoadingManager = (value: unknown): value is LoadingManager =>
  typeof (value as { itemStart?: unknown } | null | undefined)?.itemStart === 'function'

interface TaskConfig {
  attributeIDs: AttributeIDs
  attributeTypes: AttributeTypes
  useUniqueIDs: boolean
  vertexColorSpace: string
}

interface RawAttribute {
  name: string
  array: Float32Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array
  itemSize: number
}

interface RawGeometry {
  indices: Uint32Array
  attributes: RawAttribute[]
}

interface WorkerEntry {
  worker: Worker
  pending: number
}

interface QueuedTask {
  id: number
  buffer: ArrayBuffer
  taskConfig: TaskConfig
  resolve: (raw: RawGeometry) => void
  reject: (error: unknown) => void
}

type TypedArrayConstructor =
  | Float32ArrayConstructor
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor

const _taskCache = new WeakMap<ArrayBuffer, { key: string; promise: Promise<BufferGeometry> }>()

const _attributeTypeMap: Record<string, number> = {
  POSITION: 0,
  NORMAL: 1,
  COLOR: 2,
  TEX_COORD: 3,
  GENERIC: 4,
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

class MiniDRACOLoaderBase extends Loader<BufferGeometry> {
  defaultAttributeIDs: AttributeIDs
  defaultAttributeTypes: AttributeTypes
  workerLimit: number
  // Opt-in (0 = disabled): buffers at or below this size decode synchronously
  // on the main thread instead of paying the ~0.5 ms worker message roundtrip.
  // Worth enabling (e.g. 4096) when the main thread is otherwise idle during
  // loads — in a full GLTFLoader parse the main thread is already busy
  // building geometries, and measurements show the pool wins there even for
  // tiny primitives.
  syncByteThreshold: number

  _workers: WorkerEntry[]
  _taskId: number
  _tasks: Map<number, { resolve: (raw: RawGeometry) => void; reject: (error: unknown) => void; entry: WorkerEntry }>
  // Tasks queued during the current microtask; flushed as one batched message
  // per worker (a 488-primitive scene costs 4 postMessages, not 488).
  _batch: QueuedTask[]
  _batchScheduled: boolean
  // Set when spawning a worker fails (bundler without module-worker support,
  // file:// pages, …): decoding transparently falls back to the main thread.
  _workersBroken: boolean
  _workerUrl: string | URL | null
  // Same-origin blob bootstrap used when the worker asset lives on a CDN
  // origin (created lazily, revoked on dispose).
  _workerBlobUrl: string | null

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
    this._workers = []
    this._taskId = 0
    this._tasks = new Map()
    this._batch = []
    this._batchScheduled = false
    this._workersBroken = false
    this._workerUrl = null
    this._workerBlobUrl = null
  }

  // Overrides where the decode worker is loaded from. Normally unnecessary:
  // the worker resolves through `new URL('./worker.js', import.meta.url)`
  // (bundlers emit it as a hashed asset), and CDN origins are handled by the
  // blob bootstrap in _getWorker.
  setWorkerUrl(url: string | URL | null): this {
    this._workerUrl = url
    return this
  }

  // No-ops kept for API compatibility with THREE.DRACOLoader — minidraco has
  // no external decoder files to configure. The params are `unknown` (not
  // `string`/`object`) so the signatures stay assignable to THREE.DRACOLoader
  // across three versions, whose setDecoderPath has grown to accept a
  // `string | DecoderPaths` — letting `new MiniDRACOLoader()` be passed to
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

  // Toggle the worker pool on/off. false decodes synchronously on the main
  // thread; true enables the pool, keeping the current size or falling back to
  // the default 4 if it was disabled. For a specific pool size use
  // setWorkerLimit(n).
  setWorkers(enabled: boolean): this {
    this.workerLimit = enabled ? this.workerLimit || 4 : 0
    return this
  }

  preload(): this {
    // Spawn the whole pool, not just one worker: each fresh worker runs a
    // short JIT warmup at startup (see worker.ts), so spawning them all here
    // lets that overlap the model download instead of the first decode burst.
    if (this._workersAvailable()) {
      while (this._workers.length < this.workerLimit && this._getWorker() !== null) {
        // _getWorker creates one worker per call while under the limit
      }
    }
    return this
  }

  dispose(): this {
    for (const entry of this._workers) entry.worker.terminate()
    this._workers = []
    // Settle everything still outstanding so no caller promise hangs after
    // teardown. Terminated workers never post back, and a batch flush already
    // scheduled for this tick would otherwise respawn untracked workers — so
    // reject the queued batch too and empty it (the stale flush then no-ops on
    // the empty batch). The error is marked isDecodeError so _runTask rejects
    // the caller instead of retrying the decode on the main thread. The loader
    // stays reusable: a later decode spawns a fresh pool.
    const disposedError = new Error('MiniDRACOLoader: disposed while decoding') as Error & { isDecodeError: boolean }
    disposedError.isDecodeError = true
    for (const task of this._batch) task.reject(disposedError)
    this._batch = []
    this._batchScheduled = false
    for (const [, task] of this._tasks) task.reject(disposedError)
    this._tasks.clear()
    if (this._workerBlobUrl !== null) {
      URL.revokeObjectURL(this._workerBlobUrl)
      this._workerBlobUrl = null
    }
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
      if (buffer.byteLength > this.syncByteThreshold) {
        try {
          const raw = await this._decodeInWorker(buffer, taskConfig)
          return this._buildGeometryFromRaw(raw, taskConfig)
        } catch (error) {
          // Decode errors (malformed data) carry `isDecodeError`; anything else
          // is worker infrastructure failing — fall back to the sync path.
          if ((error as { isDecodeError?: boolean })?.isDecodeError) throw error
          this._workersBroken = true
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

  _getWorker(): WorkerEntry | null {
    if (this._workersBroken) return null

    if (this._workers.length < this.workerLimit) {
      const worker = this._createWorker()
      if (worker === null) return null
      const entry: WorkerEntry = { worker, pending: 0 }

      worker.onmessage = (event: MessageEvent) => {
        for (const { id, ok, indices, attributes, error } of event.data.results) {
          const task = this._tasks.get(id)
          if (!task) continue
          this._tasks.delete(id)
          task.entry.pending--
          if (ok) {
            task.resolve({ indices, attributes })
          } else {
            const decodeError = new Error(error) as Error & { isDecodeError: boolean }
            decodeError.isDecodeError = true
            task.reject(decodeError)
          }
        }
      }

      worker.onerror = event => {
        // Kill the whole pool: reject outstanding tasks so they rerun on the
        // main thread, and stop routing new ones to workers.
        this._workersBroken = true
        for (const [id, task] of this._tasks) {
          if (task.entry.worker === worker) {
            this._tasks.delete(id)
            task.reject(new Error(`MiniDRACOLoader worker failed: ${event.message ?? 'unknown error'}`))
          }
        }
      }

      this._workers.push(entry)
      return entry
    }

    let best = this._workers[0]
    for (const entry of this._workers) if (entry.pending < best.pending) best = entry
    return best
  }

  _createWorker(): Worker | null {
    return null
  }

  _createWorkerFromUrl(workerUrl: string | URL): Worker | null {
    let worker: Worker
    try {
      worker = new Worker(workerUrl, { type: 'module' })
    } catch {
      // Typically a SecurityError: the asset lives on a CDN origin (Next.js
      // assetPrefix), and browsers refuse to construct a Worker from a
      // cross-origin script. Bootstrap through a same-origin blob module that
      // imports the CDN URL instead. If that import fails, the worker's error
      // event trips the sync fallback below.
      try {
        if (this._workerBlobUrl === null) {
          const bootstrap = `import ${JSON.stringify(String(workerUrl))};`
          this._workerBlobUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }))
        }
        worker = new Worker(this._workerBlobUrl, { type: 'module' })
      } catch {
        this._workersBroken = true
        return null
      }
    }

    return worker
  }

  _decodeInWorker(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<RawGeometry> {
    const id = this._taskId++
    return new Promise<RawGeometry>((resolve, reject) => {
      // Queue instead of posting immediately: tasks issued in the same tick
      // (GLTFLoader fans out one decode per primitive) flush together as one
      // message per worker, with the work balanced across the pool up front.
      this._batch.push({ id, buffer, taskConfig, resolve, reject })
      if (!this._batchScheduled) {
        this._batchScheduled = true
        queueMicrotask(() => this._flushBatch())
      }
    })
  }

  _flushBatch(): void {
    this._batchScheduled = false
    const batch = this._batch
    if (batch.length === 0) return
    this._batch = []

    // Spawn workers up to the limit (or the batch size, if smaller)
    while (this._workers.length < Math.min(this.workerLimit, batch.length) && this._getWorker() !== null) {
      // _getWorker creates one worker per call while under the limit
    }
    if (this._workersBroken || this._workers.length === 0) {
      // The pool broke (possibly between queueing and this flush) or spawning
      // failed; _runTask falls back to the synchronous path per task.
      const error = new Error('MiniDRACOLoader: worker unavailable')
      for (const task of batch) task.reject(error)
      return
    }

    // Greedy longest-first assignment by compressed size: balances the pool
    // even when primitive sizes are wildly uneven. Workers still busy with a
    // previous burst start with a handicap (their pending count, priced at
    // this batch's average task size).
    batch.sort((a, b) => b.buffer.byteLength - a.buffer.byteLength)
    let totalBytes = 0
    for (const task of batch) totalBytes += task.buffer.byteLength
    const averageBytes = totalBytes / batch.length
    const buckets = this._workers.map(entry => ({
      entry,
      tasks: [] as QueuedTask[],
      bytes: entry.pending * averageBytes,
    }))
    for (const task of batch) {
      let best = buckets[0]
      for (const bucket of buckets) if (bucket.bytes < best.bytes) best = bucket
      best.tasks.push(task)
      best.bytes += task.buffer.byteLength
    }

    for (const { entry, tasks } of buckets) {
      if (tasks.length === 0) continue
      entry.pending += tasks.length
      for (const task of tasks) this._tasks.set(task.id, { resolve: task.resolve, reject: task.reject, entry })
      // The compressed inputs are posted as copies (they're small); the
      // decoded arrays come back transferred (they're big).
      entry.worker.postMessage({
        tasks: tasks.map(task => ({
          id: task.id,
          buffer: task.buffer,
          attributeIDs: task.taskConfig.attributeIDs,
          attributeTypes: task.taskConfig.attributeTypes,
          useUniqueIDs: task.taskConfig.useUniqueIDs,
        })),
      })
    }
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

  // Main-thread decode (worker fallback and DracoJs-style reuse).
  _decodeBuffer(buffer: ArrayBuffer, taskConfig: TaskConfig): BufferGeometry | Promise<BufferGeometry> {
    return import('../index').then(({ decodeDracoMesh }) => {
      const mesh = decodeDracoMesh(new Uint8Array(buffer))
      return this._buildGeometry(mesh, taskConfig)
    })
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

export { MiniDRACOLoaderBase }

// --- Compile-time guard: MiniDRACOLoader must stay assignable to a
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
type _LoaderAssignabilityGuard = _Expect<MiniDRACOLoaderBase extends _DracoLoaderShape ? true : false>
