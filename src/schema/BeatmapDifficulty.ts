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
