import type Realm from 'realm'
import type { Skin } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createSkinGetModule } from './get/skins.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createSkinModule(realm: Realm, logger: RollbackLogger) {
  const get = createSkinGetModule(realm)
  return { ...get, get, write: createCrud<Skin>(realm, logger, getConfig('Skin')!) }
}
