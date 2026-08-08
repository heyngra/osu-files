import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apiExcludes } from './api-excludes.js'
import { buildApiExampleModel } from './api-example-model.js'

type Item = {
  publicSymbol: string; kind: string; memberPath?: string; importPath: 'osu-files'; signature?: string
  parameters?: Array<{ name: string; type: string; optional: boolean; defaultValue?: string }>; returnType?: string
  sourceFile: string; sourceLine: number; documentationPage: string; exampleIds: string[]; interactiveExampleIds: string[]; visibility: 'stable' | 'advanced'
}

const data = JSON.parse(readFileSync(resolve('docs/.generated/typedoc.json'), 'utf8'))
const apiExampleModel = buildApiExampleModel(data)
const examplesByTarget = apiExampleModel.byTarget
const examplesById = new Map(apiExampleModel.examples.map(example => [example.id, example]))
const kindNames: Record<number, string> = { 8: 'enum', 16: 'enum-member', 32: 'variable', 64: 'function', 128: 'class', 256: 'interface', 512: 'constructor', 1024: 'property', 2048: 'method', 262144: 'accessor', 2097152: 'type' }
const category: Record<string, string> = { function: 'functions', class: 'classes', enum: 'enumerations', variable: 'variables', interface: 'interfaces', type: 'type-aliases' }
const advancedSymbols = new Set(['FileStore', 'RealmSession', 'RollbackEntry', 'RollbackLogger', 'Crud', 'RollbackOptions'])
const advancedMembers = new Set(['OsuFilesAPI.realm', 'OsuFilesAPI.logger'])
const facadeNames = ['Beatmaps', 'Sets', 'Scores', 'Collections', 'Rulesets', 'RulesetSettings', 'Skins', 'Files', 'Keybindings', 'ModPresets', 'Metadata']
const typeText = (type: any): string => {
  if (!type) return 'void'
  if (type.type === 'intrinsic' || type.type === 'reference') return type.name ?? 'unknown'
  if (type.type === 'array') return `${typeText(type.elementType)}[]`
  if (type.type === 'union') return type.types.map(typeText).join(' | ')
  if (type.type === 'reflection') return 'object'
  if (type.type === 'literal') return JSON.stringify(type.value)
  return type.name ?? type.type ?? 'unknown'
}
const signatureText = (reflection: any): string | undefined => {
  const sig = reflection.signatures?.[0]
  if (!sig) return undefined
  const params = (sig.parameters ?? []).map((p: any) => `${p.name}${p.flags?.isOptional ? '?' : ''}: ${typeText(p.type)}`).join(', ')
  return `${reflection.name}(${params}): ${typeText(sig.type)}`
}
const memberAnchor = (kind: string, name: string) => {
  const slug = name.toLowerCase()
  return kind === 'enum-member' ? `#enumeration-member-${slug}` : `#${slug}`
}
const params = (reflection: any) => reflection.signatures?.[0]?.parameters?.map((p: any) => ({ name: p.name, type: typeText(p.type), optional: Boolean(p.flags?.isOptional), defaultValue: p.defaultValue }))
const sourceFile = (reflection: any, fallback = 'src/index.ts') => { const file = reflection.sources?.[0]?.fileName; return file ? (file.startsWith('src/') ? file : `src/${file}`) : fallback }
const items: Item[] = []
const add = (reflection: any, parent?: Item) => {
  if (apiExcludes.includes(reflection.name)) return
  if (parent && (reflection.name.startsWith('_') || reflection.name === '[iterator]' || reflection.name === '[dispose]')) return
  const kind = kindNames[reflection.kind]
  if (!kind) return
  const isMember = kind === 'enum-member' || kind === 'constructor' || kind === 'method' || kind === 'property' || kind === 'accessor'
  if (isMember) {
    if (parent && kind) {
      const memberPath = `${parent.memberPath ?? parent.publicSymbol}.${reflection.name}`
      const exampleIds = examplesByTarget[memberPath] ?? []
      const item: Item = { publicSymbol: reflection.name, kind, memberPath, importPath: 'osu-files', signature: signatureText(reflection), parameters: params(reflection), returnType: typeText(reflection.signatures?.[0]?.type), sourceFile: sourceFile(reflection, parent.sourceFile), sourceLine: reflection.sources?.[0]?.line ?? parent.sourceLine, documentationPage: `${parent.documentationPage}${memberAnchor(kind, reflection.name)}`, exampleIds, interactiveExampleIds: exampleIds.filter(id => examplesById.get(id)?.execution !== 'static-node-only'), visibility: parent.visibility === 'advanced' || advancedMembers.has(memberPath) ? 'advanced' : parent.visibility }
      items.push(item)
    }
  } else {
    const group = category[kind] ?? 'types'
    const exampleIds = examplesByTarget[reflection.name] ?? []
    const item: Item = { publicSymbol: reflection.name, kind, importPath: 'osu-files', signature: signatureText(reflection), parameters: params(reflection), returnType: typeText(reflection.signatures?.[0]?.type), sourceFile: sourceFile(reflection), sourceLine: reflection.sources?.[0]?.line ?? 0, documentationPage: `/api/generated/${group}/${reflection.name}`, exampleIds, interactiveExampleIds: exampleIds.filter(id => examplesById.get(id)?.execution !== 'static-node-only'), visibility: advancedSymbols.has(reflection.name) ? 'advanced' : 'stable' }
    items.push(item)
    for (const child of reflection.children ?? []) add(child, item)
  }
}
const root = data.children?.find((child: any) => child.name === 'index')
for (const reflection of root?.children ?? data.children ?? []) add(reflection)
items.sort((a, b) => `${a.kind}:${a.memberPath ?? a.publicSymbol}`.localeCompare(`${b.kind}:${b.memberPath ?? b.publicSymbol}`))
mkdirSync(resolve('docs/.generated'), { recursive: true })
mkdirSync(resolve('docs/api'), { recursive: true })
writeFileSync(resolve('docs/.generated/api-manifest.json'), `${JSON.stringify(items, null, 2)}\n`)
writeFileSync(resolve('docs/.generated/api-examples.json'), `${JSON.stringify(apiExampleModel.examples, null, 2)}\n`)
const groups = ['function', 'class', 'enum', 'variable', 'type', 'interface']
const labels: Record<string, string> = { function: 'Functions', class: 'Classes', enum: 'Enums', variable: 'Constants', type: 'Types', interface: 'Interfaces' }
const facadeDescriptions: Record<string, string> = {
  Beatmaps: 'Find and edit beatmap snapshots.',
  Sets: 'Find beatmap sets and their files.',
  Scores: 'Find scores by player, date, or beatmap.',
  Collections: 'Find named beatmap collections.',
  Rulesets: 'Find installed rulesets.',
  RulesetSettings: 'Read settings for each ruleset.',
  Skins: 'Find built-in and user skins.',
  Files: 'Find file records by hash.',
  Keybindings: 'Find key bindings.',
  ModPresets: 'Find saved mod presets.',
  Metadata: 'Search embedded beatmap metadata.',
}
const sidebar = [{ text: 'Overview', link: '/api/' }, { text: 'API catalog', link: '/api/catalog' }, { text: 'Database results', collapsed: false, items: facadeNames.map(name => ({ text: `${name}`, link: `/api/facades/${name}` })) }, { text: 'Advanced APIs', link: '/api/advanced' }, ...groups
  .map(kind => ({ text: `${labels[kind]}`, collapsed: false, items: items.filter(item => item.visibility === 'stable' && item.kind === kind && !item.memberPath && !facadeNames.includes(item.publicSymbol)).map(item => ({ text: item.publicSymbol, link: item.documentationPage })) }))
  .filter(group => group.items.length > 0)]
writeFileSync(resolve('docs/api/_generated-sidebar.json'), `${JSON.stringify(sidebar, null, 2)}\n`)
const catalog = ['<!-- Generated by tools/docs/generate-api-manifest.ts. Do not edit. -->', '# API catalog', '', 'The public declarations exported by `osu-files` are listed below. This is auto-generated.', '', '## Database results', '']
for (const name of facadeNames) catalog.push(`- [\`${name}\`](/api/facades/${name}) - ${facadeDescriptions[name]}`)
catalog.push('', '## Other public APIs', '')
for (const item of items.filter(item => item.visibility === 'stable' && !item.memberPath && !facadeNames.includes(item.publicSymbol))) catalog.push(`- [\`${item.memberPath ?? item.publicSymbol}\`](${item.documentationPage})${item.signature ? ` - Signature: \`${item.signature}\`` : ''}`)
writeFileSync(resolve('docs/api/catalog.md'), `${catalog.join('\n')}\n`)
console.log(`Generated ${items.length} API manifest items.`)
