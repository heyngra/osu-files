import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import * as ts from 'typescript'

type RunnerTypeFile = { uri: string; content: string }
type RunnerTypesManifest = { packageEntry: string; files: RunnerTypeFile[] }
type FacadeExample = { id: string; code: string; execution: string }
type ApiExample = { id: string; code: string; execution: string }

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/runner-types.json'), 'utf8')) as RunnerTypesManifest
const examples = JSON.parse(readFileSync(resolve(root, 'docs/.generated/facade-examples.json'), 'utf8')) as FacadeExample[]
const apiExamples = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-examples.json'), 'utf8')) as ApiExample[]
const homeDocumentation = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
const apiDocumentation = readFileSync(resolve(root, 'docs/api/index.md'), 'utf8')

function virtualPath(uri: string): string {
  return uri.replace(/^file:\/\//, '').replaceAll('\\', '/')
}

function documentationExample(source: string, name: string): string {
  const marker = `const ${name} = \``
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Could not find ${name} in documentation`)
  const contentStart = start + marker.length
  const end = source.indexOf('`', contentStart)
  assert.notEqual(end, -1, `Could not find the end of ${name} in documentation`)
  return source.slice(contentStart, end)
}

function createRunnerLanguageService(additionalFiles: Array<[string, string]> = []) {
  const files = new Map(manifest.files.map(file => [virtualPath(file.uri), file.content]))
  for (const [fileName, content] of additionalFiles) files.set(fileName, content)
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    skipLibCheck: true,
    allowSyntheticDefaultImports: true,
    baseUrl: '/',
    paths: {
      'osu-files': [virtualPath(manifest.packageEntry)],
      '@docs/fixture': ['/node_modules/@docs/fixture/index.d.ts'],
    },
    types: [],
  }

  const normalize = (fileName: string) => fileName.replaceAll('\\', '/')
  const defaultLibPath = ts.getDefaultLibFilePath(options)
  const systemPath = (fileName: string) => /^lib\..+\.d\.ts$/.test(fileName) ? join(dirname(defaultLibPath), fileName) : fileName
  const read = (fileName: string) => files.get(normalize(fileName)) ?? ts.sys.readFile(systemPath(fileName))
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [...files.keys()],
    getScriptVersion: fileName => files.has(normalize(fileName)) ? '1' : '0',
    getScriptSnapshot: fileName => {
      const content = read(fileName)
      return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content)
    },
    getCurrentDirectory: () => root,
    getDefaultLibFileName: optionsValue => ts.getDefaultLibFileName(optionsValue),
    fileExists: fileName => files.has(normalize(fileName)) || ts.sys.fileExists(systemPath(fileName)),
    readFile: read,
    readDirectory: (...args) => ts.sys.readDirectory(...args),
  }

  return { files, service: ts.createLanguageService(host, ts.createDocumentRegistry()) }
}

function messages(diagnostics: readonly ts.Diagnostic[]): string[] {
  return diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

function typeDisplay(service: ts.LanguageService, fileName: string, source: string, token: string): string {
  const declaration = source.indexOf(`const ${token}`)
  const position = declaration < 0 ? -1 : declaration + 'const '.length
  assert.notEqual(position, -1, `Could not find ${token} in the type probe`)
  const info = service.getQuickInfoAtPosition(fileName, position + Math.floor(token.length / 2))
  assert.ok(info, `No quick info for ${token}`)
  return ts.displayPartsToString(info.displayParts)
}

describe('documentation runner declarations', () => {
  it('uses generated package declarations and typed Realm support', () => {
    assert.equal(manifest.files.some(file => file.uri === 'file:///docs/osu-files-module.d.ts'), false)
    const externals = manifest.files.find(file => file.uri === 'file:///node_modules/osu-files/externals.d.ts')
    assert.ok(externals)
    assert.match(externals.content, /namespace BSON/)
    assert.match(externals.content, /class UUID/)
    assert.match(externals.content, /class Object/)
  })

  it('type-checks every generated browser example', () => {
    const browserExamples = examples.filter(item => item.execution === 'interactive-fixture')
    const documentationExamples: Array<[string, string]> = [
      ['/docs/examples/home-parse-beatmap-metadata.ts', documentationExample(homeDocumentation, 'homeExample')],
      ['/docs/examples/api-working-with-results.ts', documentationExample(apiDocumentation, 'workingWithResults')],
      ['/docs/examples/api-editing-results.ts', documentationExample(apiDocumentation, 'editingResults')],
    ]
    const { service } = createRunnerLanguageService([
      ...browserExamples.map(example => [`/docs/examples/${example.id}.ts`, example.code] as [string, string]),
      ...documentationExamples,
    ])
    for (const example of browserExamples) {
      const fileName = `/docs/examples/${example.id}.ts`
      const diagnostics = [
        ...service.getSyntacticDiagnostics(fileName),
        ...service.getSemanticDiagnostics(fileName),
      ].filter(diagnostic => diagnostic.code !== 1108)
      assert.deepEqual(messages(diagnostics), [], `${example.id} has TypeScript diagnostics`)
    }
  })

  it('type-checks every generated API reference example', () => {
    const { files, service } = createRunnerLanguageService(
      apiExamples.map(example => [`/docs/api-examples/${example.id}.ts`, example.code] as [string, string]),
    )
    const failures: string[] = []
    for (const example of apiExamples) {
      const fileName = `/docs/api-examples/${example.id}.ts`
      const diagnostics = [
        ...service.getSyntacticDiagnostics(fileName),
        ...service.getSemanticDiagnostics(fileName),
      ].filter(diagnostic => diagnostic.code !== 1108)
      const diagnosticMessages = messages(diagnostics)
      if (diagnosticMessages.length) failures.push(`${example.id}: ${diagnosticMessages.join(' | ')}`)
    }
    assert.deepEqual(failures, [])
    assert.ok(files.size > apiExamples.length)
  })

  it('keeps facade, nested property, UUID, and edit-session types precise', () => {
    const { files, service } = createRunnerLanguageService()
    const fileName = '/docs/examples/type-fidelity.ts'
    const source = `const maps = db.beatmaps.get.byTitle('Make A Move')
const first = maps.first()
const title = first?.Metadata?.Title
const id = first?.ID
const session = db.beatmaps.get.limit(1).autoEdit()
const length = session.length
const sets = db.sets.get
const scores = db.scores.get
const collections = db.collections.get
const rulesets = db.rulesets.get
const rulesetSettings = db.rulesetSettings.get
const skins = db.skins.get
const filesResult = db.files.get
const keybindings = db.keybindings.get
const modPresets = db.modpresets.get
const metadata = db.metadata.get
const invalid = db.beatmaps.get.map(item => item.notARealField)
return { maps, first, title, id, length, sets, scores, collections, rulesets, rulesetSettings, skins, filesResult, keybindings, modPresets, metadata, invalid }`
    files.set(fileName, source)

    const diagnostics = [
      ...service.getSyntacticDiagnostics(fileName),
      ...service.getSemanticDiagnostics(fileName),
    ].filter(diagnostic => diagnostic.code !== 1108)
    const diagnosticMessages = messages(diagnostics)
    assert.ok(diagnosticMessages.some(message => message.includes("Property 'notARealField' does not exist")), diagnosticMessages.join('\n'))
    assert.equal(diagnostics.filter(diagnostic => diagnostic.code !== 2339).length, 0, diagnosticMessages.join('\n'))

    assert.match(typeDisplay(service, fileName, source, 'maps'), /Beatmaps/)
    assert.doesNotMatch(typeDisplay(service, fileName, source, 'maps'), /\bany\b/)
    assert.match(typeDisplay(service, fileName, source, 'title'), /string \| undefined/)
    assert.doesNotMatch(typeDisplay(service, fileName, source, 'title'), /\bany\b/)
    assert.match(typeDisplay(service, fileName, source, 'id'), /BSON\.UUID/)
    assert.match(typeDisplay(service, fileName, source, 'length'), /number/)
    for (const facade of ['Sets', 'Scores', 'Collections', 'Rulesets', 'RulesetSettings', 'Skins', 'Files', 'Keybindings', 'ModPresets', 'Metadata']) {
      const variable = facade === 'Files' ? 'filesResult' : facade.charAt(0).toLowerCase() + facade.slice(1)
      assert.match(typeDisplay(service, fileName, source, variable), new RegExp(`\\b${facade}\\b`))
      assert.doesNotMatch(typeDisplay(service, fileName, source, variable), /\bany\b/)
    }
  })
})
