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
