import type Realm from 'realm'
import type { BeatmapSet } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createBeatmapSetGetModule } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createBeatmapSetModule(realm: Realm, logger: RollbackLogger) {
  const get = createBeatmapSetGetModule(realm)
  return { ...get, get, write: createCrud<BeatmapSet>(realm, logger, getConfig('BeatmapSet')!) }
}
