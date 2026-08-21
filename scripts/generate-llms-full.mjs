#!/usr/bin/env node
/**
 * Builds public/llms-full.txt from curated content/*.mdx pages for agent ingest.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = path.join(root, 'content')
const outFile = path.join(root, 'public', 'llms-full.txt')

const files = [
  'automate/index.mdx',
  'automate/sftp-to-sql.mdx',
  'automate/missing-file-alerts.mdx',
  'automate/reconcile-positions.mdx',
  'automate/trigger-from-scripts.mdx',
  'automate/period-close.mdx',
  'index.mdx',
  'getting-started.mdx',
  'workflows/index.mdx',
  'workflows/workflow-trees.mdx',
  'workflows/parameters.mdx',
  'workflows/examples/sftp-download.mdx',
  'workflows/examples/table-to-csv-view.mdx',
  'workflows/examples/data-review.mdx',
  'checklists/index.mdx',
  'warehouses/data-monitors.mdx',
  'views/index.mdx',
  'api/index.mdx',
  'api/jobs-workflows-write.mdx',
  'api/webhooks.mdx'
]

function stripMdx(source) {
  let text = source.replace(/^---[\s\S]*?---\n*/, '')
  text = text.replace(/^import\s.+from\s+['"].+['"]\s*\n/gm, '')
  text = text.replace(/<Callout[\s\S]*?<\/Callout>/g, '')
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '')
  text = text.replace(/\{\/\*[\s\S]*?\*\//g, '')
  return text.trim()
}

const parts = [
  '# CoSet Docs — llms-full.txt',
  '',
  '> Concatenated high-value CoSet documentation for AI agents. Prefer https://cosethub.github.io/Docs/llms.txt to choose pages; use this file for bulk context.',
  '',
  `Generated: ${new Date().toISOString().slice(0, 10)}`,
  ''
]

for (const rel of files) {
  const abs = path.join(contentRoot, rel)
  if (!fs.existsSync(abs)) {
    console.warn(`skip missing: ${rel}`)
    continue
  }
  const body = stripMdx(fs.readFileSync(abs, 'utf8'))
  const url =
    rel === 'index.mdx'
      ? 'https://cosethub.github.io/Docs/'
      : `https://cosethub.github.io/Docs/${rel
          .replace(/\/index\.mdx$/, '/')
          .replace(/\.mdx$/, '/')}`
  parts.push('---')
  parts.push('')
  parts.push(`Source: ${url}`)
  parts.push('')
  parts.push(body)
  parts.push('')
}

fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, parts.join('\n'), 'utf8')
console.log(`Wrote ${outFile} (${parts.join('\n').length} chars)`)
