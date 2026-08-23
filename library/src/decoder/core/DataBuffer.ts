// Ported from draco.js src/core/DataBuffer.js (MIT)

import { scratchUint8 } from './ScratchArena'

export class DataBuffer {
  _data: Uint8Array

  constructor() {
    this._data = new Uint8Array(0)
  }

  update(data: Uint8Array | ArrayBufferView | ArrayBuffer | null | undefined, size: number, offset = 0): boolean {
    if (data === null || data === undefined) {
      if (size + offset < 0) return false
      this._resize(size + offset)
    } else {
      if (size < 0) return false
      if (size + offset > this._data.length) {
        this._resize(size + offset)
      }
      const view = data as ArrayBufferView
      const src = new Uint8Array((view.buffer || data) as ArrayBuffer, view.byteOffset || 0, size)
      this._data.set(src, offset)
    }
    return true
  }

  resize(newSize: number): void {
    this._resize(newSize)
  }

  // Replaces the contents with a decode-scoped scratch buffer of exactly
  // `size` bytes; the previous contents are dropped and the new ones are
  // arbitrary, so every byte must be written before it is read. Only for
  // buffers that never outlive the decode (see ScratchArena) — the portable
  // attributes the integer decoders build and discard per attribute are the
  // one caller, and their per-primitive allocation showed up in profiles.
  adoptScratch(size: number): void {
    this._data = scratchUint8(size)
  }

  write(bytePos: number, inArray: Uint8Array | ArrayBufferView | ArrayBuffer, dataSize: number): void {
    // Fast path: the common caller passes a Uint8Array of exactly dataSize bytes.
    // Avoid allocating a wrapper view per value (dominates storage time / GC pressure).
    if (inArray instanceof Uint8Array) {
      this._data.set(inArray.length === dataSize ? inArray : inArray.subarray(0, dataSize), bytePos)
      return
    }
    const view = inArray as ArrayBufferView
    const src = new Uint8Array((view.buffer || inArray) as ArrayBuffer, view.byteOffset || 0, dataSize)
    this._data.set(src, bytePos)
  }

  get data(): Uint8Array {
    return this._data
  }
  get dataSize(): number {
    return this._data.length
  }

  _resize(newSize: number): void {
    if (newSize === this._data.length) return
    const newData = new Uint8Array(newSize)
    newData.set(this._data.subarray(0, Math.min(this._data.length, newSize)))
    this._data = newData
  }
}
