import type { BeatmapSet } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapSetGetModule } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const get = createBeatmapSetGetModule(ctx.realm)
  return { ...get, get, write: createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!) }
}
