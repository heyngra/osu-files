import type Realm from 'realm'
import type { RollbackLogger } from './write/logger.js'

export type OsuFilesContext = {
  realm: Realm
  logger: RollbackLogger
  filesFolderPath?: string
  checkHash?: boolean
}

export function hasFilesFolder(ctx: OsuFilesContext): boolean {
  return !!ctx.filesFolderPath
}
