import { describe, it } from 'node:test'
import assert from 'node:assert'
import { rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init } from '../src/index.js'

describe('Ruleset module', () => {
  it('returns empty when nothing is registered', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      assert.strictEqual(osu.rulesets.get.length, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('creates and queries a ruleset', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({
        ShortName: 'osu',
        OnlineID: 0,
        Name: 'osu!',
        InstantiationInfo: '',
        Available: true,
        LastAppliedDifficultyVersion: 1,
      })

      assert.strictEqual(osu.rulesets.get.length, 1)
      assert.strictEqual(osu.rulesets.get[0].ShortName, 'osu')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('queries by ShortName', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({ ShortName: 'taiko', OnlineID: 1, Name: 'osu!taiko', InstantiationInfo: '', Available: true, LastAppliedDifficultyVersion: 1 })
      assert.strictEqual(osu.rulesets.get.byShortNameEquals('taiko').length, 1)
      assert.strictEqual(osu.rulesets.get.byShortNameEquals('osu').length, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('queries by OnlineID', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({ ShortName: 'fruits', OnlineID: 2, Name: 'osu!catch', InstantiationInfo: '', Available: true, LastAppliedDifficultyVersion: 1 })
      assert.strictEqual(osu.rulesets.get.byOnlineIdExact(2).length, 1)
      assert.strictEqual(osu.rulesets.get.byOnlineIdExact(0).length, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('queries by Available', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({ ShortName: 'broken', OnlineID: -1, Name: 'Broken', InstantiationInfo: '', Available: false, LastAppliedDifficultyVersion: 0 })
      assert.strictEqual(osu.rulesets.get.byAvailable(false).length, 1)
      assert.strictEqual(osu.rulesets.get.byAvailable(true).length, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('updates a ruleset', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({ ShortName: 'mania', OnlineID: 3, Name: 'osu!mania', InstantiationInfo: '', Available: true, LastAppliedDifficultyVersion: 1 })
      osu.rulesets.write.update('mania', { Name: 'osu!mania (updated)' })
      assert.strictEqual(osu.rulesets.get.byShortNameEquals('mania')[0].Name, 'osu!mania (updated)')
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('deletes a ruleset', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.rulesets.write.create({ ShortName: 'temp', OnlineID: 99, Name: 'Temp', InstantiationInfo: '', Available: true, LastAppliedDifficultyVersion: 1 })
      assert.strictEqual(osu.rulesets.get.length, 1)
      osu.rulesets.write.delete('temp')
      assert.strictEqual(osu.rulesets.get.length, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })
})
