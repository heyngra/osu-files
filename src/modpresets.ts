import type { ModPreset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createModPresetGetModule } from './get/modpresets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createModPresetModule(ctx: OsuFilesContext) {
  const get = createModPresetGetModule(ctx.realm)
  return { ...get, get, write: createCrud<ModPreset>(ctx, getConfig('ModPreset')!) }
}
