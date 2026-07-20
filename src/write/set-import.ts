import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from '../osz/types.js'
import type { BeatmapSet, Beatmap, Ruleset, RealmFile } from '../schema/types.js'

const MODE_TO_SHORTNAME: Record<number, string> = {
  0: 'osu', 1: 'taiko', 2: 'fruits', 3: 'mania',
}

function resolveRulesetByMode(realm: Realm, mode: number): Ruleset | undefined {
  const sn = MODE_TO_SHORTNAME[mode]
  return sn ? realm.objectForPrimaryKey<Ruleset>('Ruleset', sn) ?? undefined : undefined
}

const STANDARD_RULESETS = [
  { ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: 'osu.Game.Rulesets.Osu.OsuRuleset, osu.Game.Rulesets.Osu', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'taiko', OnlineID: 1, Name: 'osu!taiko', InstantiationInfo: 'osu.Game.Rulesets.Taiko.TaikoRuleset, osu.Game.Rulesets.Taiko', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'fruits', OnlineID: 2, Name: 'osu!catch', InstantiationInfo: 'osu.Game.Rulesets.Catch.CatchRuleset, osu.Game.Rulesets.Catch', Available: true, LastAppliedDifficultyVersion: 0 },
  { ShortName: 'mania', OnlineID: 3, Name: 'osu!mania', InstantiationInfo: 'osu.Game.Rulesets.Mania.ManiaRuleset, osu.Game.Rulesets.Mania', Available: true, LastAppliedDifficultyVersion: 0 },
]

export type ImportSetBeatmap = {
  filename: string
  hash: string
  md5Hash: string
  osuBeatmap: OsuBeatmap
}

export type ImportSetInput = {
  onlineID: number
  setHash: string
  status: number
  protected: boolean
  files: Array<{ hash: string; filename: string }>
  beatmaps: ImportSetBeatmap[]
}

export function importSet(ctx: OsuFilesContext, input: ImportSetInput): BeatmapSetData {
  const { realm, logger } = ctx
  const { onlineID, setHash, status, protected: isProtected, files, beatmaps } = input

  let existingSet: BeatmapSet | null = null
  if (onlineID > 0) {
    existingSet = realm.objects<BeatmapSet>('BeatmapSet').filtered('OnlineID == $0', onlineID)[0] ?? null
  }
  if (!existingSet && setHash) {
    existingSet = realm.objects<BeatmapSet>('BeatmapSet').filtered('Hash == $0', setHash)[0] ?? null
  }

  const setUUID = existingSet ? existingSet.ID : new Realm.BSON.UUID()
  const before = existingSet
    ? { onlineID: existingSet.OnlineID, hash: existingSet.Hash ?? '', beatmaps: existingSet.Beatmaps.length, files: existingSet.Files.length }
    : null

  realm.write(() => {
    for (const rs of STANDARD_RULESETS) {
      if (!realm.objectForPrimaryKey('Ruleset', rs.ShortName)) {
        realm.create('Ruleset', rs)
      }
    }

    if (existingSet) {
      const oldBeatmaps = [...existingSet.Beatmaps]
      for (const b of oldBeatmaps) {
        if (b.Metadata) realm.delete(b.Metadata)
        realm.delete(b)
      }
      existingSet.Beatmaps = []
      existingSet.Files = []
    }

    for (const f of files) {
      if (!realm.objectForPrimaryKey<RealmFile>('File', f.hash)) {
        realm.create('File', { Hash: f.hash })
      }
    }

    const namedFileEntries = files
      .filter(f => realm.objectForPrimaryKey<RealmFile>('File', f.hash))
      .map(f => ({ File: realm.objectForPrimaryKey<RealmFile>('File', f.hash)!, Filename: f.filename }))

    let beatmapSet: BeatmapSet
    if (!existingSet) {
      beatmapSet = realm.create<BeatmapSet>('BeatmapSet', {
        ID: setUUID,
        OnlineID: onlineID,
        DateAdded: new Date(),
        Beatmaps: [],
        Files: namedFileEntries,
        Status: status,
        DeletePending: false,
        Hash: setHash,
        Protected: isProtected,
      })
    } else {
      beatmapSet = existingSet
      existingSet.OnlineID = onlineID
      existingSet.Hash = setHash
      for (const nfe of namedFileEntries) existingSet.Files.push(nfe)
    }

    for (const entry of beatmaps) {
      const bm = entry.osuBeatmap
      const meta = bm.metadata
      const diff = bm.difficulty

      const metadataObj = realm.create('BeatmapMetadata', {
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

      const ruleset = resolveRulesetByMode(realm, bm.general.mode)
      if (!ruleset) continue

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

      const beatmapObj = realm.create<Beatmap>('Beatmap', {
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
        Status: -3,
        OnlineID: -1,
        Length: lastTime / 1000,
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

      beatmapSet.Beatmaps.push(beatmapObj)
    }
  })

  const after = { onlineID, setHash, beatmaps: beatmaps.length, files: files.length }
  logger.log('BeatmapSet', existingSet ? 'update' : 'create', String(setUUID), before, after)

  return {
    onlineID,
    status,
    protected: isProtected,
    beatmaps: beatmaps.map(e => e.osuBeatmap),
    files: files.map(f => ({ hash: f.hash, filename: f.filename })),
    setHash,
  }
}
