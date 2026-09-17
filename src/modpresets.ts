import type { ModPreset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { ModPresetQuery } from './get/modpresets.get.js'
import type { ModPresets } from './get/facades.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the mod-preset module with read-only results and write operations.
 * @example
 * const mp = db.modpresets.get.byNameContains('HD')[0]
 */
export function createModPresetModule(ctx: OsuFilesContext): ModPresetModule {
  const q = new ModPresetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Returns read-only mod-preset snapshots through `get`. */
    get: q.proxify() as unknown as ModPresets,
    /** Creates, updates, deletes, or upserts mod presets. */
    write: createCrud<ModPreset>(ctx, getConfig('ModPreset')!),
  }
}

/** Mod-preset module with read-only results and write operations. */
export type ModPresetModule = {
  /** Returns read-only mod-preset snapshots through `get`. */
  readonly get: ModPresets
  /** Creates, updates, deletes, or upserts mod presets. */
  readonly write: Crud<ModPreset>
}
