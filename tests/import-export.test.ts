import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { readZipEntries } from '../src/osz/import.js'
import { init } from '../src/index.js'
import { SAMPLE_OSZ } from './helpers.js'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('Import/Export .osz', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osz-test-${Date.now()}`)
  const filesPath = join(tmpRoot, 'files')
  const realmPath = join(tmpRoot, 'test.realm')

  before(() => {
    mkdirSync(filesPath, { recursive: true })
  })

  it('imports .osz and populates Realm correctly', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const result = await osu.osz.import(SAMPLE_OSZ)

    assert.strictEqual(result.onlineID, 506483)
    assert.strictEqual(result.beatmaps.length, 4)
    assert.strictEqual(result.files.length, 13)
    assert.ok(result.setHash)

    const sets = osu.sets.all()
    assert.strictEqual(sets.length, 1)
    assert.strictEqual(sets[0].OnlineID, 506483)

    const bms = osu.beatmaps.all()
    assert.strictEqual(bms.length, 4)

    const easy = bms.find(b => b.DifficultyName === 'Easy')
    assert.ok(easy)
    assert.strictEqual(easy!.Difficulty!.DrainRate, 3)
    assert.strictEqual(easy!.Metadata!.Title, 'Make A Move')
    assert.strictEqual(easy!.Metadata!.Author!.Username, 'wajinshu')

    osu.close()
  })

  it('reads full beatmap data back from files folder', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const sets = osu.sets.all()
    const data = osu.beatmap.getFullDataSet(String(sets[0].ID))
    assert.ok(data)
    assert.strictEqual(data!.beatmaps.length, 4)
    assert.ok(data!.beatmaps[0].hitObjects.length > 0)
    assert.ok(data!.beatmaps[0].timingPoints.length > 0)
    osu.close()
  })

  it('exports .osz with identical file hashes', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const sets = osu.sets.all()
    const exportPath = join(tmpRoot, 'exported.osz')
    await osu.osz.export(String(sets[0].ID), exportPath)
    assert.ok(existsSync(exportPath))
    assert.ok(readFileSync(exportPath).length > 1000)
    osu.close()

    const orig = await readZipEntries(SAMPLE_OSZ)
    const exp = await readZipEntries(exportPath)

    assert.strictEqual(exp.length, orig.length)

    const origMap = new Map(orig.map(e => [e.filename, e]))
    const expMap = new Map(exp.map(e => [e.filename, e]))

    let match = 0
    for (const [filename, o] of origMap) {
      const e = expMap.get(filename)
      assert.ok(e, `Missing in export: ${filename}`)
      const oh = sha256(o.buffer)
      const eh = sha256(e.buffer)
      assert.strictEqual(eh, oh, `Hash mismatch: ${filename}`)
      match++
    }
    assert.strictEqual(match, 13)
  })

  it('reimports exported .osz correctly', async () => {
    const osu2 = init(join(tmpRoot, 'reimport.realm'), {
      schemaVersion: 51,
      filesFolderPath: join(tmpRoot, 'files2'),
    })
    const reimported = await osu2.osz.import(join(tmpRoot, 'exported.osz'))
    assert.strictEqual(reimported.beatmaps.length, 4)
    assert.strictEqual(reimported.onlineID, 506483)
    osu2.close()
  })

  it('upserts by OnlineID without duplicating', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const before = osu.sets.all().length
    await osu.osz.import(SAMPLE_OSZ)
    const after = osu.sets.all().length
    assert.strictEqual(after, before)
    osu.close()
  })
})
