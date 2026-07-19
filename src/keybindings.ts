import type { KeyBinding } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createKeyBindingGetModule } from './get/keybindings.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createKeyBindingModule(ctx: OsuFilesContext) {
  const get = createKeyBindingGetModule(ctx.realm)
  return { ...get, get, write: createCrud<KeyBinding>(ctx, getConfig('KeyBinding')!) }
}
