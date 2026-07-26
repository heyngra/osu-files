import type { Ruleset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { RulesetQuery } from './get/rulesets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the ruleset sub-module with query and write operations.
 * @example
 * const rs = db.rulesets.get.byShortNameEquals('osu')[0]
 */
export function createRulesetModule(ctx: OsuFilesContext) {
  const q = new RulesetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<Ruleset>(ctx, getConfig('Ruleset')!) }
}

/** Ruleset sub-module with query and write operations. */
export type RulesetModule = ReturnType<typeof createRulesetModule>
