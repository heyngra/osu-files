import type { BSON } from 'realm'
import { RANK } from '../osr/types'

/**
 * An osu! beatmap stored in the Realm database.
 * @example // access via `db.beatmaps.byId(id)`
 */
export type Beatmap = {
  ID: BSON.UUID
  /** @example 'Easy' */
  DifficultyName?: string
  /** @example { ShortName: 'osu', OnlineID: 0, Name: 'osu!' } */
  Ruleset?: Ruleset
  /** @example { DrainRate: 3, CircleSize: 3, OverallDifficulty: 3, ApproachRate: 3 } */
  Difficulty?: BeatmapDifficulty
  /** @example { Title: 'Make A Move' } */
  Metadata?: BeatmapMetadata
  /** @example { OnlineID: 506483 } */
  BeatmapSet?: BeatmapSet
  /** @example 1 */
  Status: number
  /** @example 506483 */
  OnlineID: number
  /** @example 197000 */
  Length: number
  /** @example 174 */
  BPM: number
  /** @example 'a1b2c3d4e5f6...' */
  Hash?: string
  /** @example 3.12 */
  StarRating: number
  /** @example 'e7532e42ab7aa3735fe3d109c675c140' */
  MD5Hash?: string
  /** @example false */
  Hidden: boolean
  /** @example 4 */
  BeatDivisor: number
  /** @example { Offset: 0 } */
  UserSettings?: BeatmapUserSettings
  /** @example 'abc123...' */
  OnlineMD5Hash?: string
  /** @example new Date('2024-01-15') */
  LastLocalUpdate?: Date
  /** @example new Date('2024-01-15') */
  LastOnlineUpdate?: Date
  /** @example new Date('2024-07-20') */
  LastPlayed?: Date
  /** @example 0 */
  EditorTimestamp?: number
  /** @example 120 */
  EndTimeObjectCount: number
  /** @example 619 */
  TotalObjectCount: number
}

/**
 * A named collection of beatmaps identified by their MD5 hashes.
 * @example // access via `db.collections.byName('Favorites')`
 */
export type BeatmapCollection = {
  ID: BSON.UUID
  Name?: string
  BeatmapMD5Hashes: Array<string | undefined>
  LastModified: Date
}

/** Difficulty settings embedded within a Beatmap. */
export type BeatmapDifficulty = {
  /** @example 3 */
  DrainRate: number
  /** @example 3 */
  CircleSize: number
  /** @example 3 */
  OverallDifficulty: number
  /** @example 3 */
  ApproachRate: number
  /** @example 1.4 */
  SliderMultiplier: number
  /** @example 1 */
  SliderTickRate: number
}

/** Beatmap metadata (title, artist, tags, etc.). */
export type BeatmapMetadata = {
  /** @example 'Make A Move' */
  Title?: string
  /** @example 'Make A Move' */
  TitleUnicode?: string
  /** @example 'Icon For Hire' */
  Artist?: string
  /** @example 'Icon For Hire' */
  ArtistUnicode?: string
  /** @example { OnlineID: 0, Username: 'wajinshu' } */
  Author?: RealmUser
  /** @example 'Scripted' */
  Source?: string
  /** @example 'rock english wajinshu' */
  Tags?: string
  /** @example 56000 */
  PreviewTime: number
  /** @example 'audio.mp3' */
  AudioFile?: string
  /** @example 'bg.jpg' */
  BackgroundFile?: string
  /** @example [] */
  UserTags: Array<string | undefined>
}

/**
 * A beatmap set containing one or more difficulties.
 * @example // access via `db.sets.get.byOnlineId(12345)`
 */
export type BeatmapSet = {
  ID: BSON.UUID
  /** @example 506483 */
  OnlineID: number
  /** @example new Date('2024-01-15') */
  DateAdded: Date
  /** @example [] */
  Beatmaps: Array<Beatmap>
  /** @example [] */
  Files: Array<RealmNamedFileUsage>
  /** @example 1 */
  Status: number
  /** @example false */
  DeletePending: boolean
  /** @example 'a1b2c3d4...' */
  Hash?: string
  /** @example false */
  Protected: boolean
  /** @example new Date('2024-01-10') */
  DateSubmitted?: Date
  /** @example new Date('2024-01-20') */
  DateRanked?: Date
}

/** Per-user beatmap offset setting. */
export type BeatmapUserSettings = {
  Offset: number
}

/** A file tracked in the files folder, keyed by SHA-256 hash. */
export type File = {
  Hash?: string
}

/** A key binding for an osu! ruleset. */
export type KeyBinding = {
  ID: BSON.UUID
  RulesetName?: string
  Variant?: number
  Action: number
  KeyCombination?: string
}

/** A saved mod preset for a ruleset. */
export type ModPreset = {
  ID: BSON.UUID
  Ruleset?: Ruleset
  Name?: string
  Description?: string
  Mods?: string
  DeletePending: boolean
}

/** Links a filename to a stored File within a set/score/skin. */
export type RealmNamedFileUsage = {
  File?: RealmFile
  Filename?: string
}

/** A file record in Realm, keyed by SHA-256 hash. */
export type RealmFile = File

/** An osu! user known to the local Realm. */
export type RealmUser = {
  /** @example 124493 */
  OnlineID: number
  /** @example 'Cookiezi' */
  Username?: string
  /** @example 'KR' */
  CountryCode?: string
}

/** A game ruleset (osu!, osu!taiko, osu!catch, osu!mania). */
export type Ruleset = {
  /** @example 'osu' */
  ShortName?: string
  /** @example 0 */
  OnlineID: number
  /** @example 'osu!' */
  Name?: string
  /** @example '' */
  InstantiationInfo?: string
  /** @example true */
  Available: boolean
  /** @example 1 */
  LastAppliedDifficultyVersion: number
}

/** A per-ruleset variant setting. */
export type RulesetSetting = {
  RulesetName?: string
  Variant: number
  Key: string
  Value: string
}

/**
 * A score record in the Realm database.
 * @example // access via `db.scores.get.forBeatmap(md5Hash)`
 */
export type Score = {
  ID: BSON.UUID
  BeatmapInfo?: Beatmap
  Ruleset?: Ruleset
  /** @example [] */
  Files: Array<RealmNamedFileUsage>
  /** @example 'a1b2c3d4e5f6...' */
  Hash?: string
  /** @example false */
  DeletePending: boolean
  /** @example 1338419 */
  TotalScore: number
  /** @example 871 */
  MaxCombo: number
  /** @example 0.9913 */
  Accuracy: number
  /** @example new Date('2013-11-10') */
  Date: Date
  /** @example 302 */
  PP?: number
  /** @example 1518856368 */
  OnlineID: number
  User?: RealmUser
  /** @example '[{"acronym":"HD"},{"acronym":"HR"},{"acronym":"DT"}]' */
  Mods?: string
  /** @example '{"great":611,"ok":8,"meh":0,"miss":0}' */
  Statistics?: string
  /** @example RANK.SH */
  Rank: RANK
  /** @example 871 */
  Combo: number
  /** @example '{"great":619,"legacy_combo_increase":252}' */
  MaximumStatistics?: string
  /** @example 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2' */
  BeatmapHash?: string
  /** @example true */
  IsLegacyScore: boolean
  /** @example '20131110' */
  ClientVersion?: string
  /** @example 1338419 */
  TotalScoreWithoutMods: number
  /** @example 30000018 */
  TotalScoreVersion: number
  /** @example 16638107 */
  LegacyTotalScore?: number
  /** @example false */
  BackgroundReprocessingFailed: boolean
  /** @example 1518856368 */
  LegacyOnlineID: number
  /** @example [] */
  Pauses: Array<number>
}

/**
 * A skin record in the Realm database.
 * @example // access via `db.skins.get.byName('My Skin')`
 */
export type Skin = {
  ID: BSON.UUID
  /** @example 'Aesthetic' */
  Name?: string
  /** @example 'cyperdark' */
  Creator?: string
  /** @example '' */
  InstantiationInfo?: string
  /** @example 'a1b2c3d4e5f6...' */
  Hash?: string
  /** @example false */
  Protected: boolean
  /** @example [] */
  Files: Array<RealmNamedFileUsage>
  /** @example false */
  DeletePending: boolean
}
