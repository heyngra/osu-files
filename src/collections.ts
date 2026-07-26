import type { BeatmapCollection } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { CollectionQuery } from './get/collections.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap collection sub-module with query and write operations.
 * @example
 * const col = db.collections.get.byNameContains('Favorite')[0]
 */
export function createCollectionModule(ctx: OsuFilesContext) {
  const q = new CollectionQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<BeatmapCollection>(ctx, getConfig('BeatmapCollection')!) }
}

/** Beatmap collection sub-module with query and write operations. */
export type BeatmapCollectionModule = ReturnType<typeof createCollectionModule>
