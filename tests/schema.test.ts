import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Schema } from '../src/index.js'

describe('Schema', () => {
  it('exports all 15 realm schemas', () => {
    assert.strictEqual(Schema.length, 15)
  })

  it('includes Beatmap', () => {
    assert.ok(Schema.find(s => s.name === 'Beatmap'))
  })

  it('includes BeatmapSet', () => {
    assert.ok(Schema.find(s => s.name === 'BeatmapSet'))
  })

  it('includes File', () => {
    assert.ok(Schema.find(s => s.name === 'File'))
  })
})
