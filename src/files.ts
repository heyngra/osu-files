import type { File } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createFileGetModule } from './get/files.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createFileModule(ctx: OsuFilesContext) {
  const get = createFileGetModule(ctx.realm)
  return { ...get, get, write: createCrud<File>(ctx, getConfig('File')!) }
}
