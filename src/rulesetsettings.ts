import type { RulesetSetting } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { RulesetSettingQuery } from './get/rulesetsettings.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createRulesetSettingModule(ctx: OsuFilesContext) {
  const q = new RulesetSettingQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<RulesetSetting>(ctx, getConfig('RulesetSetting')!) }
}

export type RulesetSettingModule = ReturnType<typeof createRulesetSettingModule>
