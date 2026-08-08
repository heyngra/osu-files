import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createDocumentationDatabaseFixture, createFixtureDatabase, FIXTURE_IDS } from '../../docs/.vitepress/runner/fixture-db.js'

const SHA = 'a'.repeat(64)
const MD5 = 'b'.repeat(32)

function database() {
  return createFixtureDatabase(createDocumentationDatabaseFixture())
}

describe('documentation fixture database', () => {
  it('supports chained filters and normal array operations', () => {
    const db = database()
    const query = db.beatmaps.get.byTitle('Make A Move').byHidden(true).limit(1)

    assert.equal(query.count(), 1)
    assert.equal(query.length, 1)
    assert.equal(query[0]?.DifficultyName, 'Hard')
    assert.deepEqual([...query].map(item => item.DifficultyName), ['Hard'])
    assert.deepEqual(query.map(item => item.DifficultyName), ['Hard'])
    assert.deepEqual(query.filter(item => item.Hidden).map(item => item.DifficultyName), ['Hard'])
    assert.equal(query.find(item => item.Hidden)?.DifficultyName, 'Hard')
    assert.deepEqual(query.slice(0).map(item => item.DifficultyName), ['Hard'])
    assert.deepEqual(query.all(), query.toArray())
  })

  it('supports numeric, date, nested-link, and array-membership filters', () => {
    const db = database()

    assert.equal(db.beatmaps.get.byBpmAbove(180).length, 1)
    assert.equal(db.beatmaps.get.byLastPlayedAfter(new Date('2024-01-01')).length, 1)
    assert.equal(db.beatmaps.get.bySetOnlineId(506483).length, 2)
    assert.equal(db.scores.get.byUsernameContains('Cookiezi').length, 2)
    assert.equal(db.sets.get.withFile('audio.mp3').length, 1)
    assert.equal(db.collections.get.withBeatmap(MD5).length, 1)
    assert.equal(db.files.get.byHash(SHA).length, 1)
  })

  it('keeps built-in skin order separate from user skins', () => {
    const db = database()
    const builtIn = db.skins.get.builtIn()
    const users = db.skins.get.user()

    assert.equal(builtIn.length, 6)
    assert.equal(builtIn[0]?.Name, 'Built-in 1')
    assert.deepEqual(users.map(skin => skin.Name), ['Cursor Skin', 'WhiteCat'])
    assert.equal(db.skins.get.usable().length, 8)
  })

  it('commits and rolls back isolated edit sessions', () => {
    const db = database()
    const beatmap = db.beatmaps.get.byId(FIXTURE_IDS.beatmapSafe)
    const rollback = beatmap.autoEdit() as unknown as Array<Record<string, unknown>> & { rollback(): void }
    rollback[0].Hidden = true
    rollback.rollback()
    assert.equal(beatmap.first()?.Hidden, false)

    const commit = beatmap.autoEdit() as unknown as Array<Record<string, unknown>> & { commit(): void }
    commit[0].Hidden = true
    commit.commit()
    assert.equal(beatmap.first()?.Hidden, true)
  })

  it('updates and deletes rows without leaking into a fresh run', () => {
    const db = database()
    const beatmap = db.beatmaps.get.byId(FIXTURE_IDS.beatmapSafe)
    assert.equal(beatmap.write.update({ Hidden: true }), 1)
    assert.equal(beatmap.first()?.Hidden, true)

    assert.equal(beatmap.write.delete(), 1)
    assert.equal(beatmap.count(), 0)
    assert.equal(database().beatmaps.get.byId(FIXTURE_IDS.beatmapSafe).count(), 1)
  })
})
