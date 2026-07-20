import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { parseOsu } from '../src/beatmap/parse.js'
import { serializeOsu } from '../src/beatmap/serialize.js'
import { readZipEntries } from '../src/osz/import.js'
import { SAMPLE_OSZ } from './helpers.js'

describe('Serialize .osu', () => {
  let easy: string

  before(async () => {
    const entries = await readZipEntries(SAMPLE_OSZ)
    const match = entries.find(e => e.filename.includes('[Easy]'))
    if (!match) throw new Error('No [Easy] entry')
    easy = match.buffer.toString('utf-8')
  })

  it('round-trips metadata', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(re.fileFormat, orig.fileFormat)
    assert.strictEqual(re.metadata.title, orig.metadata.title)
    assert.strictEqual(re.metadata.artist, orig.metadata.artist)
    assert.strictEqual(re.metadata.creator, orig.metadata.creator)
    assert.strictEqual(re.metadata.version, orig.metadata.version)
  })

  it('round-trips difficulty', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(re.difficulty.hpDrainRate, orig.difficulty.hpDrainRate)
    assert.strictEqual(re.difficulty.circleSize, orig.difficulty.circleSize)
    assert.strictEqual(re.difficulty.overallDifficulty, orig.difficulty.overallDifficulty)
    assert.strictEqual(re.difficulty.approachRate, orig.difficulty.approachRate)
    assert.strictEqual(re.difficulty.sliderMultiplier, orig.difficulty.sliderMultiplier)
    assert.strictEqual(re.difficulty.sliderTickRate, orig.difficulty.sliderTickRate)
  })

  it('round-trips timing points', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(re.timingPoints.length, orig.timingPoints.length)
    assert.strictEqual(re.timingPoints[0].time, orig.timingPoints[0].time)
    assert.strictEqual(re.timingPoints[0].beatLength, orig.timingPoints[0].beatLength)
    assert.strictEqual(re.timingPoints[0].uninherited, orig.timingPoints[0].uninherited)
    assert.strictEqual(re.timingPoints[1].uninherited, orig.timingPoints[1].uninherited)
  })

  it('round-trips hit objects', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(re.hitObjects.length, orig.hitObjects.length)
    const os = re.hitObjects[0]
    const oo = orig.hitObjects[0]
    assert.strictEqual(os.objectType, oo.objectType)
    assert.strictEqual(os.x, oo.x)
    assert.strictEqual(os.y, oo.y)
    assert.strictEqual(os.time, oo.time)
  })

  it('round-trips slider edge data', () => {
    const orig = parseOsu(easy)
    const slider = orig.hitObjects.find(h => h.objectType === 'slider')
    if (slider?.objectType === 'slider') {
      const re = parseOsu(serializeOsu(orig))
      const rs = re.hitObjects.find(h => h.objectType === 'slider')!
      if (rs.objectType === 'slider') {
        assert.strictEqual(rs.extras.edgeHitsounds.length, slider.extras.edgeHitsounds.length)
        assert.strictEqual(rs.extras.edgeAdditions.length, slider.extras.edgeAdditions.length)
      }
    }
  })

  it('round-trips events', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(
      re.events.filter(e => e.type === 'background').length,
      orig.events.filter(e => e.type === 'background').length,
    )
    assert.strictEqual(
      re.events.filter(e => e.type === 'break').length,
      orig.events.filter(e => e.type === 'break').length,
    )
  })

  it('round-trips colours', () => {
    const orig = parseOsu(easy)
    const re = parseOsu(serializeOsu(orig))
    assert.strictEqual(re.colours.length, orig.colours.length)
    if (re.colours.length > 0 && orig.colours.length > 0) {
      assert.strictEqual(re.colours[0].name, orig.colours[0].name)
      assert.strictEqual(re.colours[0].r, orig.colours[0].r)
    }
  })
})
