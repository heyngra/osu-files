import Realm from 'realm'
import type { BeatmapSet } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class SetQuery extends EntityQuery<BeatmapSet> {
  constructor(realm: Realm) { super(realm, 'BeatmapSet') }

  /** @example db.sets.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.sets.get.byOnlineId(506483)[0] */
  byOnlineId(v: number)                  { return this._num('OnlineID', '==', v) }
  /** @example db.sets.get.byStatus(1) */
  byStatus(v: number)                    { return this._num('Status', '==', v) }

  /** @example db.sets.get.byHash(hash)[0] */
  byHash(v: string)                      { return this._str('Hash', '==', v) }

  /** @example db.sets.get.byDeletePending(true) */
  byDeletePending(v: boolean)            { return this._bool('DeletePending', v) }
  /** @example db.sets.get.byProtected(true) */
  byProtected(v: boolean)                { return this._bool('Protected', v) }

  /** @example db.sets.get.byDateAddedBefore(someDate) */
  byDateAddedBefore(v: Date)             { return this._date('DateAdded', '<', v) }
  /** @example db.sets.get.byDateAddedAfter(someDate) */
  byDateAddedAfter(v: Date)              { return this._date('DateAdded', '>', v) }
  /** @example db.sets.get.byDateSubmittedBefore(someDate) */
  byDateSubmittedBefore(v: Date)         { return this._date('DateSubmitted', '<', v) }
  /** @example db.sets.get.byDateSubmittedAfter(someDate) */
  byDateSubmittedAfter(v: Date)          { return this._date('DateSubmitted', '>', v) }
  /** @example db.sets.get.byDateRankedBefore(someDate) */
  byDateRankedBefore(v: Date)            { return this._date('DateRanked', '<', v) }
  /** @example db.sets.get.byDateRankedAfter(someDate) */
  byDateRankedAfter(v: Date)             { return this._date('DateRanked', '>', v) }

  /** @example db.sets.get.byBeatmapMd5(md5)[0] */
  byBeatmapMd5(v: string)                { return this._fkAny('Beatmaps.MD5Hash', v) }
  /** @example db.sets.get.byBeatmapOnlineId(506483)[0] */
  byBeatmapOnlineId(v: number)           { return this._fkAny('Beatmaps.OnlineID', v) }
  /** @example db.sets.get.withFile('audio.mp3')[0] */
  withFile(v: string)                    { return this._fkAny('Files.Filename', v) }
}
