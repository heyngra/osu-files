import Realm from 'realm'
import type { RulesetSetting } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class RulesetSettingQuery extends EntityQuery<RulesetSetting> {
  constructor(realm: Realm) { super(realm, 'RulesetSetting') }

  /** @example db.rulesetSettings.get.byRulesetNameEquals('osu') */
  byRulesetNameEquals(v: string)       { return this._str('RulesetName', '==', v) }
  /** @example db.rulesetSettings.get.byVariantExact(0) */
  byVariantExact(v: number)            { return this._num('Variant', '==', v) }
  /** @example db.rulesetSettings.get.byKeyEquals('BeatmapListing') */
  byKeyEquals(v: string)               { return this._str('Key', '==', v) }
  /** @example db.rulesetSettings.get.byKeyContains('Beatmap') */
  byKeyContains(v: string)             { return this._str('Key', 'CONTAINS[c]', v) }
  /** @example db.rulesetSettings.get.byValueEquals('1') */
  byValueEquals(v: string)             { return this._str('Value', '==', v) }
  /** @example db.rulesetSettings.get.byValueContains('enabled') */
  byValueContains(v: string)           { return this._str('Value', 'CONTAINS[c]', v) }
}
