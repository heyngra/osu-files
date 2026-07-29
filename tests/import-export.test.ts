import { describe, it } from 'node:test'
import assert from 'node:assert'
import { createWriteStream, existsSync, readFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { readZipEntries } from '../src/osz/import.js'
import { ZipFile } from 'yazl'
import { init } from '../src/index.js'
import { parseOsu } from '../src/beatmap/parse.js'
import { serializeOsu } from '../src/beatmap/serialize.js'
import { SAMPLE_OSZ } from './helpers.js'
import { fileStoragePath } from '../src/util.js'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function tmp() {
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

  it('saving a beatmap with modified storyboard hashes correctly', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const collab = osu.beatmaps.get.find(b => b.DifficultyName === 'Collab Insane')
      assert.ok(collab)
      const collabId = collab.ID
      const origBeatmapHash = collab.Hash

      const set = osu.sets.get[0]
      const origSetHash = set.Hash

      const data = osu.beatmap.getFullData(String(collabId))
      assert.ok(data)
      assert.ok(data!.storyboard)

      const fg = data!.storyboard!.layers.get('Foreground')!
      const sprite = fg.elements[0] as any
      sprite.addAlpha(0, 0, 500)

      const changed = osu.beatmap.save(String(collabId), data!)
      assert.strictEqual(changed, true)

      const refreshed = osu.beatmaps.get.byId(collabId)[0]
      assert.notStrictEqual(refreshed.Hash, origBeatmapHash)

      const refreshedSet = osu.sets.get[0]
      assert.notStrictEqual(refreshedSet.Hash, origSetHash)
      const setFiles = [...refreshedSet.Beatmaps]
        .map(beatmap => {
          const usage = refreshedSet.Files.find(file => file.File?.Hash === beatmap.Hash)
          return { filename: usage?.Filename ?? beatmap.Hash ?? '', content: readFileSync(fileStoragePath(filesPath, beatmap.Hash!)) }
        })
        .sort((a, b) => a.filename.localeCompare(b.filename))
      assert.strictEqual(refreshedSet.Hash, sha256(Buffer.concat(setFiles.map(file => file.content))))
      const usage = refreshedSet.Files.find(f => f.Filename?.includes('Collab Insane'))
      assert.strictEqual(usage?.File?.Hash, refreshed.Hash)

      const exportPath = join(root, 'modified.osz')
      await osu.osz.export(String(refreshedSet.ID), exportPath)
      const exported = (await readZipEntries(exportPath))
        .find(e => e.filename.includes('Collab Insane'))!.buffer.toString('utf-8')
      const parsedExport = parseOsu(exported)
      assert.ok(parsedExport.storyboard)
      assert.strictEqual(parsedExport.storyboard!.layers.get('Foreground')!.elements.length, fg.elements.length)
      assert.ok(parsedExport.storyboard!.layers.get('Foreground')!.elements[0].commands.alpha.length > 0)
    } finally {
      try { rmSync(root, { recursive: true, force: true }) } catch {}
    }
  })

  it('save returns true when hash changes (line ending normalization)', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const easy = osu.beatmaps.get.find(b => b.DifficultyName === 'Easy')
      assert.ok(easy)
      const easyId = easy.ID
      const originalHash = easy.Hash

      const data = osu.beatmap.getFullData(String(easyId))
      assert.ok(data)

      const changed = osu.beatmap.save(String(easyId), data!)
      assert.strictEqual(changed, true)

      const refreshed = osu.beatmaps.get.byId(easyId)[0]
      assert.ok(refreshed.Hash)
      assert.notStrictEqual(refreshed.Hash, originalHash)
    } finally {
      try { rmSync(root, { recursive: true, force: true }) } catch {}
    }
  })

  it('rejects case-insensitive duplicate archive filenames', async () => {
    const { root } = tmp()
    const archivePath = join(root, 'duplicate.osz')
    const zip = new ZipFile()
    const output = createWriteStream(archivePath)
    zip.outputStream.pipe(output)
    zip.addBuffer(Buffer.from('first'), 'song.osu')
    zip.addBuffer(Buffer.from('second'), 'SONG.OSU')
    zip.end()
    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve)
      output.on('error', reject)
    })

    try {
      await assert.rejects(readZipEntries(archivePath), /duplicate filename/i)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('storyboard content round-trips through realm write', async () => {
    const { root, filesPath, realmPath } = tmp()
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    try {
      await osu.osz.import(SAMPLE_OSZ)
      const collab = osu.beatmaps.get.find(b => b.DifficultyName === 'Collab Insane')
      assert.ok(collab)

      const data = osu.beatmap.getFullData(String(collab.ID))
      assert.ok(data)
      assert.strictEqual(data!.storyboard!._dirty, false)

      const reSerialized = serializeOsu(data!)
      const reParsed = parseOsu(reSerialized)
      assert.ok(reParsed.storyboard)
    } finally {
      try { rmSync(root, { recursive: true, force: true }) } catch {}
    }
  })
})
