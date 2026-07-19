import type Realm from 'realm'
import type { Beatmap } from '../schema/types.js'

export function createBeatmapGetModule(realm: Realm) {
  return {
    all: (): Beatmap[] => [...realm.objects<Beatmap>('Beatmap')],
    byId: (id: string): Beatmap | undefined => realm.objectForPrimaryKey<Beatmap>('Beatmap', id) ?? undefined,
    byMd5: (hash: string): Beatmap | undefined => realm.objects<Beatmap>('Beatmap').filtered('MD5Hash == $0', hash)[0] ?? undefined,
    byOnlineId: (id: number): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('OnlineID == $0', id)],
    byRuleset: (shortName: string): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Ruleset.ShortName == $0', shortName)],
    byStatus: (status: number): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Status == $0', status)],
    search: (query: string): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('Metadata.Title CONTAINS[c] $0 OR Metadata.Artist CONTAINS[c] $0 OR DifficultyName CONTAINS[c] $0', query)],
    recentlyPlayed: (limit = 50): Beatmap[] => [...realm.objects<Beatmap>('Beatmap').filtered('LastPlayed != nil').sorted('LastPlayed', true).slice(0, limit)],
  }
}
