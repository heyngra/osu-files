import type { OsuFilesContext } from './context.js'
import { MetadataQuery } from './get/metadata.get.js'
import type { QuerySurface } from './get/base.js'
import type { BeatmapMetadata } from './schema/types.js'

/**
 * Creates the beatmap metadata sub-module with query operations.
 * @example
 * const meta = db.metadata.get.byTitleContains('Make')[0]
 */
export function createBeatmapMetadataModule(ctx: OsuFilesContext): BeatmapMetadataModule {
  const q = new MetadataQuery(ctx.realm)
  q.enableCache = ctx.queryCache ?? true
  return {
    /** Queries readonly beatmap metadata snapshots. */
    get: q.proxify(),
  }
}

/** Beatmap metadata sub-module with query operations only. */
export type BeatmapMetadataModule = {
  /** Queries readonly beatmap metadata snapshots. */
  readonly get: QuerySurface<BeatmapMetadata, MetadataQuery>
}
