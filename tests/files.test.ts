import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init } from '../src/index.js'
import { sha256 } from '../src/util.js'

describe('File cleanup', () => {
  it('removes storage before orphan metadata', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-cleanup-'))
    const filesPath = join(root, 'files')
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      const content = Buffer.from('orphaned content')
      const hash = sha256(content)
      osu.files.put(content, hash)
      osu.files.write.create({ Hash: hash })

      const report = osu.files.cleanupOrphanedFiles()
      assert.strictEqual(report.removed, 1)
      assert.strictEqual(report.failed.length, 0)
    assert.strictEqual(osu.files.get.byHash(hash).length, 0)
      assert.strictEqual(osu.files.verify(hash), false)
    } finally {
      osu.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps orphan metadata when blob deletion fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-cleanup-'))
    const filesPath = join(root, 'files')
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      const content = Buffer.from('retryable orphan')
      const hash = sha256(content)
      osu.files.put(content, hash)
      osu.files.write.create({ Hash: hash })
      const store = osu.files.store!
      const remove = store.remove.bind(store)
      ;(store as unknown as { remove: (value: string) => boolean }).remove = () => { throw new Error('storage unavailable') }

      const report = osu.files.cleanupOrphanedFiles()
      assert.strictEqual(report.failed.length, 1)
    assert.strictEqual(osu.files.get.byHash(hash).length, 1)

      ;(store as unknown as { remove: (value: string) => boolean }).remove = remove
    } finally {
      osu.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
