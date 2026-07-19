import type { BeatmapCollection } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createCollectionGetModule } from './get/collections.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createCollectionModule(ctx: OsuFilesContext) {
  const get = createCollectionGetModule(ctx.realm)
  return { ...get, get, write: createCrud<BeatmapCollection>(ctx, getConfig('BeatmapCollection')!) }
}
