import type Realm from 'realm'
import type { Beatmap } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createBeatmapGetModule } from './get/beatmaps.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createBeatmapModule(realm: Realm, logger: RollbackLogger) {
  const get = createBeatmapGetModule(realm)
  return { ...get, get, write: createCrud<Beatmap>(realm, logger, getConfig('Beatmap')!) }
}
