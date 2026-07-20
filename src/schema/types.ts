import type { BSON } from 'realm'

export type Beatmap = {
  ID: BSON.UUID
  DifficultyName?: string
  Ruleset?: Ruleset
  Difficulty?: BeatmapDifficulty
  Metadata?: BeatmapMetadata
  BeatmapSet?: BeatmapSet
  Status: number
  OnlineID: number
  Length: number
  BPM: number
  Hash?: string
  StarRating: number
  MD5Hash?: string
  Hidden: boolean
  BeatDivisor: number
  UserSettings?: BeatmapUserSettings
  OnlineMD5Hash?: string
  LastLocalUpdate?: Date
  LastOnlineUpdate?: Date
  LastPlayed?: Date
  EditorTimestamp?: number
  EndTimeObjectCount: number
  TotalObjectCount: number
}

export type BeatmapCollection = {
  ID: BSON.UUID
  Name?: string
  BeatmapMD5Hashes: Array<string | undefined>
  LastModified: Date
}

export type BeatmapDifficulty = {
  DrainRate: number
  CircleSize: number
  OverallDifficulty: number
  ApproachRate: number
  SliderMultiplier: number
  SliderTickRate: number
}

export type BeatmapMetadata = {
  Title?: string
  TitleUnicode?: string
  Artist?: string
  ArtistUnicode?: string
  Author?: RealmUser
  Source?: string
  Tags?: string
  PreviewTime: number
  AudioFile?: string
  BackgroundFile?: string
  UserTags: Array<string | undefined>
}

export type BeatmapSet = {
  ID: BSON.UUID
  OnlineID: number
  DateAdded: Date
  Beatmaps: Array<Beatmap>
  Files: Array<RealmNamedFileUsage>
  Status: number
  DeletePending: boolean
  Hash?: string
  Protected: boolean
  DateSubmitted?: Date
  DateRanked?: Date
}

export type BeatmapUserSettings = {
  Offset: number
}

export type File = {
  Hash?: string
}

export type KeyBinding = {
  ID: BSON.UUID
  RulesetName?: string
  Variant?: number
  Action: number
  KeyCombination?: string
}

export type ModPreset = {
  ID: BSON.UUID
  Ruleset?: Ruleset
  Name?: string
  Description?: string
  Mods?: string
  DeletePending: boolean
}

export type RealmNamedFileUsage = {
  File?: RealmFile
  Filename?: string
}

export type RealmFile = {
  Hash?: string
}

export type RealmUser = {
  OnlineID: number
  Username?: string
  CountryCode?: string
}

export type Ruleset = {
  ShortName?: string
  OnlineID: number
  Name?: string
  InstantiationInfo?: string
  Available: boolean
  LastAppliedDifficultyVersion: number
}

export type RulesetSetting = {
  RulesetName?: string
  Variant: number
  Key: string
  Value: string
}

export type Score = {
  ID: BSON.UUID
  BeatmapInfo?: Beatmap
  Ruleset?: Ruleset
  Files: Array<RealmNamedFileUsage>
  Hash?: string
  DeletePending: boolean
  TotalScore: number
  MaxCombo: number
  Accuracy: number
  Date: Date
  PP?: number
  OnlineID: number
  User?: RealmUser
  Mods?: string
  Statistics?: string
  Rank: number
  Combo: number
  MaximumStatistics?: string
  BeatmapHash?: string
  IsLegacyScore: boolean
  ClientVersion?: string
  TotalScoreWithoutMods: number
  TotalScoreVersion: number
  LegacyTotalScore?: number
  BackgroundReprocessingFailed: boolean
  LegacyOnlineID: number
  Pauses: Array<number>
}

export type Skin = {
  ID: BSON.UUID
  Name?: string
  Creator?: string
  InstantiationInfo?: string
  Hash?: string
  Protected: boolean
  Files: Array<RealmNamedFileUsage>
  DeletePending: boolean
}
