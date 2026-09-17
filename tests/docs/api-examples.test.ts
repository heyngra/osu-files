import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type ManifestItem = {
  publicSymbol: string
  memberPath?: string
  kind: string
  exampleIds: string[]
  documentationPage: string
}

type ApiExample = {
  id: string
  target: string
  code: string
  execution: string
  output?: string
  documentationPage: string
  placement: { kind: 'declaration' } | { kind: 'member'; anchor: string }
}

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8')) as ManifestItem[]
const examples = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-examples.json'), 'utf8')) as ApiExample[]

describe('generated API reference examples', () => {
  it('covers every documented declaration and public member', () => {
    const byId = new Map(examples.map(example => [example.id, example]))
    assert.equal(byId.size, examples.length)
    for (const item of manifest) {
      if (!['function', 'class', 'interface', 'type', 'enum', 'constructor', 'method', 'accessor'].includes(item.kind)) continue
      assert.ok(item.exampleIds.length > 0, item.memberPath ?? item.publicSymbol)
      for (const id of item.exampleIds) assert.equal(byId.get(id)?.target, item.memberPath ?? item.publicSymbol)
    }
    assert.equal(manifest.some(item => item.memberPath?.match(/\._|\[iterator\]|\[dispose\]/)), false)
  })

  it('keeps runnable output verified and examples compact', () => {
    assert.ok(examples.length > 400)
    assert.ok(examples.some(example => example.target === 'Storyboard.getLayer'))
    assert.ok(examples.some(example => example.target === 'parseOsu'))
    assert.ok(examples.some(example => example.execution === 'static-node-only'))
    for (const example of examples) {
      assert.ok(example.code.trim())
      assert.doesNotMatch(example.code, /\.\.\./)
      if (example.execution === 'static-node-only') assert.equal(example.output, undefined, example.id)
      else assert.equal(typeof example.output, 'string', example.id)
    }
  })

  it('renders a TypeScript preview and runner for every API page with examples', () => {
    const pages = new Set(examples.map(example => example.documentationPage.split('#')[0]))
    for (const page of pages) {
      const file = resolve(root, 'docs', `${page.replace(/^\//, '')}.md`)
      assert.ok(existsSync(file), file)
      const content = readFileSync(file, 'utf8')
      assert.match(content, /^---\noutline:\n  level: \[2, 3\]\n---\n/)
      assert.match(content, /<PromotableExample/)
      assert.match(content, /```ts\n[\s\S]*?\n```/)
    }
  })

  it('keeps member examples inside their original API-member section', () => {
    const pages = new Set<string>()
    for (const example of examples) {
      const page = example.documentationPage.split('#')[0]
      pages.add(page)
      const file = resolve(root, 'docs', `${page.replace(/^\//, '')}.md`)
      const content = readFileSync(file, 'utf8')
      assert.doesNotMatch(content, /^## Examples$/m, page)

      if (example.placement.kind !== 'member') continue
      const anchor = `<a id="${example.placement.anchor}"></a>`
      const anchorIndex = content.indexOf(anchor)
      const marker = `<!-- api-example:${example.id} -->`
      const markerIndex = content.indexOf(marker)
      assert.notEqual(anchorIndex, -1, `${example.id} is missing ${anchor}`)
      assert.notEqual(markerIndex, -1, `${example.id} is missing its generated marker`)
      assert.ok(markerIndex > anchorIndex, `${example.id} appears before its API member`)

      const nextAnchor = content.indexOf('<a id="', anchorIndex + anchor.length)
      assert.ok(nextAnchor < 0 || markerIndex < nextAnchor, `${example.id} escaped its API member`)
      assert.equal(content.includes(`### ${example.target}`), false, `${example.id} created a duplicate member heading`)
    }

    for (const page of pages) {
      const file = resolve(root, 'docs', `${page.replace(/^\//, '')}.md`)
      assert.doesNotMatch(readFileSync(file, 'utf8'), /^## Examples$/m, page)
    }
  })

  it('uses method-specific FileStore snippets', () => {
    const begin = examples.find(example => example.target === 'FileStore.beginTransaction')
    assert.ok(begin)
    assert.match(begin.code, /store\.beginTransaction\(\)/)
    assert.match(begin.code, /transaction\.rollback\(\)/)
    assert.doesNotMatch(begin.code, /recoveryBasePath\(\)/)

    const constructor = examples.find(example => example.target === 'FileStore.constructor')
    assert.ok(constructor)
    assert.match(constructor.code, /new FileStore\('\.\/files'\)/)
  })
})
