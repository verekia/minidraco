// minidraco/three/single — single-threaded DRACOLoader drop-in.
//
// Same decoder and API as `minidraco/three`, but with no worker pool: it never
// references the worker chunk, so a bundler won't emit a second copy of the
// decoder for apps that only ever decode on the main thread. Reach for this
// when you always want `workers: false`; if you need the pool (even
// conditionally, or a mix of loaders), import from `minidraco/three` instead.
export { DRACOLoader, MiniDRACOLoader } from './loader-base'
export type { AttributeIDs, AttributeTypes, MiniDRACOLoaderOptions } from './loader-base'
