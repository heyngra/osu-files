import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, mkdirSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { readZipEntries } from '../src/osz/import.js'
import { init } from '../src/index.js'
import { parseSkinIni } from '../src/skin/skin-ini.js'
import { SAMPLE_OSK } from './helpers.js'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('parseSkinIni', () => {
  it('parses General section', () => {
    const result = parseSkinIni(`[General]
      Name: My Skin
      Author: Some Creator
      Version: 2.7
      AnimationFramerate: 60
    `)
    assert.strictEqual(result.general.name, 'My Skin')
    assert.strictEqual(result.general.author, 'Some Creator')
    assert.strictEqual(result.general.version, '2.7')
    assert.strictEqual(result.general.animationFramerate, 60)
  })

  it('parses Colours section', () => {
    const result = parseSkinIni(`[Colours]
      Combo1: 255, 0, 0
      Combo2: 0, 255, 0
      Combo3: 0, 0, 255
      MenuGlow: 82, 74, 71
      SliderBorder: 150, 150, 150
    `)
    assert.deepStrictEqual(result.colours.combo, [[255, 0, 0], [0, 255, 0], [0, 0, 255]])
    assert.deepStrictEqual(result.colours.menuGlow, [82, 74, 71])
    assert.deepStrictEqual(result.colours.sliderBorder, [150, 150, 150])
  })

  it('parses Fonts section', () => {
    const result = parseSkinIni(`[Fonts]
      HitCirclePrefix: default
      HitCircleOverlap: 18
      ScorePrefix: score
      ScoreOverlap: 7
    `)
    assert.strictEqual(result.fonts.hitCirclePrefix, 'default')
    assert.strictEqual(result.fonts.hitCircleOverlap, 18)
    assert.strictEqual(result.fonts.scoreOverlap, 7)
  })

  it('parses Mania section', () => {
    const result = parseSkinIni(`[Mania]
      Keys: 4
      KeyLayout: QWE, ASD
      LightPlayer: 1
      ColumnSpacing: 5
    `)
    assert.strictEqual(result.mania.keys, 4)
    assert.strictEqual(result.mania.keyLayout, 'QWE, ASD')
    assert.strictEqual(result.mania.lightPlayer, true)
    assert.strictEqual(result.mania.columnSpacing, 5)
  })

  it('parses CatchTheBeat section', () => {
    const result = parseSkinIni(`[CatchTheBeat]
      HyperDashColour: 255, 0, 0
      HyperDashTargetColour: 0, 255, 0
    `)
    assert.deepStrictEqual(result.catchTheBeat.hyperDashColour, [255, 0, 0])
    assert.deepStrictEqual(result.catchTheBeat.hyperDashTargetColour, [0, 255, 0])
  })

  it('ignores comments', () => {
    const result = parseSkinIni(`[General]
      // This is a comment
      Name: Test
      // Another comment
      Author: Tester
    `)
    assert.strictEqual(result.general.name, 'Test')
    assert.strictEqual(result.general.author, 'Tester')
  })

  it('provides raw fallback for unknown sections', () => {
    const result = parseSkinIni(`[CustomSection]
      SomeKey: SomeValue
    `)
    assert.strictEqual(result.raw['CustomSection']['SomeKey'], 'SomeValue')
  })

  it('handles empty content', () => {
    const result = parseSkinIni('')
    assert.strictEqual(Object.keys(result.raw).length, 0)
    assert.strictEqual(result.general.name, undefined)
  })

  it('parses real WhiteCat skin.ini', async () => {
    const entries = await readZipEntries(SAMPLE_OSK)
    const skinIniEntry = entries.find(e => e.filename.toLowerCase() === 'skin.ini')
    assert.ok(skinIniEntry)

    const result = parseSkinIni(skinIniEntry.buffer.toString('utf-8'))
    assert.ok(result.general.name?.includes('WhiteCat'))
    assert.strictEqual(result.general.author, 'cyperdark')
    assert.strictEqual(result.general.version, '2.5')
    assert.strictEqual(result.general.animationFramerate, 60)
    assert.strictEqual(result.general.cursorExpand, false)
    assert.strictEqual(result.general.cursorCentre, true)
    assert.strictEqual(result.general.allowSliderBallTint, true)
    assert.strictEqual(result.general.sliderStyle, 2)
    assert.strictEqual(result.colours.combo?.length, 2)
    assert.deepStrictEqual(result.colours.combo![0], [198, 173, 159])
    assert.deepStrictEqual(result.colours.combo![1], [150, 139, 136])
  })
})

describe('Import/Export .osk', { timeout: 120000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-osk-${Date.now()}`)
  const filesPath = join(tmpRoot, 'files')
  const realmPath = join(tmpRoot, 'client.realm')

  let expectedFileCount = 0

  before(async () => {
    mkdirSync(filesPath, { recursive: true })
    const entries = await readZipEntries(SAMPLE_OSK)
    expectedFileCount = entries.length
  })

  after(() => {
    rmSync(tmpRoot, { recursive: true, force: true })
  })

  it('imports .osk and populates Realm correctly', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const result = await osu.osk.import(SAMPLE_OSK)

    assert.ok(result.name.includes('WhiteCat'))
    assert.ok(result.name.endsWith('[whitecatskin]'))
    assert.strictEqual(result.creator, 'cyperdark')
    assert.strictEqual(result.files, expectedFileCount)
    assert.ok(result.hash)
    assert.ok(result.id)

    const skins = osu.skins.get
    assert.strictEqual(skins.length, 1)
    assert.strictEqual(skins[0].Protected, false)
    assert.strictEqual(skins[0].DeletePending, false)

    osu.close()
  })

  it('exports .osk with identical file hashes', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const skins = osu.skins.get
    assert.strictEqual(skins.length, 1)

    const exportPath = join(tmpRoot, 'exported.osk')
    await osu.osk.export(String(skins[0].ID), exportPath)
    assert.ok(existsSync(exportPath))

    const orig = await readZipEntries(SAMPLE_OSK)
    const exp = await readZipEntries(exportPath)

    assert.strictEqual(exp.length, orig.length)

    const origMap = new Map(orig.map(e => [e.filename, e]))
    const expMap = new Map(exp.map(e => [e.filename, e]))

    for (const [filename, o] of origMap) {
      const e = expMap.get(filename)
      assert.ok(e, `Missing in export: ${filename}`)
      assert.strictEqual(sha256(e.buffer), sha256(o.buffer), `Hash mismatch: ${filename}`)
    }

    osu.close()
  })

  it('reimports exported .osk correctly', async () => {
    const reimportRoot = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const exportPath = join(tmpRoot, 'exported.osk')
    const osu2 = init(join(reimportRoot, 'client.realm'), {
      schemaVersion: 51,
      filesFolderPath: join(reimportRoot, 'files'),
    })
    const reimported = await osu2.osk.import(exportPath)
    assert.ok(reimported.name.includes('WhiteCat'))
    assert.strictEqual(reimported.files, expectedFileCount)
    osu2.close()
    rmSync(reimportRoot, { recursive: true, force: true })
  })

  it('duplicates a skin with (modified) suffix', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const original = osu.skins.get[0]
    const dup = osu.skins.duplicate(String(original.ID))

    assert.ok(dup.Name!.includes('(modified)'))
    assert.strictEqual(dup.Protected, false)
    assert.strictEqual(dup.DeletePending, false)
    assert.strictEqual(dup.Creator, original.Creator)

    assert.strictEqual(osu.skins.get.length, 2)
    osu.close()
  })

  it('duplicate auto-increments on name collision', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const original = osu.skins.get[0]

    const baseName = original.Name!

    const dup1 = osu.skins.duplicate(String(original.ID))
    assert.strictEqual(dup1.Name, `${baseName} (modified) (1)`)

    const dup2 = osu.skins.duplicate(String(original.ID))
    assert.strictEqual(dup2.Name, `${baseName} (modified) (2)`)

    osu.close()
  })

  it('delete / undelete / usable chain', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const skin = osu.skins.get[0]
    assert.strictEqual(skin.DeletePending, false)
    assert.strictEqual(osu.skins.get.usable().length, 4)

    osu.skins.delete(String(skin.ID))
    assert.strictEqual(skin.DeletePending, true)
    assert.strictEqual(osu.skins.get.usable().length, 3)

    osu.skins.undelete(String(skin.ID))
    assert.strictEqual(skin.DeletePending, false)
    assert.strictEqual(osu.skins.get.usable().length, 4)

    osu.close()
  })

  it('rejects delete on protected skin', async () => {
    const protectRoot = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    mkdirSync(join(protectRoot, 'files'), { recursive: true })
    const { default: Realm } = await import('realm')
    const osu = init(join(protectRoot, 'client.realm'), { schemaVersion: 51, filesFolderPath: join(protectRoot, 'files') })

    const skin = osu.skins.write.create({
      ID: new Realm.BSON.UUID(),
      Name: 'Protected Skin',
      Protected: true,
      DeletePending: false,
    })

    assert.throws(() => osu.skins.delete(String(skin.ID)), /Cannot delete protected skin/)
    osu.close()
    rmSync(protectRoot, { recursive: true, force: true })
  })

  it('query methods', async () => {
    const queryRoot = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(queryRoot, 'client.realm'), { schemaVersion: 51, filesFolderPath: join(queryRoot, 'files') })
    const result = await osu.osk.import(SAMPLE_OSK)

    const foundHash = osu.skins.get.byHashEquals(result.hash)
    assert.strictEqual(foundHash.length, 1)

    const foundCreator = osu.skins.get.byCreatorContains('cyperdark')
    assert.strictEqual(foundCreator.length, 1)
    assert.strictEqual(osu.skins.get.byCreatorContains('CYPERDARK').length, 1)

    const skin = osu.skins.get[0]
    const foundName = osu.skins.get.byNameContains(skin.Name!.substring(0, 10))
    assert.strictEqual(foundName.length, 1)

    assert.strictEqual(osu.skins.get.withFile('cursor.png').length, 1)
    assert.strictEqual(osu.skins.get.withFile('nonexistent.png').length, 0)

    osu.close()
    rmSync(queryRoot, { recursive: true, force: true })
  })
})
