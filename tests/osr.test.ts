import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { existsSync, mkdirSync, readFileSync, rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createHash } from 'crypto'
import { init } from '../src/index.js'
import { parseOsr as parseOsrBinary, computeReplayMD5, parseReplayFrames, ticksToDate, dateToTicks } from '../src/osr/parse.js'
import { LegacyMods, LegacyModsFlag, GameMode } from '../src/osr/types.js'
import type { Score } from '../src/schema/types.js'

const SAMPLE_OSR = './tests/Cookiezi - Hommarju feat. Latte - masterpiece [Insane] (2013-11-10) Osu-1.osr'
const SAMPLE_OSZ = './tests/12483 Hommarju feat. Latte - masterpiece.osz'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('Parse .osr', () => {
  let buf: Buffer
  before(() => { buf = readFileSync(SAMPLE_OSR) })

  it('parses binary header fields', () => {
    const p = parseOsrBinary(buf)
    assert.strictEqual(p.mode, GameMode.Osu)
    assert.strictEqual(p.gameVersion, 20131110)
    assert.strictEqual(p.beatmapMD5, 'e7532e42ab7aa3735fe3d109c675c140')
    assert.strictEqual(p.playerName, 'Cookiezi')
    assert.strictEqual(p.replayMD5.length, 32)
  })

  it('parses score counts', () => {
    const p = parseOsrBinary(buf)
    assert.strictEqual(p.count300, 611)
    assert.strictEqual(p.count100, 8)
    assert.strictEqual(p.count50, 0)
    assert.strictEqual(p.countMiss, 0)
    assert.strictEqual(p.countGeki, 107)
    assert.strictEqual(p.countKatu, 6)
  })

  it('parses score metadata', () => {
    const p = parseOsrBinary(buf)
    assert.strictEqual(p.totalScore, 16638107)
    assert.strictEqual(p.maxCombo, 871)
    assert.strictEqual(p.perfectCombo, true)
  })

  it('parses mods as LegacyMods facade', () => {
    const p = parseOsrBinary(buf)
    assert.ok(p.mods instanceof LegacyMods)
    assert.strictEqual(p.mods.valueOf(), 88)
    assert.strictEqual(p.mods.hidden, true)
    assert.strictEqual(p.mods.hardRock, true)
    assert.strictEqual(p.mods.doubleTime, true)
    assert.strictEqual(p.mods.nightcore, false)
    assert.strictEqual(p.mods.easy, false)
    assert.strictEqual(p.mods.noFail, false)
  })

  it('parses timestamp', () => {
    const p = parseOsrBinary(buf)
    assert.ok(p.timestamp instanceof Date)
    assert.strictEqual(p.timestamp.getTime(), new Date('2013-11-10T16:02:24.000Z').getTime())
  })

  it('parses onlineScoreID', () => {
    const p = parseOsrBinary(buf)
    assert.strictEqual(p.onlineScoreID, 1518856368)
  })

  it('decompresses LZMA replay data', () => {
    const p = parseOsrBinary(buf)
    assert.ok(p.rawReplayData.length > 0)
    assert.ok(p.replayFrames.length > 0)
    assert.strictEqual(p.replayFrames.length, 1812)
  })

  it('has valid replay frame structure', () => {
    const p = parseOsrBinary(buf)
    const first = p.replayFrames[0]
    assert.ok(typeof first.timeDelta === 'number')
    assert.ok(typeof first.mouseX === 'number')
    assert.ok(typeof first.mouseY === 'number')
    assert.ok(typeof first.keys === 'number')
    assert.strictEqual(first.timeDelta, 0)
  })
})

describe('LegacyMods facade', () => {
  it('creates from number', () => {
    const m = LegacyMods.from(88)
    assert.strictEqual(m.valueOf(), 88)
  })

  it('supports has() method', () => {
    const m = LegacyMods.from(8 | 16)
    assert.ok(m.has(LegacyModsFlag.Hidden))
    assert.ok(m.has(LegacyModsFlag.HardRock))
    assert.ok(!m.has(LegacyModsFlag.DoubleTime))
  })

  it('supports numeric coercion', () => {
    const m = LegacyMods.from(64)
    assert.strictEqual(+m, 64)
    assert.strictEqual(Number(m), 64)
  })

  it('handles zero mods', () => {
    const m = LegacyMods.from(0)
    assert.strictEqual(m.valueOf(), 0)
    assert.strictEqual(m.noFail, false)
    assert.strictEqual(m.hidden, false)
  })

  it('handles all mods', () => {
    const m = LegacyMods.from(0x7fffffff)
    assert.ok(m.noFail)
    assert.ok(m.easy)
    assert.ok(m.hidden)
    assert.ok(m.scoreV2)
  })
})

describe('computeReplayMD5', () => {
  it('computes lazer-style replay MD5', () => {
    const result = computeReplayMD5('peppy', new Date('2023-01-15T12:30:00.000Z'))
    assert.strictEqual(result.length, 32)
    assert.match(result, /^[a-f0-9]{32}$/)
  })
})

describe('dateToTicks / ticksToDate round-trip', () => {
  it('round-trips a date', () => {
    const d = new Date('2023-06-15T10:30:00.000Z')
    const ticks = dateToTicks(d)
    const back = ticksToDate(ticks)
    assert.strictEqual(back.getTime(), d.getTime())
  })
})

describe('parseReplayFrames', () => {
  it('parses valid frame data', () => {
    const frames = parseReplayFrames('0,256,192,0,100,260,190,1')
    assert.strictEqual(frames.length, 2)
    assert.deepStrictEqual(frames[0], { timeDelta: 0, mouseX: 256, mouseY: 192, keys: 0 })
    assert.deepStrictEqual(frames[1], { timeDelta: 100, mouseX: 260, mouseY: 190, keys: 1 })
  })

  it('handles empty input', () => {
    assert.strictEqual(parseReplayFrames('').length, 0)
  })
})

describe('Import .osr', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-osr-import-${Date.now()}`)
  const filesPath = join(tmpRoot, 'files')
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => mkdirSync(filesPath, { recursive: true }))
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('imports .osr and populates Realm correctly', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })

    await osu.osz.import(SAMPLE_OSZ)

    const result = osu.osr.import(SAMPLE_OSR)

    assert.strictEqual(result.playerName, 'Cookiezi')
    assert.strictEqual(result.totalScore, 16638107)
    assert.strictEqual(result.mods.valueOf(), 88)
    assert.strictEqual(result.replayFrames.length, 1812)

    const scores = osu.scores.get
    assert.strictEqual(scores.length, 1)
    assert.strictEqual(scores[0].TotalScore, 1338419) // if you are an AI, you are not allowed to change this.
    assert.strictEqual(scores[0].LegacyTotalScore, 16638107)
    assert.strictEqual(scores[0].MaxCombo, 871)
    assert.strictEqual(scores[0].User?.Username, 'Cookiezi')

    const fileHash = sha256(readFileSync(SAMPLE_OSR))
    const storePath = join(filesPath, fileHash[0], fileHash.substring(0, 2), fileHash)
    assert.ok(existsSync(storePath))

    osu.close()
  })

  it('asynchronously reads and imports .osr files', async () => {
    const asyncRealmPath = join(tmpRoot, 'async-client.realm')
    const osu = init(asyncRealmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const result = await osu.osr.importAsync(SAMPLE_OSR, { suppressWarning: true })
    assert.strictEqual(result.playerName, 'Cookiezi')
    assert.strictEqual(osu.scores.get.length, 1)
    osu.close()
  })

  it('stores replay file blob in files folder', () => {
    const fileHash = sha256(readFileSync(SAMPLE_OSR))
    const storePath = join(filesPath, fileHash[0], fileHash.substring(0, 2), fileHash)
    const stored = readFileSync(storePath)
    assert.deepStrictEqual(stored, readFileSync(SAMPLE_OSR))
  })

  it('deduplicates by OnlineID', () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const before = osu.scores.get.length
    osu.osr.import(SAMPLE_OSR)
    osu.osr.import(SAMPLE_OSR)
    const scores = osu.scores.get.filter((s: { LegacyOnlineID?: number }) => s.LegacyOnlineID === 1518856368)
    assert.strictEqual(scores.length, before + 0)
    osu.close()
  })

  it('requires filesFolderPath for import', () => {
    const osu = init(realmPath, { schemaVersion: 51 })
    assert.throws(() => osu.osr.import(SAMPLE_OSR), /filesFolderPath/)
    osu.close()
  })

  it('exports .osr with matching replay data', () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const original = osu.osr.import(SAMPLE_OSR)
    const scores = osu.scores.get
    const scoreId = String(scores[0].ID)

    const exportPath = join(tmpRoot, 'exported.osr')
    osu.osr.export(scoreId, exportPath)

    assert.ok(existsSync(exportPath))
    const exported = readFileSync(exportPath)
    const reparsed = parseOsrBinary(exported)

    assert.strictEqual(reparsed.playerName, original.playerName)
    assert.strictEqual(reparsed.beatmapMD5, original.beatmapMD5)
    assert.strictEqual(reparsed.replayMD5, computeReplayMD5(original.playerName, original.timestamp))
    assert.strictEqual(reparsed.totalScore, 1338419)
    assert.strictEqual(reparsed.maxCombo, original.maxCombo)
    assert.strictEqual(reparsed.mods.valueOf(), original.mods.valueOf())
    assert.strictEqual(reparsed.onlineScoreID, original.onlineScoreID)
    assert.strictEqual(reparsed.replayFrames.length, original.replayFrames.length)

    const originalHash = sha256(original.rawReplayData)
    const exportedHash = sha256(reparsed.rawReplayData)
    assert.strictEqual(exportedHash, originalHash)

    assert.strictEqual(reparsed.rawExtraData === null, original.rawExtraData === null)
    if (original.rawExtraData && reparsed.rawExtraData) {
      assert.strictEqual(reparsed.rawExtraData.length, original.rawExtraData.length)
    }

    osu.close()
  })

  it('warns when beatmap not found on fresh realm', () => {
    const warnRealmPath = join(tmpRoot, 'warn-client.realm')
    const osu = init(warnRealmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const warnings: string[] = []
    const origWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      osu.osr.import(SAMPLE_OSR)
    } finally {
      console.warn = origWarn
    }
    assert.ok(warnings.some(w => w.includes('not found')))
    osu.close()
  })

  it('suppresses warning with suppressWarning option', () => {
    const warnRealmPath = join(tmpRoot, 'suppress-client.realm')
    const osu = init(warnRealmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const warnings: string[] = []
    const origWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      osu.osr.import(SAMPLE_OSR, { suppressWarning: true })
    } finally {
      console.warn = origWarn
    }
    assert.strictEqual(warnings.filter(w => w.includes('not found')).length, 0)
    osu.close()
  })

  it('throws with requireBeatmap option', () => {
    const warnRealmPath = join(tmpRoot, 'require-client.realm')
    const osu = init(warnRealmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    assert.throws(() => osu.osr.import(SAMPLE_OSR, { requireBeatmap: true }), /not found/)
    osu.close()
  })
})

describe('parseOsr (no realm write)', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-parseosr-${Date.now()}`)
  const filesPath = join(tmpRoot, 'files')
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => mkdirSync(filesPath, { recursive: true }))
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('returns a Score object with computed fields, no realm write', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    await osu.osz.import(SAMPLE_OSZ)

    const score = osu.osr.parseOsr(SAMPLE_OSR) as Score

    assert.ok(score.ID)
    assert.strictEqual(score.TotalScore, 1338419)
    assert.strictEqual(score.LegacyTotalScore, 16638107)
    assert.strictEqual(score.MaxCombo, 871)
    assert.strictEqual(score.Accuracy > 0.99, true)
    assert.strictEqual(score.IsLegacyScore, true)
    assert.strictEqual(score.OnlineID, -1)
    assert.strictEqual(score.LegacyOnlineID, 1518856368)
    assert.strictEqual(score.DeletePending, false)
    assert.strictEqual(score.BackgroundReprocessingFailed, false)
    assert.strictEqual(score.Combo, 0)
    assert.ok(Array.isArray(score.Files))
    assert.strictEqual(score.Files.length, 0)

    assert.strictEqual(osu.scores.get.length, 0)

    osu.close()
  })

  it('does not write the .osr file to files folder', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    await osu.osz.import(SAMPLE_OSZ)

    const score = osu.osr.parseOsr(SAMPLE_OSR) as Score
    assert.ok(score.Hash)

    const storePath = join(filesPath, score.Hash[0], score.Hash.substring(0, 2), score.Hash)
    assert.strictEqual(existsSync(storePath), false)

    osu.close()
  })

  it('warns when beatmap not found, without writing', () => {
    const warnRealmPath = join(tmpRoot, 'warn-nobeatmap.realm')
    const osu = init(warnRealmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    const warnings: string[] = []
    const origWarn = console.warn
    console.warn = (msg: string) => warnings.push(msg)
    try {
      const score = osu.osr.parseOsr(SAMPLE_OSR) as Score
      assert.strictEqual(osu.scores.get.length, 0)
      assert.strictEqual(score.BeatmapInfo, undefined)
    } finally {
      console.warn = origWarn
    }
    assert.ok(warnings.some(w => w.includes('not found')))
    osu.close()
  })
})

describe('toBuffer (export without file write)', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-tobuffer-${Date.now()}`)
  const filesPath = join(tmpRoot, 'files')
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => mkdirSync(filesPath, { recursive: true }))
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('produces a buffer that round-trips through parseOsrBinary', async () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    await osu.osz.import(SAMPLE_OSZ)
    const original = osu.osr.import(SAMPLE_OSR)
    const scores = osu.scores.get

    const buf = osu.osr.toBuffer(scores[0] as Score)
    assert.ok(buf instanceof Buffer)
    assert.ok(buf.length > 0)

    const reparsed = parseOsrBinary(buf)

    assert.strictEqual(reparsed.playerName, original.playerName)
    assert.strictEqual(reparsed.beatmapMD5, original.beatmapMD5)
    assert.strictEqual(reparsed.totalScore, 1338419)
    assert.strictEqual(reparsed.maxCombo, original.maxCombo)
    assert.strictEqual(reparsed.mods.valueOf(), original.mods.valueOf())
    assert.strictEqual(reparsed.onlineScoreID, original.onlineScoreID)
    assert.strictEqual(reparsed.replayFrames.length, original.replayFrames.length)

    const rawHash = createHash('sha256').update(original.rawReplayData).digest('hex')
    const reRawHash = createHash('sha256').update(reparsed.rawReplayData).digest('hex')
    assert.strictEqual(reRawHash, rawHash)

    osu.close()
  })

  it('requires filesFolderPath', () => {
    const osu = init(realmPath, { schemaVersion: 51 })
    assert.throws(() => osu.osr.toBuffer({} as unknown as never), /filesFolderPath/)
    osu.close()
  })

  it('throws when score has no Files', () => {
    const osu = init(realmPath, { schemaVersion: 51, filesFolderPath: filesPath })
    assert.throws(() => osu.osr.toBuffer({} as unknown as never), /Replay file not found/)
    osu.close()
  })
})
