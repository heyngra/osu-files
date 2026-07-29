import { describe, it } from 'node:test'
import assert from 'node:assert'
import { CURRENT_SCHEMA_VERSION, Schema } from '../src/index.js'

describe('Schema', () => {
  it('exports all 15 realm schemas', () => {
    assert.strictEqual(Schema.length, 15)
  })

  it('includes representative schemas', () => {
    for (const name of ['Beatmap', 'BeatmapSet', 'File']) {
      assert.ok(Schema.find(s => s.name === name))
    }
  })

  it('targets schema version 51 fields', () => {
    assert.strictEqual(CURRENT_SCHEMA_VERSION, 51)
    const metadata = Schema.find(s => s.name === 'BeatmapMetadata')!
    const score = Schema.find(s => s.name === 'Score')!
    assert.ok('UserTags' in metadata.properties)
    assert.ok('Pauses' in score.properties)
  })
})
