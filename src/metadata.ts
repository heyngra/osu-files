import type { OsuFilesContext } from './context.js'
import { MetadataQuery } from './get/metadata.get.js'
import type { Metadata } from './get/facades.js'
import type { BeatmapMetadata } from './schema/types.js'

/**
 * Creates the read-only beatmap metadata module.
 * @example
 * const meta = db.metadata.get.byTitleContains('Make')[0]
 */
export function createBeatmapMetadataModule(ctx: OsuFilesContext): BeatmapMetadataModule {
  const q = new MetadataQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Returns read-only metadata snapshots through `get`. */
    get: q.proxify() as unknown as Metadata,
  }
}

/** Read-only beatmap metadata module. */
export type BeatmapMetadataModule = {
  /** Returns read-only metadata snapshots through `get`. */
  readonly get: Metadata
}
