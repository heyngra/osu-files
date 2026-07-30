import Realm from 'realm'
import { readFileSync } from 'fs'
import type { Skin, RealmFile, RealmNamedFileUsage } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { SkinQuery } from './get/skins.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importOskEntries, type ImportedSkinData } from './skin/import.js'
import { exportOskData } from './skin/export.js'
import { cleanupOrphanedFiles } from './files.js'
import { assertWritable, writeRealm } from './context.js'
import { cloneSkinIni, parseSkinIni, serializeSkinIni, type SkinIniDocument } from './skin/skin-ini.js'
import { fileStoragePath, sha256 } from './util.js'
import type { FileStoreTransaction } from './file-store.js'

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

function getSkin(ctx: OsuFilesContext, get: SkinQuery['proxify'] extends never ? never : ReturnType<SkinQuery['proxify']>, skinId: string): Skin {
  const skin = get.byId(skinId)[0]
  if (!skin) throw new Error(`Skin '${skinId}' not found`)
  return skin
}

function iniUsage(skin: Skin): RealmNamedFileUsage | undefined {
  return [...skin.Files].find(file => file.Filename?.replace(/\\/g, '/').toLowerCase() === 'skin.ini')
}

function readIniDocument(ctx: OsuFilesContext, skin: Skin): SkinIniDocument | undefined {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
  const usage = iniUsage(skin)
  const hash = usage?.File?.Hash
  if (!hash) return undefined
  return parseSkinIni(readFileSync(fileStoragePath(ctx.filesFolderPath, hash), 'utf8'))
}

function skinHash(ctx: OsuFilesContext, usages: RealmNamedFileUsage[], transaction?: FileStoreTransaction): string {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
  const hashable = usages
    .filter(usage => usage.Filename && /\.(?:ini|json)$/i.test(usage.Filename))
    .sort((a, b) => (a.Filename ?? '').localeCompare(b.Filename ?? ''))
  const buffers = hashable.map(usage => {
    const hash = usage.File?.Hash
    if (!hash) return Buffer.alloc(0)
    return transaction?.read(hash) ?? ctx.fileStore!.read(hash)
  })
  return buffers.length ? sha256(Buffer.concat(buffers)) : ''
}

function persistIni(ctx: OsuFilesContext, skin: Skin, document: SkinIniDocument, skinQuery: SkinQuery, update: (id: unknown, patch: Record<string, unknown>) => Skin): boolean {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
  assertWritable(ctx)
  if (skin.Protected) throw new Error(`Cannot modify protected skin '${skin.Name}'`)

  const content = Buffer.from(serializeSkinIni(document), 'utf8')
  const existing = iniUsage(skin)
  const oldContent = existing?.File?.Hash ? ctx.fileStore?.read(existing.File.Hash, false) : undefined
  if (oldContent && oldContent.equals(content)) return false

  const transaction = ctx.fileStore?.beginTransaction()
  const checkpoint = ctx.logger.checkpoint()
  const previousTransaction = ctx.fileTransaction
  ctx.fileTransaction = transaction
  try {
    const result = writeRealm(ctx, () => {
      const fileResult = transaction?.put(content) ?? ctx.fileStore?.put(content)
      if (!fileResult) throw new Error('File store is unavailable')
      transaction?.commit()

      const file = ctx.files.get.byHashEquals(fileResult.hash)[0] ?? ctx.files.write.create({ Hash: fileResult.hash })
      const usages = [...skin.Files].map(usage => usage === existing ? { File: file, Filename: usage.Filename } : { File: usage.File, Filename: usage.Filename })
      if (!existing) usages.push({ File: file, Filename: 'skin.ini' })
      const name = document.general.name || skin.Name || ''
      const creator = document.general.author || skin.Creator || ''
      skin.Files.splice(0, skin.Files.length)
      for (const usage of usages) skin.Files.push(usage)
      skin.Name = name
      skin.Creator = creator
      skin.Hash = skinHash(ctx, usages, transaction)
      update(skin.ID, { Files: usages, Name: name, Creator: creator, Hash: skin.Hash })
      return true
    })
    transaction?.finalize()
    return result
  } catch (error) {
    try { ctx.logger.discardSince(checkpoint) } finally { transaction?.rollback() }
    throw error
  } finally {
    ctx.fileTransaction = previousTransaction
  }
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

    /**
     * Reads and parses a skin's `skin.ini` file.
     * @param skinId - Skin UUID.
     * @returns The parsed document, or `undefined` when the skin has no `skin.ini`.
     * @throws If the skin does not exist or no files folder is configured.
     * @example
     * const ini = db.skins.readIni(skinId)
     * console.log(ini?.general.name)
     */
    readIni: (skinId: string): SkinIniDocument | undefined => {
      const skin = getSkin(ctx, get, skinId)
      return readIniDocument(ctx, skin)
    },

    /**
     * Replaces a skin's `skin.ini` file atomically.
     * @param skinId - Skin UUID.
     * @param source - Text or parsed lossless skin.ini document.
     * @returns `true` if the stored file changed, otherwise `false`.
     * @throws If the skin does not exist, is protected, is read-only, or persistence fails.
     * @example
     * db.skins.replaceIni(skinId, '[General]\nName: My Skin\n')
     */
    replaceIni: (skinId: string, source: string | SkinIniDocument): boolean => {
      const skin = getSkin(ctx, get, skinId)
      return persistIni(ctx, skin, typeof source === 'string' ? parseSkinIni(source) : cloneSkinIni(source), skinQuery, write.update)
    },

    /**
     * Applies edits to a cloned skin.ini document and persists the result atomically.
     * @param skinId - Skin UUID.
     * @param edit - Mutation callback applied to the cloned document.
     * @returns `true` if the stored file changed, otherwise `false`.
     * @throws If the skin does not exist, is protected, is read-only, or persistence fails.
     * @example
     * db.skins.editIni(skinId, ini => {
     *   ini.set('General', 'AnimationFramerate', 120)
     * })
     */
    editIni: (skinId: string, edit: (document: SkinIniDocument) => void): boolean => {
      const skin = getSkin(ctx, get, skinId)
      const document = readIniDocument(ctx, skin) ?? parseSkinIni('')
      const original = serializeSkinIni(document)
      edit(document)
      if (serializeSkinIni(document) === original) return false
      return persistIni(ctx, skin, document, skinQuery, write.update)
    },

    importOsk: async (filePath: string): Promise<ImportedSkinData> => {
      if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for import')
      assertWritable(ctx)
      const transaction = ctx.fileStore?.beginTransaction()
      const checkpoint = ctx.logger.checkpoint()
      const previousTransaction = ctx.fileTransaction
      try {
        const data = await importOskEntries(filePath, ctx.filesFolderPath, ctx.fileStore, ctx.archiveLimits, transaction)
        ctx.fileTransaction = transaction
        const result = writeRealm(ctx, () => {
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
        transaction?.finalize()
        return result
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
