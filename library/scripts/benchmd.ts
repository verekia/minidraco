// Renders BENCH.md from the machine-readable results: BENCH.json (bun) and
// BENCH.browser.json (browser single-threaded raw decode + GLTFLoader wall
// clock). Run directly to re-render from the current JSON files:
//
//   bun library/scripts/benchmd.ts
//
// bench.ts calls writeBenchMd() after a full run, and the /bench save server
// (example/next.config.mjs) re-renders after saving browser results, so the
// markdown never goes stale relative to the JSON.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface ResultRow {
  file: string
  primitives?: number
  faces?: number
  medianMs: Record<string, number>
}

interface BunResults {
  date: string
  runtime: string
  engine: string
  cpu: string
  warmupRuns: number
  timedRuns: number
  results: ResultRow[]
}

interface BrowserSection {
  date: string
  runtime: string
  benchmark: string
  warmupRuns: number
  timedRuns: number
  results: ResultRow[]
}

interface BrowserResults {
  singleThreaded?: BrowserSection
  multiThreaded?: BrowserSection
  coldLoad?: BrowserSection
}

const repoRoot = resolve(import.meta.dir, '../..')

// How minidraco compares against another decoder's time, as a human-readable
// verdict. Differences within 5% are called even — that's inside run noise.
// Browser timers are clamped to 0.1 ms, so floor both sides at half of that.
const versus = (miniMs: number, otherMs: number): string => {
  const ratio = Math.max(otherMs, 0.05) / Math.max(miniMs, 0.05)
  if (ratio >= 1.05) return `🟢 ${ratio.toFixed(2)}x faster`
  if (ratio <= 1 / 1.05) return `🔴 ${(1 / ratio).toFixed(2)}x slower`
  return '⚪ even'
}

// Plain unpadded rows: the caller runs oxfmt on the file, which owns the
// final column alignment (emoji display widths make hand-padding fragile).
const resultsTable = (results: ResultRow[]): string[] => {
  const withCounts = results[0]?.primitives !== undefined
  const header = [
    'file',
    ...(withCounts ? ['prims', 'faces'] : []),
    'minidraco',
    'draco.js',
    'draco3d (wasm)',
    'minidraco vs draco.js',
    'minidraco vs wasm',
  ]
  const align = header.map((_, i) => (i === 0 || i >= header.length - 2 ? '---' : '---:'))

  const rows = results.map(r => {
    const mini = r.medianMs['minidraco']
    const js = r.medianMs['draco.js']
    const wasm = r.medianMs['draco3d (wasm)']
    return [
      `\`${r.file}\``,
      ...(withCounts ? [String(r.primitives), r.faces!.toLocaleString('en-US')] : []),
      `${mini.toFixed(2)} ms`,
      `${js.toFixed(2)} ms`,
      `${wasm.toFixed(2)} ms`,
      versus(mini, js),
      versus(mini, wasm),
    ]
  })

  return [`| ${header.join(' | ')} |`, `| ${align.join(' | ')} |`, ...rows.map(cells => `| ${cells.join(' | ')} |`)]
}

// "Chrome/142.0.0.0 on Macintosh" out of a full user-agent string
const shortBrowser = (userAgent: string): string => {
  const browser = userAgent.match(/(Chrome|Firefox|Safari)\/[\d.]+/)?.[0]
  const platform = userAgent.match(/\(([^);]+)/)?.[1]
  return browser ? `${browser}${platform ? ` on ${platform}` : ''}` : userAgent
}

export const renderBenchMd = (bun: BunResults, browser: BrowserResults | null): string => {
  const lines = [
    '# Benchmark results',
    '',
    '<!-- Generated from BENCH.json + BENCH.browser.json by library/scripts/benchmd.ts — do not edit by hand. -->',
    '',
    'Median decode time per file (every Draco primitive decoded sequentially per run). The corpus',
    'is the production bundle GLBs from `example/public/models` plus the sample models shipped in',
    '[mrdoob/draco.js](https://github.com/mrdoob/draco.js) (`samples/`, used straight from the',
    'installed dependency). The last two columns say how minidraco compares to each other decoder:',
    '🟢 minidraco is faster, 🔴 minidraco is slower, ⚪ within 5% (run noise).',
    '',
    '## Bun — single-threaded (JavaScriptCore)',
    '',
    `Raw decode via \`bun run bench\`, median of ${bun.timedRuns} runs after ${bun.warmupRuns} warmups.`,
    '',
    `- Date: ${bun.date}`,
    `- Runtime: ${bun.runtime} (${bun.engine})`,
    `- CPU: ${bun.cpu}`,
    '',
    ...resultsTable(bun.results),
    '',
  ]

  const single = browser?.singleThreaded
  lines.push('## Browser — single-threaded raw decode (V8)', '')
  if (single) {
    lines.push(
      'All three decoders run synchronously on the main thread — no worker pools, no GLTFLoader',
      `overhead. Median of ${single.timedRuns} runs after ${single.warmupRuns} warmups, saved from the example's \`/bench\` page.`,
      '',
      `- Date: ${single.date}`,
      `- Browser: ${shortBrowser(single.runtime)}`,
      '',
      ...resultsTable(single.results),
      '',
    )
  } else {
    lines.push('_No saved browser results — run the raw benchmark on the `/bench` page locally and save it._', '')
  }

  const loader = browser?.multiThreaded
  lines.push('## Browser — GLTFLoader wall clock (V8)', '')
  if (loader) {
    lines.push(
      'Full `GLTFLoader.parse` time with long-lived loaders. Not an apples-to-apples decoder',
      'comparison: minidraco and the wasm decoder parallelize across 4-worker pools while draco.js',
      'decodes on the main thread — this measures what an app actually experiences, including',
      `texture decode and scene-graph setup. Median of ${loader.timedRuns} runs after ${loader.warmupRuns} warmups`,
      '(a fresh worker pool needs a few loads before its JIT settles — see the cold section for the',
      'first load), GLBs only (raw `.drc` files have no glTF container).',
      '',
      `- Date: ${loader.date}`,
      `- Browser: ${shortBrowser(loader.runtime)}`,
      '',
      ...resultsTable(loader.results),
      '',
    )
  } else {
    lines.push('_No saved browser results — run the loader benchmark on the `/bench` page locally and save it._', '')
  }

  const cold = browser?.coldLoad
  lines.push('## Browser — GLTFLoader cold first load (V8)', '')
  if (cold) {
    lines.push(
      'The first load of a session: a fresh loader per trial (minidraco spawns and JIT-warms its',
      'worker pool, the wasm decoder downloads and compiles its module), preloaded 300 ms before a',
      `single \`GLTFLoader.parse\`. Median of ${cold.timedRuns} trials. draco.js has no pool or wasm to warm,`,
      'so its column is a plain main-thread parse. Cold numbers swing more than warm ones: an idle',
      'worker thread also restarts on a slow core on Apple Silicon.',
      '',
      `- Date: ${cold.date}`,
      `- Browser: ${shortBrowser(cold.runtime)}`,
      '',
      ...resultsTable(cold.results),
      '',
    )
  } else {
    lines.push('_No saved browser results — run the cold-load benchmark on the `/bench` page locally and save it._', '')
  }

  lines.push(
    'Medians of independent runs carry roughly ±10% JIT/thermal noise (more for the loader wall',
    'clock) — treat this as the cross-decoder picture, not a micro-optimization ranking.',
    '',
  )

  return lines.join('\n')
}

export const writeBenchMd = (): void => {
  const bun = JSON.parse(readFileSync(resolve(repoRoot, 'BENCH.json'), 'utf8')) as BunResults
  const browserPath = resolve(repoRoot, 'BENCH.browser.json')
  const browser = existsSync(browserPath) ? (JSON.parse(readFileSync(browserPath, 'utf8')) as BrowserResults) : null

  const benchMdPath = resolve(repoRoot, 'BENCH.md')
  writeFileSync(benchMdPath, renderBenchMd(bun, browser))

  // oxfmt owns the final table padding — emoji column widths are hard to
  // reproduce by hand and the file must pass `oxfmt --check`
  const oxfmt = Bun.spawnSync(['bunx', 'oxfmt', benchMdPath])
  if (oxfmt.exitCode !== 0) console.warn(`oxfmt failed on BENCH.md: ${oxfmt.stderr.toString().trim()}`)
  console.log(`Wrote ${benchMdPath}`)
}

if (import.meta.main) {
  writeBenchMd()
}
