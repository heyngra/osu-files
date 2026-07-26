import { describe, it } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'fs'
import { readLegacyCollectionDb, writeLegacyCollectionDb } from '../../src/collections/legacy.js'

const KARATE_FIXTURE = 'tests/collections/karate.db'
const KARATE_COLLECTION_NAME = 'karate - add hr to most of these'
const KARATE_HASH_COUNT = 65
const KARATE_FIRST_HASH = '84850d4ae1540266da89324e0c1abd37'
const KARATE_LAST_HASH = '09abcad824c73a63ffbe52181d76d4d4'

function fromHex(hex: string): Buffer {
  return Buffer.from(hex.replace(/\s+/g, ''), 'hex')
}

describe('collectons.db legacy format', () => {
  it('reads real-world karate fixture', () => {
    const buf = readFileSync(KARATE_FIXTURE)
    const entries = readLegacyCollectionDb(buf)

    assert.strictEqual(entries.length, 1)
    assert.strictEqual(entries[0].name, KARATE_COLLECTION_NAME)
    assert.strictEqual(entries[0].beatmapMD5s.length, KARATE_HASH_COUNT)
    assert.strictEqual(entries[0].beatmapMD5s[0], KARATE_FIRST_HASH)
    assert.strictEqual(entries[0].beatmapMD5s[KARATE_HASH_COUNT - 1], KARATE_LAST_HASH)
  })

  it('roundtrips karate fixture', () => {
    const buf = readFileSync(KARATE_FIXTURE)
    const entries = readLegacyCollectionDb(buf)
    const written = writeLegacyCollectionDb(entries)
    const reRead = readLegacyCollectionDb(written)

    assert.strictEqual(reRead.length, entries.length)
    for (let i = 0; i < entries.length; i++) {
      assert.strictEqual(reRead[i].name, entries[i].name)
      assert.deepStrictEqual(reRead[i].beatmapMD5s, entries[i].beatmapMD5s)
    }
  })

  it('handles empty collections', () => {
    const entries = [{ name: 'Empty', beatmapMD5s: [] as string[] }]
    const buf = writeLegacyCollectionDb(entries)
    const reRead = readLegacyCollectionDb(buf)

    assert.strictEqual(reRead.length, 1)
    assert.strictEqual(reRead[0].name, 'Empty')
    assert.strictEqual(reRead[0].beatmapMD5s.length, 0)
  })

  it('handles empty name', () => {
    const entries = [{ name: '', beatmapMD5s: ['abc'] }]
    const buf = writeLegacyCollectionDb(entries)
    const reRead = readLegacyCollectionDb(buf)

    assert.strictEqual(reRead[0].name, '')
    assert.deepStrictEqual(reRead[0].beatmapMD5s, ['abc'])
  })

  it('handles multiple collections with varying sizes', () => {
    const entries = [
      { name: 'A', beatmapMD5s: ['a', 'b', 'c'] },
      { name: 'B', beatmapMD5s: ['d'] },
      { name: 'C', beatmapMD5s: [] as string[] },
      { name: 'D', beatmapMD5s: ['e', 'f'] },
    ]
    const buf = writeLegacyCollectionDb(entries)
    const reRead = readLegacyCollectionDb(buf)

    assert.strictEqual(reRead.length, 4)
    assert.strictEqual(reRead[0].name, 'A')
    assert.deepStrictEqual(reRead[0].beatmapMD5s, ['a', 'b', 'c'])
    assert.strictEqual(reRead[1].name, 'B')
    assert.deepStrictEqual(reRead[1].beatmapMD5s, ['d'])
    assert.strictEqual(reRead[2].name, 'C')
    assert.strictEqual(reRead[2].beatmapMD5s.length, 0)
    assert.strictEqual(reRead[3].name, 'D')
    assert.deepStrictEqual(reRead[3].beatmapMD5s, ['e', 'f'])
  })

  it('handles special characters in name', () => {
    const entries = [
      { name: 'Favo💝rites', beatmapMD5s: ['abc'] },
      { name: 'Namę', beatmapMD5s: ['def'] },
    ]
    const buf = writeLegacyCollectionDb(entries)
    const reRead = readLegacyCollectionDb(buf)

    assert.strictEqual(reRead.length, 2)
    assert.strictEqual(reRead[0].name, 'Favo💝rites')
    assert.strictEqual(reRead[1].name, 'Namę')
  })

  it('reads version with includeVersion option', () => {
    const buf = readFileSync(KARATE_FIXTURE)
    const result = readLegacyCollectionDb(buf, { includeVersion: true })

    assert.strictEqual(result.version, 20160212)
    assert.strictEqual(result.entries.length, 1)
    assert.strictEqual(result.entries[0].name, KARATE_COLLECTION_NAME)
  })

  it('written version matches LEGACY_VERSION constant', () => {
    const buf = writeLegacyCollectionDb([{ name: 'test', beatmapMD5s: [] }])
    const version = buf.readInt32LE(0)
    assert.strictEqual(version, 0x01343DCB)
  })

  it('binary output matches expected hex for simple case', () => {
    const entries = [{ name: 'X', beatmapMD5s: ['0123456789abcdef0123456789abcdef'] }]
    const buf = writeLegacyCollectionDb(entries)

    const expected = fromHex(
      'CB 3D 34 01' +  // version
      '01 00 00 00' +  // count = 1
      '0B' +           // string sentinel
      '01' +           // name length = 1
      '58' +           // 'X'
      '01 00 00 00' +  // beatmap count = 1
      '0B' +           // string sentinel
      '20' +           // md5 length = 32
      '3031323334353637383961626364656630313233343536373839616263646566'
    )

    assert.deepStrictEqual([...buf], [...expected])
  })
})
