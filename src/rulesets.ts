import type Realm from 'realm'
import type { Ruleset } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createRulesetGetModule } from './get/rulesets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createRulesetModule(realm: Realm, logger: RollbackLogger) {
  const get = createRulesetGetModule(realm)
  return { ...get, get, write: createCrud<Ruleset>(realm, logger, getConfig('Ruleset')!) }
}
