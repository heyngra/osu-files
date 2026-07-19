import type { Beatmap } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapGetModule } from './get/beatmaps.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createBeatmapModule(ctx: OsuFilesContext) {
  const get = createBeatmapGetModule(ctx.realm)
  return { ...get, get, write: createCrud<Beatmap>(ctx, getConfig('Beatmap')!) }
}
