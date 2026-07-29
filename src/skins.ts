import Realm from 'realm'
import type { Skin, RealmFile, RealmNamedFileUsage } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { SkinQuery } from './get/skins.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importOskEntries, type ImportedSkinData } from './skin/import.js'
import { exportOskData } from './skin/export.js'
import { cleanupOrphanedFiles } from './files.js'
import { assertWritable, writeRealm } from './context.js'

function getNextBestSkinName(existingNames: Iterable<string>, desiredName: string): string {
  const taken = new Set<number>()
  const escaped = desiredName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}( \\(([1-9]\\d*)\\))?$`, 'i')

  for (const name of existingNames) {
    const m = pattern.exec(name)
    if (!m) continue
    taken.add(m[2] ? parseInt(m[2], 10) : 0)
  }

  let best = 0
  while (taken.has(best)) best++
  return best === 0 ? desiredName : `${desiredName} (${best})`
}

/**
 * Creates the skin sub-module with query, write, import/export, and lifecycle operations.
 * @example
 * const skin = db.skins.get.byNameContains('WhiteCat')[0]
 */
export function createSkinModule(ctx: OsuFilesContext) {
  const skinQuery = new SkinQuery(ctx.realm)
  skinQuery.enableCache = ctx.queryCache ?? true
  const get = skinQuery.proxify()
  const write = createCrud<Skin>(ctx, getConfig('Skin')!)
  return {
    get,
    write,

    importOsk: async (filePath: string): Promise<ImportedSkinData> => {
      if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for import')
      assertWritable(ctx)
      const transaction = ctx.fileStore?.beginTransaction()
      const checkpoint = ctx.logger.checkpoint()
      const previousTransaction = ctx.fileTransaction
      try {
        const data = await importOskEntries(filePath, ctx.filesFolderPath, ctx.fileStore, ctx.archiveLimits, transaction)
        ctx.fileTransaction = transaction
        return writeRealm(ctx, () => {
          transaction?.commit()

          const skinId = new Realm.BSON.UUID()

          const namedFiles: RealmNamedFileUsage[] = []
          for (const entry of data.entries) {
            let file = ctx.files.get.byHashEquals(entry.hash)[0]
            if (!file) file = ctx.files.write.create({ Hash: entry.hash })
            namedFiles.push({ File: file, Filename: entry.filename })
          }

          write.create({
            ID: skinId,
            Name: data.name,
            Creator: data.creator,
            InstantiationInfo: data.instantiationInfo,
            Hash: data.skinHash,
            Protected: false,
            DeletePending: false,
            Files: namedFiles,
          })
          return {
            id: skinId.toString(),
            name: data.name,
            creator: data.creator,
            hash: data.skinHash,
            files: data.entries.length,
          }
        })
      } catch (error) {
        try { ctx.logger.discardSince(checkpoint) } finally { transaction?.rollback() }
        throw error
      } finally {
        ctx.fileTransaction = previousTransaction
      }
    },

    exportOsk: async (skinId: string): Promise<Buffer> => {
      const skin = get.byId(skinId)[0]
      if (!skin) throw new Error(`Skin '${skinId}' not found`)
      return exportOskData(skin, ctx.filesFolderPath!)
    },

    delete: (skinId: string): void => {
      const skin = get.byId(skinId)[0]
      if (!skin) throw new Error(`Skin '${skinId}' not found`)
      if (skin.Protected) throw new Error(`Cannot delete protected skin '${skin.Name}'`)
      write.update(new Realm.BSON.UUID(skinId), { DeletePending: true })
      cleanupOrphanedFiles(ctx)
    },

    undelete: (skinId: string): void => {
      const skin = get.byId(skinId)[0]
      if (!skin) throw new Error(`Skin '${skinId}' not found`)
      write.update(new Realm.BSON.UUID(skinId), { DeletePending: false })
    },

    duplicate: (skinId: string): Skin => {
      const source = get.byId(skinId)[0]
      if (!source) throw new Error(`Skin '${skinId}' not found`)

      const existingNames = get.usable()
        .map(s => s.Name)
        .filter((n): n is string => !!n)

      const newName = getNextBestSkinName(existingNames, `${source.Name || 'Skin'} (modified)`)

      const namedFiles: RealmNamedFileUsage[] = []
      for (const f of source.Files) {
        const file: RealmFile | undefined = f.File
        if (file) namedFiles.push({ File: file, Filename: f.Filename })
      }

      return write.create({
        ID: new Realm.BSON.UUID(),
        Name: newName,
        Creator: source.Creator || '',
        InstantiationInfo: source.InstantiationInfo || '',
        Hash: '',
        Protected: false,
        DeletePending: false,
        Files: namedFiles,
      })
    },
  }
}

/** Skin sub-module with query, write, import/export, and lifecycle operations. */
export type SkinModule = ReturnType<typeof createSkinModule>
