import { describe, it } from 'node:test'
import assert from 'node:assert'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Realm from 'realm'
import { CURRENT_SCHEMA_VERSION, Schema, init } from '../src/index.js'
import { writeLegacyCollectionDb } from '../src/collections/legacy.js'
import { sha256 } from '../src/util.js'

describe('Realm migrations', () => {
  it('upgrades an old Realm to v51 without changing the current score version', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-migration-'))
    const path = join(root, 'client.realm')
    const oldRealm = new Realm({ path, schema: Schema as Realm.ObjectSchema[], schemaVersion: 40 })

    oldRealm.write(() => {
      const ruleset = oldRealm.create('Ruleset', {
        ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: '', Available: true,
        LastAppliedDifficultyVersion: 0,
      })
      const beatmap = oldRealm.create('Beatmap', {
        ID: new Realm.BSON.UUID(), DifficultyName: 'Test', Ruleset: ruleset, Difficulty: { DrainRate: 5, CircleSize: 5, OverallDifficulty: 5, ApproachRate: 5, SliderMultiplier: 1.4, SliderTickRate: 1 },
        Metadata: { Title: '', TitleUnicode: '', Artist: '', ArtistUnicode: '', Author: { OnlineID: 1, Username: '', CountryCode: 'Unknown' }, Source: '', Tags: '', PreviewTime: -1, AudioFile: '', BackgroundFile: '', UserTags: [] },
        Status: -3, OnlineID: -1, Length: 0, BPM: 0, Hash: '', StarRating: -1, MD5Hash: '', Hidden: false, BeatDivisor: 4,
        UserSettings: { Offset: 0 }, OnlineMD5Hash: '', EndTimeObjectCount: -1, TotalObjectCount: -1,
      })
      oldRealm.create('Score', {
        ID: new Realm.BSON.UUID(), BeatmapInfo: beatmap, Ruleset: ruleset, Files: [], Hash: '', DeletePending: false,
        TotalScore: 1000, MaxCombo: 100, Accuracy: 1, Date: new Date(), PP: null, OnlineID: -1,
        User: { OnlineID: 1, Username: 'test', CountryCode: 'Unknown' }, Mods: JSON.stringify([{ acronym: 'HD' }]),
        Statistics: '{}', Rank: 0, Combo: 100, MaximumStatistics: '{}', BeatmapHash: '', IsLegacyScore: true,
        ClientVersion: '', TotalScoreWithoutMods: 0, TotalScoreVersion: 30000002, LegacyTotalScore: 1000,
        BackgroundReprocessingFailed: false, LegacyOnlineID: -1, Pauses: [],
      })
      oldRealm.create('Score', {
        ID: new Realm.BSON.UUID(), BeatmapInfo: beatmap, Ruleset: ruleset, Files: [], Hash: '', DeletePending: false,
        TotalScore: 1120, MaxCombo: 100, Accuracy: 1, Date: new Date(), PP: null, OnlineID: -1,
        User: { OnlineID: 1, Username: 'test', CountryCode: 'Unknown' }, Mods: JSON.stringify([{ acronym: 'BL' }]),
        Statistics: '{}', Rank: 0, Combo: 100, MaximumStatistics: '{}', BeatmapHash: '', IsLegacyScore: true,
        ClientVersion: '', TotalScoreWithoutMods: 0, TotalScoreVersion: 30000002, LegacyTotalScore: 1120,
        BackgroundReprocessingFailed: false, LegacyOnlineID: -1, Pauses: [],
      })
    })
    oldRealm.close()

    const db = init(path, { filesFolderPath: join(root, 'files') })
    try {
      assert.strictEqual(db.migration?.toVersion, CURRENT_SCHEMA_VERSION)
      const scores = [...db.scores.get]
      assert.strictEqual(scores.length, 2)
      assert.strictEqual(scores.find(score => score.Mods?.includes('HD'))?.TotalScoreWithoutMods, 943)
      assert.strictEqual(scores.find(score => score.Mods?.includes('BL'))?.TotalScoreWithoutMods, 1000)
      assert.strictEqual(db.realm.isOpen, true)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not guess a score multiplier for malformed mod data', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-malformed-mods-'))
    const path = join(root, 'client.realm')
    const oldRealm = new Realm({ path, schema: Schema as Realm.ObjectSchema[], schemaVersion: 40 })
    oldRealm.write(() => {
      const ruleset = oldRealm.create('Ruleset', {
        ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: '', Available: true,
        LastAppliedDifficultyVersion: 0,
      })
      oldRealm.create('Score', {
        ID: new Realm.BSON.UUID(), BeatmapInfo: null, Ruleset: ruleset, Files: [], Hash: '', DeletePending: false,
        TotalScore: 1000, MaxCombo: 100, Accuracy: 1, Date: new Date(), PP: null, OnlineID: -1,
        User: { OnlineID: 1, Username: 'test', CountryCode: 'Unknown' }, Mods: '{bad json',
        Statistics: '{}', Rank: 0, Combo: 100, MaximumStatistics: '{}', BeatmapHash: '', IsLegacyScore: true,
        ClientVersion: '', TotalScoreWithoutMods: 0, TotalScoreVersion: 30000002, LegacyTotalScore: 1000,
        BackgroundReprocessingFailed: false, LegacyOnlineID: -1, Pauses: [],
      })
    })
    oldRealm.close()

    const db = init(path)
    try {
      assert.strictEqual(db.scores.get[0].TotalScoreWithoutMods, 0)
      assert.ok(db.migration?.events.some(event => event.version === 41 && event.level === 'warning'))
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects writes before touching the file store in read-only mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-readonly-'))
    const path = join(root, 'client.realm')
    const created = init(path, { filesFolderPath: join(root, 'files') })
    created.close()
    const db = init(path, { filesFolderPath: join(root, 'files'), readOnly: true })
    try {
      assert.throws(() => db.files.put(Buffer.from('data')), /read-only/)
      assert.throws(() => db.realm.write(() => {}), /read-only/)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refreshes cached queries after writes and rejects reads after close', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-query-'))
    const db = init(join(root, 'client.realm'))
    try {
      const available = db.rulesets.get.byAvailable(true)
      assert.strictEqual(available.length, 0)
      db.rulesets.write.create({
        ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: '', Available: true,
        LastAppliedDifficultyVersion: 0,
      })
      assert.strictEqual(available.length, 1)
      db.rulesets.write.update('osu', { Available: false })
      assert.strictEqual(available.length, 0)
      db.close()
      assert.throws(() => db.rulesets.get.byAvailable(true).length, /closed/i)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('refreshes cached queries after guarded and raw Realm writes', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-raw-query-'))
    const db = init(join(root, 'client.realm'))
    try {
      const available = db.rulesets.get.byAvailable(true)
      assert.strictEqual(available.length, 0)
      db.realm.write(realm => {
        realm.create('Ruleset', {
          ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: '', Available: true,
          LastAppliedDifficultyVersion: 0,
        })
      })
      assert.strictEqual(available.length, 1)
      db.realm.raw.write(() => db.realm.raw.create('Ruleset', {
        ShortName: 'taiko', OnlineID: 1, Name: 'osu!taiko', InstantiationInfo: '', Available: true,
        LastAppliedDifficultyVersion: 0,
      }))
      assert.strictEqual(available.length, 2)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects direct file promotion from a read-only store', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-readonly-store-'))
    const filesPath = join(root, 'files')
    const path = join(root, 'client.realm')
    const created = init(path, { filesFolderPath: filesPath })
    created.close()
    const db = init(path, { filesFolderPath: filesPath, readOnly: true })
    const content = Buffer.from('data')
    const hash = sha256(content)
    const temporary = db.files.store!.temporaryPath(hash)
    writeFileSync(temporary, content)
    try {
      assert.throws(() => db.files.store!.promote(temporary, hash), /read-only/)
    } finally {
      rmSync(temporary, { force: true })
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves newer score versions unchanged during a v51 upgrade', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-score-version-'))
    const path = join(root, 'client.realm')
     const oldRealm = new Realm({ path, schema: Schema as Realm.ObjectSchema[], schemaVersion: 40 })
    oldRealm.write(() => {
      const ruleset = oldRealm.create('Ruleset', {
        ShortName: 'osu', OnlineID: 0, Name: 'osu!', InstantiationInfo: '', Available: true,
        LastAppliedDifficultyVersion: 0,
      })
      oldRealm.create('Score', {
        ID: new Realm.BSON.UUID(), BeatmapInfo: null, Ruleset: ruleset, Files: [], Hash: '', DeletePending: false,
        TotalScore: 1000, MaxCombo: 100, Accuracy: 1, Date: new Date(), PP: null, OnlineID: -1,
        User: { OnlineID: 1, Username: 'test', CountryCode: 'Unknown' }, Mods: JSON.stringify([{ acronym: 'HD' }]),
        Statistics: '{}', Rank: 0, Combo: 100, MaximumStatistics: '{}', BeatmapHash: '', IsLegacyScore: false,
        ClientVersion: '', TotalScoreWithoutMods: 0, TotalScoreVersion: 30000018, LegacyTotalScore: null,
        BackgroundReprocessingFailed: false, LegacyOnlineID: -1, Pauses: [],
      })
    })
    oldRealm.close()

    const db = init(path)
    try {
      const score = db.scores.get[0]
      assert.strictEqual(score.TotalScore, 1000)
      assert.strictEqual(score.TotalScoreVersion, 30000018)
      assert.strictEqual(score.TotalScoreWithoutMods, 0)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves keybinding records while clearing only conflicting combinations', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-keybinding-migration-'))
    const path = join(root, 'client.realm')
    const oldRealm = new Realm({ path, schema: Schema as Realm.ObjectSchema[], schemaVersion: 34 })
    oldRealm.write(() => {
      for (const action of [0, 1, 0]) {
        oldRealm.create('KeyBinding', {
          ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: action, KeyCombination: 'Z',
        })
      }
    })
    oldRealm.close()

    const db = init(path)
    try {
      const bindings = [...db.keybindings.get]
      assert.strictEqual(bindings.length, 3)
      assert.strictEqual(bindings.filter(binding => binding.KeyCombination === 'None').length, 3)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('remaps legacy mania keybindings without reusing deleted objects', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-mania-migration-'))
    const path = join(root, 'client.realm')
    const oldRealm = new Realm({ path, schema: Schema as Realm.ObjectSchema[], schemaVersion: 41 })
    oldRealm.write(() => {
      oldRealm.create('KeyBinding', {
        ID: new Realm.BSON.UUID(), RulesetName: 'mania', Variant: 1, Action: 1, KeyCombination: 'A',
      })
      oldRealm.create('KeyBinding', {
        ID: new Realm.BSON.UUID(), RulesetName: 'mania', Variant: 1, Action: 10, KeyCombination: 'B',
      })
    })
    oldRealm.close()

    const db = init(path)
    try {
      const bindings = [...db.keybindings.get].filter(binding => binding.RulesetName === 'mania' && binding.Variant === 1)
      assert.deepStrictEqual(bindings.map(binding => [binding.Action, binding.KeyCombination]), [[0, 'A']])
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts a schema 6 realm without later object types', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-schema-six-'))
    const path = join(root, 'client.realm')
    const rulesetSchema = Schema.find(schema => schema.name === 'Ruleset')!
    const oldRealm = new Realm({ path, schema: [rulesetSchema] as Realm.ObjectSchema[], schemaVersion: 6 })
    oldRealm.close()

    const db = init(path)
    try {
      assert.strictEqual(db.migration?.fromVersion, 6)
      assert.strictEqual(db.migration?.toVersion, CURRENT_SCHEMA_VERSION)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('discovers a sibling legacy collection database', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-collections-migration-'))
    const path = join(root, 'client.realm')
    const oldRealm = new Realm({ path, schema: [Schema.find(schema => schema.name === 'Ruleset')!] as Realm.ObjectSchema[], schemaVersion: 20 })
    oldRealm.close()
    writeFileSync(join(root, 'collection.db'), writeLegacyCollectionDb([{ name: 'Favorites', beatmapMD5s: ['a'.repeat(32)] }]))

    const db = init(path)
    try {
      assert.strictEqual(db.collections.get.byName('Favorites').length, 1)
    } finally {
      db.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
