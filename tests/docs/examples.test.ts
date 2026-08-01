import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')

describe('documentation examples', () => {
  it('uses the public Node import path', () => {
    assert.ok(home.includes("from 'osu-files'"))
    assert.ok(!home.includes("from 'osu-files/browser'"))
  })
  it('contains a runnable example', () => {
    assert.ok(home.includes('execution="interactive"'))
  })
})
