import type { BeatmapSet } from './types.js'

export type { BeatmapSet }
export type { BeatmapSet as default }

export const BeatmapSetSchema = {
  name: 'BeatmapSet',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    OnlineID: { type: 'int', indexed: true },
    DateAdded: 'date',
    Beatmaps: 'Beatmap[]',
    Files: 'RealmNamedFileUsage[]',
    Status: 'int',
    DeletePending: 'bool',
    Hash: 'string?',
    Protected: 'bool',
    DateSubmitted: 'date?',
    DateRanked: 'date?',
  },
} as const
