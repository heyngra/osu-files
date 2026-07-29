export const BeatmapUserSettingsSchema = {
  name: 'BeatmapUserSettings',
  embedded: true,
  properties: {
    Offset: 'double',
  },
} as const
