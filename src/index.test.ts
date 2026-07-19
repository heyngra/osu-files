import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Schema } from './index.js'

describe('Schema', () => {
  it('exports all 15 realm schemas', () => {
    assert.strictEqual(Schema.length, 15)
  })

  it('includes Beatmap schema', () => {
    assert.ok(Schema.find(s => s.name === 'Beatmap'))
  })
})
