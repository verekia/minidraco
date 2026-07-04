// A drop-in replacement for three.js's DRACOLoader backed by the minidraco
// pure-TypeScript decoder — no wasm files to host, no async decoder bootstrap.
// API-compatible with THREE.DRACOLoader so it can be passed straight to
// GLTFLoader.setDRACOLoader().
//
// Decoding runs in a pool of module workers (parallel across primitives, main
// thread stays free) with a transparent synchronous fallback when workers are
// unavailable (SSR, worker bundling unsupported, or setWorkerLimit(0)).
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

export type AttributeIDs = Record<string, number | string>
export type AttributeTypes = Record<string, string>

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

class MiniDRACOLoader extends Loader<BufferGeometry> {
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
  // Set when spawning a worker fails (bundler without module-worker support,
  // file:// pages, …): decoding transparently falls back to the main thread.
  _workersBroken: boolean
  _workerUrl: string | URL | null
  // Same-origin blob bootstrap used when the worker asset lives on a CDN
  // origin (created lazily, revoked on dispose).
  _workerBlobUrl: string | null

  constructor(manager?: LoadingManager) {
    super(manager)

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

    this.workerLimit = 4
    this.syncByteThreshold = 0
    this._workers = []
    this._taskId = 0
    this._tasks = new Map()
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

  // Kept for API compatibility with THREE.DRACOLoader — minidraco has no
  // external decoder files to configure.
  setDecoderPath(_path?: string): this {
    return this
  }

  setDecoderConfig(_config?: object): this {
    return this
  }

  setWorkerLimit(limit: number): this {
    this.workerLimit = limit
    return this
  }

  preload(): this {
    if (this._workersAvailable()) this._getWorker()
    return this
  }

  dispose(): this {
    for (const entry of this._workers) entry.worker.terminate()
    this._workers = []
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
      } else if (buffer.byteLength === 0) {
        throw new Error(
          'MiniDRACOLoader: Unable to re-decode a buffer with different settings. Buffer has already been transferred.',
        )
      }
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
      // `new URL('./worker.js', import.meta.url)` is recognized by webpack /
      // turbopack / vite and emitted as a hashed static asset; unbundled, it
      // resolves to the self-contained dist/worker.js next to this file.
      // (Kept as a standalone expression — not inline in `new Worker(...)` —
      // so bundlers emit a plain asset URL instead of a worker chunk.)
      const workerUrl = this._workerUrl ?? new URL('./worker.js', import.meta.url)

      let worker: Worker
      try {
        worker = new Worker(workerUrl, { type: 'module' })
      } catch {
        // Typically a SecurityError: the asset lives on a CDN origin (Next.js
        // assetPrefix), and browsers refuse to construct a Worker from a
        // cross-origin script. Bootstrap through a same-origin blob module
        // that imports the CDN URL instead (the import is a CORS request, so
        // the CDN must send Access-Control-Allow-Origin — as it already must
        // for fonts/models). If that import fails, the worker's error event
        // trips the sync fallback below.
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
      const entry: WorkerEntry = { worker, pending: 0 }

      worker.onmessage = (event: MessageEvent) => {
        const { id, ok, indices, attributes, error } = event.data
        const task = this._tasks.get(id)
        if (!task) return
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

  _decodeInWorker(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<RawGeometry> {
    const entry = this._getWorker()
    if (entry === null) {
      // Worker spawn failed; _runTask falls back to the synchronous path.
      return Promise.reject(new Error('MiniDRACOLoader: worker unavailable'))
    }
    const id = this._taskId++

    return new Promise<RawGeometry>((resolve, reject) => {
      this._tasks.set(id, { resolve, reject, entry })
      entry.pending++
      // The compressed input is posted as a copy (it's small); the decoded
      // arrays come back transferred (they're big).
      entry.worker.postMessage({
        id,
        buffer,
        attributeIDs: taskConfig.attributeIDs,
        attributeTypes: taskConfig.attributeTypes,
        useUniqueIDs: taskConfig.useUniqueIDs,
      })
    })
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
