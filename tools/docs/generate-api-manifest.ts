import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apiExcludes } from './api-excludes.js'

type Item = {
  publicSymbol: string; kind: string; memberPath?: string; importPath: 'osu-files'; signature?: string
  parameters?: Array<{ name: string; type: string; optional: boolean; defaultValue?: string }>; returnType?: string
  sourceFile: string; sourceLine: number; documentationPage: string; interactiveExampleIds: string[]
}

const data = JSON.parse(readFileSync(resolve('docs/.generated/typedoc.json'), 'utf8'))
const examples: Record<string, string[]> = { parseOsu: ['parse-osu-basic', 'serialize-osu-roundtrip'], serializeOsu: ['serialize-osu-roundtrip'], FileRef: ['storyboard-sprite'], StoryboardSprite: ['storyboard-sprite'], Anchor: ['storyboard-sprite'] }
const kindNames: Record<number, string> = { 8: 'enum', 16: 'enum-member', 32: 'variable', 64: 'function', 128: 'class', 256: 'interface', 512: 'constructor', 1024: 'property', 2048: 'method', 2097152: 'type' }
const category: Record<string, string> = { function: 'functions', class: 'classes', enum: 'enumerations', variable: 'variables', interface: 'interfaces', type: 'type-aliases' }
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
  const kind = kindNames[reflection.kind]
  if (!kind || kind === 'enum-member' || kind === 'constructor' || kind === 'method' || kind === 'property') {
    if (parent && kind) {
      const item: Item = { publicSymbol: reflection.name, kind, memberPath: `${parent.memberPath ?? parent.publicSymbol}.${reflection.name}`, importPath: 'osu-files', signature: signatureText(reflection), parameters: params(reflection), returnType: typeText(reflection.signatures?.[0]?.type), sourceFile: sourceFile(reflection, parent.sourceFile), sourceLine: reflection.sources?.[0]?.line ?? parent.sourceLine, documentationPage: `${parent.documentationPage}${memberAnchor(kind, reflection.name)}`, interactiveExampleIds: examples[reflection.name] ?? [] }
      items.push(item)
    }
  } else {
    const group = category[kind] ?? 'types'
    const item: Item = { publicSymbol: reflection.name, kind, importPath: 'osu-files', signature: signatureText(reflection), parameters: params(reflection), returnType: typeText(reflection.signatures?.[0]?.type), sourceFile: sourceFile(reflection), sourceLine: reflection.sources?.[0]?.line ?? 0, documentationPage: `/api/generated/${group}/${reflection.name}`, interactiveExampleIds: examples[reflection.name] ?? [] }
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
const groups = ['function', 'class', 'enum', 'variable', 'type', 'interface']
const labels: Record<string, string> = { function: 'Functions', class: 'Classes', enum: 'Enums', variable: 'Constants', type: 'Types', interface: 'Interfaces' }
const sidebar = [{ text: 'Overview', link: '/api/' }, { text: 'Catalog', link: '/api/catalog' }, ...groups.map(kind => ({ text: labels[kind], collapsed: false, items: items.filter(item => item.kind === kind && !item.memberPath).map(item => ({ text: item.publicSymbol, link: item.documentationPage })) }))]
writeFileSync(resolve('docs/api/_generated-sidebar.json'), `${JSON.stringify(sidebar, null, 2)}\n`)
const catalog = ['<!-- Generated by tools/docs/generate-api-manifest.ts. Do not edit. -->', '# API catalog', '', 'Every declaration below is exported from `osu-files`.', '']
for (const item of items) catalog.push(`- [\`${item.memberPath ?? item.publicSymbol}\`](${item.documentationPage}) — ${item.kind}${item.signature ? ` — \`${item.signature}\`` : ''}`)
writeFileSync(resolve('docs/api/catalog.md'), `${catalog.join('\n')}\n`)
console.log(`Generated ${items.length} API manifest items.`)
