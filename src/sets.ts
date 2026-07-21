import Realm from 'realm'
import type { BeatmapSet } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapSetGetModule } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importSet as importSetFn, type ImportSetInput } from './write/set-import.js'
import type { BeatmapSetData } from './osz/types.js'
import { cleanupOrphanedFiles } from './files.js'

export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const get = createBeatmapSetGetModule(ctx.realm)
  const write = createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!)
  return {
    ...get, get,
    write,
    importSet: (data: ImportSetInput): BeatmapSetData => importSetFn(ctx, data),
    delete: (setId: string): void => {
      const set = get.byId(setId)
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      write.update(set.ID, { DeletePending: true })
      cleanupOrphanedFiles(ctx)
    },
  }
}
