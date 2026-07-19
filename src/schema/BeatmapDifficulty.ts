import type { BeatmapDifficulty } from './types.js'

export type { BeatmapDifficulty }
export type { BeatmapDifficulty as default }

export const BeatmapDifficultySchema = {
  name: 'BeatmapDifficulty',
  embedded: true,
  properties: {
    DrainRate: 'float',
    CircleSize: 'float',
    OverallDifficulty: 'float',
    ApproachRate: 'float',
    SliderMultiplier: 'double',
    SliderTickRate: 'double',
  },
} as const
