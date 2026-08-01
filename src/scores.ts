import Realm from 'realm'
import type { Score } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { ScoreQuery } from './get/scores.get.js'
import type { QuerySurface } from './get/base.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'
import type { ParsedReplay } from './osr/types.js'
import { parseOsr as parseReplay } from './osr/parse.js'
import { sha256 } from './util.js'
import { assertWritable, markChanged, writeRealm } from './context.js'
import { validateOwnerHashes } from './integrity.js'
import { cleanupBlobIfUnreferenced, getRealmFile } from './files.js'
import type { ScoreSnapshot } from './types/readonly.js'
import { LogAction } from './write/logger.js'

export type ScoreEditor = {
  /** Score UUID. */
  readonly id: string
  /** Detached score snapshot. */
  readonly value: ScoreSnapshot
  /** Replaces the replay and refreshes replay fields. */
  editReplay(transform: (content: Buffer) => Buffer | Promise<Buffer>): Promise<boolean>
}

function rollbackState(score: Score): Record<string, unknown> {
  return {
    Hash: score.Hash ?? null,
    MaxCombo: score.MaxCombo,
    Date: score.Date,
    Files: [...score.Files].map(usage => ({
      Filename: usage.Filename ?? null,
      ...(usage.File?.Hash ? { File: { Hash: usage.File.Hash } } : {}),
    })),
  }
}

/**
 * Creates the score sub-module with query and write operations.
 * @example
 * const sc = db.scores.get.byAccuracyAbove(0.95)[0]
 */
export function createScoreModule(ctx: OsuFilesContext) {
  const q = new ScoreQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  const get = q.proxify()
  return {
    get,
    write: createCrud<Score>(ctx, getConfig('Score')!),
    /**
     * Opens a score for replay-aware copy-on-write editing.
     *
     * @param scoreId - Score UUID.
     * @returns An editor that reparses and validates the resulting replay.
     * @throws If the score, replay, or file store is unavailable, or parsing fails.
     * @example
     * await db.scores.open(scoreId).editReplay(transform)
     */
    open: (scoreId: string): ScoreEditor => {
      const score = ctx.realm.objectForPrimaryKey<Score>('Score', new Realm.BSON.UUID(scoreId))
      if (!score) throw new Error(`Score '${scoreId}' not found`)
      const replay = [...score.Files].find(file => /\.osr$/i.test(file.Filename ?? ''))
      if (!replay?.File?.Hash) throw new Error(`Score '${scoreId}' has no replay file`)
      const originalHash = replay.File.Hash
      const value = { ...score, Files: [...score.Files].map(file => ({ Filename: file.Filename, File: file.File ? { Hash: file.File.Hash } : undefined })) } as unknown as Readonly<Score>
      const editor: ScoreEditor = {
        id: scoreId,
        value,
        editReplay: async transform => {
          assertWritable(ctx)
          if (!ctx.fileStore) throw new Error('filesFolderPath is required')
          const current = ctx.fileStore.read(originalHash)
          const content = await transform(current)
          const parsed: ParsedReplay = parseReplay(content)
          const nextHash = sha256(content)
          if (nextHash === originalHash) return false
          const before = rollbackState(score)
          const transaction = ctx.fileStore.beginTransaction()
          const checkpoint = ctx.logger.checkpoint()
          const previousTransaction = ctx.fileTransaction
          ctx.fileTransaction = transaction
          try {
            const result = writeRealm(ctx, () => {
              transaction.put(content, nextHash)
              const file = getRealmFile(ctx, nextHash) ?? ctx.files.write.create({ Hash: nextHash })
              replay.File = file
              score.Hash = nextHash
              score.MaxCombo = parsed.maxCombo
              score.Date = parsed.timestamp
              validateOwnerHashes(ctx, score)
              transaction.commit()
              return true
            })
            transaction.finalize()
            markChanged(ctx)
            ctx.logger.log('Score', LogAction.Update, score.ID, before, rollbackState(score))
            cleanupBlobIfUnreferenced(ctx, originalHash)
            return result
          } catch (error) {
            try { ctx.logger.discardSince(checkpoint) } finally { transaction.rollback() }
            throw error
          } finally { ctx.fileTransaction = previousTransaction }
        },
      }
      return editor
    },
  }
}

/** Score sub-module with query and write operations. */
export type ScoreUpdatePatch = Partial<Omit<Score, 'ID' | 'Hash' | 'Files'>>
export interface ScoreModule {
  /** Queries readonly score snapshots. */
  readonly get: QuerySurface<Score, ScoreQuery>
  /** Creates, updates, deletes, or upserts scores. */
  readonly write: Crud<Score>
  /** Opens one replay editor. */
  open(scoreId: string): ScoreEditor
}
