import type { OsuBeatmap } from '../beatmap/types.js'

export type BeatmapSetFile = {
  hash: string
  filename: string
}

export type BeatmapSetData = {
  onlineID: number
  status: number
  dateSubmitted?: Date
  dateRanked?: Date
  protected: boolean
  beatmaps: OsuBeatmap[]
  files: BeatmapSetFile[]
  setHash?: string
}
