import type { BeatmapMetadata } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapMetadataGetModule } from './get/metadata.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

/**
 * Creates the beatmap metadata sub-module with query and write operations.
 * @example
 * const meta = db.metadata.byId(id)
 */
export function createBeatmapMetadataModule(ctx: OsuFilesContext) {
  const get = createBeatmapMetadataGetModule(ctx.realm)
  return { get, write: createCrud<BeatmapMetadata>(ctx, getConfig('BeatmapMetadata')!) }
}

/** Beatmap metadata sub-module with query and write operations. */
export type BeatmapMetadataModule = ReturnType<typeof createBeatmapMetadataModule>
