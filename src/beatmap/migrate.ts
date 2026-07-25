import { readFileSync } from 'fs'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from './parse.js'
import type { OsuBeatmap } from './types.js'
import type { BeatmapSetData, BeatmapSetFile } from '../osz/types.js'
import { fileStoragePath } from '../util.js'

/**
 * Reads a stored .osu file from disk and parses it.
 * @returns The parsed beatmap, or undefined if not found.
 * @example
 * realmBeatmapToOsuBeatmap(ctx, beatmapId) // OsuBeatmap or undefined
 */
export function realmBeatmapToOsuBeatmap(ctx: OsuFilesContext, beatmapId: string): OsuBeatmap | undefined {
  if (!ctx.filesFolderPath) return undefined

  const beatmap = ctx.beatmaps.get.byId(beatmapId)
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
  return parsed
}

/**
 * Builds full BeatmapSetData from a Realm beatmap set, including all beatmaps and files.
 * @returns The parsed beatmap set data, or undefined if not found.
 * @example
 * realmSetToBeatmapSetData(ctx, setId) // { onlineID: 123, beatmaps: [...], files: [...] }
 */
export function realmSetToBeatmapSetData(ctx: OsuFilesContext, setId: string): BeatmapSetData | undefined {
  if (!ctx.filesFolderPath) return undefined

  const set = ctx.sets.get.byId(setId)
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
