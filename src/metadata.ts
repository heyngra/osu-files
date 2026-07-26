import type { BeatmapMetadata } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { MetadataQuery } from './get/metadata.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap metadata sub-module with query and write operations.
 * @example
 * const meta = db.metadata.get.byTitleContains('Make')[0]
 */
export function createBeatmapMetadataModule(ctx: OsuFilesContext) {
  const q = new MetadataQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify(), write: createCrud<BeatmapMetadata>(ctx, getConfig('BeatmapMetadata')!) }
}

/** Beatmap metadata sub-module with query and write operations. */
export type BeatmapMetadataModule = ReturnType<typeof createBeatmapMetadataModule>
