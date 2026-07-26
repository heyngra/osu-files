import { describe, it } from 'node:test'
import assert from 'node:assert'
import { rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init } from '../src/index.js'

describe('RulesetSetting module', () => {
  it('getSettings returns empty map for empty db', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const s = osu.rulesetSettings.getSettings('osu')
      assert.deepStrictEqual(s, {})
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('setSetting creates a new setting', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesetSettings.setSetting('osu', 'BeatmapListing', '0')
      const s = osu.rulesetSettings.getSettings('osu')
      assert.deepStrictEqual(s, { BeatmapListing: '0' })
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('setSetting updates an existing setting', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesetSettings.setSetting('osu', 'BeatmapListing', '0')
      osu.rulesetSettings.setSetting('osu', 'BeatmapListing', '1')
      const s = osu.rulesetSettings.getSettings('osu')
      assert.strictEqual(s.BeatmapListing, '1')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('setSetting with variant isolates settings', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesetSettings.setSetting('mania', 'ScrollSpeed', '10', 4)
      osu.rulesetSettings.setSetting('mania', 'ScrollSpeed', '15', 7)
      const s4 = osu.rulesetSettings.getSettings('mania', 4)
      const s7 = osu.rulesetSettings.getSettings('mania', 7)
      assert.strictEqual(s4.ScrollSpeed, '10')
      assert.strictEqual(s7.ScrollSpeed, '15')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('removeSetting removes existing setting', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesetSettings.setSetting('osu', 'BeatmapListing', '0')
      osu.rulesetSettings.removeSetting('osu', 'BeatmapListing')
      const s = osu.rulesetSettings.getSettings('osu')
      assert.deepStrictEqual(s, {})
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('removeSetting does nothing for non-existent setting', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesetSettings.removeSetting('osu', 'NonExistent')
      const s = osu.rulesetSettings.getSettings('osu')
      assert.deepStrictEqual(s, {})
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('query returns settings for ruleset', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      for (const [k, v] of Object.entries({ KeyA: 'valA' }))
        osu.rulesetSettings.setSetting('taiko', k, v)
      assert.strictEqual(osu.rulesetSettings.get.byRulesetNameEquals('taiko').length, 1)
      assert.strictEqual(osu.rulesetSettings.get.byRulesetNameEquals('taiko')[0].Key, 'KeyA')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })
})
