import type { KeyBinding } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { KeyBindingQuery } from './get/keybindings.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the key binding sub-module with query and write operations.
 * @example
 * const kb = db.keyBindings.get.byRulesetNameEquals('osu')[0]
 */
export function createKeyBindingModule(ctx: OsuFilesContext) {
  const q = new KeyBindingQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<KeyBinding>(ctx, getConfig('KeyBinding')!) }
}

/** Key binding sub-module with query and write operations. */
export type KeyBindingModule = ReturnType<typeof createKeyBindingModule>
