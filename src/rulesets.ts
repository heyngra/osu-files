import type { Ruleset } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { RulesetQuery } from './get/rulesets.get.js'
import type { Rulesets } from './get/facades.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the ruleset module with read-only results and write operations.
 * @example
 * const rs = db.rulesets.get.byShortName('osu')[0]
 */
export function createRulesetModule(ctx: OsuFilesContext): RulesetModule {
  const q = new RulesetQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Returns read-only ruleset snapshots through `get`. */
    get: q.proxify() as unknown as Rulesets,
    /** Creates, updates, deletes, or upserts rulesets. */
    write: createCrud<Ruleset>(ctx, getConfig('Ruleset')!),
  }
}

/** Ruleset module with read-only results and write operations. */
export type RulesetModule = {
  /** Returns read-only ruleset snapshots through `get`. */
  readonly get: Rulesets
  /** Creates, updates, deletes, or upserts rulesets. */
  readonly write: Crud<Ruleset>
}
