import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, readdirSync, unlinkSync, statSync, existsSync, mkdirSync } from 'fs'

export type LogAction = 'create' | 'update' | 'delete' | 'soft-delete' | 'undelete' | 'duplicate'

export type ChangeLogEntry = {
  timestamp: number
  entity: string
  action: LogAction
  primaryKey: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export type RollbackOptions = {
  enabled?: boolean
  maxSize?: number
  maxAge?: number
}

function serialize(obj: unknown, seen?: WeakSet<object>): unknown {
  seen = seen ?? new WeakSet()
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(v => serialize(v, seen))

  if (seen.has(obj)) {
    try { return (obj as Record<string, unknown>).ID ?? (obj as Record<string, unknown>).Hash ?? (obj as Record<string, unknown>).ShortName ?? null }
    catch { return null }
  }
  seen.add(obj)

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    try {
      const val = (obj as Record<string, unknown>)[key]
      if (typeof val === 'function') continue
      result[key] = serialize(val, seen)
    } catch {
      result[key] = null
    }
  }
  return result
}

export class RollbackLogger {
  private entries: ChangeLogEntry[] = []
  private entrySize = 0
  private logDir: string
  enabled: boolean

  constructor(options?: RollbackOptions) {
    const opts = { enabled: true, maxSize: 1_048_576, maxAge: 86_400_000, ...options }
    this.enabled = opts.enabled
    this.logDir = join(tmpdir(), 'osu-files-rollback')

    if (this.enabled) {
      if (!this.checkWritable())
        return

      if (!existsSync(this.logDir))
        mkdirSync(this.logDir, { recursive: true })

      this.purge(opts.maxSize, opts.maxAge)
    }
  }

  private checkWritable(): boolean {
    try {
      const test = join(tmpdir(), `.osu-files-test-${process.pid}`)
      writeFileSync(test, '', 'utf-8')
      unlinkSync(test)
      return true
    } catch {
      console.warn('[osu-files] Temp directory not writable, rollback disabled')
      this.enabled = false
      return false
    }
  }

  private purge(maxSize: number, maxAge: number): void {
    try {
      const now = Date.now()
      let files = readdirSync(this.logDir).map(f => {
        const p = join(this.logDir, f)
        try {
          const s = statSync(p)
          return { name: f, path: p, size: s.size, mtime: s.mtimeMs }
        } catch { return null }
      }).filter((f): f is NonNullable<typeof f> => f !== null)

      const old = files.filter(f => (now - f.mtime) > maxAge)
      old.forEach(f => { try { unlinkSync(f.path) } catch {} })

      files = files.filter(f => (now - f.mtime) <= maxAge)
      const totalSize = files.reduce((s, f) => s + f.size, 0)

      if (totalSize > maxSize) {
        files.sort((a, b) => a.mtime - b.mtime)
        let excess = totalSize - maxSize
        for (const f of files) {
          if (excess <= 0) break
          try { unlinkSync(f.path); excess -= f.size } catch {}
        }
      }
    } catch {}
  }

  log(entity: string, action: LogAction, primaryKey: unknown, before: unknown, after: unknown): void {
    if (!this.enabled) return

    const entry: ChangeLogEntry = {
      timestamp: Date.now(),
      entity,
      action,
      primaryKey: String(primaryKey),
      before: before ? serialize(before) as Record<string, unknown> : null,
      after: after ? serialize(after) as Record<string, unknown> : null,
    }

    this.entries.push(entry)
    this.entrySize += JSON.stringify(entry).length

    try {
      const ts = new Date(entry.timestamp).toISOString().replace(/[:.]/g, '-')
      const file = join(this.logDir, `${ts}_${entity}_${action}_${primaryKey}.json`)
      writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8')
    } catch {}

    if (this.entrySize > 1_048_576)
      this.entries.splice(0, Math.ceil(this.entries.length * 0.3))
  }

  getEntries(): readonly ChangeLogEntry[] {
    return this.entries
  }

  revertLast(): boolean {
    if (this.entries.length === 0) return false
    const entry = this.entries.pop()!
    this.applyRevert(entry)
    return true
  }

  revert(): void {
    for (let i = this.entries.length - 1; i >= 0; i--)
      this.applyRevert(this.entries[i])
    this.entries = []
  }

  private applyRevert(_entry: ChangeLogEntry): void {}

  disable(): void {
    this.enabled = false
    this.entries = []
    this.entrySize = 0
  }
}

export function snapshot(realm: Realm, type: string, pk: unknown): Record<string, unknown> | null {
  if (pk === undefined || pk === null) return null
  const obj = realm.objectForPrimaryKey(type, pk as never)
  if (!obj) return null
  return serialize(obj) as Record<string, unknown>
}
