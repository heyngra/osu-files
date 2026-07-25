import Realm from 'realm'
import type { BeatmapSet } from '../schema/types.js'

/**
 * Creates beatmap set query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query beatmap sets by id, hash, online id, or title/artist search.
 * @example
 * const recent = createBeatmapSetGetModule(realm).recent(25)
 */
export function createBeatmapSetGetModule(realm: Realm) {
  return {
    all: (): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet')],
    byId: (id: string | Realm.BSON.UUID): BeatmapSet | undefined => realm.objectForPrimaryKey<BeatmapSet>('BeatmapSet', typeof id === 'string' ? new Realm.BSON.UUID(id) : id) ?? undefined,
    byOnlineId: (id: number): BeatmapSet | undefined => realm.objects<BeatmapSet>('BeatmapSet').filtered('OnlineID == $0', id)[0] ?? undefined,
    byHash: (hash: string): BeatmapSet | undefined => realm.objects<BeatmapSet>('BeatmapSet').filtered('Hash == $0', hash)[0] ?? undefined,
    recent: (limit = 50): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet').sorted('DateAdded', true).slice(0, limit)],
    search: (query: string): BeatmapSet[] => [...realm.objects<BeatmapSet>('BeatmapSet').filtered('ANY Beatmaps.Metadata.Title CONTAINS[c] $0 OR ANY Beatmaps.Metadata.Artist CONTAINS[c] $0', query)],
  }
}
