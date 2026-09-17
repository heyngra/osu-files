import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import init, { CURRENT_SCHEMA_VERSION } from '../../dist/index.js'
import * as nativeApi from '../../dist/index.js'
import * as browserApi from '../../docs/.vitepress/pure-api.js'
import { serializeOutput } from '../../docs/.vitepress/runner/output.js'
import { createFixtureDatabase, type FixtureDatabaseData } from '../../docs/.vitepress/runner/fixture-db.js'
import { transformExample } from '../../docs/.vitepress/runner/import-transformer.js'
import { seedRealmFixture } from './facade-realm-fixture.js'
import type { ApiExample } from './api-example-model.js'

type DocumentationFixture = {
  source: string
  storyboardSource: string
  osbSource: string
  skinIniSource: string
  beatmaps: Array<{ osuText: string }>
  files: Array<{ filename: string; hash: string }>
  database: FixtureDatabaseData
}

type ApiManifest = Array<{
  publicSymbol: string
  memberPath?: string
  exampleIds: string[]
  documentationPage: string
}>

type ExampleArtifact = ApiExample & { output?: string }

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(file), 'utf8')) as T
}

function canonicalize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined) return { type: 'undefined' }
  if (value === null || typeof value !== 'object') return value
  if (seen.has(value)) return { type: 'circular' }
  seen.add(value)
  if (value instanceof Date) return { type: 'date', value: value.toISOString() }
  if (value instanceof Uint8Array) return { type: 'bytes', value: Array.from(value) }
  if (typeof (value as { toHexString?: unknown }).toHexString === 'function') {
    return { type: 'uuid', value: (value as { toHexString(includeDashes?: boolean): string }).toHexString(true).toLowerCase() }
  }
  if (value instanceof Map) {
    return { type: 'map', value: [...value.entries()].map(([key, item]) => [canonicalize(key, seen), canonicalize(item, seen)]) }
  }
  if (value instanceof Set) return { type: 'set', value: [...value].map(item => canonicalize(item, seen)) }
  if (Array.isArray(value)) return value.map(item => canonicalize(item, seen))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item, seen)]),
  )
}

function canonical(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) ?? String(value)
}

function compactOutput(value: unknown, example: ApiExample): string {
  const output = serializeOutput(value)
  if (output.length > 20_000) throw new Error(`Example ${example.id} returned too much data; add a compact projection.`)
  if (output.includes('[Circular]')) throw new Error(`Example ${example.id} returned a circular value; add a compact projection.`)
  return output
}

function bindingsFor(
  example: ApiExample,
  api: Record<string, unknown>,
  fixture: DocumentationFixture,
  db: unknown,
): { names: string[]; values: unknown[] } {
  const transformed = transformExample(example.code)
  const bindings = new Map<string, unknown>()
  for (const name of transformed.names) {
    if (name === 'fixture') bindings.set(name, fixture)
    else if (!(name in api)) throw new Error(`Example ${example.id} imports unsupported export ${name}`)
    else bindings.set(name, api[name])
  }
  if (example.execution === 'interactive-fixture') bindings.set('db', db)
  for (const [name, value] of Object.entries(fixture)) if (!bindings.has(name)) bindings.set(name, value)
  const names = [...bindings.keys()]
  return { names, values: names.map(name => bindings.get(name)) }
}

async function execute(
  example: ApiExample,
  api: Record<string, unknown>,
  fixture: DocumentationFixture,
  db: unknown,
): Promise<unknown> {
  const transformed = transformExample(example.code)
  const { names, values } = bindingsFor(example, api, fixture, db)
  const run = new Function(...names, `return (async () => {\n${transformed.code}\n})()`)
  return run(...values)
}

async function verifyBrowser(example: ApiExample, fixture: DocumentationFixture): Promise<{ value: unknown; output: string }> {
  try {
    const db = example.execution === 'interactive-fixture' ? createFixtureDatabase(fixture.database) : undefined
    const value = await execute(example, browserApi as Record<string, unknown>, fixture, db)
    return { value, output: compactOutput(value, example) }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not run browser example ${example.id}: ${message}\n${example.code}`, { cause })
  }
}

async function verifyNative(example: ApiExample, fixture: DocumentationFixture): Promise<unknown> {
  const workdir = mkdtempSync(join(tmpdir(), `osu-files-api-${example.id}-`))
  const realmPath = join(workdir, 'client.realm')
  const filesPath = join(workdir, 'files')
  mkdirSync(filesPath, { recursive: true })
  const db = example.execution === 'interactive-fixture'
    ? init(realmPath, { schemaVersion: CURRENT_SCHEMA_VERSION, filesFolderPath: filesPath, rollback: false })
    : undefined
  try {
    if (db) seedRealmFixture(db.realm.raw, fixture.database)
    return await execute(example, nativeApi as Record<string, unknown>, fixture, db)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not run native example ${example.id}: ${message}\n${example.code}`, { cause })
  } finally {
    db?.close()
    rmSync(workdir, { recursive: true, force: true })
  }
}

function pageFile(documentationPage: string): string {
  return resolve('docs', `${documentationPage.split('#')[0].replace(/^\//, '')}.md`)
}

function removeExistingExamples(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const result: string[] = []
  let skipping = false
  let exampleLevel = 0
  for (const line of lines) {
    if (!skipping && line.trim() === '## Examples') break
    const heading = line.trim().match(/^(#{2,6})\s+(.+)$/)
    if (!skipping && heading && /^Examples?$/.test(heading[2])) {
      skipping = true
      exampleLevel = heading[1].length
      continue
    }
    if (skipping && heading && heading[1].length <= exampleLevel) {
      skipping = false
      result.push(line)
      continue
    }
    if (skipping && line.trim() === '***') {
      skipping = false
      continue
    }
    if (!skipping) result.push(line)
  }
  return result.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')
}

function removeGeneratedSetup(markdown: string): string {
  return markdown.replace(/<script setup lang="ts">\nimport PromotableExample from '[^']+'\n<\/script>\n*/g, '')
}

function removeGeneratedFrontmatter(markdown: string): string {
  return markdown.replace(/^---\noutline:\n  level: \[2, 3\]\n---\n*/g, '')
}

function removeGeneratedInlineExamples(markdown: string): string {
  return markdown.replace(/(?:^|\n)<!-- api-example:[^>]+ -->[\s\S]*?<!-- \/api-example:[^>]+ -->\n?/g, '\n')
}

function removeGeneratedBlocks(markdown: string): string {
  return markdown.replace(/(?:^|\n)### [^\n]+\n\n(?:[^\n]+\n\n)?<PromotableExample\b[\s\S]*?<\/PromotableExample>\n?/g, '\n')
}

function relativeComponentImport(file: string): string {
  const docsRoot = resolve('docs')
  const directory = dirname(file)
  const depth = relative(docsRoot, directory).split(/[\\/]/).filter(Boolean).length
  return `${'../'.repeat(depth)}.vitepress/components/PromotableExample.vue`
}

function vueExpression(value: string): string {
  return JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;')
}

function renderExample(example: ExampleArtifact): string[] {
  const output = example.output ?? ''
  return [
    `<!-- api-example:${example.id} -->`,
    ...(example.execution === 'static-node-only' ? ['This example requires Node.js.', ''] : []),
    `<PromotableExample id="${example.id}" execution="${example.execution}" fixture="${example.fixture ?? 'realm-docs'}" :code='${vueExpression(example.code)}' :output='${vueExpression(output)}'>`,
    '```ts',
    example.code,
    '```',
    '</PromotableExample>',
    `<!-- /api-example:${example.id} -->`,
    '',
  ]
}

function findMemberInsertionIndex(lines: string[], anchor: string, page: string): number {
  const anchorLine = lines.findIndex(line => line.trim() === `<a id="${anchor}"></a>`)
  if (anchorLine < 0) throw new Error(`Could not locate API member anchor ${anchor} on ${page}`)

  for (let index = anchorLine + 1; index < lines.length; index++) {
    const line = lines[index].trim()
    if (line === '***' || /^<a id="[^"]+"><\/a>$/.test(line) || /^## /.test(line)) return index
  }
  return lines.length
}

function findDeclarationInsertionIndex(lines: string[]): number {
  const index = lines.findIndex((line, lineNumber) => lineNumber > 0 && /^## /.test(line.trim()))
  return index < 0 ? lines.length : index
}

function insertAt(lines: string[], index: number, content: string[]): void {
  lines.splice(index, 0, '', ...content, '')
}

function renderPage(file: string, markdown: string, examples: ExampleArtifact[]): string {
  const body = removeExistingExamples(removeGeneratedInlineExamples(removeGeneratedBlocks(removeGeneratedSetup(removeGeneratedFrontmatter(markdown)))))
  const importPath = relativeComponentImport(file)
  const header = `<script setup lang="ts">\nimport PromotableExample from '${importPath}'\n</script>\n\n`
  const lines = body.split('\n')
  const insertions: Array<{ index: number; content: string[] }> = []
  const memberExamples = new Map<string, ExampleArtifact[]>()
  const declarationExamples: ExampleArtifact[] = []

  for (const example of examples) {
    if (example.placement.kind === 'member') {
      const current = memberExamples.get(example.placement.anchor) ?? []
      current.push(example)
      memberExamples.set(example.placement.anchor, current)
    } else {
      declarationExamples.push(example)
    }
  }

  for (const [anchor, memberGroup] of memberExamples) {
    insertions.push({
      index: findMemberInsertionIndex(lines, anchor, file),
      content: memberGroup.flatMap(renderExample),
    })
  }
  if (declarationExamples.length) {
    insertions.push({
      index: findDeclarationInsertionIndex(lines),
      content: declarationExamples.flatMap(renderExample),
    })
  }

  for (const insertion of insertions.sort((left, right) => right.index - left.index))
    insertAt(lines, insertion.index, insertion.content)

  return `---\noutline:\n  level: [2, 3]\n---\n\n${header}${lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '')}\n`
}

async function main(): Promise<void> {
  const fixture = readJson<DocumentationFixture>('docs/public/fixtures/realm-docs.json')
  const examples = readJson<ExampleArtifact[]>('docs/.generated/api-examples.json')
  const manifest = readJson<ApiManifest>('docs/.generated/api-manifest.json')
  const runnable = examples.filter(example => example.execution !== 'static-node-only')
  const outputs = new Map<string, string>()

  for (const [index, example] of runnable.entries()) {
    const browser = await verifyBrowser(example, fixture)
    const nativeValue = await verifyNative(example, fixture)
    if (canonical(nativeValue) !== canonical(browser.value)) {
      throw new Error(`Native and browser outputs differ for ${example.id}\nNative:\n${canonical(nativeValue)}\nBrowser:\n${canonical(browser.value)}\n${example.code}`)
    }
    outputs.set(example.id, browser.output)
    if ((index + 1) % 50 === 0) console.log(`Verified ${index + 1}/${runnable.length} runnable API examples.`)
  }

  const verified = examples.map(example => outputs.has(example.id) ? { ...example, output: outputs.get(example.id) } : example)
  writeFileSync(resolve('docs/.generated/api-examples.json'), `${JSON.stringify(verified, null, 2)}\n`)

  const byPage = new Map<string, ExampleArtifact[]>()
  for (const example of verified) {
    const page = example.documentationPage.split('#')[0]
    ;(byPage.get(page) ?? (byPage.set(page, []), byPage.get(page)!)).push(example)
  }
  for (const [page, pageExamples] of byPage) {
    const file = pageFile(page)
    writeFileSync(file, renderPage(file, readFileSync(file, 'utf8'), pageExamples))
  }

  const missing = manifest.filter(item => item.exampleIds.length === 0 && !item.memberPath)
  if (missing.length) throw new Error(`Missing API examples: ${missing.map(item => item.publicSymbol).join(', ')}`)
  console.log(`Verified and rendered ${verified.length} API examples (${runnable.length} runnable).`)
}

await main()
process.exit(0)
