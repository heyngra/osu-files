import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from '../osz/types.js'
import type { BeatmapSet, Beatmap } from '../schema/types.js'

const MODE_TO_SHORTNAME: Record<number, string> = {
  0: 'osu', 1: 'taiko', 2: 'fruits', 3: 'mania',
}

function resolveRulesetByMode(ctx: OsuFilesContext, mode: number) {
  const shortName = MODE_TO_SHORTNAME[mode]
  return shortName ? ctx.rulesets.get.byShortNameEquals(shortName)[0] ?? undefined : undefined
}

const STANDARD_RULESETS = [
  { ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: 'osu.Game.Rulesets.Osu.OsuRuleset, osu.Game.Rulesets.Osu', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'taiko', OnlineID: 1, Name: 'osu!taiko', InstantiationInfo: 'osu.Game.Rulesets.Taiko.TaikoRuleset, osu.Game.Rulesets.Taiko', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'fruits', OnlineID: 2, Name: 'osu!catch', InstantiationInfo: 'osu.Game.Rulesets.Catch.CatchRuleset, osu.Game.Rulesets.Catch', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'mania', OnlineID: 3, Name: 'osu!mania', InstantiationInfo: 'osu.Game.Rulesets.Mania.ManiaRuleset, osu.Game.Rulesets.Mania', Available: true, LastAppliedDifficultyVersion: 0 },
]

/** A beatmap entry within an import set input. */
export type ImportSetBeatmap = {
  filename: string
  hash: string
  md5Hash: string
  osuBeatmap: OsuBeatmap
}

/** Input shape for importing a beatmap set into Realm. */
export type ImportSetInput = {
  onlineID: number
  setHash: string
  status: number
  protected: boolean
  files: Array<{ hash: string; filename: string }>
  beatmaps: ImportSetBeatmap[]
}

/**
 * Imports a beatmap set (beatmaps + files) into the Realm database.
 * @returns Imported beatmap set data.
 * @example
 * importSet(ctx, { onlineID: 123, setHash: 'abc', status: 0, protected: false, files: [...], beatmaps: [...] })
 */
export function importSet(ctx: OsuFilesContext, input: ImportSetInput): BeatmapSetData {
  const { onlineID, setHash, status, protected: isProtected, files, beatmaps } = input

  let existingSet: BeatmapSet | null = null
  if (onlineID > 0) existingSet = ctx.sets.get.byOnlineIdExact(onlineID)[0] ?? null
  if (!existingSet && setHash) existingSet = ctx.sets.get.byHashEquals(setHash)[0] ?? null

  const setUUID = existingSet ? existingSet.ID : new Realm.BSON.UUID()

  for (const rs of STANDARD_RULESETS) {
    if (!ctx.rulesets.get.byShortNameEquals(rs.ShortName)[0]) {
      ctx.rulesets.write.create(rs)
    }
  }

  if (existingSet) {
    for (const b of [...existingSet.Beatmaps]) {
      if (b.Metadata) ctx.realm.write(() => ctx.realm.delete(b.Metadata!))
      ctx.beatmaps.write.delete(b.ID)
    }
  }

  for (const f of files) {
    if (!ctx.files.get.byHashEquals(f.hash)[0]) {
      ctx.files.write.upsert({ Hash: f.hash })
    }
  }

  const namedFileEntries = files.map(f => ({ File: ctx.files.get.byHashEquals(f.hash)[0]!, Filename: f.filename }))

  let beatmapSet: BeatmapSet
  if (!existingSet) {
    beatmapSet = ctx.sets.write.create({
      ID: setUUID,
      OnlineID: onlineID,
      DateAdded: new Date(),
      Files: namedFileEntries,
      Status: status,
      DeletePending: false,
      Hash: setHash,
      Protected: isProtected,
    })
  } else {
    ctx.sets.write.update(setUUID, {
      OnlineID: onlineID,
      Hash: setHash,
      Files: namedFileEntries,
    })
    beatmapSet = existingSet
  }

  const createdBeatmaps: Beatmap[] = []

  for (const entry of beatmaps) {
    const bm = entry.osuBeatmap
    const meta = bm.metadata
    const diff = bm.difficulty

    const ruleset = resolveRulesetByMode(ctx, bm.general.mode)
    if (!ruleset) continue

    let metadataObj: any
    ctx.realm.write(() => {
      metadataObj = ctx.realm.create('BeatmapMetadata', {
        Title: meta.title || '',
        TitleUnicode: meta.titleUnicode || '',
        Artist: meta.artist || '',
        ArtistUnicode: meta.artistUnicode || '',
        Author: { OnlineID: 1, Username: meta.creator || '', CountryCode: 'Unknown' },
        Source: meta.source || '',
        Tags: meta.tags?.join(' ') || '',
        PreviewTime: bm.general.previewTime ?? -1,
        AudioFile: bm.general.audioFilename || '',
        BackgroundFile: bm.events.find(e => e.type === 'background')?.filename ?? '',
        UserTags: [],
      })
    })

    const lastTime = bm.hitObjects.length > 0
      ? Math.max(...bm.hitObjects.map(h => {
          if (h.objectType === 'spinner' || h.objectType === 'hold') return h.extras.endTime
          return h.time
        }))
      : 0

    const positiveTps = bm.timingPoints.filter(tp => tp.uninherited && tp.beatLength > 0)
    const bpm = positiveTps.length > 0
      ? Math.round(60000 / positiveTps.reduce((min, tp) => Math.min(min, tp.beatLength), Infinity) * 100) / 100
      : 0

    const newBeatmap = ctx.beatmaps.write.create({
      ID: new Realm.BSON.UUID(),
      DifficultyName: meta.version || '',
      Ruleset: ruleset,
      Difficulty: {
        DrainRate: diff.hpDrainRate,
        CircleSize: diff.circleSize,
        OverallDifficulty: diff.overallDifficulty,
        ApproachRate: diff.approachRate,
        SliderMultiplier: diff.sliderMultiplier,
        SliderTickRate: diff.sliderTickRate,
      },
      Metadata: metadataObj,
      BeatmapSet: beatmapSet,
      Status: 1,
      OnlineID: meta.beatmapID ?? -1,
      Length: lastTime,
      BPM: bpm,
      Hash: entry.hash,
      StarRating: -1,
      MD5Hash: entry.md5Hash,
      Hidden: false,
      BeatDivisor: bm.editor?.beatDivisor ?? 4,
      UserSettings: { Offset: 0 },
      OnlineMD5Hash: '',
      LastLocalUpdate: new Date(),
      EndTimeObjectCount: bm.hitObjects.filter(h => h.objectType === 'spinner' || h.objectType === 'hold').length,
      TotalObjectCount: bm.hitObjects.length,
    })
    createdBeatmaps.push(newBeatmap)
  }

  ctx.realm.write(() => {
    for (const bm of createdBeatmaps) {
      beatmapSet.Beatmaps.push(bm)
    }
  })

  return {
    onlineID,
    status,
    protected: isProtected,
    beatmaps: beatmaps.map(e => e.osuBeatmap),
    files: files.map(f => ({ hash: f.hash, filename: f.filename })),
    setHash,
  }
}
