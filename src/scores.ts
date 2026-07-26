import type { Score } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { ScoreQuery } from './get/scores.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the score sub-module with query and write operations.
 * @example
 * const sc = db.scores.get.byAccuracyAbove(0.95)[0]
 */
export function createScoreModule(ctx: OsuFilesContext) {
  const q = new ScoreQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<Score>(ctx, getConfig('Score')!) }
}

/** Score sub-module with query and write operations. */
export type ScoreModule = ReturnType<typeof createScoreModule>
