import type { Skin } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createSkinGetModule } from './get/skins.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createSkinModule(ctx: OsuFilesContext) {
  const get = createSkinGetModule(ctx.realm)
  return { ...get, get, write: createCrud<Skin>(ctx, getConfig('Skin')!) }
}
