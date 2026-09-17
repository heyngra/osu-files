import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
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

      const transactionDirectory = join(tmpdir(), 'osu-files', 'file-store', 'transactions')
      const manifestPath = readdirSync(transactionDirectory)
        .map(name => join(transactionDirectory, name))
        .find(path => {
          try { return JSON.parse(readFileSync(path, 'utf8')).basePath === resolve(storePath) } catch { return false }
        })
      assert.ok(manifestPath)
      const manifest = JSON.parse(readFileSync(manifestPath!, 'utf8')) as { pid: number }
      manifest.pid = process.pid + 1_000_000
      writeFileSync(manifestPath!, JSON.stringify(manifest))

      new FileStore(storePath)

      assert.throws(() => transaction.read(hash))
      assert.strictEqual(store.verify(hash), false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not recover a live transaction in the same process', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-file-store-'))
    try {
      const storePath = join(root, 'files')
      const store = new FileStore(storePath)
      const content = Buffer.from('live content')
      const hash = sha256(content)
      const transaction = store.beginTransaction()
      transaction.put(content, hash)

      new FileStore(storePath)

      assert.deepStrictEqual(transaction.read(hash), content)
      transaction.rollback()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps a promoted blob when another transaction may share it', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-file-store-'))
    try {
      const store = new FileStore(join(root, 'files'))
      const content = Buffer.from('shared content')
      const hash = sha256(content)
      const first = store.beginTransaction()
      const second = store.beginTransaction()
      first.put(content, hash)
      second.put(content, hash)
      first.commit()
      second.commit()
      first.rollback()

      assert.strictEqual(store.verify(hash), true)
      second.finalize()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
