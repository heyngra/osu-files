import type { ModPreset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { ModPresetQuery } from './get/modpresets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the mod preset sub-module with query and write operations.
 * @example
 * const mp = db.modPresets.get.byNameContains('HD')[0]
 */
export function createModPresetModule(ctx: OsuFilesContext) {
  const q = new ModPresetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<ModPreset>(ctx, getConfig('ModPreset')!) }
}

/** Mod preset sub-module with query and write operations. */
export type ModPresetModule = ReturnType<typeof createModPresetModule>
