import type { OsuBeatmap } from '../beatmap/types.js'

/** A file within a beatmap set (hash + filename). */
export type BeatmapSetFile = {
  hash: string
  filename: string
}

/**
 * Full beatmap set data used for .osz import/export.
 * @example
 * const data = await db.osz.import('map.osz')
 * data.beatmaps.forEach(b => ...)
 */
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
