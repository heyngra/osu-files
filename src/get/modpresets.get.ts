import Realm from 'realm'
import type { ModPreset } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class ModPresetQuery extends EntityQuery<ModPreset> {
  constructor(realm: Realm) { super(realm, 'ModPreset') }

  /** @example db.modPresets.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.modPresets.get.byNameEquals('HD') */
  byNameEquals(v: string)                { return this._str('Name', '==', v) }
  /** @example db.modPresets.get.byNameContains('DT') */
  byNameContains(v: string)              { return this._str('Name', 'CONTAINS[c]', v) }
  /** @example db.modPresets.get.byDescriptionContains('hidden') */
  byDescriptionContains(v: string)       { return this._str('Description', 'CONTAINS[c]', v) }
  /** @example db.modPresets.get.byModsContains('HD') */
  byModsContains(v: string)              { return this._str('Mods', 'CONTAINS[c]', v) }

  /** @example db.modPresets.get.byDeletePending(true) */
  byDeletePending(v: boolean)            { return this._bool('DeletePending', v) }

  /** @example db.modPresets.get.byRulesetShortNameEquals('osu') */
  byRulesetShortNameEquals(v: string)     { return this._fkEq('Ruleset.ShortName', v) }
}
