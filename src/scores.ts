import type { Score } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createScoreGetModule } from './get/scores.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the score sub-module with query and write operations.
 * @example
 * const sc = db.scores.get.byId(id)
 */
export function createScoreModule(ctx: OsuFilesContext) {
  const get = createScoreGetModule(ctx.realm)
  return { get, write: createCrud<Score>(ctx, getConfig('Score')!) }
}

/** Score sub-module with query and write operations. */
export type ScoreModule = ReturnType<typeof createScoreModule>
