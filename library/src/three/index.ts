// A drop-in replacement for three.js's DRACOLoader backed by the minidraco
// pure-TypeScript decoder — no wasm files to host, no async decoder bootstrap.
// Structurally compatible with THREE.DRACOLoader so it can be passed straight
// to GLTFLoader.setDRACOLoader() with no cast, on any three version.
//
// By default decoding runs in a pool of module workers (parallel across
// primitives, main thread stays free), with a transparent main-thread fallback
// when workers are unavailable (SSR, worker bundling unsupported). Pass
// `{ workers: false }` (or setWorkers(false) / setWorkerLimit(0)) to decode on
// the main thread instead. Apps that ONLY ever decode single-threaded should
// import `minidraco/three/single`, which drops the worker code entirely so the
// bundler never emits the worker chunk.
import { BufferAttribute, BufferGeometry } from 'three'

import { MiniDRACOLoader as MiniDRACOLoaderBase } from './loader-base'

import type { LoadingManager } from 'three'

import type { MiniDRACOLoaderOptions, TaskConfig } from './loader-base'

export type { AttributeIDs, AttributeTypes, MiniDRACOLoaderOptions } from './loader-base'

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

class MiniDRACOLoader extends MiniDRACOLoaderBase {
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

  constructor(managerOrOptions?: LoadingManager | MiniDRACOLoaderOptions) {
    super(managerOrOptions)
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

  // Toggle the worker pool on/off. false decodes on the main thread; true
  // enables the pool, keeping the current size or falling back to
  // the default 4 if it was disabled. For a specific pool size use
  // setWorkerLimit(n).
  setWorkers(enabled: boolean): this {
    this.workerLimit = enabled ? this.workerLimit || 4 : 0
    return this
  }

  override preload(): this {
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

  override dispose(): this {
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

  override async _runTask(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<BufferGeometry> {
    if (this._workersAvailable()) {
      if (buffer.byteLength > this.syncByteThreshold) {
        try {
          const raw = await this._decodeInWorker(buffer, taskConfig)
          return this._buildGeometryFromRaw(raw, taskConfig)
        } catch (error) {
          // Decode errors (malformed data) carry `isDecodeError`; anything else
          // is worker infrastructure failing — fall back to the main thread.
          if ((error as { isDecodeError?: boolean })?.isDecodeError) throw error
          this._workersBroken = true
        }
      } else {
        // Tiny buffer: decode on the main thread, but yield one microtask
        // first so a caller looping over many primitives finishes posting the
        // large ones to the workers before we start doing main-thread work.
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
        // trips the main-thread fallback below.
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
      // failed; _runTask falls back to the main-thread path per task.
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
}

export { MiniDRACOLoader, MiniDRACOLoader as DRACOLoader }
