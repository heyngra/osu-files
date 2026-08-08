import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import init, { CURRENT_SCHEMA_VERSION } from '../../src/index.js'
import {
  createDocumentationDatabaseFixture,
  createFixtureDatabase,
  fixtureMethodDescriptors,
  type FixtureDatabaseData,
} from '../../docs/.vitepress/runner/fixture-db.js'
import { seedRealmFixture } from './facade-realm-fixture.js'

export const facadeDefinitions = [
  { name: 'Beatmaps', path: 'db.beatmaps.get', sortField: 'BPM', patch: '{ Hidden: true }', noun: 'beatmaps' },
  { name: 'Sets', path: 'db.sets.get', sortField: 'DateAdded', patch: '{ Status: 1 }', noun: 'beatmap sets' },
  { name: 'Scores', path: 'db.scores.get', sortField: 'Date', patch: '{ PP: 0 }', noun: 'scores' },
  { name: 'Collections', path: 'db.collections.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'collections' },
  { name: 'Rulesets', path: 'db.rulesets.get', sortField: 'Name', patch: '{ Available: true }', noun: 'rulesets' },
  { name: 'RulesetSettings', path: 'db.rulesetSettings.get', sortField: 'Key', patch: "{ Value: 'Example' }", noun: 'ruleset settings' },
  { name: 'Skins', path: 'db.skins.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'skins' },
  { name: 'Files', path: 'db.files.get', sortField: 'Hash', patch: null, noun: 'files' },
  { name: 'Keybindings', path: 'db.keybindings.get', sortField: 'Action', patch: "{ KeyCombination: 'Z' }", noun: 'keybindings' },
  { name: 'ModPresets', path: 'db.modpresets.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'mod presets' },
  { name: 'Metadata', path: 'db.metadata.get', sortField: 'Title', patch: "{ Title: 'Example' }", noun: 'metadata records' },
] as const

const writableFacades = new Set(['Beatmaps', 'Sets', 'Scores', 'Collections', 'Rulesets', 'Skins', 'Files', 'Keybindings', 'ModPresets'])

type Reflection = {
  name: string
  kind?: number
  children?: Reflection[]
  signatures?: Array<{ parameters?: Array<{ name: string; type?: unknown; flags?: { isOptional?: boolean } }> }>
}

export type FacadeExample = {
  id: string
  facade: string
  method: string
  description: string
  code: string
  execution: 'interactive-fixture'
  fixture: 'realm-docs'
  output?: string
}

function typeText(type: any): string {
  if (!type) return 'unknown'
  if (type.type === 'intrinsic' || type.type === 'reference') return type.name ?? 'unknown'
  if (type.type === 'array') return `${typeText(type.elementType)}[]`
  if (type.type === 'union') return type.types.map(typeText).join(' | ')
  return type.name ?? type.type ?? 'unknown'
}

function readableWords(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\bid\b/g, 'ID')
    .replaceAll('online id', 'online ID')
    .replaceAll('md5', 'MD5')
    .replaceAll('bpm', 'BPM')
    .replaceAll('pp', 'PP')
}

function readableFilter(method: string): string {
  return readableWords(method.slice(2))
}

function filterDescription(method: string): string {
  const value = readableFilter(method)
  if (value.endsWith(' contains')) return `where ${value.slice(0, -9)} contains the supplied value`
  if (value.endsWith(' above')) return `where ${value.slice(0, -6)} is above the supplied value`
  if (value.endsWith(' below')) return `where ${value.slice(0, -6)} is below the supplied value`
  if (value.endsWith(' between')) return `where ${value.slice(0, -8)} is between the supplied bounds`
  if (value.endsWith(' before')) return `where ${value.slice(0, -7)} is before the supplied date`
  if (value.endsWith(' after')) return `where ${value.slice(0, -6)} is after the supplied date`
  return `where ${value} matches the supplied value`
}

function methodReflections(data: any, facade: string): Reflection[] {
  const root = data.children ?? []
  const reflection = root.find((item: Reflection) => item.name === facade)
  const declaration = reflection?.type?.type === 'intersection'
    ? reflection.type.types.find((type: any) => type.type === 'reflection')?.declaration
    : reflection?.type?.declaration
  return (declaration?.children ?? []).filter((item: Reflection) => item.kind === 2048)
}

function parameterValues(facade: string, method: string, parameters: Array<{ name: string; type?: unknown }>): string[] {
  const descriptor = fixtureMethodDescriptors[facade]?.[method]
  if (!descriptor) throw new Error(`Missing browser fixture descriptor for ${facade}.${method}`)
  if (descriptor.sample.length !== parameters.length)
    throw new Error(`Fixture descriptor for ${facade}.${method} has ${descriptor.sample.length} arguments, expected ${parameters.length}`)
  return descriptor.sample.map(item => item.code)
}

function summaryCode(facade: typeof facadeDefinitions[number]): string {
  const summaries: Record<string, string> = {
    Beatmaps: `item => ({
    title: item.Metadata?.Title,
    difficulty: item.DifficultyName,
  })`,
    Sets: `item => ({
    onlineId: item.OnlineID,
    files: item.Files.length,
  })`,
    Scores: `item => ({
    pp: item.PP,
    accuracy: item.Accuracy,
    username: item.User?.Username,
  })`,
    Collections: `item => ({
    name: item.Name,
    beatmaps: item.BeatmapMD5Hashes.length,
  })`,
    Rulesets: `item => ({
    shortName: item.ShortName,
    name: item.Name,
  })`,
    RulesetSettings: `item => ({
    key: item.Key,
    value: item.Value,
  })`,
    Skins: `item => ({
    name: item.Name,
    creator: item.Creator,
  })`,
    Files: `item => ({
    hash: item.Hash,
  })`,
    Keybindings: `item => ({
    ruleset: item.RulesetName,
    action: item.Action,
    key: item.KeyCombination,
  })`,
    ModPresets: `item => ({
    name: item.Name,
    mods: item.Mods,
  })`,
    Metadata: `item => ({
    title: item.Title,
    artist: item.Artist,
  })`,
  }
  return summaries[facade.name]
}

function firstField(facade: typeof facadeDefinitions[number]): string {
  return {
    Beatmaps: 'Metadata?.Title', Sets: 'OnlineID', Scores: 'PP', Collections: 'Name', Rulesets: 'Name', RulesetSettings: 'Key',
    Skins: 'Name', Files: 'Hash', Keybindings: 'KeyCombination', ModPresets: 'Name', Metadata: 'Title',
  }[facade.name]
}

function methodDescription(facade: typeof facadeDefinitions[number], method: string): string {
  if (method === 'all') return `Returns all matching ${facade.noun} in a regular array.`
  if (method === 'toArray') return `Returns all matching ${facade.noun} in a regular array.`
  if (method === 'first') return `Returns the first matching ${facade.noun.slice(0, -1)}, or undefined.`
  if (method === 'count') return `Counts all matching ${facade.noun}, even when a limit is set.`
  if (method === 'limit') return `Limits how many ${facade.noun} elements are accessed.`
  if (method === 'sortedBy') return `Sorts ${facade.noun} by a database field.`
  if (method === 'autoEdit') return `Starts an edit session that buffers changes to matching ${facade.noun}. Commit or roll them back when you are done.`
  if (method === 'commit') return 'Saves the pending changes.'
  if (method === 'rollback') return 'Discards the pending changes.'
  if (method === 'write.update') return `Applies a typed patch to every matching ${facade.noun.slice(0, -1)}.`
  if (method === 'write.delete') return `Deletes every matching ${facade.noun.slice(0, -1)} in one transaction.`
  if (method === 'usable') return 'Returns skins that are available for use.'
  if (method === 'builtIn') return 'Returns the built-in skins in osu! order.'
  if (method === 'user') return 'Returns user-created skins that are not marked for deletion.'
  if (method.startsWith('by')) return `Finds ${facade.noun} ${filterDescription(method)}. You can chain more filters on the result.`
  if (method.startsWith('with')) return `Finds ${facade.noun} related to the supplied ${readableWords(method.slice(4))}.`
  if (method.startsWith('sorted')) return `Returns ${facade.noun} ordered by ${readableWords(method.slice(8))}.`
  return `Uses ${method} on the ${facade.noun} results.`
}

function methodCode(facade: typeof facadeDefinitions[number], method: string, reflection?: Reflection): string | undefined {
  const path = facade.path
  const parameters = reflection?.signatures?.[0]?.parameters ?? []
  const args = parameterValues(facade.name, method, parameters).join(', ')
  const call = `${path}\n  .${method}(${method === 'limit' && parameters.length === 0 ? '1' : args})`
  const summary = summaryCode(facade)
  const mapped = `return ${call}\n  .map(${summary})`

  if (method === 'all' || method === 'toArray') return mapped
  if (method === 'first') return `return ${call}?.${firstField(facade)}`
  if (method === 'count') return `return ${call}`
  if (method === 'sortedBy') return `return ${path}\n  .sortedBy('${facade.sortField}')\n  .map(${summary})`
  if (method === 'autoEdit') return `const session = ${path}\n  .limit(1)\n  .autoEdit()\nconst length = session.length\nsession.rollback()\nreturn length`
  if (method === 'commit' || method === 'rollback') return `const session = ${path}\n  .limit(1)\n  .autoEdit()\nconst length = session.length\nsession.${method}()\nreturn length`
  if (method === 'write.delete') return `return ${path}\n  .limit(1)\n  .write.delete()`
  if (method === 'write.update') return facade.patch ? `return ${path}\n  .limit(1)\n  .write.update(${facade.patch})` : undefined
  return mapped
}

function commonMethods(facade: typeof facadeDefinitions[number]): Array<{ method: string; code: string }> {
  const result: Array<{ method: string; code: string }> = []
  for (const method of ['all', 'toArray', 'first', 'count', 'limit', 'sortedBy'] as const) {
    const code = methodCode(facade, method)
    if (code) result.push({ method, code })
  }
  if (writableFacades.has(facade.name)) {
    for (const method of ['autoEdit', 'commit', 'rollback', 'write.delete'] as const) {
      const code = methodCode(facade, method)
      if (code) result.push({ method, code })
    }
  }
  if (writableFacades.has(facade.name) && facade.patch) {
    const code = methodCode(facade, 'write.update')
    if (code) result.push({ method: 'write.update', code })
  }
  return result
}

function assertFixtureCoverage(facade: string, method: string): void {
  if (!fixtureMethodDescriptors[facade]?.[method])
    throw new Error(`Missing browser fixture descriptor for ${facade}.${method}`)
}

export function buildFacadeExamples(data: any): FacadeExample[] {
  const examples: FacadeExample[] = []
  for (const facade of facadeDefinitions) {
    for (const common of commonMethods(facade)) {
      examples.push({ id: `facade-${facade.name}-${common.method.replace('.', '-')}`, facade: facade.name, method: common.method, description: methodDescription(facade, common.method), code: common.code, execution: 'interactive-fixture', fixture: 'realm-docs' })
    }
    for (const reflection of methodReflections(data, facade.name)) {
      assertFixtureCoverage(facade.name, reflection.name)
      const code = methodCode(facade, reflection.name, reflection)
      if (!code) continue
      examples.push({ id: `facade-${facade.name}-${reflection.name}`, facade: facade.name, method: reflection.name, description: methodDescription(facade, reflection.name), code, execution: 'interactive-fixture', fixture: 'realm-docs' })
    }
  }
  return examples
}

function serialize(value: unknown): string {
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, (_key, item) => {
      if (item instanceof Date) return item.toISOString()
      if (item && typeof item === 'object' && typeof (item as { toHexString?: unknown }).toHexString === 'function') return (item as { toHexString(): string }).toHexString()
      return item
    }, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return { type: 'undefined' }
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return { type: 'date', value: new Date(value).toISOString() }
    return value
  }
  if (value instanceof Date) return { type: 'date', value: value.toISOString() }
  if (typeof (value as { toHexString?: unknown }).toHexString === 'function') {
    const raw = (value as { toHexString(includeDashes?: boolean): string }).toHexString(true)
    return { type: 'uuid', value: raw.replaceAll('-', '').toLowerCase() }
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalize(item)]))
}

function canonical(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2) ?? String(value)
}

async function runExample(example: FacadeExample, db: unknown): Promise<unknown> {
  const run = new Function('db', `return (async () => {\n${example.code}\n})()`)
  return run(db)
}

async function verifyAgainstRealm(example: FacadeExample, fixture: FixtureDatabaseData): Promise<string> {
  const workdir = mkdtempSync(join(tmpdir(), `osu-files-doc-${example.id}-`))
  const realmPath = join(workdir, 'client.realm')
  const filesPath = join(workdir, 'files')
  mkdirSync(filesPath, { recursive: true })
  const db = init(realmPath, { schemaVersion: CURRENT_SCHEMA_VERSION, filesFolderPath: filesPath, rollback: false })
  try {
    seedRealmFixture(db.realm.raw, fixture)
    return serialize(await runExample(example, db))
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not check ${example.id}: ${message}\n${example.code}`, { cause })
  } finally {
    db.close()
    rmSync(workdir, { recursive: true, force: true })
  }
}

async function verifyAgainstBrowserAdapter(example: FacadeExample, fixture: FixtureDatabaseData): Promise<string> {
  try {
    return serialize(await runExample(example, createFixtureDatabase(fixture)))
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not run browser fixture for ${example.id}: ${message}\n${example.code}`, { cause })
  }
}

export async function verify(example: FacadeExample, fixture: FixtureDatabaseData): Promise<string> {
  const [nativeOutput, browserOutput] = await Promise.all([
    verifyAgainstRealm(example, fixture),
    verifyAgainstBrowserAdapter(example, fixture),
  ])
  if (canonical(nativeOutput) !== canonical(browserOutput))
    throw new Error(`Fixture output differs for ${example.id}\nNative:\n${nativeOutput}\nBrowser:\n${browserOutput}\n${example.code}`)
  return browserOutput
}

function vueExpression(value: string): string {
  return JSON.stringify(value).replaceAll('&', '&amp;').replaceAll("'", '&#39;')
}

function renderPage(facade: typeof facadeDefinitions[number], examples: FacadeExample[]): string {
  const entries = examples.filter(example => example.facade === facade.name)
  const lines = [
    '<script setup lang="ts">',
    "import PromotableExample from '../../.vitepress/components/PromotableExample.vue'",
    '</script>',
    '',
    `# ${facade.name}`,
    '',
    `\`${facade.path}\` returns read-only snapshots for ${facade.noun}. You can keep chaining filters or use normal array methods.`,
    '',
    'These examples use a small fixture that resets for every run. Your application still uses its own Realm database.',
    '',
  ]
  for (const example of entries) {
    lines.push(
      `## ${example.method}`,
      '',
      example.description,
      '',
      `<PromotableExample id="${example.id}" execution="${example.execution}" fixture="${example.fixture}" :code='${vueExpression(example.code)}' :output='${vueExpression(example.output ?? '')}'>`,
      '```ts',
      example.code,
      '```',
      '</PromotableExample>',
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

export async function generateFacadePages(data: any): Promise<FacadeExample[]> {
  const fixture = createDocumentationDatabaseFixture()
  const examples = buildFacadeExamples(data)
  for (const example of examples) example.output = await verify(example, fixture)
  const outputDir = resolve('docs/api/facades')
  mkdirSync(outputDir, { recursive: true })
  for (const facade of facadeDefinitions)
    writeFileSync(join(outputDir, `${facade.name}.md`), renderPage(facade, examples.filter(example => example.facade === facade.name)))
  mkdirSync(resolve('docs/.generated'), { recursive: true })
  writeFileSync(resolve('docs/.generated/facade-examples.json'), `${JSON.stringify(examples, null, 2)}\n`)
  return examples
}
