import { describe, it } from 'node:test'
import assert from 'node:assert'
import { rmSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Realm from 'realm'
import { init } from '../src/index.js'
import { GlobalAction, OsuAction } from '../src/index.js'
import { getManiaDefaults, OSU_DEFAULTS, GLOBAL_DEFAULTS } from '../src/index.js'
import type { KeyBinding } from '../src/schema/types.js'
import type { KeyBindingDef } from '../src/keybindings/types.js'

describe('KeyBinding module', () => {
  it('create and query a keybinding', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const id = new Realm.BSON.UUID()
      osu.keybindings.write.create({
        ID: id,
        RulesetName: 'osu',
        Action: 0,
        KeyCombination: 'Z',
      })
      assert.strictEqual(osu.keybindings.get.length, 1)
      assert.strictEqual(osu.keybindings.get[0].Action, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('queries by ruleset name', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Action: 0, KeyCombination: 'Z' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Action: 1, KeyCombination: 'X' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), Action: 2, KeyCombination: 'Escape' })
      assert.strictEqual(osu.keybindings.get.byRulesetNameEquals('osu').length, 2)
      assert.strictEqual(osu.keybindings.get.length, 3)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerDefaults inserts missing bindings', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, 'osu', 0)
      assert.strictEqual(r.inserted, OSU_DEFAULTS.length)
      assert.strictEqual(r.removed, 0)
      assert.strictEqual(osu.keybindings.get.byRulesetNameEquals('osu').length, OSU_DEFAULTS.length)

      const leftButtons = osu.keybindings.get.filter(k => k.RulesetName === 'osu' && k.Action === 0)
      assert.strictEqual(leftButtons.length, 2)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerDefaults trims excess bindings', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 0, KeyCombination: 'Z' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 0, KeyCombination: 'MouseLeft' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 0, KeyCombination: 'ExtraKey' })

      assert.strictEqual(osu.keybindings.get.length, 3)
      const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, 'osu', 0)
      assert.strictEqual(r.removed, 1)
      assert.strictEqual(osu.keybindings.get.byRulesetNameEquals('osu').length, OSU_DEFAULTS.length)

      const leftButtons = osu.keybindings.get.filter(k => k.RulesetName === 'osu' && k.Action === 0)
      assert.strictEqual(leftButtons.length, 2)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerDefaults does not touch other actions', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 0, KeyCombination: 'Z' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 0, KeyCombination: 'MouseLeft' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 1, KeyCombination: 'X' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 1, KeyCombination: 'MouseRight' })
      osu.keybindings.write.create({ ID: new Realm.BSON.UUID(), RulesetName: 'osu', Variant: 0, Action: 99, KeyCombination: 'SomeKey' })

      const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, 'osu', 0)
      assert.strictEqual(r.removed, 0)
      assert.strictEqual(r.inserted, 1)

      const action99 = osu.keybindings.get.filter(k => k.RulesetName === 'osu' && k.Action === 99)
      assert.strictEqual(action99.length, 1)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerDefaults noop when counts match', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      osu.keybindings.registerDefaults(OSU_DEFAULTS, 'osu', 0)
      const r = osu.keybindings.registerDefaults(OSU_DEFAULTS, 'osu', 0)
      assert.strictEqual(r.inserted, 0)
      assert.strictEqual(r.removed, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerDefaults global bindings', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const r = osu.keybindings.registerDefaults(GLOBAL_DEFAULTS)
      assert.ok(r.inserted > 0)
      assert.strictEqual(r.removed, 0)

      const globalBinds = osu.keybindings.get.filter(k => k.RulesetName === null || k.RulesetName === undefined)
      assert.strictEqual(globalBinds.length, r.inserted)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })

  it('registerAllBuiltInDefaults registers everything', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const r = osu.keybindings.registerAllBuiltInDefaults()
      assert.ok(r.inserted > 0)
      assert.strictEqual(r.removed, 0)

      const osuBinds = osu.keybindings.get.filter(k => k.RulesetName === 'osu')
      assert.strictEqual(osuBinds.length, OSU_DEFAULTS.length)

      const globalBinds = osu.keybindings.get.filter(k => k.RulesetName === null || k.RulesetName === undefined)
      assert.strictEqual(globalBinds.length, GLOBAL_DEFAULTS.length)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })
})

describe('registerDefaults utility', () => {
  it('getManiaDefaults produces correct count for 4K', () => {
    const d = getManiaDefaults(4)
    assert.strictEqual(d.length, 8)
    assert.strictEqual(d[0].action, 0); assert.strictEqual(d[0].keyCombination, 'D')
    assert.strictEqual(d[1].action, 0); assert.strictEqual(d[1].keyCombination, 'None')
    assert.strictEqual(d[2].action, 1); assert.strictEqual(d[2].keyCombination, 'F')
    assert.strictEqual(d[4].action, 2); assert.strictEqual(d[4].keyCombination, 'J')
    assert.strictEqual(d[6].action, 3); assert.strictEqual(d[6].keyCombination, 'K')
  })

  it('getManiaDefaults produces correct count for 7K', () => {
    const d = getManiaDefaults(7)
    assert.strictEqual(d.length, 14)
    assert.strictEqual(d[0].action, 0); assert.strictEqual(d[0].keyCombination, 'S')
    assert.strictEqual(d[6].action, 3); assert.strictEqual(d[6].keyCombination, 'Space')
    assert.strictEqual(d[8].action, 4); assert.strictEqual(d[8].keyCombination, 'J')
    assert.strictEqual(d[12].action, 6); assert.strictEqual(d[12].keyCombination, 'L')
    assert.strictEqual(d[13].action, 6); assert.strictEqual(d[13].keyCombination, 'None')
  })

  it('getManiaDefaults produces correct count for 10K', () => {
    const d = getManiaDefaults(10)
    assert.strictEqual(d.length, 20)
    assert.strictEqual(d[0].keyCombination, 'A')
    assert.strictEqual(d[8].keyCombination, 'V')
    assert.strictEqual(d[10].keyCombination, 'N')
  })

  it('registerDefaults returns zero for empty defaults', () => {
    const root = mkdtempSync(join(tmpdir(), 'osu-files-test-'))
    const osu = init(join(root, 'client.realm'), { schemaVersion: 51 })
    try {
      const r = osu.keybindings.registerDefaults([])
      assert.strictEqual(r.inserted, 0)
      assert.strictEqual(r.removed, 0)
    } finally { osu.close(); rmSync(root, { recursive: true, force: true }) }
  })
})
