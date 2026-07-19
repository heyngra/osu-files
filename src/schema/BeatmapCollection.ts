import type { BeatmapCollection } from './types.js'

export type { BeatmapCollection }
export type { BeatmapCollection as default }

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
