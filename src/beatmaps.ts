import type { Beatmap } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { BeatmapQuery } from './get/beatmaps.get.js'
import type { Beatmaps } from './get/facades.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap module with read-only results and write operations.
 * @example
 * const bm = db.beatmaps.get.byBpmAbove(180)[0]
 */
export function createBeatmapModule(ctx: OsuFilesContext): BeatmapModule {
  const q = new BeatmapQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify() as unknown as Beatmaps, write: createCrud<Beatmap>(ctx, getConfig('Beatmap')!) }
}

/** Beatmap module with read-only results and write operations. */
export type BeatmapUpdatePatch = Partial<Omit<Beatmap, 'ID' | 'Hash' | 'MD5Hash'>>
export interface BeatmapModule {
  /** Returns read-only beatmap snapshots through `get`. */
  readonly get: Beatmaps
  /** Creates, updates, deletes, or upserts beatmaps. */
  readonly write: Crud<Beatmap>
}
