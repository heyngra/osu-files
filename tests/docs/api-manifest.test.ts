import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8')) as Array<{ publicSymbol: string; importPath: string; sourceFile: string; documentationPage: string }>

describe('generated API manifest', () => {
  it('contains the complete Node public surface', () => {
    assert.ok(manifest.length > 1000)
    assert.ok(manifest.every(item => item.importPath === 'osu-files'))
    assert.ok(manifest.some(item => item.publicSymbol === 'parseOsu'))
    assert.ok(manifest.some(item => item.publicSymbol === 'OsuFilesAPI'))
  })
  it('points at existing source files', () => {
    for (const item of manifest) assert.ok(existsSync(resolve(root, item.sourceFile)), item.sourceFile)
  })
})
