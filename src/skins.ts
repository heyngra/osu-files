import Realm from 'realm'
import { readFileSync } from 'fs'
import type { Skin, RealmFile, RealmNamedFileUsage } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { SkinQuery } from './get/skins.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importOskEntries, type ImportedSkinData } from './skin/import.js'
import { exportOskData } from './skin/export.js'
import { cleanupOrphanedFiles, cleanupBlobIfUnreferenced, getRealmFile } from './files.js'
import { assertWritable, markChanged, writeRealm } from './context.js'
import { cloneSkinIni, parseSkinIni, serializeSkinIni, type SkinIniDocument } from './skin/skin-ini.js'
import { fileStoragePath } from './util.js'
import { computeSkinHash, fullSkinContentHash, normalizeFilename, validateOwnerHashes } from './integrity.js'

export type OwnedFileEditor = {
  /** Normalized owner-local filename. */
  readonly filename: string
  /** Hash of the blob selected when this editor was opened. */
  readonly hash: string
  /** Reads and verifies the selected blob. */
  read(): Buffer
  /** Replaces the selected blob for this owner using copy-on-write. */
  replace(content: Buffer): Promise<boolean>
  /** Transforms and replaces the selected blob atomically. */
  edit(transform: (content: Buffer) => Buffer | Promise<Buffer>): Promise<boolean>
}

export type SkinEditor = {
  /** Skin UUID. */
  readonly id: string
  /** Detached skin snapshot. */
  readonly value: Readonly<Skin>
  /** Opens one file reference for copy-on-write editing. */
  getFile(filename: string): OwnedFileEditor
  /** Reads this skin's skin.ini, if present. */
  readIni(): SkinIniDocument | undefined
  /** Replaces this skin's skin.ini atomically. */
  replaceIni(source: string | SkinIniDocument): Promise<boolean>
  /** Applies edits to a cloned skin.ini document. */
  editIni(edit: (document: SkinIniDocument) => void): Promise<boolean>
  /** Computes a non-persisted hash over every referenced skin file. */
  contentHash(): string
}

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
  const skin = ctx.realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(skinId))
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

function skinHash(ctx: OsuFilesContext, usages: RealmNamedFileUsage[]): string {
  return computeSkinHash(ctx, usages)
}

function persistIni(ctx: OsuFilesContext, skin: Skin, document: SkinIniDocument, skinQuery: SkinQuery, update: (id: unknown, patch: Record<string, unknown>) => Skin): boolean {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
  assertWritable(ctx)
  if (skin.Protected) throw new Error(`Cannot modify protected skin '${skin.Name}'`)

  const content = Buffer.from(serializeSkinIni(document), 'utf8')
  const fileUsages = [...skin.Files]
  const existingIndex = fileUsages.findIndex(file => file.Filename?.replace(/\\/g, '/').toLowerCase() === 'skin.ini')
  const existing = existingIndex >= 0 ? fileUsages[existingIndex] : undefined
  const oldHash = existing?.File?.Hash
  const oldContent = oldHash ? ctx.fileStore?.read(oldHash, false) : undefined
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

      const file = getRealmFile(ctx, fileResult.hash) ?? ctx.files.write.create({ Hash: fileResult.hash })
      const usages = fileUsages.map((usage, index) => index === existingIndex
        ? { File: file, Filename: usage.Filename }
        : { File: usage.File, Filename: usage.Filename })
      if (!existing) usages.push({ File: file, Filename: 'skin.ini' })
      const name = document.general.name || skin.Name || ''
      const creator = document.general.author || skin.Creator || ''
      if (existingIndex >= 0) skin.Files[existingIndex] = { File: file, Filename: existing!.Filename }
      else skin.Files.push({ File: file, Filename: 'skin.ini' })
      skin.Name = name
      skin.Creator = creator
      skin.Hash = skinHash(ctx, usages)
      validateOwnerHashes(ctx, { ...skin, Files: usages, Hash: skin.Hash } as Skin)
      return true
    })
    transaction?.finalize()
    markChanged(ctx)
    if (oldHash) cleanupBlobIfUnreferenced(ctx, oldHash)
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
     * Opens a skin for safe copy-on-write file editing.
     *
     * @param skinId - Skin UUID.
     * @returns An editor whose mutations are committed atomically.
     * @throws If the skin does not exist or the database is closed.
     * @example
     * const editor = db.skins.open(skinId)
     * await editor.getFile('button-left.png').edit(transform)
     */
    open: (skinId: string): SkinEditor => {
      const skin = getSkin(ctx, get, skinId)
      const value = { ...skin, Files: [...skin.Files].map(file => ({ Filename: file.Filename, File: file.File ? { Hash: file.File.Hash } : undefined })) } as unknown as Readonly<Skin>
      return {
        id: skinId,
        value,
        getFile(filename: string): OwnedFileEditor {
          const normalized = normalizeFilename(filename).toLowerCase()
          const usage = [...skin.Files].find(file => normalizeFilename(file.Filename ?? '').toLowerCase() === normalized)
          if (!usage?.File?.Hash) throw new Error(`Skin '${skinId}' file '${filename}' not found`)
          const originalHash = usage.File.Hash
          const replace = async (content: Buffer): Promise<boolean> => {
            assertWritable(ctx)
            if (skin.Protected) throw new Error(`Cannot modify protected skin '${skin.Name}'`)
            const transaction = ctx.fileStore?.beginTransaction()
            const checkpoint = ctx.logger.checkpoint()
            const previousTransaction = ctx.fileTransaction
            ctx.fileTransaction = transaction
            try {
              const result = writeRealm(ctx, () => {
                const stored = transaction?.put(content) ?? ctx.fileStore?.put(content)
                if (!stored) throw new Error('File store is unavailable')
                if (stored.hash === originalHash) return false
                const existingFile = getRealmFile(ctx, stored.hash) ?? ctx.files.write.create({ Hash: stored.hash })
                const next = [...skin.Files].map(item => item === usage ? { Filename: item.Filename, File: existingFile } : { Filename: item.Filename, File: item.File })
                transaction?.commit()
                skin.Files[skin.Files.indexOf(usage)] = { File: existingFile, Filename: usage.Filename }
                skin.Hash = skinHash(ctx, next)
                validateOwnerHashes(ctx, { ...skin, Files: next, Hash: skin.Hash } as Skin)
                return true
              })
              transaction?.finalize()
              cleanupBlobIfUnreferenced(ctx, originalHash)
              return result
            } catch (error) {
              try { ctx.logger.discardSince(checkpoint) } finally { transaction?.rollback() }
              throw error
            } finally { ctx.fileTransaction = previousTransaction }
          }
          const editor: OwnedFileEditor = {
            filename: usage.Filename ?? filename,
            hash: originalHash,
            read: () => {
              if (!ctx.fileStore) throw new Error('filesFolderPath is required')
              return ctx.fileStore.read(originalHash)
            },
            replace,
            edit: async transform => replace(await transform(editor.read())),
          }
          return editor
        },
        readIni: () => readIniDocument(ctx, skin),
        replaceIni: async source => persistIni(ctx, skin, typeof source === 'string' ? parseSkinIni(source) : cloneSkinIni(source), skinQuery, write.update),
        editIni: async edit => {
          const document = readIniDocument(ctx, skin) ?? parseSkinIni('')
          const original = serializeSkinIni(document)
          edit(document)
          if (serializeSkinIni(document) === original) return false
          return persistIni(ctx, skin, document, skinQuery, write.update)
        },
        contentHash: () => fullSkinContentHash(ctx, skin),
      }
    },

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
            let file = getRealmFile(ctx, entry.hash)
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
        const file: RealmFile | undefined = f.File?.Hash ? getRealmFile(ctx, f.File.Hash) : undefined
        if (file) namedFiles.push({ File: file, Filename: f.Filename })
      }

      return write.create({
        ID: new Realm.BSON.UUID(),
        Name: newName,
        Creator: source.Creator || '',
        InstantiationInfo: source.InstantiationInfo || '',
        Hash: skinHash(ctx, namedFiles),
        Protected: false,
        DeletePending: false,
        Files: namedFiles,
      })
    },
  }
}

/** Skin sub-module with query, write, import/export, and lifecycle operations. */
export type SkinModule = ReturnType<typeof createSkinModule>
