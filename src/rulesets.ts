import type { Ruleset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { RulesetQuery } from './get/rulesets.get.js'
import type { QuerySurface } from './get/base.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the ruleset sub-module with query and write operations.
 * @example
 * const rs = db.rulesets.get.byShortNameEquals('osu')[0]
 */
export function createRulesetModule(ctx: OsuFilesContext): RulesetModule {
  const q = new RulesetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Queries readonly ruleset snapshots. */
    get: q.proxify(),
    /** Creates, updates, deletes, or upserts rulesets. */
    write: createCrud<Ruleset>(ctx, getConfig('Ruleset')!),
  }
}

/** Ruleset sub-module with query and write operations. */
export type RulesetModule = {
  /** Queries readonly ruleset snapshots. */
  readonly get: QuerySurface<Ruleset, RulesetQuery>
  /** Creates, updates, deletes, or upserts rulesets. */
  readonly write: Crud<Ruleset>
}
