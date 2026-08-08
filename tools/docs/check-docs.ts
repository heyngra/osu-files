import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const required = ['docs/index.md', 'docs/public/CNAME', 'docs/api/index.md', 'docs/api/advanced.md', 'docs/api/catalog.md', 'docs/api/_generated-sidebar.json', 'docs/.generated/api-manifest.json', 'docs/.generated/api-examples.json', 'docs/.generated/facade-examples.json', 'docs/.generated/guides.json', 'docs/.vitepress/pure-api.ts']
for (const file of required) if (!existsSync(resolve(root, file))) throw new Error(`Missing documentation file: ${file}`)
if (readFileSync(resolve(root, 'docs/public/CNAME'), 'utf8').trim() !== 'osu-files.heyn.live') throw new Error('Invalid CNAME')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8')) as Array<{ publicSymbol: string; memberPath?: string; kind: string; importPath: string; documentationPage: string; exampleIds: string[] }>
const apiExamples = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-examples.json'), 'utf8')) as Array<{ id: string; target: string; execution: string; code: string; output?: string; documentationPage: string; placement: { kind: 'declaration' } | { kind: 'member'; anchor: string } }>
const facades = ['Beatmaps', 'Sets', 'Scores', 'Collections', 'Rulesets', 'RulesetSettings', 'Skins', 'Files', 'Keybindings', 'ModPresets', 'Metadata']
for (const facade of facades) if (!existsSync(resolve(root, 'docs/api/facades', `${facade}.md`))) throw new Error(`Missing generated facade page: docs/api/facades/${facade}.md`)
if (manifest.some(item => item.importPath !== 'osu-files')) throw new Error('API manifest contains a non-Node import path')
if (JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).exports['./browser']) throw new Error('Public browser export must not exist')
const examplesById = new Map(apiExamples.map(example => [example.id, example]))
if (examplesById.size !== apiExamples.length) throw new Error('API example IDs must be unique')
for (const item of manifest) {
  if (['function', 'class', 'interface', 'type', 'enum', 'constructor', 'method', 'accessor'].includes(item.kind) && item.exampleIds.length === 0)
    throw new Error(`Missing API example for ${item.memberPath ?? item.publicSymbol}`)
  for (const id of item.exampleIds) if (!examplesById.has(id)) throw new Error(`Manifest references missing API example: ${id}`)
}
for (const example of apiExamples) {
  if (!example.code.trim() || example.code.includes('...')) throw new Error(`Unusable API example: ${example.id}`)
  if (example.execution !== 'static-node-only' && typeof example.output !== 'string') throw new Error(`Runnable API example has no verified output: ${example.id}`)
  if (example.execution === 'static-node-only' && example.output !== undefined) throw new Error(`Static API example has runtime output: ${example.id}`)
  if (example.placement.kind === 'member') {
    const page = example.documentationPage.split('#')[0].replace(/^\//, '')
    const content = readFileSync(resolve(root, 'docs', `${page}.md`), 'utf8')
    const anchor = `<a id="${example.placement.anchor}"></a>`
    const anchorIndex = content.indexOf(anchor)
    const markerIndex = content.indexOf(`<!-- api-example:${example.id} -->`)
    const nextAnchor = content.indexOf('<a id="', anchorIndex + anchor.length)
    if (anchorIndex < 0 || markerIndex < 0 || markerIndex < anchorIndex || (nextAnchor >= 0 && markerIndex > nextAnchor))
      throw new Error(`API example is detached from its member: ${example.id}`)
  }
}
for (const item of manifest) {
  const page = item.documentationPage.split('#')[0].replace(/^\//, '')
  if (!existsSync(resolve(root, 'docs', `${page}.md`))) throw new Error(`Missing generated API page: docs/${page}.md`)
  const content = readFileSync(resolve(root, 'docs', `${page}.md`), 'utf8')
  if (!/^---\noutline:\n  level: \[2, 3\]\n---\n/.test(content)) throw new Error(`Generated API page has no compact outline configuration: docs/${page}.md`)
  if (/^## Examples$/m.test(content)) throw new Error(`Legacy API examples section remains: docs/${page}.md`)
  if (item.exampleIds.length && !content.includes('<PromotableExample')) throw new Error(`API page has no rendered examples: docs/${page}.md`)
}
console.log(`Documentation checks passed (${required.length} required files).`)
