import type { Beatmap } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { BeatmapQuery } from './get/beatmaps.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap sub-module with query and write operations.
 * @example
 * const bm = db.beatmaps.get.byBpmAbove(180)[0]
 */
export function createBeatmapModule(ctx: OsuFilesContext) {
  const q = new BeatmapQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<Beatmap>(ctx, getConfig('Beatmap')!) }
}

/** Beatmap sub-module with query and write operations. */
export type BeatmapUpdatePatch = Partial<Omit<Beatmap, 'ID' | 'Hash' | 'MD5Hash'>>
export interface BeatmapModule {
  /** Queries readonly beatmap snapshots. */
  readonly get: ReturnType<BeatmapQuery['proxify']>
  /** Creates, updates, deletes, or upserts beatmaps. */
  readonly write: ReturnType<typeof createCrud<Beatmap>>
}
