import type { BeatmapSet } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapSetGetModule } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importSet as importSetFn, type ImportSetInput } from './write/set-import.js'
import type { BeatmapSetData } from './osz/types.js'

export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const get = createBeatmapSetGetModule(ctx.realm)
  return {
    ...get, get,
    write: createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!),
    importSet: (data: ImportSetInput): BeatmapSetData => importSetFn(ctx, data),
  }
}
