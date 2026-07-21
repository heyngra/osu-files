import { readFileSync, createWriteStream } from 'fs'
import Realm from 'realm'
import { ZipFile } from 'yazl'
import type { OsuFilesContext } from '../context.js'
import { serializeOsu } from '../beatmap/serialize.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from './types.js'
import type { BeatmapSet } from '../schema/types.js'
import { fileStoragePath } from '../util.js'

export type ExportOptions = {
  beatmaps?: OsuBeatmap[]
}

export async function exportOsz(
  ctx: OsuFilesContext,
  setID: string,
  outputPath: string,
  options?: ExportOptions,
): Promise<void> {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for export')

  const set = ctx.realm.objectForPrimaryKey<BeatmapSet>('BeatmapSet', new Realm.BSON.UUID(setID))
  if (!set) throw new Error(`BeatmapSet '${setID}' not found`)

  const zip = new ZipFile()

  const beatmapOverrides = new Map<string, OsuBeatmap>()
  if (options?.beatmaps) {
    for (const b of options.beatmaps) {
      beatmapOverrides.set(b.metadata.version, b)
    }
  }

  for (const fileUsage of set.Files as any[]) {
    const hash: string = fileUsage.File?.Hash
    const filename: string = fileUsage.Filename
    if (!hash) continue

    const isOsu = filename.toLowerCase().endsWith('.osu')
    const override = isOsu ? beatmapOverrides.get(filename) ?? findOverrideByFilename(filename, beatmapOverrides) : undefined

    if (override) {
      const content = serializeOsu(override)
      zip.addBuffer(Buffer.from(content, 'utf-8'), filename)
    } else {
      const storePath = fileStoragePath(ctx.filesFolderPath, hash)
      const content = readFileSync(storePath)
      zip.addBuffer(content, filename)
    }
  }

  return new Promise((resolve, reject) => {
    const stream = createWriteStream(outputPath)
    stream.on('error', reject)
    stream.on('close', resolve)
    zip.outputStream.pipe(stream)
    zip.end()
  })
}

function findOverrideByFilename(filename: string, overrides: Map<string, OsuBeatmap>): OsuBeatmap | undefined {
  for (const [, bm] of overrides) {
    if (filename.includes(bm.metadata.version)) return bm
  }
  return undefined
}

export async function exportOszFromData(
  ctx: OsuFilesContext,
  data: BeatmapSetData,
  outputPath: string,
): Promise<void> {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for export')

  const zip = new ZipFile()

  const overrides = new Map<string, OsuBeatmap>()
  for (const b of data.beatmaps) {
    overrides.set(b.metadata.version, b)
  }

  for (const file of data.files) {
    const isOsu = file.filename.toLowerCase().endsWith('.osu')
    const matched = data.beatmaps.find(b => b.metadata.version === file.filename.replace(/\.osu$/i, '')?.split('[')?.pop()?.replace(']', ''))
    const override = isOsu ? overrides.get(file.filename) ?? matched : undefined

    if (override) {
      const content = serializeOsu(override)
      zip.addBuffer(Buffer.from(content, 'utf-8'), file.filename)
    } else {
      const storePath = fileStoragePath(ctx.filesFolderPath, file.hash)
      const content = readFileSync(storePath)
      zip.addBuffer(content, file.filename)
    }
  }

  return new Promise((resolve, reject) => {
    const stream = createWriteStream(outputPath)
    stream.on('error', reject)
    stream.on('close', resolve)
    zip.outputStream.pipe(stream)
    zip.end()
  })
}
