import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8')) as Array<{ documentationPage: string; visibility: string }>
const sidebar = JSON.parse(readFileSync(resolve(root, 'docs/api/_generated-sidebar.json'), 'utf8'))
const links = JSON.stringify(sidebar)

describe('generated API sidebar', () => {
  it('exposes every top-level declaration', () => {
    const topLevel = manifest.filter(item => item.visibility === 'stable' && !item.documentationPage.includes('#'))
    for (const item of topLevel) assert.ok(links.includes(item.documentationPage), item.documentationPage)
  })
})
