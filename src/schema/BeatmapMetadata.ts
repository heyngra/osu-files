export const BeatmapMetadataSchema = {
  name: 'BeatmapMetadata',
  properties: {
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
