import type Realm from 'realm'
import type { File } from './schema/types.js'
import type { RollbackLogger } from './write/logger.js'
import { createFileGetModule } from './get/files.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'

export function createFileModule(realm: Realm, logger: RollbackLogger) {
  const get = createFileGetModule(realm)
  return { ...get, get, write: createCrud<File>(realm, logger, getConfig('File')!) }
}
