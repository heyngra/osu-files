import Realm from 'realm'
import type { Ruleset } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class RulesetQuery extends EntityQuery<Ruleset> {
  constructor(realm: Realm) { super(realm, 'Ruleset') }

  /** @example db.rulesets.get.byShortNameEquals('osu')[0] */
  byShortNameEquals(v: string)        { return this._str('ShortName', '==', v) }
  /** @example db.rulesets.get.byOnlineIdExact(0)[0] */
  byOnlineIdExact(v: number)          { return this._num('OnlineID', '==', v) }
  /** @example db.rulesets.get.byNameEquals('osu!') */
  byNameEquals(v: string)             { return this._str('Name', '==', v) }
  /** @example db.rulesets.get.byNameContains('taiko') */
  byNameContains(v: string)           { return this._str('Name', 'CONTAINS[c]', v) }
  /** @example db.rulesets.get.byAvailable(true) */
  byAvailable(v: boolean)             { return this._bool('Available', v) }
}
