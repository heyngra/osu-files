import type { RulesetSetting } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import type { RulesetShortName } from './keybindings/types.js'
import { RulesetSettingQuery } from './get/rulesetsettings.get.js'
import type { QuerySurface } from './get/base.js'
import { LogAction } from './write/logger.js'
import { assertWritable, markChanged, writeRealm } from './context.js'

function serializeSetting(s: RulesetSetting): Record<string, unknown> {
  return { RulesetName: s.RulesetName, Variant: s.Variant, Key: s.Key, Value: s.Value }
}

export function createRulesetSettingModule(ctx: OsuFilesContext): RulesetSettingModule {
  const query = new RulesetSettingQuery(ctx.realm)
  query.enableCache = ctx.queryCache ?? true
  const get = query.proxify()
  const liveGet = get.live()

  const findSetting = (rulesetName: RulesetShortName, variant: number, key: string) =>
    liveGet.byRulesetNameEquals(rulesetName).byVariantExact(variant).byKeyEquals(key)[0]

  function getSettings(rulesetName: RulesetShortName, variant = 0): Record<string, string> {
    const map: Record<string, string> = {}
    for (const setting of get.byRulesetNameEquals(rulesetName).byVariantExact(variant))
      map[setting.Key] = setting.Value
    return map
  }

  function setSetting(rulesetName: RulesetShortName, key: string, value: string, variant = 0): void {
    assertWritable(ctx)
    const settingKey = `${rulesetName}/${variant}/${key}`
    const existing = findSetting(rulesetName, variant, key) as unknown as RulesetSetting | undefined
    if (existing) {
      const before = serializeSetting(existing)
      writeRealm(ctx, () => { existing.Value = value })
      markChanged(ctx)
      ctx.logger.log('RulesetSetting', LogAction.Update, settingKey, before, serializeSetting(existing))
    } else {
      writeRealm(ctx, () => {
        ctx.realm.create<RulesetSetting>('RulesetSetting', {
          RulesetName: rulesetName, Variant: variant, Key: key, Value: value,
        })
      })
      markChanged(ctx)
      ctx.logger.log('RulesetSetting', LogAction.Create, settingKey, null, { RulesetName: rulesetName, Variant: variant, Key: key, Value: value })
    }
  }

  function removeSetting(rulesetName: RulesetShortName, key: string, variant = 0): void {
    assertWritable(ctx)
    const settingKey = `${rulesetName}/${variant}/${key}`
    const existing = findSetting(rulesetName, variant, key)
    if (existing) {
      const before = serializeSetting(existing)
      writeRealm(ctx, () => { ctx.realm.delete(existing) })
      markChanged(ctx)
      ctx.logger.log('RulesetSetting', LogAction.Delete, settingKey, before, null)
    }
  }

  return {
    /** Queries readonly ruleset settings. */
    get,
    /** Returns settings for one ruleset and variant. */
    getSettings,
    /** Sets one ruleset setting. */
    setSetting,
    /** Removes one ruleset setting. */
    removeSetting,
  }
}

export type RulesetSettingModule = {
  /** Queries readonly ruleset settings. */
  readonly get: QuerySurface<RulesetSetting, RulesetSettingQuery>
  /** Returns settings for one ruleset and variant. */
  getSettings(rulesetName: RulesetShortName, variant?: number): Record<string, string>
  /** Sets one ruleset setting. */
  setSetting(rulesetName: RulesetShortName, key: string, value: string, variant?: number): void
  /** Removes one ruleset setting. */
  removeSetting(rulesetName: RulesetShortName, key: string, variant?: number): void
}
