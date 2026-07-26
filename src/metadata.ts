import type { BeatmapMetadata } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { MetadataQuery } from './get/metadata.get.js'

/**
 * Creates the beatmap metadata sub-module with query operations.
 * @example
 * const meta = db.metadata.get.byTitleContains('Make')[0]
 */
export function createBeatmapMetadataModule(ctx: OsuFilesContext) {
  const q = new MetadataQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return { get: q.proxify() }
}

/** Beatmap metadata sub-module with query operations only. */
export type BeatmapMetadataModule = ReturnType<typeof createBeatmapMetadataModule>
