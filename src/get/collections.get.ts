import Realm from 'realm'
import type { BeatmapCollection } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class CollectionQuery extends EntityQuery<BeatmapCollection> {
  constructor(realm: Realm) { super(realm, 'BeatmapCollection') }

  /** @example db.collections.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.collections.get.byName('Favorites')[0] */
  byName(v: string)                      { return this._str('Name', '==', v) }
  /** @example db.collections.get.byNameContains('Fav')[0] */
  byNameContains(v: string)              { return this._str('Name', 'CONTAINS[c]', v) }

  /** @example db.collections.get.byLastModifiedBefore(someDate) */
  byLastModifiedBefore(v: Date)          { return this._date('LastModified', '<', v) }
  /** @example db.collections.get.byLastModifiedAfter(someDate) */
  byLastModifiedAfter(v: Date)           { return this._date('LastModified', '>', v) }

  /** @example db.collections.get.withBeatmap(md5) */
  withBeatmap(v: string)                 { return this._fkAny('BeatmapMD5Hashes', v) }

  /** @example db.collections.get.sortedByName() */
  sortedByName(ascending = true)          { return this.sortedBy('Name', ascending) }
  /** @example db.collections.get.sortedByLastModified() */
  sortedByLastModified(ascending = false) { return this.sortedBy('LastModified', ascending) }
}
