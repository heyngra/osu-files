import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init } from '../src/index.js'

describe('Database integrity without a file store', () => {
  it('reports unverifiable blobs as a warning instead of a false error', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-integrity-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.files.write.create({ Hash: 'a'.repeat(64) })
      const report = osu.integrity.check()
      assert.strictEqual(report.valid, true)
      assert.strictEqual(report.errors.length, 0)
      assert.ok(report.warnings.some(issue => issue.code === 'storage-unavailable'))
    } finally {
      osu.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
