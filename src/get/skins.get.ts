import Realm from 'realm'
import type { Skin } from '../schema/types.js'
import { BUILT_IN_SKIN_IDS, BUILT_IN_SKIN_ORDER } from '../skin/constants.js'
import { EntityQuery } from './base.js'
import type { DeepReadonly } from '../types/readonly.js'

export class SkinQuery extends EntityQuery<Skin> {
  constructor(realm: Realm) { super(realm, 'Skin') }

  /** @example db.skins.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.skins.get.byName('WhiteCat')[0] */
  byName(v: string)                      { return this._str('Name', '==', v) }
  /** @example db.skins.get.byNameContains('White') */
  byNameContains(v: string)              { return this._str('Name', 'CONTAINS[c]', v) }
  /** @example db.skins.get.byCreatorContains('cyperdark') */
  byCreatorContains(v: string)           { return this._str('Creator', 'CONTAINS[c]', v) }
  /** @example db.skins.get.byHash(hash) */
  byHash(v: string)                      { return this._str('Hash', '==', v) }
  /** @example db.skins.get.byInstantiationInfoContains('osu.Game') */
  byInstantiationInfoContains(v: string) { return this._str('InstantiationInfo', 'CONTAINS[c]', v) }

  /** @example db.skins.get.byProtected(true) */
  byProtected(v: boolean)                { return this._bool('Protected', v) }
  /** @example db.skins.get.byDeletePending(true) */
  byDeletePending(v: boolean)            { return this._bool('DeletePending', v) }

  /** @example db.skins.get.withFile('cursor.png') */
  withFile(v: string)                    { return this._fkAny('Files.Filename', v) }

  /** @example db.skins.get.usable() */
  usable(): ReadonlyArray<DeepReadonly<Skin>> {
    const builtInMap = new Map<string, Skin>()
    for (const id of BUILT_IN_SKIN_IDS) {
      const s = this._realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(id))
      if (s) builtInMap.set(id, s)
    }
    const builtIn: Skin[] = []
    for (const id of BUILT_IN_SKIN_ORDER) {
      const s = builtInMap.get(id)
      if (s) builtIn.push(s)
    }
    const user = [...this._realm.objects<Skin>('Skin')
      .filtered('DeletePending == false AND Protected == false')
      .sorted('Name', false)]
      .filter(s => !BUILT_IN_SKIN_IDS.includes(String(s.ID)))
    return [...builtIn, ...user]
  }

  /** @example db.skins.get.builtIn() */
  builtIn(): ReadonlyArray<DeepReadonly<Skin>> {
    const result: Skin[] = []
    for (const id of BUILT_IN_SKIN_ORDER) {
      const s = this._realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(id))
      if (s) result.push(s)
    }
    return result
  }

  /** @example db.skins.get.user() */
  user(): ReadonlyArray<DeepReadonly<Skin>> {
    return [...this._realm.objects<Skin>('Skin')
      .filtered('DeletePending == false AND Protected == false')
      .sorted('Name', false)]
      .filter(s => !BUILT_IN_SKIN_IDS.includes(String(s.ID)))
  }
}
