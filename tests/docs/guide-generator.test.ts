import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseGuideSource, readGuides, renderGuidePages } from '../../tools/docs/guide-generator.js'

const root = resolve(import.meta.dirname, '../..')
const manifest = JSON.parse(readFileSync(resolve(root, 'docs/.generated/api-manifest.json'), 'utf8'))

describe('guide generator', () => {
  it('extracts prose and exact code regions from an entrypoint', () => {
    const source = `/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'replays',
  groupTitle: 'Demo',
  groupOrder: 1,
  groupSummary: 'Small examples.',
  title: 'Read a value',
  order: 1,
  summary: 'Reads one value.',
  api: ['init'],
}
/**
 * @docs
 * Read the value once.
 */
/* @docs:start read */
const value = '/* @docs:end fake */'
/* @docs:end read */`
    const guide = parseGuideSource(resolve(root, 'examples/demo/index.js'), source)
    assert.equal(guide.blocks[0].kind, 'markdown')
    assert.deepEqual(guide.blocks[1], {
      kind: 'code',
      name: 'read',
      content: "const value = '/* @docs:end fake */'",
      startLine: 17,
      endLine: 17,
    })
  })

  it('rejects unmatched regions', () => {
    const source = `/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */\nconst guide = { group: 'replays', title: 'Demo', order: 1, summary: 'Demo.' }\n/* @docs:start broken */\nconst value = 1`
    assert.throws(() => parseGuideSource(resolve(root, 'examples/demo/index.js'), source), /no matching end/)
  })

  it('rejects metadata properties outside the typed schema', () => {
    const source = `/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */\nconst guide = { group: 'replays', title: 'Demo', order: 1, summary: 'Demo.', typo: true }\n/** @docs Text. */`
    assert.throws(() => parseGuideSource(resolve(root, 'examples/demo/index.js'), source), /guide\.typo/)
  })

  it('requires the TypeScript metadata annotation', () => {
    const source = `const guide = { group: 'replays', title: 'Demo', order: 1, summary: 'Demo.' }\n/** @docs Text. */`
    assert.throws(() => parseGuideSource(resolve(root, 'examples/demo/index.js'), source), /@satisfies GuideMetadata/)
  })

  it('reproduces the checked-in guide pages', () => {
    const pages = renderGuidePages(readGuides(resolve(root, 'examples')), manifest)
    for (const [name, expected] of pages) {
      assert.equal(readFileSync(resolve(root, 'docs/guide/examples', name), 'utf8'), expected, `${name} is stale`)
    }
  })

  it('uses the runnable replay query in the generated guide', () => {
    const pages = renderGuidePages(readGuides(resolve(root, 'examples')), manifest)
    assert.match(pages.get('replays.md')!, /sortedBy\('Date'\)\.limit\(10\)/)
    assert.doesNotMatch(pages.get('replays.md')!, /\.slice\(0, 10\)/)
  })

  it('links every preview to its exact source lines', () => {
    const pages = renderGuidePages(readGuides(resolve(root, 'examples')), manifest)
    const replays = pages.get('replays.md')!
    assert.match(replays, /<GuideSource source="examples\/export-osr\/index\.js" :start-line="\d+" :end-line="\d+">/)
    assert.equal((replays.match(/<GuideSource source=/g) ?? []).length, (replays.match(/```js/g) ?? []).length)
  })

  it('marks guide previews for contextual Twoslash processing', () => {
    const pages = renderGuidePages(readGuides(resolve(root, 'examples')), manifest)
    const replays = pages.get('replays.md')!
    assert.match(replays, /```js twoslash\n\/\/ @guide-source examples\/import-osr\/index\.js#L35-L44\nconst result = initialized\.osr\.import\(replayPath\)/)
  })
})
