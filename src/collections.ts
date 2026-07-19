import type Realm from 'realm'
import type { BeatmapCollection } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createCollectionGetModule } from './get/collections.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createCollectionModule(realm: Realm, logger: RollbackLogger) {
  const get = createCollectionGetModule(realm)
  return { ...get, get, write: createCrud<BeatmapCollection>(realm, logger, getConfig('BeatmapCollection')!) }
}
