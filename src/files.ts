import { rmSync } from 'fs'
import type { OsuFilesContext } from './context.js'
import { createFileGetModule } from './get/files.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { fileStoragePath } from './util.js'

export function cleanupOrphanedFiles(ctx: OsuFilesContext): void {
  if (!ctx.filesFolderPath) return

  const referenced = new Set<string>()

  for (const s of ctx.realm.objects<any>('BeatmapSet').filtered('DeletePending == false')) {
    for (const u of s.Files as any[]) if (u.File?.Hash) referenced.add(u.File.Hash)
  }
  for (const s of ctx.realm.objects<any>('Skin').filtered('DeletePending == false')) {
    for (const u of s.Files as any[]) if (u.File?.Hash) referenced.add(u.File.Hash)
  }
  for (const s of ctx.realm.objects<any>('Score').filtered('DeletePending == false')) {
    for (const u of s.Files as any[]) if (u.File?.Hash) referenced.add(u.File.Hash)
  }

  const orphaned = [...ctx.realm.objects<any>('File')].filter((f: any) => f.Hash && !referenced.has(f.Hash))
  if (orphaned.length === 0) return

  ctx.realm.write(() => {
    for (const file of orphaned) {
      try { rmSync(fileStoragePath(ctx.filesFolderPath!, file.Hash)) } catch { }
      ctx.realm.delete(file)
    }
  })
}

export function createFileModule(ctx: OsuFilesContext) {
  const get = createFileGetModule(ctx.realm)
  return {
    ...get, get,
    write: createCrud<any>(ctx, getConfig('File')!),
    cleanupOrphanedFiles: () => cleanupOrphanedFiles(ctx),
  }
}
