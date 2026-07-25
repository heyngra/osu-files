import Realm from 'realm'
import type { BeatmapMetadata } from '../schema/types.js'

/**
 * Creates beatmap metadata query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query beatmap metadata by id.
 * @example
 * const meta = createBeatmapMetadataGetModule(realm).byId('some-uuid')
 */
export function createBeatmapMetadataGetModule(realm: Realm) {
  return {
    all: (): BeatmapMetadata[] => [...realm.objects<BeatmapMetadata>('BeatmapMetadata')],
    byId: (id: string | Realm.BSON.UUID): BeatmapMetadata | undefined => realm.objectForPrimaryKey<BeatmapMetadata>('BeatmapMetadata', typeof id === 'string' ? new Realm.BSON.UUID(id) : id) ?? undefined,
  }
}
