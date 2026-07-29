import Realm from 'realm'
import type { KeyBinding } from '../schema/types.js'
import type { RulesetShortName } from '../keybindings/types.js'
import { EntityQuery } from './base.js'

export class KeyBindingQuery extends EntityQuery<KeyBinding> {
  constructor(realm: Realm) { super(realm, 'KeyBinding') }

  /** @example db.keybindings.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.keybindings.get.byRulesetNameEquals('osu') */
  byRulesetNameEquals(v: RulesetShortName)   { return this._str('RulesetName', '==', v) }
  /** @example db.keybindings.get.byActionExact(1) */
  byActionExact(v: number)         { return this._num('Action', '==', v) }
  /** @example db.keybindings.get.byVariantExact(0) */
  byVariantExact(v: number)        { return this._num('Variant', '==', v) }
}
