import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  output: 'export',
  allowedDevOrigins: ['minidraco.dev'],
}

// Dev-only companion server for the /bench page: receives benchmark results
// and merges them into BENCH.browser.json at the repo root so browser (V8)
// runs are tracked in git alongside the bun-generated BENCH.json. A plain
// API route can't do this — they're unsupported with `output: 'export'`.
const BENCH_RESULTS_PORT = 41999

const benchResultsPath = fileURLToPath(new URL('../BENCH.browser.json', import.meta.url))

const startBenchResultsServer = () => {
  const server = createServer((req, res) => {
    // The page lives on https://minidraco.dev; Chrome exempts localhost from
    // mixed-content blocking but CORS still applies
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'content-type')
    if (req.method === 'OPTIONS') return res.writeHead(204).end()
    if (req.method !== 'POST') return res.writeHead(405).end()

    let body = ''
    req.on('data', chunk => (body += chunk))
    req.on('end', () => {
      try {
        const { section, data } = JSON.parse(body)
        if (section !== 'singleThreaded' && section !== 'multiThreaded' && section !== 'coldLoad') {
          return res.writeHead(400).end('unknown section')
        }

        let existing = {}
        try {
          existing = JSON.parse(readFileSync(benchResultsPath, 'utf8'))
        } catch {
          // First save — start fresh
        }

        const merged = { ...existing, [section]: data }
        writeFileSync(benchResultsPath, `${JSON.stringify(merged, null, 2)}\n`)
        console.log(`Saved ${section} benchmark results to BENCH.browser.json`)
        // Re-render BENCH.md so its browser sections match the fresh JSON
        spawn('bun', ['library/scripts/benchmd.ts'], {
          cwd: fileURLToPath(new URL('..', import.meta.url)),
          stdio: 'ignore',
        }).on('error', () => console.warn('BENCH.md re-render failed (is bun on PATH?)'))
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}')
      } catch (error) {
        res.writeHead(500).end(String(error))
      }
    })
  })

  // Another dev server (or a restart race) may already hold the port
  server.on('error', error => {
    if (error.code !== 'EADDRINUSE') throw error
  })
  server.listen(BENCH_RESULTS_PORT, '127.0.0.1')
}

const config = phase => {
  if (phase === 'phase-development-server') startBenchResultsServer()
  return nextConfig
}

export default config
