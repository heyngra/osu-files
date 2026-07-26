import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init, RollbackEntry } from '../src/index.js'
import { nukeOldTestDirs } from './helpers.js'

describe('Rollback — logging', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-rollback-${Date.now()}`)
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => {
    nukeOldTestDirs()
    mkdirSync(tmpRoot, { recursive: true })
  })
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('enabled by default in read-write mode', () => {
    const osu = init(realmPath, { schemaVersion: 51 })
    assert.strictEqual(osu.logger.enabled, true)
    osu.close()
  })

  it('disabled in readOnly mode', () => {
    const osu = init(realmPath, { schemaVersion: 51, readOnly: true })
    assert.strictEqual(osu.logger.enabled, false)
    osu.close()
  })

  it('disabled when rollback: false', () => {
    const osu = init(realmPath, { schemaVersion: 51, rollback: false })
    assert.strictEqual(osu.logger.enabled, false)
    osu.close()
  })

  it('disable() clears entries', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    osu.beatmaps.write.create({ ID: new Realm.BSON.UUID(), Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.strictEqual(osu.logger.entries.length, 1)
    osu.logger.disable()
    assert.strictEqual(osu.logger.entries.length, 0)
    assert.strictEqual(osu.logger.enabled, false)
    osu.close()
  })

  it('create action is logged', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    const entries = osu.logger.entries
    assert.strictEqual(entries.length, 1)
    const e = entries[0]
    assert.strictEqual(e.action, 'create')
    assert.strictEqual(e.entity, 'Beatmap')
    assert.strictEqual(e.before, null)
    assert.ok(e.after)
    osu.close()
  })

  it('update action is logged', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    osu.beatmaps.write.update(id as any, { DifficultyName: 'New Name' })
    const entries = osu.logger.entries
    assert.strictEqual(entries.length, 2)
    const e = entries[1]
    assert.strictEqual(e.action, 'update')
    assert.ok(e.before)
    assert.ok(e.after)
    osu.close()
  })

  it('delete action is logged', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    osu.beatmaps.write.delete(id as any)
    const entries = osu.logger.entries
    assert.strictEqual(entries.length, 2)
    const e = entries[1]
    assert.strictEqual(e.action, 'delete')
    assert.ok(e.before)
    assert.strictEqual(e.after, null)
    osu.close()
  })

  it('entries are chronologically ordered', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    osu.beatmaps.write.update(id as any, { DifficultyName: 'X' })
    osu.beatmaps.write.delete(id as any)
    const entries = osu.logger.entries
    assert.strictEqual(entries[0].action, 'create')
    assert.strictEqual(entries[1].action, 'update')
    assert.strictEqual(entries[2].action, 'delete')
    osu.close()
  })

  it('upsert logs create for new PK, update for existing', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.upsert({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.strictEqual(osu.logger.entries[0].action, 'create')
    osu.beatmaps.write.upsert({ ID: id, Status: 1, OnlineID: -1, DifficultyName: 'upserted', TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.strictEqual(osu.logger.entries[1].action, 'update')
    osu.close()
  })
})

describe('Rollback — revert', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-rollback-revert-${Date.now()}`)
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => {
    nukeOldTestDirs()
    mkdirSync(tmpRoot, { recursive: true })
  })
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('revertLast undoes create', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.ok(osu.beatmaps.get.byId(id)[0])
    const result = osu.logger.rollbackLast()
    assert.strictEqual(result, true)
    assert.strictEqual(osu.beatmaps.get.byId(id)[0], undefined)
    osu.close()
  })

  it('revertLast undoes update', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4, DifficultyName: 'original' })
    osu.beatmaps.write.update(id as any, { DifficultyName: 'changed' })
    assert.strictEqual(osu.beatmaps.get.byId(id)[0]?.DifficultyName, 'changed')
    osu.logger.rollbackLast()
    assert.strictEqual(osu.beatmaps.get.byId(id)[0]?.DifficultyName, 'original')
    osu.close()
  })

  it('revertLast undoes delete', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4, DifficultyName: 'restored' })
    osu.beatmaps.write.delete(id as any)
    assert.strictEqual(osu.beatmaps.get.byId(id)[0], undefined)
    osu.logger.rollbackLast()
    assert.strictEqual(osu.beatmaps.get.byId(id)[0]?.DifficultyName, 'restored')
    osu.close()
  })

  it('rollbackAll undoes entire chain', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4, DifficultyName: 'chain' })
    osu.beatmaps.write.update(id as any, { DifficultyName: 'step2' })
    osu.beatmaps.write.delete(id as any)
    osu.logger.rollbackAll()
    assert.strictEqual(osu.beatmaps.get.byId(id)[0], undefined)
    assert.strictEqual(osu.logger.entries.length, 0)
    osu.close()
  })

  it('revertLast on empty log returns false', () => {
    const osu = init(realmPath, { schemaVersion: 51, rollback: false })
    assert.strictEqual(osu.logger.rollbackLast(), false)
    osu.close()
  })

  it('revertLast pops only one entry', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const idA = new Realm.BSON.UUID()
    const idB = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: idA, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    osu.beatmaps.write.create({ ID: idB, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    osu.logger.rollbackLast()
    assert.strictEqual(osu.beatmaps.get.byId(idB)[0], undefined)
    assert.ok(osu.beatmaps.get.byId(idA)[0])
    assert.strictEqual(osu.logger.entries.length, 1)
    osu.close()
  })

  it('revertLast returns true on success', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.strictEqual(osu.logger.rollbackLast(), true)
    osu.close()
  })

  it('rollbackTo reverts entries at and after the timestamp', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const idA = new Realm.BSON.UUID()
    const idB = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: idA, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    // Use the first entry's timestamp + 1 as cutoff so entry2 (created after) is the only one >= cutoff
    const midpoint = osu.logger.entries[0].timestamp + 1
    osu.beatmaps.write.create({ ID: idB, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    const count = osu.logger.rollbackTo(midpoint)
    assert.strictEqual(count, 1)
    assert.ok(osu.beatmaps.get.byId(idA)[0])
    assert.strictEqual(osu.beatmaps.get.byId(idB)[0], undefined)
    assert.strictEqual(osu.logger.entries.length, 1)
    osu.close()
  })

  it('rollbackTo returns correct count', async () => {
    const { default: Realm } = await import('realm')
    const osu = init(realmPath, { schemaVersion: 51 })
    const id = new Realm.BSON.UUID()
    osu.beatmaps.write.create({ ID: id, Status: 1, OnlineID: -1, TotalObjectCount: 0, EndTimeObjectCount: 0, Length: 0, BPM: 0, StarRating: 0, Hidden: false, BeatDivisor: 4 })
    assert.strictEqual(osu.logger.entries.length, 1)
    const count = osu.logger.rollbackTo(osu.logger.entries[0].timestamp)
    assert.strictEqual(count, 1)
    osu.close()
  })

  it('rollbackTo with future timestamp returns 0', () => {
    const osu = init(realmPath, { schemaVersion: 51, rollback: false })
    assert.strictEqual(osu.logger.rollbackTo(Infinity), 0)
    osu.close()
  })
})

describe('RollbackEntry type', { timeout: 60000 }, () => {
  const tmpRoot = join(tmpdir(), `osu-files-test-rollback-entry-${Date.now()}`)
  const realmPath = join(tmpRoot, 'client.realm')

  before(() => {
    nukeOldTestDirs()
    mkdirSync(tmpRoot, { recursive: true })
  })
  after(() => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch {} })

  it('RollbackEntry has toString and entryId', () => {
    const osu = init(realmPath, { schemaVersion: 51 })
    const entries = osu.logger.entries
    assert.strictEqual(entries.length, 0)
    // RollbackEntry is constructable
    const entry = new RollbackEntry({
      timestamp: 1000,
      entity: 'Test',
      action: 'create' as any,
      primaryKey: 'pk-1',
      before: null,
      after: { name: 'test' },
    })
    assert.ok(entry.entryId)
    assert.ok(entry.toString().includes('create'))
    assert.ok(entry.toString().includes('Test'))
    assert.strictEqual(entry.before, null)
    assert.deepStrictEqual(entry.after, { name: 'test' })
    osu.close()
  })
})
