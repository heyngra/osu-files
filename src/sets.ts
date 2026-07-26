import Realm from 'realm'
import type { BeatmapSet } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { SetQuery } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importSet as importSetFn, type ImportSetInput } from './write/set-import.js'
import type { BeatmapSetData } from './osz/types.js'
import { cleanupOrphanedFiles } from './files.js'

/**
 * Creates the beatmap set sub-module with query, write, import, and delete operations.
 * @example
 * const set = db.sets.get.byOnlineIdExact(506483)[0]
 */
export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const raw = new SetQuery(ctx.realm)
  raw.enableCache = ctx.queryCache ?? true
  const get = raw.proxify()
  const write = createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!)
  return {
    get,
    write,
    importSet: (data: ImportSetInput): BeatmapSetData => importSetFn(ctx, data),
    delete: (setId: string): void => {
      const set = get.byId(setId)[0]
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      write.update(set.ID, { DeletePending: true })
      cleanupOrphanedFiles(ctx)
    },
  }
}

/** Beatmap set sub-module with query, write, import, and delete operations. */
export type BeatmapSetModule = ReturnType<typeof createBeatmapSetModule>
