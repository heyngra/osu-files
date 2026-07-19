import type Realm from 'realm'
import type { KeyBinding } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createKeyBindingGetModule } from './get/keybindings.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createKeyBindingModule(realm: Realm, logger: RollbackLogger) {
  const get = createKeyBindingGetModule(realm)
  return { ...get, get, write: createCrud<KeyBinding>(realm, logger, getConfig('KeyBinding')!) }
}
