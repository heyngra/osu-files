import type { Score } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createScoreGetModule } from './get/scores.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createScoreModule(ctx: OsuFilesContext) {
  const get = createScoreGetModule(ctx.realm)
  return { ...get, get, write: createCrud<Score>(ctx, getConfig('Score')!) }
}
