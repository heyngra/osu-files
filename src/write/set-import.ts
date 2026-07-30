import Realm from 'realm'
import type { OsuFilesContext } from '../context.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from '../osz/types.js'
import type { BeatmapSet, Beatmap } from '../schema/types.js'
import { assertWritable, markChanged, writeRealm } from '../context.js'
import { MODE_TO_SHORTNAME, RULESETS } from '../ruleset-info.js'

function resolveRulesetByMode(rulesets: Map<string, any>, mode: number) {
  const shortName = MODE_TO_SHORTNAME[mode]
  return shortName ? rulesets.get(shortName) : undefined
}

const STANDARD_RULESETS = RULESETS.map(r => ({
  ShortName: r.shortName,
  OnlineID: r.onlineID,
  Name: r.name,
  InstantiationInfo: r.instantiationInfo,
  Available: true,
  LastAppliedDifficultyVersion: 0,
}))

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
  assertWritable(ctx)
  const { onlineID, setHash, status, protected: isProtected, files, beatmaps } = input

  let existingSet: BeatmapSet | null = null
  if (onlineID > 0) existingSet = ctx.sets.get.live().byOnlineIdExact(onlineID)[0] ?? null
  if (!existingSet && setHash) existingSet = ctx.sets.get.live().byHashEquals(setHash)[0] ?? null

  const setUUID = existingSet ? existingSet.ID : new Realm.BSON.UUID()
  const previousBeatmaps = existingSet
    ? [...existingSet.Beatmaps].map(b => ({ difficulty: b.DifficultyName ?? '', md5: b.MD5Hash ?? '' }))
    : []

  const rulesets = new Map<string, any>()
  for (const ruleset of ctx.realm.objects<any>('Ruleset'))
    if (ruleset.ShortName) rulesets.set(ruleset.ShortName, ruleset)
  for (const rs of STANDARD_RULESETS) {
    if (!rulesets.has(rs.ShortName))
      rulesets.set(rs.ShortName, ctx.rulesets.write.create(rs))
  }

  if (existingSet) {
    for (const b of [...existingSet.Beatmaps]) {
      writeRealm(ctx, () => {
        for (const score of ctx.realm.objects<any>('Score').filtered('BeatmapInfo.ID == $0', b.ID))
          score.BeatmapInfo = null
      })
      if (b.Metadata) writeRealm(ctx, () => ctx.realm.delete(b.Metadata!))
      ctx.beatmaps.write.delete(b.ID)
    }
  }

  const filesByHash = new Map<string, any>()
  for (const file of ctx.realm.objects<any>('File'))
    if (file.Hash) filesByHash.set(file.Hash, file)
  for (const f of files) {
    if (!filesByHash.has(f.hash))
      filesByHash.set(f.hash, ctx.files.write.create({ Hash: f.hash }))
  }

  const namedFileEntries = files.map(f => ({ File: filesByHash.get(f.hash)!, Filename: f.filename }))

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
    writeRealm(ctx, () => {
      existingSet!.OnlineID = onlineID
      existingSet!.Hash = setHash
      existingSet!.Files.splice(0, existingSet!.Files.length)
      for (const usage of namedFileEntries) existingSet!.Files.push(usage)
    })
    beatmapSet = existingSet
  }

  const createdBeatmaps: Beatmap[] = []

  for (const entry of beatmaps) {
    const bm = entry.osuBeatmap
    const meta = bm.metadata
    const diff = bm.difficulty

    const ruleset = resolveRulesetByMode(rulesets, bm.general.mode)
    if (!ruleset) continue

    let metadataObj: any
    writeRealm(ctx, () => {
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

  writeRealm(ctx, () => {
    for (const bm of createdBeatmaps) {
      beatmapSet.Beatmaps.push(bm)
    }

    const replacements = new Map(
      previousBeatmaps
        .map(previous => [previous.md5, createdBeatmaps.find(b => b.DifficultyName === previous.difficulty)?.MD5Hash] as const)
        .filter((entry): entry is readonly [string, string] => !!entry[0] && !!entry[1]),
    )
    if (replacements.size > 0) {
      for (const collection of ctx.realm.objects<any>('BeatmapCollection')) {
        const hashes = [...collection.BeatmapMD5Hashes]
        let changed = false
        for (let i = 0; i < hashes.length; i++) {
          const replacement = hashes[i] ? replacements.get(hashes[i]) : undefined
          if (replacement) {
            hashes[i] = replacement
            changed = true
          }
        }
        if (changed) collection.BeatmapMD5Hashes = hashes
      }
    }

    for (const bm of createdBeatmaps) {
      for (const score of ctx.realm.objects<any>('Score').filtered('BeatmapHash == $0', bm.Hash))
        score.BeatmapInfo = bm
    }
  })
  markChanged(ctx)

  return {
    onlineID,
    status,
    protected: isProtected,
    beatmaps: beatmaps.map(e => e.osuBeatmap),
    files: files.map(f => ({ hash: f.hash, filename: f.filename })),
    setHash,
  }
}
