#!/usr/bin/env node
/**
 * Generate content/api/job-parameter-schemas/ (index + one page per job)
 * from RyanServer job class [JobInput]/[JobOutput].
 * Usage: node scripts/generate-job-parameter-schemas.mjs [path-to-RyanServer]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.resolve(__dirname, '..')
const ryanServer =
  process.argv[2] ||
  path.resolve(docsRoot, '../RyanServer')
const jobsDir = path.join(ryanServer, 'Ryan.Domain.Jobs/Jobs')
const outDir = path.join(docsRoot, 'content/api/job-parameter-schemas')

const PUBLIC_NAME = {
  FakeJob: 'Group',
}

const SKIP = new Set([
  'IScheduledJob.cs',
  'AbstractBloombergJob.cs',
  'UnrecognizedJob.cs',
])

function toSlug(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

function parseClassFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const classMatch = text.match(
    /public\s+(?:abstract\s+)?class\s+(\w+)\s*(?::\s*([^{\n]+))?/,
  )
  if (!classMatch) return null
  const className = classMatch[1]
  const bases = (classMatch[2] || '')
    .split(',')
    .map((s) => s.trim().split('<')[0].trim())
    .filter(Boolean)

  const params = []
  const attrStartRe = /\[(JobInput|JobOutput)\b/g
  let am
  while ((am = attrStartRe.exec(text)) !== null) {
    const kind = am[1]
    let i = am.index + am[0].length
    let depth = 1
    let attrBody = ''
    while (i < text.length && depth > 0) {
      const ch = text[i]
      if (ch === '[') depth++
      else if (ch === ']') {
        depth--
        if (depth === 0) break
      }
      if (depth >= 1) attrBody += ch
      i++
    }
    const after = text.slice(i + 1)
    const propMatch = after.match(
      /^\s*(?:\[[^\]]*\]\s*)*(?:public|protected|internal|private)\s+(?:(?:new|override|virtual|async)\s+)*([\w.<>,\s\?\[\]]+?)\s+(\w+)\s*\{/,
    )
    if (!propMatch) continue

    const csharpType = propMatch[1].replace(/\s+/g, ' ').trim()
    const name = propMatch[2]
    const start = Math.max(0, am.index - 400)
    const preceding = text.slice(start, am.index)
    const displayName = (preceding.match(/\[DisplayName\("([^"]*)"\)\]/) || [])[1]
    const description =
      (attrBody.match(/Description\s*=\s*"([^"]*)"/) || [])[1] ||
      (preceding.match(/\[Description\("([^"]*)"\)\]/) || [])[1] ||
      displayName ||
      ''

    const isRequired = /IsRequired\s*=\s*true/.test(attrBody)
    const isHidden = /IsHidden\s*=\s*true/.test(attrBody)
    const secondary =
      (attrBody.match(/SecondaryType\s*=\s*JobSecondaryParameterTypeOption\.(\w+)/) ||
        [])[1] || null
    const credTypes = [
      ...attrBody.matchAll(/CredentialTypeOption\.(\w+)/g),
    ].map((x) => x[1])
    let defaultValue = null
    const dv = attrBody.match(/DefaultValue\s*=\s*([^,\]]+?)(?=\s*[,\)])/)
    if (dv) defaultValue = dv[1].trim()

    params.push({
      name,
      kind: kind === 'JobOutput' ? 'output' : 'input',
      csharpType,
      isRequired,
      isHidden,
      secondary,
      credTypes,
      defaultValue,
      description,
    })
  }

  return { className, bases, params, file: path.basename(filePath) }
}

function resolveInheritance(classes) {
  const byName = new Map(classes.map((c) => [c.className, c]))
  function allParams(className, seen = new Set()) {
    if (!byName.has(className) || seen.has(className)) return []
    seen.add(className)
    const c = byName.get(className)
    const inherited = []
    for (const b of c.bases) {
      if (byName.has(b)) inherited.push(...allParams(b, seen))
    }
    const map = new Map()
    for (const p of inherited) map.set(p.name, p)
    for (const p of c.params) map.set(p.name, p)
    return [...map.values()]
  }
  return classes.map((c) => ({
    ...c,
    resolvedParams: allParams(c.className),
  }))
}

function apiType(p) {
  if (p.secondary === 'Credential' || p.secondary === 'Calendar') return 'foreign_key_option'
  if (p.secondary === 'DateFormat') return 'date_format'
  if (p.secondary === 'Interval') return 'option'
  const t = p.csharpType.replace(/\?$/, '')
  if (t === 'int' || t === 'Int32' || t === 'long' || t === 'Int64') return 'int'
  if (t === 'bool' || t === 'Boolean') return 'boolean'
  if (t === 'DateTime') return 'DateTime'
  if (t.includes('List') || t.includes('IEnumerable') || t.includes('[]'))
    return 'CommaSeparatedValues'
  if (/^[A-Z]/.test(t) && !t.includes('.')) return 'option'
  return 'string'
}

function escapeCell(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function renderJobPage(job) {
  const publicName = PUBLIC_NAME[job.className] || job.className
  let params = job.resolvedParams

  if (job.className === 'FakeJob') {
    params = [
      ...params,
      {
        name: 'recurrence_period',
        kind: 'input',
        csharpType: 'string',
        isRequired: true,
        isHidden: false,
        secondary: null,
        credTypes: [],
        defaultValue: null,
        description:
          "Schedule recurrence. Values: Onetime, Daily, Weekly, Monthly, Hourly, EveryOtherWeek, Quarterly, Every6Months, Yearly, Custom",
      },
      {
        name: 'start_date',
        kind: 'input',
        csharpType: 'DateTime',
        isRequired: true,
        isHidden: false,
        secondary: null,
        credTypes: [],
        defaultValue: null,
        description: 'ISO start datetime, e.g. 2026-01-01T09:00:00',
      },
      {
        name: 'has_expiration_date',
        kind: 'input',
        csharpType: 'bool',
        isRequired: false,
        isHidden: false,
        secondary: null,
        credTypes: [],
        defaultValue: 'false',
        description: 'When true, schedule ends on expiration_date',
      },
      {
        name: 'expiration_date',
        kind: 'input',
        csharpType: 'DateTime',
        isRequired: false,
        isHidden: false,
        secondary: null,
        credTypes: [],
        defaultValue: null,
        description: 'ISO end datetime when has_expiration_date is true',
      },
      {
        name: 'daily_recur_every_x_day',
        kind: 'input',
        csharpType: 'int',
        isRequired: false,
        isHidden: false,
        secondary: null,
        credTypes: [],
        defaultValue: null,
        description: 'For Daily only: run every N days (1 = every day)',
      },
    ]
  }

  const ENUM_HELP = {
    DataRequestCollectionMode:
      '1 = FileToTable, 2 = FileToLocation, 3 = Form (UI: File to table / File to location / Form)',
    DeliveryMethod: 'Link = 1 (live table/view), Attachment = 2 (file snapshot)',
  }

  const inputs = params.filter((p) => p.kind === 'input' && !p.isHidden)
  const outputs = params.filter((p) => p.kind === 'output' && !p.isHidden)
  const hidden = params.filter((p) => p.isHidden)

  let md = `# \`${publicName}\`\n\n`
  if (PUBLIC_NAME[job.className]) {
    md += `Internal class: \`${job.className}\`.\n\n`
  }
  md += `Parameters for workflow **create / update** (\`jobs_with_parameters[].parameters\`) and run \`parameter_overrides\`.\n\n`
  md += `\`job_type\`: \`${publicName}\` · [Create workflow](../jobs-workflows-write#post-workflows) · [All job schemas](./)\n\n`

  if (!inputs.length && !outputs.length) {
    md += '_No public parameters discovered._\n'
    return md
  }

  if (inputs.length) {
    md += `## Inputs\n\n`
    md += `| Parameter | Type | Required | Description |\n| --- | --- | --- | --- |\n`
    for (const p of inputs) {
      const bits = []
      if (ENUM_HELP[p.name]) bits.push(ENUM_HELP[p.name])
      else if (p.description) bits.push(p.description)
      if (p.secondary) bits.push(`Secondary: ${p.secondary}`)
      if (p.credTypes.length) bits.push(`Credential types: ${p.credTypes.join(', ')}`)
      if (p.defaultValue) bits.push(`Default: \`${p.defaultValue}\``)
      md += `| \`${p.name}\` | \`${apiType(p)}\` | ${p.isRequired ? 'Yes' : 'No'} | ${escapeCell(bits.join('. ') || '—')} |\n`
    }
    md += `\n`
  }

  if (outputs.length) {
    md += `## Outputs\n\n`
    md += `| Parameter | Type | Description |\n| --- | --- | --- |\n`
    for (const p of outputs) {
      md += `| \`${p.name}\` | \`${apiType(p)}\` | ${escapeCell(p.description || 'Emitted after run — map onto a later job input')} |\n`
    }
    md += `\n`
  }

  if (hidden.length) {
    md += `<details>\n<summary>Hidden / system parameters (${hidden.length})</summary>\n\n`
    md += `| Parameter | IO | Notes |\n| --- | --- | --- |\n`
    for (const p of hidden) {
      md += `| \`${p.name}\` | ${p.kind} | Usually set by the platform; omit unless you know you need it |\n`
    }
    md += `\n</details>\n`
  }

  return md
}

if (!fs.existsSync(jobsDir)) {
  console.error(`Jobs directory not found: ${jobsDir}`)
  process.exit(1)
}

const files = fs
  .readdirSync(jobsDir)
  .filter((f) => f.endsWith('Job.cs') || f === 'FakeJob.cs')
  .filter((f) => !SKIP.has(f))

const parsed = files
  .map((f) => parseClassFile(path.join(jobsDir, f)))
  .filter(Boolean)
  .filter((c) => c.className !== 'ScheduledJobBase')

const resolved = resolveInheritance(parsed)
  .filter((c) => !c.className.startsWith('Abstract'))
  .sort((a, b) => {
    const an = PUBLIC_NAME[a.className] || a.className
    const bn = PUBLIC_NAME[b.className] || b.className
    return an.localeCompare(bn)
  })

fs.mkdirSync(outDir, { recursive: true })

for (const existing of fs.readdirSync(outDir)) {
  if (existing.endsWith('.mdx') || existing === '_meta.js') {
    fs.unlinkSync(path.join(outDir, existing))
  }
}

const metaEntries = { index: 'Overview' }
const tocRows = []

for (const job of resolved) {
  const publicName = PUBLIC_NAME[job.className] || job.className
  const slug = toSlug(publicName)
  metaEntries[slug] = publicName
  tocRows.push(`| [\`${publicName}\`](./${slug}) |`)
  fs.writeFileSync(path.join(outDir, `${slug}.mdx`), renderJobPage(job))
}

fs.writeFileSync(
  path.join(outDir, '_meta.js'),
  `export default ${JSON.stringify(metaEntries, null, 2)}\n`,
)

const index = `import { Callout } from 'nextra/components'

# Job parameter schemas

Parameter catalog for workflow **create / update** payloads (\`jobs_with_parameters[].parameters\`) and \`parameter_overrides\` on run. One page per \`job_type\`.

Generated from RyanServer job classes (\`[JobInput]\` / \`[JobOutput]\`). Prefer live schemas from your tenant when FK option lists matter:

- Instance: \`GET /api/v1/jobs/{jobId}?include_output=true\`
- By type (private today): \`POST /api/ai-workflow/jobs/parameters\` — see [Jobs & workflows — read](../jobs-workflows-read)

<Callout type="info">
  **Descriptions** come from \`Description\` / \`DisplayName\` when present on the C# property; otherwise the table lists type / secondary hints only. Org-enabled job types may be a subset of this list (\`GET /jobs\`).
</Callout>

## How to use with create workflow

\`\`\`json
{
  "job_type": "FTPRetrieveJob",
  "job_name": "Pull PB file",
  "access_key": "…",
  "parent_access_key": "…",
  "fire_on_success": "RunOnSuccess",
  "parameters": [
    { "name": "SourceFolder", "value": "/incoming" },
    { "name": "OutputFolder", "value": "C:\\\\Landing" }
  ]
}
\`\`\`

Root \`Group\` schedule virtual params use snake_case (\`recurrence_period\`, \`start_date\`, …) — see [\`Group\`](./group).

## Job types

| \`job_type\` |
| --- |
${tocRows.join('\n')}
`

fs.writeFileSync(path.join(outDir, 'index.mdx'), index)

const oldSingle = path.join(docsRoot, 'content/api/job-parameter-schemas.mdx')
if (fs.existsSync(oldSingle)) fs.unlinkSync(oldSingle)

console.log(`Wrote ${outDir} (${resolved.length} job pages + index)`)
