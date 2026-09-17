import Realm from 'realm'
import type { RulesetSetting } from '../schema/types.js'
import type { RulesetShortName } from '../keybindings/types.js'
import { EntityQuery } from './base.js'

export class RulesetSettingQuery extends EntityQuery<RulesetSetting> {
  constructor(realm: Realm) { super(realm, 'RulesetSetting') }

  /** @example db.rulesetSettings.get.byRulesetName('osu') */
  byRulesetName(v: RulesetShortName)    { return this._str('RulesetName', '==', v) }
  /** @example db.rulesetSettings.get.byVariant(0) */
  byVariant(v: number)                 { return this._num('Variant', '==', v) }
  /** @example db.rulesetSettings.get.byKey('BeatmapListing') */
  byKey(v: string)                     { return this._str('Key', '==', v) }
  /** @example db.rulesetSettings.get.byKeyContains('Beatmap') */
  byKeyContains(v: string)             { return this._str('Key', 'CONTAINS[c]', v) }
  /** @example db.rulesetSettings.get.byValue('1') */
  byValue(v: string)                   { return this._str('Value', '==', v) }
  /** @example db.rulesetSettings.get.byValueContains('enabled') */
  byValueContains(v: string)           { return this._str('Value', 'CONTAINS[c]', v) }
}
