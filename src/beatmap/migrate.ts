import { readFileSync } from 'fs'
import { join } from 'path'
import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from './parse.js'
import { serializeOsu } from './serialize.js'
import type { OsuBeatmap } from './types.js'
import type { BeatmapSetData, BeatmapSetFile } from '../osz/types.js'
import type { Beatmap, BeatmapSet } from '../schema/types.js'

function fileStoragePath(base: string, hash: string): string {
  return join(base, hash[0], hash.substring(0, 2), hash)
}

export function realmBeatmapToOsuBeatmap(ctx: OsuFilesContext, beatmapId: string): OsuBeatmap | undefined {
  if (!ctx.filesFolderPath) return undefined

  const beatmap = ctx.realm.objectForPrimaryKey<Beatmap>('Beatmap', new Realm.BSON.UUID(beatmapId))
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

export function realmSetToBeatmapSetData(ctx: OsuFilesContext, setId: string): BeatmapSetData | undefined {
  if (!ctx.filesFolderPath) return undefined

  const set = ctx.realm.objectForPrimaryKey<BeatmapSet>('BeatmapSet', new Realm.BSON.UUID(setId))
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

export function osuBeatmapToRealmPayload(
  osu: OsuBeatmap,
  existingHash?: string,
  existingMd5?: string,
): Record<string, unknown> {
  const lastTime = osu.hitObjects.length > 0
    ? Math.max(...osu.hitObjects.map(h => {
        if (h.objectType === 'spinner' || h.objectType === 'hold') return h.extras.endTime
        return h.time
      }))
    : 0

  const positiveTps = osu.timingPoints.filter(tp => tp.uninherited && tp.beatLength > 0)
  const bpm = positiveTps.length > 0
    ? Math.round(60000 / positiveTps.reduce((min, tp) => Math.min(min, tp.beatLength), Infinity) * 100) / 100
    : 0

  return {
    DifficultyName: osu.metadata.version || '',
    Difficulty: {
      DrainRate: osu.difficulty.hpDrainRate,
      CircleSize: osu.difficulty.circleSize,
      OverallDifficulty: osu.difficulty.overallDifficulty,
      ApproachRate: osu.difficulty.approachRate,
      SliderMultiplier: osu.difficulty.sliderMultiplier,
      SliderTickRate: osu.difficulty.sliderTickRate,
    },
    Status: -3,
    OnlineID: -1,
    Length: lastTime / 1000,
    BPM: bpm,
    Hash: existingHash ?? '',
    StarRating: -1,
    MD5Hash: existingMd5 ?? '',
    Hidden: false,
    BeatDivisor: osu.editor?.beatDivisor ?? 4,
    UserSettings: { Offset: 0 },
    OnlineMD5Hash: '',
    EndTimeObjectCount: osu.hitObjects.filter(h => h.objectType === 'spinner' || h.objectType === 'hold').length,
    TotalObjectCount: osu.hitObjects.length,
  }
}
