import Realm from 'realm'
import type { FixtureDatabaseData, FixtureRow } from '../../docs/.vitepress/runner/fixture-db.js'

function uuid(value: unknown): Realm.BSON.UUID {
  return value instanceof Realm.BSON.UUID ? value : new Realm.BSON.UUID(String(value))
}

function date(value: unknown): Date | undefined {
  return value === undefined || value === null ? undefined : new Date(value as string | number)
}

function fileUsages(realm: Realm, value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const usage = item as FixtureRow
    const file = usage.File as FixtureRow | undefined
    return {
      Filename: usage.Filename,
      File: file?.Hash ? realm.objectForPrimaryKey('File', file.Hash) : undefined,
    }
  })
}

export function seedRealmFixture(realm: Realm, data: FixtureDatabaseData): void {
  realm.write(() => {
    for (const row of data.File)
      realm.create('File', { Hash: row.Hash })

    for (const row of data.Ruleset)
      realm.create('Ruleset', { ...row })

    for (const row of data.BeatmapSet) {
      realm.create('BeatmapSet', {
        ID: uuid(row.ID), OnlineID: row.OnlineID, DateAdded: date(row.DateAdded), Beatmaps: [], Files: fileUsages(realm, row.Files), Status: row.Status,
        DeletePending: row.DeletePending, Hash: row.Hash, Protected: row.Protected, DateSubmitted: date(row.DateSubmitted), DateRanked: date(row.DateRanked),
      })
    }

    for (const row of data.Beatmap) {
      const set = row.BeatmapSet as FixtureRow | undefined
      const ruleset = row.Ruleset as FixtureRow | undefined
      realm.create('Beatmap', {
        ID: uuid(row.ID), DifficultyName: row.DifficultyName, Ruleset: ruleset?.ShortName ? realm.objectForPrimaryKey('Ruleset', ruleset.ShortName) : undefined,
        Difficulty: row.Difficulty, Metadata: row.Metadata, BeatmapSet: set?.ID ? realm.objectForPrimaryKey('BeatmapSet', uuid(set.ID)) : undefined,
        Status: row.Status, OnlineID: row.OnlineID, Length: row.Length, BPM: row.BPM, Hash: row.Hash, StarRating: row.StarRating, MD5Hash: row.MD5Hash,
        Hidden: row.Hidden, BeatDivisor: row.BeatDivisor, UserSettings: row.UserSettings, OnlineMD5Hash: row.OnlineMD5Hash,
        LastLocalUpdate: date(row.LastLocalUpdate), LastOnlineUpdate: date(row.LastOnlineUpdate), LastPlayed: date(row.LastPlayed), EditorTimestamp: row.EditorTimestamp,
        EndTimeObjectCount: row.EndTimeObjectCount, TotalObjectCount: row.TotalObjectCount,
      })
    }

    for (const row of data.BeatmapSet) {
      const set = realm.objectForPrimaryKey<any>('BeatmapSet', uuid(row.ID))
      for (const item of Array.isArray(row.Beatmaps) ? row.Beatmaps : []) {
        const beatmap = item as FixtureRow
        const value = realm.objectForPrimaryKey<any>('Beatmap', uuid(beatmap.ID))
        if (value) set.Beatmaps.push(value)
      }
    }

    for (const row of data.Score) {
      const beatmap = row.BeatmapInfo as FixtureRow | undefined
      const ruleset = row.Ruleset as FixtureRow | undefined
      realm.create('Score', {
        ID: uuid(row.ID), BeatmapInfo: beatmap?.ID ? realm.objectForPrimaryKey('Beatmap', uuid(beatmap.ID)) : undefined,
        Ruleset: ruleset?.ShortName ? realm.objectForPrimaryKey('Ruleset', ruleset.ShortName) : undefined, Files: fileUsages(realm, row.Files), Hash: row.Hash,
        DeletePending: row.DeletePending, TotalScore: row.TotalScore, MaxCombo: row.MaxCombo, Accuracy: row.Accuracy, Date: date(row.Date), PP: row.PP,
        OnlineID: row.OnlineID, User: row.User, Mods: row.Mods, Statistics: row.Statistics, Rank: row.Rank, Combo: row.Combo,
        MaximumStatistics: row.MaximumStatistics, BeatmapHash: row.BeatmapHash, IsLegacyScore: row.IsLegacyScore, ClientVersion: row.ClientVersion,
        TotalScoreWithoutMods: row.TotalScoreWithoutMods, TotalScoreVersion: row.TotalScoreVersion, LegacyTotalScore: row.LegacyTotalScore,
        BackgroundReprocessingFailed: row.BackgroundReprocessingFailed, LegacyOnlineID: row.LegacyOnlineID, Pauses: row.Pauses,
      })
    }

    for (const row of data.BeatmapCollection)
      realm.create('BeatmapCollection', { ID: uuid(row.ID), Name: row.Name, BeatmapMD5Hashes: row.BeatmapMD5Hashes, LastModified: date(row.LastModified) })

    for (const row of data.RulesetSetting)
      realm.create('RulesetSetting', { ...row })

    for (const row of data.Skin) {
      realm.create('Skin', {
        ID: uuid(row.ID), Name: row.Name, Creator: row.Creator, InstantiationInfo: row.InstantiationInfo, Hash: row.Hash,
        Protected: row.Protected, Files: fileUsages(realm, row.Files), DeletePending: row.DeletePending,
      })
    }

    for (const row of data.KeyBinding)
      realm.create('KeyBinding', { ID: uuid(row.ID), RulesetName: row.RulesetName, Variant: row.Variant, Action: row.Action, KeyCombination: row.KeyCombination })

    for (const row of data.ModPreset) {
      const ruleset = row.Ruleset as FixtureRow | undefined
      realm.create('ModPreset', {
        ID: uuid(row.ID), Ruleset: ruleset?.ShortName ? realm.objectForPrimaryKey('Ruleset', ruleset.ShortName) : undefined,
        Name: row.Name, Description: row.Description, Mods: row.Mods, DeletePending: row.DeletePending,
      })
    }
  })
}
