import type { Beatmap } from './types.js'

export type { Beatmap }
export type { Beatmap as default }

export const BeatmapSchema = {
  name: 'Beatmap',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    DifficultyName: 'string?',
    Ruleset: 'Ruleset',
    Difficulty: 'BeatmapDifficulty',
    Metadata: 'BeatmapMetadata',
    BeatmapSet: 'BeatmapSet',
    Status: 'int',
    OnlineID: { type: 'int', indexed: true },
    Length: 'double',
    BPM: 'double',
    Hash: 'string?',
    StarRating: 'double',
    MD5Hash: { type: 'string', indexed: true, optional: true },
    Hidden: 'bool',
    BeatDivisor: 'int',
    UserSettings: 'BeatmapUserSettings',
    OnlineMD5Hash: 'string?',
    LastLocalUpdate: 'date?',
    LastOnlineUpdate: 'date?',
    LastPlayed: 'date?',
    EditorTimestamp: 'double?',
    EndTimeObjectCount: 'int',
    TotalObjectCount: 'int',
  },
} as const
