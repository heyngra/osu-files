import type Realm from 'realm'
import type { Score } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createScoreGetModule } from './get/scores.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createScoreModule(realm: Realm, logger: RollbackLogger) {
  const get = createScoreGetModule(realm)
  return { ...get, get, write: createCrud<Score>(realm, logger, getConfig('Score')!) }
}
