import type Realm from 'realm'
import type { BeatmapCollection } from './schema/types.js'

export function createCollectionModule(realm: Realm) {
  return {
    get: {
      all: (): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection')],
      byId: (id: string): BeatmapCollection | undefined => realm.objectForPrimaryKey<BeatmapCollection>('BeatmapCollection', id) ?? undefined,
      byName: (name: string): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection').filtered('Name CONTAINS[c] $0', name)],
      withBeatmap: (md5: string): BeatmapCollection[] => [...realm.objects<BeatmapCollection>('BeatmapCollection').filtered('ANY BeatmapMD5Hashes == $0', md5)],
    },
  }
}
