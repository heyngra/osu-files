import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { FileStore } from '../src/file-store.js'
import { sha256 } from '../src/util.js'

describe('FileStore transactions', () => {
  it('commits, finalises, and verifies staged content', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-file-store-'))
    try {
      const store = new FileStore(join(root, 'files'))
      const content = Buffer.from('transactional content')
      const hash = sha256(content)
      const transaction = store.beginTransaction()

      transaction.put(content, hash)
      assert.strictEqual(store.verify(hash), false)
      transaction.commit()
      transaction.finalize()

      assert.deepStrictEqual(store.read(hash), content)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recovers staged files from an abandoned transaction', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-file-store-'))
    try {
      const storePath = join(root, 'files')
      const store = new FileStore(storePath)
      const content = Buffer.from('abandoned content')
      const hash = sha256(content)
      const transaction = store.beginTransaction()
      transaction.put(content, hash)

      new FileStore(storePath)

      assert.throws(() => transaction.read(hash))
      assert.strictEqual(store.verify(hash), false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
