import Realm from 'realm'
import type { Score } from '../schema/types.js'

/**
 * Creates score query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query scores by beatmap, ruleset, user, or recent/best rankings.
 * @example
 * const topPlays = createScoreGetModule(realm).best(10)
 */
export function createScoreGetModule(realm: Realm) {
  return {
    all: (): Score[] => [...realm.objects<Score>('Score')],
    byId: (id: string | Realm.BSON.UUID): Score | undefined => realm.objectForPrimaryKey<Score>('Score', typeof id === 'string' ? new Realm.BSON.UUID(id) : id) ?? undefined,
    byOnlineId: (id: number): Score[] => [...realm.objects<Score>('Score').filtered('OnlineID == $0', id)],
    recent: (limit = 100): Score[] => [...realm.objects<Score>('Score').sorted('Date', true).slice(0, limit)],
    forBeatmap: (hash: string): Score[] => [...realm.objects<Score>('Score').filtered('BeatmapHash == $0', hash).sorted('Date', true)],
    best: (limit = 50): Score[] => [...realm.objects<Score>('Score').filtered('PP != nil').sorted('PP', true).slice(0, limit)],
    byRuleset: (shortName: string): Score[] => [...realm.objects<Score>('Score').filtered('Ruleset.ShortName == $0', shortName).sorted('Date', true)],
    byUser: (onlineId: number): Score[] => [...realm.objects<Score>('Score').filtered('User.OnlineID == $0', onlineId).sorted('Date', true)],
  }
}
