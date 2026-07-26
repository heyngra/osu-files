import { describe, it } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { readZipEntries } from '../src/osz/import.js'
import { init } from '../src/index.js'
import { nukeOldTestDirs, SAMPLE_OSZ } from './helpers.js'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function tmp() {
  nukeOldTestDirs()
  const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
  const filesPath = join(root, 'files')
  const realmPath = join(root, 'client.realm')
  return { root, filesPath, realmPath }
}

describe('Import/Export .osz', { timeout: 60000 }, () => {

  it('imports .osz and populates Realm correctly', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      const result = await osu.osz.import(SAMPLE_OSZ)
      assert.strictEqual(result.onlineID, 506483)
      assert.strictEqual(result.beatmaps.length, 4)
      assert.strictEqual(result.files.length, 13)
      assert.ok(result.setHash)
      assert.strictEqual(osu.sets.get.length, 1)
      assert.strictEqual(osu.sets.get[0].OnlineID, 506483)
      assert.strictEqual(osu.beatmaps.get.length, 4)
      const easy = osu.beatmaps.get.find(b => b.DifficultyName === 'Easy')
      assert.ok(easy)
      assert.strictEqual(easy!.Difficulty!.DrainRate, 3)
      assert.strictEqual(easy!.Metadata!.Title, 'Make A Move')
      assert.strictEqual(easy!.Metadata!.Author!.Username, 'wajinshu')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('reads full beatmap data back from files folder', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const data = osu.beatmap.getFullDataSet(String(osu.sets.get[0].ID))
      assert.ok(data)
      assert.strictEqual(data!.beatmaps.length, 4)
      assert.ok(data!.beatmaps[0].hitObjects.length > 0)
      assert.ok(data!.beatmaps[0].timingPoints.length > 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('exports .osz with identical file hashes', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const exportPath = join(root, 'exported.osz')
      await osu.osz.export(String(osu.sets.get[0].ID), exportPath)
      osu.close()

      assert.ok(existsSync(exportPath))
      assert.ok(readFileSync(exportPath).length > 1000)
      const orig = await readZipEntries(SAMPLE_OSZ)
      const exp = await readZipEntries(exportPath)
      assert.strictEqual(exp.length, orig.length)
      const origMap = new Map(orig.map(e => [e.filename, e]))
      const expMap = new Map(exp.map(e => [e.filename, e]))
      for (const [filename, o] of origMap) {
        const e = expMap.get(filename)
        assert.ok(e, `Missing in export: ${filename}`)
        assert.strictEqual(sha256(e.buffer), sha256(o.buffer), `Hash mismatch: ${filename}`)
      }
    } finally { try { rmSync(root, { recursive: true, force: true }) } catch {} }
  })

  it('reimports exported .osz correctly', async () => {
    const src = tmp()
    const dst = tmp()
    const osu = init(src.realmPath, { schemaVersion: 51, filesFolderPath: src.filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const exportPath = join(src.root, 'exported.osz')
      await osu.osz.export(String(osu.sets.get[0].ID), exportPath)
      osu.close()

      const osu2 = init(dst.realmPath, { schemaVersion: 51, filesFolderPath: dst.filesPath })
      try {
        const reimported = await osu2.osz.import(exportPath)
        assert.strictEqual(reimported.beatmaps.length, 4)
        assert.strictEqual(reimported.onlineID, 506483)
      } finally { osu2.close() }
    } finally {
      try { rmSync(src.root, { recursive: true, force: true }) } catch {}
      try { rmSync(dst.root, { recursive: true, force: true }) } catch {}
    }
  })

  it('upserts by OnlineID without duplicating', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const before = osu.sets.get.length
      await osu.osz.import(SAMPLE_OSZ)
      assert.strictEqual(osu.sets.get.length, before)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })
})
