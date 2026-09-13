// Ported from draco.js src/core/BitUtils.js (MIT)

// Branchless inlined zigzag decode: (val>>>1) ^ -(val&1) avoids a per-value call/branch.
export function convertSymbolsToSignedInts(
  input: Uint32Array | Int32Array | number[],
  count: number,
  output: Int32Array | Uint32Array | number[],
): void {
  for (let i = 0; i < count; i++) {
    const val = input[i]
    output[i] = (val >>> 1) ^ -(val & 1)
  }
}
