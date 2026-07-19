import type { BeatmapUserSettings } from './types.js'

export type { BeatmapUserSettings }
export type { BeatmapUserSettings as default }

export const BeatmapUserSettingsSchema = {
  name: 'BeatmapUserSettings',
  embedded: true,
  properties: {
    Offset: 'double',
  },
} as const
