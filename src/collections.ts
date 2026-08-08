import { readFileSync } from 'fs'
import Realm from 'realm'
import type { BeatmapCollection } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { CollectionQuery } from './get/collections.get.js'
import type { Collections } from './get/facades.js'
import type { CollectionSnapshot } from './types/readonly.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { readLegacyCollectionDb, writeLegacyCollectionDb, type LegacyCollectionEntry } from './collections/legacy.js'
import { assertWritable, markChanged, writeRealm } from './context.js'

export type { LegacyCollectionEntry } from './collections/legacy.js'

type CollectionExportInput = BeatmapCollection | CollectionSnapshot
type CollectionExportSource = CollectionExportInput | Iterable<CollectionExportInput>

/**
 * Creates the collection module with read-only results and write operations.
 * @example
 * const col = db.collections.get.byNameContains('Favorite')[0]
 */
export function createCollectionModule(ctx: OsuFilesContext): BeatmapCollectionModule {
  const q = new CollectionQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  const get = q.proxify()
  const write = createCrud<BeatmapCollection>(ctx, getConfig('BeatmapCollection')!)

  return {
    get: get as unknown as Collections,
    write,

    /**
     * Imports an osu!stable collection.db into the Realm database.
     * Existing collections are matched by name and missing MD5s are merged.
     * @returns Number of collections imported vs merged into existing ones.
     * @example
     * const { imported, merged } = db.collections.importLegacy('collection.db')
     */
    importLegacy(filePath: string): { imported: number; merged: number } {
      assertWritable(ctx)
      const entries = readLegacyCollectionDb(readFileSync(filePath))
      let imported = 0
      let merged = 0

      writeRealm(ctx, () => {
        for (const entry of entries) {
          const existing = ctx.realm
            .objects<BeatmapCollection>('BeatmapCollection')
            .filtered('Name == $0', entry.name)[0]

          if (existing) {
            for (const md5 of entry.beatmapMD5s) {
              if (!existing.BeatmapMD5Hashes.includes(md5))
                existing.BeatmapMD5Hashes.push(md5)
            }
            merged++
          } else {
            ctx.realm.create('BeatmapCollection', {
              ID: new Realm.BSON.UUID(),
              Name: entry.name,
              BeatmapMD5Hashes: entry.beatmapMD5s,
              LastModified: new Date(),
            })
            imported++
          }
        }
      })
      markChanged(ctx)

      return { imported, merged }
    },

    /**
     * Exports one or more collections to the legacy osu!stable binary format.
     * @returns Buffer containing the binary collection.db data.
     * @example
     * const all = writeFileSync('collection.db', db.collections.exportLegacy(db.collections.get))
     * const one = writeFileSync('out.db', db.collections.exportLegacy(db.collections.get.byName('Favs')[0]))
     * const some = writeFileSync('out.db', db.collections.exportLegacy(db.collections.get.byNameContains('Fav')))
     */
    exportLegacy(collection: CollectionExportSource): Buffer {
      const items = Array.isArray(collection) ? collection
        : Symbol.iterator in collection
          ? [...collection as unknown as BeatmapCollection[]]
          : [collection]
      const entries: LegacyCollectionEntry[] = items.map(c => ({
        name: c.Name ?? '',
        beatmapMD5s: [...(c.BeatmapMD5Hashes ?? [])].filter((h): h is string => !!h),
      }))
      return writeLegacyCollectionDb(entries)
    },

    /** @example db.collections.addBeatmap(id, 'f4140e0c0e0ea5f3959b5c7a026d5fc1') */
    addBeatmap(collectionId: string, md5: string): void {
      const col = get.byId(collectionId)[0]
      if (!col) throw new Error(`Collection '${collectionId}' not found`)
      if (!col.BeatmapMD5Hashes.includes(md5))
        write.update(col.ID, { BeatmapMD5Hashes: [...col.BeatmapMD5Hashes, md5] })
    },

    /** @example db.collections.removeBeatmap(id, 'f4140e0c0e0ea5f3959b5c7a026d5fc1') */
    removeBeatmap(collectionId: string, md5: string): void {
      const col = get.byId(collectionId)[0]
      if (!col) throw new Error(`Collection '${collectionId}' not found`)
      const filtered = col.BeatmapMD5Hashes.filter(h => h !== md5)
      if (filtered.length !== col.BeatmapMD5Hashes.length)
        write.update(col.ID, { BeatmapMD5Hashes: filtered })
    },
  }
}

export type BeatmapCollectionModule = {
  /** Returns read-only collection snapshots through `get`. */
  readonly get: Collections
  /** Creates, updates, deletes, or upserts collections. */
  readonly write: Crud<BeatmapCollection>
  /** Imports an osu!stable collection.db into the Realm database. */
  importLegacy(filePath: string): { imported: number; merged: number }
  /** Exports a collection, snapshot, or iterable of either to osu!stable's legacy binary format. */
  exportLegacy(collection: BeatmapCollection | CollectionSnapshot | Iterable<BeatmapCollection | CollectionSnapshot>): Buffer
  /** Adds one beatmap MD5 to a collection. */
  addBeatmap(collectionId: string, md5: string): void
  /** Removes one beatmap MD5 from a collection. */
  removeBeatmap(collectionId: string, md5: string): void
}
