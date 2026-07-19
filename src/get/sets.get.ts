import type Realm from 'realm'
import type { BeatmapSet } from '../schema/types.js'

export function createBeatmapSetGetModule(realm: Realm) {
  return {
    all: (): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet')],
    byId: (id: string): BeatmapSet | undefined => realm.objectForPrimaryKey<BeatmapSet>('BeatmapSet', id) ?? undefined,
    byOnlineId: (id: number): BeatmapSet | undefined => realm.objects<BeatmapSet>('BeatmapSet').filtered('OnlineID == $0', id)[0] ?? undefined,
    recent: (limit = 50): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet').sorted('DateAdded', true).slice(0, limit)],
    search: (query: string): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet').filtered('ANY Beatmaps.Metadata.Title CONTAINS[c] $0 OR ANY Beatmaps.Metadata.Artist CONTAINS[c] $0', query)],
  }
}
