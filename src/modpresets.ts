import type { ModPreset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { ModPresetQuery } from './get/modpresets.get.js'
import type { QuerySurface } from './get/base.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the mod preset sub-module with query and write operations.
 * @example
 * const mp = db.modpresets.get.byNameContains('HD')[0]
 */
export function createModPresetModule(ctx: OsuFilesContext): ModPresetModule {
  const q = new ModPresetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Queries readonly mod-preset snapshots. */
    get: q.proxify(),
    /** Creates, updates, deletes, or upserts mod presets. */
    write: createCrud<ModPreset>(ctx, getConfig('ModPreset')!),
  }
}

/** Mod preset sub-module with query and write operations. */
export type ModPresetModule = {
  /** Queries readonly mod-preset snapshots. */
  readonly get: QuerySurface<ModPreset, ModPresetQuery>
  /** Creates, updates, deletes, or upserts mod presets. */
  readonly write: Crud<ModPreset>
}
