import type { ModPreset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createModPresetGetModule } from './get/modpresets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the mod preset sub-module with query and write operations.
 * @example
 * const mp = db.modPresets.get.byId(id)
 */
export function createModPresetModule(ctx: OsuFilesContext) {
  const get = createModPresetGetModule(ctx.realm)
  return { get, write: createCrud<ModPreset>(ctx, getConfig('ModPreset')!) }
}

/** Mod preset sub-module with query and write operations. */
export type ModPresetModule = ReturnType<typeof createModPresetModule>
