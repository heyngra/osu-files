import Realm from 'realm'
import type { Beatmap } from '../schema/types.js'
import type { RulesetShortName } from '../keybindings/types.js'
import { EntityQuery } from './base.js'

export class BeatmapQuery extends EntityQuery<Beatmap> {
  constructor(realm: Realm) { super(realm, 'Beatmap') }

  /** @example db.beatmaps.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)                      { return this._byUuidPk(v) }

  /** @example db.beatmaps.get.byBpmAbove(180) */
  byBpmAbove(v: number)                       { return this._num('BPM', '>=', v) }
  /** @example db.beatmaps.get.byBpmBelow(220) */
  byBpmBelow(v: number)                       { return this._num('BPM', '<=', v) }
  /** @example db.beatmaps.get.byBpmBetween(160, 200) */
  byBpmBetween(lo: number, hi: number)        { return this._numBetween('BPM', lo, hi) }
  /** @example db.beatmaps.get.byStarRatingAbove(5) */
  byStarRatingAbove(v: number)                { return this._num('StarRating', '>=', v) }
  /** @example db.beatmaps.get.byStarRatingBelow(7) */
  byStarRatingBelow(v: number)                { return this._num('StarRating', '<=', v) }
  /** @example db.beatmaps.get.byStarRatingBetween(3, 6) */
  byStarRatingBetween(lo: number, hi: number) { return this._numBetween('StarRating', lo, hi) }
  /** @example db.beatmaps.get.byLengthAbove(120000) */
  byLengthAbove(v: number)                    { return this._num('Length', '>=', v) }
  /** @example db.beatmaps.get.byLengthBelow(300000) */
  byLengthBelow(v: number)                    { return this._num('Length', '<=', v) }
  /** @example db.beatmaps.get.byLengthBetween(60000, 180000) */
  byLengthBetween(lo: number, hi: number)     { return this._numBetween('Length', lo, hi) }
  /** @example db.beatmaps.get.byBeatDivisorExact(4) */
  byBeatDivisorExact(v: number)               { return this._num('BeatDivisor', '==', v) }
  /** @example db.beatmaps.get.byOnlineIdExact(506483) */
  byOnlineIdExact(v: number)                  { return this._num('OnlineID', '==', v) }
  /** @example db.beatmaps.get.byStatusExact(1) */
  byStatusExact(v: number)                    { return this._num('Status', '==', v) }
  /** @example db.beatmaps.get.byTotalObjectCountAbove(500) */
  byTotalObjectCountAbove(v: number)          { return this._num('TotalObjectCount', '>=', v) }
  /** @example db.beatmaps.get.byTotalObjectCountBelow(1000) */
  byTotalObjectCountBelow(v: number)          { return this._num('TotalObjectCount', '<=', v) }
  /** @example db.beatmaps.get.byEndTimeObjectCountAbove(10) */
  byEndTimeObjectCountAbove(v: number)        { return this._num('EndTimeObjectCount', '>=', v) }
  /** @example db.beatmaps.get.byEndTimeObjectCountBelow(50) */
  byEndTimeObjectCountBelow(v: number)        { return this._num('EndTimeObjectCount', '<=', v) }

  /** @example db.beatmaps.get.byDifficultyNameEquals('Insane') */
  byDifficultyNameEquals(v: string)           { return this._str('DifficultyName', '==', v) }
  /** @example db.beatmaps.get.byDifficultyNameContains('Hard') */
  byDifficultyNameContains(v: string)         { return this._str('DifficultyName', 'CONTAINS[c]', v) }
  /** @example db.beatmaps.get.byHashEquals(hash)[0] */
  byHashEquals(v: string)                     { return this._str('Hash', '==', v) }
  /** @example db.beatmaps.get.byMd5Equals(md5)[0] */
  byMd5Equals(v: string)                      { return this._str('MD5Hash', '==', v) }

  /** @example db.beatmaps.get.byHidden(true) */
  byHidden(v: boolean)                        { return this._bool('Hidden', v) }

  /** @example db.beatmaps.get.byLastPlayedBefore(someDate) */
  byLastPlayedBefore(v: Date)                 { return this._date('LastPlayed', '<', v) }
  /** @example db.beatmaps.get.byLastPlayedAfter(someDate) */
  byLastPlayedAfter(v: Date)                  { return this._date('LastPlayed', '>', v) }
  /** @example db.beatmaps.get.byLastLocalUpdateBefore(someDate) */
  byLastLocalUpdateBefore(v: Date)            { return this._date('LastLocalUpdate', '<', v) }
  /** @example db.beatmaps.get.byLastLocalUpdateAfter(someDate) */
  byLastLocalUpdateAfter(v: Date)             { return this._date('LastLocalUpdate', '>', v) }
  /** @example db.beatmaps.get.byLastOnlineUpdateBefore(someDate) */
  byLastOnlineUpdateBefore(v: Date)           { return this._date('LastOnlineUpdate', '<', v) }
  /** @example db.beatmaps.get.byLastOnlineUpdateAfter(someDate) */
  byLastOnlineUpdateAfter(v: Date)            { return this._date('LastOnlineUpdate', '>', v) }

  /** @example db.beatmaps.get.byMetadataId(uuid)[0] */
  byMetadataId(v: string | Realm.BSON.UUID)   { return this._fkEq('Metadata.ID', this._uuid(v)) }
  /** @example db.beatmaps.get.bySetId(uuid)[0] */
  bySetId(v: string | Realm.BSON.UUID)        { return this._fkEq('BeatmapSet.ID', this._uuid(v)) }
  /** @example db.beatmaps.get.bySetOnlineIdExact(506483) */
  bySetOnlineIdExact(v: number)               { return this._fkEq('BeatmapSet.OnlineID', v) }
  /** @example db.beatmaps.get.byRulesetShortNameEquals('osu') */
  byRulesetShortNameEquals(v: RulesetShortName){ return this._fkEq('Ruleset.ShortName', v) }
  /** @example db.beatmaps.get.byMetadataTitleEquals('Make A Move') */
  byMetadataTitleEquals(v: string)            { return this._str('Metadata.Title', '==', v) }
  /** @example db.beatmaps.get.byMetadataTitleContains('Move') */
  byMetadataTitleContains(v: string)          { return this._str('Metadata.Title', 'CONTAINS[c]', v) }
  /** @example db.beatmaps.get.byMetadataArtistEquals('Icon For Hire') */
  byMetadataArtistEquals(v: string)           { return this._str('Metadata.Artist', '==', v) }
  /** @example db.beatmaps.get.byMetadataArtistContains('Hire') */
  byMetadataArtistContains(v: string)         { return this._str('Metadata.Artist', 'CONTAINS[c]', v) }
  /** @example db.beatmaps.get.byMetadataAuthorContains('wajinshu') */
  byMetadataAuthorContains(v: string)         { return this._str('Metadata.Author.Username', 'CONTAINS[c]', v) }
  /** @example db.beatmaps.get.byMetadataAuthorOnlineIdExact(124493) */
  byMetadataAuthorOnlineIdExact(v: number)    { return this._fkEq('Metadata.Author.OnlineID', v) }
}
