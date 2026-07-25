import Realm from 'realm'
import type { Beatmap } from '../schema/types.js'

/**
 * Creates beatmap query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query beatmaps by id, hash, ruleset, etc.
 * @example
 * const beatmaps = createBeatmapGetModule(realm).byMd5('abc123')
 */
export function createBeatmapGetModule(realm: Realm) {
  return {
    all: (): Beatmap[] => [...realm.objects<Beatmap>('Beatmap')],
    byId: (id: string | Realm.BSON.UUID): Beatmap | undefined => realm.objectForPrimaryKey<Beatmap>('Beatmap', typeof id === 'string' ? new Realm.BSON.UUID(id) : id) ?? undefined,
    byMd5: (hash: string): Beatmap | undefined => realm.objects<Beatmap>('Beatmap').filtered('MD5Hash == $0', hash)[0] ?? undefined,
    byOnlineId: (id: number): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('OnlineID == $0', id)],
    byRuleset: (shortName: string): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Ruleset.ShortName == $0', shortName)],
    byStatus: (status: number): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Status == $0', status)],
    search: (query: string): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Metadata.Title CONTAINS[c] $0 OR Metadata.Artist CONTAINS[c] $0 OR DifficultyName CONTAINS[c] $0', query)],
    recentlyPlayed: (limit = 50): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('LastPlayed != nil').sorted('LastPlayed', true).slice(0, limit)],
  }
}
