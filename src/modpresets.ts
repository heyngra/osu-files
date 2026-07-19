import type Realm from 'realm'
import type { ModPreset } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createModPresetGetModule } from './get/modpresets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createModPresetModule(realm: Realm, logger: RollbackLogger) {
  const get = createModPresetGetModule(realm)
  return { ...get, get, write: createCrud<ModPreset>(realm, logger, getConfig('ModPreset')!) }
}
