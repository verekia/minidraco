import { MiniDRACOLoaderBase } from './core'

export type { AttributeIDs, AttributeTypes, MiniDRACOLoaderOptions } from './core'

class MiniDRACOLoader extends MiniDRACOLoaderBase {
  override _createWorker(): Worker | null {
    if (this._workerUrl !== null) return this._createWorkerFromUrl(this._workerUrl)

    return new Worker(new URL('../worker-vite.js', import.meta.url), { type: 'module' })
  }
}

export { MiniDRACOLoader, MiniDRACOLoader as DRACOLoader }
