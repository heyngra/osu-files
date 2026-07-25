import type { BeatmapMetadata } from './types.js'

export type { BeatmapMetadata }
export type { BeatmapMetadata as default }

export const BeatmapMetadataSchema = {
  name: 'BeatmapMetadata',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    Title: 'string?',
    TitleUnicode: 'string?',
    Artist: 'string?',
    ArtistUnicode: 'string?',
    Author: 'RealmUser',
    Source: 'string?',
    Tags: 'string?',
    PreviewTime: 'int',
    AudioFile: 'string?',
    BackgroundFile: 'string?',
    UserTags: 'string?[]',
  },
} as const
