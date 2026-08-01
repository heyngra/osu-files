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
  content: `declare const fixture: DocumentationFixture\n\nexport interface DocumentationFixture {\n  source: string\n  beatmaps: Array<{ osuText: string }>\n  files: Array<{ filename: string; hash: string }>\n}\nexport default fixture\n`,
})
files.push({
  uri: 'file:///docs/fixture-global.d.ts',
  content: `interface DocumentationFixture {\n  source: string\n  beatmaps: Array<{ osuText: string }>\n  files: Array<{ filename: string; hash: string }>\n}\ndeclare const fixture: DocumentationFixture\ndeclare const source: string\ndeclare const beatmaps: Array<{ osuText: string }>\ndeclare const files: Array<{ filename: string; hash: string }>\n`,
})
files.push({
  uri: 'file:///node_modules/osu-files/externals.d.ts',
  content: `declare class Buffer extends Uint8Array { static from(value: string | ArrayLike<number>): Buffer }\ndeclare const process: { env: Record<string, string | undefined> }\ndeclare module 'realm' { const Realm: any; export default Realm }\ndeclare module 'node:fs' { const value: any; export = value }\ndeclare module 'node:path' { const value: any; export = value }\ndeclare module 'node:os' { const value: any; export = value }\ndeclare module 'node:crypto' { const value: any; export = value }\ndeclare module 'yauzl' { const value: any; export = value }\ndeclare module 'yazl' { const value: any; export = value }\n`,
})
files.push({
  uri: 'file:///docs/osu-files-module.d.ts',
  content: `declare module 'osu-files' {\n  export interface OsuMetadata { title: string; titleUnicode: string; artist: string; creator: string; version: string }\n  export interface OsuBeatmap { metadata: OsuMetadata; difficulty: { circleSize: number; approachRate: number; overallDifficulty: number }; hitObjects: unknown[]; timingPoints: unknown[] }\n  export function parseOsu(content: string): OsuBeatmap\n  export function serializeOsu(beatmap: OsuBeatmap): string\n  export const Anchor: { Centre: 'Centre'; TopLeft: 'TopLeft'; TopCentre: 'TopCentre'; TopRight: 'TopRight'; CentreLeft: 'CentreLeft'; CentreRight: 'CentreRight'; BottomLeft: 'BottomLeft'; BottomCentre: 'BottomCentre'; BottomRight: 'BottomRight' }\n  export class FileRef { constructor(filename: string, options?: { hash?: string }) }\n  export class StoryboardSprite { constructor(fileRef: FileRef, origin: keyof typeof Anchor); path: string; origin: keyof typeof Anchor; initialPosition: { x: number; y: number } }\n  export class Storyboard {}\n}\n`,
})

const manifest: RunnerTypesManifest = {
  packageEntry: 'file:///node_modules/osu-files/index.d.ts',
  files: files.sort((a, b) => a.uri.localeCompare(b.uri)),
}
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`)
