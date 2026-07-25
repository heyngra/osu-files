import type { BeatmapCollection } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createCollectionGetModule } from './get/collections.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap collection sub-module with query and write operations.
 * @example
 * const col = db.collections.get.byId(id)
 */
export function createCollectionModule(ctx: OsuFilesContext) {
  const get = createCollectionGetModule(ctx.realm)
  return { get, write: createCrud<BeatmapCollection>(ctx, getConfig('BeatmapCollection')!) }
}

/** Beatmap collection sub-module with query and write operations. */
export type BeatmapCollectionModule = ReturnType<typeof createCollectionModule>
