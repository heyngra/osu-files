import { readFileSync, writeFileSync, existsSync } from 'fs'
import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import { FileRef } from '../types.js'
import type { BeatmapSet, RealmNamedFileUsage } from '../schema/types.js'
import { parseOsu } from './parse.js'
import { serializeOsu } from './serialize.js'
import type { OsuBeatmap } from './types.js'
import type { BeatmapSetData, BeatmapSetFile } from '../osz/types.js'
import { parseOsb } from './storyboard/parse.js'
import { serializeOsb } from './storyboard/serialize.js'
import { Storyboard } from './storyboard/storyboard.js'
import { StoryboardSprite, StoryboardSample } from './storyboard/elements.js'
import type { StoryboardElementSource } from './storyboard/types.js'
import { sha256, fileStoragePath, ensureParentDir, normalizeFilename } from '../util.js'

export function createFileRef(
  filename: string,
  source: { hash?: string; content?: Buffer },
  ctx?: OsuFilesContext,
): FileRef {
  return new FileRef(filename, source, ctx)
}

function resolveStoryboardFiles(storyboard: Storyboard, setFiles: RealmNamedFileUsage[]): void {
  for (const layer of storyboard.layers.values()) {
    for (const el of layer.elements) {
      if (el instanceof StoryboardSprite || el instanceof StoryboardSample) {
        const found = setFiles.find(fu => normalizeFilename(fu.Filename ?? '') === normalizeFilename(el.path))
        if (found?.File?.Hash) el.file.hash = found.File.Hash
      }
    }
  }
}

function findOsbFile(set: BeatmapSet): { filename: string; hash: string } | undefined {
  for (const fu of set.Files ?? []) {
    if (fu.Filename?.toLowerCase().endsWith('.osb') && fu.File?.Hash) {
      return { filename: fu.Filename, hash: fu.File.Hash }
    }
  }
  return undefined
}

function mergeOsbContent(target: Storyboard, source: Storyboard, sourceType: StoryboardElementSource): void {
  const wasDirty = target._dirty
  for (const [name, layer] of source.layers) {
    for (const el of layer.elements) {
      if (el instanceof StoryboardSprite || el instanceof StoryboardSample) {
        el.source = sourceType
        el._sb = target
        target.getLayer(name).add(el)
      }
    }
  }
  target._dirty = wasDirty
}

export function realmBeatmapToOsuBeatmap(ctx: OsuFilesContext, beatmapId: string): OsuBeatmap | undefined {
  if (!ctx.filesFolderPath) return undefined

  const beatmap = ctx.beatmaps.get.byId(beatmapId)[0]
  if (!beatmap) return undefined

  const hash = beatmap.Hash ?? ''
  if (!hash) return undefined

  const storePath = fileStoragePath(ctx.filesFolderPath, hash)
  let content: string
  try {
    content = readFileSync(storePath, 'utf-8')
  } catch {
    return undefined
  }

  const parsed = parseOsu(content)
  parsed.metadata.beatmapID = beatmap.OnlineID ?? -1
  parsed.metadata.beatmapSetID = beatmap.BeatmapSet?.OnlineID ?? -1
  parsed.metadata.version = beatmap.DifficultyName ?? parsed.metadata.version
  parsed.metadata.creator = beatmap.Metadata?.Author?.Username ?? parsed.metadata.creator

  if (beatmap.BeatmapSet) {
    const osb = findOsbFile(beatmap.BeatmapSet)
    if (osb) {
      const osbPath = fileStoragePath(ctx.filesFolderPath, osb.hash)
      try {
        const osbContent = readFileSync(osbPath, 'utf-8')
        const { storyboard: osbSb } = parseOsb(osbContent)
        if (parsed.storyboard) {
          mergeOsbContent(parsed.storyboard, osbSb, 'shared')
        } else {
          for (const [name, layer] of osbSb.layers) {
            for (const el of layer.elements) {
              if (el instanceof StoryboardSprite || el instanceof StoryboardSample) {
                el.source = 'shared'
                el._sb = osbSb
              }
            }
          }
          osbSb._rawText = undefined
          osbSb._dirty = false
          parsed.storyboard = osbSb
        }
      } catch {}
    }
  }

  if (parsed.storyboard && beatmap.BeatmapSet) {
    resolveStoryboardFiles(parsed.storyboard, beatmap.BeatmapSet.Files ?? [])
  }

  return parsed
}

export function realmSetToBeatmapSetData(ctx: OsuFilesContext, setId: string): BeatmapSetData | undefined {
  if (!ctx.filesFolderPath) return undefined

  const set = ctx.sets.get.byId(setId)[0]
  if (!set) return undefined

  const files: BeatmapSetFile[] = []
  for (const fu of set.Files ?? []) {
    files.push({ hash: fu.File?.Hash ?? '', filename: fu.Filename ?? '' })
  }

  const beatmaps: OsuBeatmap[] = []
  for (const b of set.Beatmaps ?? []) {
    const osu = realmBeatmapToOsuBeatmap(ctx, String(b.ID))
    if (osu) beatmaps.push(osu)
  }

  return {
    onlineID: set.OnlineID ?? -1,
    status: set.Status ?? -3,
    dateSubmitted: set.DateSubmitted ?? undefined,
    dateRanked: set.DateRanked ?? undefined,
    protected: set.Protected ?? false,
    beatmaps,
    files,
    setHash: set.Hash ?? undefined,
  }
}

function autoRegisterFileRefs(ctx: OsuFilesContext, setFiles: RealmNamedFileUsage[], beatmap: OsuBeatmap): void {
  const storyboard = beatmap.storyboard
  if (!storyboard) return

  const refs: FileRef[] = []
  for (const layer of storyboard.layers.values()) {
    for (const el of layer.elements) {
      if (el instanceof StoryboardSprite || el instanceof StoryboardSample) {
        refs.push(el.file)
      }
    }
  }

  for (const ref of refs) {
    if (!ref.filename) continue

    const alreadyExists = setFiles.some(fu => normalizeFilename(fu.Filename ?? '') === normalizeFilename(ref.filename))
    if (alreadyExists) continue

    let hash = ref.hash
    if (ref.content) {
      hash = sha256(ref.content)
      const storePath = fileStoragePath(ctx.filesFolderPath!, hash)
      if (!existsSync(storePath)) {
        ensureParentDir(storePath)
        writeFileSync(storePath, ref.content)
      }
      if (!ctx.files.get.byHashEquals(hash)[0]) {
        ctx.files.write.upsert({ Hash: hash })
      }
      ref.hash = hash
    }

    if (hash) {
      let fileObj = ctx.files.get.byHashEquals(hash)[0]
      if (!fileObj) {
        const storePath = fileStoragePath(ctx.filesFolderPath!, hash)
        if (!existsSync(storePath)) throw new Error(`File '${ref.filename}' with hash ${hash} is not stored`)
        fileObj = ctx.files.write.upsert({ Hash: hash })
      }
      if (fileObj) {
        ctx.realm.write(() => {
          setFiles.push({ File: fileObj, Filename: ref.filename })
        })
      }
    }
  }
}

/** Save a modified beatmap back to disk and update realm references.
 *  Writes the serialized .osu file, updates the Beatmap.Hash, and
 *  recomputes the BeatmapSet.Hash when the content changed.
 *  @returns true if the hash changed (file written), false if unchanged.
 */
export function saveOsuBeatmap(ctx: OsuFilesContext, beatmapIdStr: string, modified: OsuBeatmap): boolean {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required to save')

  const beatmapId = new Realm.BSON.UUID(beatmapIdStr)
  const beatmap = ctx.beatmaps.get.byId(beatmapId)[0]
  if (!beatmap) throw new Error(`Beatmap '${beatmapIdStr}' not found`)

  // Validate every file ref in the storyboard
  if (modified.storyboard) {
    for (const layer of modified.storyboard.layers.values()) {
      for (const el of layer.elements) {
        if (el instanceof StoryboardSprite || el instanceof StoryboardSample) {
          const ref = el.file
          if (!ref) throw new Error(`Sprite/sample '${el.path}' has no file ref`)
          if (!ref.hash && !ref.content) {
            throw new Error(`FileRef '${ref.filename}' must have hash or content`)
          }
        }
      }
    }
  }

  const oldHash = beatmap.Hash ?? ''
  const newContent = serializeOsu(modified)
  const newHash = sha256(Buffer.from(newContent, 'utf-8'))

  if (newHash === oldHash) return false

  const storePath = fileStoragePath(ctx.filesFolderPath, newHash)
  ensureParentDir(storePath)
  writeFileSync(storePath, newContent, 'utf-8')

  if (!ctx.files.get.byHashEquals(newHash)[0]) {
    ctx.files.write.upsert({ Hash: newHash })
  }

  ctx.beatmaps.write.update(beatmapId, { Hash: newHash })

  ctx.realm.write(() => {
    beatmap.DifficultyName = modified.metadata.version
    beatmap.OnlineID = modified.metadata.beatmapID
    if (beatmap.Metadata) {
      beatmap.Metadata.Title = modified.metadata.title
      beatmap.Metadata.TitleUnicode = modified.metadata.titleUnicode
      beatmap.Metadata.Artist = modified.metadata.artist
      beatmap.Metadata.ArtistUnicode = modified.metadata.artistUnicode
      beatmap.Metadata.Source = modified.metadata.source
      beatmap.Metadata.Tags = modified.metadata.tags.join(' ')
      beatmap.Metadata.PreviewTime = modified.general.previewTime
      beatmap.Metadata.AudioFile = modified.general.audioFilename
      beatmap.Metadata.BackgroundFile = modified.events.find(e => e.type === 'background')?.filename ?? ''
      if (beatmap.Metadata.Author) {
        beatmap.Metadata.Author.Username = modified.metadata.creator
      }
    }
    if (beatmap.BeatmapSet) beatmap.BeatmapSet.OnlineID = modified.metadata.beatmapSetID
  })

  const freshBeatmap = ctx.beatmaps.get.byId(beatmapId)[0]
  if (freshBeatmap?.BeatmapSet) {
    const setObj = freshBeatmap.BeatmapSet
    const setPk = setObj.ID instanceof Realm.BSON.UUID ? setObj.ID : new Realm.BSON.UUID(String(setObj.ID))
    const setCopy = ctx.sets.get.byId(setPk)[0]
    if (setCopy) {
      const setFiles = setCopy.Files

      autoRegisterFileRefs(ctx, setFiles, modified)

      const filename = `${modified.metadata.artist} - ${modified.metadata.title} (${modified.metadata.creator}) [${modified.metadata.version}].osu`
        .replace(/[<>:"/\\|?*]/g, '_')
      const usage = setFiles.find(fu => fu.File?.Hash === oldHash)
        ?? setFiles.find((fu: any) => fu.Filename === filename)
      if (usage) {
        ctx.realm.write(() => { usage.File = ctx.files.get.byHashEquals(newHash)[0] })
      }

      if (modified.storyboard && modified.storyboard._dirty) {
        const sharedElements: Array<{ el: StoryboardSprite | StoryboardSample; layer: string }> = []
        for (const [name, l] of modified.storyboard.layers) {
          for (const el of l.elements) {
            if (el.source === 'shared') sharedElements.push({ el, layer: name })
          }
        }

        const existingOsb = setFiles.find(f => f.Filename?.toLowerCase().endsWith('.osb'))
        if (sharedElements.length > 0 || existingOsb) {
          let osbFilename = existingOsb?.Filename ?? ''
          if (!osbFilename) {
            osbFilename = `${modified.metadata.artist} - ${modified.metadata.title} (${modified.metadata.creator}).osb`
              .replace(/[<>:"/\\|?*]/g, '_')
          }

          const osbSb = new Storyboard()
          for (const { el, layer } of sharedElements) {
            el._sb = osbSb
            osbSb.getLayer(layer).add(el)
          }
          osbSb._dirty = true
          const osbContent = serializeOsb(osbSb, {})
          const osbHash = sha256(Buffer.from(osbContent, 'utf-8'))
          const osbPath = fileStoragePath(ctx.filesFolderPath, osbHash)
          if (!existsSync(osbPath)) {
            ensureParentDir(osbPath)
            writeFileSync(osbPath, osbContent, 'utf-8')
          }
          if (!ctx.files.get.byHashEquals(osbHash)[0]) {
            ctx.files.write.upsert({ Hash: osbHash })
          }
          const osbFile = ctx.files.get.byHashEquals(osbHash)[0]
          const usage = setFiles.find(f => f.Filename === osbFilename)
          if (usage) {
            ctx.realm.write(() => { usage.File = osbFile })
          } else if (osbFile) {
            ctx.realm.write(() => {
              setFiles.push({ File: osbFile, Filename: osbFilename })
            })
          }
        }
      }

      const allBeatmapFiles: Array<{ filename: string; buffer: Buffer }> = []
      for (const b of setCopy.Beatmaps ?? []) {
        const h = b.Hash ?? ''
        if (h) {
          try {
            const bp = fileStoragePath(ctx.filesFolderPath, h)
            const usage = setFiles.find(f => f.File?.Hash === h)
            allBeatmapFiles.push({ filename: usage?.Filename ?? h, buffer: readFileSync(bp) })
          } catch {}
        }
      }
      if (allBeatmapFiles.length > 0) {
        allBeatmapFiles.sort((a, b) => a.filename.localeCompare(b.filename))
        const setHash = sha256(Buffer.concat(allBeatmapFiles.map(f => f.buffer)))
        ctx.sets.write.update(setPk, { Hash: setHash })
      }
    }
  }

  return true
}
