import type Realm from 'realm'
import type { BeatmapCollection } from '../schema/types.js'

/**
 * Creates collection query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query beatmap collections by id, name, or contained beatmaps.
 * @example
 * const col = createCollectionGetModule(realm).byName('Favorites')
 */
export function createCollectionGetModule(realm: Realm) {
  return {
    all: (): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection')],
    byId: (id: string): BeatmapCollection | undefined => realm.objectForPrimaryKey<BeatmapCollection>('BeatmapCollection', id) ?? undefined,
    byName: (name: string): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection').filtered('Name CONTAINS[c] $0', name)],
    withBeatmap: (md5: string): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection').filtered('ANY BeatmapMD5Hashes == $0', md5)],
  }
}
