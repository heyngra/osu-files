import type { Beatmap } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapGetModule } from './get/beatmaps.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap sub-module with query and write operations.
 * @example
 * const bm = db.beatmaps.byId(id)
 */
export function createBeatmapModule(ctx: OsuFilesContext) {
  const get = createBeatmapGetModule(ctx.realm)
  return { get, write: createCrud<Beatmap>(ctx, getConfig('Beatmap')!) }
}

/** Beatmap sub-module with query and write operations. */
export type BeatmapModule = ReturnType<typeof createBeatmapModule>
