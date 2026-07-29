export const BeatmapCollectionSchema = {
  name: 'BeatmapCollection',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    Name: 'string?',
    BeatmapMD5Hashes: 'string?[]',
    LastModified: 'date',
  },
} as const
