import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

type RunnerTypeFile = { uri: string; content: string }
type RunnerTypesManifest = { packageEntry: string; files: RunnerTypeFile[] }

const root = process.cwd()
const dist = join(root, 'dist')
const output = join(root, 'docs', '.generated', 'runner-types.json')

async function declarationFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await declarationFiles(path))
    else if (entry.name.endsWith('.d.ts')) files.push(path)
  }
  return files
}

function normalize(content: string) {
  return content.replace(/(from\s+['"]|import\s*\(\s*['"])([^'"]+?)\.js(['"])/g, '$1$2.d.ts$3')
}

const files: RunnerTypeFile[] = []
for (const file of (await declarationFiles(dist)).sort()) {
  const name = relative(dist, file).split(sep).join('/')
  files.push({
    uri: `file:///node_modules/osu-files/${name}`,
    content: normalize(await readFile(file, 'utf8')),
  })
}

files.push({
  uri: 'file:///node_modules/@docs/fixture/index.d.ts',
  content: `declare const fixture: DocumentationFixture\n\nexport interface DocumentationFixture {\n  source: string\n  storyboardSource: string\n  osbSource: string\n  skinIniSource: string\n  beatmaps: Array<{ osuText: string }>\n  files: Array<{ filename: string; hash: string }>\n  database: Record<string, Array<Record<string, unknown>>>\n}\nexport default fixture\n`,
})
files.push({
  uri: 'file:///docs/fixture-global.d.ts',
  content: `interface DocumentationFixture {
  source: string
  storyboardSource: string
  osbSource: string
  skinIniSource: string
  beatmaps: Array<{ osuText: string }>
  files: Array<{ filename: string; hash: string }>
  database: Record<string, Array<Record<string, unknown>>>
}
type DocumentationDatabase = {
  beatmaps: Pick<import('osu-files').BeatmapModule, 'get'>
  sets: Pick<import('osu-files').BeatmapSetModule, 'get'>
  scores: Pick<import('osu-files').ScoreModule, 'get'>
  collections: Pick<import('osu-files').BeatmapCollectionModule, 'get'>
  rulesets: Pick<import('osu-files').RulesetModule, 'get'>
  rulesetSettings: Pick<import('osu-files').RulesetSettingModule, 'get'>
  skins: Pick<import('osu-files').SkinModule, 'get'>
  files: Pick<import('osu-files').FileModule, 'get'>
  keybindings: Pick<import('osu-files').KeyBindingModule, 'get'>
  modpresets: Pick<import('osu-files').ModPresetModule, 'get'>
  metadata: Pick<import('osu-files').BeatmapMetadataModule, 'get'>
}
declare const fixture: DocumentationFixture
declare const db: DocumentationDatabase
declare const source: string
declare const storyboardSource: string
declare const osbSource: string
declare const skinIniSource: string
declare const beatmaps: Array<{ osuText: string }>
declare const files: Array<{ filename: string; hash: string }>
`,
})
files.push({
  uri: 'file:///node_modules/osu-files/externals.d.ts',
  content: `declare class Buffer extends Uint8Array { static from(value: string | ArrayLike<number>): Buffer }\ndeclare const process: { env: Record<string, string | undefined> }\ndeclare module 'realm' {\n  export namespace BSON {\n    class UUID {\n      constructor(input?: string)\n      toHexString(includeDashes?: boolean): string\n      toString(): string\n    }\n  }\n  class Realm {\n    static BSON: typeof BSON\n  }\n  namespace Realm {\n    class Object {}\n  }\n  export default Realm\n  export { BSON }\n}\ndeclare module 'node:fs' { const value: any; export = value }\ndeclare module 'node:path' { const value: any; export = value }\ndeclare module 'node:os' { const value: any; export = value }\ndeclare module 'node:crypto' { const value: any; export = value }\ndeclare module 'yauzl' { const value: any; export = value }\ndeclare module 'yazl' { const value: any; export = value }\n`,
})

const manifest: RunnerTypesManifest = {
  packageEntry: 'file:///node_modules/osu-files/index.d.ts',
  files: files.sort((a, b) => a.uri.localeCompare(b.uri)),
}
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
