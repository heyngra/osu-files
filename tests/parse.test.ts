import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { parseOsu } from '../src/beatmap/parse.js'
import { serializeOsu } from '../src/beatmap/serialize.js'
import { readZipEntries } from '../src/osz/import.js'
import { SAMPLE_OSZ } from './helpers.js'

async function osuContent(namePattern: string): Promise<string> {
  const entries = await readZipEntries(SAMPLE_OSZ)
  const match = entries.find(e => e.filename.includes(namePattern))
  if (!match) throw new Error(`No entry matching "${namePattern}"`)
  return match.buffer.toString('utf-8')
}

describe('Parse .osu', () => {
  let easy: string
  let hard: string

  before(async () => {
    easy = await osuContent('[Easy]')
    hard = await osuContent('[Hard]')
  })

  describe('header and metadata', () => {
    it('parses file format version', () => {
      const bm = parseOsu(easy)
      assert.strictEqual(bm.fileFormat, 14)
    })

    it('parses general section', () => {
      const bm = parseOsu(easy)
      assert.strictEqual(bm.general.mode, 0)
      assert.strictEqual(bm.general.audioFilename, 'please.mp3')
    })

    it('parses metadata', () => {
      const bm = parseOsu(easy)
      assert.strictEqual(bm.metadata.title, 'Make A Move')
      assert.strictEqual(bm.metadata.artist, 'Icon For Hire')
      assert.strictEqual(bm.metadata.creator, 'wajinshu')
      assert.strictEqual(bm.metadata.version, 'Easy')
      assert.strictEqual(bm.metadata.beatmapID, 1083903)
      assert.strictEqual(bm.metadata.beatmapSetID, 506483)
      assert.ok(bm.metadata.tags.includes('Shmiklak'))
    })
  })

  describe('difficulty', () => {
    it('parses Easy difficulty settings', () => {
      const bm = parseOsu(easy)
      assert.strictEqual(bm.difficulty.hpDrainRate, 3)
      assert.strictEqual(bm.difficulty.circleSize, 2.7)
      assert.strictEqual(bm.difficulty.overallDifficulty, 3)
      assert.strictEqual(bm.difficulty.approachRate, 3)
      assert.strictEqual(bm.difficulty.sliderMultiplier, 1)
      assert.strictEqual(bm.difficulty.sliderTickRate, 1)
    })

    it('parses Hard difficulty settings', () => {
      const bm = parseOsu(hard)
      assert.strictEqual(bm.difficulty.hpDrainRate, 5)
    })
  })

  describe('timing points', () => {
    it('parses all timing points', () => {
      const bm = parseOsu(easy)
      assert.ok(bm.timingPoints.length > 40)
    })

    it('parses first (uninherited) timing point', () => {
      const bm = parseOsu(easy)
      const tp = bm.timingPoints[0]
      assert.strictEqual(tp.time, 1154)
      assert.strictEqual(tp.beatLength, 361.44578313253)
      assert.strictEqual(tp.meter, 4)
      assert.strictEqual(tp.sampleSet, 2)
      assert.ok(tp.uninherited)
    })

    it('parses inherited (green) timing point', () => {
      const bm = parseOsu(easy)
      assert.strictEqual(bm.timingPoints[1].uninherited, false)
    })
  })

  describe('hit objects', () => {
    it('parses all hit objects', () => {
      const bm = parseOsu(easy)
      assert.ok(bm.hitObjects.length > 0)
    })

    it('parses first slider correctly', () => {
      const bm = parseOsu(easy)
      const first = bm.hitObjects[0]
      assert.strictEqual(first.objectType, 'slider')
      assert.strictEqual(first.x, 121)
      assert.strictEqual(first.y, 211)
      assert.strictEqual(first.time, 12720)
      if (first.objectType === 'slider') {
        assert.strictEqual(first.extras.curveType, 'B')
        assert.ok(first.extras.curvePoints.length > 0)
        assert.strictEqual(first.extras.repeats, 1)
      }
    })

    it('preserves fractional Lazer hitobject values', () => {
      const beatmap = parseOsu(`osu file format v128

[HitObjects]
123.5,45.25,1000.5,1,0,0:0:0:0:
300.5,200.25,1500.75,2,0,B|400.5:300.25,1,100
`)

      assert.strictEqual(beatmap.hitObjects[0].x, 123.5)
      assert.strictEqual(beatmap.hitObjects[0].y, 45.25)
      assert.strictEqual(beatmap.hitObjects[0].time, 1000.5)
      const slider = beatmap.hitObjects[1]
      assert.strictEqual(slider.objectType, 'slider')
      if (slider.objectType === 'slider')
        assert.deepStrictEqual(slider.extras.curvePoints[0], { x: 400.5, y: 300.25 })
    })

    it('round-trips a slider tail when only non-leading fields are set', () => {
      const beatmap = parseOsu(`osu file format v14

[HitObjects]
256,192,1000,2,0,B|300:200,1,100,,,0:2:3:70:
`)
      const slider = beatmap.hitObjects[0]
      assert.strictEqual(slider.objectType, 'slider')
      if (slider.objectType === 'slider') {
        assert.strictEqual(slider.extras.additionSet, 2)
        assert.strictEqual(slider.extras.customIndex, 3)
        assert.strictEqual(slider.extras.sampleVolume, 70)
        const roundTripped = parseOsu(serializeOsu(beatmap)).hitObjects[0]
        assert.strictEqual(roundTripped.objectType, 'slider')
        if (roundTripped.objectType === 'slider') {
          assert.strictEqual(roundTripped.extras.additionSet, 2)
          assert.strictEqual(roundTripped.extras.customIndex, 3)
          assert.strictEqual(roundTripped.extras.sampleVolume, 70)
        }
      }
    })
  })

  describe('events', () => {
    it('parses background event', () => {
      const bm = parseOsu(easy)
      const bg = bm.events.find(e => e.type === 'background')
      assert.ok(bg)
      if (bg?.type === 'background') {
        assert.strictEqual(bg.filename, 'V6tKIOwgj0s.jpg')
      }
    })

    it('parses break periods', () => {
      const bm = parseOsu(easy)
      assert.ok(bm.events.filter(e => e.type === 'break').length > 0)
    })
  })

  describe('colours', () => {
    it('parses combo colours', () => {
      const bm = parseOsu(easy)
      assert.ok(bm.colours.length > 0)
      const c1 = bm.colours.find(c => c.name === 'Combo1')
      assert.ok(c1)
      if (c1) assert.deepStrictEqual([c1.r, c1.g, c1.b], [87, 87, 87])
    })
  })
})
