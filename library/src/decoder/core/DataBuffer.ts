// Ported from draco.js src/core/DataBuffer.js (MIT)

export class DataBuffer {
  _data: Uint8Array = new Uint8Array(0)

  // Resizes to `size` bytes (contents preserved); when `data` is given, grows
  // as needed and copies its first `size` bytes in.
  update(data: Uint8Array | null, size: number): void {
    if (data === null) {
      this._resize(size)
      return
    }
    if (size > this._data.length) {
      this._resize(size)
    }
    this._data.set(data.length === size ? data : data.subarray(0, size))
  }


  // The caller passes a Uint8Array of exactly dataSize bytes in the common
  // case; avoid allocating a wrapper view per value (dominates storage time /
  // GC pressure).
  write(bytePos: number, inArray: Uint8Array, dataSize: number): void {
    this._data.set(inArray.length === dataSize ? inArray : inArray.subarray(0, dataSize), bytePos)
  }

  get data(): Uint8Array {
    return this._data
  }
  _resize(newSize: number): void {
    if (newSize === this._data.length) return
    const newData = new Uint8Array(newSize)
    newData.set(this._data.subarray(0, Math.min(this._data.length, newSize)))
    this._data = newData
  }
}
