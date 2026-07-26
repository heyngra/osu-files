import Realm from 'realm'
import type { Score } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class ScoreQuery extends EntityQuery<Score> {
  constructor(realm: Realm) { super(realm, 'Score') }

  /** @example db.scores.get.byId(uuid)[0] */
  byId(v: string | Realm.BSON.UUID)             { return this._byUuidPk(v) }

  /** @example db.scores.get.byTotalScoreAbove(1000000) */
  byTotalScoreAbove(v: number)          { return this._num('TotalScore', '>=', v) }
  /** @example db.scores.get.byTotalScoreBelow(500000) */
  byTotalScoreBelow(v: number)          { return this._num('TotalScore', '<=', v) }
  /** @example db.scores.get.byMaxComboAbove(500) */
  byMaxComboAbove(v: number)            { return this._num('MaxCombo', '>=', v) }
  /** @example db.scores.get.byMaxComboBelow(1000) */
  byMaxComboBelow(v: number)            { return this._num('MaxCombo', '<=', v) }
  /** @example db.scores.get.byAccuracyAbove(0.95) */
  byAccuracyAbove(v: number)            { return this._num('Accuracy', '>=', v) }
  /** @example db.scores.get.byAccuracyBelow(0.5) */
  byAccuracyBelow(v: number)            { return this._num('Accuracy', '<=', v) }
  /** @example db.scores.get.byComboAbove(300) */
  byComboAbove(v: number)               { return this._num('Combo', '>=', v) }
  /** @example db.scores.get.byComboBelow(100) */
  byComboBelow(v: number)               { return this._num('Combo', '<=', v) }
  /** @example db.scores.get.byOnlineIdExact(1518856368) */
  byOnlineIdExact(v: number)            { return this._num('OnlineID', '==', v) }
  /** @example db.scores.get.byLegacyOnlineIdExact(1518856368) */
  byLegacyOnlineIdExact(v: number)      { return this._num('LegacyOnlineID', '==', v) }
  /** @example db.scores.get.byRankExact(5) */
  byRankExact(v: number)                { return this._num('Rank', '==', v) }
  /** @example db.scores.get.byRankAbove(4) */
  byRankAbove(v: number)                { return this._num('Rank', '>=', v) }

  /** @example db.scores.get.byClientVersionEquals('20131110') */
  byClientVersionEquals(v: string)      { return this._str('ClientVersion', '==', v) }
  /** @example db.scores.get.byModsContains('HD') */
  byModsContains(v: string)             { return this._str('Mods', 'CONTAINS[c]', v) }

  /** @example db.scores.get.byDateBefore(someDate) */
  byDateBefore(v: Date)                 { return this._date('Date', '<', v) }
  /** @example db.scores.get.byDateAfter(someDate) */
  byDateAfter(v: Date)                  { return this._date('Date', '>', v) }

  /** @example db.scores.get.byDeletePending(true) */
  byDeletePending(v: boolean)           { return this._bool('DeletePending', v) }
  /** @example db.scores.get.byIsLegacyScore(true) */
  byIsLegacyScore(v: boolean)           { return this._bool('IsLegacyScore', v) }
  /** @example db.scores.get.byBackgroundReprocessingFailed(true) */
  byBackgroundReprocessingFailed(v: boolean) { return this._bool('BackgroundReprocessingFailed', v) }

  /** @example db.scores.get.byBeatmapId(uuid) */
  byBeatmapId(v: string | Realm.BSON.UUID)  { return this._fkEq('BeatmapInfo.ID', this._uuid(v)) }
  /** @example db.scores.get.byBeatmapOnlineIdExact(506483) */
  byBeatmapOnlineIdExact(v: number)         { return this._fkEq('BeatmapInfo.OnlineID', v) }
  /** @example db.scores.get.byBeatmapMd5Equals(md5) */
  byBeatmapMd5Equals(v: string)             { return this._str('BeatmapHash', '==', v) }
  /** @example db.scores.get.byBeatmapSetOnlineIdExact(506483) */
  byBeatmapSetOnlineIdExact(v: number)      { return this._fkEq('BeatmapInfo.BeatmapSet.OnlineID', v) }
  /** @example db.scores.get.byUserIdExact(124493) */
  byUserIdExact(v: number)                  { return this._fkEq('User.OnlineID', v) }
  /** @example db.scores.get.byUsernameContains('Cookiezi') */
  byUsernameContains(v: string)             { return this._str('User.Username', 'CONTAINS[c]', v) }
  /** @example db.scores.get.byUserCountryCodeEquals('KR') */
  byUserCountryCodeEquals(v: string)        { return this._str('User.CountryCode', '==', v) }
  /** @example db.scores.get.byRulesetShortNameEquals('osu') */
  byRulesetShortNameEquals(v: string)       { return this._fkEq('Ruleset.ShortName', v) }

  /** @example db.scores.get.byPpAbove(300) */
  byPpAbove(v: number)                  { return this._num('PP', '>=', v) }
}
