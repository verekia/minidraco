// MinidracoLoader's worker pool. Loaded on demand through `import()` the
// first time a loader with `workers: true` decodes, so the default
// single-threaded loader ships none of this (bundlers emit it as its own
// chunk; unbundled, it is dist/pool.js next to three.js).
import type { AttributeIDs, AttributeTypes } from './index'

export interface TaskConfig {
  attributeIDs: AttributeIDs
  attributeTypes: AttributeTypes
  useUniqueIDs: boolean
  vertexColorSpace: string
}

export interface RawAttribute {
  name: string
  array: Float32Array | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array | Uint32Array
  itemSize: number
}

// The decoded shape the worker posts back (and the sync path mirrors).
export interface RawGeometry {
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

interface PendingTask {
  resolve: (raw: RawGeometry) => void
  reject: (error: unknown) => void
  entry: WorkerEntry
}

const decodeError = (message: string): Error => {
  // Marked so the loader rejects the caller instead of retrying the decode on
  // the main thread: the input is what failed, not the worker infrastructure.
  const error = new Error(message) as Error & { isDecodeError: boolean }
  error.isDecodeError = true
  return error
}

export class WorkerPool {
  // Pool size; the loader keeps it in sync with setWorkerLimit().
  limit: number
  _workerUrl: string | URL | null
  _workers: WorkerEntry[] = []
  _taskId = 0
  _tasks = new Map<number, PendingTask>()
  // Tasks queued during the current microtask; flushed as one batched message
  // per worker (a 488-primitive scene costs 4 postMessages, not 488).
  _batch: QueuedTask[] = []
  _batchScheduled = false
  // Set when spawning a worker fails (bundler without module-worker support,
  // file:// pages, …) or a worker errors: the loader then decodes on the main
  // thread.
  broken = false
  // Same-origin blob bootstrap used when the worker asset lives on a CDN
  // origin (created lazily, revoked on dispose).
  _blobUrl: string | null = null

  constructor(limit: number, workerUrl: string | URL | null) {
    this.limit = limit
    this._workerUrl = workerUrl
  }

  // Spawns the whole pool up front: each fresh worker runs a short JIT warmup
  // at startup (see worker.ts), so spawning early lets that overlap the model
  // download instead of the first decode burst.
  spawnAll(): void {
    while (this._workers.length < this.limit && this._getWorker() !== null) {
      // _getWorker creates one worker per call while under the limit
    }
  }

  dispose(): void {
    for (const entry of this._workers) entry.worker.terminate()
    this._workers = []
    // Settle everything still outstanding so no caller promise hangs after
    // teardown. Terminated workers never post back, and a batch flush already
    // scheduled for this tick would otherwise respawn untracked workers — so
    // reject the queued batch too and empty it (the stale flush then no-ops on
    // the empty batch).
    const error = decodeError('MinidracoLoader: disposed while decoding')
    for (const task of this._batch) task.reject(error)
    this._batch = []
    this._batchScheduled = false
    for (const [, task] of this._tasks) task.reject(error)
    this._tasks.clear()
    if (this._blobUrl !== null) {
      URL.revokeObjectURL(this._blobUrl)
      this._blobUrl = null
    }
  }

  decode(buffer: ArrayBuffer, taskConfig: TaskConfig): Promise<RawGeometry> {
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

  _getWorker(): WorkerEntry | null {
    if (this.broken) return null

    if (this._workers.length < this.limit) {
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
          if (this._blobUrl === null) {
            const bootstrap = `import ${JSON.stringify(String(workerUrl))};`
            this._blobUrl = URL.createObjectURL(new Blob([bootstrap], { type: 'text/javascript' }))
          }
          worker = new Worker(this._blobUrl, { type: 'module' })
        } catch {
          this.broken = true
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
            task.reject(decodeError(error))
          }
        }
      }

      worker.onerror = event => {
        // Kill the whole pool: reject outstanding tasks so they rerun on the
        // main thread, and stop routing new ones to workers.
        this.broken = true
        for (const [id, task] of this._tasks) {
          if (task.entry.worker === worker) {
            this._tasks.delete(id)
            task.reject(new Error(`MinidracoLoader worker failed: ${event.message ?? 'unknown error'}`))
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

  _flushBatch(): void {
    this._batchScheduled = false
    const batch = this._batch
    if (batch.length === 0) return
    this._batch = []

    // Spawn workers up to the limit (or the batch size, if smaller)
    while (this._workers.length < Math.min(this.limit, batch.length) && this._getWorker() !== null) {
      // _getWorker creates one worker per call while under the limit
    }
    if (this.broken || this._workers.length === 0) {
      // The pool broke (possibly between queueing and this flush) or spawning
      // failed; the loader falls back to the synchronous path per task.
      const error = new Error('MinidracoLoader: worker unavailable')
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
}
