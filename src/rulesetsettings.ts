import type { RulesetSetting } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { RulesetSettingQuery } from './get/rulesetsettings.get.js'

export function createRulesetSettingModule(ctx: OsuFilesContext) {
  const q = new RulesetSettingQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  const get = q.proxify()

  function getSettings(rulesetName: string, variant = 0): Record<string, string> {
    const map: Record<string, string> = {}
    for (const s of get.byRulesetNameEquals(rulesetName).byVariantExact(variant))
      map[s.Key] = s.Value
    return map
  }

  function setSetting(rulesetName: string, key: string, value: string, variant = 0): void {
    const existing = get.byRulesetNameEquals(rulesetName).byVariantExact(variant).byKeyEquals(key)[0]
    if (existing) {
      ctx.realm.write(() => { existing.Value = value })
    } else {
      ctx.realm.write(() => {
        ctx.realm.create<RulesetSetting>('RulesetSetting', {
          RulesetName: rulesetName, Variant: variant, Key: key, Value: value,
        })
      })
    }
  }

  function removeSetting(rulesetName: string, key: string, variant = 0): void {
    const existing = get.byRulesetNameEquals(rulesetName).byVariantExact(variant).byKeyEquals(key)[0]
    if (existing) ctx.realm.write(() => { ctx.realm.delete(existing) })
  }

  return { get, getSettings, setSetting, removeSetting }
}

export type RulesetSettingModule = ReturnType<typeof createRulesetSettingModule>
