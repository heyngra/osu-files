import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const home = readFileSync(resolve(root, 'docs/index.md'), 'utf8')
const beatmapsPage = readFileSync(resolve(root, 'docs/api/facades/Beatmaps.md'), 'utf8')
const facadeExamples = JSON.parse(readFileSync(resolve(root, 'docs/.generated/facade-examples.json'), 'utf8')) as Array<{
  facade: string
  method: string
  code: string
  execution: string
  fixture: string
  output?: string
}>

describe('documentation examples', () => {
  it('uses the public Node import path', () => {
    assert.ok(home.includes("from 'osu-files'"))
    assert.ok(!home.includes("from 'osu-files/browser'"))
  })
  it('contains a runnable example', () => {
    assert.ok(home.includes('execution="interactive"'))
    assert.ok(home.includes('<PromotableExample'))
    assert.match(home, /<PromotableExample[\s\S]*```ts[\s\S]*<\/PromotableExample>/)
    assert.ok(!home.includes('.toArray()'))
  })
  it('documents every facade method with a verified output', () => {
    assert.equal(new Set(facadeExamples.map(example => example.facade)).size, 11)
    assert.ok(facadeExamples.length > 200)
    assert.ok(facadeExamples.every(example => typeof example.output === 'string'))
    assert.ok(facadeExamples.every(example => example.execution === 'interactive-fixture'))
    assert.ok(facadeExamples.every(example => example.fixture === 'realm-docs'))
  })
  it('uses direct array operations in facade examples', () => {
    const routineExamples = facadeExamples.filter(example => example.method !== 'toArray')
    assert.ok(routineExamples.every(example => !example.code.includes('.toArray()')))
  })
  it('formats generated chains and projections as readable TypeScript', () => {
    const sorted = facadeExamples.find(example => example.method === 'sortedBy')
    assert.ok(sorted)
    assert.match(sorted.code, /\n  \.sortedBy\(/)
    assert.match(sorted.code, /\.map\(item => \(\{\n    title:/)
  })
  it('keeps generated previews as native TypeScript fences', () => {
    assert.ok(beatmapsPage.includes('<PromotableExample'))
    assert.match(beatmapsPage, /:output='/)
    assert.match(beatmapsPage, /<PromotableExample[\s\S]*```ts[\s\S]*<\/PromotableExample>/)
    assert.ok(!beatmapsPage.includes('<ExampleRunner'))
  })
})
