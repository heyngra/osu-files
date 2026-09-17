import Realm from 'realm'
import type { KeyBinding } from '../schema/types.js'
import type { RulesetShortName } from '../keybindings/types.js'
import { EntityQuery } from './base.js'

export class KeyBindingQuery extends EntityQuery<KeyBinding> {
  constructor(realm: Realm) { super(realm, 'KeyBinding') }

  /** @example db.keybindings.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.keybindings.get.byRulesetName('osu') */
  byRulesetName(v: RulesetShortName)        { return this._str('RulesetName', '==', v) }
  /** @example db.keybindings.get.byAction(1) */
  byAction(v: number)                       { return this._num('Action', '==', v) }
  /** @example db.keybindings.get.byVariant(0) */
  byVariant(v: number)                      { return this._num('Variant', '==', v) }
}
