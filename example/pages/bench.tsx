import { useCallback, useEffect, useState } from 'react'

import { decodeDracoMesh } from 'minidraco'

import { Decoder as DracoJsDecoder } from 'draco.js/src/compression/Decode.js'
import { DecoderBuffer as DracoJsDecoderBuffer } from 'draco.js/src/core/DecoderBuffer.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { getDracoLoader } from '../lib/loaders'
import {
  decodeRawWithDraco3d,
  decodeRawWithDracoJs,
  decodeRawWithMinidraco,
  extractPrimitives,
  getMainThreadDraco3d,
} from '../lib/raw-bench'

import type { RawPrimitive } from '../lib/raw-bench'

const BUNDLE_MODELS = [
  { name: 'manablade-characters.glb', url: '/models/manablade-characters.glb' },
  { name: 'manablade-static.glb', url: '/models/manablade-static.glb' },
]

const LOADER_WARMUP_RUNS = 1
const LOADER_TIMED_RUNS = 5
const RAW_WARMUP_RUNS = 3
const RAW_TIMED_RUNS = 10

const DECODERS = ['minidraco', 'draco.js', 'draco3d (wasm)'] as const

const median = (values: number[]) => [...values].toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!

// Yield to the event loop so status/table updates paint between sync decodes
const nextTick = () => new Promise(resolve => setTimeout(resolve, 0))

// How minidraco compares against another decoder's time. Differences within
// 5% are called even — that's inside run noise. Chrome clamps performance.now
// to 0.1 ms, so floor both sides at half the timer resolution to avoid
// Infinity when a decode rounds to 0.
const versus = (miniMs: number, otherMs: number) => {
  const ratio = Math.max(otherMs, 0.05) / Math.max(miniMs, 0.05)
  if (ratio >= 1.05) return `🟢 ${ratio.toFixed(2)}x faster`
  if (ratio <= 1 / 1.05) return `🔴 ${(1 / ratio).toFixed(2)}x slower`
  return '⚪ even'
}

interface BenchModel {
  name: string
  url: string
}

// The sample models are synced into public/models/samples by
// example/scripts/sync-samples.ts in local dev and never deployed, so the
// manifest 404s in production and the bench degrades to the bundles.
const useBenchModels = () => {
  const [models, setModels] = useState<BenchModel[]>(BUNDLE_MODELS)
  const [sampleCount, setSampleCount] = useState<number | null>(null)

  useEffect(() => {
    fetch('/models/samples/manifest.json')
      .then(response => (response.ok ? response.json() : []))
      .catch(() => [])
      .then((files: string[]) => {
        setSampleCount(files.length)
        if (files.length === 0) return
        setModels([...BUNDLE_MODELS, ...files.map(name => ({ name, url: `/models/samples/${name}` }))])
      })
  }, [])

  return { models, sampleCount }
}

const CorpusNote = ({ sampleCount, glbOnly }: { sampleCount: number | null; glbOnly?: boolean }) => (
  <p className="mb-4 max-w-xl text-sm text-neutral-500">
    {sampleCount === null
      ? 'Checking for sample models…'
      : sampleCount > 0
        ? `Corpus: 3 bundles + ${sampleCount} draco.js sample models${glbOnly ? ' (GLBs only)' : ''} (local dev only).`
        : 'Corpus: 3 bundles. Sample models are not deployed — run `bun dev` locally to include them.'}
  </p>
)

interface BenchRow {
  model: string
  primitives?: number
  faces?: number
  medianMs: Record<string, number>
}

const BenchTable = ({ rows }: { rows: BenchRow[] }) => {
  if (rows.length === 0) return null
  const showCounts = rows[0]!.primitives !== undefined

  return (
    <table className="text-sm">
      <thead>
        <tr className="text-left text-neutral-400">
          <th className="pr-6 pb-2">Model</th>
          {showCounts && (
            <>
              <th className="pr-6 pb-2 text-right">Prims</th>
              <th className="pr-6 pb-2 text-right">Faces</th>
            </>
          )}
          {DECODERS.map(d => (
            <th key={d} className="pr-6 pb-2 text-right">
              {d}
            </th>
          ))}
          <th className="pr-6 pb-2">vs draco.js</th>
          <th className="pb-2">vs wasm</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.model} className="border-t border-neutral-800">
            <td className="py-1 pr-6">{row.model}</td>
            {showCounts && (
              <>
                <td className="pr-6 text-right font-mono">{row.primitives}</td>
                <td className="pr-6 text-right font-mono">{row.faces!.toLocaleString('en-US')}</td>
              </>
            )}
            {DECODERS.map(d => (
              <td key={d} className="pr-6 text-right font-mono">
                {row.medianMs[d]!.toFixed(2)} ms
              </td>
            ))}
            <td className="pr-6 font-mono">{versus(row.medianMs['minidraco']!, row.medianMs['draco.js']!)}</td>
            <td className="font-mono">{versus(row.medianMs['minidraco']!, row.medianMs['draco3d (wasm)']!)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const RunButton = ({ running, onClick, label }: { running: boolean; onClick: () => void; label: string }) => (
  <button
    className="mb-6 rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
    onClick={onClick}
    disabled={running}
  >
    {running ? 'Running…' : label}
  </button>
)

// Same shape as the bun-generated BENCH.json, plus browser metadata
const buildResultsJson = (config: object, rows: BenchRow[]) => ({
  date: new Date().toLocaleDateString('en-CA'),
  runtime: navigator.userAgent,
  ...config,
  results: rows.map(row => ({
    file: row.model,
    ...(row.primitives === undefined ? {} : { primitives: row.primitives, faces: row.faces }),
    medianMs: Object.fromEntries(Object.entries(row.medianMs).map(([k, v]) => [k, Number(v.toFixed(3))])),
  })),
})

type ResultsSection = 'singleThreaded' | 'multiThreaded'

// In local dev, next.config.mjs runs a small companion server that merges
// each section's results into BENCH.browser.json at the repo root, so V8
// runs are tracked in git next to the bun results
const BENCH_RESULTS_URL = 'http://localhost:41999'

const ResultsActions = ({
  section,
  config,
  rows,
  canSave,
}: {
  section: ResultsSection
  config: object
  rows: BenchRow[]
  canSave: boolean
}) => {
  const [copied, setCopied] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  if (rows.length === 0) return null

  const copy = () => {
    navigator.clipboard.writeText(`${JSON.stringify(buildResultsJson(config, rows), null, 2)}\n`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const save = async () => {
    try {
      const response = await fetch(BENCH_RESULTS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section, data: buildResultsJson(config, rows) }),
      })
      if (!response.ok) throw new Error(await response.text())
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
    setTimeout(() => setSaveState('idle'), 2000)
  }

  const buttonClass = 'mb-4 rounded bg-neutral-700 px-3 py-1.5 text-sm font-medium hover:bg-neutral-600'

  return (
    <div className="flex gap-3">
      <button className={buttonClass} onClick={copy}>
        {copied ? 'Copied!' : 'Copy JSON'}
      </button>
      {canSave && (
        <button className={buttonClass} onClick={save}>
          {saveState === 'saved' ? 'Saved!' : saveState === 'error' ? 'Save failed' : 'Save to BENCH.browser.json'}
        </button>
      )}
    </div>
  )
}

// --- Raw single-threaded decode benchmark ---

const RawBenchSection = () => {
  const { models, sampleCount } = useBenchModels()
  const [rows, setRows] = useState<BenchRow[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')

  const run = useCallback(async () => {
    setRunning(true)
    setRows([])
    const results: BenchRow[] = []

    try {
      const draco3d = await getMainThreadDraco3d()
      const decodeAll: Record<string, (primitives: RawPrimitive[]) => void> = {
        minidraco: primitives => {
          for (const p of primitives) decodeRawWithMinidraco(p)
        },
        'draco.js': primitives => {
          for (const p of primitives) decodeRawWithDracoJs(p)
        },
        'draco3d (wasm)': primitives => {
          for (const p of primitives) decodeRawWithDraco3d(draco3d, p)
        },
      }

      for (const model of models) {
        const response = await fetch(model.url)
        if (!response.ok) throw new Error(`${model.url}: HTTP ${response.status}`)
        const bytes = new Uint8Array(await response.arrayBuffer())
        const primitives = extractPrimitives(model.name, bytes)

        let faces = 0
        for (const p of primitives) faces += decodeRawWithMinidraco(p).numFaces

        const medianMs: Record<string, number> = {}
        for (const decoder of DECODERS) {
          setStatus(`${model.name} — ${decoder}…`)
          await nextTick()

          const decode = decodeAll[decoder]!
          for (let i = 0; i < RAW_WARMUP_RUNS; i++) decode(primitives)
          const times: number[] = []
          for (let i = 0; i < RAW_TIMED_RUNS; i++) {
            const start = performance.now()
            decode(primitives)
            times.push(performance.now() - start)
          }
          medianMs[decoder] = median(times)
        }

        results.push({ model: model.name, primitives: primitives.length, faces, medianMs })
        setRows([...results])
      }
      setStatus('Done')
    } catch (error) {
      setStatus(String(error))
    } finally {
      setRunning(false)
    }
  }, [models])

  return (
    <section className="mb-12">
      <h2 className="mb-2 text-lg font-semibold">Raw decode — single-threaded, main thread</h2>
      <p className="mb-1 max-w-xl text-sm text-neutral-400">
        The fair comparison: the Draco bitstreams are extracted from each file up front and all three decoders run
        synchronously on the main thread — no worker pools, no GLTFLoader overhead. Median of {RAW_TIMED_RUNS} runs
        after {RAW_WARMUP_RUNS} warmups. The page freezes while it runs; that's the point.
      </p>
      <CorpusNote sampleCount={sampleCount} />
      <RunButton running={running} onClick={run} label="Run raw benchmark" />
      <p className="mb-4 text-sm text-neutral-400">{status}</p>
      <BenchTable rows={rows} />
      {!running && (
        <ResultsActions
          section="singleThreaded"
          config={{
            benchmark: 'raw decode, all decoders sync on main thread',
            warmupRuns: RAW_WARMUP_RUNS,
            timedRuns: RAW_TIMED_RUNS,
          }}
          rows={rows}
          canSave={(sampleCount ?? 0) > 0}
        />
      )}
    </section>
  )
}

// --- Full GLTFLoader benchmark (real-app wall clock, workers and all) ---

// Loader kind → display/result label
const LOADER_KINDS = [
  { kind: 'minidraco', label: 'minidraco' },
  { kind: 'draco.js', label: 'draco.js' },
  { kind: 'draco3d', label: 'draco3d (wasm)' },
] as const

const LoaderBenchSection = () => {
  const { models, sampleCount } = useBenchModels()
  const [rows, setRows] = useState<BenchRow[]>([])
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')

  const run = useCallback(async () => {
    setRunning(true)
    setRows([])
    const results: BenchRow[] = []

    try {
      // Raw .drc bitstreams have no glTF container for GLTFLoader to parse
      for (const model of models.filter(m => m.name.endsWith('.glb'))) {
        const response = await fetch(model.url)
        if (!response.ok) throw new Error(`${model.url}: HTTP ${response.status}`)
        const bytes = await response.arrayBuffer()

        const medianMs: Record<string, number> = {}
        for (const { kind, label } of LOADER_KINDS) {
          setStatus(`${model.name} — ${label}…`)
          const runsMs: number[] = []

          // Warmup + timed runs against long-lived loaders (worker pools and
          // wasm modules stay warm, as in a real app). A fresh ArrayBuffer
          // copy per parse defeats the per-buffer decode caches inside the
          // loaders.
          const dracoLoader = getDracoLoader(kind)
          for (let i = 0; i < LOADER_WARMUP_RUNS + LOADER_TIMED_RUNS; i++) {
            const gltfLoader = new GLTFLoader()
            gltfLoader.setDRACOLoader(dracoLoader)
            const start = performance.now()
            await gltfLoader.parseAsync(bytes.slice(0), '')
            const elapsed = performance.now() - start
            if (i >= LOADER_WARMUP_RUNS) runsMs.push(elapsed)
          }

          medianMs[label] = median(runsMs)
        }

        results.push({ model: model.name, medianMs })
        setRows([...results])
      }
      setStatus('Done')
    } catch (error) {
      setStatus(String(error))
    } finally {
      setRunning(false)
    }
  }, [models])

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">GLTFLoader — real-app wall clock</h2>
      <p className="mb-1 max-w-xl text-sm text-neutral-400">
        Full GLTFLoader.parse time (median of {LOADER_TIMED_RUNS} runs after warmup) with long-lived loaders. Not an
        apples-to-apples decoder comparison: minidraco and the wasm decoder parallelize across worker pools while
        draco.js decodes on the main thread — this measures what an app actually experiences. Includes texture decode
        and scene-graph setup, which dominates on the texture-heavy sample models.
      </p>
      <CorpusNote sampleCount={sampleCount} glbOnly />
      <RunButton running={running} onClick={run} label="Run loader benchmark" />
      <p className="mb-4 text-sm text-neutral-400">{status}</p>
      <BenchTable rows={rows} />
      {!running && (
        <ResultsActions
          section="multiThreaded"
          config={{
            benchmark: 'GLTFLoader wall clock; minidraco + wasm on 4-worker pools, draco.js main thread',
            warmupRuns: LOADER_WARMUP_RUNS,
            timedRuns: LOADER_TIMED_RUNS,
          }}
          rows={rows}
          canSave={(sampleCount ?? 0) > 0}
        />
      )}
    </section>
  )
}

const BenchPage = () => {
  // Raw-decoder debug handles for scripted pure-decode benchmarks (no GLTF
  // parse overhead) from the devtools console / automated browser checks.
  useEffect(() => {
    ;(window as any).__decoders = {
      minidraco: (data: Uint8Array) => decodeDracoMesh(data),
      dracoJs: (data: Uint8Array) => {
        const buffer = new DracoJsDecoderBuffer()
        buffer.init(data, data.length)
        const result = new DracoJsDecoder().decodeMeshFromBuffer(buffer)
        if (!result.ok) throw new Error(result.message)
        return result.mesh
      },
    }
  }, [])

  return (
    <div className="min-h-full bg-neutral-900 p-8 text-white">
      <h1 className="mb-8 text-xl font-semibold">minidraco in-browser benchmark</h1>
      <RawBenchSection />
      <LoaderBenchSection />
    </div>
  )
}

export default BenchPage
