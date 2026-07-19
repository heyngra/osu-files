import type { Ruleset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createRulesetGetModule } from './get/rulesets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createRulesetModule(ctx: OsuFilesContext) {
  const get = createRulesetGetModule(ctx.realm)
  return { ...get, get, write: createCrud<Ruleset>(ctx, getConfig('Ruleset')!) }
}
